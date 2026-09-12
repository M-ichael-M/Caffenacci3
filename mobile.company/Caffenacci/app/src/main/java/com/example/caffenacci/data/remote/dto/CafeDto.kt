package com.example.caffenacci.data.remote.dto

import kotlinx.serialization.Serializable

@Serializable
data class CafeListItemDto(
    val id: String,
    val cafe_name: String,
    val city: String,
    val street: String,
    val building_number: String,
    val slug: String? = null,
)

@Serializable
data class CafeListResponseDto(
    val cafes: List<CafeListItemDto>,
    val count: Int,
)