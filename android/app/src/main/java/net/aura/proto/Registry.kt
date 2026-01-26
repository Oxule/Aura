package net.aura.proto

import android.content.Context
import net.aura.service.*
import kotlinx.coroutines.*
import java.util.Stack
import java.util.concurrent.ConcurrentHashMap

import android.util.Base64

object Registry {
    var client: KeyPair? = null
        private set

    private const val PREFS_NAME = "blet_registry"
    private const val KEY_PUB = "client_pub"
    private const val KEY_PRIV = "client_priv"

    fun ensureKeypair(context: Context, regenerate: Boolean = false): KeyPair {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        if (!regenerate && client != null) {
            return client!!
        }

        if (!regenerate) {
            val pubBase64 = prefs.getString(KEY_PUB, null)
            val privBase64 = prefs.getString(KEY_PRIV, null)

            if (pubBase64 != null && privBase64 != null) {
                try {
                    val pub = Base64.decode(pubBase64, Base64.NO_WRAP)
                    val priv = Base64.decode(privBase64, Base64.NO_WRAP)
                    client = KeyPair(pub, priv)
                    return client!!
                } catch (e: Exception) {

                }
            }
        }

        val newKeys = generateX25519Keys()
        client = newKeys

        prefs.edit().apply {
            putString(KEY_PUB, Base64.encodeToString(newKeys.publicKey, Base64.NO_WRAP))
            putString(KEY_PRIV, Base64.encodeToString(newKeys.privateKey, Base64.NO_WRAP))
            apply()
        }

        return client!!
    }
}