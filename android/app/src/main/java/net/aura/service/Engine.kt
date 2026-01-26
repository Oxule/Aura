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
import net.aura.proto.toHex
import java.nio.ByteBuffer
import kotlin.collections.remove
import kotlin.random.Random
import kotlin.random.nextUInt
import kotlin.text.set

private const val OPCODE_MESSAGE: Byte = 0
private const val OPCODE_REGISTRY_COARSE: Byte = 1
private const val OPCODE_REGISTRY_COARSE_RESPONSE: Byte = 2
private const val OPCODE_REGISTRY_FINE: Byte = 3
private const val OPCODE_REGISTRY_FINE_RESPONSE: Byte = 4

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

            val payload = ByteBuffer.allocate(msg.fullData.size + 1)
            payload.put(OPCODE_MESSAGE)
            payload.put(msg.fullData)

            val targetCount = activeConnections.size
            if (targetCount == 0) {
                Log.w("AURA_DEBUG", "No active connections to propagate message!")
            }

            val pl = Payload.fromBytes(payload.array())

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



    //protocol sync

    private fun sendMessage(msg: RawMessage, endpoint: String) {
        val payload = ByteBuffer.allocate(msg.fullData.size + 1)
        payload.put(OPCODE_MESSAGE)
        payload.put(msg.fullData)

        Log.v("AURA_DEBUG", "-> SEND_MESSAGE to $endpoint (${msg.fullData.size} bytes)")
        connectionsClient.sendPayload(endpoint, Payload.fromBytes(payload.array()))
    }

    private fun sendCoarseRegistry(endpoint: String) {
        Log.d("AURA_DEBUG", "Step 1: Initiating sync with $endpoint (sending COARSE)")
        val buffer = ByteBuffer.allocate(1 + BUCKET_COUNT / 2)
        buffer.put(OPCODE_REGISTRY_COARSE)

        val localOpt = MessageRegistries.local.optimisationLevel
        for (i in 0 until BUCKET_COUNT / 8) {
            buffer.put(localOpt[i], 0, 2)
        }
        val globalOpt = MessageRegistries.global.optimisationLevel
        for (i in 0 until BUCKET_COUNT / 8) {
            buffer.put(globalOpt[i], 0, 2)
        }

        connectionsClient.sendPayload(endpoint, Payload.fromBytes(buffer.array()))
            .addOnSuccessListener { Log.d("AURA_DEBUG", "Sent coarse registry to $endpoint.") }
    }

    private fun processCoarseRegistry(endpoint: String, bytes: ByteArray) {
        Log.d("AURA_DEBUG", "Step 2: Received COARSE from $endpoint (${bytes.size} bytes)")
        if (bytes.size != 1 + BUCKET_COUNT / 2) {
            Log.e("AURA_DEBUG", "Coarse registry size mismatch: ${bytes.size}")
            return
        }

        val buffer = ByteBuffer.wrap(bytes)
        buffer.get() // Skip OPCODE

        val diffLocal = mutableListOf<Byte>()
        val diffGlobal = mutableListOf<Byte>()
        val groupCount = BUCKET_COUNT / 8

        for (i in 0 until groupCount) {
            val localH = MessageRegistries.local.optimisationLevel[i]
            val r1 = buffer.get()
            val r2 = buffer.get()
            if (localH[0] != r1 || localH[1] != r2) {
                diffLocal.add(i.toByte())
            }
        }
        for (i in 0 until groupCount) {
            val localH = MessageRegistries.global.optimisationLevel[i]
            val r1 = buffer.get()
            val r2 = buffer.get()
            if (localH[0] != r1 || localH[1] != r2) {
                diffGlobal.add(i.toByte())
            }
        }

        Log.d("AURA_DEBUG", "   Diff groups found: Local=${diffLocal.size}, Global=${diffGlobal.size}")

        if (diffLocal.isEmpty() && diffGlobal.isEmpty()) {
            Log.d("AURA_DEBUG", "Registry synced with $endpoint (No diff)")
            return
        }

        val out = ByteBuffer.allocate(2 + diffLocal.size + diffGlobal.size)
        out.put(OPCODE_REGISTRY_COARSE_RESPONSE)
        out.put(diffLocal.size.toByte())
        diffLocal.forEach { out.put(it) }
        diffGlobal.forEach { out.put(it) }

        Log.d("AURA_DEBUG", "-> Sending COARSE_RESPONSE (Requesting FINE for ${diffLocal.size + diffGlobal.size} groups)")
        connectionsClient.sendPayload(endpoint, Payload.fromBytes(out.array()))
    }

    private fun processBucketRequest(endpoint: String, bytes: ByteArray) {
        val buffer = ByteBuffer.wrap(bytes)
        buffer.get() // Skip OPCODE

        val localCount = buffer.get().toInt() and 0xFF
        val globalCount = bytes.size - 2 - localCount

        Log.d("AURA_DEBUG", "Step 3: Received COARSE_RESPONSE. Remote wants FINE for L:$localCount, G:$globalCount")

        val out = ByteBuffer.allocate(3 + (localCount + globalCount) * 17)
        out.put(OPCODE_REGISTRY_FINE)
        out.put(localCount.toByte())
        out.put(globalCount.toByte())

        repeat(localCount) {
            val gIdx = buffer.get().toInt() and 0xFF
            out.put(gIdx.toByte())
            repeat(8) { j -> out.put(MessageRegistries.local.buckets[gIdx * 8 + j].hash, 0, 2) }
        }
        repeat(globalCount) {
            val gIdx = buffer.get().toInt() and 0xFF
            out.put(gIdx.toByte())
            repeat(8) { j -> out.put(MessageRegistries.global.buckets[gIdx * 8 + j].hash, 0, 2) }
        }

        Log.d("AURA_DEBUG", "-> Sending FINE data to $endpoint")
        connectionsClient.sendPayload(endpoint, Payload.fromBytes(out.array()))
    }

    private fun processBuckets(endpoint: String, bytes: ByteArray) {
        val buffer = ByteBuffer.wrap(bytes)
        if (buffer.remaining() < 3) return

        buffer.get() // Skip OPCODE
        val localGroupCount = buffer.get().toInt() and 0xFF
        val globalGroupCount = buffer.get().toInt() and 0xFF

        Log.d("AURA_DEBUG", "Step 4: Received FINE. Comparing L-Groups:$localGroupCount, G-Groups:$globalGroupCount")

        val diffLocal = mutableListOf<Int>()
        val diffGlobal = mutableListOf<Int>()

        repeat(localGroupCount) {
            if (buffer.remaining() >= 17) {
                val gIdx = buffer.get().toInt() and 0xFF
                repeat(8) { j ->
                    val bIdx = gIdx * 8 + j
                    val h = MessageRegistries.local.buckets[bIdx].hash
                    val r1 = buffer.get()
                    val r2 = buffer.get()
                    if (h[0] != r1 || h[1] != r2) diffLocal.add(bIdx)
                }
            }
        }

        repeat(globalGroupCount) {
            if (buffer.remaining() >= 17) {
                val gIdx = buffer.get().toInt() and 0xFF
                repeat(8) { j ->
                    val bIdx = gIdx * 8 + j
                    val h = MessageRegistries.global.buckets[bIdx].hash
                    val r1 = buffer.get()
                    val r2 = buffer.get()
                    if (h[0] != r1 || h[1] != r2) diffGlobal.add(bIdx)
                }
            }
        }

        Log.d("AURA_DEBUG", "   Specific diff buckets: Local=${diffLocal.size}, Global=${diffGlobal.size}")

        if (diffLocal.isEmpty() && diffGlobal.isEmpty()) {
            Log.d("AURA_DEBUG", "   No bucket diffs found after FINE analysis.")
            return
        }

        val out = ByteBuffer.allocate(3 + (diffLocal.size + diffGlobal.size) * 2)
        out.put(OPCODE_REGISTRY_FINE_RESPONSE)
        out.putShort(diffLocal.size.toShort())
        diffLocal.forEach { out.putShort(it.toShort()) }
        diffGlobal.forEach { out.putShort(it.toShort()) }

        Log.d("AURA_DEBUG", "-> Sending FINE_RESPONSE (Requesting messages from ${diffLocal.size + diffGlobal.size} buckets)")
        connectionsClient.sendPayload(endpoint, Payload.fromBytes(out.array()))

        var sentCount = 0
        for (bIdx in diffLocal) {
            val bucket = MessageRegistries.local.buckets[bIdx]
            bucket.messages.forEach {
                sendMessage(it.msg, endpoint)
                sentCount++
            }
        }
        for (bIdx in diffGlobal) {
            val bucket = MessageRegistries.global.buckets[bIdx]
            bucket.messages.forEach {
                sendMessage(it.msg, endpoint)
                sentCount++
            }
        }
        Log.d("AURA_DEBUG", "-> Also Pushed $sentCount local messages for diverging buckets.")
    }

    private fun processBucketsDiff(endpoint: String, bytes: ByteArray) {
        val buffer = ByteBuffer.wrap(bytes)
        buffer.get() // Skip OPCODE

        val localCount = buffer.short.toInt() and 0xFFFF
        Log.d("AURA_DEBUG", "Step 5: Received FINE_RESPONSE from $endpoint. Preparing to send missing messages.")

        val targetBuckets = ArrayList<Pair<Int, Boolean>>(bytes.size / 2)
        repeat(localCount) {
            targetBuckets.add(buffer.short.toInt() to true)
        }
        while (buffer.hasRemaining()) {
            targetBuckets.add(buffer.short.toInt() to false)
        }

        var totalMsgsSent = 0
        for ((bIdx, isLocal) in targetBuckets) {
            val bucket = if (isLocal) MessageRegistries.local.buckets[bIdx]
            else MessageRegistries.global.buckets[bIdx]

            bucket.messages.forEach {
                sendMessage(it.msg, endpoint)
                totalMsgsSent++
            }
        }
        Log.d("AURA_DEBUG", "Final Step: Sent $totalMsgsSent messages to $endpoint to complete sync.")
    }



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
                    Log.d("AURA_DEBUG", "Submissive. Sending coarse registry")
                    sendCoarseRegistry(endpointId)
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

                    Log.d(
                        "AURA_DEBUG",
                        "RAW_RECEIVE: From $endpointId, OpCode=${bytes[0]}, Size=${bytes.size}"
                    )

                    when (bytes[0]) {
                        OPCODE_MESSAGE -> {
                            if (bytes.size > 1) {
                                val msgBytes = ByteArray(bytes.size - 1)
                                System.arraycopy(bytes, 1, msgBytes, 0, bytes.size - 1)
                                MessageRegistries.processMessage(
                                    RawMessage.fromBytes(msgBytes),
                                    endpointId
                                )
                            }
                        }

                        OPCODE_REGISTRY_COARSE -> processCoarseRegistry(endpointId, bytes)
                        OPCODE_REGISTRY_COARSE_RESPONSE -> processBucketRequest(endpointId, bytes)
                        OPCODE_REGISTRY_FINE -> processBuckets(endpointId, bytes)
                        OPCODE_REGISTRY_FINE_RESPONSE -> processBucketsDiff(endpointId, bytes)
                    }
                }
            }
            catch (e: Error){
                Log.e("AURA_DEBUG", "Error, while processing payload: ${e}")
            }
        }
        override fun onPayloadTransferUpdate(p0: String, p1: PayloadTransferUpdate) {}
    }
}