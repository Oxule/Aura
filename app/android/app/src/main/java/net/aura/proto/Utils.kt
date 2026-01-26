package net.aura.proto

import android.util.Base64
import androidx.collection.LruCache

import org.bouncycastle.crypto.digests.SHA256Digest
import org.bouncycastle.crypto.generators.HKDFBytesGenerator
import org.bouncycastle.crypto.params.HKDFParameters
import org.bouncycastle.crypto.params.X25519PrivateKeyParameters
import org.bouncycastle.crypto.params.Ed25519PrivateKeyParameters
import org.bouncycastle.crypto.params.X25519PublicKeyParameters
import java.nio.ByteBuffer
import java.security.MessageDigest
import java.security.SecureRandom
fun generateX25519Keys(): KeyPair {
    val secureRandom = SecureRandom()
    val privateKeyParams = X25519PrivateKeyParameters(secureRandom)
    val publicKeyParams = privateKeyParams.generatePublicKey()

    return KeyPair(publicKeyParams.encoded, privateKeyParams.encoded)
}

fun generateEd25519Keys(): KeyPair {
    val secureRandom = SecureRandom()
    val privateKeyParams = Ed25519PrivateKeyParameters(secureRandom)
    val publicKeyParams = privateKeyParams.generatePublicKey()

    return KeyPair(publicKeyParams.encoded, privateKeyParams.encoded)
}

fun recoverEd25519Public(private: ByteArray): ByteArray {
    val privateKeyParams = Ed25519PrivateKeyParameters(private, 0)

    val publicKeyParams = privateKeyParams.generatePublicKey()

    return publicKeyParams.encoded
}


data class ByteArrayKey(val bytes: ByteArray) {
    override fun equals(other: Any?): Boolean =
        (other as? ByteArrayKey)?.bytes?.contentEquals(bytes) ?: false
    override fun hashCode(): Int = bytes.contentHashCode()
}

fun getSecretKey(keypair: KeyPair, foreignPublic: ByteArray, salt: ByteArray): ByteArray{
    val sharedSecret = ByteArray(32)
    X25519PrivateKeyParameters(keypair.privateKey, 0).generateSecret(X25519PublicKeyParameters(foreignPublic, 0), sharedSecret, 0)

    val info = "AURA".toByteArray() + salt
    val hkdf = HKDFBytesGenerator(SHA256Digest())
    hkdf.init(HKDFParameters(sharedSecret, null, info))
    val key = ByteArray(32)
    hkdf.generateBytes(key, 0, 32)

    return key
}


private val shaCache = LruCache<ByteArrayKey, ByteArray>(1000)
private val digest: MessageDigest = MessageDigest.getInstance("SHA-256")
fun sha256(data: ByteArray): ByteArray {
    val key = ByteArrayKey(data)

    shaCache.get(key)?.let { return it }

    val result = digest.digest(data)

    shaCache.put(key, result)
    return result
}

data class KeyPair(val publicKey: ByteArray, val privateKey: ByteArray){
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as KeyPair

        if (!publicKey.contentEquals(other.publicKey)) return false
        if (!privateKey.contentEquals(other.privateKey)) return false

        return true
    }

    override fun hashCode(): Int {
        var result = publicKey.contentHashCode()
        result = 31 * result + privateKey.contentHashCode()
        return result
    }
}


class Event<T> {
    private val observers = mutableSetOf<(T) -> Unit>()

    operator fun plusAssign(observer: (T) -> Unit) {
        observers.add(observer)
    }

    operator fun minusAssign(observer: (T) -> Unit) {
        observers.remove(observer)
    }

    operator fun invoke(value: T) {
        for (observer in observers)
            observer(value)
    }
}

infix fun ByteArray.xor(other: ByteArray): ByteArray {
    require(this.size == other.size) { "Arrays must have the same size" }
    return ByteArray(this.size) { i ->
        (this[i].toInt() xor other[i].toInt()).toByte()
    }
}

fun ByteArray.toBase64() = Base64.encodeToString(this, Base64.NO_WRAP)
fun String.fromBase64() = Base64.decode(this, Base64.NO_WRAP)

fun String.toUtf8(): ByteArray = this.toByteArray(Charsets.UTF_8)
fun ByteArray.fromUtf8(): String = String(this, Charsets.UTF_8)

fun ByteArray.toHex() = joinToString("") { "%02x".format(it) }
fun String.fromHex() = chunked(2).map { it.toInt(16).toByte() }.toByteArray()