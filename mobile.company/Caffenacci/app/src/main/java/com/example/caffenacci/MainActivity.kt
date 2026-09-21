package com.example.caffenacci

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.caffenacci.ui.AppViewModel
import com.example.caffenacci.ui.SessionState
import com.example.caffenacci.ui.login.LoginScreen
import com.example.caffenacci.ui.main.MainScreen
import com.example.caffenacci.ui.theme.CaffenacciTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            CaffenacciTheme {
                val appViewModel: AppViewModel = viewModel()
                val state by appViewModel.state.collectAsState()

                when (val s = state) {
                    is SessionState.Checking -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                    is SessionState.LoggedOut -> LoginScreen(onLoggedIn = { url -> appViewModel.onLoggedIn(url) })
                    is SessionState.LoggedIn -> MainScreen(
                        info = s.info, token = s.token, api = s.api,
                        onLogout = { appViewModel.logout() },
                    )
                }
            }
        }
    }
}