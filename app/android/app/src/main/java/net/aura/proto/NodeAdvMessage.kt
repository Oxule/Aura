package net.aura.proto

import java.nio.ByteBuffer
import java.nio.ByteOrder
import android.util.Log
import org.bouncycastle.crypto.params.Ed25519PrivateKeyParameters
import org.bouncycastle.crypto.signers.Ed25519Signer
import org.bouncycastle.crypto.params.Ed25519PublicKeyParameters
import kotlin.experimental.and
import kotlin.experimental.or
import kotlin.math.min

object NodeAdvMessage {
    fun expired(message: RawMessage, pow: Int): Boolean {
        if(pow < PowEngine.NODE_ADV_BITS){
            return true
        }
        val ttlMs = 1000*60*60*8 //8 hours
        val expirationTime = message.time() + ttlMs

        return expirationTime < System.currentTimeMillis()
    }
    fun verify(msg: RawMessage): Boolean {
        if (msg.type() != MSG_FLAGS_TYPE_NODE_ADV) return false

        val ipv6 = (msg.flags() and MSG_FLAGS_IPV6_MASK) != 0.toByte()
        val detailsLength = msg.fullData.size - MSG_DETAILS_COUNTERLENGTH

        val expectedLength = if (ipv6) 16 + 2 else 4 + 2
        return detailsLength == expectedLength
    }

    fun unpack(msg: RawMessage): UnpackedNodeAdvMessage? {
        if (!verify(msg)) return null

        val body = msg.details()
        val ipv6 = (msg.flags() and MSG_FLAGS_IPV6_MASK) != 0.toByte()

        val ipSize = if (ipv6) 16 else 4
        val ip = ByteArray(ipSize)
        body.get(ip)
        val port = body.short.toUShort()

        return UnpackedNodeAdvMessage(ipv6, ip, port)
    }

    suspend fun pack(adv: UnpackedNodeAdvMessage, targetPow: Int): RawMessage {
        val timeMs = System.currentTimeMillis()
        val ipv6 = adv.ipv6
        val ipSize = if (ipv6) 16 else 4

        val finalSize = MSG_MIN_LENGTH + ipSize + 2
        val buffer = ByteBuffer.allocate(finalSize).order(ByteOrder.BIG_ENDIAN)

        var flags = MSG_FLAGS_TYPE_NODE_ADV
        if (ipv6) flags = flags or MSG_FLAGS_IPV6_MASK
        flags = flags or MSG_FLAGS_GLOBAL_REGISTRY_MASK

        buffer.put(flags)

        buffer.put(packTime(timeMs))

        buffer.put(adv.ip)
        buffer.putShort(adv.port.toShort())

        val dataForPow = buffer.array().sliceArray(0 until buffer.position())
        val nonce = PowEngine.findNonceMultiThreaded(dataForPow, targetPow)
        buffer.putInt(nonce)

        return RawMessage.fromBytes(buffer.array())
    }
}

class UnpackedNodeAdvMessage(
    val ipv6: Boolean,
    val ip: ByteArray,
    val port: UShort,
)