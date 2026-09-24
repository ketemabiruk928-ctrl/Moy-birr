import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Image as ImageIcon, Video, BedDouble } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatETB, useLang } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MediaImg, MediaVideo, UploadButton } from "@/components/Media";
import { useAuth } from "@/lib/auth";

type Hotel = {
  id: string;
  name: string;
  city: string;
  subcity?: string | null;
  location_text?: string | null;
  description: string | null;
  photo_url: string | null;
  price_from: number;
  trade_license_url?: string | null;
  total_beds?: number | null;
  venue_type?: string | null;
  has_rooms?: boolean | null;
};

const VENUE_TYPES = [
  { value: "hotel", labelKey: "venue.hotel" },
  { value: "guesthouse", labelKey: "venue.guesthouse" },
  { value: "resort", labelKey: "venue.resort" },
  { value: "lodge", labelKey: "venue.lodge" },
  { value: "restaurant", labelKey: "venue.restaurant" },
  { value: "cafe", labelKey: "venue.cafe" },
  { value: "bar", labelKey: "venue.bar" },
  { value: "lounge", labelKey: "venue.lounge" },
];

const ROOMLESS = new Set(["restaurant", "cafe", "bar", "lounge"]);

export function PropertyForm({ hotel }: { hotel: Hotel | null }) {
  const { t } = useLang();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [name, setName] = useState(hotel?.name ?? "");
  const [city, setCity] = useState(hotel?.city ?? "Addis Ababa");
  const [subcity, setSubcity] = useState(hotel?.subcity ?? "");
  const [locationText, setLocationText] = useState(hotel?.location_text ?? "");
  const [venueType, setVenueType] = useState(hotel?.venue_type ?? "hotel");
  const [description, setDescription] = useState(hotel?.description ?? "");
  const [photoUrl, setPhotoUrl] = useState(hotel?.photo_url ?? "");
  const [priceFrom, setPriceFrom] = useState(hotel ? String(hotel.price_from) : "");
  const [tradeLicenseUrl, setTradeLicenseUrl] = useState(hotel?.trade_license_url ?? "");
  const [totalBeds, setTotalBeds] = useState(
    hotel?.total_beds != null ? String(hotel.total_beds) : "",
  );

  useEffect(() => {
    if (!hotel) return;
    setName(hotel.name);
    setCity(hotel.city);
    setSubcity(hotel.subcity ?? "");
    setLocationText(hotel.location_text ?? "");
    setVenueType(hotel.venue_type ?? "hotel");
    setDescription(hotel.description ?? "");
    setPhotoUrl(hotel.photo_url ?? "");
    setPriceFrom(String(hotel.price_from));
    setTradeLicenseUrl(hotel.trade_license_url ?? "");
    setTotalBeds(hotel.total_beds != null ? String(hotel.total_beds) : "");
  }, [hotel]);

  const isRoomless = ROOMLESS.has(venueType);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("save_my_hotel", {
        _name: name,
        _city: city,
        _description: description,
        _photo_url: photoUrl,
        _price_from: priceFrom ? Number(priceFrom) : 0,
        _trade_license_url: tradeLicenseUrl || null,
        _subcity: subcity || null,
        _location_text: locationText || null,
        _venue_type: venueType,
        _has_rooms: !isRoomless,
        _total_beds: isRoomless ? null : totalBeds ? Number(totalBeds) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(hotel ? t("property.updated") : t("property.registered"));
      void qc.invalidateQueries({ queryKey: ["my-hotel"] });
      void qc.invalidateQueries({ queryKey: ["hotels"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="shadow-card space-y-3 p-4">
      <p className="text-sm font-semibold">
        {hotel ? t("property.details") : t("property.register")}
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="hn">{t("property.name")}</Label>
        <Input
          id="hn"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("property.name_placeholder")}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="hv">{t("property.venue_type")}</Label>
        <select
          id="hv"
          value={venueType}
          onChange={(e) => setVenueType(e.target.value)}
          className="w-full rounded-md border border-border bg-background p-2 text-sm"
        >
          {VENUE_TYPES.map((v) => (
            <option key={v.value} value={v.value}>
              {t(v.labelKey)}
            </option>
          ))}
        </select>
        {isRoomless ? (
          <p className="text-[11px] text-muted-foreground">
            {t("property.roomless_note", {
              type: t(VENUE_TYPES.find((v) => v.value === venueType)?.labelKey ?? ""),
            })}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="hc">{t("property.city")}</Label>
          <Input
            id="hc"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Addis Ababa"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hs">{t("property.subcity")}</Label>
          <Input
            id="hs"
            value={subcity}
            onChange={(e) => setSubcity(e.target.value)}
            placeholder="Bole"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="hl">{t("property.location")}</Label>
        <Input
          id="hl"
          value={locationText}
          onChange={(e) => setLocationText(e.target.value)}
          placeholder={t("property.location_placeholder")}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="hp">{t("property.from_price")}</Label>
        <Input
          id="hp"
          type="number"
          inputMode="numeric"
          value={priceFrom}
          onChange={(e) => setPriceFrom(e.target.value)}
        />
      </div>

      {!isRoomless ? (
        <div className="space-y-1.5">
          <Label htmlFor="beds">
            {t("property.total_beds")}{" "}
            <span className="font-normal text-muted-foreground">
              ({t("property.optional")})
            </span>
          </Label>
          <Input
            id="beds"
            type="number"
            inputMode="numeric"
            value={totalBeds}
            onChange={(e) => setTotalBeds(e.target.value)}
            placeholder="e.g. 40"
          />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="hi">{t("property.cover_photo")}</Label>
        {photoUrl ? (
          <MediaImg
            src={photoUrl}
            alt={t("property.cover_photo")}
            className="h-36 w-full rounded-xl object-cover"
          />
        ) : null}
        {user ? (
          <UploadButton
            userId={user.id}
            label={t("property.upload_cover")}
            onUploaded={setPhotoUrl}
          />
        ) : null}
        <Input
          id="hi"
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
          placeholder={t("property.url_placeholder")}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="hd">{t("property.description")}</Label>
        <Textarea
          id="hd"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("property.description_placeholder")}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tl">
          {t("property.trade_license")}{" "}
          <span className="font-normal text-muted-foreground">({t("property.optional")})</span>
        </Label>
        {tradeLicenseUrl ? (
          <a
            href={tradeLicenseUrl}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-xs text-primary underline"
          >
            {t("property.view_license")}
          </a>
        ) : null}
        {user ? (
          <UploadButton
            userId={user.id}
            accept="image/*,application/pdf"
            label={t("property.upload_license")}
            onUploaded={setTradeLicenseUrl}
          />
        ) : null}
        <Input
          id="tl"
          value={tradeLicenseUrl}
          onChange={(e) => setTradeLicenseUrl(e.target.value)}
          placeholder={t("property.doc_url_placeholder")}
        />
      </div>

      <Button
        className="w-full"
        disabled={!name || save.isPending}
        onClick={() => save.mutate()}
      >
        {hotel ? t("property.save_changes") : t("property.register")}
      </Button>
    </Card>
  );
}

export function RoomsManager({ hotelId }: { hotelId: string }) {
  const { t } = useLang();
  const qc = useQueryClient();
  const [roomType, setRoomType] = useState("");
  const [price, setPrice] = useState("");
  const [capacity, setCapacity] = useState("2");
  const [classStage, setClassStage] = useState("");

  const rooms = useQuery({
    queryKey: ["owner-rooms", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("hotel_id", hotelId)
        .order("price");
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rooms").insert({
        hotel_id: hotelId,
        room_type: roomType,
        price: Number(price),
        capacity: Number(capacity) || 2,
        class_stage: classStage || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("rooms.room_added"));
      setRoomType("");
      setPrice("");
      setCapacity("2");
      setClassStage("");
      void qc.invalidateQueries({ queryKey: ["owner-rooms", hotelId] });
      void qc.invalidateQueries({ queryKey: ["rooms", hotelId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rooms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("rooms.room_removed"));
      void qc.invalidateQueries({ queryKey: ["owner-rooms", hotelId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalCapacity = (rooms.data ?? []).reduce((s, r) => s + r.capacity, 0);

  return (
    <div className="space-y-3">
      <Card className="shadow-card space-y-3 p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <BedDouble className="size-4 text-primary" />
          {t("rooms.add_room")}
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="rt">{t("rooms.room_type")}</Label>
          <Input
            id="rt"
            value={roomType}
            onChange={(e) => setRoomType(e.target.value)}
            placeholder={t("rooms.room_type_placeholder")}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="rp">{t("rooms.price_per_night")}</Label>
            <Input
              id="rp"
              type="number"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rc">{t("rooms.capacity")}</Label>
            <Input
              id="rc"
              type="number"
              inputMode="numeric"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cs">{t("rooms.class_stage")}</Label>
          <Input
            id="cs"
            value={classStage}
            onChange={(e) => setClassStage(e.target.value)}
            placeholder={t("rooms.class_stage_placeholder")}
          />
        </div>
        <Button
          className="w-full"
          disabled={!roomType || !price || add.isPending}
          onClick={() => add.mutate()}
        >
          <Plus className="mr-2 size-4" />
          {t("rooms.add_room_btn")}
        </Button>
      </Card>

      {(rooms.data ?? []).length === 0 ? (
        <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
          {t("rooms.no_rooms")}
        </Card>
      ) : (
        <>
          <p className="px-1 text-xs text-muted-foreground">
            {t("rooms.summary", {
              count: (rooms.data ?? []).length,
              capacity: totalCapacity,
            })}
          </p>
          {(rooms.data ?? []).map((r) => (
            <Card key={r.id} className="shadow-card flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-semibold">{r.room_type}</p>
                <p className="text-xs text-muted-foreground">
                  {t("rooms.up_to_guests", { count: r.capacity })}
                </p>
                {r.class_stage ? (
                  <Badge variant="outline" className="mt-1 text-[10px]">
                    {r.class_stage}
                  </Badge>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm font-bold">{formatETB(r.price)}</p>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${r.room_type}`}
                  onClick={() => remove.mutate(r.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

export function ShowcaseManager({
  hotelId,
  premiumActive = false,
}: {
  hotelId: string;
  premiumActive?: boolean;
}) {
  const { t } = useLang();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [kind, setKind] = useState<"photo" | "video">("photo");
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");

  const media = useQuery({
    queryKey: ["hotel-media", hotelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hotel_media")
        .select("*")
        .eq("hotel_id", hotelId)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!premiumActive) {
        throw new Error(t("showcase.subscription_required"));
      }

      const insertData = {
        hotel_id: hotelId,
        kind: kind,
        caption: caption,
        moderation_status: "pending",
        url: kind === "photo" ? url : null,
        video_url: kind === "video" ? url : null,
      };

      const { error } = await supabase.from("hotel_media").insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("showcase.uploaded"));
      setUrl("");
      setCaption("");
      void qc.invalidateQueries({ queryKey: ["hotel-media", hotelId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hotel_media").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hotel-media", hotelId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <Card className="shadow-card space-y-3 p-4">
        <p className="text-sm font-semibold">{t("showcase.title")}</p>
        <p className="text-xs text-muted-foreground">{t("showcase.desc")}</p>

        {!premiumActive ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/50 p-4 text-center">
            <p className="text-sm font-medium">{t("showcase.subscription_required")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("showcase.subscription_desc")}
            </p>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={kind === "photo" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setKind("photo")}
              >
                <ImageIcon className="mr-2 size-4" />
                {t("showcase.photo")}
              </Button>
              <Button
                size="sm"
                variant={kind === "video" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setKind("video")}
              >
                <Video className="mr-2 size-4" />
                {t("showcase.video")}
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mu">
                {kind === "photo" ? t("showcase.photo") : t("showcase.video")}
              </Label>
              {user ? (
                <UploadButton
                  userId={user.id}
                  accept={kind === "photo" ? "image/*" : "video/*"}
                  label={
                    kind === "photo" ? t("showcase.upload_photo") : t("showcase.upload_video")
                  }
                  onUploaded={setUrl}
                />
              ) : null}
              <Input
                id="mu"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t("property.url_placeholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mc">{t("showcase.caption")}</Label>
              <Input
                id="mc"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={t("showcase.caption_placeholder")}
              />
            </div>
            <Button
              className="w-full"
              disabled={!url || add.isPending}
              onClick={() => add.mutate()}
            >
              <Plus className="mr-2 size-4" />
              {t("showcase.add_showcase")}
            </Button>
          </>
        )}
      </Card>

      {(media.data ?? []).length === 0 ? (
        <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
          {t("showcase.nothing_yet")}
        </Card>
      ) : (
        (media.data ?? []).map((m) => (
          <Card key={m.id} className="shadow-card overflow-hidden p-0">
            {m.kind === "video" ? (
              <MediaVideo
                src={m.video_url || m.url}
                className="h-44 w-full bg-muted object-cover"
              />
            ) : (
              <MediaImg
                src={m.url}
                alt={m.caption ?? t("showcase.photo")}
                className="h-44 w-full object-cover"
              />
            )}
            <div className="flex items-center justify-between gap-2 p-3">
              <div>
                <Badge variant="secondary" className="capitalize">
                  {m.kind === "photo" ? t("showcase.photo") : t("showcase.video")}
                </Badge>
                <p className="mt-1 text-xs text-muted-foreground">{m.caption}</p>
                <Badge
                  variant={
                    m.moderation_status === "approved"
                      ? "secondary"
                      : m.moderation_status === "rejected"
                        ? "destructive"
                        : "outline"
                  }
                  className="mt-1 capitalize"
                >
                  {t(`status.${m.moderation_status || "pending"}`) || m.moderation_status}
                </Badge>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Remove media"
                onClick={() => remove.mutate(m.id)}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

export function GuestRoomSearch({ hotelId }: { hotelId: string }) {
  const { t } = useLang();
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [filterRoomType, setFilterRoomType] = useState("");
  const [filterClass, setFilterClass] = useState("");

  const rooms = useQuery({
    queryKey: ["guest-rooms", hotelId, minPrice, maxPrice, filterRoomType, filterClass],
    queryFn: async () => {
      let query = supabase.from("rooms").select("*").eq("hotel_id", hotelId);

      if (minPrice) query = query.gte("price", Number(minPrice));
      if (maxPrice) query = query.lte("price", Number(maxPrice));
      if (filterRoomType) query = query.ilike("room_type", `%${filterRoomType}%`);
      if (filterClass) query = query.ilike("class_stage", `%${filterClass}%`);

      const { data, error } = await query.order("price");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <Card className="shadow-card space-y-3 p-4">
        <p className="text-sm font-semibold">{t("rooms.room_filter_title")}</p>
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder={t("rooms.min_price")}
            type="number"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
          />
          <Input
            placeholder={t("rooms.max_price")}
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
          <Input
            placeholder={t("rooms.filter_room_type")}
            value={filterRoomType}
            onChange={(e) => setFilterRoomType(e.target.value)}
          />
          <Input
            placeholder={t("rooms.filter_class")}
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
          />
        </div>
        <Button
          className="w-full"
          variant="outline"
          onClick={() => {
            setMinPrice("");
            setMaxPrice("");
            setFilterRoomType("");
            setFilterClass("");
          }}
        >
          {t("rooms.clear_filters")}
        </Button>
      </Card>

      {rooms.isLoading ? (
        <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
          {t("rooms.searching")}
        </Card>
      ) : (rooms.data ?? []).length === 0 ? (
        <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
          {t("rooms.no_match")}
        </Card>
      ) : (
        (rooms.data ?? []).map((r) => (
          <Card key={r.id} className="shadow-card flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-semibold">{r.room_type}</p>
              <p className="text-xs text-muted-foreground">
                {t("rooms.up_to_guests", { count: r.capacity })}
              </p>
              {r.class_stage ? (
                <Badge variant="outline" className="mt-1 text-[10px]">
                  {r.class_stage}
                </Badge>
              ) : null}
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">{formatETB(r.price)}</p>
              <p className="text-[10px] text-muted-foreground">{t("rooms.per_night")}</p>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}