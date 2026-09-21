package com.example.caffenacci.data.remote.dto

import kotlinx.serialization.Serializable

@Serializable
data class LoyaltyRewardDto(val id: String, val name: String, val cost_points: Int)

@Serializable
data class LoyaltyLookupDto(
    val client_nick: String, val full_name: String, val loyalty_code: String,
    val mode: String, val points: Int, val stamps: Int, val stamps_max: Int,
    val rewards: List<LoyaltyRewardDto>,
)

@Serializable
data class LoyaltyBalanceDto(val client_nick: String, val mode: String, val points: Int, val stamps: Int, val stamps_max: Int)

@Serializable
data class LoyaltyEarnRequestDto(val loyalty_code: String, val amount: Double)

@Serializable
data class LoyaltyRedeemRequestDto(val loyalty_code: String, val reward_id: String)

@Serializable
data class LoyaltyStampRequestDto(val loyalty_code: String)