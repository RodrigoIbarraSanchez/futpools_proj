# Quinielas de Fútbol

App de quinielas con backend Node.js + MongoDB y app iOS (SwiftUI) con estética tipo Draftea.

## Por qué hay 4 procesos/servidores

1. **Backend principal** (`futpools_backend`, puerto **3000**): API usada por la **app iOS** y por la **app web** (quinielas, auth, fixtures, leaderboard). Es la fuente de verdad.
2. **Servidor del dashboard** (`futpools_dashboard/server`, puerto **4000**): API para el **panel web** (crear/editar/eliminar quinielas, auth de admin). Puede usar la misma MongoDB que el backend o una propia.
3. **Frontend del dashboard** (`futpools_dashboard/web`, puerto **5173**): Vite/React para el Quiniela Builder (lista de quinielas, formularios, etc.). Llama al servidor del dashboard (4000).
4. **Futpools Web** (`futpools_web`, puerto **5174**): App web móvil (Vite/React) que replica la app iOS: login, quinielas, mis entradas, perfil. Usa el backend 3000 (proxy `/api`).

Si la app elimina una quiniela vía el backend 3000, esa quiniela desaparece de la base. Si el dashboard (4000) usa la misma base, al intentar borrar ese mismo id ya no existe y antes devolvía 404; ahora el DELETE es idempotente (204 aunque ya no exista) y el frontend trata 404 como éxito para no bloquear al usuario.

## Arranque en un comando (todo el stack)

Desde la raíz del repo:

```bash
./run-all.sh
```

Esto hace automáticamente:
- crea `.env` faltantes desde `.env.example` (backend + dashboard server + dashboard web),
- instala dependencias si no existe `node_modules`,
- levanta los 4 servicios:
  - Backend: `http://localhost:3000`
  - Dashboard server: `http://localhost:4000`
  - Dashboard web: `http://localhost:5173`
  - Futpools Web (app móvil): `http://localhost:5174`

Para apagar todo, presiona `Ctrl + C` en la terminal donde corre el script.
Los logs quedan en `.run/logs/`.

> Nota: `http://localhost:3000` y `http://localhost:4000` son APIs; ver `Cannot GET /` en la raíz es normal. Usa rutas como `/health` o `/api/...`.

## Backend (`futpools_backend`)

1. Copia `.env.example` a `.env` y configura:
   - `MONGODB_URI`: URI de MongoDB (local o [MongoDB Atlas](https://www.mongodb.com/cloud/atlas))
   - `JWT_SECRET`: clave secreta para JWT
   - `API_FOOTBALL_KEY`: key de API-Football (para logos + estados live)
   - `API_FOOTBALL_SEASON`: temporada (ej: 2025)
   - `API_FOOTBALL_LEAGUES`: JSON con liga->id (ej: `{"LIGA_MX":262}`)
   - `API_FOOTBALL_POLL_MS`: intervalo de polling live (ms)
   - `PORT`: puerto (por defecto 3000)
   - `SETTINGS_API_KEY`: (opcional) clave para que el dashboard pueda actualizar settings (p. ej. URL del banner). Si la defines, `PUT /settings` exige el header `X-API-Key`.

2. Instala y ejecuta:
   ```bash
   cd futpools_backend && npm install && npm run dev
   ```

3. Carga datos de ejemplo (liga, jornada, partidos):
   ```bash
   npm run seed
   ```

## API

- `POST /auth/register` — Registro (email, password, displayName opcional)
- `POST /auth/login` — Login (email, password)
- `GET /users/me` — Usuario actual (Bearer token)
- `GET /leagues` — Lista de ligas
- `GET /matchdays` — Jornadas (query: `?league=id`)
- `GET /matchdays/:id` — Jornada con partidos
- `GET /matches?matchday=id` — Partidos de una jornada
- `POST /predictions` — Crear quiniela (Bearer token)
- `GET /predictions` — Mis quinielas (Bearer token)
- `GET /football/matchday/:id` — Fixtures con logos + live status
- `GET /settings` — Configuración de la app (p. ej. `bannerImageURL` para el banner del Home).
- `PUT /settings` — Actualizar settings (header `X-API-Key` si está definido `SETTINGS_API_KEY`).

## Banner del Home (iOS)

El banner que se muestra arriba en la pantalla Pools se configura desde el dashboard: **App banner (iOS home)**. Solo se guarda la **URL** de la imagen (no se sube el archivo al servidor). Así puedes cambiar la imagen cuando quieras (p. ej. en un CDN o hosting) sin tocar código.

**Medidas recomendadas para la imagen:** **1200×400 px** (relación 3:1). Así se ve bien en todos los dispositivos y la app la recorta con esa proporción.

Para que el dashboard pueda guardar la URL del banner, el backend principal debe tener `SETTINGS_API_KEY` en `.env` y el servidor del dashboard (`futpools_dashboard/server`) debe tener en su `.env`: `MAIN_BACKEND_URL=http://localhost:3000` y `SETTINGS_API_KEY=<la misma clave>`.

## App iOS (`futpoolsapp`)

1. Abre `futpoolsapp.xcodeproj` en Xcode.
2. Por defecto la app usa `http://localhost:3000`. En simulador suele funcionar. Si usas dispositivo físico, cambia la base URL en `Services/APIClient.swift` por la IP de tu Mac (y en el backend asegura CORS y que escuche en `0.0.0.0`).
3. Ejecuta el backend y `npm run seed`, luego corre la app: Login/Registro, listado de jornadas, hacer quiniela (1-X-2), Mis entradas y Perfil.

## App Web (`futpools_web`)

La app web (React/Vite, mobile-first) replica la funcionalidad de la app iOS. Se inicia con `./run-all.sh` junto al resto del stack, o solo la web:

```bash
cd futpools_web && npm install && npm run dev
```

Abre `http://localhost:5174`. Las peticiones a `/api/*` se redirigen al backend (3000). El backend debe estar en marcha para login, quinielas, etc.
