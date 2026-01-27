package net.aura.service


import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

import com.facebook.react.bridge.*

import com.facebook.react.modules.core.DeviceEventManagerModule

import net.aura.proto.*

import android.content.Intent


class Module(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String {
    return "Aura"
  }
    @ReactMethod
    fun generateKeypair(promise: Promise) {
        try {
            val keypair = Registry.ensureKeypair(reactApplicationContext, true)

            val response = Arguments.createMap().apply {
                putString("publicKey", android.util.Base64.encodeToString(keypair.publicKey, android.util.Base64.NO_WRAP))
            }

            promise.resolve(response)
        } catch (e: Exception) {
            promise.reject("DB_ERROR", "Failed to generate client: ${e.message}")
        }
    }

    @ReactMethod
    fun getKeypair(promise: Promise) {
        try {
            val keypair = Registry.ensureKeypair(reactApplicationContext)

            val response = Arguments.createMap().apply {
                putString("publicKey", android.util.Base64.encodeToString(keypair.publicKey, android.util.Base64.NO_WRAP))
            }

            promise.resolve(response)
        } catch (e: Exception) {
            promise.reject("DB_ERROR", "Failed to get client: ${e.message}")
        }
    }

    @ReactMethod
    fun generateChannelKeypair(promise: Promise) {
        try {
            val keypair = generateEd25519Keys()

            val response = Arguments.createMap().apply {
                putString("publicKey", android.util.Base64.encodeToString(keypair.publicKey, android.util.Base64.NO_WRAP))
                putString("privateKey", android.util.Base64.encodeToString(keypair.privateKey, android.util.Base64.NO_WRAP))
            }

            promise.resolve(response)
        } catch (e: Exception) {
            promise.reject("DB_ERROR", "Failed to generate channel: ${e.message}")
        }
    }

    @ReactMethod
    fun sendChannelMessage(
        payload: String,
        bits: Int,
        privateKeyBase64: String,
        time: Double,
        promise: Promise
    ) {
        val privateKey = privateKeyBase64.fromBase64()
        val content = payload.fromBase64()

        try {
                CoroutineScope(Dispatchers.IO).launch {
                    //val content = payload.toByteArray(Charsets.UTF_8)
                    val publicKey = recoverEd25519Public(privateKey)
                    val keypair = KeyPair(publicKey, privateKey)

                    val rawMessage = BroadcastMessage.pack(keypair, content, bits, time.toLong())

                    val base64Result = rawMessage.fullData.toBase64()

                    val intent = Intent(ACTION_SEND_MESSAGE).apply {
                        putExtra("data", base64Result)
                        setPackage(reactApplicationContext.packageName)
                    }
                    reactApplicationContext.sendBroadcast(intent)

                    promise.resolve(true)
                }
        } catch (e: Exception) {
            promise.reject("SEND_MSG_ERROR", "Failed to pack message: ${e.message}")
        }
    }

    @ReactMethod
    fun sendMessage(
        payload: String,
        receiverPublicKeyBase64: String,
        bits: Int,
        time: Double,
        promise: Promise
    ) {
        val receiverPublicKey = receiverPublicKeyBase64.fromBase64()
        val content = payload.fromBase64()

        try {
            if(Registry.client != null) {
                CoroutineScope(Dispatchers.IO).launch {
                    //val content = payload.toByteArray(Charsets.UTF_8)
                    val keypair = Registry.client!!

                    val rawMessage = DirectMessage.pack(keypair, receiverPublicKey, content, bits, time.toLong())

                    val base64Result = rawMessage.fullData.toBase64()

                    val intent = Intent(ACTION_SEND_MESSAGE).apply {
                        putExtra("data", base64Result)
                        setPackage(reactApplicationContext.packageName)
                    }
                    reactApplicationContext.sendBroadcast(intent)
                    promise.resolve(true)
                }
            }
            else{
                promise.reject(
                    "SEND_MSG_ERROR",
                    "Failed to pack message: Keypair is not generated"
                )
                return
            }
        } catch (e: Exception) {
            promise.reject("SEND_MSG_ERROR", "Failed to pack message: ${e.message}")
        }
    }

    companion object {
        private var reactContext: ReactApplicationContext? = null

        fun sendEvent(eventName: String, params: WritableMap) {
            reactContext
                ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit(eventName, params)
        }
    }

    init {
        Module.reactContext = reactContext
    }
}

fun get_message_map(message: Message): WritableMap {
    return Arguments.createMap().apply {
        putString("hash", message.hash)

        putString("contact", message.contact)

        putString("content", message.content.toBase64())

        putDouble("sent_time", message.sentTime.toDouble())
        putDouble("arrive_time", message.arriveTime.toDouble())

        putBoolean("read", message.read)

        putBoolean("incoming", message.incoming)
    }
}

fun sendMessageEvent(message: Message){
    val params = get_message_map(message)

    Module.sendEvent("onMessage", params)
}