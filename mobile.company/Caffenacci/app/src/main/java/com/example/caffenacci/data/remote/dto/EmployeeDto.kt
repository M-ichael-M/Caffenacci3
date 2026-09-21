package com.example.caffenacci.data.remote.dto

import kotlinx.serialization.Serializable

@Serializable
data class EmployeeLoginRequestDto(val cafe_code: String, val employee_code: String)

@Serializable
data class EmployeeLoginResponseDto(
    val access_token: String,
    val employee_id: String,
    val full_name: String,
    val role: String,
    val cafe_id: String,
    val cafe_name: String,
)

@Serializable
data class EmployeeVerifyResponseDto(
    val employee_id: String,
    val full_name: String,
    val role: String,
    val cafe_id: String,
    val cafe_name: String,
    val loyalty_enabled: Boolean,
    val orders_enabled: Boolean,
    val reservations_enabled: Boolean,
)