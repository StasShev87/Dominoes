# Incident response

1. Record the time, endpoints, and match IDs without copying JWTs or invite tokens.
2. If credentials are exposed, rotate `GUEST_SESSION_SECRET` and the Supabase keys, then revoke sessions.
3. If state is corrupted, stop match creation and take a PostgreSQL snapshot; do not edit the event log manually.
4. Restore the latest verified image and check health, migrations, and a synthetic match.
5. Document the cause, scope, fix, and preventive test without including personal data.
