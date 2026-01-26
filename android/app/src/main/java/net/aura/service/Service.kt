package net.aura.service

import android.annotation.SuppressLint
import android.app.*
import android.content.*
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import net.aura.proto.*
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.*
import kotlinx.coroutines.*
import kotlin.random.Random
import kotlin.random.nextUInt
import java.nio.ByteBuffer

import kotlin.time.*
import android.graphics.BitmapFactory
import android.os.SystemClock
import net.aura.R

const val ACTION_SEND_MESSAGE = "net.aura.SEND_MESSAGE"
const val ACTION_STOP_SERVICE = "net.aura.ACTION_STOP_SERVICE"

class Service : android.app.Service() {
    private val NOTIFICATION_ID = 1
    private val CHANNEL_ID = "aura_service_channel"

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private lateinit var engine: Engine

    private lateinit var messageDao: MessageDao


    @OptIn(ExperimentalTime::class)
    @SuppressLint("UnspecifiedRegisterReceiverFlag")
    override fun onCreate() {
        super.onCreate()
        engine = Engine(this)
        engine.onCreate()

        val dbHelper = Db.getInstance(applicationContext)
        messageDao = MessageDao(dbHelper)

        Registry.ensureKeypair(this)
        registerReceiver(messageReceiver, IntentFilter(ACTION_SEND_MESSAGE), Context.RECEIVER_NOT_EXPORTED)
        MessageRegistries.loadAll(this)
        createNotificationChannel()
        startSelfHealingLoop()

        val ctx = this

        MessageRegistries.onDecryptedDirectMessage.plusAssign {
            val msg = Message("", "0"+it.sender.toBase64(),it.content,true,it.time, Clock.System.now().toEpochMilliseconds(), false, "sent")
            msg.hashMessage()
            messageDao.insertMessage(msg)
            sendMessageEvent(msg)
            val notification = messageDao.checkNotification(msg.contact)
            if(notification.shouldNotify){
                showMessageNotification(ctx, msg.content.fromUtf8(), msg.contact, notification.senderName)
            }
        }
        MessageRegistries.onBroadcastMessage.plusAssign {
            val contactPubkey = "1"+it.sender.toBase64()
            if(messageDao.hasContact(contactPubkey)) {
                val msg = Message(
                    "",
                    contactPubkey,
                    it.content,
                    true,
                    it.time,
                    Clock.System.now().toEpochMilliseconds(),
                    false, "sent"
                )
                msg.hashMessage()
                messageDao.insertMessage(msg)
                sendMessageEvent(msg)
                val notification = messageDao.checkNotification(msg.contact)
                if (notification.shouldNotify) {
                    showMessageNotification(
                        ctx,
                        msg.content.fromUtf8(),
                        msg.contact,
                        notification.senderName
                    )
                }
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP_SERVICE) {
            engine.stop()
            return START_NOT_STICKY
        }
        startForegroundService()
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null
    override fun onDestroy() {
        MessageRegistries.saveAll(this)
        engine.stop()
        super.onDestroy()
    }


    private fun startSelfHealingLoop() {
        scope.launch {
            while (isActive) {
                try {
                    engine.heal()
                } catch (e: Exception) {
                    Log.e("AURA_DEBUG", "Healing failed: ${e.message}")
                }
                delay(15000)
            }
        }
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        val restartServiceIntent = Intent(applicationContext, this.javaClass).apply {
            setPackage(packageName)
        }
        val restartServicePendingIntent = PendingIntent.getService(
            this, 1, restartServiceIntent, PendingIntent.FLAG_IMMUTABLE
        )
        val alarmService = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmService.set(
            AlarmManager.ELAPSED_REALTIME,
            SystemClock.elapsedRealtime() + 1000,
            restartServicePendingIntent
        )
        super.onTaskRemoved(rootIntent)
    }

    private val messageReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == ACTION_SEND_MESSAGE) {
                val b64 = intent.getStringExtra("data") ?: return
                val bytes = android.util.Base64.decode(b64, android.util.Base64.DEFAULT)
                MessageRegistries.processMessage(RawMessage.fromBytes(bytes))
            }
        }
    }

    private fun startForegroundService() {
        val notification = buildNotification()
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE or
                            ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC or
                            ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION or ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun updateNotification() {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, buildNotification())
    }

    private fun buildNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("AURA Mesh Network")
            //.setContentText("Nodes: ${activeConnections.size}")
            .setSmallIcon(R.drawable.logo_notification)
            .setLargeIcon(BitmapFactory.decodeResource(resources, R.drawable.logo))
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "AURA Network", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Mesh Network Status"
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }
}