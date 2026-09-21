package com.example.caffenacci.ui.orders

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.caffenacci.data.remote.ApiService
import com.example.caffenacci.data.remote.dto.OrderDto
import com.example.caffenacci.data.remote.dto.OrderStatusUpdateDto
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class OrdersUiState(
    val pending: List<OrderDto> = emptyList(),
    val history: List<OrderDto> = emptyList(),
    val loading: Boolean = true,
    val error: String? = null,
)

class OrdersViewModel : ViewModel() {
    private val _uiState = MutableStateFlow(OrdersUiState())
    val uiState: StateFlow<OrdersUiState> = _uiState.asStateFlow()

    fun load(api: ApiService, auth: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null) }
            try {
                val all = api.getOrders(auth).orders
                _uiState.update {
                    it.copy(
                        pending = all.filter { o -> o.status == "pending" }
                            .sortedWith(compareBy({ it.date }, { it.start_time })),
                        history = all.filter { o -> o.status != "pending" }
                            .sortedByDescending { it.created_at },
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "Błąd wczytywania zamówień.") }
            } finally { _uiState.update { it.copy(loading = false) } }
        }
    }

    fun decide(api: ApiService, auth: String, order: OrderDto, status: String) {
        viewModelScope.launch {
            try {
                val updated = api.updateOrderStatus(auth, order.id, OrderStatusUpdateDto(status))
                _uiState.update {
                    it.copy(
                        pending = it.pending.filterNot { o -> o.id == updated.id },
                        history = listOf(updated) + it.history,
                    )
                }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "Błąd zapisu.") }
            }
        }
    }
}