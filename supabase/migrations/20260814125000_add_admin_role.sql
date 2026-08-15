-- Must be its own migration: Postgres does not allow a new enum value to be
-- referenced in the same transaction that adds it.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
