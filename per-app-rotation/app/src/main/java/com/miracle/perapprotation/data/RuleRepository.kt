package com.miracle.perapprotation.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/** DataStore instance scoped to the application context. */
private val Context.rotationDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "rotation_rules"
)

/**
 * Persists the per-app orientation rules (packageName -> [Orientation]) using Jetpack DataStore.
 *
 * Only packages with a non-[Orientation.DEFAULT] rule are stored; clearing a rule removes the key.
 */
class RuleRepository(private val appContext: Context) {

    /** Emits the full rule map whenever it changes. */
    val rulesFlow: Flow<Map<String, Orientation>> =
        appContext.rotationDataStore.data.map { prefs ->
            buildMap {
                prefs.asMap().forEach { (key, value) ->
                    val orientation = Orientation.fromNameOrDefault(value as? String)
                    if (orientation.requiresOverlay) {
                        put(key.name, orientation)
                    }
                }
            }
        }

    suspend fun setRule(packageName: String, orientation: Orientation) {
        val key = stringPreferencesKey(packageName)
        appContext.rotationDataStore.edit { prefs ->
            if (orientation == Orientation.DEFAULT) {
                prefs.remove(key)
            } else {
                prefs[key] = orientation.name
            }
        }
    }

    companion object {
        @Volatile
        private var instance: RuleRepository? = null

        fun get(context: Context): RuleRepository =
            instance ?: synchronized(this) {
                instance ?: RuleRepository(context.applicationContext).also { instance = it }
            }
    }
}
