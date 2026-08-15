-- ============================================================================
-- REAL-MONEY SECURITY FIX
-- Problem: public.wallet_deposit() was callable directly by any authenticated
-- client and simply added the requested amount to their own balance. That's
-- a "mint free money" button. From now on, wallet balances only change on
-- deposit after a real payment has been verified server-side (Chapa), never
-- from a number the client sends.
-- ============================================================================

-- 1) Lock the old deposit function down to service_role only.
--    (We keep the function itself so nothing else in the schema breaks, but
--    an ordinary logged-in user can no longer call it.)
REVOKE EXECUTE ON FUNCTION public.wallet_deposit(numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.wallet_deposit(numeric, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_deposit(numeric, text) TO service_role;

-- 2) A record of every deposit attempt, created the moment a user starts a
--    deposit, verified only after the payment provider confirms it.
CREATE TABLE public.payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose text NOT NULL DEFAULT 'deposit' CHECK (purpose IN ('deposit')),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  provider text NOT NULL DEFAULT 'chapa',
  tx_ref text NOT NULL UNIQUE,
  provider_ref text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','failed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz
);

-- Users can see their own orders and create a *pending* request for
-- themselves, but they can never mark one verified or touch anyone else's -
-- only the server (service_role, after checking with Chapa) can do that.
GRANT SELECT, INSERT ON public.payment_orders TO authenticated;
GRANT ALL ON public.payment_orders TO service_role;
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own payment orders" ON public.payment_orders
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users create own pending payment orders" ON public.payment_orders
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');
-- Deliberately no UPDATE policy for authenticated: crediting a wallet must
-- go through admin_credit_wallet() below, called only from the verified
-- webhook handler with the service_role key.

-- 3) The only path that can ever add real money to a wallet: called from
--    the server after Chapa confirms the payment. Idempotent — calling it
--    twice for the same order (e.g. a retried webhook) does not double-credit.
CREATE OR REPLACE FUNCTION public.admin_credit_wallet(_order_id uuid, _provider_ref text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o record; newbal numeric;
BEGIN
  SELECT * INTO o FROM public.payment_orders WHERE id = _order_id FOR UPDATE;
  IF o IS NULL THEN RAISE EXCEPTION 'Payment order not found'; END IF;
  IF o.status = 'verified' THEN
    -- Already credited (duplicate webhook delivery) - no-op, return current balance.
    SELECT balance INTO newbal FROM public.wallets WHERE user_id = o.user_id;
    RETURN newbal;
  END IF;
  IF o.status <> 'pending' THEN RAISE EXCEPTION 'Payment order is not pending'; END IF;

  UPDATE public.wallets SET balance = balance + o.amount WHERE user_id = o.user_id
    RETURNING balance INTO newbal;
  IF newbal IS NULL THEN RAISE EXCEPTION 'Wallet not found for user'; END IF;

  UPDATE public.payment_orders
    SET status = 'verified', provider_ref = _provider_ref, verified_at = now()
    WHERE id = o.id;

  INSERT INTO public.transactions (sender_id, receiver_id, amount, type, note)
  VALUES (NULL, o.user_id, o.amount, 'deposit', 'Verified deposit via ' || o.provider || ' (' || _provider_ref || ')');

  RETURN newbal;
END; $$;

REVOKE EXECUTE ON FUNCTION public.admin_credit_wallet(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_credit_wallet(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_credit_wallet(uuid, text) TO service_role;

-- 4) Let a user mark their own still-pending order as cancelled (e.g. they
--    closed the checkout tab) — this never touches money, just bookkeeping.
CREATE OR REPLACE FUNCTION public.cancel_payment_order(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.payment_orders SET status = 'cancelled'
    WHERE id = _order_id AND user_id = uid AND status = 'pending';
END; $$;
GRANT EXECUTE ON FUNCTION public.cancel_payment_order(uuid) TO authenticated;
