package com.example.caffenacci.ui.loyalty

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Redeem
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
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

    Column(
        modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
    ) {
        Text("Program lojalnościowy", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(16.dp))

        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = state.code, onValueChange = viewModel::onCodeChanged,
                label = { Text("Kod lojalnościowy klienta") }, singleLine = true,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.weight(1f),
            )
            Spacer(Modifier.width(8.dp))
            FilledTonalIconButton(
                onClick = {
                    if (hasCameraPermission(context)) showScanner = true
                    else permissionLauncher.launch(Manifest.permission.CAMERA)
                },
                modifier = Modifier.size(56.dp),
            ) { Icon(Icons.Filled.QrCodeScanner, contentDescription = "Skanuj QR") }
        }
        Spacer(Modifier.height(10.dp))
        Button(
            onClick = { viewModel.search(api, auth) },
            enabled = !state.loading,
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp),
        ) {
            Text(if (state.loading) "Szukanie…" else "Szukaj")
        }

        state.error?.let {
            Spacer(Modifier.height(12.dp))
            StatusBanner(it, isError = true)
        }
        state.message?.let {
            Spacer(Modifier.height(12.dp))
            StatusBanner(it, isError = false)
        }

        state.lookup?.let { l ->
            Spacer(Modifier.height(20.dp))
            ElevatedCard(shape = RoundedCornerShape(24.dp), modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(20.dp)) {
                    Text(l.full_name, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                    Text(
                        "@${l.client_nick} · ${l.loyalty_code}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(12.dp))
                    Surface(
                        color = MaterialTheme.colorScheme.primaryContainer,
                        shape = RoundedCornerShape(100),
                    ) {
                        Text(
                            if (l.mode == "points") "${l.points} pkt." else "${l.stamps} / ${l.stamps_max} pieczątek",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                        )
                    }
                    Spacer(Modifier.height(16.dp))

                    if (l.mode == "points") {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            OutlinedTextField(
                                value = txAmount, onValueChange = { txAmount = it },
                                label = { Text("Kwota transakcji (zł)") }, singleLine = true,
                                shape = RoundedCornerShape(16.dp),
                                modifier = Modifier.weight(1f),
                            )
                            Spacer(Modifier.width(8.dp))
                            FilledTonalButton(
                                shape = RoundedCornerShape(16.dp),
                                onClick = {
                                    txAmount.replace(',', '.').toDoubleOrNull()?.let { viewModel.earn(api, auth, it) }
                                    txAmount = ""
                                },
                            ) { Text("Dolicz") }
                        }
                        Spacer(Modifier.height(18.dp))
                        Text("Nagrody", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(6.dp))
                        LazyColumn(modifier = Modifier.heightIn(max = 260.dp)) {
                            items(l.rewards) { r ->
                                Row(
                                    Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 6.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text("${r.name} — ${r.cost_points} pkt.")
                                    OutlinedButton(
                                        onClick = { viewModel.redeem(api, auth, r.id) },
                                        enabled = l.points >= r.cost_points,
                                        shape = RoundedCornerShape(100),
                                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp),
                                    ) {
                                        Icon(Icons.Filled.Redeem, contentDescription = null, modifier = Modifier.size(16.dp))
                                        Spacer(Modifier.width(6.dp))
                                        Text("Wymień")
                                    }
                                }
                            }
                        }
                    } else {
                        Row {
                            if (l.stamps < l.stamps_max) {
                                Button(shape = RoundedCornerShape(16.dp), onClick = { viewModel.addStamp(api, auth) }) {
                                    Text("+ Podbij pieczątkę")
                                }
                            } else {
                                Button(shape = RoundedCornerShape(16.dp), onClick = { viewModel.resetStamps(api, auth) }) {
                                    Text("Zeruj (nagroda odebrana)")
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showScanner) {
        Dialog(onDismissRequest = { showScanner = false }) {
            ElevatedCard(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(420.dp),
                shape = RoundedCornerShape(24.dp),
            ) {
                QrScannerView(modifier = Modifier.fillMaxSize()) { scanned ->
                    showScanner = false
                    viewModel.onCodeChanged(scanned.trim().uppercase())
                    viewModel.search(api, auth, scanned.trim().uppercase())
                }
            }
        }
    }
}

@Composable
private fun StatusBanner(text: String, isError: Boolean) {
    Surface(
        color = if (isError) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.tertiaryContainer,
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text(
            text,
            color = if (isError) MaterialTheme.colorScheme.onErrorContainer else MaterialTheme.colorScheme.onTertiaryContainer,
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.padding(12.dp),
        )
    }
}