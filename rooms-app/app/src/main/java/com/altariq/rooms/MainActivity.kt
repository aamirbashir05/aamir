package com.altariq.rooms

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.altariq.rooms.data.RoomStore
import com.altariq.rooms.ui.AccountRoomsTheme
import com.altariq.rooms.ui.EditScreen
import com.altariq.rooms.ui.HomeScreen
import com.altariq.rooms.ui.OwnerDashboard
import com.altariq.rooms.ui.OwnerPinDialog
import com.altariq.rooms.ui.RoomScreen

/** App ke andar kaun sa screen khula hai. */
private sealed interface Screen {
    data object Home : Screen
    data class RoomView(val id: String) : Screen
    data class Edit(val id: String) : Screen
    data object Dashboard : Screen
}

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val store = RoomStore(applicationContext)
        store.load()
        store.recordOpen()

        setContent {
            AccountRoomsTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    AppRoot(store)
                }
            }
        }
    }
}

@Composable
private fun AppRoot(store: RoomStore) {
    var screen by remember { mutableStateOf<Screen>(Screen.Home) }
    var askPin by remember { mutableStateOf(false) }

    // Phone ka back button — screen ke hisaab se peeche jaye
    BackHandler(enabled = screen !is Screen.Home) {
        screen = when (val s = screen) {
            is Screen.Edit -> if (store.get(s.id) != null) Screen.RoomView(s.id) else Screen.Home
            else -> Screen.Home
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        when (val s = screen) {
            is Screen.Home -> HomeScreen(
                store = store,
                onOpenRoom = { id -> screen = Screen.RoomView(id) },
                onCreateRoom = {
                    val room = store.add()
                    screen = Screen.Edit(room.id)
                },
                onSecretUnlock = { askPin = true }
            )

            is Screen.Dashboard -> OwnerDashboard(
                store = store,
                onBack = { screen = Screen.Home }
            )

            is Screen.RoomView -> {
                val room = store.get(s.id)
                if (room == null) {
                    screen = Screen.Home
                } else {
                    RoomScreen(
                        store = store,
                        room = room,
                        onBack = { screen = Screen.Home },
                        onEdit = { screen = Screen.Edit(s.id) }
                    )
                }
            }

            is Screen.Edit -> {
                val room = store.get(s.id)
                if (room == null) {
                    screen = Screen.Home
                } else {
                    EditScreen(
                        store = store,
                        room = room,
                        onDone = { screen = Screen.RoomView(s.id) },
                        onDeleted = { screen = Screen.Home }
                    )
                }
            }
        }
    }

    if (askPin) {
        OwnerPinDialog(
            store = store,
            onDismiss = { askPin = false },
            onUnlocked = {
                askPin = false
                screen = Screen.Dashboard
            }
        )
    }
}
