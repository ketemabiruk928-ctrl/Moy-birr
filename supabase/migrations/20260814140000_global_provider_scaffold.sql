-- ============================================================================
-- GLOBAL READINESS SCAFFOLD
--
-- Being honest about what "works worldwide" actually requires: every
-- country has its own money-transmission rules, and Chapa only operates
-- Ethiopian rails. There is no code change that makes Moybirr legally able
-- to move money in, say, Kenya or the US - that needs a licensed provider
-- (or your own license) in each place. What this migration adds is the
-- plumbing so expansion is a config change instead of a rewrite: a country
-- gets marked "live" only once a real provider is wired up for it. Until
-- then, users from other countries see an honest "not available in your
-- country yet" instead of a checkout that silently fails.
-- ============================================================================

ALTER TABLE public.profiles ADD COLUMN country_code text NOT NULL DEFAULT 'ET';
ALTER TABLE public.hotels ADD COLUMN country_code text NOT NULL DEFAULT 'ET';

CREATE TABLE public.payment_provider_config (
  country_code text PRIMARY KEY,
  provider text NOT NULL,      -- e.g. 'chapa'; add rows as real providers get integrated
  currency text NOT NULL,      -- settlement currency for that country
  is_live boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.payment_provider_config TO authenticated, anon;
GRANT ALL ON public.payment_provider_config TO service_role;
ALTER TABLE public.payment_provider_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Provider config is public read" ON public.payment_provider_config FOR SELECT USING (true);

INSERT INTO public.payment_provider_config (country_code, provider, currency, is_live)
VALUES ('ET', 'chapa', 'ETB', true);
-- Add more rows as you integrate real rails for a country, e.g.:
--   INSERT INTO public.payment_provider_config VALUES ('KE', 'flutterwave', 'KES', false);
-- Flip is_live to true only once that integration is actually tested end to end.
