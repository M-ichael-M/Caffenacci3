package com.example.caffenacci.ui.menu

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

@Composable
fun MenuScreen(api: ApiService, auth: String, modifier: Modifier = Modifier, viewModel: MenuViewModel = viewModel()) {
    val state by viewModel.uiState.collectAsState()
    LaunchedEffect(Unit) { viewModel.load(api, auth) }

    Column(modifier.fillMaxSize().padding(16.dp)) {
        Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
            Text("Menu", style = MaterialTheme.typography.headlineSmall)
            TextButton(onClick = { viewModel.load(api, auth) }) { Text("Odśwież") }
        }

        if (state.loading) {
            Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        } else {
            LazyColumn {
                state.sections.forEach { section ->
                    item {
                        Text(section.name, style = MaterialTheme.typography.titleSmall, modifier = Modifier.padding(top = 16.dp, bottom = 4.dp))
                    }
                    items(section.items) { menuItem ->
                        Row(
                            Modifier.fillMaxWidth().padding(vertical = 6.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(Modifier.weight(1f)) {
                                Text(menuItem.name, style = MaterialTheme.typography.bodyLarge)
                                Text("%.2f zł".format(menuItem.price), style = MaterialTheme.typography.bodySmall)
                            }
                            Text(if (menuItem.is_unavailable) "Niedostępne" else "Dostępne", style = MaterialTheme.typography.labelMedium)
                            Switch(
                                checked = !menuItem.is_unavailable,
                                onCheckedChange = { available -> viewModel.toggleAvailability(api, auth, menuItem.id, !available) },
                            )
                        }
                    }
                }
            }
        }
    }
}