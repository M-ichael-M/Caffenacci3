package com.example.caffenacci.data.remote.dto

import kotlinx.serialization.Serializable

@Serializable
data class ReservationDto(
    val id: String, val table_id: String? = null, val cafe_id: String,
    val date: String, val start_time: String, val guests: Int,
    val guest_name: String, val guest_phone: String? = null, val guest_email: String? = null,
    val comment: String? = null, val client_id: String? = null, val created_by_owner: Boolean,
    val status: String, val owner_note: String? = null, val created_at: String? = null,
    val table_seats: Int? = null, val table_type: String? = null, val table_label: String? = null,
    val cancelled_by: String? = null,
)

@Serializable
data class ReservationListDto(val date: String? = null, val reservations: List<ReservationDto>)

@Serializable
data class ReservationStatusUpdateDto(val status: String, val owner_note: String? = null)

@Serializable
data class CafeTableDto(val id: String, val table_type: String, val seats: Int, val quantity: Int, val label: String? = null)

@Serializable
data class DayHoursDto(val id: String, val day_of_week: Int, val open_time: String? = null, val close_time: String? = null)

@Serializable
data class ReservationSettingsDto(
    val id: String, val cafe_id: String, val enabled: Boolean, val mode: String,
    val slot_duration_minutes: Int, val tables: List<CafeTableDto>, val hours: List<DayHoursDto>,
)

@Serializable
data class ReservationCreateDto(
    val table_id: String, val date: String, val start_time: String, val guests: Int,
    val guest_name: String, val guest_phone: String? = null, val guest_email: String? = null,
    val comment: String? = null, val client_id: String? = null,
)