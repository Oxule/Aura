package net.aura.proto

import android.util.Log
import java.nio.ByteBuffer
import kotlin.experimental.and
import kotlin.experimental.or

const val SYNC_PACKET_FLAGS_TYPE_MASK : Byte = 0b00001111
const val SYNC_PACKET_FLAGS_REGISTRY_MASK : Byte = 0b00110000

const val SYNC_PACKET_FLAGS_REGISTRY_LOCAL : Byte = 0b00000000
const val SYNC_PACKET_FLAGS_REGISTRY_GLOBAL : Byte = 0b00010000

const val SYNC_PACKET_FLAGS_TYPE_MESSAGE : Byte = 0b00000000
const val SYNC_PACKET_FLAGS_TYPE_START : Byte = 0b00000001
const val SYNC_PACKET_FLAGS_TYPE_DIFF : Byte = 0b00000010
const val SYNC_PACKET_FLAGS_TYPE_FINE : Byte = 0b00000011

private const val TAG = "AURA_DEBUG"

class SyncPacket(val buffer: ByteBuffer) {
    constructor(bytes: ByteArray) : this(ByteBuffer.wrap(bytes))

    companion object {
        fun packMessage(message: RawMessage): SyncPacket {
            Log.d(TAG, "📦 Packing MESSAGE: hash=${message.hash().toHex().take(8)}...")
            val buffer = ByteBuffer.allocate(message.fullData.size + 1)
            buffer.put(SYNC_PACKET_FLAGS_TYPE_MESSAGE)
            buffer.put(message.fullData)
            buffer.flip()
            return SyncPacket(buffer)
        }

        fun packSyncStart(global: Boolean): SyncPacket {
            Log.i(TAG, "🔄 Packing SYNC_START (${if (global) "GLOBAL" else "LOCAL"})")
            val buffer = ByteBuffer.allocate(1 + 128 * 2)
            buffer.put(SYNC_PACKET_FLAGS_TYPE_START or (if (global) SYNC_PACKET_FLAGS_REGISTRY_GLOBAL else SYNC_PACKET_FLAGS_REGISTRY_LOCAL))
            val reg = if (global) MessageRegistries.global else MessageRegistries.local
            reg.recalculate()
            reg.clean()
            for (i in 0 until 128) buffer.put(reg.optimisationLevel[i], 0, 2)
            buffer.flip()
            return SyncPacket(buffer)
        }

        fun packSyncDiffWithFine(global: Boolean, mask: ByteArray, dirtyGroups: List<Int>): SyncPacket {
            Log.d(TAG, "👺 Packing SYNC_DIFF + FINE hashes for groups: ${dirtyGroups.joinToString(",")}")
            val buffer = ByteBuffer.allocate(1 + 16 + dirtyGroups.size * (8 * 2))
            buffer.put(SYNC_PACKET_FLAGS_TYPE_DIFF or (if (global) SYNC_PACKET_FLAGS_REGISTRY_GLOBAL else SYNC_PACKET_FLAGS_REGISTRY_LOCAL))
            buffer.put(mask)
            val reg = if (global) MessageRegistries.global else MessageRegistries.local
            for (gIdx in dirtyGroups) {
                for (j in 0 until 8) {
                    buffer.put(reg.buckets[gIdx * 8 + j].hash, 0, 2)
                }
            }
            buffer.flip()
            return SyncPacket(buffer)
        }

        fun packSyncFineRequest(global: Boolean, bucketIndices: List<Int>): SyncPacket {
            Log.d(TAG, "🔍 Packing SYNC_FINE request for buckets: ${bucketIndices.joinToString(",")}")
            val buffer = ByteBuffer.allocate(1 + bucketIndices.size * 2)
            buffer.put(SYNC_PACKET_FLAGS_TYPE_FINE or (if (global) SYNC_PACKET_FLAGS_REGISTRY_GLOBAL else SYNC_PACKET_FLAGS_REGISTRY_LOCAL))
            for (idx in bucketIndices) {
                buffer.putShort(idx.toShort())
            }
            buffer.flip()
            return SyncPacket(buffer)
        }
    }

    init {
        require(buffer.remaining() >= 1) { "Packet too small" }
    }

    private fun getRegistry(): Byte = buffer.get(0) and SYNC_PACKET_FLAGS_REGISTRY_MASK
    private fun getType(): Byte = buffer.get(0) and SYNC_PACKET_FLAGS_TYPE_MASK
    private fun getBody(): ByteBuffer = buffer.duplicate().also { it.position(1) }.slice()

    fun process(from: String?): List<SyncPacket> {
        val responses = mutableListOf<SyncPacket>()
        val isGlobal = getRegistry() == SYNC_PACKET_FLAGS_REGISTRY_GLOBAL
        val reg = if (isGlobal) MessageRegistries.global else MessageRegistries.local
        val body = getBody()

        when (getType()) {
            SYNC_PACKET_FLAGS_TYPE_MESSAGE -> {
                val bytes = ByteArray(body.remaining()); body.get(bytes)
                MessageRegistries.processMessage(RawMessage.fromBytes(bytes), from)
            }

            SYNC_PACKET_FLAGS_TYPE_START -> {
                Log.i(TAG, "📥 [TYPE_START] from $from")
                val mask = ByteArray(16)
                val dirtyGroups = mutableListOf<Int>()
                for (i in 0 until 128) {
                    val r1 = body.get(); val r2 = body.get()
                    if (reg.optimisationLevel[i][0] != r1 || reg.optimisationLevel[i][1] != r2) {
                        mask[i / 8] = mask[i / 8] or (1 shl (i % 8)).toByte()
                        dirtyGroups.add(i)
                    }
                }
                if (dirtyGroups.isNotEmpty()) responses.add(packSyncDiffWithFine(isGlobal, mask, dirtyGroups))
            }

            SYNC_PACKET_FLAGS_TYPE_DIFF -> {
                Log.i(TAG, "📥 [TYPE_DIFF+FINE] from $from. Analyzing buckets...")
                val mask = ByteArray(16); body.get(mask)
                val bucketsToRequestFromB = mutableListOf<Int>()

                for (i in 0 until 128) {
                    if ((mask[i / 8].toInt() and (1 shl (i % 8))) != 0) {
                        for (j in 0 until 8) {
                            val bIdx = i * 8 + j
                            val r1 = body.get(); val r2 = body.get()
                            if (reg.buckets[bIdx].hash[0] != r1 || reg.buckets[bIdx].hash[1] != r2) {
                                reg.buckets[bIdx].messages.forEach { responses.add(packMessage(it.msg)) }
                                bucketsToRequestFromB.add(bIdx)
                            }
                        }
                    }
                }
                if (bucketsToRequestFromB.isNotEmpty()) responses.add(packSyncFineRequest(isGlobal, bucketsToRequestFromB))
            }

            SYNC_PACKET_FLAGS_TYPE_FINE -> {
                Log.i(TAG, "📥 [TYPE_FINE_REQ] from $from. Sending requested buckets.")
                while (body.remaining() >= 2) {
                    val bIdx = body.getShort().toInt() and 0xFFFF
                    if (bIdx < BUCKET_COUNT) {
                        reg.buckets[bIdx].messages.forEach { responses.add(packMessage(it.msg)) }
                    }
                }
            }
        }
        return responses
    }
}