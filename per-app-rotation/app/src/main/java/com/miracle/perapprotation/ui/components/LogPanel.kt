package com.miracle.perapprotation.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import com.miracle.perapprotation.data.LogEntry
import com.miracle.perapprotation.data.LogLevel
import com.miracle.perapprotation.ui.theme.logColors

@Composable
fun LogPanel(
    logs: List<LogEntry>,
    onSave: () -> Unit,
    onClear: () -> Unit,
    modifier: Modifier = Modifier
) {
    val listState = rememberLazyListState()

    // Auto-scroll to the newest entry.
    LaunchedEffect(logs.size) {
        if (logs.isNotEmpty()) listState.animateScrollToItem(logs.lastIndex)
    }

    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedButton(onClick = onSave, modifier = Modifier.weight(1f)) {
                Icon(Icons.Filled.Save, contentDescription = null)
                Spacer(Modifier.width(6.dp))
                Text("로그 저장")
            }
            OutlinedButton(onClick = onClear, modifier = Modifier.weight(1f)) {
                Icon(Icons.Filled.Delete, contentDescription = null)
                Spacer(Modifier.width(6.dp))
                Text("로그 지우기")
            }
        }

        if (logs.isEmpty()) {
            EmptyState("아직 기록된 로그가 없습니다.")
        } else {
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxWidth()
            ) {
                items(logs) { entry ->
                    LogLine(entry)
                }
            }
        }
    }
}

@Composable
private fun LogLine(entry: LogEntry) {
    val colors = logColors()
    val color = when (entry.level) {
        LogLevel.INFO -> MaterialTheme.colorScheme.onSurface
        LogLevel.SUCCESS -> colors.success
        LogLevel.WARNING -> colors.warning
        LogLevel.ERROR -> MaterialTheme.colorScheme.error
    }
    Text(
        text = "[${entry.timeStamp}] ${entry.message}",
        style = MaterialTheme.typography.labelSmall.copy(fontFamily = FontFamily.Monospace),
        color = color,
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp)
    )
}
