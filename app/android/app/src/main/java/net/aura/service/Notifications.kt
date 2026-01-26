package net.aura.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.os.Build
import androidx.core.app.NotificationCompat
import net.aura.R

fun showMessageNotification(context: Context, message: String, contact: String, contactName: String) {
    val channelId = "messages_channel"
    val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val channel = NotificationChannel(
            channelId,
            "Messages",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Notifications for new messages"
        }
        notificationManager.createNotificationChannel(channel)
    }

    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
        flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        putExtra("contact", contact)
    }

    val pendingIntent = PendingIntent.getActivity(
        context,
        contact.hashCode(),
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val builder = NotificationCompat.Builder(context, channelId)
        .setSmallIcon(R.drawable.logo_notification)
        .setLargeIcon(BitmapFactory.decodeResource(context.resources, R.drawable.logo))
        .setContentTitle(contactName + " (" + contact.take(4)+"..."+contact.takeLast(4) + ")")
        .setContentText(message)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setAutoCancel(true)
        .setContentIntent(pendingIntent)

    notificationManager.notify(contact.hashCode(), builder.build())
}