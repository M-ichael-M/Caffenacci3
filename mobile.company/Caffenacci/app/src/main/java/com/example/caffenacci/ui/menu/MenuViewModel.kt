package com.example.caffenacci.ui.menu

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.caffenacci.data.remote.ApiService
import com.example.caffenacci.data.remote.dto.MenuSectionDto
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class MenuUiState(val sections: List<MenuSectionDto> = emptyList(), val loading: Boolean = true, val error: String? = null)

class MenuViewModel : ViewModel() {
    private val _uiState = MutableStateFlow(MenuUiState())
    val uiState: StateFlow<MenuUiState> = _uiState.asStateFlow()

    fun load(api: ApiService, auth: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null) }
            try {
                val menu = api.getMenu(auth)
                _uiState.update { it.copy(sections = menu.sections) }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "Błąd wczytywania menu.") }
            } finally { _uiState.update { it.copy(loading = false) } }
        }
    }

    fun toggleAvailability(api: ApiService, auth: String, itemId: String, isUnavailable: Boolean) {
        viewModelScope.launch {
            try {
                api.setItemAvailability(auth, itemId, isUnavailable)
                _uiState.update { state ->
                    state.copy(sections = state.sections.map { sec ->
                        sec.copy(items = sec.items.map { item ->
                            if (item.id == itemId) item.copy(is_unavailable = isUnavailable) else item
                        })
                    })
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "Błąd zapisu.") }
            }
        }
    }
}