-- ============================================================================
-- 1) MOYBIRR ID — every user gets a permanent, human-readable ID based on
--    their role the moment they register: MG-000001 (guest), MS-000001
--    (staff), MO-000001 (owner). Shown on their profile, printed on receipts,
--    and what an admin looks a user up by.
-- ============================================================================
ALTER TABLE public.profiles ADD COLUMN moybirr_id text UNIQUE;

CREATE SEQUENCE public.moybirr_guest_id_seq;
CREATE SEQUENCE public.moybirr_staff_id_seq;
CREATE SEQUENCE public.moybirr_owner_id_seq;
GRANT USAGE ON public.moybirr_guest_id_seq, public.moybirr_staff_id_seq, public.moybirr_owner_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.generate_moybirr_id(_role public.app_role)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n bigint; prefix text;
BEGIN
  IF _role = 'staff' THEN
    n := nextval('public.moybirr_staff_id_seq'); prefix := 'MS';
  ELSIF _role = 'owner' THEN
    n := nextval('public.moybirr_owner_id_seq'); prefix := 'MO';
  ELSE
    n := nextval('public.moybirr_guest_id_seq'); prefix := 'MG';
  END IF;
  RETURN prefix || '-' || lpad(n::text, 6, '0');
END; $$;

-- Backfill existing accounts so nobody is left without an id.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT pr.id, COALESCE((SELECT role FROM public.user_roles WHERE user_id = pr.id LIMIT 1), 'guest') AS role
    FROM public.profiles pr WHERE pr.moybirr_id IS NULL
  LOOP
    UPDATE public.profiles SET moybirr_id = public.generate_moybirr_id(p.role) WHERE id = p.id;
  END LOOP;
END $$;

-- Extend the signup trigger to assign one automatically going forward.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.app_role;
BEGIN
  r := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'guest');

  INSERT INTO public.profiles (id, full_name, phone, moybirr_id)
  VALUES (NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'full_name',''),
          COALESCE(NEW.raw_user_meta_data->>'phone',''),
          public.generate_moybirr_id(r))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, r) ON CONFLICT DO NOTHING;
  INSERT INTO public.wallets (user_id, balance) VALUES (NEW.id, 0) ON CONFLICT (user_id) DO NOTHING;

  IF r = 'staff' THEN
    INSERT INTO public.staff_profiles (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2) DUAL RECEIPTS — a receipts table so both sides of a transaction (payer
--    and the hotel/staff receiving it) each get their own durable, numbered
--    receipt record, not just a shared transactions row.
-- ============================================================================
CREATE TABLE public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_no text NOT NULL UNIQUE,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- who this copy belongs to
  role_on_receipt text NOT NULL CHECK (role_on_receipt IN ('payer','recipient')),
  amount numeric(14,2) NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.receipts TO authenticated;
GRANT ALL ON public.receipts TO service_role;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own receipts" ON public.receipts FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE SEQUENCE public.receipt_no_seq;
GRANT USAGE ON public.receipt_no_seq TO service_role;

CREATE OR REPLACE FUNCTION public.issue_receipts_for_transaction(_transaction_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tx record; rno text;
BEGIN
  SELECT * INTO tx FROM public.transactions WHERE id = _transaction_id;
  IF tx IS NULL THEN RAISE EXCEPTION 'Transaction not found'; END IF;

  IF tx.sender_id IS NOT NULL THEN
    rno := 'RCPT-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.receipt_no_seq')::text, 6, '0');
    INSERT INTO public.receipts (receipt_no, transaction_id, owner_id, role_on_receipt, amount, note)
    VALUES (rno, tx.id, tx.sender_id, 'payer', tx.amount, tx.note);
  END IF;

  IF tx.receiver_id IS NOT NULL THEN
    rno := 'RCPT-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.receipt_no_seq')::text, 6, '0');
    INSERT INTO public.receipts (receipt_no, transaction_id, owner_id, role_on_receipt, amount, note)
    VALUES (rno, tx.id, tx.receiver_id, 'recipient', tx.amount, tx.note);
  END IF;
END; $$;
REVOKE EXECUTE ON FUNCTION public.issue_receipts_for_transaction(uuid) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_receipts_for_transaction(uuid) TO service_role;

-- Fire it automatically every time a transaction row is written, whatever
-- created it (transfer, tip, booking, withdrawal, verified deposit) - so no
-- money-moving code path can forget to issue receipts.
CREATE OR REPLACE FUNCTION public.trg_issue_receipts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.issue_receipts_for_transaction(NEW.id);
  RETURN NEW;
END; $$;

CREATE TRIGGER issue_receipts_after_transaction
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_issue_receipts();

-- ============================================================================
-- 3) AUTO QR PER HOTEL — every hotel gets a stable payment QR the moment
--    it's created. It encodes the hotel id, not a bank account number, so a
--    reprinted/photographed QR can never leak real financial details.
-- ============================================================================
ALTER TABLE public.hotels ADD COLUMN qr_code text UNIQUE;

CREATE OR REPLACE FUNCTION public.trg_hotel_qr()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.qr_code := 'moybirr://pay/hotel/' || NEW.id;
  RETURN NEW;
END; $$;

CREATE TRIGGER set_hotel_qr_on_insert
  BEFORE INSERT ON public.hotels
  FOR EACH ROW EXECUTE FUNCTION public.trg_hotel_qr();

-- Backfill hotels created before this migration.
UPDATE public.hotels SET qr_code = 'moybirr://pay/hotel/' || id WHERE qr_code IS NULL;
