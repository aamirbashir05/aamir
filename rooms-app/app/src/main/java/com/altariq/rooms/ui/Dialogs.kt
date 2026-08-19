package com.altariq.rooms.ui

import android.content.Intent
import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.altariq.rooms.data.RoomStore
import com.altariq.rooms.util.AppLauncher
import com.altariq.rooms.util.InstalledApp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Phone ki installed apps me se ek chunne ka dialog (search ke saath). */
@Composable
fun AppPickerDialog(
    title: String,
    onDismiss: () -> Unit,
    onPick: (InstalledApp) -> Unit
) {
    val context = LocalContext.current
    var apps by remember { mutableStateOf<List<InstalledApp>?>(null) }
    var query by remember { mutableStateOf("") }

    // App list bhaari hoti hai — background thread par load karein taake UI na atke
    LaunchedEffect(Unit) {
        apps = withContext(Dispatchers.IO) { AppLauncher.installedApps(context) }
    }

    val list = apps.orEmpty().filter {
        query.isBlank() || it.label.contains(query, ignoreCase = true)
    }

    // Wo naam jo ek se zyada dafa aate hain (clones) — inke liye extra tafseel dikhate hain
    val dupLabels = remember(apps) {
        apps.orEmpty().groupBy { it.label }.filterValues { it.size > 1 }.keys
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title, fontSize = 18.sp, fontWeight = FontWeight.Bold) },
        text = {
            Column {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    placeholder = { Text("App dhoondein...") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    "Clone / multi-account apps alag alag entry ban kar yahan nazar aati hain.",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    lineHeight = 15.sp
                )
                Spacer(Modifier.height(8.dp))

                when {
                    apps == null -> Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(120.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }

                    list.isEmpty() -> Text(
                        "Koi app nahi mili.",
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    else -> LazyColumn(
                        modifier = Modifier.heightIn(max = 380.dp),
                        verticalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        items(list, key = { it.pkg + "/" + it.activity }) { app ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(10.dp))
                                    .clickable { onPick(app) }
                                    .padding(vertical = 8.dp, horizontal = 4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                if (app.icon != null) {
                                    Image(
                                        bitmap = app.icon,
                                        contentDescription = null,
                                        modifier = Modifier
                                            .size(36.dp)
                                            .clip(RoundedCornerShape(8.dp))
                                    )
                                } else {
                                    Box(
                                        modifier = Modifier
                                            .size(36.dp)
                                            .clip(CircleShape)
                                            .background(MaterialTheme.colorScheme.surfaceVariant)
                                    )
                                }
                                Spacer(Modifier.width(12.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(
                                        app.label,
                                        fontSize = 15.sp,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                    // Clone apps ka naam aksar bilkul ek jaisa hota hai —
                                    // package/entry dikhane se pata chalta hai kaunsi kaunsi hai
                                    Text(
                                        if (dupLabels.contains(app.label)) "${app.pkg}  ·  ${app.shortId}"
                                        else app.pkg,
                                        fontSize = 10.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        maxLines = 1
                                    )
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

/**
 * Backup — sara data offline hai, isliye phone badalne se pehle
 * backup nikaal lena zaroori hai.
 */
@Composable
fun BackupDialog(store: RoomStore, onDismiss: () -> Unit) {
    val context = LocalContext.current
    var importText by remember { mutableStateOf("") }
    var showImport by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Backup") },
        text = {
            Column {
                Text(
                    "Sara data sirf isi phone me hai. Phone badlein ya app uninstall karein " +
                        "to data chala jayega — isliye backup apne WhatsApp par bhej kar rakh lein.",
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    lineHeight = 19.sp
                )
                Spacer(Modifier.height(16.dp))

                BackupAction("📤  Backup bhejein / save karein") {
                    val json = store.exportJson()
                    val intent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_SUBJECT, "Account Rooms backup")
                        putExtra(Intent.EXTRA_TEXT, json)
                    }
                    try {
                        context.startActivity(Intent.createChooser(intent, "Backup bhejein"))
                    } catch (e: Exception) {
                        AppLauncher.copy(context, json, "Backup clipboard par copy ho gaya")
                    }
                }

                Spacer(Modifier.height(8.dp))

                BackupAction("📋  Backup copy karein") {
                    AppLauncher.copy(context, store.exportJson(), "Backup copy ho gaya")
                }

                Spacer(Modifier.height(8.dp))

                BackupAction("📥  Backup wapas laayein") { showImport = !showImport }

                if (showImport) {
                    Spacer(Modifier.height(10.dp))
                    OutlinedTextField(
                        value = importText,
                        onValueChange = { importText = it },
                        placeholder = { Text("Backup text yahan paste karein") },
                        minLines = 3,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(Modifier.height(8.dp))
                    TextButton(
                        onClick = {
                            if (store.importJson(importText.trim())) {
                                Toast.makeText(context, "Backup load ho gaya ✅", Toast.LENGTH_SHORT).show()
                                onDismiss()
                            } else {
                                Toast.makeText(context, "Ye backup theek nahi lag raha", Toast.LENGTH_LONG).show()
                            }
                        },
                        enabled = importText.isNotBlank()
                    ) { Text("Load karein") }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Band karein") }
        }
    )
}

@Composable
private fun BackupAction(label: String, onClick: () -> Unit) {
    Text(
        label,
        fontSize = 15.sp,
        fontWeight = FontWeight.Medium,
        color = MaterialTheme.colorScheme.onSurface,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .clickable(onClick = onClick)
            .padding(14.dp)
    )
}
