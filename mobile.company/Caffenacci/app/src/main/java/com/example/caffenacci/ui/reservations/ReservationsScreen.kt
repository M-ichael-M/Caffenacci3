package com.example.caffenacci.ui.reservations

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.caffenacci.data.remote.ApiService
import com.example.caffenacci.data.remote.dto.ReservationDto

@Composable
fun ReservationsScreen(api: ApiService, auth: String, modifier: Modifier = Modifier, viewModel: ReservationsViewModel = viewModel()) {
    val state by viewModel.uiState.collectAsState()
    var tab by remember { mutableStateOf(0) }

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
            Text("Rezerwacje", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
            FilledTonalIconButton(onClick = { viewModel.load(api, auth) }) {
                Icon(Icons.Filled.Refresh, contentDescription = "Odśwież")
            }
        }
        Spacer(Modifier.height(12.dp))

        val mode = state.settings?.mode ?: "simple"
        val tab0Title = if (mode == "simple") "Oczekujące (${state.pending.size})" else "Potwierdzone"

        TabRow(selectedTabIndex = tab, containerColor = MaterialTheme.colorScheme.surface, contentColor = MaterialTheme.colorScheme.primary) {
            Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text(tab0Title) })
            Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text("Historia (${state.history.size})") })
        }
        Spacer(Modifier.height(12.dp))

        if (state.loading) {
            Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        } else {
            val list = if (tab == 0) {
                if (mode == "simple") state.pending else state.history.filter { it.status == "confirmed" }
            } else state.history

            if (list.isEmpty()) {
                Box(Modifier.fillMaxWidth().padding(top = 48.dp), contentAlignment = Alignment.Center) {
                    Text("Brak rezerwacji do pokazania.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), contentPadding = PaddingValues(vertical = 8.dp)) {
                    items(list) { r ->
                        ReservationCard(
                            r = r,
                            showDecideActions = mode == "simple" && r.status == "pending",
                            onDecide = { status -> viewModel.decide(api, auth, r, status, null) },
                            onDelete = { viewModel.delete(api, auth, r.id) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ReservationCard(
    r: ReservationDto,
    showDecideActions: Boolean,
    onDecide: (String) -> Unit,
    onDelete: () -> Unit,
) {
    ElevatedCard(shape = RoundedCornerShape(20.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text(r.guest_name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text("${r.date} ${r.start_time}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.height(4.dp))
            Text("${r.guests} os." + (r.table_label?.let { " · $it" } ?: ""), style = MaterialTheme.typography.bodyMedium)
            r.comment?.let {
                Spacer(Modifier.height(4.dp))
                Text("„$it”", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            Row(Modifier.padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                if (showDecideActions) {
                    OutlinedButton(shape = RoundedCornerShape(14.dp), onClick = { onDecide("cancelled") }) { Text("Odrzuć") }
                    Spacer(Modifier.width(8.dp))
                    Button(shape = RoundedCornerShape(14.dp), onClick = { onDecide("confirmed") }) {
                        Icon(Icons.Filled.Check, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Akceptuj")
                    }
                } else {
                    Text(
                        "Status: ${r.status}",
                        style = MaterialTheme.typography.labelMedium,
                        color = if (r.status == "confirmed") MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.error,
                    )
                    Spacer(Modifier.weight(1f))
                    IconButton(onClick = onDelete) {
                        Icon(Icons.Filled.Delete, contentDescription = "Usuń", tint = MaterialTheme.colorScheme.error)
                    }
                }
            }
        }
    }
}