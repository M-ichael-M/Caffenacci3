package com.example.caffenacci.data.remote.dto

import kotlinx.serialization.Serializable

@Serializable
data class MenuItemDto(
    val id: String,
    val name: String,
    val description: String? = null,
    val price: Double,
    val position: Int,
    val is_vege: Boolean,
    val is_hot: Boolean,
    val is_unavailable: Boolean,
)

@Serializable
data class MenuSectionDto(val id: String, val name: String, val position: Int, val items: List<MenuItemDto>)

@Serializable
data class MenuOutDto(val cafe_id: String, val sections: List<MenuSectionDto>)