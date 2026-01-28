package net.aura.service

import android.content.Context
import android.util.Log
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.AdvertisingOptions
import com.google.android.gms.nearby.connection.ConnectionInfo
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback
import com.google.android.gms.nearby.connection.ConnectionResolution
import com.google.android.gms.nearby.connection.ConnectionsClient
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo
import com.google.android.gms.nearby.connection.DiscoveryOptions
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback
import com.google.android.gms.nearby.connection.Payload
import com.google.android.gms.nearby.connection.PayloadCallback
import com.google.android.gms.nearby.connection.PayloadTransferUpdate
import com.google.android.gms.nearby.connection.Strategy
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import net.aura.proto.BUCKET_COUNT
import net.aura.proto.Event
import net.aura.proto.MessageRegistries
import net.aura.proto.RawMessage
import net.aura.proto.SyncPacket
import net.aura.proto.toHex
import java.nio.ByteBuffer
import kotlin.collections.remove
import kotlin.random.Random
import kotlin.random.nextUInt
import kotlin.text.set

private val SERVICE_ID = "net.aura"

private const val BROADCAST_PREFIX = "AURA_"

private fun logRegistryStatus(){
    Log.i("AURA_DEBUG", "----LOCAL REGISTRY STATUS----")
    Log.i("AURA_DEBUG", "Root: ${MessageRegistries.local.rootHash.sliceArray(0 until 6).toHex()}")
    Log.i("AURA_DEBUG", "Optimisation: ${MessageRegistries.local.optimisationLevel.map { it.sliceArray(0 until 2).toHex() }.joinToString(";")}")
    Log.i("AURA_DEBUG", "Messages count: ${MessageRegistries.local.buckets.sumOf { bucket -> bucket.messages.size }}")

    Log.i("AURA_DEBUG", "----GLOBAL REGISTRY STATUS----")
    Log.i("AURA_DEBUG", "Root: ${MessageRegistries.global.rootHash.sliceArray(0 until 6).toHex()}")
    Log.i("AURA_DEBUG", "Optimisation: ${MessageRegistries.global.optimisationLevel.map { it.sliceArray(0 until 2).toHex() }.joinToString(";")}")
    Log.i("AURA_DEBUG", "Messages count: ${MessageRegistries.global.buckets.sumOf { bucket -> bucket.messages.size }}")
}

class Engine (val context: Context) {
    private var id: UInt = 0u

    class ConnectionData

    private val endpointIds = HashMap<String, UInt>()
    private val activeConnections = HashMap<String, ConnectionData>()
    private lateinit var connectionsClient: ConnectionsClient

    //events
    public val onActiveConnectionsChange = Event<HashMap<String, ConnectionData>>()


    //external functions
    fun onCreate() {
        MessageRegistries.loadAll(context)

        logRegistryStatus()

        id = Random.nextUInt()
        connectionsClient = Nearby.getConnectionsClient(context)

        MessageRegistries.onMessage.plusAssign { (msg, global, from) ->
            logRegistryStatus()

            MessageRegistries.saveAll(context)

            val payload = SyncPacket.packMessage(msg)

            val targetCount = activeConnections.size
            if (targetCount == 0) {
                Log.w("AURA_DEBUG", "No active connections to propagate message!")
            }

            val pl = Payload.fromBytes(payload.buffer.array())

            for (conn in activeConnections) {
                if (from != null && conn.key == from) continue

                connectionsClient.sendPayload(conn.key, pl)
                    .addOnFailureListener {
                        Log.e("AURA_DEBUG", "Failed to send payload to ${conn.key}: ${it.message}")
                    }
            }
        }
    }

    fun startMesh() {
        val options = Strategy.P2P_CLUSTER
        connectionsClient.startAdvertising(
            createDiscoveryName(),
            SERVICE_ID,
            connectionLifecycleCallback,
            AdvertisingOptions.Builder().setLowPower(false).setStrategy(options).build()
        ).addOnFailureListener {
            if (it.message?.startsWith("8001") == false) Log.e("AURA_DEBUG", "[ADVERTISING] ${it.message}")
        }

        connectionsClient.startDiscovery(
            SERVICE_ID,
            endpointDiscoveryCallback,
            DiscoveryOptions.Builder().setLowPower(false).setStrategy(options).build()
        ).addOnFailureListener {
            if (it.message?.startsWith("8002") == false) Log.e("AURA_DEBUG", "[DISCOVERY] ${it.message}")
        }
    }

    suspend fun heal(){
        connectionsClient.stopAdvertising()
        connectionsClient.stopDiscovery()

        delay(500)

        startMesh()
    }

    fun stop(){
        connectionsClient.stopAdvertising();
        connectionsClient.stopDiscovery();
        connectionsClient.stopAllEndpoints()
    }




    //utils
    private fun isSubmissive(remoteAddress: String): Boolean {
        val remoteIdStr = remoteAddress.substringAfter(BROADCAST_PREFIX)
        val remoteId = remoteIdStr.toUIntOrNull() ?: return false
        return remoteId < id
    }
    private fun getId(remoteAddress: String): UInt {
        return remoteAddress.substringAfter(BROADCAST_PREFIX).toUIntOrNull() ?: 0u
    }
    private fun isSubmissiveByEndpoint(endpoint: String): Boolean {
        val remoteId = endpointIds[endpoint] ?: return true
        return remoteId < id
    }
    private fun createDiscoveryName(): String = BROADCAST_PREFIX + id



    //callbacks
    private val endpointDiscoveryCallback = object : EndpointDiscoveryCallback() {
        override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
            Log.d("AURA_DEBUG", "Discovered node: $endpointId (${info.endpointName}).")
            endpointIds[endpointId] = getId(info.endpointName)

            if (!isSubmissive(info.endpointName)) {
                Log.d("AURA_DEBUG", "Node is dominant, waiting...")
                return
            }
            Log.d("AURA_DEBUG", "Node is submissive, connecting...")

            connectionsClient.requestConnection(createDiscoveryName(), endpointId, connectionLifecycleCallback)
                .addOnFailureListener { Log.e("AURA_DEBUG", "[CONNECTION REQUEST] ${it.message}") }
        }

        override fun onEndpointLost(endpointId: String) {}
    }

    private val connectionLifecycleCallback = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
            endpointIds[endpointId] = getId(info.endpointName)
            activeConnections[endpointId] = ConnectionData()
            onActiveConnectionsChange(activeConnections)
            connectionsClient.acceptConnection(endpointId, payloadCallback)
        }

        override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
            if (result.status.isSuccess) {
                Log.d("AURA_DEBUG", "Connected to $endpointId.")
                activeConnections[endpointId] = ConnectionData()
                onActiveConnectionsChange(activeConnections)
                if (isSubmissiveByEndpoint(endpointId)) {
                    Log.d("AURA_DEBUG", "Submissive. Sending sync start")
                    connectionsClient.sendPayload(endpointId,
                        Payload.fromBytes(SyncPacket.packSyncStart(true).buffer.array()))
                    connectionsClient.sendPayload(endpointId,
                        Payload.fromBytes(SyncPacket.packSyncStart(false).buffer.array()))
                }
            } else {
                Log.e("AURA_DEBUG", "[CONNECTION]: ${result.status}")
                activeConnections.remove(endpointId)
            }
        }

        override fun onDisconnected(endpointId: String) {
            Log.d("AURA_DEBUG", "[CONNECTION]: Disconnected $endpointId")
            activeConnections.remove(endpointId)
            onActiveConnectionsChange(activeConnections)
        }
    }

    private val payloadCallback = object : PayloadCallback() {
        override fun onPayloadReceived(endpointId: String, payload: Payload) {
            try {
                if (payload.type == Payload.Type.BYTES) {
                    val bytes = payload.asBytes() ?: return
                    if (bytes.isEmpty()) return

                    SyncPacket(bytes).process(endpointId).forEach { connectionsClient.sendPayload(endpointId,
                        Payload.fromBytes(it.buffer.array())) }
                }
            }
            catch (e: Error){
                Log.e("AURA_DEBUG", "Error, while processing payload: ${e}")
            }
        }
        override fun onPayloadTransferUpdate(p0: String, p1: PayloadTransferUpdate) {}
    }
}