package net.aura.proto

import java.nio.ByteBuffer
import java.nio.ByteOrder
import android.util.Log

import kotlin.experimental.and

const val TTL_BASETIME_SEC = 60*60 //1 hour



fun packTime(unixMs: Long): ByteArray {
    val seconds = (unixMs / 1000).toInt()
    val msecsFraction = ((unixMs % 1000) / 4).toByte()

    return ByteBuffer.allocate(5).order(ByteOrder.BIG_ENDIAN).apply {
        putInt(seconds)
        put(msecsFraction)
    }.array()
}

fun unpackTime(bytes: ByteArray, offset: Int): Long {
    val seconds = (
            ((bytes[offset].toLong() and 0xFF) shl 24) or
                    ((bytes[offset + 1].toLong() and 0xFF) shl 16) or
                    ((bytes[offset + 2].toLong() and 0xFF) shl 8) or
                    (bytes[offset + 3].toLong() and 0xFF)
            ) and 0xFFFFFFFFL

    val msecs = (bytes[offset + 4].toInt() and 0xFF) * 4

    return (seconds * 1000) + msecs
}


class RawMessage(
    val fullData: ByteArray
) {
    companion object {
        fun fromBytes(bytes: ByteArray): RawMessage {
            require(bytes.size > MSG_MIN_LENGTH) {"Message is too small: ${bytes.size} of ${MSG_MIN_LENGTH+1}"}
            val rawMessage = RawMessage(bytes)

            val t = rawMessage.type()
            when (t) {
                MSG_FLAGS_TYPE_DIRECT ->
                    require(bytes.size >= MSG_DIRECT_MIN_LENGTH) { "Direct message too small" }
                MSG_FLAGS_TYPE_BROADCAST ->
                    require(bytes.size >= MSG_BROADCAST_MIN_LENGTH) { "Broadcast message too small" }
                MSG_FLAGS_TYPE_NODE_ADV -> {
                    val ipv6 = (bytes[0] and MSG_FLAGS_IPV6_MASK) != 0.toByte()
                    val expected = MSG_DETAILS_COUNTERLENGTH + (if (ipv6) 16 else 4) + 2
                    require(bytes.size == expected) { "NodeAdv size mismatch" }
                }
                else -> throw IllegalArgumentException("Unknown message type: $t")
            }
            return rawMessage
        }
    }

    fun type(): Byte{
        return fullData[MSG_FLAGS_OFFSET] and MSG_FLAGS_TYPE_MASK
    }
    fun time(): Long{
        return unpackTime(fullData, MSG_TIME_OFFSET)
    }
    fun flags(): Byte = fullData[MSG_FLAGS_OFFSET]
    fun details(): ByteBuffer {
        return ByteBuffer.wrap(fullData).apply {
            order(ByteOrder.BIG_ENDIAN)
            position(MSG_DETAILS_OFFSET)
            limit(fullData.size + MSG_NONCE_COUNTEROFFSET)
        }.slice()
    }

    fun isGlobal(): Boolean{
        val isGlobal = (this.fullData[0].toInt() and MSG_FLAGS_GLOBAL_REGISTRY_MASK.toInt()) != 0
        return isGlobal
    }
    fun hash(): ByteArray {
        return sha256(fullData)
    }

    fun pow(): Int {
        return PowEngine.countDifficulty(PowEngine.alg(fullData))
    }

    fun isValid(pow: Int): Boolean{
        Log.d("AURA_DEBUG", "Message type: ${type()}")

        if(time() > System.currentTimeMillis() + 500){
            return false;
        }

        if(type() == MSG_FLAGS_TYPE_DIRECT){
            val exp = DirectMessage.expired(this, pow);
            if(exp){
                Log.w("AURA_DEBUG", "Direct message expired (${pow} bits)")
                return false
            }
            return true
        }
        else if(type() == MSG_FLAGS_TYPE_BROADCAST){
            val exp = BroadcastMessage.expired(this,pow)
            if(exp){
                Log.w("AURA_DEBUG", "Broadcast message expired (${pow} bits)")
                return false
            }
            val ver = BroadcastMessage.verify(this)
            if(!ver){
                Log.w("AURA_DEBUG", "Failed to verify broadcast message sign");
                return false
            }
            return true
        }
        else if (type() == MSG_FLAGS_TYPE_NODE_ADV){

        }
        return false
    }
}