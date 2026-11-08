# Android releases and in-app updates

Hadir Android APK releases are built and published by one GitHub Actions workflow:

`.github/workflows/build-android-release.yml`

The workflow is the single publishing path for the in-app updater. It runs automatically when changes are pushed to `flutter-mobile-app`. It can also be started manually, but only when the selected workflow branch is `flutter-mobile-app`.

## Versioning

Each workflow run uses its GitHub Actions run number as the Android `versionCode` and publishes the matching `versionName` (`1.0.N`) under the release tag `android-v1.0.N`. The release is created against the exact commit checked out by the workflow.

Do not create Android release tags manually. Do not run the release workflow from `main` or another branch. The workflow checks the source branch before building.

## Build and publication checks

Before publishing, the workflow:

1. Installs the pinned Flutter stable version and Android SDK 36 build tools.
2. Runs `flutter pub get`, `flutter analyze`, and `flutter test`.
3. Confirms the production signing secrets are present without printing their values.
4. Builds the signed APKs for the supported ABIs and a universal APK.
5. Verifies the package name (`com.hadir.attendance`), target SDK (36), version code, version name, and APK signature.
6. Uploads the APK files as a workflow artifact and publishes them to the matching GitHub Release.

The universal APK is published as `app-release.apk`, with ABI-specific assets named `app-arm64-v8a-release.apk`, `app-armeabi-v7a-release.apk`, and `app-x86_64-release.apk`. The in-app updater selects a compatible ABI asset when available and otherwise uses the universal APK. GitHub's Release API supplies each asset's size and SHA-256 digest; the updater requires both before offering the download.

## Required GitHub Actions secrets

The workflow uses the existing repository Actions secrets:

- `ANDROID_KEYSTORE_BASE64`: Base64-encoded Android release keystore.
- `ANDROID_KEYSTORE_PASSWORD`: keystore password.
- `ANDROID_KEY_ALIAS`: signing key alias.
- `ANDROID_KEY_PASSWORD`: signing key password.

Never commit the keystore, passwords, or decoded key file to the repository. Never replace or rotate the signing key as part of routine release maintenance. Updates must use the same signing certificate as the installed production app.

## Other platforms

This workflow publishes Android APKs for the in-app updater only. iOS distribution and validation remain separate.
