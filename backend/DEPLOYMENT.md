# Cloudflare deployment notes

The backend is deployed as the `hadir-api` Cloudflare Worker with D1 binding `DB`.

Required GitHub Actions secrets:
- `CLOUDFLARE_API_TOKEN`: Cloudflare API Token with permission to manage Workers and D1 for the account.
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID containing the Worker and D1 database.
- `JWT_SECRET` (optional): JWT signing secret. The deployment workflow generates one if omitted.
- `HADIR_API_URL` (optional for deployment verification): public Worker URL used by the health check and frontend. If omitted from the frontend workflow, the frontend uses the default `https://hadir-api.abunizar963.workers.dev`.

Never commit any of these secret values to the repository.
