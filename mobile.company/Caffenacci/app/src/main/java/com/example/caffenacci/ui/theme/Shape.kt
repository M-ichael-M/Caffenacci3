package com.example.caffenacci.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.ui.unit.dp

// M3 Expressive leans into bigger, softer corners than classic M3 — mirrors
// the generous border-radius tokens used across the web app's CSS
// (--radius-sm/md/lg: 8/12/18px, plus fully pill-shaped chips and buttons).
val CaffenacciShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(24.dp),
    extraLarge = RoundedCornerShape(32.dp),
)