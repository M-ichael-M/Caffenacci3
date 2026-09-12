package com.example.caffenacci

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.ui.Modifier
import com.example.caffenacci.ui.cafelist.CafeListScreen
import com.example.caffenacci.ui.theme.CaffenacciTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            CaffenacciTheme {
                Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                    CafeListScreen(modifier = Modifier.padding(innerPadding))
                }
            }
        }
    }
}