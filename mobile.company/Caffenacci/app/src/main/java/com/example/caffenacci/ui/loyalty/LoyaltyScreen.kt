package com.example.caffenacci.ui.loyalty

import android.Manifest
import android.R
import android.graphics.drawable.Drawable
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.caffenacci.data.remote.ApiService

@Composable
fun LoyaltyScreen(api: ApiService, auth: String, modifier: Modifier = Modifier, viewModel: LoyaltyViewModel = viewModel()) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    var showScanner by remember { mutableStateOf(false) }
    var txAmount by remember { mutableStateOf("") }

    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) showScanner = true
    }

    Column(modifier.fillMaxSize().padding(16.dp)) {
        Text("Program lojalnościowy", style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(12.dp))

        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = state.code, onValueChange = viewModel::onCodeChanged,
                label = { Text("Kod lojalnościowy klienta") }, singleLine = true,
                modifier = Modifier.weight(1f),
            )
            Spacer(Modifier.width(8.dp))
            IconButton(onClick = {
                if (hasCameraPermission(context)) showScanner = true
                else permissionLauncher.launch(Manifest.permission.CAMERA)
            }) { Icon(painterResource(R.drawable.ic_menu_camera), contentDescription = "Skanuj QR") }
        }
        Button(onClick = { viewModel.search(api, auth) }, enabled = !state.loading, modifier = Modifier.fillMaxWidth()) {
            Text(if (state.loading) "Szukanie…" else "Szukaj")
        }

        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp)) }
        state.message?.let { Text(it, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 8.dp)) }

        state.lookup?.let { l ->
            Spacer(Modifier.height(16.dp))
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp)) {
                    Text(l.full_name, style = MaterialTheme.typography.titleMedium)
                    Text("@${l.client_nick} · ${l.loyalty_code}", style = MaterialTheme.typography.bodySmall)
                    Spacer(Modifier.height(8.dp))
                    Text(
                        if (l.mode == "points") "${l.points} pkt." else "${l.stamps} / ${l.stamps_max} pieczątek",
                        style = MaterialTheme.typography.headlineSmall,
                    )
                    Spacer(Modifier.height(12.dp))

                    if (l.mode == "points") {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            OutlinedTextField(
                                value = txAmount, onValueChange = { txAmount = it },
                                label = { Text("Kwota transakcji (zł)") }, singleLine = true,
                                modifier = Modifier.weight(1f),
                            )
                            Spacer(Modifier.width(8.dp))
                            Button(onClick = {
                                txAmount.replace(',', '.').toDoubleOrNull()?.let { viewModel.earn(api, auth, it) }
                                txAmount = ""
                            }) { Text("Dolicz") }
                        }
                        Spacer(Modifier.height(12.dp))
                        Text("Nagrody", style = MaterialTheme.typography.titleSmall)
                        LazyColumn(modifier = Modifier.heightIn(max = 240.dp)) {
                            items(l.rewards) { r ->
                                Row(
                                    Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text("${r.name} — ${r.cost_points} pkt.")
                                    OutlinedButton(
                                        onClick = { viewModel.redeem(api, auth, r.id) },
                                        enabled = l.points >= r.cost_points,
                                    ) { Text("Wymień") }
                                }
                            }
                        }
                    } else {
                        Row {
                            if (l.stamps < l.stamps_max) {
                                Button(onClick = { viewModel.addStamp(api, auth) }) { Text("+ Podbij pieczątkę") }
                            } else {
                                Button(onClick = { viewModel.resetStamps(api, auth) }) { Text("Zeruj (nagroda odebrana)") }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showScanner) {
        Dialog(onDismissRequest = { showScanner = false }) {
            Card(modifier = Modifier.fillMaxWidth().height(420.dp)) {
                QrScannerView(modifier = Modifier.fillMaxSize()) { scanned ->
                    showScanner = false
                    viewModel.onCodeChanged(scanned.trim().uppercase())
                    viewModel.search(api, auth, scanned.trim().uppercase())
                }
            }
        }
    }
}