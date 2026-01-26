package net.aura.proto

import java.nio.ByteBuffer
import kotlinx.coroutines.*
import java.util.concurrent.atomic.AtomicInteger

import org.signal.argon2.Argon2
import org.signal.argon2.Type
import org.signal.argon2.Version

import android.util.Log


object PowEngine {

    fun checkDifficulty(hash: ByteArray, targetBits: Int): Boolean {
        var bitsFound = 0
        for (byte in hash) {
            val leadingZeros = Integer.numberOfLeadingZeros(byte.toInt() and 0xff) - 24
            bitsFound += leadingZeros
            if (leadingZeros < 8) break
        }
        return bitsFound >= targetBits
    }

    fun countDifficulty(hash: ByteArray): Int{
        var bitsFound = 0
        for (byte in hash) {
            val leadingZeros = Integer.numberOfLeadingZeros(byte.toInt() and 0xff) - 24
            bitsFound += leadingZeros
            if (leadingZeros < 8) break
        }
        return bitsFound
    }

    const val DIRECT_LOCAL_BITS = 8 //Local registry minimal (~2500ms at 32 threads)
    const val DIRECT_GLOBAL_BITS = 12 //Global registry minimal (~33000ms at 32 threads)

    const val BROADCAST_LOCAL_BITS = 10
    const val BROADCAST_GLOBAL_BITS = 14



    private val argon2 = Argon2.Builder(Version.V13)
        .iterations(2)
        .memoryCostKiB(8192)
        .parallelism(1)
        .type(Type.Argon2id)
        .build()

    private fun argon_alg(data: ByteArray): ByteArray {
        val salt = byteArrayOf(0x42, 0x4c, 0x45, 0x54, 0x5f, 0x50, 0x4f, 0x57)

        return argon2.hash(data, salt).hash
    }

    private fun sha_alg(data: ByteArray): ByteArray{
        return sha256(data)
    }

    val alg = this::argon_alg

    suspend fun findNonceMultiThreaded(
        data: ByteArray,
        targetBits: Int,
        numThreads: Int = Runtime.getRuntime().availableProcessors() * 4
    ): Int = coroutineScope {
        val foundNonce = AtomicInteger(-1)

        val foundBits = AtomicInteger(0)

        val traceId = alg(data).joinToString("") { "%02x".format(it) }.take(8)
        val startTime = System.currentTimeMillis()

        Log.i("AURA_DEBUG", "[$traceId] [PoWEngine] Starting mining. Threads: $numThreads, Target: $targetBits bits.")

        val jobs = List(numThreads) { threadIdx ->
            launch(Dispatchers.Default) {
                var localNonce = threadIdx
                val buffer = ByteBuffer.allocate(data.size + 4)
                buffer.put(data)

                while (foundNonce.get() == -1 && isActive) {
                    buffer.putInt(data.size, localNonce)
                    val hash = alg(buffer.array())

                    val bits = countDifficulty(hash)

                    if (bits >= targetBits) {
                        if (foundNonce.compareAndSet(-1, localNonce)) {
                            foundBits.set(bits)
                            break
                        }
                    }
                    localNonce += numThreads
                    if (localNonce % 100 == 0) yield()
                }
            }
        }

        jobs.joinAll()

        val duration = System.currentTimeMillis() - startTime
        val finalNonce = foundNonce.get()

        Log.i("AURA_DEBUG", "[$traceId] [PoWEngine] Completed. Found $foundBits bits. Nonce: $finalNonce, Time: ${duration}ms")

        return@coroutineScope finalNonce
    }
}