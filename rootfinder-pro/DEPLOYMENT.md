# 🚀 Despliegue de RootFinder Pro

## Problema Actual
Tu app funciona en desarrollo pero falla en producción porque GitHub Pages no puede ejecutar el backend Node/Express. Necesitas separar frontend y backend.

## ✅ Solución: Frontend en GitHub Pages + Backend en Render

### Paso 1: Desplegar Backend en Render

1. Ve a [render.com](https://render.com) y crea una cuenta gratuita
2. Conecta tu repositorio de GitHub
3. Crea un nuevo **Web Service** con esta configuración:
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build:server`
   - **Start Command**: `npm run start:api`
   - **Environment Variables**:
     - `NODE_ENV=production`
     - `JWT_SECRET` (genera uno aleatorio)
     - `BREVO_API_KEY` (tu API key de Brevo)
     - `BREVO_SENDER_EMAIL` (tu email verificado en Brevo)
     - `GEMINI_API_KEY` (opcional)
     - `DATABASE_URL` (opcional, para PostgreSQL)

4. Una vez desplegado, Render te dará una URL como: `https://tu-app.onrender.com`

### Paso 2: Configurar Frontend para apuntar al Backend

1. Crea un archivo `.env.production` en la raíz del proyecto:
   ```
   VITE_API_BASE_URL=https://tu-app.onrender.com
   ```

2. Compila el frontend con la nueva configuración:
   ```bash
   npm run build
   npm run deploy
   ```

### Paso 3: Verificar que funciona

1. Tu frontend estará en: `https://Israel124.github.io/RootFinderMN/`
2. El backend estará en: `https://tu-app.onrender.com`
3. Las llamadas API irán del frontend al backend

## 🔧 Comandos para probar localmente

```bash
# Backend solo (puerto 10000)
npm run dev:api

# Frontend solo (puerto 4000)
npm run dev

# Build completo
npm run build
```

## 📝 Notas Importantes

- El backend usa archivos JSON locales para persistencia (sin base de datos)
- Render tiene un límite gratuito de 750 horas/mes
- Si excedes el límite, el backend se "duerme" y tarda ~30s en despertar
- Para producción real, considera usar una base de datos como PostgreSQL

## 🐛 Si algo falla

1. Revisa los logs en Render
2. Verifica que `VITE_API_BASE_URL` apunte correctamente
3. Asegúrate de que el CORS esté configurado en el backend