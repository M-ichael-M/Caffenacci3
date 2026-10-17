package com.example.caffenacci.data.remote

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import retrofit2.HttpException

/** Zwraca polski komunikat z pola "detail" odpowiedzi FastAPI (jeśli jest). */
fun apiErrorMessage(e: Throwable, fallback: String): String {
    if (e is HttpException) {
        try {
            val body = e.response()?.errorBody()?.string()
            if (!body.isNullOrBlank()) {
                val detail = Json.parseToJsonElement(body).jsonObject["detail"]
                if (detail is JsonPrimitive && detail.isString) return detail.content
            }
        } catch (_: Exception) { /* ignore */ }
        return fallback
    }
    return e.message ?: fallback
}