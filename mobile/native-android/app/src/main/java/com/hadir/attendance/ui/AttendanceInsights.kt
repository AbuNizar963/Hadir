package com.hadir.attendance.ui

import com.hadir.attendance.data.AttendanceRecord
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

/** Pure attendance calculations used by the native employee experience. */
data class AttendanceDaySummary(
    val date: LocalDate,
    val checkIn: Instant?,
    val checkOut: Instant?,
    val workedMinutes: Long,
    val lateMinutes: Long,
    val earlyLeaveMinutes: Long,
    val complete: Boolean
)

data class AttendancePeriodSummary(
    val days: Int,
    val completeDays: Int,
    val openDays: Int,
    val workedMinutes: Long,
    val lateMinutes: Long,
    val earlyLeaveMinutes: Long
)

fun summarizeAttendanceDay(
    date: LocalDate,
    records: List<AttendanceRecord>,
    workStartTime: String? = null,
    workEndTime: String? = null,
    gracePeriodMinutes: Int = 0,
    zoneId: ZoneId = ZoneId.systemDefault()
): AttendanceDaySummary {
    val dayRecords = records.filter { parseInstant(it.timestamp)?.atZone(zoneId)?.toLocalDate() == date }
    val checkIn = dayRecords.filter { isCheckIn(it.type) }.mapNotNull { parseInstant(it.timestamp) }.minOrNull()
    val checkOut = dayRecords.filter { isCheckOut(it.type) }.mapNotNull { parseInstant(it.timestamp) }.maxOrNull()?.takeIf { out -> checkIn != null && out.isAfter(checkIn) }
    val workedMinutes = if (checkIn != null && checkOut != null) Duration.between(checkIn, checkOut).toMinutes().coerceAtLeast(0) else 0
    val start = parseLocalTime(workStartTime)
    val end = parseLocalTime(workEndTime)
    val lateMinutes = if (checkIn != null && start != null) {
        val scheduled = date.atTime(start).atZone(zoneId).toInstant().plusSeconds(gracePeriodMinutes.coerceAtLeast(0) * 60L)
        Duration.between(scheduled, checkIn).toMinutes().coerceAtLeast(0)
    } else 0
    val earlyLeaveMinutes = if (checkOut != null && end != null) {
        val scheduled = date.atTime(end).atZone(zoneId).toInstant()
        Duration.between(checkOut, scheduled).toMinutes().coerceAtLeast(0)
    } else 0
    return AttendanceDaySummary(date, checkIn, checkOut, workedMinutes, lateMinutes, earlyLeaveMinutes, checkIn != null && checkOut != null)
}

fun summarizeAttendancePeriod(days: List<AttendanceDaySummary>): AttendancePeriodSummary = AttendancePeriodSummary(
    days = days.size,
    completeDays = days.count { it.complete },
    openDays = days.count { !it.complete },
    workedMinutes = days.sumOf { it.workedMinutes },
    lateMinutes = days.sumOf { it.lateMinutes },
    earlyLeaveMinutes = days.sumOf { it.earlyLeaveMinutes }
)

fun buildAttendanceDaySummaries(
    records: List<AttendanceRecord>,
    workStartTime: String? = null,
    workEndTime: String? = null,
    gracePeriodMinutes: Int = 0,
    zoneId: ZoneId = ZoneId.systemDefault()
): List<AttendanceDaySummary> {
    val dates = records.mapNotNull { parseInstant(it.timestamp)?.atZone(zoneId)?.toLocalDate() }.distinct().sortedDescending()
    return dates.map { summarizeAttendanceDay(it, records, workStartTime, workEndTime, gracePeriodMinutes, zoneId) }
}

private fun isCheckIn(type: String): Boolean = type.equals("check-in", true) || type.equals("in", true)
private fun isCheckOut(type: String): Boolean = type.equals("check-out", true) || type.equals("out", true)

private fun parseLocalTime(value: String?): LocalTime? {
    if (value.isNullOrBlank()) return null
    return runCatching { LocalTime.parse(value.take(5), DateTimeFormatter.ofPattern("HH:mm")) }.getOrNull()
}

private fun parseInstant(value: String): Instant? {
    if (value.isBlank()) return null
    return try {
        Instant.parse(value)
    } catch (_: DateTimeParseException) {
        try {
            OffsetDateTime.parse(value).toInstant()
        } catch (_: DateTimeParseException) {
            try {
                LocalDateTime.parse(value).atZone(ZoneId.systemDefault()).toInstant()
            } catch (_: DateTimeParseException) {
                null
            }
        }
    }
}
