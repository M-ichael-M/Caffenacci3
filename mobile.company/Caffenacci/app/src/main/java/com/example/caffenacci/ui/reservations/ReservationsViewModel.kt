package com.example.caffenacci.ui.reservations

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.caffenacci.data.remote.ApiService
import com.example.caffenacci.data.remote.dto.ReservationDto
import com.example.caffenacci.data.remote.dto.ReservationSettingsDto
import com.example.caffenacci.data.remote.dto.ReservationStatusUpdateDto
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class ReservationsUiState(
    val settings: ReservationSettingsDto? = null,
    val pending: List<ReservationDto> = emptyList(),
    val history: List<ReservationDto> = emptyList(),
    val loading: Boolean = true,
    val error: String? = null,
)

class ReservationsViewModel : ViewModel() {
    private val _uiState = MutableStateFlow(ReservationsUiState())
    val uiState: StateFlow<ReservationsUiState> = _uiState.asStateFlow()

    fun load(api: ApiService, auth: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null) }
            try {
                val settings = api.getReservationSettings(auth)
                val all = api.getReservations(auth).reservations
                _uiState.update {
                    it.copy(
                        settings = settings,
                        pending = all.filter { r -> r.status == "pending" },
                        history = all.filter { r -> r.status != "pending" }
                            .sortedByDescending { it.created_at },
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "Błąd wczytywania rezerwacji.") }
            } finally { _uiState.update { it.copy(loading = false) } }
        }
    }

    fun decide(api: ApiService, auth: String, res: ReservationDto, status: String, note: String?) {
        viewModelScope.launch {
            try {
                val updated = api.updateReservationStatus(auth, res.id, ReservationStatusUpdateDto(status, note))
                _uiState.update {
                    it.copy(
                        pending = it.pending.filterNot { r -> r.id == updated.id },
                        history = listOf(updated) + it.history,
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "Błąd zapisu.") }
            }
        }
    }

    fun delete(api: ApiService, auth: String, id: String) {
        viewModelScope.launch {
            try {
                api.deleteReservation(auth, id)
                _uiState.update {
                    it.copy(
                        pending = it.pending.filterNot { r -> r.id == id },
                        history = it.history.filterNot { r -> r.id == id },
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "Błąd usuwania.") }
            }
        }
    }
}