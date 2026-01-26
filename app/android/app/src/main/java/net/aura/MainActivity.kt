package net.aura

import net.aura.service.*
import net.aura.proto.*

import android.content.Intent
import android.content.IntentSender
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import android.os.Bundle
import com.google.android.gms.common.api.ResolvableApiException
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.LocationSettingsRequest
import com.google.android.gms.location.SettingsClient

class MainActivity : ReactActivity() {
    override fun getMainComponentName(): String = "aura"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(null)

        Registry.ensureKeypair(this)

        Db.getInstance(this).writableDatabase

        checkLocationSettings()

        startService()
    }

    fun checkLocationSettings() {

        val locationRequest = LocationRequest.create().apply {

            priority = LocationRequest.PRIORITY_LOW_POWER

        }


        val builder = LocationSettingsRequest.Builder().addLocationRequest(locationRequest)

        val client: SettingsClient = LocationServices.getSettingsClient(this)

        val task = client.checkLocationSettings(builder.build())


        task.addOnFailureListener { exception ->

            if (exception is ResolvableApiException) {

                try {

                    exception.startResolutionForResult(this, 123)

                } catch (sendEx: IntentSender.SendIntentException) {

                }

            }

        }

    }


    private fun startService() {
        val serviceIntent = Intent(this, Service::class.java)
        startForegroundService(serviceIntent)
    }
}