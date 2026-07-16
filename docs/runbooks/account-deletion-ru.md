# Account deletion

1. Повторно аутентифицировать владельца.
2. Установить `Account.deletedAt`, удалить Supabase identity и публичный `Profile`.
3. Обезличить результаты, удалив username и identity links.
4. Завершить/обезличить активные матчи и проверить отсутствие email, phone и username в БД и telemetry.
5. Подтвердить завершение в срок privacy policy.
