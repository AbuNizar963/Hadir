# Hadir mobile roadmap

The web app is prepared as a PWA and keeps business logic in shared TypeScript modules. The recommended future native shell is Capacitor so the same React application can target Android and iOS without duplicating attendance logic.

## Native preparation
- Keep authentication, attendance, schedules, workforce APIs and realtime in `src/lib` and Worker APIs.
- Keep camera/QR, geolocation, notifications and secure storage behind small adapters so Capacitor plugins can replace browser APIs later.
- Do not put secrets in the mobile bundle; use the Worker as the trusted API boundary.
- Required native capabilities: camera, precise location, notifications, secure storage, background sync (where platform policy permits), and deep links.

## Integration preparation
The frontend exposes a provider-neutral integration event contract in `src/lib/integrations.ts`. Webhook consumers can be connected to n8n, Make, Zapier, Power Automate, custom systems, or a GitHub Actions bridge without coupling attendance code to a vendor.

## Suggested native commands when the project adopts Capacitor
`npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios`
then `npx cap init`, `npx cap add android`, `npx cap add ios`, and `npx cap sync`.

The repository intentionally does not add native binaries yet; this keeps the current web deployment stable while making the migration path explicit.
