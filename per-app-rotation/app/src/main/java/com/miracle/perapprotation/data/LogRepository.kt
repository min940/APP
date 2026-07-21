package com.miracle.perapprotation.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.File
import java.util.Calendar
import java.util.Locale

enum class LogLevel { INFO, SUCCESS, WARNING, ERROR }

data class LogEntry(
    val timeMillis: Long,
    val level: LogLevel,
    val message: String
) {
    /** "HH:MM:SS" formatted timestamp, computed without external date libs. */
    val timeStamp: String
        get() {
            val c = Calendar.getInstance().apply { timeInMillis = timeMillis }
            return String.format(
                Locale.US,
                "%02d:%02d:%02d",
                c.get(Calendar.HOUR_OF_DAY),
                c.get(Calendar.MINUTE),
                c.get(Calendar.SECOND)
            )
        }
}

/**
 * In-app log store (NOT logcat). Shared between the accessibility service, overlay controller
 * and the UI. Keeps at most [MAX_LINES] entries, dropping the oldest first.
 *
 * Never log sensitive content here — only package names and coarse state transitions.
 */
object LogRepository {

    private const val MAX_LINES = 1000

    private val _entries = MutableStateFlow<List<LogEntry>>(emptyList())
    val entries: StateFlow<List<LogEntry>> = _entries.asStateFlow()

    @Synchronized
    fun log(level: LogLevel, message: String) {
        val entry = LogEntry(System.currentTimeMillis(), level, message)
        val next = (_entries.value + entry)
        _entries.value = if (next.size > MAX_LINES) next.takeLast(MAX_LINES) else next
    }

    fun info(message: String) = log(LogLevel.INFO, message)
    fun success(message: String) = log(LogLevel.SUCCESS, message)
    fun warning(message: String) = log(LogLevel.WARNING, message)
    fun error(message: String) = log(LogLevel.ERROR, message)

    @Synchronized
    fun clear() {
        _entries.value = emptyList()
    }

    /**
     * Writes the current log buffer to `filesDir/logs/YYYYMMDD_HHMMSS.log`.
     * Uses internal storage, so no storage permission is required.
     *
     * @return the file written, or null if writing failed.
     */
    fun saveToFile(context: Context): File? = try {
        val dir = File(context.filesDir, "logs").apply { mkdirs() }
        val c = Calendar.getInstance()
        val name = String.format(
            Locale.US,
            "%04d%02d%02d_%02d%02d%02d.log",
            c.get(Calendar.YEAR),
            c.get(Calendar.MONTH) + 1,
            c.get(Calendar.DAY_OF_MONTH),
            c.get(Calendar.HOUR_OF_DAY),
            c.get(Calendar.MINUTE),
            c.get(Calendar.SECOND)
        )
        val file = File(dir, name)
        file.bufferedWriter().use { writer ->
            _entries.value.forEach { e ->
                writer.write("[${e.timeStamp}] ${e.level.name} ${e.message}")
                writer.newLine()
            }
        }
        file
    } catch (t: Throwable) {
        error("로그 저장 실패: ${t.message}")
        null
    }
}
