package com.example.caffenacci.ui.loyalty

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.caffenacci.data.remote.ApiService
import com.example.caffenacci.data.remote.dto.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class LoyaltyUiState(
    val code: String = "",
    val loading: Boolean = false,
    val error: String? = null,
    val message: String? = null,
    val lookup: LoyaltyLookupDto? = null,
)

class LoyaltyViewModel : ViewModel() {
    private val _uiState = MutableStateFlow(LoyaltyUiState())
    val uiState: StateFlow<LoyaltyUiState> = _uiState.asStateFlow()

    fun onCodeChanged(v: String) { _uiState.update { it.copy(code = v.uppercase()) } }

    fun search(api: ApiService, auth: String, code: String = _uiState.value.code) {
        if (code.length != 8) { _uiState.update { it.copy(error = "Kod ma dokładnie 8 znaków.") }; return }
        _uiState.update { it.copy(loading = true, error = null, message = null, code = code) }
        viewModelScope.launch {
            try {
                val result = api.lookupLoyalty(auth, code)
                _uiState.update { it.copy(lookup = result) }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "Nie znaleziono użytkownika.", lookup = null) }
            } finally { _uiState.update { it.copy(loading = false) } }
        }
    }

    fun earn(api: ApiService, auth: String, amount: Double) = act(api, auth) {
        val l = _uiState.value.lookup ?: return@act
        api.earnPoints(auth, LoyaltyEarnRequestDto(l.loyalty_code, amount))
    }

    fun redeem(api: ApiService, auth: String, rewardId: String) = act(api, auth) {
        val l = _uiState.value.lookup ?: return@act
        api.redeemReward(auth, LoyaltyRedeemRequestDto(l.loyalty_code, rewardId))
    }

    fun addStamp(api: ApiService, auth: String) = act(api, auth) {
        val l = _uiState.value.lookup ?: return@act
        api.addStamp(auth, LoyaltyStampRequestDto(l.loyalty_code))
    }

    fun resetStamps(api: ApiService, auth: String) = act(api, auth) {
        val l = _uiState.value.lookup ?: return@act
        api.resetStamps(auth, LoyaltyStampRequestDto(l.loyalty_code))
    }

    private fun act(api: ApiService, auth: String, block: suspend () -> Unit) {
        viewModelScope.launch {
            try {
                block()
                _uiState.value.lookup?.let { search(api, auth, it.loyalty_code) }
                _uiState.update { it.copy(message = "Zapisano.") }
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "Błąd operacji.") }
            }
        }
    }
}