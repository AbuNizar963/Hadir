# Cloudflare deployment contract

The production backend is the `hadir-api` Cloudflare Worker. The Worker is the single API origin for the Hadir frontend and is deployed from `backend/src/entry.ts`.

Production origin:

`https://hadir-api.abunizar963.workers.dev`

Required GitHub Actions secrets:
- `CLOUDFLARE_API_TOKEN`: Cloudflare API token permitted to deploy Workers and manage the bound D1/R2 resources.
- `CLOUDFLARE_ACCOUNT_ID`: `7c2f371786ada855f514d223e48daa72`.
- `JWT_SECRET`: secret used only for the bootstrap JWT compatibility path.
- `OWNER_RECOVERY_CODE`: owner recovery secret.

The deployment workflow is the source of truth for production deployment. It must:

1. validate Cloudflare credentials;
2. validate the Worker bundle;
3. apply remote D1 migrations;
4. deploy the `hadir-api` Worker with D1, R2 and Durable Object bindings;
5. call `/api/health` on the canonical Worker URL and require a successful D1 health response;
6. call `/api/bootstrap` and accept only the expected `200` or `401` response.

The frontend must use the same canonical Worker origin. It must not depend on an untrusted or unrelated `VITE_API_URL` value.

Never commit Cloudflare tokens, JWT secrets, recovery codes, or other credentials to this repository.
