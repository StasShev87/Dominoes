# Incident response

1. Зафиксировать время, endpoints и match IDs, не копируя JWT или invite tokens.
2. При утечке сменить `GUEST_SESSION_SECRET`, Supabase keys и отозвать sessions.
3. При повреждении состояния остановить создание матчей и сделать PostgreSQL snapshot; event log вручную не редактировать.
4. Восстановить последний проверенный image и проверить health, миграции и синтетический матч.
5. Оформить причину, масштаб, исправление и preventive test без персональных данных.
