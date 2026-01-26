package net.aura.proto

import android.util.Log
import org.bouncycastle.crypto.engines.ChaCha7539Engine
import org.bouncycastle.crypto.params.KeyParameter
import org.bouncycastle.crypto.params.ParametersWithIV
import org.bouncycastle.crypto.macs.HMac
import org.bouncycastle.crypto.digests.SHA256Digest
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.experimental.and
import kotlin.experimental.or
import kotlin.math.min

object DirectMessage {
    fun expired(message: RawMessage, pow: Int): Boolean {
        val isGlobal = message.isGlobal()

        val threshold = if (isGlobal) {
            PowEngine.DIRECT_GLOBAL_BITS
        } else {
            PowEngine.DIRECT_LOCAL_BITS
        }

        val diff = (pow - threshold).coerceIn(0, 3)

        val mul = 1 shl diff

        val ttlMs = TTL_BASETIME_SEC * mul * 1000L
        val expirationTime = message.time() + ttlMs

        return expirationTime < System.currentTimeMillis()
    }

    fun filter(message: RawMessage): Byte {
        return message.fullData[MSG_DIRECT_FILTER_OFFSET]
    }

    fun unpack(msg: RawMessage, keypair: KeyPair): UnpackedDirectMessage? {
        try {
            val contentLength = msg.fullData.size - MSG_DIRECT_MIN_LENGTH

            val maskedSender =
                msg.fullData.sliceArray(MSG_DIRECT_SENDERPUB_OFFSET until MSG_DIRECT_FILTER_OFFSET)
            val senderPub = maskedSender xor keypair.publicKey

            val key = getSecretKey(
                keypair,
                senderPub,
                msg.fullData.sliceArray(MSG_TIME_OFFSET until MSG_DETAILS_OFFSET)
            )

            //INTEGRITY CHECK
            val digest = SHA256Digest()
            val hmac = HMac(digest)
            hmac.init(KeyParameter(key))
            val hmacData =
                msg.fullData.sliceArray(0 until msg.fullData.size + MSG_DIRECT_INTEGRITY_COUNTEROFFSET)
            hmac.update(hmacData, 0, hmacData.size)
            val hmacOut = ByteArray(hmac.macSize)
            hmac.doFinal(hmacOut, 0)
            val packedHmac =
                msg.fullData.sliceArray(msg.fullData.size + MSG_DIRECT_INTEGRITY_COUNTEROFFSET until msg.fullData.size + MSG_DIRECT_INTEGRITY_COUNTEROFFSET + MSG_DIRECT_INTEGRITY_LENGTH);
            val calculatedHmac = hmacOut.sliceArray(0 until 4)
            if (!packedHmac.contentEquals(calculatedHmac)) {
                throw Error("Integrity check failed! packed: ${packedHmac.toHex()} calculated: ${calculatedHmac.toHex()}")
            }

            //DECRYPTION
            val engine = ChaCha7539Engine()
            engine.init(false, ParametersWithIV(KeyParameter(key), ByteArray(12)))
            val keystream = ByteArray(contentLength)
            engine.processBytes(ByteArray(contentLength), 0, contentLength, keystream, 0)

            val ciphertext =
                msg.fullData.sliceArray(MSG_DIRECT_CONTENT_OFFSET until MSG_DIRECT_CONTENT_OFFSET + contentLength)
            val content = ciphertext xor keystream

            return UnpackedDirectMessage(senderPub, msg.time(), content)

        } catch (e: Exception) {
            Log.e("AURA_DEBUG", "Unpack error: ${e.message}")
            e.printStackTrace()
            return null
        }
    }

    suspend fun pack(
        keypair: KeyPair,
        receiverPub: ByteArray,
        content: ByteArray,
        targetPow: Int,
        time: Long
    ): RawMessage {
        val globalRegistry = targetPow >= PowEngine.DIRECT_GLOBAL_BITS;

        val flags = (MSG_FLAGS_TYPE_DIRECT or
                (if (globalRegistry) MSG_FLAGS_GLOBAL_REGISTRY_MASK else 0))

        val time = packTime(time)
        val senderPubMasked = keypair.publicKey xor receiverPub
        val filter = sha256(receiverPub)[0]

        val key = getSecretKey(keypair, receiverPub, time)

        //ENCRYPTION
        val engine = ChaCha7539Engine()
        engine.init(true, ParametersWithIV(KeyParameter(key), ByteArray(12)))
        val keystream = ByteArray(content.size)
        engine.processBytes(ByteArray(content.size), 0, content.size, keystream, 0)

        val ciphertext = content xor keystream

        //INTEGRITY HMAC
        val finalSize = MSG_DIRECT_MIN_LENGTH + content.size
        val buffer = ByteBuffer.allocate(finalSize).order(ByteOrder.BIG_ENDIAN)

        buffer.put(flags)
        buffer.put(time)
        buffer.put(senderPubMasked)
        buffer.put(filter)
        buffer.put(ciphertext)

        val digest = SHA256Digest()
        val hmac = HMac(digest)
        hmac.init(KeyParameter(key))

        hmac.update(buffer.array(), 0, buffer.position())

        val hmacOut = ByteArray(hmac.macSize)
        hmac.doFinal(hmacOut, 0)
        val calculatedHmac = hmacOut.sliceArray(0 until MSG_DIRECT_INTEGRITY_LENGTH)

        buffer.put(calculatedHmac)

        // PoW
        val dataForPow = buffer.array().sliceArray(0 until buffer.position())
        val nonce = PowEngine.findNonceMultiThreaded(dataForPow, targetPow)

        buffer.putInt(nonce)

        val finalArray = buffer.array()


        return RawMessage(finalArray)
    }
}

class UnpackedDirectMessage(
    val sender: ByteArray,
    val time: Long,
    val content: ByteArray
)