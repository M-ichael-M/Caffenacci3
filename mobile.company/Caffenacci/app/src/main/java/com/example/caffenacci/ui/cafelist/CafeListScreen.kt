package com.example.caffenacci.ui.cafelist

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.caffenacci.data.remote.dto.CafeListItemDto

@Composable
fun CafeListScreen(
    modifier: Modifier = Modifier,
    viewModel: CafeListViewModel = viewModel(),
) {
    val serverUrl by viewModel.serverUrl.collectAsState()
    val uiState by viewModel.uiState.collectAsState()

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp),
    ) {
        Text(
            text = "Caffenacci — test połączenia",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = "Lista wszystkich kawiarni zarejestrowanych w serwisie, pobrana z serwera.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        Spacer(modifier = Modifier.height(20.dp))

        OutlinedTextField(
            value = serverUrl,
            onValueChange = viewModel::onServerUrlChanged,
            label = { Text("Adres serwera") },
            placeholder = { Text("http://192.168.1.30:8000/") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        Spacer(modifier = Modifier.height(12.dp))

        Button(
            onClick = viewModel::connectAndRefresh,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Połącz i odśwież")
        }

        Spacer(modifier = Modifier.height(20.dp))
        HorizontalDivider()
        Spacer(modifier = Modifier.height(12.dp))

        when (val state = uiState) {
            is CafeListUiState.Loading -> LoadingState()
            is CafeListUiState.Error -> ErrorState(state.message)
            is CafeListUiState.Success -> CafeList(state.cafes)
        }
    }
}

@Composable
private fun LoadingState() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 40.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator()
            Spacer(modifier = Modifier.height(12.dp))
            Text("Łączenie z serwerem…")
        }
    }
}

@Composable
private fun ErrorState(message: String) {
    Text(
        text = message,
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodyMedium,
        modifier = Modifier.padding(top = 24.dp),
    )
}

@Composable
private fun CafeList(cafes: List<CafeListItemDto>) {
    if (cafes.isEmpty()) {
        Text(
            text = "Brak zarejestrowanych kawiarni w serwisie.",
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(top = 24.dp),
        )
        return
    }

    Column {
        Text(
            text = "Znaleziono ${cafes.size} ${cafeWord(cafes.size)}:",
            style = MaterialTheme.typography.labelLarge,
            modifier = Modifier.padding(bottom = 8.dp),
        )

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(cafes) { cafe ->
                CafeRow(cafe)
            }
        }
    }
}

@Composable
private fun CafeRow(cafe: CafeListItemDto) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(
                text = cafe.cafe_name,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = "${cafe.street} ${cafe.building_number}, ${cafe.city}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

private fun cafeWord(count: Int): String = when {
    count == 1 -> "kawiarnię"
    count % 10 in 2..4 && count % 100 !in 12..14 -> "kawiarnie"
    else -> "kawiarni"
}