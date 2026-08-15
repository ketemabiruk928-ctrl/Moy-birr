-- helper: is an owner's monthly plan active
CREATE OR REPLACE FUNCTION public.owner_plan_active(_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _owner IS NULL OR EXISTS (
    SELECT 1 FROM public.subscriptions s WHERE s.owner_id = _owner AND s.end_date > now()
  );
$$;

CREATE TABLE public.hotel_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'photo' CHECK (kind IN ('photo','video')),
  url text NOT NULL,
  caption text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hotel_media TO authenticated;
GRANT SELECT ON public.hotel_media TO anon;
GRANT ALL ON public.hotel_media TO service_role;
ALTER TABLE public.hotel_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Media of listed hotels readable" ON public.hotel_media FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND public.owner_plan_active(h.owner_id)));
CREATE POLICY "Owners read own media" ON public.hotel_media FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.owner_id = auth.uid()));
CREATE POLICY "Owners manage own media" ON public.hotel_media FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.owner_id = auth.uid()));

-- listing gate: unpaid owners disappear from the marketplace
DROP POLICY IF EXISTS "Hotels public read" ON public.hotels;
CREATE POLICY "Listed hotels public read" ON public.hotels FOR SELECT
  USING (public.owner_plan_active(owner_id));
CREATE POLICY "Owners read own hotel" ON public.hotels FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Rooms public read" ON public.rooms;
CREATE POLICY "Rooms of listed hotels readable" ON public.rooms FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND public.owner_plan_active(h.owner_id)));
CREATE POLICY "Owners read own rooms" ON public.rooms FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hotels h WHERE h.id = hotel_id AND h.owner_id = auth.uid()));

-- owner registers / updates their property
CREATE OR REPLACE FUNCTION public.save_my_hotel(_name text, _city text, _description text, _photo_url text, _price_from numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); hid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(uid, 'owner') THEN RAISE EXCEPTION 'Only hotel owners can register a property'; END IF;
  IF _name IS NULL OR length(btrim(_name)) = 0 THEN RAISE EXCEPTION 'Hotel name is required'; END IF;
  SELECT id INTO hid FROM public.hotels WHERE owner_id = uid LIMIT 1;
  IF hid IS NULL THEN
    INSERT INTO public.hotels (owner_id, name, city, description, photo_url, price_from)
    VALUES (uid, btrim(_name), COALESCE(NULLIF(btrim(_city),''),'Addis Ababa'), _description, NULLIF(_photo_url,''), COALESCE(_price_from,0))
    RETURNING id INTO hid;
  ELSE
    UPDATE public.hotels SET name = btrim(_name),
      city = COALESCE(NULLIF(btrim(_city),''), city),
      description = _description,
      photo_url = NULLIF(_photo_url,''),
      price_from = COALESCE(_price_from, price_from)
    WHERE id = hid;
  END IF;
  RETURN hid;
END; $$;

REVOKE ALL ON FUNCTION public.save_my_hotel(text, text, text, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_my_hotel(text, text, text, text, numeric) TO authenticated;

-- block bookings for lapsed properties
CREATE OR REPLACE FUNCTION public.book_hotel(_room_id uuid, _check_in date, _check_out date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); r record; owner uuid; nights int; total numeric; fee numeric; newbal numeric; bid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT rm.*, h.owner_id AS h_owner INTO r FROM public.rooms rm JOIN public.hotels h ON h.id = rm.hotel_id WHERE rm.id = _room_id;
  IF r IS NULL THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF NOT public.owner_plan_active(r.h_owner) THEN RAISE EXCEPTION 'This hotel is temporarily unavailable'; END IF;
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