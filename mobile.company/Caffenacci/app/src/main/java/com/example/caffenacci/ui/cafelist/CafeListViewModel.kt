package com.example.caffenacci.ui.cafelist

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.caffenacci.data.local.ServerPreferences
import com.example.caffenacci.data.remote.RetrofitProvider
import com.example.caffenacci.data.remote.dto.CafeListItemDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import retrofit2.HttpException
import java.io.IOException

sealed interface CafeListUiState {
    data object Loading : CafeListUiState
    data class Success(val cafes: List<CafeListItemDto>) : CafeListUiState
    data class Error(val message: String) : CafeListUiState
}

class CafeListViewModel(application: Application) : AndroidViewModel(application) {

    private val preferences = ServerPreferences(application)

    private val _serverUrl = MutableStateFlow(ServerPreferences.DEFAULT_SERVER_URL)
    val serverUrl: StateFlow<String> = _serverUrl.asStateFlow()

    private val _uiState = MutableStateFlow<CafeListUiState>(CafeListUiState.Loading)
    val uiState: StateFlow<CafeListUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val savedUrl = preferences.serverUrlFlow.first()
            _serverUrl.value = savedUrl
            fetchCafes(savedUrl)
        }
    }

    fun onServerUrlChanged(newUrl: String) {
        _serverUrl.value = newUrl
    }

    fun connectAndRefresh() {
        var url = _serverUrl.value.trim()
        if (url.isNotEmpty() && !url.startsWith("http://") && !url.startsWith("https://")) {
            url = "http://$url"
        }
        _serverUrl.value = url

        viewModelScope.launch {
            preferences.saveServerUrl(url)
            fetchCafes(url)
        }
    }

    private suspend fun fetchCafes(baseUrl: String) {
        _uiState.value = CafeListUiState.Loading
        try {
            val api = RetrofitProvider.create(baseUrl)
            val response = api.getAllCafes()
            _uiState.value = CafeListUiState.Success(response.cafes)
        } catch (e: HttpException) {
            _uiState.value = CafeListUiState.Error(
                "Serwer zwrócił błąd (kod ${e.code()}). Sprawdź czy backend działa poprawnie."
            )
        } catch (e: IOException) {
            _uiState.value = CafeListUiState.Error(
                "Nie udało się połączyć z serwerem pod adresem $baseUrl. Sprawdź adres IP oraz czy telefon i komputer są w tej samej sieci Wi-Fi."
            )
        } catch (e: Exception) {
            _uiState.value = CafeListUiState.Error(
                "Wystąpił nieoczekiwany błąd: ${e.message ?: "nieznany"}"
            )
        }
    }
}