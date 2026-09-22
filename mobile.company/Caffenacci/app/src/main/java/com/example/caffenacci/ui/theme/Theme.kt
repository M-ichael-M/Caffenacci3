package com.example.caffenacci.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Fixed brand palette rather than Material You dynamic color — the espresso
// / gold / parchment identity is the whole point of the brand, the same way
// caffenacci.company never adapts its CSS palette to the visitor's wallpaper.
private val LightColors = lightColorScheme(
    primary = Gold,
    onPrimary = Surface,
    primaryContainer = GoldContainerLight,
    onPrimaryContainer = OnGoldContainerLight,
    secondary = Coffee,
    onSecondary = Parchment,
    secondaryContainer = CoffeeContainerLight,
    onSecondaryContainer = OnCoffeeContainerLight,
    tertiary = SuccessGreen,
    onTertiary = Surface,
    tertiaryContainer = SuccessBg,
    onTertiaryContainer = SuccessGreen,
    background = AppBg,
    onBackground = TextDark,
    surface = Surface,
    onSurface = TextDark,
    surfaceVariant = Surface2,
    onSurfaceVariant = TextMuted,
    outline = Border,
    outlineVariant = BorderSoft,
    error = ErrorRed,
    onError = Surface,
    errorContainer = ErrorBg,
    onErrorContainer = ErrorRed,
    inverseSurface = SidebarBg,
    inverseOnSurface = Parchment,
    inversePrimary = GoldSoft,
)

private val DarkColors = darkColorScheme(
    primary = GoldSoft,
    onPrimary = Espresso,
    primaryContainer = GoldContainerDark,
    onPrimaryContainer = OnGoldContainerDark,
    secondary = Parchment,
    onSecondary = Espresso,
    secondaryContainer = CoffeeContainerDark,
    onSecondaryContainer = OnCoffeeContainerDark,
    tertiary = SuccessGreen,
    onTertiary = Surface,
    background = SidebarBg,
    onBackground = Parchment,
    surface = Coffee,
    onSurface = Parchment,
    surfaceVariant = Espresso,
    onSurfaceVariant = Color(0xFFC7B8A5),
    outline = Color(0x33F0E4CC),
    error = Color(0xFFE88888),
    onError = Espresso,
    inverseSurface = AppBg,
    inverseOnSurface = TextDark,
    inversePrimary = Gold,
)

@Composable
fun CaffenacciTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) DarkColors else LightColors

    MaterialTheme(
        colorScheme = colorScheme,
        typography = CaffenacciTypography,
        shapes = CaffenacciShapes,
        content = content,
    )
}