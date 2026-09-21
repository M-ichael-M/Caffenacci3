package com.example.caffenacci.data.local

import android.content.Context
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.employeeDataStore by preferencesDataStore(name = "caffenacci_employee_session")

data class EmployeeSession(
    val token: String,
    val employeeId: String,
    val fullName: String,
    val role: String,
    val cafeId: String,
    val cafeName: String,
)

class EmployeeSessionPreferences(private val context: Context) {
    companion object {
        private val TOKEN = stringPreferencesKey("token")
        private val EMPLOYEE_ID = stringPreferencesKey("employee_id")
        private val FULL_NAME = stringPreferencesKey("full_name")
        private val ROLE = stringPreferencesKey("role")
        private val CAFE_ID = stringPreferencesKey("cafe_id")
        private val CAFE_NAME = stringPreferencesKey("cafe_name")
    }

    val sessionFlow: Flow<EmployeeSession?> = context.employeeDataStore.data.map { p ->
        val token = p[TOKEN] ?: return@map null
        EmployeeSession(
            token = token,
            employeeId = p[EMPLOYEE_ID] ?: "",
            fullName = p[FULL_NAME] ?: "",
            role = p[ROLE] ?: "",
            cafeId = p[CAFE_ID] ?: "",
            cafeName = p[CAFE_NAME] ?: "",
        )
    }

    suspend fun save(session: EmployeeLoginResult) {
        context.employeeDataStore.edit { p ->
            p[TOKEN] = session.token
            p[EMPLOYEE_ID] = session.employeeId
            p[FULL_NAME] = session.fullName
            p[ROLE] = session.role
            p[CAFE_ID] = session.cafeId
            p[CAFE_NAME] = session.cafeName
        }
    }

    suspend fun clear() {
        context.employeeDataStore.edit { it.clear() }
    }
}

data class EmployeeLoginResult(
    val token: String,
    val employeeId: String,
    val fullName: String,
    val role: String,
    val cafeId: String,
    val cafeName: String,
)