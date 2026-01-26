package net.aura.proto

import java.nio.ByteBuffer
import java.nio.ByteOrder
import android.util.Log
import org.bouncycastle.crypto.params.Ed25519PrivateKeyParameters
import org.bouncycastle.crypto.signers.Ed25519Signer
import org.bouncycastle.crypto.params.Ed25519PublicKeyParameters
import kotlin.experimental.or
import kotlin.math.min

object BroadcastMessage {
    fun expired(message: RawMessage, pow: Int): Boolean {
        val isGlobal = message.isGlobal()

        val threshold = if (isGlobal) {
            PowEngine.BROADCAST_GLOBAL_BITS
        } else {
            PowEngine.BROADCAST_LOCAL_BITS
        }

        val diff = (pow - threshold).coerceIn(0, 3)
        val mul = 1 shl diff

        val ttlMs = TTL_BASETIME_SEC * mul * 1000L
        val expirationTime = message.time() + ttlMs

        return expirationTime < System.currentTimeMillis()
    }
    fun verify(msg: RawMessage): Boolean {
        if (msg.type() != MSG_FLAGS_TYPE_BROADCAST) return false

        try {
            val pubKeyBytes =
                msg.fullData.sliceArray(MSG_BROADCAST_SENDERPUB_OFFSET until MSG_BROADCAST_SENDERPUB_OFFSET + MSG_BROADCAST_SENDERPUB_LENGTH)
            val sigOffset = msg.fullData.size + MSG_BROADCAST_SIGN_COUNTEROFFSET
            val signature =
                msg.fullData.sliceArray(sigOffset until sigOffset + MSG_BROADCAST_SIGN_LENGTH)

            val signer = Ed25519Signer()
            signer.init(false, Ed25519PublicKeyParameters(pubKeyBytes, 0))

            signer.update(msg.fullData, 0, sigOffset)

            return signer.verifySignature(signature)
        } catch (e: Exception) {
            Log.e("AURA_DEBUG", "Broadcast verify error: ${e.message}")
            return false
        }
    }

    fun unpack(msg: RawMessage): UnpackedBroadcastMessage? {
        if (!verify(msg)) return null

        val sigOffset = msg.fullData.size + MSG_BROADCAST_SIGN_COUNTEROFFSET
        val contentOffset = MSG_BROADCAST_CONTENT_OFFSET
        val contentLength = msg.fullData.size - MSG_BROADCAST_MIN_LENGTH

        val content = msg.fullData.sliceArray(contentOffset until sigOffset)

        val senderPub =
            msg.fullData.sliceArray(MSG_BROADCAST_SENDERPUB_OFFSET until MSG_BROADCAST_SENDERPUB_OFFSET + MSG_BROADCAST_SENDERPUB_LENGTH)
        return UnpackedBroadcastMessage(senderPub, msg.time(), content)
    }

    suspend fun pack(keypair: KeyPair, content: ByteArray, targetPow: Int, time: Long): RawMessage {
        val globalRegistry = targetPow >= PowEngine.BROADCAST_GLOBAL_BITS;

        val flags = (MSG_FLAGS_TYPE_BROADCAST or
                (if (globalRegistry) MSG_FLAGS_GLOBAL_REGISTRY_MASK else 0))

        val finalContent = content

        val time = packTime(time)
        val senderPub = keypair.publicKey

        val finalSize = MSG_BROADCAST_MIN_LENGTH + finalContent.size
        val buffer = ByteBuffer.allocate(finalSize).order(ByteOrder.BIG_ENDIAN)

        buffer.put(flags)
        buffer.put(time)
        buffer.put(senderPub)
        buffer.put(finalContent)

        //SIGN
        val signer = Ed25519Signer()
        signer.init(true, Ed25519PrivateKeyParameters(keypair.privateKey, 0))
        signer.update(buffer.array(), 0, buffer.position())
        val signature = signer.generateSignature()

        buffer.put(signature)

        // PoW
        val dataForPow = buffer.array().sliceArray(0 until buffer.position())
        val nonce = PowEngine.findNonceMultiThreaded(dataForPow, targetPow)
        buffer.putInt(nonce)

        return RawMessage.fromBytes(buffer.array())
    }
}

class UnpackedBroadcastMessage(
    val sender: ByteArray,
    val time: Long,
    val content: ByteArray,
)