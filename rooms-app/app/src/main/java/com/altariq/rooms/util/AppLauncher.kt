package com.altariq.rooms.util

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.widget.Toast
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.core.graphics.drawable.toBitmap

/** Phone me maujood ek app (picker me dikhane ke liye). */
data class InstalledApp(
    val pkg: String,
    val label: String,
    val icon: ImageBitmap?
)

object AppLauncher {

    /**
     * Phone ki saari launchable apps — picker me dikhane ke liye.
     * Ye thora bhaari kaam hai, isliye hamesha background thread par chalayein.
     */
    fun installedApps(context: Context): List<InstalledApp> {
        val pm = context.packageManager
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)

        @Suppress("DEPRECATION")
        val resolved = try {
            pm.queryIntentActivities(intent, 0)
        } catch (e: Exception) {
            emptyList()
        }

        return resolved.mapNotNull { info ->
            val pkg = info.activityInfo?.packageName ?: return@mapNotNull null
            // Khud ki app ko list me na dikhayein
            if (pkg == context.packageName) return@mapNotNull null
            val label = try {
                info.loadLabel(pm).toString()
            } catch (e: Exception) {
                pkg
            }
            val icon = try {
                info.loadIcon(pm).toBitmap(96, 96).asImageBitmap()
            } catch (e: Exception) {
                null
            }
            InstalledApp(pkg, label, icon)
        }
            .distinctBy { it.pkg }
            .sortedBy { it.label.lowercase() }
    }

    /**
     * Package se app kholna. Kaamyab ho to true.
     * App uninstall ho chuki ho to user ko batate hain (crash nahi).
     */
    fun open(context: Context, pkg: String): Boolean {
        if (pkg.isBlank()) return false
        val intent = try {
            context.packageManager.getLaunchIntentForPackage(pkg)
        } catch (e: Exception) {
            null
        }
        if (intent == null) {
            Toast.makeText(context, "Ye app phone me nahi mili — Room edit karke dobara chunein", Toast.LENGTH_LONG).show()
            return false
        }
        return try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            true
        } catch (e: Exception) {
            Toast.makeText(context, "App khul nahi saki", Toast.LENGTH_SHORT).show()
            false
        }
    }

    /** Kisi app ka maujooda naam — agar install hai to. */
    fun labelOf(context: Context, pkg: String): String? {
        if (pkg.isBlank()) return null
        return try {
            val pm = context.packageManager
            pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
        } catch (e: Exception) {
            null
        }
    }

    /** Coordinates ya koi bhi text clipboard par — Fake GPS me paste karne ke liye. */
    fun copy(context: Context, text: String, toast: String = "Copy ho gaya") {
        if (text.isBlank()) return
        try {
            val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            cm.setPrimaryClip(ClipData.newPlainText("Account Rooms", text))
            Toast.makeText(context, toast, Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
        }
    }
}
