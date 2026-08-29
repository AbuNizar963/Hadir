# Hadir + Cloudflare D1

The application uses GitHub Pages for the UI and a Cloudflare Worker + D1 for durable multi-device data.

## D1

Database name: `Hadir`

The Worker binding is already configured in `backend/wrangler.toml` with the D1 database ID supplied for this project.

## GitHub Actions secrets

Add these repository Actions secrets before enabling the deployment workflows:

- `CLOUDFLARE_API_TOKEN` — API token allowed to deploy Workers and manage the Worker secrets.
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID.
- `HADIR_JWT_SECRET` — long random secret, at least 32 bytes.
- `HADIR_OWNER_USERNAME` — initial owner username.
- `HADIR_OWNER_PASSWORD` — initial owner password.
- `VITE_API_URL` — the deployed Worker URL, for example `https://hadir-api.<your-subdomain>.workers.dev`.

Do not put any of these values in source files.

## Deployment order

1. Push the backend workflow and let `Deploy Hadir API to Cloudflare Workers` finish.
2. Open Cloudflare Workers and copy the public URL for `hadir-api`.
3. Save that URL as the GitHub Actions secret `VITE_API_URL`.
4. Run the Pages deployment workflow again.

## Data behavior

D1 is the authoritative store for employees, attendance, requests, audit records, settings and locations. The browser may keep a local session/cache, but publishing a new GitHub version does not reset D1.

The Worker initializes missing tables with `CREATE TABLE IF NOT EXISTS`; it does not drop or reset existing tables.

Employee authentication is device-aware: the first successful login can bind the device, and the API rejects a different device until management resets the device binding.

## Security

Passwords/PINs created through the API are derived server-side with PBKDF2-HMAC-SHA-256 and a random salt. JWT signing uses the Worker-only `JWT_SECRET`. Cloudflare credentials and application secrets must remain GitHub Actions/Cloudflare secrets.
