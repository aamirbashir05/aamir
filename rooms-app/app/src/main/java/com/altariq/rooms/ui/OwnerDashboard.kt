package com.altariq.rooms.ui

import android.os.Build
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.text.KeyboardOptions
import com.altariq.rooms.data.RoomStore
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

/**
 * Sirf owner ka dashboard — home screen par "Made by Aamir" wale nishaan par
 * der tak dabane se khulta hai, phir PIN. Aam user ko iska pata hi nahi chalta.
 */
@Composable
fun OwnerDashboard(store: RoomStore, onBack: () -> Unit) {
    val stats = store.stats
    val rooms = store.rooms

    val totalUploads = rooms.sumOf { it.uploads.size }
    val daysSinceInstall = if (stats.installedAt > 0)
        TimeUnit.MILLISECONDS.toDays(System.currentTimeMillis() - stats.installedAt) + 1 else 1

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
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(
                            "Owner Dashboard",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = Palette.Ink
                        )
                        Text("Sirf aapke liye", fontSize = 11.sp, color = Palette.InkFaint)
                    }
                }
            }

            // ---- Istemaal ke numbers ----
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    StatTile("Rooms", "${rooms.size}", RoomColors[0], Modifier.weight(1f))
                    StatTile("App opens", "${stats.opens}", RoomColors[1], Modifier.weight(1f))
                }
            }
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    StatTile("Uploads", "$totalUploads", RoomColors[4], Modifier.weight(1f))
                    StatTile("Din", "$daysSinceInstall", RoomColors[3], Modifier.weight(1f))
                }
            }

            // ---- Har room ka hisaab ----
            item {
                GlassCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                ) {
                    Text(
                        "HAR ROOM KA HISAAB",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp,
                        color = Palette.InkFaint
                    )
                    Spacer(Modifier.height(12.dp))

                    if (rooms.isEmpty()) {
                        Text("Abhi koi room nahi.", fontSize = 13.sp, color = Palette.InkSoft)
                    } else {
                        rooms.forEach { room ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 7.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(room.emoji, fontSize = 18.sp)
                                Spacer(Modifier.width(10.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(
                                        room.title,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = Palette.Ink
                                    )
                                    Text(
                                        if (room.lastUsed > 0) "Aakhri baar: ${shortDate(room.lastUsed)}"
                                        else "Abhi tak istemaal nahi hua",
                                        fontSize = 11.sp,
                                        color = Palette.InkFaint
                                    )
                                }
                                Text(
                                    "${room.uploads.size}",
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = roomColor(room.colorIndex)
                                )
                            }
                        }
                    }
                }
            }

            // ---- Device / app info ----
            item {
                GlassCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                ) {
                    Text(
                        "DEVICE",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp,
                        color = Palette.InkFaint
                    )
                    Spacer(Modifier.height(10.dp))
                    InfoRow("Phone", "${Build.MANUFACTURER} ${Build.MODEL}")
                    InfoRow("Android", Build.VERSION.RELEASE ?: "-")
                    InfoRow("Install", if (stats.installedAt > 0) shortDate(stats.installedAt) else "-")
                    InfoRow("Aakhri open", if (stats.lastOpen > 0) shortDate(stats.lastOpen) else "-")
                    InfoRow("Total launches", "${stats.launches}")
                }
            }

            // ---- Play Store data ke bare me ----
            item {
                GlassCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    tint = RoomColors[3]
                ) {
                    Text(
                        "PLAY STORE DOWNLOADS",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp,
                        color = Palette.InkFaint
                    )
                    Spacer(Modifier.height(10.dp))
                    Text(
                        "Downloads aur konsi city me install hui — ye data Google ke paas hota hai, " +
                            "app ke paas nahi. Play Store par publish karne ke baad ye sab " +
                            "Play Console → Statistics me milta hai (country, city, device, " +
                            "uninstalls, rating) — aur wo sirf aapke Google account se khulta hai.",
                        fontSize = 13.sp,
                        color = Palette.InkSoft,
                        lineHeight = 20.sp
                    )
                    Spacer(Modifier.height(10.dp))
                    Text(
                        "Agar ye numbers isi dashboard ke andar chahiye hon to app me cloud " +
                            "analytics jorna parega — bata dein to laga dunga.",
                        fontSize = 12.sp,
                        color = Palette.InkFaint,
                        lineHeight = 18.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun StatTile(label: String, value: String, tint: Color, modifier: Modifier = Modifier) {
    GlassCard(modifier = modifier, tint = tint, corner = 18.dp, padding = 14.dp) {
        Text(value, fontSize = 26.sp, fontWeight = FontWeight.Bold, color = tint)
        Text(label, fontSize = 11.sp, color = Palette.InkSoft)
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 5.dp)
    ) {
        Text(label, fontSize = 13.sp, color = Palette.InkFaint, modifier = Modifier.width(110.dp))
        Text(value, fontSize = 13.sp, color = Palette.Ink, fontWeight = FontWeight.Medium)
    }
}

/**
 * PIN wala darwaza. Pehli dafa PIN set hota hai, uske baad har dafa poocha jata hai.
 */
@Composable
fun OwnerPinDialog(
    store: RoomStore,
    onDismiss: () -> Unit,
    onUnlocked: () -> Unit
) {
    val savedPin = store.stats.ownerPin
    val isFirstTime = savedPin.isBlank()

    var pin by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF141924),
        titleContentColor = Palette.Ink,
        textContentColor = Palette.InkSoft,
        title = {
            Text(
                if (isFirstTime) "Owner PIN set karein" else "Owner PIN",
                fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column {
                Text(
                    if (isFirstTime)
                        "Ye dashboard sirf aapke liye hai. Ek PIN rakh lein — " +
                            "aage se yahi poocha jayega."
                    else "Dashboard kholne ke liye PIN likhein.",
                    fontSize = 13.sp,
                    lineHeight = 19.sp
                )
                Spacer(Modifier.height(14.dp))
                OutlinedTextField(
                    value = pin,
                    onValueChange = { if (it.length <= 8) { pin = it; error = "" } },
                    label = { Text("PIN") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                    isError = error.isNotBlank(),
                    modifier = Modifier.fillMaxWidth()
                )
                if (error.isNotBlank()) {
                    Spacer(Modifier.height(6.dp))
                    Text(error, fontSize = 12.sp, color = Palette.Danger)
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = pin.length >= 4,
                onClick = {
                    if (isFirstTime) {
                        store.setOwnerPin(pin)
                        onUnlocked()
                    } else if (pin == savedPin) {
                        onUnlocked()
                    } else {
                        error = "PIN ghalat hai"
                        pin = ""
                    }
                }
            ) {
                Text(if (isFirstTime) "Set karein" else "Kholein", color = RoomColors[0])
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = Palette.InkSoft) }
        }
    )
}

private fun shortDate(ts: Long): String =
    SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.getDefault()).format(Date(ts))
