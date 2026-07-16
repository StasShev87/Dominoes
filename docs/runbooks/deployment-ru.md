# Deployment runbook

1. Выполнить `pnpm check`, Prisma validation и snapshot PostgreSQL.
2. Развернуть API; startup-команда выполняет `prisma migrate deploy`.
3. Проверить `/v1/health`, AI-матч, guest-cookie и Socket.IO `/matches`.
4. Развернуть web с production API/Supabase URL.
5. Проверить три локали, приватную ссылку во втором контексте и reconnect.

Rollback: вернуть предыдущие API image и web deployment. Destructive migrations выпускаются отдельным двухэтапным релизом.
