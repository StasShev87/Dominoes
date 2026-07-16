# Deployment runbook

1. Run `pnpm check`, validate the Prisma schema, and create a PostgreSQL snapshot.
2. Deploy the API; the startup command runs `prisma migrate deploy`.
3. Verify `/v1/health`, an AI match, the guest cookie, and the Socket.IO `/matches` namespace.
4. Deploy the web app with the production API and Supabase URLs.
5. Verify all three locales, a private link in a second client context, and reconnection.

Rollback: restore the previous API image and web deployment. Release destructive migrations separately in two stages.
