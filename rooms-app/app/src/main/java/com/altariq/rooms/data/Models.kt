package com.altariq.rooms.data

import kotlinx.serialization.Serializable

/**
 * Ek "room" = ek TikTok account ka poora setup.
 * Room ke andar wo saari cheezein ek jagah hain jo us account ko chalane
 * ke liye chahiye — VPN app, Fake GPS app, TikTok app aur unki settings.
 */
@Serializable
data class Room(
    val id: String,
    val name: String = "",
    val handle: String = "",
    val emoji: String = "🎬",
    val colorIndex: Int = 0,

    // Step 1 — VPN
    val vpnPkg: String = "",
    val vpnLabel: String = "",
    val vpnServer: String = "",

    // Step 2 — Fake GPS
    val gpsPkg: String = "",
    val gpsLabel: String = "",
    val city: String = "",
    val lat: String = "",
    val lng: String = "",

    // Step 3 — TikTok
    val tiktokPkg: String = "",
    val tiktokLabel: String = "",

    val notes: String = "",
    val uploads: List<UploadLog> = emptyList(),
    val lastUsed: Long = 0L
) {
    /** Room ka display title — naam na ho to handle, wo bhi na ho to placeholder. */
    val title: String
        get() = when {
            name.isNotBlank() -> name
            handle.isNotBlank() -> handle
            else -> "Naya Room"
        }

    /** Coordinates jo Fake GPS app me paste karni hain. */
    val coords: String
        get() = if (lat.isNotBlank() && lng.isNotBlank()) "$lat,$lng" else ""

    /** Setup mukammal hai ya nahi — home screen par warning dikhane ke liye. */
    val isReady: Boolean
        get() = tiktokPkg.isNotBlank()
}

@Serializable
data class UploadLog(
    val id: String,
    val date: Long,
    val title: String,
    val note: String = ""
)

/**
 * Sirf owner ke dashboard ke liye — app ke apne istemaal ka hisaab.
 * Ye data bhi phone hi me rehta hai, kahin bheja nahi jata.
 */
@Serializable
data class AppStats(
    val installedAt: Long = 0L,
    val opens: Int = 0,
    val lastOpen: Long = 0L,
    val launches: Int = 0,
    /** Khali = abhi PIN set nahi hua. Pehli dafa kholte waqt owner set karta hai. */
    val ownerPin: String = ""
)

/** Poori app ka data — ek hi JSON file me offline save hota hai. */
@Serializable
data class RoomsData(
    val rooms: List<Room> = emptyList(),
    val stats: AppStats = AppStats(),
    val version: Int = 1
)
