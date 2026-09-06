package com.hadir.attendance.ui

import android.app.Application
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AssignmentTurnedIn
import androidx.compose.material.icons.filled.Badge
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewModelScope
import com.hadir.attendance.data.Admin
import com.hadir.attendance.data.EmployeeRequest
import com.hadir.attendance.data.HadirRepository
import kotlinx.coroutines.launch

private val AdminGreen = Color(0xFF0B6B5A)
private val AdminInk = Color(0xFF17322C)
private val AdminMuted = Color(0xFF70817B)

class NativeAdminViewModel(application: Application) : AndroidViewModel(application) {
    private val repo = HadirRepository(application)
    var admin by mutableStateOf<Admin?>(null); private set
    var employees by mutableStateOf<List<Map<String, Any?>>>(emptyList()); private set
    var attendanceCount by mutableIntStateOf(0); private set
    var requests by mutableStateOf<List<EmployeeRequest>>(emptyList()); private set
    var locationsCount by mutableIntStateOf(0); private set
    var audit by mutableStateOf<List<Map<String, Any?>>>(emptyList()); private set
    var loading by mutableStateOf(false); private set
    var error by mutableStateOf<String?>(null); private set

    fun login(username: String, password: String) {
        loading = true; error = null
        viewModelScope.launch {
            try { admin = repo.loginAdmin(username.trim(), password); refresh() }
            catch (e: Exception) { error = e.message ?: "تعذر تسجيل دخول الإدارة" }
            finally { loading = false }
        }
    }

    fun refresh() {
        viewModelScope.launch {
            try {
                val result = kotlinx.coroutines.async {
                    listOf(repo.employees(), repo.attendance(2000), repo.requests(), repo.locations(), repo.audit(300))
                }
                val data = result.await()
                employees = data[0] as List<Map<String, Any?>>
                attendanceCount = (data[1] as List<*>).size
                requests = data[2] as List<EmployeeRequest>
                locationsCount = (data[3] as List<*>).size
                audit = data[4] as List<Map<String, Any?>>
            } catch (e: Exception) { error = e.message ?: "تعذر تحديث لوحة الإدارة" }
        }
    }

    fun updateRequest(id: String, status: String) {
        viewModelScope.launch {
            try { repo.updateRequest(id, status); refresh() }
            catch (e: Exception) { error = e.message ?: "تعذر تحديث الطلب" }
        }
    }

    fun logout() { repo.logout(); admin = null; employees = emptyList(); requests = emptyList(); audit = emptyList() }
}

@Composable
fun NativeRoleEntry(onEmployee: () -> Unit, onAdmin: () -> Unit) {
    Box(Modifier.fillMaxSize().background(Color(0xFFF7F9F8)), contentAlignment = Alignment.Center) {
        Card(Modifier.fillMaxWidth().padding(22.dp), shape = RoundedCornerShape(28.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
            Column(Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Brand()
                Text("حاضر Native", fontSize = 30.sp, fontWeight = FontWeight.Black, color = AdminInk, modifier = Modifier.padding(top = 16.dp))
                Text("اختر مساحة العمل", color = AdminMuted, modifier = Modifier.padding(top = 6.dp, bottom = 24.dp))
                Button(onClick = onEmployee, modifier = Modifier.fillMaxWidth().height(54.dp), shape = RoundedCornerShape(16.dp)) { Text("مساحة الموظف", fontWeight = FontWeight.Bold) }
                Spacer(Modifier.height(10.dp))
                TextButton(onClick = onAdmin, modifier = Modifier.fillMaxWidth()) { Text("دخول المدير / المشرف") }
            }
        }
    }
}

@Composable
fun NativeAdminApp(vm: NativeAdminViewModel = viewModel(), onBack: () -> Unit) {
    if (vm.admin == null) NativeAdminLogin(vm, onBack) else NativeAdminShell(vm, onBack)
}

@Composable
private fun NativeAdminLogin(vm: NativeAdminViewModel, onBack: () -> Unit) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    Scaffold { p ->
        Box(Modifier.fillMaxSize().padding(p).padding(20.dp), contentAlignment = Alignment.Center) {
            Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(28.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                Column(Modifier.padding(24.dp)) {
                    Brand()
                    Text("مساحة الإدارة", fontSize = 26.sp, fontWeight = FontWeight.Black, color = AdminInk, modifier = Modifier.padding(top = 18.dp))
                    Text("للمدير والمالك والمشرف، بصلاحيات الخادم الفعلية.", color = AdminMuted, modifier = Modifier.padding(top = 6.dp, bottom = 22.dp))
                    OutlinedTextField(username, { username = it }, Modifier.fillMaxWidth(), label = { Text("اسم المستخدم") }, singleLine = true)
                    OutlinedTextField(password, { password = it }, Modifier.fillMaxWidth().padding(top = 12.dp), label = { Text("كلمة المرور") }, visualTransformation = PasswordVisualTransformation(), singleLine = true)
                    vm.error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 10.dp)) }
                    Button(onClick = { vm.login(username, password) }, enabled = username.isNotBlank() && password.isNotBlank() && !vm.loading, modifier = Modifier.fillMaxWidth().padding(top = 18.dp).height(52.dp), shape = RoundedCornerShape(16.dp)) { Text(if (vm.loading) "جارٍ الدخول…" else "دخول الإدارة", fontWeight = FontWeight.Bold) }
                    TextButton(onClick = onBack, modifier = Modifier.fillMaxWidth().padding(top = 4.dp)) { Text("العودة لاختيار مساحة العمل") }
                }
            }
        }
    }
}

@Composable
private fun NativeAdminShell(vm: NativeAdminViewModel, onBack: () -> Unit) {
    var tab by remember { mutableIntStateOf(0) }
    LaunchedEffect(Unit) { vm.refresh() }
    Scaffold(
        bottomBar = {
            NavigationBar {
                val items = listOf("الرئيسية" to Icons.Default.Home, "الموظفون" to Icons.Default.People, "الطلبات" to Icons.Default.AssignmentTurnedIn, "التدقيق" to Icons.Default.Settings)
                items.forEachIndexed { i, item -> NavigationBarItem(selected = tab == i, onClick = { tab = i }, icon = { Icon(item.second, null) }, label = { Text(item.first) }) }
            }
        }
    ) { p ->
        when (tab) {
            0 -> AdminDashboard(vm, p)
            1 -> AdminEmployees(vm, p)
            2 -> AdminRequests(vm, p)
            else -> AdminAudit(vm, p)
        }
    }
}

@Composable
private fun AdminDashboard(vm: NativeAdminViewModel, p: PaddingValues) {
    LazyColumn(Modifier.fillMaxSize().padding(p), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) { Text("لوحة الإدارة", fontSize = 13.sp, color = AdminMuted); Text(vm.admin?.name ?: "الإدارة", fontSize = 23.sp, fontWeight = FontWeight.Black, color = AdminInk) }
                IconButton(onClick = vm::logout) { Icon(Icons.Default.Logout, "تسجيل الخروج") }
            }
        }
        item { Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(26.dp), colors = CardDefaults.cardColors(containerColor = AdminGreen)) { Column(Modifier.padding(20.dp)) { Text("مركز التحكم في حاضر", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Black); Text("الصلاحية: ${vm.admin?.role.orEmpty()}", color = Color.White.copy(alpha = .82f), modifier = Modifier.padding(top = 6.dp)); Text("بيانات مباشرة من HADIR API", color = Color.White.copy(alpha = .82f), modifier = Modifier.padding(top = 4.dp)) } } }
        item { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) { AdminMetric("الموظفون", vm.employees.size, Modifier.weight(1f)); AdminMetric("الحضور", vm.attendanceCount, Modifier.weight(1f)) } }
        item { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) { AdminMetric("الطلبات", vm.requests.size, Modifier.weight(1f)); AdminMetric("المواقع", vm.locationsCount, Modifier.weight(1f)) } }
        if (vm.error != null) item { Text(vm.error!!, color = MaterialTheme.colorScheme.error) }
        item { Text("التشغيل", fontSize = 19.sp, fontWeight = FontWeight.Black, color = AdminInk) }
        item { AdminAction(Icons.Default.Groups, "القوى العاملة", "${vm.employees.size} موظفًا في النظام") }
        item { AdminAction(Icons.Default.Place, "مواقع العمل", "${vm.locationsCount} موقعًا متاحًا للعمليات") }
        item { AdminAction(Icons.Default.Badge, "صلاحية الإدارة", "${vm.admin?.role.orEmpty()} — الصلاحيات يحددها الخادم") }
    }
}

@Composable
private fun AdminEmployees(vm: NativeAdminViewModel, p: PaddingValues) {
    LazyColumn(Modifier.fillMaxSize().padding(p), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("الموظفون", fontSize = 25.sp, fontWeight = FontWeight.Black, color = AdminInk); Text("بيانات الموظفين من قاعدة النظام", color = AdminMuted, modifier = Modifier.padding(top = 4.dp, bottom = 8.dp)) }
        items(vm.employees) { e ->
            val name = "${e["name"] ?: "بدون اسم"}"
            val job = "${e["jobNumber"] ?: "—"}"
            val status = "${e["status"] ?: "—"}"
            Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp)) { Row(Modifier.padding(15.dp), verticalAlignment = Alignment.CenterVertically) { Box(Modifier.width(46.dp).height(46.dp).background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) { Text(name.firstOrNull()?.toString() ?: "م", fontWeight = FontWeight.Black, color = AdminGreen) }; Spacer(Modifier.width(12.dp)); Column(Modifier.weight(1f)) { Text(name, fontWeight = FontWeight.Bold); Text("$job · $status", color = AdminMuted, fontSize = 12.sp) } } }
        }
        if (vm.employees.isEmpty()) item { Text("لا توجد بيانات موظفين.", color = AdminMuted) }
    }
}

@Composable
private fun AdminRequests(vm: NativeAdminViewModel, p: PaddingValues) {
    LazyColumn(Modifier.fillMaxSize().padding(p), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("طلبات الفريق", fontSize = 25.sp, fontWeight = FontWeight.Black, color = AdminInk); Text("الموافقة والرفض تتم عبر API بصلاحية الحساب الحالي.", color = AdminMuted, modifier = Modifier.padding(top = 4.dp, bottom = 8.dp)) }
        items(vm.requests.sortedByDescending { it.createdAt }) { r ->
            Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(19.dp)) { Column(Modifier.padding(16.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text("${r.employeeName ?: r.employeeId} · ${requestLabel(r.type)}", fontWeight = FontWeight.Bold); Text(statusLabel(r.status), color = statusColor(r.status), fontSize = 12.sp) }
                if (!r.reason.isNullOrBlank()) Text(r.reason!!, color = AdminMuted, modifier = Modifier.padding(top = 7.dp))
                if (r.status == "pending") Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End, modifier = Modifier.padding(top = 8.dp)) {
                    FilterChip(selected = false, onClick = { vm.updateRequest(r.id, "rejected") }, label = { Text("رفض") })
                    Spacer(Modifier.width(8.dp))
                    FilterChip(selected = false, onClick = { vm.updateRequest(r.id, "approved") }, label = { Text("موافقة") })
                }
            } }
        }
        if (vm.requests.isEmpty()) item { Text("لا توجد طلبات.", color = AdminMuted) }
    }
}

@Composable
private fun AdminAudit(vm: NativeAdminViewModel, p: PaddingValues) {
    LazyColumn(Modifier.fillMaxSize().padding(p), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("سجل التدقيق", fontSize = 25.sp, fontWeight = FontWeight.Black, color = AdminInk); Text("آخر العمليات المسجلة من الخادم", color = AdminMuted, modifier = Modifier.padding(top = 4.dp, bottom = 8.dp)) }
        items(vm.audit.take(120)) { a ->
            Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(17.dp)) { Column(Modifier.padding(14.dp)) { Text("${a["action"] ?: "حدث"} · ${a["actorName"] ?: a["jobNumber"] ?: "—"}", fontWeight = FontWeight.Bold); Text("${a["timestamp"] ?: ""} · ${a["result"] ?: ""}", color = AdminMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp)) } }
        }
        if (vm.audit.isEmpty()) item { Text("لا توجد أحداث تدقيق.", color = AdminMuted) }
    }
}

@Composable
private fun AdminMetric(label: String, value: Int, modifier: Modifier) { Card(modifier, shape = RoundedCornerShape(19.dp)) { Column(Modifier.padding(15.dp)) { Text(label, color = AdminMuted, fontSize = 12.sp); Text(value.toString(), fontSize = 24.sp, fontWeight = FontWeight.Black, color = AdminInk, modifier = Modifier.padding(top = 4.dp)) } } }
@Composable
private fun AdminAction(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, subtitle: String) { Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(19.dp)) { Row(Modifier.padding(15.dp), verticalAlignment = Alignment.CenterVertically) { Icon(icon, null, tint = AdminGreen); Spacer(Modifier.width(12.dp)); Column { Text(title, fontWeight = FontWeight.Bold, color = AdminInk); Text(subtitle, color = AdminMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 3.dp)) } } } }
@Composable
private fun Brand() { Box(Modifier.width(54.dp).height(54.dp).background(AdminGreen, RoundedCornerShape(16.dp)), contentAlignment = Alignment.Center) { Text("ح", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Black) } }
private fun requestLabel(type: String) = when (type) { "leave" -> "إجازة"; "checkout" -> "انصراف"; else -> "استئذان" }
private fun statusLabel(status: String) = when (status) { "approved" -> "مقبول"; "rejected" -> "مرفوض"; "confirmed" -> "مؤكد"; else -> "قيد المراجعة" }
private fun statusColor(status: String) = when (status) { "approved", "confirmed" -> Color(0xFF2E7D32); "rejected" -> Color(0xFFB3261E); else -> AdminGreen }
