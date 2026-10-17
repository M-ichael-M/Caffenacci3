package com.example.caffenacci.data.remote.dto

import kotlinx.serialization.Serializable

@Serializable
data class OrderItemDto(val id: String, val menu_item_id: String? = null, val name: String, val price: Double, val quantity: Int)

@Serializable
data class OrderDto(
    val id: String, val cafe_id: String, val client_nick: String,
    val date: String, val start_time: String,
    val items: List<OrderItemDto>, val total_value: Double,
    val status: String, val cancelled_by: String? = null, val created_at: String? = null,
)

@Serializable
data class OrderListDto(val orders: List<OrderDto>)

@Serializable
data class OrderStatusUpdateDto(val status: String, val loyalty_code: String? = null)