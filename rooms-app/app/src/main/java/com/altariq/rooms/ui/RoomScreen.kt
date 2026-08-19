package com.altariq.rooms.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.altariq.rooms.data.Room
import com.altariq.rooms.data.RoomStore
import com.altariq.rooms.util.AppLauncher
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun RoomScreen(
    store: RoomStore,
    room: Room,
    onBack: () -> Unit,
    onEdit: () -> Unit
) {
    val context = LocalContext.current
    val accent = roomColor(room.colorIndex)

    var vpnDone by rememberSaveable(room.id) { mutableStateOf(false) }
    var gpsDone by rememberSaveable(room.id) { mutableStateOf(false) }
    var tiktokDone by rememberSaveable(room.id) { mutableStateOf(false) }
    var showUploadDialog by rememberSaveable(room.id) { mutableStateOf(false) }

    val doneCount = listOf(vpnDone, gpsDone, tiktokDone).count { it }

    // Agla step kaun sa hai — usi card ka kinara roshan hota hai
    val activeStep = when {
        !vpnDone && room.vpnPkg.isNotBlank() -> 1
        !gpsDone && room.gpsPkg.isNotBlank() -> 2
        !tiktokDone -> 3
        else -> 0
    }

    AppBackground {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.systemBars),
            contentPadding = PaddingValues(bottom = 40.dp)
        ) {
            // ---------- Top bar ----------
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    GlassChip(onClick = onBack) {
                        Icon(
                            Icons.Filled.ArrowBack,
                            contentDescription = "Wapas",
                            tint = Palette.Ink,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                    Spacer(Modifier.weight(1f))
                    GlassChip(tint = accent, onClick = onEdit) {
                        Icon(
                            Icons.Filled.Edit,
                            contentDescription = "Room edit karein",
                            tint = accent,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }

            // ---------- Room hero ----------
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        modifier = Modifier
                            .size(82.dp)
                            .clip(CircleShape)
                            .background(
                                Brush.verticalGradient(
                                    0f to accent.copy(alpha = 0.34f),
                                    1f to accent.copy(alpha = 0.06f)
                                )
                            )
                            .border(
                                1.dp,
                                Brush.verticalGradient(
                                    0f to accent.copy(alpha = 0.6f),
                                    1f to Color.Transparent
                                ),
                                CircleShape
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(room.emoji, fontSize = 40.sp)
                    }
                    Spacer(Modifier.height(12.dp))
                    Text(
                        room.title,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        color = Palette.Ink
                    )
                    if (room.handle.isNotBlank()) {
                        Text(room.handle, fontSize = 14.sp, color = accent, fontWeight = FontWeight.Medium)
                    }

                    Spacer(Modifier.height(14.dp))

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        GlassChip(tint = if (doneCount == 3) accent else Color.White) {
                            Text(
                                if (doneCount == 3) "✅  Account ready hai"
                                else "Sequence  $doneCount / 3",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = if (doneCount == 3) accent else Palette.InkSoft
                            )
                        }
                        if (doneCount > 0) {
                            Spacer(Modifier.width(8.dp))
                            GlassChip(onClick = {
                                vpnDone = false; gpsDone = false; tiktokDone = false
                            }) {
                                Icon(
                                    Icons.Filled.Refresh,
                                    contentDescription = "Reset",
                                    tint = Palette.InkSoft,
                                    modifier = Modifier.size(14.dp)
                                )
                            }
                        }
                    }
                    Spacer(Modifier.height(18.dp))
                }
            }

            // ---------- Step 1 : VPN ----------
            item {
                StepCard(
                    number = 1,
                    title = "VPN chalayein",
                    appLabel = room.vpnLabel,
                    detail = room.vpnServer,
                    detailHint = "Server / country",
                    accent = accent,
                    done = vpnDone,
                    active = activeStep == 1,
                    notSetText = if (room.vpnPkg.isBlank()) "VPN app select nahi ki — Edit me jaakar chunein" else null,
                    copyText = room.vpnServer,
                    onOpen = {
                        if (AppLauncher.open(context, room.vpnPkg, room.vpnActivity)) {
                            vpnDone = true
                            store.markUsed(room.id)
                        }
                    },
                    onToggleDone = { vpnDone = !vpnDone }
                )
            }

            // ---------- Step 2 : Location ----------
            item {
                StepCard(
                    number = 2,
                    title = "Location set karein",
                    appLabel = room.gpsLabel,
                    detail = listOfNotNull(
                        room.city.takeIf { it.isNotBlank() },
                        room.coords.takeIf { it.isNotBlank() }
                    ).joinToString("  ·  "),
                    detailHint = "City / coordinates",
                    accent = accent,
                    done = gpsDone,
                    active = activeStep == 2,
                    notSetText = if (room.gpsPkg.isBlank()) "Fake GPS app select nahi ki — Edit me jaakar chunein" else null,
                    copyText = room.coords,
                    onOpen = {
                        // Coords pehle clipboard par — GPS app me seedha paste ho jayein
                        if (room.coords.isNotBlank()) {
                            AppLauncher.copy(context, room.coords, "Coords copy — GPS app me paste karein")
                        }
                        if (AppLauncher.open(context, room.gpsPkg, room.gpsActivity)) gpsDone = true
                    },
                    onToggleDone = { gpsDone = !gpsDone }
                )
            }

            // ---------- Step 3 : TikTok ----------
            item {
                StepCard(
                    number = 3,
                    title = "TikTok kholein",
                    appLabel = room.tiktokLabel,
                    detail = room.handle,
                    detailHint = "Is account par switch karein",
                    accent = accent,
                    done = tiktokDone,
                    active = activeStep == 3,
                    notSetText = if (room.tiktokPkg.isBlank()) "TikTok app select nahi ki — Edit me jaakar chunein" else null,
                    copyText = room.handle,
                    onOpen = {
                        if (AppLauncher.open(context, room.tiktokPkg, room.tiktokActivity)) {
                            tiktokDone = true
                            store.markUsed(room.id)
                        }
                    },
                    onToggleDone = { tiktokDone = !tiktokDone }
                )
            }

            // ---------- Notes ----------
            if (room.notes.isNotBlank()) {
                item {
                    GlassCard(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 6.dp)
                    ) {
                        Text(
                            "NOTES",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp,
                            color = Palette.InkFaint
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            room.notes,
                            fontSize = 14.sp,
                            color = Palette.Ink,
                            lineHeight = 21.sp
                        )
                    }
                }
            }

            // ---------- Upload log ----------
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 22.dp, end = 16.dp, top = 20.dp, bottom = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "Upload log",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Palette.Ink,
                        modifier = Modifier.weight(1f)
                    )
                    GlassChip(tint = accent, onClick = { showUploadDialog = true }) {
                        Icon(
                            Icons.Filled.Add,
                            contentDescription = "Add",
                            tint = accent,
                            modifier = Modifier.size(15.dp)
                        )
                        Spacer(Modifier.width(4.dp))
                        Text("Add", fontSize = 12.sp, color = accent, fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            if (room.uploads.isEmpty()) {
                item {
                    Text(
                        "Abhi tak koi upload dartaj nahi. Video post karne ke baad yahan likh dein — " +
                            "phir yaad rehta hai kis account par kya gaya.",
                        fontSize = 13.sp,
                        color = Palette.InkSoft,
                        lineHeight = 20.sp,
                        modifier = Modifier.padding(horizontal = 22.dp, vertical = 4.dp)
                    )
                }
            } else {
                items(room.uploads.size) { i ->
                    val log = room.uploads[i]
                    GlassCard(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 4.dp),
                        corner = 14.dp,
                        padding = 12.dp
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(
                                    log.title,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Medium,
                                    color = Palette.Ink
                                )
                                Text(
                                    formatDate(log.date) + if (log.note.isNotBlank()) "  ·  ${log.note}" else "",
                                    fontSize = 11.sp,
                                    color = Palette.InkFaint
                                )
                            }
                            GlassChip(onClick = { store.deleteUpload(room.id, log.id) }) {
                                Icon(
                                    Icons.Filled.Delete,
                                    contentDescription = "Delete",
                                    tint = Palette.InkSoft,
                                    modifier = Modifier.size(15.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    if (showUploadDialog) {
        UploadDialog(
            onDismiss = { showUploadDialog = false },
            onSave = { title, note ->
                store.addUpload(room.id, title, note)
                showUploadDialog = false
            }
        )
    }
}

/** Ek step ka glass card — number orb, setting, aur 3D "Kholein" button. */
@Composable
private fun StepCard(
    number: Int,
    title: String,
    appLabel: String,
    detail: String,
    detailHint: String,
    accent: Color,
    done: Boolean,
    active: Boolean,
    notSetText: String?,
    copyText: String,
    onOpen: () -> Unit,
    onToggleDone: () -> Unit
) {
    val context = LocalContext.current

    GlassCard(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp),
        tint = if (active || done) accent else null
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            // Number orb — tap karke manually tick bhi kar sakte hain
            Box(
                modifier = Modifier
                    .size(38.dp)
                    .clip(CircleShape)
                    .background(
                        Brush.verticalGradient(
                            0f to accent.copy(alpha = if (done) 0.85f else 0.28f),
                            1f to accent.copy(alpha = if (done) 0.55f else 0.08f)
                        )
                    )
                    .border(
                        1.dp,
                        Brush.verticalGradient(
                            0f to accent.copy(alpha = 0.7f),
                            1f to Color.Transparent
                        ),
                        CircleShape
                    )
                    .clickable(onClick = onToggleDone),
                contentAlignment = Alignment.Center
            ) {
                if (done) {
                    Icon(
                        Icons.Filled.Check,
                        contentDescription = "Ho gaya",
                        tint = Color.Black.copy(alpha = 0.8f),
                        modifier = Modifier.size(20.dp)
                    )
                } else {
                    Text("$number", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = accent)
                }
            }

            Spacer(Modifier.width(13.dp))

            Column(Modifier.weight(1f)) {
                Text(title, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Palette.Ink)
                if (appLabel.isNotBlank()) {
                    Text(appLabel, fontSize = 12.sp, color = Palette.InkSoft)
                }
            }
        }

        if (detail.isNotBlank()) {
            Spacer(Modifier.height(12.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(13.dp))
                    .background(Color.Black.copy(alpha = 0.22f))
                    .border(1.dp, Palette.GlassEdgeLow, RoundedCornerShape(13.dp))
                    .padding(start = 12.dp, end = 6.dp, top = 9.dp, bottom = 9.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(Modifier.weight(1f)) {
                    Text(detailHint, fontSize = 10.sp, color = Palette.InkFaint)
                    Text(
                        detail,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        color = Palette.Ink
                    )
                }
                if (copyText.isNotBlank()) {
                    GlassChip(tint = accent, onClick = { AppLauncher.copy(context, copyText) }) {
                        Icon(
                            Icons.Filled.ContentCopy,
                            contentDescription = "Copy",
                            tint = accent,
                            modifier = Modifier.size(15.dp)
                        )
                    }
                }
            }
        }

        if (notSetText != null) {
            Spacer(Modifier.height(10.dp))
            Text(notSetText, fontSize = 12.sp, color = Palette.Danger.copy(alpha = 0.9f))
        } else {
            Spacer(Modifier.height(13.dp))
            Glass3DButton(
                text = if (appLabel.isNotBlank()) "$appLabel kholein" else "Kholein",
                onClick = onOpen,
                tint = accent,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
private fun UploadDialog(onDismiss: () -> Unit, onSave: (String, String) -> Unit) {
    var title by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF141924),
        titleContentColor = Palette.Ink,
        textContentColor = Palette.InkSoft,
        title = { Text("Upload dartaj karein", fontWeight = FontWeight.Bold) },
        text = {
            Column {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Video ka naam / topic") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(
                    value = note,
                    onValueChange = { note = it },
                    label = { Text("Note (optional)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { if (title.isNotBlank()) onSave(title.trim(), note.trim()) },
                enabled = title.isNotBlank()
            ) { Text("Save", color = RoomColors[0]) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = Palette.InkSoft) }
        }
    )
}

private fun formatDate(ts: Long): String =
    SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.getDefault()).format(Date(ts))
