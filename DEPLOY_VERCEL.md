# Despliegue en Vercel

1. Importa `guerrerodistribuidora2-droid/agape` en Vercel con el framework Next.js y Node.js 22 o superior.
2. Copia las variables necesarias de `.env.example` a Vercel (Production, Preview y Development según corresponda). Nunca subas `.env.local` ni pegues secretos en GitHub.
3. Ejecuta `npm run db:migrate:turso` desde un entorno seguro con `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` configuradas antes de recibir reservas.
4. Configura `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY` con credenciales S3 de Cloudflare R2. El panel admin carga imágenes de eventos, galería y comprobantes por medio del adaptador `lib/runtime-env.ts`.
5. Configura `PAYPHONE_TOKEN` y `PAYPHONE_STORE_ID` para pagos con tarjeta; `RESEND_API_KEY`, `AGAPE_EMAIL_FROM` y `AGAPE_TICKET_SIGNING_SECRET` para correos y QR; y las variables `AGAPE_ADMIN_*` para el acceso privado del organizador.
6. Define `SITE_BASE_URL` con el dominio final y vuelve a desplegar tras guardar las variables.

La base se conecta a Turso y el almacenamiento usa la API S3 de R2. Las credenciales deben guardarse en el panel de variables de entorno de Vercel, nunca en el repositorio.
