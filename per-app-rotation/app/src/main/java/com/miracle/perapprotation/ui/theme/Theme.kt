package com.miracle.perapprotation.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val DarkColors = darkColorScheme(
    primary = Teal80,
    secondary = TealGrey80,
    tertiary = Mint80
)

private val LightColors = lightColorScheme(
    primary = Teal40,
    secondary = TealGrey40,
    tertiary = Mint40
)

/** Log-level colors resolved for the current theme, exposed to the log panel. */
data class LogColors(
    val success: Color,
    val warning: Color
)

@Composable
fun logColors(darkTheme: Boolean = isSystemInDarkTheme()): LogColors =
    if (darkTheme) LogColors(LogSuccessDark, LogWarningDark)
    else LogColors(LogSuccess, LogWarning)

@Composable
fun PerAppRotationTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    // Dynamic color is available on Android 12+.
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColors
        else -> LightColors
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        shapes = Shapes,
        content = content
    )
}
