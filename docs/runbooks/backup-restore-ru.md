# Backup and restore

## Backup

1. Создать encrypted provider snapshot и логически выгрузить БД: `pg_dump --format=custom --no-owner --file=dominoes.dump "$DATABASE_URL"`.
2. Записать schema migration commit и checksum файла в защищённое хранилище.
3. Не включать `.env`, JWT, guest cookies или invite URLs в архив.

## Restore drill

1. Создать пустую изолированную PostgreSQL БД той же major-версии.
2. Выполнить `pg_restore --clean --if-exists --no-owner --dbname="$RESTORE_DATABASE_URL" dominoes.dump`.
3. Запустить `prisma migrate status`, health-check и чтение нескольких матчей/профилей.
4. Сравнить количество строк ключевых таблиц и replay последнего завершённого матча.
5. Удалить drill-БД и зафиксировать RPO/RTO. Проверку выполнять не реже раза в квартал.
