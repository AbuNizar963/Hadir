# Android releases and in-app updates

Hadir Android updates are distributed through GitHub Releases in this repository. The Flutter updater reads public releases and accepts tags in this exact format:

`android-v1.0.N`

The numeric suffix `N` is both the Android `versionCode` and the final component of `versionName` (`1.0.N`). It must be greater than the version already installed on devices. The release workflow rejects malformed tags and tags that do not point to a commit already present on `flutter-mobile-app`.

## Publishing a release

1. Complete and merge the Flutter changes into `flutter-mobile-app`.
2. Confirm the Flutter Actions checks pass.
3. Create a new tag on the intended Flutter commit using the next unused number greater than every existing Android release tag (the latest published release currently uses `1043`, so the next number must be at least `1044`): for example, `android-v1.0.1044`.
4. Push the tag to GitHub. The `Publish Android Release` workflow runs analysis, tests, builds the Android APKs, verifies package identity/version/signatures, and publishes the GitHub Release.
5. Confirm the published release contains `app-universal-release.apk`, any ABI-specific APKs, and `SHA256SUMS`.

The app updater chooses an ABI-specific APK when available and falls back to the universal APK. The Atom-feed fallback also downloads the universal APK.

## Required GitHub Actions secrets

Configure these repository Actions secrets before publishing:

- `HADIR_RELEASE_KEYSTORE_BASE64`: Base64-encoded Android release keystore.
- `HADIR_RELEASE_STORE_PASSWORD`: keystore password.
- `HADIR_RELEASE_KEY_ALIAS`: signing key alias.
- `HADIR_RELEASE_KEY_PASSWORD`: signing key password.

Never commit the keystore, passwords, or decoded key file to the repository. The workflow fails before building if a required secret is missing.

**Signing-key continuity is mandatory.** Use the same keystore/certificate that signed the currently distributed Hadir app. Replacing it with a newly generated key can prevent Android from installing an update over an existing installation. Do not rotate or replace the signing key as part of routine release setup.

## Release scope

This workflow publishes Android APKs for the in-app updater. iOS distribution remains separate and continues to use the existing Flutter/iOS validation workflow.
