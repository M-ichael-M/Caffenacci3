package com.example.caffenacci.ui.main

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.example.caffenacci.data.remote.ApiService
import com.example.caffenacci.data.remote.dto.EmployeeVerifyResponseDto
import com.example.caffenacci.ui.loyalty.LoyaltyScreen
import com.example.caffenacci.ui.menu.MenuScreen
import com.example.caffenacci.ui.orders.OrdersScreen
import com.example.caffenacci.ui.reservations.ReservationsScreen

private enum class Tab(val label: String) { LOYALTY("Lojalność"), ORDERS("Zamówienia"), RESERVATIONS("Rezerwacje"), MENU("Menu") }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(info: EmployeeVerifyResponseDto, token: String, api: ApiService, onLogout: () -> Unit) {
    val availableTabs = buildList {
        if (info.loyalty_enabled) add(Tab.LOYALTY)
        if (info.orders_enabled) add(Tab.ORDERS)
        if (info.reservations_enabled) add(Tab.RESERVATIONS)
        add(Tab.MENU)
    }
    var selected by remember { mutableStateOf(availableTabs.first()) }
    val auth = "Bearer $token"

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("${info.cafe_name} · ${info.full_name}") },
                actions = { TextButton(onClick = onLogout) { Text("Wyloguj") } },
            )
        },
        bottomBar = {
            NavigationBar {
                availableTabs.forEach { tab ->
                    NavigationBarItem(
                        selected = selected == tab,
                        onClick = { selected = tab },
                        icon = {
                            Icon(
                                imageVector = when (tab) {
                                    Tab.LOYALTY -> Icons.Filled.Star
                                    Tab.ORDERS -> Icons.Filled.ShoppingCart
                                    Tab.RESERVATIONS -> Icons.Filled.DateRange
                                    Tab.MENU -> Icons.AutoMirrored.Filled.List
                                },
                                contentDescription = tab.label,
                            )
                        },
                        label = { Text(tab.label) },
                    )
                }
            }
        },
    ) { padding ->
        Modifier.padding(padding).let { mod ->
            when (selected) {
                Tab.LOYALTY -> LoyaltyScreen(api, auth, modifier = mod)
                Tab.ORDERS -> OrdersScreen(api, auth, modifier = mod)
                Tab.RESERVATIONS -> ReservationsScreen(api, auth, modifier = mod)
                Tab.MENU -> MenuScreen(api, auth, modifier = mod)
            }
        }
    }
}