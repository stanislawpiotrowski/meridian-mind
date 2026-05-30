-- Seed data for LOCAL Supabase stack only.
--
-- DO NOT run against the remote / linked project — this inserts a synthetic
-- row into auth.users which would pollute the live auth store. Manual remote
-- verification uses real signed-up accounts, not this seed.
--
-- Usage (once Docker / local stack is available):
--   supabase db reset                  # runs migrations then this file
--
-- Contents: one deterministic auth user, one set owned by that user, and 10
-- European capital flashcards inside it. Fully idempotent via fixed UUIDs +
-- ON CONFLICT DO NOTHING, so it can be re-run safely.

-- Fixed UUIDs let downstream tests reference them.
-- seed_user_id        : 00000000-0000-0000-0000-000000000001
-- seed_set_id         : 00000000-0000-0000-0000-000000000010

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'seed@meridian.local', crypt('seed-password-x9!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
  '', '', '', ''
) on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider, provider_id, identity_data,
  created_at, updated_at, last_sign_in_at
) values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'email',
  '00000000-0000-0000-0000-000000000001',
  '{"sub":"00000000-0000-0000-0000-000000000001","email":"seed@meridian.local","email_verified":true,"phone_verified":false}'::jsonb,
  now(), now(), now()
) on conflict (id) do nothing;

insert into sets (id, user_id, name) values (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'European Capitals (seed)'
) on conflict (id) do nothing;

insert into flashcards (set_id, user_id, name, latitude, longitude) values
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Warsaw',    52.2297,  21.0122),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Berlin',    52.5200,  13.4050),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Paris',     48.8566,   2.3522),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Madrid',    40.4168,  -3.7038),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Rome',      41.9028,  12.4964),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Lisbon',    38.7223,  -9.1393),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Amsterdam', 52.3676,   4.9041),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Vienna',    48.2082,  16.3738),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Prague',    50.0755,  14.4378),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Athens',    37.9838,  23.7275)
on conflict do nothing;
