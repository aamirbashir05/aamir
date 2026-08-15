package com.altariq.rooms.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.altariq.rooms.data.Room
import com.altariq.rooms.data.RoomStore

@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
fun HomeScreen(
    store: RoomStore,
    onOpenRoom: (String) -> Unit,
    onCreateRoom: () -> Unit,
    onSecretUnlock: () -> Unit
) {
    var showBackup by remember { mutableStateOf(false) }
    val rooms = store.rooms

    AppBackground {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.systemBars)
        ) {
            // ---------- Header ----------
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 22.dp, end = 16.dp, top = 20.dp, bottom = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(Modifier.weight(1f)) {
                    Text(
                        "Account Rooms",
                        fontSize = 27.sp,
                        fontWeight = FontWeight.Bold,
                        color = Palette.Ink
                    )
                    Text(
                        if (rooms.isEmpty()) "Har account ka apna room"
                        else "${rooms.size} room" + if (rooms.size > 1) "s" else "",
                        fontSize = 13.sp,
                        color = Palette.InkSoft
                    )
                }
                GlassChip(onClick = { showBackup = true }) {
                    Icon(
                        Icons.Filled.Settings,
                        contentDescription = "Backup",
                        tint = Palette.InkSoft,
                        modifier = Modifier.size(19.dp)
                    )
                }
            }

            Box(Modifier.weight(1f)) {
                if (rooms.isEmpty()) {
                    EmptyState()
                } else {
                    LazyColumn(
                        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 24.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(rooms, key = { it.id }) { room ->
                            RoomCard(room = room, onClick = { onOpenRoom(room.id) })
                        }
                    }
                }
            }

            // ---------- Naya Room ----------
            Glass3DButton(
                text = "Naya Room banayein",
                leading = "+",
                onClick = onCreateRoom,
                tint = RoomColors[0],
                height = 56.dp,
                fontSize = 16.sp,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
            )

            // Banane wale ka nishaan — bilkul halka.
            // Isi par der tak dabane se owner dashboard khulta hai (secret).
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 5.dp, bottom = 4.dp),
                contentAlignment = Alignment.Center
            ) {
                MakerMark(
                    modifier = Modifier
                        .padding(6.dp)
                        .combinedClickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = {},
                            onLongClick = onSecretUnlock
                        )
                )
            }
        }
    }

    if (showBackup) {
        BackupDialog(store = store, onDismiss = { showBackup = false })
    }
}

@Composable
private fun RoomCard(room: Room, onClick: () -> Unit) {
    val accent = roomColor(room.colorIndex)

    GlassCard(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .clickable(onClick = onClick),
        tint = accent,
        padding = 14.dp
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            // Emoji orb — halka sa 3D ubhaar
            Box(
                modifier = Modifier
                    .size(54.dp)
                    .clip(CircleShape)
                    .background(
                        Brush.verticalGradient(
                            0f to accent.copy(alpha = 0.30f),
                            1f to accent.copy(alpha = 0.08f)
                        )
                    )
                    .border(
                        1.dp,
                        Brush.verticalGradient(
                            0f to accent.copy(alpha = 0.55f),
                            1f to Color.Transparent
                        ),
                        CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(room.emoji, fontSize = 26.sp)
            }

            Spacer(Modifier.width(14.dp))

            Column(Modifier.weight(1f)) {
                Text(
                    room.title,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = Palette.Ink
                )
                if (room.handle.isNotBlank()) {
                    Text(
                        room.handle,
                        fontSize = 13.sp,
                        color = accent,
                        fontWeight = FontWeight.Medium
                    )
                }
                if (room.city.isNotBlank()) {
                    Spacer(Modifier.height(5.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Filled.Place,
                            contentDescription = null,
                            tint = Palette.InkFaint,
                            modifier = Modifier.size(13.dp)
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(room.city, fontSize = 12.sp, color = Palette.InkSoft)
                    }
                }
                if (!room.isReady) {
                    Spacer(Modifier.height(5.dp))
                    Text(
                        "⚠️ Setup adhoora — tap karke mukammal karein",
                        fontSize = 11.sp,
                        color = Palette.Danger.copy(alpha = 0.85f)
                    )
                }
            }

            Icon(
                Icons.Filled.ChevronRight,
                contentDescription = null,
                tint = Palette.InkFaint
            )
        }
    }
}

@Composable
private fun EmptyState() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 36.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier
                .size(96.dp)
                .clip(CircleShape)
                .background(
                    Brush.verticalGradient(
                        0f to RoomColors[0].copy(alpha = 0.22f),
                        1f to Color.Transparent
                    )
                )
                .border(
                    1.dp,
                    Brush.verticalGradient(
                        0f to RoomColors[0].copy(alpha = 0.4f),
                        1f to Color.Transparent
                    ),
                    CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            Text("🚪", fontSize = 44.sp)
        }
        Spacer(Modifier.height(20.dp))
        Text(
            "Abhi koi room nahi",
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = Palette.Ink
        )
        Spacer(Modifier.height(10.dp))
        Text(
            "Har TikTok account ke liye ek room banayein.\n" +
                "Room ke andar us account ka VPN, Fake GPS aur\n" +
                "TikTok — sab ek jagah, ek tap par.",
            fontSize = 14.sp,
            color = Palette.InkSoft,
            lineHeight = 22.sp,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )
    }
}
