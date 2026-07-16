# Account deletion

1. Reauthenticate the account owner.
2. Set `Account.deletedAt`, then delete the Supabase identity and public `Profile`.
3. Anonymize results by removing the username and identity links.
4. End or anonymize active matches and verify that the database and telemetry contain no email address, phone number, or username.
5. Confirm completion within the timeframe specified by the privacy policy.
