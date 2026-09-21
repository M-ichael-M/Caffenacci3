package com.example.caffenacci.ui.login

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.caffenacci.data.local.EmployeeSessionPreferences
import com.example.caffenacci.data.local.ServerPreferences
import com.example.caffenacci.data.remote.RetrofitProvider
import com.example.caffenacci.data.repository.EmployeeRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class LoginUiState(
    val serverUrl: String = ServerPreferences.DEFAULT_SERVER_URL,
    val cafeCode: String = "",
    val employeeCode: String = "",
    val loading: Boolean = false,
    val error: String? = null,
)

class LoginViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = EmployeeRepository(EmployeeSessionPreferences(application))
    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    fun onServerUrlChanged(v: String) { _uiState.update { it.copy(serverUrl = v) } }
    fun onCafeCodeChanged(v: String) { _uiState.update { it.copy(cafeCode = v.uppercase()) } }
    fun onEmployeeCodeChanged(v: String) { _uiState.update { it.copy(employeeCode = v.uppercase()) } }

    fun login(onSuccess: (String) -> Unit) {
        val s = _uiState.value
        if (s.cafeCode.length != 8 || s.employeeCode.length != 8) {
            _uiState.update { it.copy(error = "Oba kody mają dokładnie 8 znaków.") }
            return
        }
        _uiState.update { it.copy(loading = true, error = null) }
        viewModelScope.launch {
            try {
                var url = s.serverUrl.trim()
                if (!url.startsWith("http://") && !url.startsWith("https://")) url = "http://$url"
                val api = RetrofitProvider.create(url)
                repository.login(api, s.cafeCode, s.employeeCode)
                onSuccess(url)
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "Nie udało się zalogować.") }
            } finally {
                _uiState.update { it.copy(loading = false) }
            }
        }
    }
}