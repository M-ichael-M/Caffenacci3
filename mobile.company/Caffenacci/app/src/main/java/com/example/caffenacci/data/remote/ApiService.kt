package com.example.caffenacci.data.remote

import com.example.caffenacci.data.remote.dto.*
import retrofit2.http.*

interface ApiService {
    @GET("cafes/all")
    suspend fun getAllCafes(): CafeListResponseDto

    @POST("employee-auth/login")
    suspend fun employeeLogin(@Body body: EmployeeLoginRequestDto): EmployeeLoginResponseDto

    @GET("employee-auth/verify")
    suspend fun employeeVerify(@Header("Authorization") auth: String): EmployeeVerifyResponseDto

    // Menu
    @GET("menu")
    suspend fun getMenu(@Header("Authorization") auth: String): MenuOutDto

    @PATCH("menu/items/{itemId}/availability")
    suspend fun setItemAvailability(
        @Header("Authorization") auth: String,
        @Path("itemId") itemId: String,
        @Query("is_unavailable") isUnavailable: Boolean,
    ): MenuItemDto

    // Orders
    @GET("orders")
    suspend fun getOrders(@Header("Authorization") auth: String, @Query("status") status: String? = null): OrderListDto

    @PATCH("orders/{orderId}/status")
    suspend fun updateOrderStatus(
        @Header("Authorization") auth: String,
        @Path("orderId") orderId: String,
        @Body body: OrderStatusUpdateDto,
    ): OrderDto

    // Reservations
    @GET("reservations/settings")
    suspend fun getReservationSettings(@Header("Authorization") auth: String): ReservationSettingsDto

    @GET("reservations")
    suspend fun getReservations(
        @Header("Authorization") auth: String,
        @Query("date") date: String? = null,
        @Query("status") status: String? = null,
    ): ReservationListDto

    @PATCH("reservations/{id}/status")
    suspend fun updateReservationStatus(
        @Header("Authorization") auth: String,
        @Path("id") id: String,
        @Body body: ReservationStatusUpdateDto,
    ): ReservationDto

    @POST("reservations")
    suspend fun createReservation(@Header("Authorization") auth: String, @Body body: ReservationCreateDto): ReservationDto

    @DELETE("reservations/{id}")
    suspend fun deleteReservation(@Header("Authorization") auth: String, @Path("id") id: String)

    // Loyalty
    @GET("loyalty/settings")
    suspend fun getLoyaltySettings(@Header("Authorization") auth: String): Map<String, @JvmSuppressWildcards Any?>

    @GET("loyalty/lookup/{code}")
    suspend fun lookupLoyalty(@Header("Authorization") auth: String, @Path("code") code: String): LoyaltyLookupDto

    @POST("loyalty/earn")
    suspend fun earnPoints(@Header("Authorization") auth: String, @Body body: LoyaltyEarnRequestDto): LoyaltyBalanceDto

    @POST("loyalty/redeem")
    suspend fun redeemReward(@Header("Authorization") auth: String, @Body body: LoyaltyRedeemRequestDto): LoyaltyBalanceDto

    @POST("loyalty/stamp/add")
    suspend fun addStamp(@Header("Authorization") auth: String, @Body body: LoyaltyStampRequestDto): LoyaltyBalanceDto

    @POST("loyalty/stamp/reset")
    suspend fun resetStamps(@Header("Authorization") auth: String, @Body body: LoyaltyStampRequestDto): LoyaltyBalanceDto
}