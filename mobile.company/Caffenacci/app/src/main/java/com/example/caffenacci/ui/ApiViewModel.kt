package com.example.caffenacci.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.caffenacci.data.local.EmployeeSessionPreferences
import com.example.caffenacci.data.local.ServerPreferences
import com.example.caffenacci.data.remote.ApiService
import com.example.caffenacci.data.remote.RetrofitProvider
import com.example.caffenacci.data.remote.dto.EmployeeVerifyResponseDto
import com.example.caffenacci.data.repository.EmployeeRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

sealed interface SessionState {
    data object Checking : SessionState
    data object LoggedOut : SessionState
    data class LoggedIn(val info: EmployeeVerifyResponseDto, val token: String, val api: ApiService) : SessionState
}

class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val serverPrefs = ServerPreferences(application)
    private val employeePrefs = EmployeeSessionPreferences(application)
    val repository = EmployeeRepository(employeePrefs)

    private val _state = MutableStateFlow<SessionState>(SessionState.Checking)
    val state: StateFlow<SessionState> = _state.asStateFlow()

    var serverUrl: String = ServerPreferences.DEFAULT_SERVER_URL
        private set

    init {
        viewModelScope.launch {
            serverUrl = serverPrefs.serverUrlFlow.first()
            val session = employeePrefs.sessionFlow.first()
            if (session == null) {
                _state.value = SessionState.LoggedOut
                return@launch
            }
            checkAccess(session.token)
        }
    }

    private suspend fun checkAccess(token: String) {
        try {
            val api = RetrofitProvider.create(serverUrl)
            val info = repository.verify(api, token)
            _state.value = SessionState.LoggedIn(info, token, api)
        } catch (e: Exception) {
            // token invalid / access revoked / network — send back to login
            repository.logout()
            _state.value = SessionState.LoggedOut
        }
    }

    fun onLoggedIn(url: String) {
        viewModelScope.launch {
            serverPrefs.saveServerUrl(url)
            serverUrl = url
            val session = employeePrefs.sessionFlow.first() ?: return@launch
            checkAccess(session.token)
        }
    }

    fun logout() {
        viewModelScope.launch {
            repository.logout()
            _state.value = SessionState.LoggedOut
        }
    }

    fun retryVerify() {
        viewModelScope.launch {
            val session = employeePrefs.sessionFlow.first()
            if (session == null) { _state.value = SessionState.LoggedOut; return@launch }
            _state.value = SessionState.Checking
            checkAccess(session.token)
        }
    }
}