package com.altariq.rooms.util

import android.content.ClipData
import android.content.ClipboardManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.Toast
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.core.graphics.drawable.toBitmap

/**
 * Phone me maujood ek launchable entry.
 *
 * Yahan "app" se murad package nahi, balke ek LAUNCHER ENTRY hai. Clone/multi-account
 * apps aksar ek hi package ke andar har clone ke liye alag launcher entry banati hain —
 * isliye hum package ke bajaye poore component (package + activity) ko pehchan mante hain,
 * warna saare clones aapas me mil kar ek reh jate hain.
 */
data class InstalledApp(
    val pkg: String,
    val activity: String,
    val label: String,
    val icon: ImageBitmap?
) {
    /** Picker me ek jaise naam wali entries ko alag karne ke liye. */
    val shortId: String
        get() = activity.substringAfterLast('.')
}

object AppLauncher {

    /**
     * Phone ki saari launchable entries — picker me dikhane ke liye.
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
            val ai = info.activityInfo ?: return@mapNotNull null
            val pkg = ai.packageName ?: return@mapNotNull null
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
            InstalledApp(pkg = pkg, activity = ai.name ?: "", label = label, icon = icon)
        }
            // Har alag launcher entry apni jagah rakhti hai (clones alag alag nazar aayein)
            .distinctBy { it.pkg + "/" + it.activity }
            .sortedWith(compareBy({ it.label.lowercase() }, { it.activity }))
    }

    /**
     * Room me se app kholna.
     *
     * Pehle theek us entry ko kholne ki koshish karte hain jo user ne chuni thi
     * (component ke zariye) — isi tarah clone wali entry seedha khulti hai.
     * Agar wo entry ab maujood na ho to package ka aam launcher intent try karte hain.
     */
    fun open(context: Context, pkg: String, activity: String = ""): Boolean {
        if (pkg.isBlank()) return false

        if (activity.isNotBlank()) {
            val direct = Intent(Intent.ACTION_MAIN)
                .addCategory(Intent.CATEGORY_LAUNCHER)
                .setComponent(ComponentName(pkg, activity))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            try {
                context.startActivity(direct)
                return true
            } catch (e: Exception) {
                // Entry badal gayi hogi — neeche wale aam tareeqe par chale jate hain
            }
        }

        val fallback = try {
            context.packageManager.getLaunchIntentForPackage(pkg)
        } catch (e: Exception) {
            null
        }
        if (fallback == null) {
            Toast.makeText(
                context,
                "Ye app phone me nahi mili — Room edit karke dobara chunein",
                Toast.LENGTH_LONG
            ).show()
            return false
        }
        return try {
            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(fallback)
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
