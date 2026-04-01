# QA Accounts

Use one dedicated authorized QA account for both manual testing and Playwright browser tests.

Recommended env vars for browser tests:

```bash
E2E_AUTHORIZED_EMAIL="your-authorized-qa-email@example.com"
E2E_AUTHORIZED_PASSWORD="your-qa-password"
```

The account must already exist in Supabase Auth and also have a role in `public.user_roles`.

One-time SQL to grant a QA account collaborator access:

```sql
insert into public.user_roles (user_id, role)
select id, 'collaborator'::public.app_role
from auth.users
where email = 'your-authorized-qa-email@example.com'
on conflict (user_id, role) do nothing;
```

Once that is done, the same QA account can:

- sign in manually on `www.continuityflow.com`
- upload and review documents manually
- run the authorized Playwright flow locally
