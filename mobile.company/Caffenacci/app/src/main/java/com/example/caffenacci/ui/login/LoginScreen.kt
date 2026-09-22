package com.example.caffenacci.ui.login

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.caffenacci.R
import com.example.caffenacci.ui.theme.Espresso
import com.example.caffenacci.ui.theme.GoldSoft
import com.example.caffenacci.ui.theme.Parchment
import com.example.caffenacci.ui.theme.SidebarBg

@Composable
fun LoginScreen(onLoggedIn: (String) -> Unit, viewModel: LoginViewModel = viewModel()) {
    val state by viewModel.uiState.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
    ) {
        // ── Hero — mirrors the dark .auth-brand panel from caffenacci.company ──
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(Brush.verticalGradient(listOf(SidebarBg, Espresso)))
                .padding(top = 56.dp, bottom = 44.dp, start = 28.dp, end = 28.dp),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Image(
                    painter = painterResource(R.drawable.logo_white_on_black),
                    contentDescription = "Caffenacci",
                    modifier = Modifier
                        .size(76.dp)
                        .clip(CircleShape),
                )
                Spacer(Modifier.height(20.dp))
                Text(
                    "Caffenacci",
                    style = MaterialTheme.typography.displaySmall,
                    color = Parchment,
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    "B U S I N E S S",
                    style = MaterialTheme.typography.labelMedium,
                    color = GoldSoft,
                    letterSpacing = 3.sp,
                )
                Spacer(Modifier.height(18.dp))
                Text(
                    "Zaloguj się kodem kawiarni i osobistym kodem z zaproszenia.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Parchment.copy(alpha = 0.65f),
                    textAlign = TextAlign.Center,
                )
            }
        }

        // ── Form card — floats up over the hero, like the web auth form panel ──
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .offset(y = (-28).dp),
            shape = RoundedCornerShape(28.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
        ) {
            Column(modifier = Modifier.padding(24.dp)) {
                OutlinedTextField(
                    value = state.serverUrl,
                    onValueChange = viewModel::onServerUrlChanged,
                    label = { Text("Adres serwera") },
                    leadingIcon = { Icon(Icons.Filled.Storage, contentDescription = null) },
                    singleLine = true,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(14.dp))
                OutlinedTextField(
                    value = state.cafeCode,
                    onValueChange = viewModel::onCafeCodeChanged,
                    label = { Text("Kod kawiarni (8 znaków)") },
                    singleLine = true,
                    shape = RoundedCornerShape(16.dp),
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters),
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(14.dp))
                OutlinedTextField(
                    value = state.employeeCode,
                    onValueChange = viewModel::onEmployeeCodeChanged,
                    label = { Text("Twój kod z zaproszenia") },
                    singleLine = true,
                    shape = RoundedCornerShape(16.dp),
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters),
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(22.dp))
                Button(
                    onClick = { viewModel.login(onLoggedIn) },
                    enabled = !state.loading,
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Espresso, contentColor = Parchment),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp),
                ) {
                    if (state.loading) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Parchment, strokeWidth = 2.dp)
                    } else {
                        Text("Zaloguj się", fontWeight = FontWeight.SemiBold)
                    }
                }

                state.error?.let {
                    Spacer(Modifier.height(14.dp))
                    Surface(
                        color = MaterialTheme.colorScheme.errorContainer,
                        shape = RoundedCornerShape(14.dp),
                    ) {
                        Text(
                            it,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(12.dp),
                        )
                    }
                }
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}