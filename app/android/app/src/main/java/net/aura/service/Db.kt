package net.aura.service

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

import android.content.ContentValues
import android.util.Base64
import android.util.Log
import net.aura.proto.UnpackedDirectMessage
import net.aura.proto.sha256
import net.aura.proto.toBase64
import net.aura.proto.toUtf8

class Db(context: Context) : SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    companion object {
        private const val DATABASE_NAME = "aura.db"
        private const val DATABASE_VERSION = 1

        @Volatile
        private var instance: Db? = null

        fun getInstance(context: Context): Db =
            instance ?: synchronized(this) {
                instance ?: Db(context.applicationContext).also { instance = it }
            }
    }

    override fun onConfigure(db: SQLiteDatabase) {
        super.onConfigure(db)
        //db.enableWriteAheadLogging()
        db.disableWriteAheadLogging()

        db.setForeignKeyConstraintsEnabled(true)
    }

    override fun onCreate(db: SQLiteDatabase) {
        ensureTables(db)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
    }

    fun ensureTables(db: SQLiteDatabase = writableDatabase) {
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS contacts (
                pubkey TEXT PRIMARY KEY,
                name TEXT DEFAULT "Unknown",
                is_blocked INTEGER DEFAULT 0,
                is_muted INTEGER DEFAULT 0,
                is_pinned INTEGER DEFAULT 0,
                pow INTEGER DEFAULT 8
            )
        """)

        db.execSQL("""
            CREATE TABLE IF NOT EXISTS messages (
                hash TEXT PRIMARY KEY,
                contact TEXT,
                content BLOB,
                sent_time INTEGER,
                arrive_time INTEGER,
                read INTEGER DEFAULT 0,
                incoming INTEGER DEFAULT 1,
                status TEXT DEFAULT "sent"
            )
        """)

        db.execSQL("CREATE INDEX IF NOT EXISTS idx_messages_sender_time ON messages (contact, sent_time)")

        db.execSQL("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)")

        val defaultSettings = mapOf(
            "lang" to "en",
            "notify_unknown" to "1"
        )

        for ((key, value) in defaultSettings) {
            db.execSQL(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
                arrayOf(key, value)
            )
        }
    }
}

class MessageDao(private val dbHelper: Db) {
    data class NotificationCheck(
        val shouldNotify: Boolean,
        val senderName: String,
    )

    fun checkNotification(senderPubkey: String): NotificationCheck {
        val db = dbHelper.readableDatabase
        val sql = "SELECT name, is_blocked, is_muted FROM contacts WHERE pubkey = ?"

        db.rawQuery(sql, arrayOf(senderPubkey)).use { cursor ->
            if (cursor.moveToFirst()) {
                val isBlocked = cursor.getInt(cursor.getColumnIndexOrThrow("is_blocked")) == 1
                if (isBlocked) return NotificationCheck(false, "")

                val isMuted = cursor.getInt(cursor.getColumnIndexOrThrow("is_muted")) == 1
                if (isMuted) return NotificationCheck(false, "")

                val name = cursor.getString(cursor.getColumnIndexOrThrow("name")) ?: senderPubkey

                return NotificationCheck(true, name)
            }
        }
        val notifyUnknown = getSetting("notify_unknown")
        if(notifyUnknown == null || notifyUnknown == "1") {
            return NotificationCheck(true, "Unknown (${senderPubkey.take(4)}...${senderPubkey.takeLast(4)})")
        }
        return NotificationCheck(false, "")
    }

    fun insertMessage(msg: Message) {
        val db = dbHelper.writableDatabase

        val values = ContentValues().apply {
            put("hash", msg.hash)
            put("contact", msg.contact)
            put("content", msg.content)
            put("sent_time", msg.sentTime)
            put("arrive_time", msg.arriveTime)
            put("incoming", if (msg.incoming) 1 else 0)
            put("read", if (msg.read) 1 else 0)
            put("status", msg.status)
        }
        db.insertWithOnConflict("messages", null, values, SQLiteDatabase.CONFLICT_IGNORE)
    }

    fun hasContact(pubkey: String): Boolean{
        val db = dbHelper.readableDatabase
        db.rawQuery("SELECT 1 FROM contacts WHERE pubkey = ? LIMIT 1", arrayOf(pubkey)).use { cursor ->
            if (cursor.moveToFirst()) {
                return true
            }
        }
        return false
    }

    fun getSetting(key: String): String? {
        val db = dbHelper.readableDatabase
        db.rawQuery("SELECT value FROM settings WHERE key = ?", arrayOf(key)).use { cursor ->
            if (cursor.moveToFirst()) {
                return cursor.getString(0)
            }
        }
        return null
    }
}

data class Message(
    var hash: String,
    val contact: String,
    val content: ByteArray,
    val incoming: Boolean,
    val sentTime: Long,
    val arriveTime: Long,
    val read: Boolean,
    val status: String
){
    fun hashMessage(){
        val seconds = (sentTime / 1000)
        val msecs = (sentTime % 1000) / 4 * 4
        val normalized = (seconds * 1000) + msecs

        val input = contact + content.toBase64() + normalized.toString()
        hash = sha256(input.toUtf8()).toBase64()
        Log.i("AURA_DEBUG", "Message hash: ${hash}. Input: ${input}")
    }
}