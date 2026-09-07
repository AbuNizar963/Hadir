package com.hadir.attendance.security

import android.location.Location
import androidx.core.location.LocationCompat

/**
 * Lightweight location-integrity checks used before attendance actions.
 * Android exposes a mock-location marker on Location objects; this is more
 * reliable than trying to enumerate installed "fake GPS" applications.
 */
object LocationIntegrityChecker {
    data class Result(
        val isMock: Boolean,
        val provider: String?,
        val accuracyMeters: Float?
    )

    fun inspect(location: Location): Result = Result(
        isMock = LocationCompat.isMock(location),
        provider = location.provider,
        accuracyMeters = location.accuracy.takeIf { it >= 0f }
    )
}
