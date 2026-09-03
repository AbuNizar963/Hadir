# Hadir Android

Hadir remains a web-first PWA. The Android package in `mobile/android` is a separate Trusted Web Activity (TWA) shell, so the existing React frontend, Worker API, D1 database, authentication, notifications, Gemini integration, and service worker remain unchanged.

## Why this exists

Chrome-generated WebAPKs are controlled by Chrome's Android WebAPK runtime. The Android package in this directory is built as a real Android application instead, with an explicit `targetSdk 36` for Android 16. This avoids tying Hadir's distributable APK to Chrome's WebAPK target SDK.

## Architecture

- **Web application:** existing Vite/React PWA; no business logic is duplicated.
- **Android shell:** Trusted Web Activity backed by `android-browser-helper`.
- **Production origin:** `https://hadir-9rq.pages.dev/`.
- **Android package ID:** `com.hadir.attendance`.
- **Minimum Android:** API 23.
- **Target Android:** API 36.

## Build

The workflow `.github/workflows/build-android-twa.yml` is manual by design. It does not run as part of the existing frontend/API deployment workflows and therefore cannot change the current web deployment accidentally.

The workflow:

1. Installs Android 16 SDK / Build Tools.
2. Builds the native TWA shell.
3. Signs the APK with a temporary CI key for validation/testing.
4. Verifies the resulting APK has `targetSdkVersion=36`.
5. Publishes the installable APK as a GitHub Actions artifact.

The temporary CI signing key is intentionally not suitable for production updates. Before public distribution or Play Store publishing, use a permanent signing key stored in GitHub Secrets and publish its SHA-256 certificate fingerprint in the production Digital Asset Links file.

## Digital Asset Links

A production TWA should expose `/.well-known/assetlinks.json` from the same HTTPS origin. The file must contain the final Android package ID and the SHA-256 fingerprint of the certificate that signs the distributed application. Do not commit a private signing key or private key password.

Until the permanent signing fingerprint is configured on the production domain, the native APK can still be used for target-SDK validation, but TWA domain verification may fall back from the trusted fullscreen experience.

## Important

Do not replace the existing PWA with this Android shell. The shell is an additional distribution channel. The current web application and its deployment remain the source of truth for Hadir's application behavior.
