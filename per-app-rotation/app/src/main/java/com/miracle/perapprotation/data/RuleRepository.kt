package com.miracle.perapprotation.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
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

    // Sentinel keys (not real package names) for app-level settings.
    private val forceRotationKey = booleanPreferencesKey("__force_rotation_enabled__")
    private val onboardingDoneKey = booleanPreferencesKey("__onboarding_done__")

    /** Emits the full rule map whenever it changes. */
    val rulesFlow: Flow<Map<String, Orientation>> =
        appContext.rotationDataStore.data.map { prefs ->
            buildMap {
                prefs.asMap().forEach { (key, value) ->
                    // Skip non-rule keys (e.g. the boolean force-rotation toggle).
                    val orientation = Orientation.fromNameOrDefault(value as? String)
                    if (orientation.requiresOverlay) {
                        put(key.name, orientation)
                    }
                }
            }
        }

    /** Emits whether the stronger "forced system rotation" engine is enabled. */
    val forceRotationFlow: Flow<Boolean> =
        appContext.rotationDataStore.data.map { prefs -> prefs[forceRotationKey] ?: false }

    suspend fun setForceRotation(enabled: Boolean) {
        appContext.rotationDataStore.edit { prefs -> prefs[forceRotationKey] = enabled }
    }

    /** Emits whether the user has completed (dismissed) the onboarding screen at least once. */
    val onboardingDoneFlow: Flow<Boolean> =
        appContext.rotationDataStore.data.map { prefs -> prefs[onboardingDoneKey] ?: false }

    suspend fun setOnboardingDone(done: Boolean) {
        appContext.rotationDataStore.edit { prefs -> prefs[onboardingDoneKey] = done }
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
