package com.hadir.attendance.ui

import android.app.Application
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewModelScope
import com.hadir.attendance.data.AttendanceRecord
import com.hadir.attendance.data.HadirRepository
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

data class NativeAttendanceAnalyticsState(
    val records: List<AttendanceRecord> = emptyList(),
    val workStartTime: String? = null,
    val workEndTime: String? = null,
    val gracePeriodMinutes: Int = 0,
    val loading: Boolean = false,
    val error: String? = null
)

class NativeAttendanceAnalyticsViewModel(application: Application) : AndroidViewModel(application) {
    private val repo = HadirRepository(application)
    var state by mutableStateOf(NativeAttendanceAnalyticsState())
        private set

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            state = state.copy(loading = true, error = null)
            try {
                val records = repo.attendance()
                val me = repo.me()
                state = state.copy(
                    records = records,
                    workStartTime = me["workStartTime"]?.toString(),
                    workEndTime = me["workEndTime"]?.toString(),
                    gracePeriodMinutes = (me["gracePeriodMinutes"] as? Number)?.toInt() ?: me["gracePeriodMinutes"]?.toString()?.toIntOrNull() ?: 0,
                    loading = false
                )
            } catch (e: Exception) {
                state = state.copy(loading = false, error = e.message ?: "تعذر تحميل تحليلات الحضور")
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NativeAttendanceAnalytics(
    vm: NativeAttendanceAnalyticsViewModel = viewModel(),
    onBack: () -> Unit
) {
    val s = vm.state
    val summaries = remember(s.records, s.workStartTime, s.workEndTime, s.gracePeriodMinutes) {
        buildAttendanceDaySummaries(
            records = s.records,
            workStartTime = s.workStartTime,
            workEndTime = s.workEndTime,
            gracePeriodMinutes = s.gracePeriodMinutes
        )
    }
    val recent = remember(summaries) { summaries.take(30) }
    val period = remember(recent) { summarizeAttendancePeriod(recent) }
    val formatter = remember { DateTimeFormatter.ofPattern("EEEE، d MMMM", Locale("ar")) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("تحليلات الحضور", fontWeight = FontWeight.Black) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, null) } },
                actions = { IconButton(onClick = vm::refresh, enabled = !s.loading) { Icon(Icons.Default.CalendarMonth, null) } }
            )
        }
    ) { padding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Text("ملخص آخر 30 يومًا مسجلًا", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Black)
                Text("يتم احتساب التأخير والانصراف المبكر والعمل الإضافي من جدول دوامك الحقيقي.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            s.error?.let { message -> item { Text(message, color = MaterialTheme.colorScheme.error) } }
            item {
                ScheduleCard(s.workStartTime, s.workEndTime, s.gracePeriodMinutes)
            }
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    AnalyticsMetric("أيام مكتملة", period.completeDays.toString(), Modifier.weight(1f))
                    AnalyticsMetric("أيام مفتوحة", period.openDays.toString(), Modifier.weight(1f))
                }
            }
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    AnalyticsMetric("العمل", formatAttendanceMinutes(period.workedMinutes), Modifier.weight(1f))
                    AnalyticsMetric("الإضافي", formatAttendanceMinutes(period.overtimeMinutes), Modifier.weight(1f))
                }
            }
            item {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text("الالتزام", fontWeight = FontWeight.Bold)
                        Text("التأخير: ${formatAttendanceMinutes(period.lateMinutes)}", modifier = Modifier.padding(top = 8.dp))
                        Text("الانصراف المبكر: ${formatAttendanceMinutes(period.earlyLeaveMinutes)}")
                        if (period.scheduledMinutes > 0) Text("الدوام المجدول: ${formatAttendanceMinutes(period.scheduledMinutes)}")
                    }
                }
            }
            item { Text("التفاصيل اليومية", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge) }
            items(recent) { day ->
                AnalyticsDayCard(day, formatter)
            }
            if (recent.isEmpty() && !s.loading) item { Text("لا توجد سجلات حضور متاحة للتحليل.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
            if (s.loading) item { LinearProgressIndicator(Modifier.fillMaxWidth()) }
        }
    }
}

@Composable
private fun ScheduleCard(start: String?, end: String?, grace: Int) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Row { Icon(Icons.Default.Schedule, null); Spacer(Modifier.width(8.dp)); Text("جدول دوامك", fontWeight = FontWeight.Bold) }
            Text(
                if (!start.isNullOrBlank() && !end.isNullOrBlank()) "$start → $end" else "لم يتم تحديد وقت الدوام",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Black,
                modifier = Modifier.padding(top = 8.dp)
            )
            Text("سماح التأخير: $grace دقيقة", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun AnalyticsMetric(label: String, value: String, modifier: Modifier) {
    Card(modifier) {
        Column(Modifier.padding(14.dp)) {
            Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 5.dp))
        }
    }
}

@Composable
private fun AnalyticsDayCard(day: AttendanceDaySummary, formatter: DateTimeFormatter) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text(day.date.format(formatter), fontWeight = FontWeight.Bold)
                    Text(if (day.complete) "يوم مكتمل" else "سجل مفتوح", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Icon(Icons.Default.Timer, null, tint = if (day.overtimeMinutes > 0) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text("الحضور: ${day.checkIn?.let(::formatInstantTime) ?: "—"}")
            Text("الانصراف: ${day.checkOut?.let(::formatInstantTime) ?: "—"}")
            Text("العمل: ${formatAttendanceMinutes(day.workedMinutes)} · الإضافي: ${formatAttendanceMinutes(day.overtimeMinutes)}")
            if (day.lateMinutes > 0 || day.earlyLeaveMinutes > 0) {
                Text(
                    "التأخير: ${formatAttendanceMinutes(day.lateMinutes)} · الانصراف المبكر: ${formatAttendanceMinutes(day.earlyLeaveMinutes)}",
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }
    }
}

private fun formatInstantTime(value: java.time.Instant): String =
    value.atZone(java.time.ZoneId.systemDefault()).toLocalTime().toString().take(5)
