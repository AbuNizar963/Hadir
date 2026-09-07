package com.hadir.attendance.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel

@Composable
fun NativeEmployeeStableApp(
    vm: NativeMainViewModel = viewModel(),
    onEmployeeAuthenticated: () -> Unit = {},
    onEmployeeLoggedOut: () -> Unit = {}
) {
    var notified by remember { mutableStateOf(false) }
    LaunchedEffect(vm.employee) {
        if (vm.employee != null && !notified) {
            notified = true
            onEmployeeAuthenticated()
        } else if (vm.employee == null && notified) {
            notified = false
            onEmployeeLoggedOut()
        }
    }
    LaunchedEffect(Unit) { vm.restoreSession() }
    if (vm.employee == null) NativeEmployeeStableLogin(vm) else NativeEmployeeStableHome(vm)
}

@Composable
private fun NativeEmployeeStableLogin(vm: NativeMainViewModel) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("حاضر — دخول الموظف")
        OutlinedTextField(username, { username = it }, Modifier.fillMaxWidth(), label = { Text("رقم الموظف") }, singleLine = true)
        OutlinedTextField(password, { password = it }, Modifier.fillMaxWidth(), label = { Text("الرمز / كلمة المرور") }, singleLine = true)
        vm.error?.let { Text(it) }
        Button(onClick = { vm.login(username, password) }, enabled = username.isNotBlank() && password.isNotBlank() && !vm.loading, modifier = Modifier.fillMaxWidth()) {
            Text(if (vm.loading) "جارٍ الدخول…" else "دخول")
        }
    }
}

@Composable
private fun NativeEmployeeStableHome(vm: NativeMainViewModel) {
    val context = LocalContext.current
    var tab by remember { mutableIntStateOf(0) }
    var scanner by remember { mutableStateOf(false) }
    var requestDialog by remember { mutableStateOf(false) }
    var requestType by remember { mutableStateOf("permission") }
    var reason by remember { mutableStateOf("") }
    var start by remember { mutableStateOf("") }
    var end by remember { mutableStateOf("") }
    var clockType by remember { mutableStateOf("check-in") }
    val locationAllowed = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    val cameraAllowed = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

    LaunchedEffect(Unit) { vm.refresh() }

    if (scanner) {
        QrScanner(
            onResult = { code -> scanner = false; vm.clock(clockType, code, locationAllowed) },
            onCancel = { scanner = false }
        )
        return
    }

    if (requestDialog) {
        AlertDialog(
            onDismissRequest = { requestDialog = false },
            title = { Text("طلب جديد") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        FilterChip(requestType == "permission", { requestType = "permission" }, label = { Text("استئذان") })
                        FilterChip(requestType == "leave", { requestType = "leave" }, label = { Text("إجازة") })
                    }
                    OutlinedTextField(reason, { reason = it }, Modifier.fillMaxWidth(), label = { Text("السبب") }, minLines = 2)
                    OutlinedTextField(start, { start = it }, Modifier.fillMaxWidth(), label = { Text("تاريخ البداية (اختياري)") }, singleLine = true)
                    OutlinedTextField(end, { end = it }, Modifier.fillMaxWidth(), label = { Text("تاريخ النهاية (اختياري)") }, singleLine = true)
                }
            },
            confirmButton = {
                Button(onClick = { vm.addRequest(requestType, reason, start, end); requestDialog = false; reason = ""; start = ""; end = "" }, enabled = reason.isNotBlank()) { Text("إرسال") }
            },
            dismissButton = { TextButton(onClick = { requestDialog = false }) { Text("إلغاء") } }
        )
    }

    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("حاضر — ${vm.employee?.name.orEmpty()}")
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("الرئيسية", "الحضور", "الطلبات", "الحساب").forEachIndexed { index, title ->
                Button(onClick = { tab = index }, modifier = Modifier.weight(1f)) { Text(title) }
            }
        }
        when (tab) {
            0 -> EmployeeHomeTab(vm, locationAllowed, cameraAllowed) { type ->
                clockType = type
                if (locationAllowed && cameraAllowed) scanner = true
            }
            1 -> EmployeeAttendanceTab(vm)
            2 -> EmployeeRequestsTab(vm) { requestDialog = true }
            else -> EmployeeAccountTab(vm)
        }
    }
}

@Composable
private fun EmployeeHomeTab(vm: NativeMainViewModel, locationAllowed: Boolean, cameraAllowed: Boolean, onClock: (String) -> Unit) {
    val latest = vm.attendance.maxByOrNull { it.timestamp }
    val checkedIn = latest?.type == "check-in" || latest?.type == "in"
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(if (checkedIn) "الحالة: حاضر" else "الحالة: غير مسجل")
            Text("عدد سجلات الحضور: ${vm.attendance.size}")
            Text("الطلبات المعلقة: ${vm.requests.count { it.status == "pending" }}")
            Button(onClick = { onClock(if (checkedIn) "check-out" else "check-in") }, enabled = !vm.working && locationAllowed && cameraAllowed, modifier = Modifier.fillMaxWidth()) {
                Text(if (checkedIn) "تسجيل الانصراف" else "تسجيل الحضور")
            }
            if (!locationAllowed) Text("يلزم السماح بالموقع لتسجيل الحضور.")
            if (!cameraAllowed) Text("يلزم السماح بالكاميرا لمسح رمز QR.")
            vm.error?.let { Text(it) }
        }
    }
    Spacer(Modifier.height(4.dp))
    Button(onClick = vm::refresh, modifier = Modifier.fillMaxWidth(), enabled = !vm.loading) { Text("تحديث البيانات") }
}

@Composable
private fun EmployeeAttendanceTab(vm: NativeMainViewModel) {
    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item { Text("سجل الحضور") }
        items(vm.attendance.sortedByDescending { it.timestamp }) { row ->
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp)) {
                    Text(if (row.type == "check-in" || row.type == "in") "حضور" else "انصراف")
                    Text(row.timestamp)
                }
            }
        }
        if (vm.attendance.isEmpty()) item { Text("لا توجد سجلات حضور بعد.") }
    }
}

@Composable
private fun EmployeeRequestsTab(vm: NativeMainViewModel, onNewRequest: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(onClick = onNewRequest, modifier = Modifier.fillMaxWidth()) { Text("طلب جديد") }
        Button(onClick = vm::refreshRequests, modifier = Modifier.fillMaxWidth()) { Text("تحديث الطلبات") }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(vm.requests) { request ->
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(12.dp)) {
                        Text("${request.type}")
                        Text("${request.reason}")
                        Text("${request.status}")
                    }
                }
            }
            if (vm.requests.isEmpty()) item { Text("لا توجد طلبات.") }
        }
    }
}

@Composable
private fun EmployeeAccountTab(vm: NativeMainViewModel) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("الحساب")
        Text("الاسم: ${vm.employee?.name.orEmpty()}")
        Text("المعرف: ${vm.employee?.id.orEmpty()}")
        Button(onClick = vm::logout, modifier = Modifier.fillMaxWidth()) { Text("تسجيل الخروج") }
    }
}
