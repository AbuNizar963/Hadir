package com.hadir.attendance.ui

import android.Manifest
import android.app.Application
import android.content.pm.PackageManager
import android.location.Location
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import com.hadir.attendance.data.AppNotification
import com.hadir.attendance.data.HadirRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.coroutines.resume

data class WeatherState(val temperature: Double, val feelsLike: Double, val wind: Double, val code: Int)
data class PrayerState(val fajr: String, val sunrise: String, val dhuhr: String, val asr: String, val maghrib: String, val isha: String, val hijri: String)

class NativeServicesViewModel(application: Application) : AndroidViewModel(application) {
    private val repo = HadirRepository(application)
    private val fused = LocationServices.getFusedLocationProviderClient(application)
    var notifications by mutableStateOf<List<AppNotification>>(emptyList()); private set
    var weather by mutableStateOf<WeatherState?>(null); private set
    var prayer by mutableStateOf<PrayerState?>(null); private set
    var qibla by mutableStateOf<Double?>(null); private set
    var city by mutableStateOf("موقعك الحالي"); private set
    var loading by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set
    fun load() {
        loading = true; error = null
        viewModelScope.launch {
            try { notifications = repo.notifications() } catch (_: Exception) { error = "تعذر تحميل الإشعارات" }
            try { currentLocation()?.let { loadLocationFeatures(it) } ?: run { error = error ?: "اسمح للموقع لعرض الطقس والصلاة والقبلة" } } catch (_: Exception) { error = error ?: "تعذر تحميل خدمات الموقع" }
            loading = false
        }
    }
    private suspend fun loadLocationFeatures(location: Location) = withContext(Dispatchers.IO) {
        val lat = location.latitude; val lng = location.longitude
        try { val w = JSONObject(URL("https://api.open-meteo.com/v1/forecast?latitude=$lat&longitude=$lng&current=temperature_2m,apparent_temperature,wind_speed_10m,weather_code&timezone=auto").readText()).getJSONObject("current"); weather = WeatherState(w.optDouble("temperature_2m"), w.optDouble("apparent_temperature"), w.optDouble("wind_speed_10m"), w.optInt("weather_code")) } catch (_: Exception) { }
        try { val d = SimpleDateFormat("dd-MM-yyyy", Locale.US).format(Date()); val p = JSONObject(URL("https://api.aladhan.com/v1/timings/$d?latitude=$lat&longitude=$lng&method=3").readText()).getJSONObject("data"); val t = p.getJSONObject("timings"); val h = p.optJSONObject("date")?.optJSONObject("hijri"); prayer = PrayerState(t.optString("Fajr","--:--").take(5), t.optString("Sunrise","--:--").take(5), t.optString("Dhuhr","--:--").take(5), t.optString("Asr","--:--").take(5), t.optString("Maghrib","--:--").take(5), t.optString("Isha","--:--").take(5), h?.optString("date").orEmpty()) } catch (_: Exception) { }
        qibla = ((Math.toDegrees(Math.atan2(Math.sin(Math.toRadians(39.826206 - lng)), Math.cos(Math.toRadians(lat)) * Math.tan(Math.toRadians(21.422487)) - Math.sin(Math.toRadians(lat)) * Math.cos(Math.toRadians(39.826206 - lng)))) + 360.0) % 360.0)
    }
    private suspend fun currentLocation(): Location? = suspendCancellableCoroutine { c -> val source = CancellationTokenSource(); c.invokeOnCancellation { source.cancel() }; fused.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, source.token).addOnSuccessListener { c.resume(it) }.addOnFailureListener { c.resume(null) } }
}

@Composable
fun NativeMainFeatures(vm: NativeServicesViewModel = viewModel(), onBack: () -> Unit) {
    val context = LocalContext.current
    val locationAllowed = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { if (it) vm.load() }
    LaunchedEffect(Unit) { if (locationAllowed) vm.load() }
    Scaffold(topBar = { TopAppBar(title = { Text("ميزات حاضر", fontWeight = FontWeight.Black) }, navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, null) } }, actions = { IconButton(onClick = { if (locationAllowed) vm.load() else permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION) }) { Icon(Icons.Default.Refresh, null) } }) }) { p ->
        LazyColumn(Modifier.fillMaxSize().padding(p), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item { Text("مركز خدماتك", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Black); Text("الإشعارات والطقس والصلاة والقبلة والمساعد الذكي", color = MaterialTheme.colorScheme.onSurfaceVariant) }
            vm.error?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }
            item { NotificationsCard(vm.notifications, vm.loading) }
            item { WeatherCard(vm.weather) }
            item { PrayerCard(vm.prayer) }
            item { QiblaCard(vm.qibla) }
            item { AiCard(vm.weather, vm.prayer, vm.notifications.size) }
            if (!locationAllowed) item { Button(onClick = { permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION) }, modifier = Modifier.fillMaxWidth()) { Icon(Icons.Default.LocationOn, null); Spacer(Modifier.width(8.dp)); Text("تفعيل الموقع للخدمات الذكية") } }
        }
    }
}

@Composable private fun NotificationsCard(items: List<AppNotification>, loading: Boolean) { Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp)) { Row(verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Default.Notifications, null); Spacer(Modifier.width(8.dp)); Text("الإشعارات", fontWeight = FontWeight.Bold); Spacer(Modifier.weight(1f)); Text(items.count { !it.read }.toString(), color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold) }; if (loading && items.isEmpty()) Text("جارٍ التحميل…", modifier = Modifier.padding(top = 12.dp)) else if (items.isEmpty()) Text("لا توجد إشعارات جديدة", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 12.dp)) else items.take(5).forEach { n -> ListItem(headlineContent = { Text(n.title, fontWeight = if (!n.read) FontWeight.Bold else FontWeight.Normal) }, supportingContent = { Text(n.body ?: n.message.orEmpty()) }, leadingContent = { Icon(Icons.Default.Info, null) }) } } } }
@Composable private fun WeatherCard(w: WeatherState?) { Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp)) { Text("الطقس", fontWeight = FontWeight.Bold); if (w == null) Text("اضغط تحديث بعد السماح بالموقع", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 10.dp)) else { Text("${w.temperature.toInt()}° — ${weatherLabel(w.code)}", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 10.dp)); Text("الإحساس ${w.feelsLike.toInt()}° · الرياح ${w.wind.toInt()} كم/س", color = MaterialTheme.colorScheme.onSurfaceVariant) } } } }
@Composable private fun PrayerCard(p: PrayerState?) { Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp)) { Text("مواقيت الصلاة", fontWeight = FontWeight.Bold); listOf("الفجر" to p?.fajr, "الشروق" to p?.sunrise, "الظهر" to p?.dhuhr, "العصر" to p?.asr, "المغرب" to p?.maghrib, "العشاء" to p?.isha).forEach { (n,t) -> Row(Modifier.fillMaxWidth().padding(top = 7.dp), horizontalArrangement = Arrangement.SpaceBetween) { Text(n); Text(t ?: "--:--", fontWeight = FontWeight.Bold) } } } } }
@Composable private fun QiblaCard(deg: Double?) { Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp)) { Text("القبلة", fontWeight = FontWeight.Bold); Text(if (deg == null) "تحتاج إلى الموقع" else "اتجاه القبلة ${deg.toInt()}° — ${directionLabel(deg)}", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 5.dp)) } } }
@Composable private fun AiCard(weather: WeatherState?, prayer: PrayerState?, notificationCount: Int) { val answer = when { notificationCount > 0 -> "لديك $notificationCount إشعارًا. راجعها قبل بدء يوم العمل."; prayer != null -> "مواقيت الصلاة متاحة لتنظيم يومك."; weather != null -> "الطقس الحالي ${weather.temperature.toInt()}° ويمكنك التخطيط ليومك بناءً عليه."; else -> "المساعد جاهز بعد تفعيل الموقع." }; Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp)) { Text("المساعد الذكي", fontWeight = FontWeight.Bold); Text(answer, modifier = Modifier.padding(top = 10.dp)) } } }
private fun weatherLabel(code: Int) = when (code) { 0 -> "سماء صافية"; 1,2,3 -> "غائم جزئيًا"; 45,48 -> "ضباب"; in 51..67 -> "رذاذ أو مطر"; in 71..77 -> "ثلوج"; in 80..82 -> "زخات مطر"; in 95..99 -> "عواصف"; else -> "حالة جوية" }
private fun directionLabel(deg: Double): String { val dirs = listOf("شمال", "شمال شرقي", "شرق", "جنوب شرقي", "جنوب", "جنوب غربي", "غرب", "شمال غربي"); return dirs[(Math.round(deg / 45.0).toInt()) % 8] }
