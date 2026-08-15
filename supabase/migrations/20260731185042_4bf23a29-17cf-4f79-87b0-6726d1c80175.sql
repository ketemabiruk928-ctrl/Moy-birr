-- ROLES
CREATE TYPE public.app_role AS ENUM ('guest','staff','owner');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  photo_url text,
  language text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Roles readable by authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- WALLETS
CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  bank_linked text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own wallet" ON public.wallets FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  receiver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL,
  type text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transactions" ON public.transactions FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- HOTELS
CREATE TABLE public.hotels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  city text NOT NULL DEFAULT 'Addis Ababa',
  description text,
  photo_url text,
  lat double precision,
  lng double precision,
  price_from numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hotels TO authenticated;
GRANT SELECT ON public.hotels TO anon;
GRANT ALL ON public.hotels TO service_role;
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hotels public read" ON public.hotels FOR SELECT USING (true);
CREATE POLICY "Owners manage own hotels" ON public.hotels FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  room_type text NOT NULL,
  price numeric(12,2) NOT NULL,
  capacity int NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT SELECT ON public.rooms TO anon;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rooms public read" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Owners manage own rooms" ON public.rooms FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.owner_id = auth.uid()));

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  room_type text NOT NULL DEFAULT '',
  check_in date NOT NULL,
  check_out date NOT NULL,
  nights int NOT NULL DEFAULT 1,
  total numeric(14,2) NOT NULL,
  commission numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Guests view own bookings" ON public.bookings FOR SELECT TO authenticated
  USING (guest_id = auth.uid() OR EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.owner_id = auth.uid()));
CREATE POLICY "Guests update own bookings" ON public.bookings FOR UPDATE TO authenticated
  USING (guest_id = auth.uid()) WITH CHECK (guest_id = auth.uid());

-- STAFF
CREATE TABLE public.staff_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  hotel_id uuid REFERENCES public.hotels(id) ON DELETE SET NULL,
  position text NOT NULL DEFAULT 'waiter',
  city text NOT NULL DEFAULT 'Addis Ababa',
  lat double precision,
  lng double precision,
  rating numeric(3,2) NOT NULL DEFAULT 0,
  rating_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.staff_profiles TO authenticated;
GRANT SELECT ON public.staff_profiles TO anon;
GRANT ALL ON public.staff_profiles TO service_role;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff public read" ON public.staff_profiles FOR SELECT USING (true);
CREATE POLICY "Staff manage own profile" ON public.staff_profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Staff update own profile" ON public.staff_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  stars int NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ratings TO authenticated;
GRANT SELECT ON public.ratings TO anon;
GRANT ALL ON public.ratings TO service_role;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ratings public read" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "Guests create ratings" ON public.ratings FOR INSERT TO authenticated WITH CHECK (guest_id = auth.uid());

CREATE TABLE public.hotel_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  stars int NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.hotel_ratings TO authenticated;
GRANT SELECT ON public.hotel_ratings TO anon;
GRANT ALL ON public.hotel_ratings TO service_role;
ALTER TABLE public.hotel_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hotel ratings public read" ON public.hotel_ratings FOR SELECT USING (true);
CREATE POLICY "Guests create hotel ratings" ON public.hotel_ratings FOR INSERT TO authenticated WITH CHECK (guest_id = auth.uid());

-- JOBS
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hotel_id uuid REFERENCES public.hotels(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT 'Addis Ababa',
  salary numeric(12,2),
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT SELECT ON public.jobs TO anon;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Jobs public read" ON public.jobs FOR SELECT USING (true);
CREATE POLICY "Owners update own jobs" ON public.jobs FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners delete own jobs" ON public.jobs FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE TABLE public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, staff_id)
);
GRANT SELECT, INSERT, UPDATE ON public.job_applications TO authenticated;
GRANT ALL ON public.job_applications TO service_role;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Applicants and owners read" ON public.job_applications FOR SELECT TO authenticated
  USING (staff_id = auth.uid() OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.owner_id = auth.uid()));
CREATE POLICY "Staff apply" ON public.job_applications FOR INSERT TO authenticated WITH CHECK (staff_id = auth.uid());
CREATE POLICY "Owners update applications" ON public.job_applications FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.owner_id = auth.uid()));

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'premium',
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view own subscription" ON public.subscriptions FOR SELECT TO authenticated USING (owner_id = auth.uid());

-- SIGNUP TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'full_name',''),
          COALESCE(NEW.raw_user_meta_data->>'phone',''))
  ON CONFLICT (id) DO NOTHING;

  r := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'guest');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, r) ON CONFLICT DO NOTHING;

  INSERT INTO public.wallets (user_id, balance) VALUES (NEW.id, 0) ON CONFLICT (user_id) DO NOTHING;

  IF r = 'staff' THEN
    INSERT INTO public.staff_profiles (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- MONEY FUNCTIONS
CREATE OR REPLACE FUNCTION public.wallet_deposit(_amount numeric, _source text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); newbal numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  UPDATE public.wallets SET balance = balance + _amount, bank_linked = COALESCE(_source, bank_linked)
    WHERE user_id = uid RETURNING balance INTO newbal;
  INSERT INTO public.transactions (sender_id, receiver_id, amount, type, note)
  VALUES (NULL, uid, _amount, 'deposit', 'Deposit from ' || COALESCE(_source,'bank'));
  RETURN newbal;
END; $$;

CREATE OR REPLACE FUNCTION public.wallet_withdraw(_amount numeric, _destination text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); newbal numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  UPDATE public.wallets SET balance = balance - _amount WHERE user_id = uid AND balance >= _amount
    RETURNING balance INTO newbal;
  IF newbal IS NULL THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  INSERT INTO public.transactions (sender_id, receiver_id, amount, type, note)
  VALUES (uid, NULL, _amount, 'withdraw', 'Withdraw to ' || COALESCE(_destination,'bank'));
  RETURN newbal;
END; $$;

CREATE OR REPLACE FUNCTION public.wallet_transfer(_phone text, _amount numeric, _note text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); target uuid; newbal numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  SELECT id INTO target FROM public.profiles WHERE phone = _phone LIMIT 1;
  IF target IS NULL THEN RAISE EXCEPTION 'No Moybirr user with that phone number'; END IF;
  IF target = uid THEN RAISE EXCEPTION 'You cannot send money to yourself'; END IF;
  UPDATE public.wallets SET balance = balance - _amount WHERE user_id = uid AND balance >= _amount
    RETURNING balance INTO newbal;
  IF newbal IS NULL THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE public.wallets SET balance = balance + _amount WHERE user_id = target;
  INSERT INTO public.transactions (sender_id, receiver_id, amount, type, note)
  VALUES (uid, target, _amount, 'transfer', COALESCE(_note,'Transfer'));
  RETURN newbal;
END; $$;

CREATE OR REPLACE FUNCTION public.pay_service(_hotel_id uuid, _staff_profile_id uuid, _amount numeric, _tip numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); owner uuid; staff_user uuid; fee numeric; newbal numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  _tip := COALESCE(_tip, 0);
  IF _amount IS NULL OR _amount < 0 OR (_amount + _tip) <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  SELECT owner_id INTO owner FROM public.hotels WHERE id = _hotel_id;
  UPDATE public.wallets SET balance = balance - (_amount + _tip) WHERE user_id = uid AND balance >= (_amount + _tip)
    RETURNING balance INTO newbal;
  IF newbal IS NULL THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  fee := ROUND(_amount * 0.03, 2);
  IF owner IS NOT NULL AND _amount > 0 THEN
    UPDATE public.wallets SET balance = balance + (_amount - fee) WHERE user_id = owner;
    INSERT INTO public.transactions (sender_id, receiver_id, amount, type, note)
    VALUES (uid, owner, _amount - fee, 'service_payment', 'Service bill (3% commission)');
  ELSIF _amount > 0 THEN
    INSERT INTO public.transactions (sender_id, receiver_id, amount, type, note)
    VALUES (uid, NULL, _amount, 'service_payment', 'Service bill');
  END IF;

  IF _tip > 0 AND _staff_profile_id IS NOT NULL THEN
    SELECT user_id INTO staff_user FROM public.staff_profiles WHERE id = _staff_profile_id;
    IF staff_user IS NULL THEN RAISE EXCEPTION 'Staff not found'; END IF;
    UPDATE public.wallets SET balance = balance + _tip WHERE user_id = staff_user;
    INSERT INTO public.transactions (sender_id, receiver_id, amount, type, note)
    VALUES (uid, staff_user, _tip, 'tip', 'Tip 100% to staff');
  END IF;
  RETURN newbal;
END; $$;

CREATE OR REPLACE FUNCTION public.book_hotel(_room_id uuid, _check_in date, _check_out date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); r record; owner uuid; nights int; total numeric; fee numeric; newbal numeric; bid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
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
  END IF;
  INSERT INTO public.bookings (guest_id, hotel_id, room_id, room_type, check_in, check_out, nights, total, commission)
  VALUES (uid, r.hotel_id, r.id, r.room_type, _check_in, _check_out, nights, total, fee)
  RETURNING id INTO bid;
  INSERT INTO public.transactions (sender_id, receiver_id, amount, type, note)
  VALUES (uid, owner, total, 'booking', 'Hotel booking (' || nights || ' night(s))');
  RETURN bid;
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_booking(_booking_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); b record; refund numeric; owner uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO b FROM public.bookings WHERE id = _booking_id AND guest_id = uid;
  IF b IS NULL THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF b.status <> 'confirmed' THEN RAISE EXCEPTION 'Booking is not active'; END IF;
  -- Refund policy: 100% if cancelled more than 24h before check-in, otherwise 50%
  IF b.check_in > (CURRENT_DATE + 1) THEN refund := b.total; ELSE refund := ROUND(b.total * 0.5, 2); END IF;
  UPDATE public.bookings SET status = 'cancelled' WHERE id = b.id;
  UPDATE public.wallets SET balance = balance + refund WHERE user_id = uid;
  SELECT owner_id INTO owner FROM public.hotels WHERE id = b.hotel_id;
  IF owner IS NOT NULL THEN
    UPDATE public.wallets SET balance = balance - LEAST(refund, b.total - b.commission) WHERE user_id = owner;
  END IF;
  INSERT INTO public.transactions (sender_id, receiver_id, amount, type, note)
  VALUES (owner, uid, refund, 'refund', 'Booking cancellation refund');
  RETURN refund;
END; $$;

CREATE OR REPLACE FUNCTION public.rate_staff(_staff_profile_id uuid, _booking_id uuid, _stars int, _comment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.ratings (guest_id, staff_id, booking_id, stars, comment)
  VALUES (uid, _staff_profile_id, _booking_id, _stars, _comment);
  UPDATE public.staff_profiles sp SET
    rating = sub.avg_stars, rating_count = sub.cnt
  FROM (SELECT AVG(stars)::numeric(3,2) AS avg_stars, COUNT(*)::int AS cnt FROM public.ratings WHERE staff_id = _staff_profile_id) sub
  WHERE sp.id = _staff_profile_id;
END; $$;

CREATE OR REPLACE FUNCTION public.post_job(_hotel_id uuid, _title text, _description text, _location text, _salary numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); newbal numeric; jid uuid; active_sub boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(uid, 'owner') THEN RAISE EXCEPTION 'Only hotel owners can post jobs'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.subscriptions WHERE owner_id = uid AND end_date > now()) INTO active_sub;
  IF NOT active_sub THEN RAISE EXCEPTION 'An active premium subscription (500 ETB/month) is required to post jobs'; END IF;
  UPDATE public.wallets SET balance = balance - 200 WHERE user_id = uid AND balance >= 200 RETURNING balance INTO newbal;
  IF newbal IS NULL THEN RAISE EXCEPTION 'Insufficient balance for the 200 ETB posting fee'; END IF;
  INSERT INTO public.transactions (sender_id, receiver_id, amount, type, note)
  VALUES (uid, NULL, 200, 'job_fee', 'Job posting fee');
  INSERT INTO public.jobs (owner_id, hotel_id, title, description, location, salary)
  VALUES (uid, _hotel_id, _title, COALESCE(_description,''), COALESCE(_location,'Addis Ababa'), _salary)
  RETURNING id INTO jid;
  RETURN jid;
END; $$;

CREATE OR REPLACE FUNCTION public.subscribe_premium()
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); newbal numeric; ends timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(uid, 'owner') THEN RAISE EXCEPTION 'Only hotel owners can subscribe'; END IF;
  UPDATE public.wallets SET balance = balance - 500 WHERE user_id = uid AND balance >= 500 RETURNING balance INTO newbal;
  IF newbal IS NULL THEN RAISE EXCEPTION 'Insufficient balance for the 500 ETB subscription'; END IF;
  INSERT INTO public.transactions (sender_id, receiver_id, amount, type, note)
  VALUES (uid, NULL, 500, 'subscription', 'Premium subscription 1 month');
  ends := now() + interval '30 days';
  INSERT INTO public.subscriptions (owner_id, plan, end_date) VALUES (uid, 'premium', ends);
  RETURN ends;
END; $$;

-- DEMO HOTELS
INSERT INTO public.hotels (id, name, city, description, photo_url, lat, lng, price_from) VALUES
 ('11111111-1111-4111-8111-111111111111','Skylight Hotel','Addis Ababa','Five-star comfort near Bole International Airport.','https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',8.9806,38.7578,4200),
 ('22222222-2222-4222-8222-222222222222','Haile Resort','Hawassa','Lakeside resort with pools and Ethiopian cuisine.','https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800',7.0621,38.4776,3100),
 ('33333333-3333-4333-8333-333333333333','Gonder Lodge','Gondar','Historic lodge minutes from the royal enclosure.','https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800',12.6030,37.4521,1800),
 ('44444444-4444-4444-8444-444444444444','Mekelle Grand','Mekelle','Modern business hotel in the heart of the city.','https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800',13.4967,39.4753,2200),
 ('55555555-5555-4555-8555-555555555555','Bahir Dar Blue Nile','Bahir Dar','Garden rooms overlooking Lake Tana.','https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800',11.5936,37.3908,1600);

INSERT INTO public.rooms (hotel_id, room_type, price, capacity) VALUES
 ('11111111-1111-4111-8111-111111111111','Standard Double',4200,2),
 ('11111111-1111-4111-8111-111111111111','Executive Suite',7800,3),
 ('22222222-2222-4222-8222-222222222222','Lake View Double',3100,2),
 ('22222222-2222-4222-8222-222222222222','Family Room',5200,4),
 ('33333333-3333-4333-8333-333333333333','Standard Single',1800,1),
 ('33333333-3333-4333-8333-333333333333','Twin Room',2600,2),
 ('44444444-4444-4444-8444-444444444444','Business Double',2200,2),
 ('44444444-4444-4444-8444-444444444444','Deluxe King',3400,2),
 ('55555555-5555-4555-8555-555555555555','Garden Double',1600,2),
 ('55555555-5555-4555-8555-555555555555','Nile Suite',3000,3);
