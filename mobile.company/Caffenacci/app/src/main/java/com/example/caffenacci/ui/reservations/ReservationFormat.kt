package com.example.caffenacci.ui.reservations

import com.example.caffenacci.data.remote.dto.ReservationDto
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

private val PL = Locale("pl", "PL")
private fun isoDate() = SimpleDateFormat("yyyy-MM-dd", Locale.US)

fun todayString(): String = isoDate().format(Date())

fun shiftDate(date: String, days: Int): String {
    val fmt = isoDate()
    val cal = Calendar.getInstance()
    cal.time = fmt.parse(date) ?: Date()
    cal.add(Calendar.DAY_OF_MONTH, days)
    return fmt.format(cal.time)
}

private fun fmtDate(date: String, pattern: String): String =
    try { SimpleDateFormat(pattern, PL).format(isoDate().parse(date)!!) } catch (_: Exception) { date }

fun formatDateShort(date: String) = fmtDate(date, "EEE, d MMM")
fun formatDateLong(date: String) = fmtDate(date, "EEEE, d MMMM yyyy").replaceFirstChar { it.uppercase() }
fun monthShort(date: String) = fmtDate(date, "MMM")
fun dayOfMonth(date: String) = date.takeLast(2)

fun guestsLabel(n: Int) = when {
    n == 1 -> "1 osoba"
    n in 2..4 -> "$n osoby"
    else -> "$n osób"
}

private fun parseUtc(createdAt: String): Long? = try {
    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        .apply { timeZone = TimeZone.getTimeZone("UTC") }
        .parse(createdAt.take(19))?.time
} catch (_: Exception) { null }

fun timeAgo(createdAt: String?): String {
    if (createdAt.isNullOrBlank()) return ""
    val t = parseUtc(createdAt) ?: return ""
    val diff = (System.currentTimeMillis() - t) / 1000
    return when {
        diff < 60 -> "przed chwilą"
        diff < 3600 -> "${diff / 60} min temu"
        diff < 86400 -> "${diff / 3600} godz. temu"
        else -> "${diff / 86400} dni temu"
    }
}

fun formatCreatedAt(createdAt: String?): String {
    if (createdAt.isNullOrBlank()) return ""
    val t = parseUtc(createdAt) ?: return ""
    return SimpleDateFormat("d MMM, HH:mm", PL).format(Date(t))
}

fun addMinutes(time: String, minutes: Int): String {
    val (h, m) = time.split(":").map { it.toInt() }
    val total = h * 60 + m + minutes
    return "%02d:%02d".format((total / 60) % 24, total % 60)
}

fun tableTypeLabel(type: String?): String = when (type?.substringAfterLast('.')) {
    "standard" -> "Zwykły stolik"
    "communal" -> "Stół komunalny"
    "special" -> "Stolik specjalny"
    else -> type.orEmpty()
}

fun tableDescription(r: ReservationDto): String {
    if (r.table_type == null) return ""
    val base = tableTypeLabel(r.table_type)
    return when {
        !r.table_label.isNullOrBlank() -> "$base – ${r.table_label}"
        r.table_seats != null -> "$base (${r.table_seats} os.)"
        else -> base
    }
}