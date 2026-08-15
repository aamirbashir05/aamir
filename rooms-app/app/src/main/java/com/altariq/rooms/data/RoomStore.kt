package com.altariq.rooms.data

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.serialization.json.Json
import java.io.File
import java.util.UUID

/**
 * Sara data phone ke andar ek JSON file me — koi login nahi, koi server nahi.
 * Har change ke baad foran file par likh dete hain taake app band ho to bhi mehfooz rahe.
 */
class RoomStore(private val context: Context) {

    private val json = Json {
        ignoreUnknownKeys = true
        prettyPrint = true
        encodeDefaults = true
    }

    private val file: File
        get() = File(context.filesDir, "rooms.json")

    /** Compose isi list ko observe karta hai — badalte hi UI refresh ho jata hai. */
    val rooms = mutableStateListOf<Room>()

    /** Owner dashboard ke numbers. */
    var stats by mutableStateOf(AppStats())
        private set

    fun load() {
        rooms.clear()
        val f = file
        if (!f.exists()) {
            // Pehli dafa app khuli — install ka waqt yahin se ginte hain
            stats = AppStats(installedAt = System.currentTimeMillis())
            return
        }
        try {
            val data = json.decodeFromString<RoomsData>(f.readText())
            rooms.addAll(data.rooms)
            stats = data.stats
            if (stats.installedAt == 0L) {
                stats = stats.copy(installedAt = System.currentTimeMillis())
            }
        } catch (e: Exception) {
            // File kharab ho to app crash na ho — khali list se shuru karein,
            // aur purani file backup ke taur par rakh lein.
            try {
                f.copyTo(File(context.filesDir, "rooms-corrupt-backup.json"), overwrite = true)
            } catch (_: Exception) {
            }
        }
    }

    private fun persist() {
        try {
            file.writeText(json.encodeToString(RoomsData(rooms = rooms.toList(), stats = stats)))
        } catch (_: Exception) {
        }
    }

    /** App khulne par ek dafa — dashboard ke liye. */
    fun recordOpen() {
        stats = stats.copy(opens = stats.opens + 1, lastOpen = System.currentTimeMillis())
        persist()
    }

    /** Jab bhi room me se koi app launch ho. */
    private fun recordLaunch() {
        stats = stats.copy(launches = stats.launches + 1)
    }

    fun setOwnerPin(pin: String) {
        stats = stats.copy(ownerPin = pin)
        persist()
    }

    fun add(): Room {
        val room = Room(
            id = UUID.randomUUID().toString(),
            colorIndex = rooms.size % ROOM_COLORS_COUNT
        )
        rooms.add(room)
        persist()
        return room
    }

    fun update(updated: Room) {
        val i = rooms.indexOfFirst { it.id == updated.id }
        if (i >= 0) {
            rooms[i] = updated
            persist()
        }
    }

    fun delete(id: String) {
        rooms.removeAll { it.id == id }
        persist()
    }

    fun get(id: String): Room? = rooms.firstOrNull { it.id == id }

    fun markUsed(id: String) {
        recordLaunch()
        get(id)?.let { update(it.copy(lastUsed = System.currentTimeMillis())) }
    }

    fun addUpload(roomId: String, title: String, note: String) {
        val room = get(roomId) ?: return
        val log = UploadLog(
            id = UUID.randomUUID().toString(),
            date = System.currentTimeMillis(),
            title = title,
            note = note
        )
        update(room.copy(uploads = listOf(log) + room.uploads))
    }

    fun deleteUpload(roomId: String, uploadId: String) {
        val room = get(roomId) ?: return
        update(room.copy(uploads = room.uploads.filterNot { it.id == uploadId }))
    }

    /** Backup ke liye poora data JSON text me. */
    fun exportJson(): String = json.encodeToString(RoomsData(rooms.toList()))

    /** Backup wapas load karna. Ghalat text ho to false. */
    fun importJson(text: String): Boolean {
        return try {
            val data = json.decodeFromString<RoomsData>(text)
            rooms.clear()
            rooms.addAll(data.rooms)
            persist()
            true
        } catch (e: Exception) {
            false
        }
    }

    companion object {
        const val ROOM_COLORS_COUNT = 6
    }
}
