package com.example.caffenacci.ui.main

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.caffenacci.R
import com.example.caffenacci.data.remote.ApiService
import com.example.caffenacci.data.remote.dto.EmployeeVerifyResponseDto
import com.example.caffenacci.ui.loyalty.LoyaltyScreen
import com.example.caffenacci.ui.menu.MenuScreen
import com.example.caffenacci.ui.orders.OrdersScreen
import com.example.caffenacci.ui.reservations.ReservationsScreen
import com.example.caffenacci.ui.theme.Espresso
import com.example.caffenacci.ui.theme.GoldSoft
import com.example.caffenacci.ui.theme.Parchment
import com.example.caffenacci.ui.theme.SidebarBg

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
            CenterAlignedTopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Image(
                            painter = painterResource(R.drawable.logo_circle),
                            contentDescription = null,
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape),
                        )
                        Spacer(Modifier.width(10.dp))
                        Column {
                            Text(
                                info.cafe_name,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 1,
                            )
                            Text(
                                info.full_name,
                                style = MaterialTheme.typography.labelSmall,
                                color = Parchment.copy(alpha = 0.6f),
                                maxLines = 1,
                            )
                        }
                    }
                },
                actions = {
                    IconButton(onClick = onLogout) {
                        Icon(Icons.Filled.Logout, contentDescription = "Wyloguj")
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = SidebarBg,
                    titleContentColor = Parchment,
                    actionIconContentColor = GoldSoft,
                ),
            )
        },
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surface, tonalElevation = 4.dp) {
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
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = MaterialTheme.colorScheme.onPrimaryContainer,
                            indicatorColor = MaterialTheme.colorScheme.primaryContainer,
                            selectedTextColor = Espresso,
                        ),
                    )
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background,
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