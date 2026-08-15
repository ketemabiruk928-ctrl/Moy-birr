CREATE OR REPLACE FUNCTION public.ensure_my_account(_full_name text DEFAULT NULL, _phone text DEFAULT NULL, _role public.app_role DEFAULT NULL)
RETURNS public.app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  r public.app_role;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (uid, COALESCE(NULLIF(_full_name, ''), ''), COALESCE(NULLIF(_phone, ''), ''))
  ON CONFLICT (id) DO UPDATE
    SET full_name = CASE WHEN public.profiles.full_name = '' THEN COALESCE(NULLIF(_full_name, ''), '') ELSE public.profiles.full_name END,
        phone = CASE WHEN public.profiles.phone = '' THEN COALESCE(NULLIF(_phone, ''), '') ELSE public.profiles.phone END;

  SELECT role INTO r FROM public.user_roles WHERE user_id = uid LIMIT 1;
  IF r IS NULL THEN
    r := COALESCE(_role, 'guest');
    INSERT INTO public.user_roles (user_id, role) VALUES (uid, r) ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.wallets (user_id, balance) VALUES (uid, 0)
  ON CONFLICT (user_id) DO NOTHING;

  IF r = 'staff' THEN
    INSERT INTO public.staff_profiles (user_id) VALUES (uid) ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_my_account(text, text, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_account(text, text, public.app_role) TO authenticated;