-- ============================================================================
-- REAL-MONEY SECURITY FIX, PART 2: WITHDRAWALS
--
-- The old wallet_withdraw() wasn't an exploit (it only ever deducted a
-- user's own already-real balance) but it was a dead end: the balance went
-- down and nothing then actually paid the money out to the user's bank or
-- Telebirr. From here, a withdrawal reserves the funds immediately (so you
-- can't request more than you have) and only marks itself "completed" once
-- Chapa's transfer actually succeeds. If the transfer fails, the funds are
-- returned to the wallet automatically.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.wallet_withdraw(numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.wallet_withdraw(numeric, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_withdraw(numeric, text) TO service_role;

CREATE TABLE public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  bank_code text NOT NULL,
  account_number text NOT NULL,
  account_name text NOT NULL,
  provider text NOT NULL DEFAULT 'chapa',
  tx_ref text NOT NULL UNIQUE,
  provider_ref text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','cancelled')),
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Users can only ever read their own payout history. Creating one and
-- resolving it both require touching a wallet balance, so both go through
-- service_role functions called from a server route that has already
-- verified who the caller is - never a direct client insert/update.
GRANT SELECT ON public.payout_requests TO authenticated;
GRANT ALL ON public.payout_requests TO service_role;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own payout requests" ON public.payout_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Reserves the money the moment a withdrawal is requested, so a user can't
-- fire off three withdrawals for more than they actually have while the
-- first one is still in flight with Chapa.
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  _user_id uuid, _amount numeric, _bank_code text, _account_number text, _account_name text
) RETURNS TABLE(order_id uuid, tx_ref text, new_balance numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE newbal numeric; oid uuid; ref text;
BEGIN
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

REVOKE EXECUTE ON FUNCTION public.request_withdrawal(uuid, numeric, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.request_withdrawal(uuid, numeric, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(uuid, numeric, text, text, text) TO service_role;

-- Called after we hear back from Chapa (either the immediate initiate
-- response, or the async transfer webhook). Idempotent either way.
CREATE OR REPLACE FUNCTION public.admin_finalize_payout(
  _order_id uuid, _success boolean, _provider_ref text, _failure_reason text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o record;
BEGIN
  SELECT * INTO o FROM public.payout_requests WHERE id = _order_id FOR UPDATE;
  IF o IS NULL THEN RAISE EXCEPTION 'Payout request not found'; END IF;
  IF o.status IN ('completed', 'failed') THEN RETURN; END IF; -- already resolved, no-op

  IF _success THEN
    UPDATE public.payout_requests
      SET status = 'completed', provider_ref = _provider_ref, completed_at = now()
      WHERE id = o.id;
  ELSE
    -- Transfer didn't go through - give the money back.
    UPDATE public.wallets SET balance = balance + o.amount WHERE user_id = o.user_id;
    UPDATE public.payout_requests
      SET status = 'failed', failure_reason = _failure_reason, completed_at = now()
      WHERE id = o.id;
    INSERT INTO public.transactions (sender_id, receiver_id, amount, type, note)
    VALUES (NULL, o.user_id, o.amount, 'deposit', 'Withdrawal to bank failed - refunded');
  END IF;
END; $$;

REVOKE EXECUTE ON FUNCTION public.admin_finalize_payout(uuid, boolean, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_finalize_payout(uuid, boolean, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_finalize_payout(uuid, boolean, text, text) TO service_role;
