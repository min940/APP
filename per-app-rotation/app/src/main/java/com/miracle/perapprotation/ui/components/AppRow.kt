package com.miracle.perapprotation.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Android
import androidx.compose.material.icons.filled.AddToHomeScreen
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.painter.BitmapPainter
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.graphics.drawable.toBitmap
import com.miracle.perapprotation.data.Orientation
import com.miracle.perapprotation.util.InstalledApp

@Composable
fun AppRow(
    app: InstalledApp,
    current: Orientation,
    onOrientationSelected: (Orientation) -> Unit,
    onAddShortcut: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        AppIcon(app)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                text = app.label,
                style = MaterialTheme.typography.bodyLarge,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = app.packageName,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        // Offer a home-screen shortcut once the app has a rotation rule.
        AnimatedVisibility(visible = current.requiresOverlay) {
            IconButton(onClick = onAddShortcut) {
                Icon(
                    imageVector = Icons.Filled.AddToHomeScreen,
                    contentDescription = "홈 화면 바로가기 추가",
                    tint = MaterialTheme.colorScheme.primary
                )
            }
        }
        OrientationDropdown(current = current, onSelected = onOrientationSelected)
    }
}

@Composable
private fun AppIcon(app: InstalledApp) {
    val bitmap = remember(app.packageName) {
        runCatching { app.icon?.toBitmap(96, 96)?.asImageBitmap() }.getOrNull()
    }
    Box(
        modifier = Modifier
            .size(44.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHighest),
        contentAlignment = Alignment.Center
    ) {
        if (bitmap != null) {
            androidx.compose.foundation.Image(
                painter = BitmapPainter(bitmap),
                contentDescription = app.label,
                modifier = Modifier.size(36.dp)
            )
        } else {
            Icon(
                imageVector = Icons.Filled.Android,
                contentDescription = app.label,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(28.dp)
            )
        }
    }
}

@Composable
fun OrientationDropdown(
    current: Orientation,
    onSelected: (Orientation) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val highlighted = current.requiresOverlay

    Box {
        TextButton(onClick = { expanded = true }) {
            Text(
                text = current.label,
                color = if (highlighted) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.onSurfaceVariant
            )
            Icon(Icons.Filled.ArrowDropDown, contentDescription = "방향 선택")
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            Orientation.entries.forEach { orientation ->
                DropdownMenuItem(
                    text = { Text(orientation.label) },
                    onClick = {
                        expanded = false
                        onSelected(orientation)
                    }
                )
            }
        }
    }
}
