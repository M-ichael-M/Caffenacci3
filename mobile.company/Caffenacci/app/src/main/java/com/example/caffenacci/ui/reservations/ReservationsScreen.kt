package com.example.caffenacci.ui.reservations

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
import com.example.caffenacci.data.remote.dto.ReservationDto

@Composable
fun ReservationsScreen(api: ApiService, auth: String, modifier: Modifier = Modifier, viewModel: ReservationsViewModel = viewModel()) {
    val state by viewModel.uiState.collectAsState()
    var tab by remember { mutableStateOf(0) }

    LaunchedEffect(Unit) { viewModel.load(api, auth) }

    Column(modifier.fillMaxSize().padding(16.dp)) {
        Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
            Text("Rezerwacje", style = MaterialTheme.typography.headlineSmall)
            TextButton(onClick = { viewModel.load(api, auth) }) { Text("Odśwież") }
        }

        val mode = state.settings?.mode ?: "simple"

        TabRow(selectedTabIndex = tab) {
            Tab(selected = tab == 0, onClick = { tab = 0 },
                text = { Text(if (mode == "simple") "Oczekujące (${state.pending.size})" else "Potwierdzone") })
            Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text("Historia (${state.history.size})") })
        }

        if (state.loading) {
            Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        } else {
            val list = if (tab == 0) {
                if (mode == "simple") state.pending else state.history.filter { it.status == "confirmed" }
            } else state.history

            LazyColumn(contentPadding = PaddingValues(vertical = 8.dp)) {
                items(list) { r ->
                    ReservationCard(
                        r = r,
                        showDecideActions = mode == "simple" && r.status == "pending",
                        onDecide = { status -> viewModel.decide(api, auth, r, status, null) },
                        onDelete = { viewModel.delete(api, auth, r.id) },
                    )
                    HorizontalDivider()
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
    Column(Modifier.padding(vertical = 10.dp)) {
        Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
            Text(r.guest_name, style = MaterialTheme.typography.titleMedium)
            Text("${r.date} ${r.start_time}", style = MaterialTheme.typography.bodySmall)
        }
        Text("${r.guests} os." + (r.table_label?.let { " · $it" } ?: ""), style = MaterialTheme.typography.bodySmall)
        r.comment?.let { Text("„$it”", style = MaterialTheme.typography.bodySmall) }

        Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            if (showDecideActions) {
                OutlinedButton(onClick = { onDecide("cancelled") }) { Text("Odrzuć") }
                Spacer(Modifier.width(8.dp))
                Button(onClick = { onDecide("confirmed") }) { Text("Akceptuj") }
            } else {
                Text("Status: ${r.status}", style = MaterialTheme.typography.labelMedium)
                Spacer(Modifier.weight(1f))
                TextButton(onClick = onDelete) { Text("Usuń") }
            }
        }
    }
}