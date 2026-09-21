package com.example.caffenacci.data.repository

import com.example.caffenacci.data.local.EmployeeLoginResult
import com.example.caffenacci.data.local.EmployeeSession
import com.example.caffenacci.data.local.EmployeeSessionPreferences
import com.example.caffenacci.data.remote.ApiService
import com.example.caffenacci.data.remote.dto.EmployeeLoginRequestDto
import com.example.caffenacci.data.remote.dto.EmployeeVerifyResponseDto

class EmployeeRepository(private val prefs: EmployeeSessionPreferences) {

    val sessionFlow = prefs.sessionFlow

    suspend fun login(api: ApiService, cafeCode: String, employeeCode: String): EmployeeSession {
        val res = api.employeeLogin(EmployeeLoginRequestDto(cafeCode.uppercase(), employeeCode.uppercase()))
        val result = EmployeeLoginResult(
            token = res.access_token,
            employeeId = res.employee_id,
            fullName = res.full_name,
            role = res.role,
            cafeId = res.cafe_id,
            cafeName = res.cafe_name,
        )
        prefs.save(result)
        return EmployeeSession(result.token, result.employeeId, result.fullName, result.role, result.cafeId, result.cafeName)
    }

    suspend fun verify(api: ApiService, token: String): EmployeeVerifyResponseDto =
        api.employeeVerify("Bearer $token")

    suspend fun logout() = prefs.clear()

    fun bearer(token: String) = "Bearer $token"
}