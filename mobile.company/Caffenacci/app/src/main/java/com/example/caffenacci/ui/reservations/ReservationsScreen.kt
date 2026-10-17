package com.example.caffenacci.ui.reservations

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.caffenacci.data.remote.ApiService
import com.example.caffenacci.data.remote.dto.CafeTableDto
import com.example.caffenacci.data.remote.dto.ReservationCreateDto
import com.example.caffenacci.data.remote.dto.ReservationDto
import com.example.caffenacci.data.remote.dto.ReservationSettingsDto

@Composable
fun ReservationsScreen(api: ApiService, auth: String, modifier: Modifier = Modifier, viewModel: ReservationsViewModel = viewModel()) {
    val state by viewModel.uiState.collectAsState()
    var tab by remember { mutableStateOf(0) }
    var deciding by remember { mutableStateOf<Pair<ReservationDto, String>?>(null) }
    var deleting by remember { mutableStateOf<ReservationDto?>(null) }
    var adding by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { viewModel.load(api, auth) }

    val settings = state.settings

    Column(
        modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp, vertical = 16.dp),
    ) {
        Row(
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Rezerwacje", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
            FilledTonalIconButton(onClick = { viewModel.load(api, auth) }) {
                Icon(Icons.Filled.Refresh, contentDescription = "Odśwież")
            }
        }

        state.error?.let {
            Spacer(Modifier.height(8.dp))
            Surface(color = MaterialTheme.colorScheme.errorContainer, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth()) {
                Text(it, color = MaterialTheme.colorScheme.onErrorContainer, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(12.dp))
            }
        }
        Spacer(Modifier.height(12.dp))

        when {
            state.loading && settings == null -> Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            settings == null -> EmptyHint("Nie udało się wczytać ustawień rezerwacji.")
            !settings.enabled -> EmptyHint("System rezerwacji jest wyłączony. Właściciel może go włączyć w panelu kawiarni.")
            settings.mode == "advanced" -> AdvancedContent(
                state = state,
                settings = settings,
                onPrev = { viewModel.shiftDay(api, auth, -1) },
                onNext = { viewModel.shiftDay(api, auth, 1) },
                onToday = { viewModel.selectDate(api, auth, todayString()) },
                onAdd = { adding = true },
                onDelete = { deleting = it },
                modifier = Modifier.weight(1f),
            )
            else -> SimpleContent(
                state = state,
                tab = tab,
                onTab = { tab = it },
                onDecide = { r, action -> deciding = r to action },
                onDelete = { deleting = it },
                modifier = Modifier.weight(1f),
            )
        }
    }

    deciding?.let { (r, action) ->
        DecideDialog(
            r = r, action = action,
            onDismiss = { deciding = null },
            onConfirm = { note, done ->
                viewModel.decide(api, auth, r, action, note) { err ->
                    if (err == null) deciding = null
                    done(err)
                }
            },
        )
    }

    deleting?.let { r ->
        AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("Usunąć rezerwację?") },
            text = { Text("${r.guest_name} · ${formatDateShort(r.date)} o ${r.start_time}") },
            confirmButton = {
                Button(
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                    onClick = { viewModel.delete(api, auth, r.id); deleting = null },
                ) { Text("Usuń") }
            },
            dismissButton = { TextButton(onClick = { deleting = null }) { Text("Anuluj") } },
        )
    }

    if (adding && settings != null) {
        AddReservationDialog(
            settings = settings,
            date = state.selectedDate,
            onDismiss = { adding = false },
            onSubmit = { dto, done ->
                viewModel.create(api, auth, dto) { err ->
                    if (err == null) adding = false
                    done(err)
                }
            },
        )
    }
}

// ═════════════════════════════════════════════════════════════════════════
// TRYB PROSTY
// ═════════════════════════════════════════════════════════════════════════

@Composable
private fun SimpleContent(
    state: ReservationsUiState,
    tab: Int,
    onTab: (Int) -> Unit,
    onDecide: (ReservationDto, String) -> Unit,
    onDelete: (ReservationDto) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier) {
        TabRow(selectedTabIndex = tab, containerColor = MaterialTheme.colorScheme.surface, contentColor = MaterialTheme.colorScheme.primary) {
            Tab(selected = tab == 0, onClick = { onTab(0) }, text = { Text("Oczekujące (${state.pending.size})") })
            Tab(selected = tab == 1, onClick = { onTab(1) }, text = { Text("Historia (${state.history.size})") })
        }
        Spacer(Modifier.height(12.dp))

        if (state.loading) {
            Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            return@Column
        }

        if (tab == 0) {
            if (state.pending.isEmpty()) {
                EmptyHint("Brak nowych rezerwacji. Gdy klient złoży rezerwację, pojawi się tutaj do zatwierdzenia.")
            } else {
                Text(
                    if (state.pending.size == 1) "1 rezerwacja czeka na Twoją decyzję"
                    else "${state.pending.size} rezerwacji czeka na Twoją decyzję",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(8.dp))
                LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), contentPadding = PaddingValues(bottom = 16.dp)) {
                    items(state.pending, key = { it.id }) { r ->
                        PendingCard(r, onDecide = { action -> onDecide(r, action) })
                    }
                }
            }
        } else {
            if (state.history.isEmpty()) {
                EmptyHint("Brak historii rezerwacji. Tu pojawią się zaakceptowane i odrzucone rezerwacje.")
            } else {
                Text(
                    "${state.history.count { it.status == "confirmed" }} zaakceptowanych · ${state.history.count { it.status == "cancelled" }} odrzuconych",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(8.dp))
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(bottom = 16.dp)) {
                    items(state.history, key = { it.id }) { r -> HistoryCard(r, onDelete = { onDelete(r) }) }
                }
            }
        }
    }
}

@Composable
private fun PendingCard(r: ReservationDto, onDecide: (String) -> Unit) {
    ElevatedCard(shape = RoundedCornerShape(20.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                DateBlock(r.date)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(r.guest_name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(4.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Pill(r.start_time, MaterialTheme.colorScheme.primaryContainer, MaterialTheme.colorScheme.onPrimaryContainer)
                        Pill(guestsLabel(r.guests), MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    contactLine(r)?.let {
                        Spacer(Modifier.height(6.dp))
                        Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    r.comment?.takeIf { it.isNotBlank() }?.let {
                        Spacer(Modifier.height(6.dp))
                        Text("„$it”", style = MaterialTheme.typography.bodySmall, fontStyle = FontStyle.Italic)
                    }
                    Spacer(Modifier.height(6.dp))
                    Text("Złożono: ${timeAgo(r.created_at)}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Row(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.End) {
                OutlinedButton(shape = RoundedCornerShape(14.dp), onClick = { onDecide("cancelled") }) { Text("Odrzuć") }
                Spacer(Modifier.width(8.dp))
                Button(shape = RoundedCornerShape(14.dp), onClick = { onDecide("confirmed") }) {
                    Icon(Icons.Filled.Check, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Akceptuj")
                }
            }
        }
    }
}

@Composable
private fun HistoryCard(r: ReservationDto, onDelete: () -> Unit) {
    val confirmed = r.status == "confirmed"
    val color = if (confirmed) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.error
    ElevatedCard(shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(start = 14.dp, top = 10.dp, bottom = 10.dp, end = 4.dp), verticalAlignment = Alignment.Top) {
            Icon(if (confirmed) Icons.Filled.CheckCircle else Icons.Filled.Cancel, contentDescription = null, tint = color, modifier = Modifier.padding(top = 2.dp))
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(r.guest_name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Text(
                    "${formatDateShort(r.date)} o ${r.start_time} · ${guestsLabel(r.guests)}",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                contactLine(r)?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                r.comment?.takeIf { it.isNotBlank() }?.let {
                    Text("Komentarz gościa: „$it”", style = MaterialTheme.typography.bodySmall, fontStyle = FontStyle.Italic)
                }
                r.owner_note?.takeIf { it.isNotBlank() }?.let {
                    Text("Wiadomość do klienta: „$it”", style = MaterialTheme.typography.bodySmall, fontStyle = FontStyle.Italic, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text(formatCreatedAt(r.created_at), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            IconButton(onClick = onDelete) {
                Icon(Icons.Filled.Delete, contentDescription = "Usuń z historii", tint = MaterialTheme.colorScheme.error)
            }
        }
    }
}

@Composable
private fun DecideDialog(
    r: ReservationDto,
    action: String,
    onDismiss: () -> Unit,
    onConfirm: (note: String, done: (String?) -> Unit) -> Unit,
) {
    val isConfirm = action == "confirmed"
    var note by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text(if (isConfirm) "Akceptacja rezerwacji" else "Odrzucenie rezerwacji") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                Text(r.guest_name, fontWeight = FontWeight.SemiBold)
                Text(
                    "${formatDateShort(r.date)} o ${r.start_time} · ${guestsLabel(r.guests)}",
                    style = MaterialTheme.typography.bodyMedium,
                )
                contactLine(r)?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                r.comment?.takeIf { it.isNotBlank() }?.let {
                    Text("„$it”", style = MaterialTheme.typography.bodySmall, fontStyle = FontStyle.Italic)
                }
                Spacer(Modifier.height(14.dp))
                OutlinedTextField(
                    value = note,
                    onValueChange = { if (it.length <= 500) note = it },
                    label = { Text(if (isConfirm) "Wiadomość dla klienta (opcjonalnie)" else "Powód odrzucenia (opcjonalnie)") },
                    placeholder = {
                        Text(if (isConfirm) "np. Widzimy się w czwartek!" else "np. Wybrany termin jest już zajęty.")
                    },
                    supportingText = { Text("${note.length}/500", modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.End) },
                    minLines = 3,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth(),
                )
                error?.let {
                    Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = {
            Button(
                enabled = !busy,
                colors = if (isConfirm) ButtonDefaults.buttonColors()
                else ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                onClick = {
                    busy = true; error = null
                    onConfirm(note) { err -> busy = false; error = err }
                },
            ) { Text(if (busy) "Zapisywanie…" else if (isConfirm) "Akceptuj rezerwację" else "Odrzuć rezerwację") }
        },
        dismissButton = { TextButton(enabled = !busy, onClick = onDismiss) { Text("Anuluj") } },
    )
}

// ═════════════════════════════════════════════════════════════════════════
// TRYB ZAAWANSOWANY
// ═════════════════════════════════════════════════════════════════════════

@Composable
private fun AdvancedContent(
    state: ReservationsUiState,
    settings: ReservationSettingsDto,
    onPrev: () -> Unit,
    onNext: () -> Unit,
    onToday: () -> Unit,
    onAdd: () -> Unit,
    onDelete: (ReservationDto) -> Unit,
    modifier: Modifier = Modifier,
) {
    val confirmed = state.dayReservations.filter { it.status == "confirmed" }
    val cancelled = state.dayReservations.filter { it.status == "cancelled" }

    Column(modifier) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            IconButton(onClick = onPrev) { Icon(Icons.Filled.ChevronLeft, contentDescription = "Poprzedni dzień") }
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(formatDateLong(state.selectedDate), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
                if (state.selectedDate != todayString()) {
                    TextButton(onClick = onToday, contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp)) { Text("Wróć do dziś") }
                }
            }
            IconButton(onClick = onNext) { Icon(Icons.Filled.ChevronRight, contentDescription = "Następny dzień") }
        }
        Spacer(Modifier.height(8.dp))
        Button(onClick = onAdd, shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
            Text("Dodaj rezerwację")
        }
        Spacer(Modifier.height(12.dp))

        if (state.loading || state.loadingDay) {
            Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            return@Column
        }

        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp), contentPadding = PaddingValues(bottom = 16.dp)) {
            item {
                Text(
                    "Rezerwacje na ten dzień (${confirmed.size})",
                    style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary,
                )
            }
            if (confirmed.isEmpty()) {
                item { Text("Brak rezerwacji na ten dzień.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            } else {
                items(confirmed, key = { it.id }) { r ->
                    AdvancedRow(r, settings.slot_duration_minutes, cancelled = false, onDelete = { onDelete(r) })
                }
            }
            if (cancelled.isNotEmpty()) {
                item {
                    Text(
                        "Anulowane (${cancelled.size})",
                        style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(top = 12.dp),
                    )
                }
                items(cancelled, key = { it.id }) { r ->
                    AdvancedRow(r, settings.slot_duration_minutes, cancelled = true, onDelete = {})
                }
            }
        }
    }
}

@Composable
private fun AdvancedRow(r: ReservationDto, slotMinutes: Int, cancelled: Boolean, onDelete: () -> Unit) {
    ElevatedCard(shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(start = 14.dp, top = 12.dp, bottom = 12.dp, end = 6.dp), verticalAlignment = Alignment.Top) {
            Column(Modifier.width(64.dp)) {
                Text(r.start_time, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                Text("–${addMinutes(r.start_time, slotMinutes)}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Column(Modifier.weight(1f)) {
                Text(r.guest_name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Text(
                    guestsLabel(r.guests) + tableDescription(r).let { if (it.isNotEmpty()) " · $it" else "" },
                    style = MaterialTheme.typography.bodySmall,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 4.dp)) {
                    if (r.created_by_owner) Pill("telefon", MaterialTheme.colorScheme.secondaryContainer, MaterialTheme.colorScheme.onSecondaryContainer)
                    if (r.client_id != null) Pill("portal", MaterialTheme.colorScheme.primaryContainer, MaterialTheme.colorScheme.onPrimaryContainer)
                    if (cancelled) Pill(
                        if (r.cancelled_by == "client") "anulowana przez klienta" else "anulowana",
                        MaterialTheme.colorScheme.errorContainer, MaterialTheme.colorScheme.onErrorContainer,
                    )
                }
                contactLine(r)?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp))
                }
                r.comment?.takeIf { it.isNotBlank() }?.let {
                    Text("„$it”", style = MaterialTheme.typography.bodySmall, fontStyle = FontStyle.Italic)
                }
            }
            if (!cancelled) {
                IconButton(onClick = onDelete) {
                    Icon(Icons.Filled.Delete, contentDescription = "Usuń rezerwację", tint = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}

@Composable
private fun AddReservationDialog(
    settings: ReservationSettingsDto,
    date: String,
    onDismiss: () -> Unit,
    onSubmit: (ReservationCreateDto, done: (String?) -> Unit) -> Unit,
) {
    var tableId by remember { mutableStateOf(settings.tables.firstOrNull()?.id ?: "") }
    var menuOpen by remember { mutableStateOf(false) }
    var time by remember { mutableStateOf("12:00") }
    var guests by remember { mutableStateOf("2") }
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var comment by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    val table = settings.tables.find { it.id == tableId }
    val field = Modifier.fillMaxWidth()

    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text("Nowa rezerwacja (${formatDateShort(date)})") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Box {
                    OutlinedButton(onClick = { menuOpen = true }, shape = RoundedCornerShape(16.dp), modifier = field) {
                        Text(table?.let { tableLabelFor(it) } ?: "Wybierz stolik")
                    }
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        settings.tables.forEach { t ->
                            DropdownMenuItem(text = { Text(tableLabelFor(t)) }, onClick = { tableId = t.id; menuOpen = false })
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = time, onValueChange = { time = it.take(5) },
                        label = { Text("Godzina (HH:MM)") }, singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        shape = RoundedCornerShape(16.dp), modifier = Modifier.weight(1f),
                    )
                    OutlinedTextField(
                        value = guests, onValueChange = { guests = it.filter(Char::isDigit).take(2) },
                        label = { Text(if (table != null) "Goście (maks. ${table.seats})" else "Goście") }, singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        shape = RoundedCornerShape(16.dp), modifier = Modifier.weight(1f),
                    )
                }
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Imię i nazwisko gościa *") }, singleLine = true, shape = RoundedCornerShape(16.dp), modifier = field)
                OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Telefon") }, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone), shape = RoundedCornerShape(16.dp), modifier = field)
                OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("E-mail") }, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), shape = RoundedCornerShape(16.dp), modifier = field)
                OutlinedTextField(value = comment, onValueChange = { comment = it }, label = { Text("Komentarz") },
                    placeholder = { Text("np. urodziny, alergia…") }, shape = RoundedCornerShape(16.dp), modifier = field)
                error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
            }
        },
        confirmButton = {
            Button(
                enabled = !busy,
                onClick = {
                    val g = guests.toIntOrNull()
                    error = when {
                        name.isBlank() -> "Podaj imię i nazwisko gościa."
                        table == null -> "Wybierz stolik."
                        !Regex("^\\d{2}:\\d{2}$").matches(time) -> "Podaj godzinę w formacie HH:MM."
                        g == null || g < 1 -> "Podaj liczbę gości."
                        g > table.seats -> "Stolik ma tylko ${table.seats} miejsc."
                        else -> null
                    }
                    if (error == null && table != null && g != null) {
                        busy = true
                        onSubmit(
                            ReservationCreateDto(
                                table_id = table.id, date = date, start_time = time, guests = g,
                                guest_name = name.trim(),
                                guest_phone = phone.trim().ifBlank { null },
                                guest_email = email.trim().ifBlank { null },
                                comment = comment.trim().ifBlank { null },
                            ),
                        ) { err -> busy = false; error = err }
                    }
                },
            ) { Text(if (busy) "Zapisywanie…" else "Zapisz rezerwację") }
        },
        dismissButton = { TextButton(enabled = !busy, onClick = onDismiss) { Text("Anuluj") } },
    )
}

private fun tableLabelFor(t: CafeTableDto): String =
    "${tableTypeLabel(t.table_type)} · ${t.seats} os." + (t.label?.takeIf { it.isNotBlank() }?.let { " ($it)" } ?: "")

// ═════════════════════════════════════════════════════════════════════════
// WSPÓLNE
// ═════════════════════════════════════════════════════════════════════════

private fun contactLine(r: ReservationDto): String? =
    listOfNotNull(r.guest_phone?.takeIf { it.isNotBlank() }, r.guest_email?.takeIf { it.isNotBlank() })
        .joinToString(" · ")
        .ifEmpty { null }

@Composable
private fun DateBlock(date: String) {
    Surface(color = MaterialTheme.colorScheme.inverseSurface, shape = RoundedCornerShape(12.dp)) {
        Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(dayOfMonth(date), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.inversePrimary)
            Text(monthShort(date).uppercase(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.inverseOnSurface.copy(alpha = 0.7f))
        }
    }
}

@Composable
private fun Pill(text: String, container: Color, content: Color) {
    Surface(color = container, shape = RoundedCornerShape(100)) {
        Text(text, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold, color = content, modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp))
    }
}

@Composable
private fun EmptyHint(text: String) {
    Box(Modifier.fillMaxWidth().padding(top = 40.dp, start = 12.dp, end = 12.dp), contentAlignment = Alignment.Center) {
        Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center)
    }
}