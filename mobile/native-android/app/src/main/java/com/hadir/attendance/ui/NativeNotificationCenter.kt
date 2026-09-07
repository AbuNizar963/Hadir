package com.hadir.attendance.ui

import android.app.Application
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.MarkEmailRead
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewModelScope
import com.hadir.attendance.data.AppNotification
import com.hadir.attendance.data.HadirRepository
import kotlinx.coroutines.launch

class NativeNotificationViewModel(application: Application) : AndroidViewModel(application) {
    private val repo = HadirRepository(application)
    var notifications by mutableStateOf<List<AppNotification>>(emptyList())
        private set
    var loading by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
        private set

    fun refresh() {
        loading = true
        error = null
        viewModelScope.launch {
            try {
                notifications = repo.notifications()
            } catch (e: Exception) {
                error = e.message ?: "تعذر تحميل الإشعارات"
            } finally {
                loading = false
            }
        }
    }

    fun markRead(id: String?) {
        viewModelScope.launch {
            try {
                repo.markNotificationRead(id)
                notifications = notifications.map { if (id == null || it.id == id) it.copy(read = true) else it }
            } catch (e: Exception) {
                error = e.message ?: "تعذر تحديث حالة الإشعار"
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NativeNotificationCenter(
    onBack: () -> Unit,
    vm: NativeNotificationViewModel = viewModel()
) {
    LaunchedEffect(Unit) { vm.refresh() }
    val unread = vm.notifications.count { !it.read }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("مركز الإشعارات", fontWeight = FontWeight.Black) },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, "رجوع") }
                },
                actions = {
                    IconButton(onClick = vm::refresh, enabled = !vm.loading) {
                        Icon(Icons.Default.Refresh, "تحديث")
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            item {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("إشعارات حاضر", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Black)
                        Text("غير المقروءة: $unread", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Button(onClick = { vm.markRead(null) }, enabled = unread > 0) {
                        Icon(Icons.Default.DoneAll, null)
                        Spacer(Modifier.padding(horizontal = 2.dp))
                        Text("قراءة الكل")
                    }
                }
            }
            vm.error?.let { message ->
                item { Text(message, color = MaterialTheme.colorScheme.error) }
            }
            if (vm.loading && vm.notifications.isEmpty()) {
                item {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                        CircularProgressIndicator()
                    }
                }
            } else if (vm.notifications.isEmpty()) {
                item {
                    Text("لا توجد إشعارات حالية", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            } else {
                items(vm.notifications, key = { it.id }) { notification ->
                    Card(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    if (notification.read) Icons.Default.MarkEmailRead else Icons.Default.DoneAll,
                                    null,
                                    tint = if (notification.read) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.primary
                                )
                                Spacer(Modifier.padding(horizontal = 4.dp))
                                Text(notification.title, fontWeight = if (notification.read) FontWeight.Medium else FontWeight.Black, modifier = Modifier.weight(1f))
                                if (!notification.read) {
                                    Text("جديد", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                                }
                            }
                            val body = notification.body ?: notification.message.orEmpty()
                            if (body.isNotBlank()) Text(body, modifier = Modifier.padding(top = 8.dp))
                            Text(notification.createdAt, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 6.dp))
                            if (!notification.read) {
                                Button(onClick = { vm.markRead(notification.id) }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
                                    Text("تحديد كمقروء")
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
