# Futpools Web

Versión web mobile-first de la app Futpools (React), equivalente a la app iOS.

## Requisitos

- Node 18+
- Backend `futpools_backend` corriendo (por defecto en `http://localhost:3000`)

## Desarrollo

```bash
npm install
npm run dev
```

Abre `http://localhost:5174`. Las peticiones a `/api/*` se redirigen al backend.

## Variables de entorno

Crea `.env` en la raíz del proyecto (opcional):

- `VITE_API_URL`: URL base del API. Por defecto se usa el proxy `/api` (recomendado en dev).

Para producción, por ejemplo:

```env
VITE_API_URL=https://tu-backend.com
```

## Build

```bash
npm run build
```

La salida queda en `dist/`. Sirve la carpeta con cualquier estático (nginx, Vercel, etc.).

## Estructura

- **Mobile-first**: vista pensada para móvil; en pantallas grandes el contenido se centra (max-width 430px).
- **Mismas pantallas que iOS**: Login, Register, Pools (Home), Pool detail (Overview + Fixtures), Join & Pick, My Entries, Account, Settings.
- **Idiomas**: inglés y español (según configuración en Settings o idioma del dispositivo).
- **Recarga**: en web se muestra “Próximamente”; la recarga real está en la app iOS con IAP.
