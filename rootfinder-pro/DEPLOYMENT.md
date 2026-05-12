# Despliegue en Render

La aplicación actual se despliega como un solo servicio Node que sirve:

- Backend Express
- Frontend compilado con Vite
- Autenticación y cookies en el mismo origen

## Configuración correcta en Render

Si usas `render.yaml`, el servicio debe quedar así:

- `buildCommand`: `npm install && npm run build`
- `startCommand`: `npm run start`

Variables mínimas:

- `NODE_ENV=production`
- `APP_ORIGIN=https://rootfindermn.onrender.com`
- `CORS_ORIGINS=https://rootfindermn.onrender.com`
- `JWT_SECRET=<valor seguro>`

Variables opcionales:

- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `DATABASE_URL`
- `GEMINI_API_KEY`

## Si configuraste el servicio manualmente en Render

Debes cambiarlo en el panel de Render. Subir a `main` no basta si el servicio sigue usando la configuración vieja.

Revisa estas dos líneas:

- Build Command: `npm install && npm run build`
- Start Command: `npm run start`

No debe usar:

- `npm run build:server`
- `npm run start:api`

Eso levanta solo el backend/API antigua y no la app integrada.

## Síntomas de configuración incorrecta

Si Render sigue con la configuración vieja, puedes ver alguno de estos síntomas:

- pantalla negra o app vacía
- el frontend nunca carga
- `/api/*` responde pero la interfaz no aparece
- sesión atascada al iniciar

## Nota sobre GitHub Pages

La arquitectura actual ya no necesita separar frontend en GitHub Pages y backend en Render para funcionar.

Si quieres usar un solo dominio en Render, esa es ahora la opción más directa.
