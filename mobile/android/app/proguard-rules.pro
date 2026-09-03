# Hadir TWA uses the Android Browser Helper runtime.
# Keep this file intentionally minimal; the library ships its own consumer rules.

# Android Browser Helper dynamically enables its ManageDataLauncherActivity
# from LauncherActivity. R8 can otherwise rename the class (for example to P.d)
# while Android's manifest still exposes the original component name, causing
# PackageManager.setComponentEnabledSetting() to crash on app startup.
-keep class com.google.androidbrowserhelper.trusted.ManageDataLauncherActivity { *; }
