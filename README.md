# gallery-ii

Nest.js + Angular + MariaDB gallery application.

## Local Docker start

```powershell
.\scripts\build-image.ps1
docker compose up -d
```

The application is available at `http://localhost:3000`.

Default compose login:

- email: `admin@example.com`
- password: `change-me`

Swagger/OpenAPI is available at `http://localhost:3000/docs` and the raw spec at
`http://localhost:3000/docs-json`.

## OpenAPI client generation

Start the backend, then run:

```powershell
cd frontend
npm run generate:api
```

The generated Angular client is written to `frontend/src/app/api`.

## Local backend start

When running the backend outside Docker, copy `backend/.env.example` to
`backend/.env` first. The local MariaDB port is `3307`; inside Docker the backend
still uses the service port `3306`.
