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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.altariq.rooms.data.Room
import com.altariq.rooms.data.RoomStore

private val EMOJIS = listOf("🎬", "🎭", "🎤", "🔥", "⭐", "🎧", "📸", "🍔", "⚽", "💄", "🐱", "🚗", "💃", "🎮")

@Composable
fun EditScreen(
    store: RoomStore,
    room: Room,
    onDone: () -> Unit,
    onDeleted: () -> Unit
) {
    // Local copy — Save dabane par hi store me jata hai
    var draft by remember(room.id) { mutableStateOf(room) }
    var picker by remember { mutableStateOf<String?>(null) } // "vpn" | "gps" | "tiktok"
    var confirmDelete by remember { mutableStateOf(false) }

    val accent = roomColor(draft.colorIndex)

    AppBackground {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.systemBars),
            contentPadding = PaddingValues(bottom = 40.dp)
        ) {
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 4.dp, end = 4.dp, top = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = onDone) {
                        Icon(
                            Icons.Filled.ArrowBack,
                            contentDescription = "Wapas",
                            tint = MaterialTheme.colorScheme.onSurface
                        )
                    }
                    Text(
                        "Room ki setting",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onBackground,
                        modifier = Modifier.weight(1f)
                    )
                    IconButton(onClick = { confirmDelete = true }) {
                        Icon(
                            Icons.Filled.Delete,
                            contentDescription = "Room delete",
                            tint = MaterialTheme.colorScheme.error
                        )
                    }
                }
            }

            // ---- Pehchan: emoji + rang ----
            item {
                SectionCard(title = "Pehchan") {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(EMOJIS.size) { i ->
                            val e = EMOJIS[i]
                            val selected = draft.emoji == e
                            Box(
                                modifier = Modifier
                                    .size(44.dp)
                                    .clip(CircleShape)
                                    .background(
                                        if (selected) accent.copy(alpha = 0.2f)
                                        else MaterialTheme.colorScheme.surfaceVariant
                                    )
                                    .then(
                                        if (selected) Modifier.border(1.5.dp, accent, CircleShape)
                                        else Modifier
                                    )
                                    .clickable { draft = draft.copy(emoji = e) },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(e, fontSize = 22.sp)
                            }
                        }
                    }

                    Spacer(Modifier.height(14.dp))

                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        RoomColors.forEachIndexed { i, c ->
                            val selected = draft.colorIndex == i
                            Box(
                                modifier = Modifier
                                    .size(34.dp)
                                    .clip(CircleShape)
                                    .background(c)
                                    .then(
                                        if (selected)
                                            Modifier.border(3.dp, MaterialTheme.colorScheme.onBackground, CircleShape)
                                        else Modifier
                                    )
                                    .clickable { draft = draft.copy(colorIndex = i) }
                            )
                        }
                    }

                    Spacer(Modifier.height(14.dp))

                    OutlinedTextField(
                        value = draft.name,
                        onValueChange = { draft = draft.copy(name = it) },
                        label = { Text("Room ka naam (misal: Comedy account)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(Modifier.height(10.dp))
                    OutlinedTextField(
                        value = draft.handle,
                        onValueChange = { draft = draft.copy(handle = it) },
                        label = { Text("TikTok username (@...)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            // ---- Step 1: VPN ----
            item {
                SectionCard(title = "1 · VPN") {
                    AppRow(
                        label = "VPN app",
                        selected = draft.vpnLabel,
                        accent = accent,
                        onClick = { picker = "vpn" }
                    )
                    Spacer(Modifier.height(10.dp))
                    OutlinedTextField(
                        value = draft.vpnServer,
                        onValueChange = { draft = draft.copy(vpnServer = it) },
                        label = { Text("Kaunsa server / country") },
                        placeholder = { Text("misal: Dubai — UAE server 3") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            // ---- Step 2: Fake GPS ----
            item {
                SectionCard(title = "2 · Location") {
                    AppRow(
                        label = "Fake GPS app",
                        selected = draft.gpsLabel,
                        accent = accent,
                        onClick = { picker = "gps" }
                    )
                    Spacer(Modifier.height(10.dp))
                    OutlinedTextField(
                        value = draft.city,
                        onValueChange = { draft = draft.copy(city = it) },
                        label = { Text("City ka naam") },
                        placeholder = { Text("misal: Dubai") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedTextField(
                            value = draft.lat,
                            onValueChange = { draft = draft.copy(lat = it) },
                            label = { Text("Latitude") },
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = draft.lng,
                            onValueChange = { draft = draft.copy(lng = it) },
                            label = { Text("Longitude") },
                            singleLine = true,
                            modifier = Modifier.weight(1f)
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "Coordinates Google Maps se le sakte hain — jagah par der tak dabayein, " +
                            "number copy ho jate hain. Room me \"Kholein\" dabate hi ye khud clipboard par aa jayenge.",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        lineHeight = 17.sp
                    )
                }
            }

            // ---- Step 3: TikTok ----
            item {
                SectionCard(title = "3 · TikTok") {
                    AppRow(
                        label = "TikTok app",
                        selected = draft.tiktokLabel,
                        accent = accent,
                        onClick = { picker = "tiktok" }
                    )
                }
            }

            // ---- Notes ----
            item {
                SectionCard(title = "Notes") {
                    OutlinedTextField(
                        value = draft.notes,
                        onValueChange = { draft = draft.copy(notes = it) },
                        label = { Text("Is account ke bare me kuch bhi") },
                        placeholder = { Text("niche, posting time, hashtags...") },
                        minLines = 3,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            // ---- Save ----
            item {
                Glass3DButton(
                    text = "Save karein",
                    onClick = {
                        store.update(draft)
                        onDone()
                    },
                    tint = accent,
                    height = 56.dp,
                    fontSize = 16.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                )
            }
        }
    }

    // ---- App picker ----
    picker?.let { which ->
        AppPickerDialog(
            title = when (which) {
                "vpn" -> "VPN app chunein"
                "gps" -> "Fake GPS app chunein"
                else -> "TikTok app chunein"
            },
            onDismiss = { picker = null },
            onPick = { app ->
                draft = when (which) {
                    "vpn" -> draft.copy(
                        vpnPkg = app.pkg, vpnActivity = app.activity, vpnLabel = app.label
                    )
                    "gps" -> draft.copy(
                        gpsPkg = app.pkg, gpsActivity = app.activity, gpsLabel = app.label
                    )
                    else -> draft.copy(
                        tiktokPkg = app.pkg, tiktokActivity = app.activity, tiktokLabel = app.label
                    )
                }
                picker = null
            }
        )
    }

    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Room delete karein?") },
            text = { Text("\"${draft.title}\" aur uska upload log mit jayega. Ye wapas nahi aayega.") },
            confirmButton = {
                TextButton(onClick = {
                    store.delete(room.id)
                    confirmDelete = false
                    onDeleted()
                }) {
                    Text("Delete", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmDelete = false }) { Text("Cancel") }
            }
        )
    }
}

@Composable
private fun SectionCard(title: String, content: @Composable () -> Unit) {
    GlassCard(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp)
    ) {
        Text(
            title.uppercase(),
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp,
            color = Palette.InkFaint
        )
        Spacer(Modifier.height(14.dp))
        content()
    }
}

/** App chunne wali row — tap karne par picker khulta hai. */
@Composable
private fun AppRow(
    label: String,
    selected: String,
    accent: androidx.compose.ui.graphics.Color,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(13.dp))
            .background(androidx.compose.ui.graphics.Color.Black.copy(alpha = 0.22f))
            .border(1.dp, Palette.GlassEdgeLow, RoundedCornerShape(13.dp))
            .clickable(onClick = onClick)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(Modifier.weight(1f)) {
            Text(label, fontSize = 11.sp, color = Palette.InkFaint)
            Text(
                selected.ifBlank { "Chunein..." },
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                color = if (selected.isBlank()) Palette.InkSoft else Palette.Ink
            )
        }
        Text(
            if (selected.isBlank()) "Select" else "Badlein",
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = accent
        )
    }
}
