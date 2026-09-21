package com.example.caffenacci.ui.orders

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.caffenacci.data.remote.ApiService
import com.example.caffenacci.data.remote.dto.OrderDto

@Composable
fun OrdersScreen(api: ApiService, auth: String, modifier: Modifier = Modifier, viewModel: OrdersViewModel = viewModel()) {
    val state by viewModel.uiState.collectAsState()
    var tab by remember { mutableStateOf(0) }

    LaunchedEffect(Unit) { viewModel.load(api, auth) }

    Column(modifier.fillMaxSize().padding(16.dp)) {
        Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
            Text("Zamówienia", style = MaterialTheme.typography.headlineSmall)
            TextButton(onClick = { viewModel.load(api, auth) }) { Text("Odśwież") }
        }

        TabRow(selectedTabIndex = tab) {
            Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text("Oczekujące (${state.pending.size})") })
            Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text("Historia (${state.history.size})") })
        }

        if (state.loading) {
            Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        } else {
            val list = if (tab == 0) state.pending else state.history
            LazyColumn(contentPadding = PaddingValues(vertical = 8.dp)) {
                items(list) { order ->
                    OrderCard(order = order, showActions = tab == 0, onDecide = { status -> viewModel.decide(api, auth, order, status) })
                    HorizontalDivider()
                }
            }
        }
    }
}

@Composable
private fun OrderCard(order: OrderDto, showActions: Boolean, onDecide: (String) -> Unit) {
    Column(Modifier.padding(vertical = 10.dp)) {
        Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
            Text(order.client_nick, style = MaterialTheme.typography.titleMedium)
            Text("%.2f zł".format(order.total_value), style = MaterialTheme.typography.titleMedium)
        }
        Text("${order.date} ${order.start_time}", style = MaterialTheme.typography.bodySmall)
        order.items.forEach { Text("${it.quantity}× ${it.name}", style = MaterialTheme.typography.bodySmall) }

        if (showActions) {
            Row(Modifier.padding(top = 8.dp)) {
                OutlinedButton(onClick = { onDecide("cancelled") }) { Text("Anuluj") }
                Spacer(Modifier.width(8.dp))
                Button(onClick = { onDecide("completed") }) { Text("Zrealizowano") }
            }
        } else {
            Text("Status: ${order.status}", style = MaterialTheme.typography.labelMedium)
        }
    }
}