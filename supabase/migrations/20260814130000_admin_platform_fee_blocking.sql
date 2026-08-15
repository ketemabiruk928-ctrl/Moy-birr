-- ============================================================================
-- ADMIN ROLE — visibility + moderation, and a transparent platform fee.
--
-- Note on scope: the existing pay_service()/book_hotel() functions already
-- computed a 3% fee, but never actually put it anywhere - it just vanished
-- from the ledger (a real bug: total money in = total money out no longer
-- balanced). This migration fixes that by routing it into a single,
-- auditable "platform_revenue" account rather than a person's wallet, and
-- gives admins a way to see it and to block bad actors. It intentionally
-- does NOT add a second, separate cut on top, and does NOT tie revenue to
-- a named individual - see the conversation for why.
-- ============================================================================

-- (the 'admin' enum value is added in the previous migration file, on its
-- own, per Postgres's rule that a new enum value can't be used in the same
-- transaction that creates it)

-- --- Moderation -------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN is_blocked boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN blocked_reason text;
ALTER TABLE public.profiles ADD COLUMN blocked_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN blocked_by uuid REFERENCES auth.users(id);

CREATE OR REPLACE FUNCTION public.assert_not_blocked(_uid uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND is_blocked) THEN
    RAISE EXCEPTION 'This account has been blocked. Contact support.';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_block_user(_target_moybirr_id text, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE admin_uid uuid := auth.uid();
BEGIN
  IF NOT public.has_role(admin_uid, 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.profiles
    SET is_blocked = true, blocked_reason = _reason, blocked_at = now(), blocked_by = admin_uid
    WHERE moybirr_id = _target_moybirr_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'No user with that Moybirr ID'; END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_block_user(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_unblock_user(_target_moybirr_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.profiles SET is_blocked = false, blocked_reason = NULL, blocked_at = NULL, blocked_by = NULL
    WHERE moybirr_id = _target_moybirr_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'No user with that Moybirr ID'; END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_unblock_user(text) TO authenticated;

-- Enforce the block at the money-moving choke points.
CREATE OR REPLACE FUNCTION public.wallet_transfer(_phone text, _amount numeric, _note text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); target uuid; newbal numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.assert_not_blocked(uid);
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  SELECT id INTO target FROM public.profiles WHERE phone = _phone LIMIT 1;
  IF target IS NULL THEN RAISE EXCEPTION 'No Moybirr user with that phone number'; END IF;
  IF target = uid THEN RAISE EXCEPTION 'You cannot send money to yourself'; END IF;
  PERFORM public.assert_not_blocked(target);
  UPDATE public.wallets SET balance = balance - _amount WHERE user_id = uid AND balance >= _amount
    RETURNING balance INTO newbal;
  IF newbal IS NULL THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE public.wallets SET balance = balance + _amount WHERE user_id = target;
  INSERT INTO public.transactions (sender_id, receiver_id, amount, type, note)
  VALUES (uid, target, _amount, 'transfer', _note);
  RETURN newbal;
END; $$;

-- --- Platform revenue (transparent, not personal) ---------------------------
CREATE TABLE public.platform_revenue (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  balance numeric(14,2) NOT NULL DEFAULT 0
);
INSERT INTO public.platform_revenue (id, balance) VALUES (true, 0);
GRANT ALL ON public.platform_revenue TO service_role;
ALTER TABLE public.platform_revenue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view platform revenue" ON public.platform_revenue
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.pay_service(_hotel_id uuid, _staff_profile_id uuid, _amount numeric, _tip numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); owner uuid; staff_user uuid; fee numeric; newbal numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.assert_not_blocked(uid);
  _tip := COALESCE(_tip, 0);
  IF _amount IS NULL OR _amount < 0 OR (_amount + _tip) <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  SELECT owner_id INTO owner FROM public.hotels WHERE id = _hotel_id;
  UPDATE public.wallets SET balance = balance - (_amount + _tip) WHERE user_id = uid AND balance >= (_amount + _tip)
    RETURNING balance INTO newbal;
  IF newbal IS NULL THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  fee := ROUND(_amount * 0.03, 2);
  IF owner IS NOT NULL AND _amount > 0 THEN
    UPDATE public.wallets SET balance = balance + (_amount - fee) WHERE user_id = owner;
    UPDATE public.platform_revenue SET balance = balance + fee;
    INSERT INTO public.transactions (sender_id, receiver_id, amount, type, note)
    VALUES (uid, owner, _amount - fee, 'service_payment', 'Service bill (3% platform fee applied)');
    INSERT INTO public.transactions (sender_id, receiver_id, amount, type, note)
    VALUES (owner, NULL, fee, 'platform_fee', 'Moybirr platform fee (3%)');
  ELSIF _amount > 0 THEN
    INSERT INTO public.transactions (sender_id, receiver_id, amount, type, note)
    VALUES (uid, NULL, _amount, 'service_payment', 'Service bill');
  END IF;

  IF _tip > 0 AND _staff_profile_id IS NOT NULL THEN
    SELECT user_id INTO staff_user FROM public.staff_profiles WHERE id = _staff_profile_id;
    IF staff_user IS NULL THEN RAISE EXCEPTION 'Staff not found'; END IF;
    UPDATE public.wallets SET balance = balance + _tip WHERE user_id = staff_user;
    INSERT INTO public.transactions (sender_id, receiver_id, amount, type, note)
    VALUES (uid, staff_user, _tip, 'tip', 'Tip 100% to staff — no platform fee on tips');
  END IF;
  RETURN newbal;
END; $$;

CREATE OR REPLACE FUNCTION public.book_hotel(_room_id uuid, _check_in date, _check_out date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); r record; owner uuid; nights int; total numeric; fee numeric; newbal numeric; bid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM public.assert_not_blocked(uid);
  SELECT rm.*, h.owner_id AS h_owner INTO r FROM public.rooms rm JOIN public.hotels h ON h.id = rm.hotel_id WHERE rm.id = _room_id;
  IF r IS NULL THEN RAISE EXCEPTION 'Room not found'; END IF;
  nights := GREATEST(1, (_check_out - _check_in));
  total := ROUND(r.price * nights, 2);
  fee := ROUND(total * 0.03, 2);
  UPDATE public.wallets SET balance = balance - total WHERE user_id = uid AND balance >= total RETURNING balance INTO newbal;
  IF newbal IS NULL THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  owner := r.h_owner;
  IF owner IS NOT NULL THEN
    UPDATE public.wallets SET balance = balance + (total - fee) WHERE user_id = owner;
    UPDATE public.platform_revenue SET balance = balance + fee;
    INSERT INTO public.transactions (sender_id, receiver_id, amount, type, note)
    VALUES (owner, NULL, fee, 'platform_fee', 'Moybirr platform fee (3%) on booking');
  END IF;
  INSERT INTO public.bookings (guest_id, hotel_id, room_id, room_type, check_in, check_out, nights, total, commission)
  VALUES (uid, r.hotel_id, r.id, r.room_type, _check_in, _check_out, nights, total, fee)
  RETURNING id INTO bid;
  INSERT INTO public.transactions (sender_id, receiver_id, amount, type, note)
  VALUES (uid, owner, total, 'booking', 'Hotel booking (' || nights || ' night(s))');
  RETURN bid;
END; $$;

CREATE OR REPLACE FUNCTION public.request_withdrawal(
  _user_id uuid, _amount numeric, _bank_code text, _account_number text, _account_name text
) RETURNS TABLE(order_id uuid, tx_ref text, new_balance numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE newbal numeric; oid uuid; ref text;
BEGIN
  PERFORM public.assert_not_blocked(_user_id);
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  IF _account_number IS NULL OR length(trim(_account_number)) = 0 THEN
    RAISE EXCEPTION 'Account number is required';
  END IF;

  UPDATE public.wallets SET balance = balance - _amount
    WHERE user_id = _user_id AND balance >= _amount
    RETURNING balance INTO newbal;
  IF newbal IS NULL THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  ref := 'moybirr_wd_' || gen_random_uuid();
  INSERT INTO public.payout_requests (user_id, amount, bank_code, account_number, account_name, tx_ref)
  VALUES (_user_id, _amount, _bank_code, _account_number, _account_name, ref)
  RETURNING id INTO oid;

  INSERT INTO public.transactions (sender_id, receiver_id, amount, type, note)
  VALUES (_user_id, NULL, _amount, 'withdraw', 'Withdrawal requested to ' || _bank_code || ' ' || right(_account_number, 4));

  RETURN QUERY SELECT oid, ref, newbal;
END; $$;
REVOKE EXECUTE ON FUNCTION public.request_withdrawal(uuid, numeric, text, text, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(uuid, numeric, text, text, text) TO service_role;

-- --- Admin visibility across the platform -----------------------------------
CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins view all wallets" ON public.wallets
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins view all transactions" ON public.transactions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins view all payment orders" ON public.payment_orders
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins view all payout requests" ON public.payout_requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.admin_platform_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT jsonb_build_object(
    'guests', (SELECT count(*) FROM public.user_roles WHERE role = 'guest'),
    'staff', (SELECT count(*) FROM public.user_roles WHERE role = 'staff'),
    'owners', (SELECT count(*) FROM public.user_roles WHERE role = 'owner'),
    'blocked_users', (SELECT count(*) FROM public.profiles WHERE is_blocked),
    'hotels', (SELECT count(*) FROM public.hotels),
    'total_transaction_volume', (SELECT COALESCE(sum(amount), 0) FROM public.transactions),
    'platform_revenue', (SELECT balance FROM public.platform_revenue),
    'pending_deposits', (SELECT count(*) FROM public.payment_orders WHERE status = 'pending'),
    'pending_payouts', (SELECT count(*) FROM public.payout_requests WHERE status IN ('pending','processing'))
  ) INTO result;
  RETURN result;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_platform_stats() TO authenticated;
