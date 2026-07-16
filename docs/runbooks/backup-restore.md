# Backup and restore

## Backup

1. Create an encrypted provider snapshot and a logical database dump: `pg_dump --format=custom --no-owner --file=dominoes.dump "$DATABASE_URL"`.
2. Record the schema migration commit and the file checksum in secure storage.
3. Do not include `.env`, JWTs, guest cookies, or invite URLs in the archive.

## Restore drill

1. Create an empty, isolated PostgreSQL database with the same major version.
2. Run `pg_restore --clean --if-exists --no-owner --dbname="$RESTORE_DATABASE_URL" dominoes.dump`.
3. Run `prisma migrate status`, a health check, and reads of several matches and profiles.
4. Compare the row counts of key tables and replay the most recently completed match.
5. Delete the drill database and record the RPO/RTO. Perform this drill at least once per quarter.
