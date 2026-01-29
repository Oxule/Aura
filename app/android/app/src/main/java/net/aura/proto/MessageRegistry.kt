package net.aura.proto

import android.util.Log
import java.security.MessageDigest
import java.nio.ByteBuffer


const val BUCKET_COUNT = 1024

data class HashedMessage(val msg: RawMessage) {
    val hash: ByteArray by lazy { msg.hash() }
}

private fun emptyHash(): ByteArray {
    return byteArrayOf(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0)
}

class MessageRegistry {
    class Bucket{
        var messages: ArrayList<HashedMessage> = ArrayList()
        var hash: ByteArray = emptyHash()
        var isDirty: Boolean = false
    }
    val buckets = Array(BUCKET_COUNT) { Bucket() }

    private val messagesHashSet = HashSet<ByteArrayKey>()

    var optimisationLevel = Array(BUCKET_COUNT/8) {emptyHash()}
        private set

    var rootHash = emptyHash()
        private set

    fun has(hash: ByteArray): Boolean{
        return messagesHashSet.contains(ByteArrayKey(hash.sliceArray(0..8)))
    }

    fun addMessage(raw: RawMessage) {
        val hashed = HashedMessage(raw)

        val key = ByteArrayKey(hashed.hash.sliceArray(0..8))

        if(messagesHashSet.contains(key)){
            return
        }

        messagesHashSet.add(key)

        val bucketIdx = (hashed.hash.toPositiveLong() % BUCKET_COUNT).toInt()

        buckets[bucketIdx].messages.add(hashed)
        buckets[bucketIdx].isDirty = true
    }

    fun recalculate() {
        val digest = MessageDigest.getInstance("SHA-256")
        val affectedOptimisations = HashSet<Int>()

        for (i in 0 until BUCKET_COUNT) {
            val bucket = buckets[i]
            if (bucket.isDirty) {
                bucket.messages.sortBy { it.hash.toHex() }

                digest.reset()
                for (msg in bucket.messages) {
                    digest.update(msg.hash)
                }
                bucket.hash = digest.digest()

                val optIdx = i/8
                if(affectedOptimisations.contains(optIdx)){
                    continue;
                }

                affectedOptimisations.add(optIdx)
                bucket.isDirty = false
            }
        }

        if(affectedOptimisations.isEmpty()){
            return
        }

        for (opt in affectedOptimisations){
            digest.reset()
            for (bucket in 0..8) {
                digest.update(buckets[opt*8 + bucket].hash)
            }
            optimisationLevel[opt] = digest.digest()
        }

        digest.reset()

        for (opt in optimisationLevel){
            digest.update(opt)
        }

        rootHash = digest.digest()
    }

    fun clean() {
        for (b in buckets) {
            for (i in b.messages.size - 1 downTo 0) {
                val pow = b.messages[i].msg.pow()
                if (!b.messages[i].msg.isValid(pow)) {
                    b.messages.removeAt(i)
                    b.isDirty = true
                }
            }
        }
    }

    fun save(context: android.content.Context, fileName: String) {
        try {
            context.openFileOutput(fileName, android.content.Context.MODE_PRIVATE).use { fos ->
                for (bucket in buckets) {
                    for (hMsg in bucket.messages) {
                        val data = hMsg.msg.fullData
                        val sizeBuf = ByteBuffer.allocate(4).putInt(data.size).array()
                        fos.write(sizeBuf)
                        fos.write(data)
                    }
                }
            }
            Log.d("AURA_DEBUG", "Registry $fileName saved.")
        } catch (e: Exception) {
            Log.e("AURA_DEBUG", "Failed to save registry: ${e.message}")
        }
    }
    fun load(context: android.content.Context, fileName: String) {
        val file = context.getFileStreamPath(fileName)
        if (!file.exists()) return

        try {
            context.openFileInput(fileName).use { fis ->
                val sizeBytes = ByteArray(4)
                while (fis.read(sizeBytes) != -1) {
                    val size = ByteBuffer.wrap(sizeBytes).int
                    val msgBytes = ByteArray(size)
                    fis.read(msgBytes)

                    this.addMessage(RawMessage(msgBytes))
                }
            }
            clean()
            recalculate()
            Log.d("AURA_DEBUG", "Registry $fileName loaded. Root: ${rootHash.toHex()}")
        } catch (e: Exception) {
            Log.e("AURA_DEBUG", "Failed to load registry: ${e.message}")
        }
    }
}

private fun ByteArray.toPositiveLong(): Long {
    if (this.size < 8) return 0
    return ((this[0].toLong() and 0xff shl 56) or
            (this[1].toLong() and 0xff shl 48) or
            (this[2].toLong() and 0xff shl 40) or
            (this[3].toLong() and 0xff shl 32) or
            (this[4].toLong() and 0xff shl 24) or
            (this[5].toLong() and 0xff shl 16) or
            (this[6].toLong() and 0xff shl 8) or
            (this[7].toLong() and 0xff)) and Long.MAX_VALUE
}

data class RawMessageEvent(val msg: RawMessage, val global: Boolean, val from: String?)

object MessageRegistries {
    val local: MessageRegistry = MessageRegistry()
    val global: MessageRegistry = MessageRegistry()

    private const val LOCAL_FILE = "registry_local.bin"
    private const val GLOBAL_FILE = "registry_global.bin"

    fun saveAll(context: android.content.Context) {
        local.save(context, LOCAL_FILE)
        global.save(context, GLOBAL_FILE)
    }

    fun loadAll(context: android.content.Context) {
        local.load(context, LOCAL_FILE)
        global.load(context, GLOBAL_FILE)
    }

    val onMessage: Event<RawMessageEvent> = Event()
    val onDecryptedDirectMessage: Event<UnpackedDirectMessage> = Event()
    val onBroadcastMessage: Event<UnpackedBroadcastMessage> = Event()

    fun processMessage(msg: RawMessage, from: String? = null){
        try{
            Log.i("AURA_DEBUG", "Got new message: ${msg.fullData.toHex()}")
            if(local.has(msg.hash()) || global.has(msg.hash())) {
                Log.w("AURA_DEBUG", "Message exists")
                return
            }

            val pow = msg.pow()

            if(!msg.isValid(pow)){
                Log.w("AURA_DEBUG", "Message is invalid")
                return
            }

            Log.i("AURA_DEBUG", "Message is valid")

            var g = false
            val type = msg.type()
            if(type == MSG_FLAGS_TYPE_DIRECT){
                if(Registry.client != null){
                    if(sha256(Registry.client!!.publicKey)[0] == DirectMessage.filter(msg)){
                        val unpacked = DirectMessage.unpack(msg,Registry.client!!)
                        if(unpacked != null){
                            Log.i("AURA_DEBUG", "This is message for me!!")
                            onDecryptedDirectMessage.invoke(unpacked)
                        }
                    }
                }
            }
            else if(type == MSG_FLAGS_TYPE_BROADCAST){
                val unpacked = BroadcastMessage.unpack(msg)
                if(unpacked != null) {
                    Log.i("AURA_DEBUG", "Got broadcast message!")
                    onBroadcastMessage.invoke(unpacked)
                }
            }


            Log.i("AURA_DEBUG", "Adding to registry")

            if(msg.isGlobal()){
                global.addMessage(msg)
                global.recalculate()
            }
            else{
                local.addMessage(msg)
                local.recalculate()
            }

            onMessage.invoke(RawMessageEvent(msg,g, from))
        }
        catch (e: Error){
            Log.e("AURA_DEBUG", "Processing message error: $e")
        }
    }
}