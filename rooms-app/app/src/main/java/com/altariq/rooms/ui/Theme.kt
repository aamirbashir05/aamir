package com.altariq.rooms.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/**
 * Professional dark palette — deep graphite base, halka sa blue cast,
 * aur muted (neon nahi) accents. Glass panels isi base par uthte hain.
 */
object Palette {
    val Base = Color(0xFF070A10)
    val BaseTop = Color(0xFF10151F)
    val BaseGlow = Color(0xFF152030)

    val Ink = Color(0xFFEEF1F6)
    val InkSoft = Color(0xFF97A0B0)
    val InkFaint = Color(0xFF5C6575)

    // Glass surfaces — sab translucent hain, background inme se jhalakta hai
    val Glass = Color(0x0FFFFFFF)      // 6%
    val GlassStrong = Color(0x1AFFFFFF) // 10%
    val GlassEdge = Color(0x24FFFFFF)   // 14% — upar wali highlight line
    val GlassEdgeLow = Color(0x0AFFFFFF)

    val Danger = Color(0xFFF87171)
}

/** Room accents — professional, halke desaturated tones. */
val RoomColors = listOf(
    Color(0xFF2DD4BF), // teal
    Color(0xFF6366F1), // indigo
    Color(0xFFF43F5E), // rose
    Color(0xFFF59E0B), // amber
    Color(0xFF38BDF8), // sky
    Color(0xFFA855F7), // violet
)

fun roomColor(index: Int): Color =
    RoomColors[((index % RoomColors.size) + RoomColors.size) % RoomColors.size]

private val Scheme = darkColorScheme(
    primary = RoomColors[0],
    onPrimary = Color(0xFF04211D),
    secondary = RoomColors[1],
    onSecondary = Color.White,
    background = Palette.Base,
    onBackground = Palette.Ink,
    surface = Palette.Glass,
    onSurface = Palette.Ink,
    surfaceVariant = Palette.GlassStrong,
    onSurfaceVariant = Palette.InkSoft,
    outline = Palette.GlassEdge,
    error = Palette.Danger,
)

/** App hamesha dark glass theme par — is design ka asal maza wahi hai. */
@Composable
fun AccountRoomsTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Scheme, content = content)
}
