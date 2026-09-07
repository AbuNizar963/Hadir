package com.hadir.attendance.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
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
    if (vm.employee == null) {
        NativeEmployeeStableLogin(vm)
    } else {
        NativeEmployeeStableHome(vm)
    }
}

@Composable
private fun NativeEmployeeStableLogin(vm: NativeMainViewModel) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("حاضر — دخول الموظف")
        OutlinedTextField(
            value = username,
            onValueChange = { username = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("رقم الموظف") },
            singleLine = true
        )
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("الرمز / كلمة المرور") },
            singleLine = true
        )
        vm.error?.let { Text(it) }
        Button(
            onClick = { vm.login(username, password) },
            enabled = username.isNotBlank() && password.isNotBlank() && !vm.loading,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(if (vm.loading) "جارٍ الدخول…" else "دخول")
        }
    }
}

@Composable
private fun NativeEmployeeStableHome(vm: NativeMainViewModel) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("تم تسجيل الدخول بنجاح")
        Text(vm.employee?.name.orEmpty())
        Text("سجلات الحضور: ${vm.attendance.size}")
        Text("الطلبات: ${vm.requests.size}")
        vm.error?.let { Text(it) }
        Button(onClick = vm::refresh, modifier = Modifier.fillMaxWidth()) { Text("تحديث") }
        Button(onClick = vm::logout, modifier = Modifier.fillMaxWidth()) { Text("تسجيل الخروج") }
    }
}
