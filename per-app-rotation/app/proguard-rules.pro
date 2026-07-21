# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.kts.

# Keep the AccessibilityService entry point (referenced from AndroidManifest.xml).
-keep class com.miracle.perapprotation.service.RotationAccessibilityService { *; }

# Keep names of members used through reflection by DataStore, if any.
-keepclassmembers class * extends androidx.datastore.preferences.core.Preferences { *; }

# Compose already ships with consumer rules; nothing extra required for standard usage.
