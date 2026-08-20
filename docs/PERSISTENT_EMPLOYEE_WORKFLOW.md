# Persistent employee workflow

The employee workflow is backed by Cloudflare D1. Requests are created as `pending`, reviewed by a manager/owner, and only an approved request can be confirmed by the employee. Notifications are persisted in D1 and scoped by user id so they survive logout and device refresh.

## Tables
- `employee_requests`: permission, leave, and checkout requests plus approval state.
- `notifications`: durable per-user notifications with read state.

## API
- `GET /api/employee/:employeeId/history`
- `POST /api/employee/:employeeId/requests`
- `POST /api/employee-requests/:requestId/review`
- `POST /api/employee-requests/:requestId/confirm`
- `GET /api/notifications/:userId`
- `POST /api/notifications/:userId/read`

The frontend should call these APIs instead of relying on localStorage for durable workflow state. Web Push remains an optional delivery layer; D1 is the source of truth.
