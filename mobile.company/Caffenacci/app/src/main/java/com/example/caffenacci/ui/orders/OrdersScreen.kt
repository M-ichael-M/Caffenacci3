package com.example.caffenacci.ui.orders

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.caffenacci.data.remote.ApiService
import com.example.caffenacci.data.remote.dto.OrderDto
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardCapitalization

@Composable
fun OrdersScreen(api: ApiService, auth: String, modifier: Modifier = Modifier, viewModel: OrdersViewModel = viewModel()) {
    val state by viewModel.uiState.collectAsState()
    var tab by remember { mutableStateOf(0) }
    var completing by remember { mutableStateOf<OrderDto?>(null) }

    LaunchedEffect(Unit) { viewModel.load(api, auth) }

    Column(
        modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp, vertical = 16.dp),
    ) {
        Row(
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Zamówienia", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
            FilledTonalIconButton(onClick = { viewModel.load(api, auth) }) {
                Icon(Icons.Filled.Refresh, contentDescription = "Odśwież")
            }
        }
        Spacer(Modifier.height(12.dp))

        val tabTitles = listOf("Oczekujące (${state.pending.size})", "Historia (${state.history.size})")
        TabRow(
            selectedTabIndex = tab,
            containerColor = MaterialTheme.colorScheme.surface,
            contentColor = MaterialTheme.colorScheme.primary,
        ) {
            tabTitles.forEachIndexed { i, title ->
                Tab(selected = tab == i, onClick = { tab = i }, text = { Text(title) })
            }
        }
        Spacer(Modifier.height(12.dp))

        if (state.loading) {
            Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        } else {
            val list = if (tab == 0) state.pending else state.history
            if (list.isEmpty()) {
                EmptyHint(if (tab == 0) "Brak oczekujących zamówień." else "Brak historii zamówień.")
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), contentPadding = PaddingValues(vertical = 8.dp)) {
                    items(list) { order ->
                        OrderCard(
                            order = order,
                            showActions = tab == 0,
                            onDecide = { status ->
                                if (status == "completed") completing = order
                                else viewModel.decide(api, auth, order, status)
                            },
                        )
                    }
                }
            }
        }
    }
    completing?.let { order ->
        CompleteOrderDialog(
            order = order,
            onDismiss = { completing = null },
            onConfirm = { code, onError ->
                viewModel.complete(api, auth, order, code, onSuccess = { completing = null }, onError = onError)
            },
        )
    }
}

@Composable
private fun CompleteOrderDialog(
    order: OrderDto,
    onDismiss: () -> Unit,
    onConfirm: (code: String, onError: (String) -> Unit) -> Unit,
) {
    var code by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text("Realizacja zamówienia") },
        text = {
            Column {
                Text(
                    "Poproś klienta (${order.client_nick}) o kod lojalnościowy i wpisz go, aby zrealizować zamówienie.",
                    style = MaterialTheme.typography.bodyMedium,
                )
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = code,
                    onValueChange = { code = it.uppercase().take(8); error = null },
                    label = { Text("Kod klienta (8 znaków)") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth(),
                )
                error?.let {
                    Spacer(Modifier.height(8.dp))
                    Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = {
            Button(
                enabled = code.length == 8 && !busy,
                onClick = {
                    busy = true; error = null
                    onConfirm(code) { msg -> busy = false; error = msg }
                },
            ) { Text(if (busy) "Sprawdzanie…" else "Zrealizuj") }
        },
        dismissButton = { TextButton(enabled = !busy, onClick = onDismiss) { Text("Anuluj") } },
    )
}

@Composable
private fun EmptyHint(text: String) {
    Box(Modifier.fillMaxWidth().padding(top = 48.dp), contentAlignment = Alignment.Center) {
        Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun OrderCard(order: OrderDto, showActions: Boolean, onDecide: (String) -> Unit) {
    ElevatedCard(shape = RoundedCornerShape(20.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text(order.client_nick, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = RoundedCornerShape(100)) {
                    Text(
                        "%.2f zł".format(order.total_value),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                    )
                }
            }
            Spacer(Modifier.height(4.dp))
            Text("${order.date} ${order.start_time}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(6.dp))
            order.items.forEach {
                Text("${it.quantity}× ${it.name}", style = MaterialTheme.typography.bodyMedium)
            }

            if (showActions) {
                Spacer(Modifier.height(12.dp))
                Row {
                    OutlinedButton(shape = RoundedCornerShape(14.dp), onClick = { onDecide("cancelled") }) { Text("Anuluj") }
                    Spacer(Modifier.width(8.dp))
                    Button(shape = RoundedCornerShape(14.dp), onClick = { onDecide("completed") }) {
                        Icon(Icons.Filled.CheckCircle, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Zrealizowano")
                    }
                }
            } else {
                Spacer(Modifier.height(8.dp))
                Text(
                    "Status: ${order.status}",
                    style = MaterialTheme.typography.labelMedium,
                    color = if (order.status == "completed") MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.error,
                )
            }
        }
    }
}