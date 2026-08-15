package com.altariq.rooms.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Poori app ka background — deep graphite gradient + halka sa upar ki taraf glow.
 * Glass panels isi ke upar tairte hain, isliye ye har screen ke neeche hona chahiye.
 */
@Composable
fun AppBackground(content: @Composable () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    0f to Palette.BaseTop,
                    0.45f to Palette.Base,
                    1f to Color(0xFF05070B)
                )
            )
    ) {
        // Upar halka sa rang ka glow — flat kaala lagne se bachata hai
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(320.dp)
                .background(
                    Brush.verticalGradient(
                        0f to Palette.BaseGlow.copy(alpha = 0.55f),
                        1f to Color.Transparent
                    )
                )
        )
        content()
    }
}

/**
 * Glass panel — halka translucent fill, upar se neeche girta hua gradient,
 * aur kinare par ek roshan line jo 3D ubhaar deti hai.
 */
@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    corner: Dp = 20.dp,
    tint: Color? = null,
    padding: Dp = 16.dp,
    content: @Composable ColumnScope.() -> Unit
) {
    val shape = RoundedCornerShape(corner)
    Column(
        modifier = modifier
            .shadow(
                elevation = 14.dp,
                shape = shape,
                clip = false,
                ambientColor = Color.Black,
                spotColor = Color.Black
            )
            .clip(shape)
            .background(
                Brush.verticalGradient(
                    0f to Palette.GlassStrong,
                    1f to Palette.GlassEdgeLow
                )
            )
            .then(
                if (tint != null) Modifier.background(
                    Brush.verticalGradient(
                        0f to tint.copy(alpha = 0.10f),
                        0.6f to Color.Transparent
                    )
                ) else Modifier
            )
            .border(
                BorderStroke(
                    1.dp,
                    Brush.verticalGradient(
                        0f to (tint ?: Color.White).copy(alpha = 0.22f),
                        0.5f to Palette.GlassEdgeLow,
                        1f to Color.Transparent
                    )
                ),
                shape
            )
            .padding(padding),
        content = content
    )
}

/**
 * 3D transparent button — andar se translucent, upar roshan kinar,
 * neeche gehri shadow. Dabane par halka sa dhans jata hai (press effect).
 */
@Composable
fun Glass3DButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    tint: Color = RoomColors[0],
    leading: String? = null,
    height: Dp = 52.dp,
    corner: Dp = 15.dp,
    fontSize: androidx.compose.ui.unit.TextUnit = 15.sp,
    enabled: Boolean = true
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()

    // Dabane par button thora chhota — asli button jaisa mehsoos hota hai
    val scale by animateFloatAsState(
        targetValue = if (pressed) 0.975f else 1f,
        animationSpec = spring(),
        label = "press"
    )
    val shape = RoundedCornerShape(corner)
    val alpha = if (enabled) 1f else 0.4f

    Box(
        modifier = modifier
            .height(height)
            .scale(scale)
            .shadow(
                elevation = if (pressed) 3.dp else 12.dp,
                shape = shape,
                clip = false,
                ambientColor = tint.copy(alpha = 0.6f),
                spotColor = tint.copy(alpha = 0.75f)
            )
            .clip(shape)
            // Transparent 3D fill — upar se neeche halka hota hua
            .background(
                Brush.verticalGradient(
                    0f to tint.copy(alpha = if (pressed) 0.20f else 0.30f),
                    0.55f to tint.copy(alpha = if (pressed) 0.11f else 0.16f),
                    1f to tint.copy(alpha = if (pressed) 0.14f else 0.09f)
                )
            )
            // Upar ki taraf sheeshe wali chamak
            .background(
                Brush.verticalGradient(
                    0f to Color.White.copy(alpha = if (pressed) 0.05f else 0.12f),
                    0.42f to Color.Transparent,
                    1f to Color.Transparent
                )
            )
            .border(
                BorderStroke(
                    1.dp,
                    Brush.verticalGradient(
                        0f to tint.copy(alpha = 0.75f),
                        0.5f to tint.copy(alpha = 0.30f),
                        1f to tint.copy(alpha = 0.14f)
                    )
                ),
                shape
            )
            .clickable(
                interactionSource = interaction,
                indication = null,
                enabled = enabled,
                onClick = onClick
            ),
        contentAlignment = Alignment.Center
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
            modifier = Modifier.padding(horizontal = 16.dp)
        ) {
            if (leading != null) {
                Text(leading, fontSize = fontSize)
                Spacer(Modifier.padding(horizontal = 4.dp))
            }
            Text(
                text,
                color = Color.White.copy(alpha = alpha),
                fontWeight = FontWeight.SemiBold,
                fontSize = fontSize
            )
        }
    }
}

/** Chhota sa glass chip — icon buttons aur tags ke liye. */
@Composable
fun GlassChip(
    modifier: Modifier = Modifier,
    tint: Color = Color.White,
    corner: Dp = 12.dp,
    onClick: (() -> Unit)? = null,
    content: @Composable RowScope.() -> Unit
) {
    val shape = RoundedCornerShape(corner)
    Row(
        modifier = modifier
            .clip(shape)
            .background(
                Brush.verticalGradient(
                    0f to tint.copy(alpha = 0.16f),
                    1f to tint.copy(alpha = 0.06f)
                )
            )
            .border(
                BorderStroke(
                    1.dp,
                    Brush.verticalGradient(
                        0f to tint.copy(alpha = 0.34f),
                        1f to tint.copy(alpha = 0.10f)
                    )
                ),
                shape
            )
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(horizontal = 10.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
        content = content
    )
}

/**
 * Banane wale ka nishaan. Jaan bujh kar itna halka aur chhota rakha hai
 * ke sirf dhoondne par hi nazar aata hai.
 */
@Composable
fun MakerMark(modifier: Modifier = Modifier) {
    Text(
        "Made by Aamir",
        fontSize = 6.sp,
        letterSpacing = 0.4.sp,
        color = Palette.Ink.copy(alpha = 0.085f),
        modifier = modifier
    )
}
