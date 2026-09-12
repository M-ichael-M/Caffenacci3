package com.example.caffenacci.data.remote

import com.example.caffenacci.data.remote.dto.CafeListResponseDto
import retrofit2.http.GET

interface ApiService {
    @GET("cafes/all")
    suspend fun getAllCafes(): CafeListResponseDto
}