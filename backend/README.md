# Quinn House API

Backend API and PostgreSQL schema for migrating the current `QuinnState` localStorage model to server-backed data without breaking the existing frontend.

## Local setup

```powershell
cd backend
copy .env.example .env
npm install
npm run migrate
npm run seed:legacy
npm run dev
```

## Environment

- `DATABASE_URL`: PostgreSQL connection string.
- `API_KEY`: optional shared key. When set, mutating and read API routes require `X-API-Key` or `Authorization: Bearer`.
- `CORS_ORIGIN`: comma-separated allowed frontend origins.

## Initial API surface

- `GET /health`
- `GET /api/v1/snapshot`
- `GET /api/v1/rooms`
- `GET /api/v1/rooms/:id`
- `PATCH /api/v1/rooms/:id`
- `GET /api/v1/invoices`
- `PATCH /api/v1/invoices/:id/status`
- `GET /api/v1/contracts`
- `GET /api/v1/settings`
- `PATCH /api/v1/settings`
- `GET /api/v1/events` for Server-Sent Events

The response shape is intentionally close to the current frontend state so `QuinnState` can be migrated one method at a time.
