package com.hadir.attendance.ui

import android.Manifest
import android.app.Application
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewModelScope
import com.hadir.attendance.data.AttendanceRecord
import com.hadir.attendance.data.HadirRepository
import kotlinx.coroutines.launch

class HadirViewModel(application: Application) : AndroidViewModel(application) {
    private val repo = HadirRepository(application)
    var loggedIn by mutableStateOf(false); private set
    var employee by mutableStateOf<com.hadir.attendance.data.Employee?>(null); private set
    var attendance by mutableStateOf<List<AttendanceRecord>>(emptyList()); private set
    var loading by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set

    fun login(username: String, password: String) {
        loading = true; error = null
        viewModelScope.launch {
            try { employee = repo.login(username, password); loggedIn = true; attendance = repo.attendance() }
            catch (e: Exception) { error = e.message ?: "تعذر تسجيل الدخول" }
            finally { loading = false }
        }
    }
    fun logout() { loggedIn = false; employee = null; attendance = emptyList() }
}

@Composable
fun HadirApp(vm: HadirViewModel = viewModel()) {
    if (vm.loggedIn) HomeScreen(vm) else LoginScreen(vm)
}

@Composable
private fun LoginScreen(vm: HadirViewModel) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    Scaffold { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(24.dp), verticalArrangement = Arrangement.Center) {
            Text("حاضر", style = MaterialTheme.typography.headlineLarge)
            Text("تسجيل دخول الموظف", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp, bottom = 24.dp))
            OutlinedTextField(username, { username = it }, Modifier.fillMaxWidth(), label = { Text("رقم الموظف") }, singleLine = true)
            OutlinedTextField(password, { password = it }, Modifier.fillMaxWidth().padding(top = 12.dp), label = { Text("الرمز / كلمة المرور") }, visualTransformation = PasswordVisualTransformation(), singleLine = true)
            vm.error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 12.dp)) }
            Button(onClick = { vm.login(username.trim(), password) }, enabled = username.isNotBlank() && password.isNotBlank() && !vm.loading, modifier = Modifier.fillMaxWidth().padding(top = 20.dp)) { Text(if (vm.loading) "جارٍ الدخول…" else "دخول") }
        }
    }
}

@Composable
private fun HomeScreen(vm: HadirViewModel) {
    val context = LocalContext.current
    var showPermissionHint by remember { mutableStateOf(false) }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
        showPermissionHint = result.values.any { !it }
    }
    LaunchedEffect(Unit) {
        val missing = arrayOf(Manifest.permission.CAMERA, Manifest.permission.ACCESS_FINE_LOCATION).filter {
            ContextCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) permissionLauncher.launch(missing.toTypedArray())
    }
    Scaffold { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(20.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column { Text("مرحبًا ${vm.employee?.name.orEmpty()}", style = MaterialTheme.typography.headlineSmall); Text("حاضر", style = MaterialTheme.typography.bodyLarge) }
                TextButton(onClick = vm::logout) { Text("خروج") }
            }
            if (showPermissionHint) Text("تحتاج الكاميرا والموقع لتنفيذ الحضور بالتحقق الآمن.", color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(vertical = 12.dp))
            Card(Modifier.fillMaxWidth().padding(top = 16.dp)) { Column(Modifier.padding(18.dp)) {
                Text("سجل الحضور", style = MaterialTheme.typography.titleLarge)
                Text("عدد السجلات: ${vm.attendance.size}", modifier = Modifier.padding(top = 8.dp))
            }}
            Button(onClick = { /* CameraX + QR flow is next in the native attendance module. */ }, Modifier.fillMaxWidth().padding(top = 20.dp)) { Text("تسجيل الحضور") }
        }
    }
}
