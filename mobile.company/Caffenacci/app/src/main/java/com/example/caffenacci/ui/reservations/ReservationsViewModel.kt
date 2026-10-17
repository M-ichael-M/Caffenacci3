package com.example.caffenacci.ui.reservations

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.caffenacci.data.remote.ApiService
import com.example.caffenacci.data.remote.apiErrorMessage
import com.example.caffenacci.data.remote.dto.ReservationCreateDto
import com.example.caffenacci.data.remote.dto.ReservationDto
import com.example.caffenacci.data.remote.dto.ReservationSettingsDto
import com.example.caffenacci.data.remote.dto.ReservationStatusUpdateDto
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class ReservationsUiState(
    val settings: ReservationSettingsDto? = null,
    // tryb simple
    val pending: List<ReservationDto> = emptyList(),
    val history: List<ReservationDto> = emptyList(),
    // tryb advanced — rezerwacje wybranego dnia
    val dayReservations: List<ReservationDto> = emptyList(),
    val selectedDate: String = todayString(),
    val loading: Boolean = true,
    val loadingDay: Boolean = false,
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
                _uiState.update { it.copy(settings = settings) }
                fetchData(api, auth, settings, _uiState.value.selectedDate)
            } catch (e: Exception) {
                _uiState.update { it.copy(error = apiErrorMessage(e, "Błąd wczytywania rezerwacji.")) }
            } finally { _uiState.update { it.copy(loading = false) } }
        }
    }

    private suspend fun fetchData(api: ApiService, auth: String, settings: ReservationSettingsDto, date: String) {
        if (!settings.enabled) return
        if (settings.mode == "advanced") {
            val day = api.getReservations(auth, date = date).reservations.sortedBy { it.start_time }
            _uiState.update { it.copy(dayReservations = day) }
        } else {
            val all = api.getReservations(auth).reservations
            val pending = all.filter { it.status == "pending" }
                .sortedWith(compareBy({ it.date }, { it.start_time }))
            val history = all.filter { it.status != "pending" }
                .sortedByDescending { it.created_at }
            _uiState.update { it.copy(pending = pending, history = history) }
        }
    }

    // ── Nawigacja po dniach (advanced) ───────────────────────────────────

    fun selectDate(api: ApiService, auth: String, date: String) {
        val settings = _uiState.value.settings ?: return
        _uiState.update { it.copy(selectedDate = date, loadingDay = true, error = null) }
        viewModelScope.launch {
            try {
                fetchData(api, auth, settings, date)
            } catch (e: Exception) {
                _uiState.update { it.copy(error = apiErrorMessage(e, "Błąd wczytywania rezerwacji.")) }
            } finally { _uiState.update { it.copy(loadingDay = false) } }
        }
    }

    fun shiftDay(api: ApiService, auth: String, delta: Int) =
        selectDate(api, auth, shiftDate(_uiState.value.selectedDate, delta))

    // ── Decyzja właściciela (simple) — z opcjonalną wiadomością dla klienta ─

    fun decide(
        api: ApiService, auth: String, res: ReservationDto, status: String, note: String?,
        onDone: (String?) -> Unit,
    ) {
        viewModelScope.launch {
            try {
                val updated = api.updateReservationStatus(
                    auth, res.id, ReservationStatusUpdateDto(status, note?.trim()?.ifBlank { null }),
                )
                _uiState.update {
                    it.copy(
                        pending = it.pending.filterNot { r -> r.id == updated.id },
                        history = listOf(updated) + it.history,
                    )
                }
                onDone(null)
            } catch (e: Exception) {
                onDone(apiErrorMessage(e, "Błąd zapisu."))
            }
        }
    }

    fun delete(api: ApiService, auth: String, id: String) {
        viewModelScope.launch {
            try {
                api.deleteReservation(auth, id)
                // odśwież z serwera: rezerwacja zaawansowana klienta wraca jako "anulowana"
                _uiState.value.settings?.let { fetchData(api, auth, it, _uiState.value.selectedDate) }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = apiErrorMessage(e, "Błąd usuwania.")) }
            }
        }
    }

    // ── Nowa rezerwacja telefoniczna (advanced) ──────────────────────────

    fun create(api: ApiService, auth: String, dto: ReservationCreateDto, onDone: (String?) -> Unit) {
        viewModelScope.launch {
            try {
                api.createReservation(auth, dto)
                _uiState.value.settings?.let { fetchData(api, auth, it, _uiState.value.selectedDate) }
                onDone(null)
            } catch (e: Exception) {
                onDone(apiErrorMessage(e, "Błąd zapisu rezerwacji."))
            }
        }
    }
}