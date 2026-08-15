import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Image as ImageIcon, Video, BedDouble } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatETB } from "@/lib/i18n";
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
  description: string | null;
  photo_url: string | null;
  price_from: number;
};

export function PropertyForm({ hotel }: { hotel: Hotel | null }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [name, setName] = useState(hotel?.name ?? "");
  const [city, setCity] = useState(hotel?.city ?? "Addis Ababa");
  const [description, setDescription] = useState(hotel?.description ?? "");
  const [photoUrl, setPhotoUrl] = useState(hotel?.photo_url ?? "");
  const [priceFrom, setPriceFrom] = useState(hotel ? String(hotel.price_from) : "");

  useEffect(() => {
    if (!hotel) return;
    setName(hotel.name);
    setCity(hotel.city);
    setDescription(hotel.description ?? "");
    setPhotoUrl(hotel.photo_url ?? "");
    setPriceFrom(String(hotel.price_from));
  }, [hotel]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("save_my_hotel", {
        _name: name,
        _city: city,
        _description: description,
        _photo_url: photoUrl,
        _price_from: priceFrom ? Number(priceFrom) : 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(hotel ? "Property updated" : "Property registered");
      void qc.invalidateQueries({ queryKey: ["my-hotel"] });
      void qc.invalidateQueries({ queryKey: ["hotels"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="shadow-card space-y-3 p-4">
      <p className="text-sm font-semibold">
        {hotel ? "Property details" : "Register your property"}
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="hn">Hotel name</Label>
        <Input id="hn" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sheba Grand Hotel" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="hc">City</Label>
          <Input id="hc" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hp">From price (ETB)</Label>
          <Input
            id="hp"
            type="number"
            inputMode="numeric"
            value={priceFrom}
            onChange={(e) => setPriceFrom(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hi">Cover photo</Label>
        {photoUrl ? (
          <MediaImg src={photoUrl} alt="Cover photo" className="h-36 w-full rounded-xl object-cover" />
        ) : null}
        {user ? (
          <UploadButton userId={user.id} label="Upload cover photo" onUploaded={setPhotoUrl} />
        ) : null}
        <Input
          id="hi"
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
          placeholder="…or paste an image URL"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hd">Description</Label>
        <Textarea
          id="hd"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Rooftop restaurant, spa, free airport shuttle…"
        />
      </div>
      <Button className="w-full" disabled={!name || save.isPending} onClick={() => save.mutate()}>
        {hotel ? "Save changes" : "Register property"}
      </Button>
    </Card>
  );
}

export function RoomsManager({ hotelId }: { hotelId: string }) {
  const qc = useQueryClient();
  const [roomType, setRoomType] = useState("");
  const [price, setPrice] = useState("");
  const [capacity, setCapacity] = useState("2");

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
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Room added");
      setRoomType("");
      setPrice("");
      setCapacity("2");
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
      toast.success("Room removed");
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
          Add room &amp; price
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="rt">Room type</Label>
          <Input
            id="rt"
            value={roomType}
            onChange={(e) => setRoomType(e.target.value)}
            placeholder="Deluxe double"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="rp">Price / night (ETB)</Label>
            <Input
              id="rp"
              type="number"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rc">Capacity (guests)</Label>
            <Input
              id="rc"
              type="number"
              inputMode="numeric"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
        </div>
        <Button
          className="w-full"
          disabled={!roomType || !price || add.isPending}
          onClick={() => add.mutate()}
        >
          <Plus className="mr-2 size-4" />
          Add room
        </Button>
      </Card>

      {(rooms.data ?? []).length === 0 ? (
        <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
          No rooms listed yet. Add your room types and prices so guests can book.
        </Card>
      ) : (
        <>
          <p className="px-1 text-xs text-muted-foreground">
            {(rooms.data ?? []).length} room types · total capacity {totalCapacity} guests
          </p>
          {(rooms.data ?? []).map((r) => (
            <Card key={r.id} className="shadow-card flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-semibold">{r.room_type}</p>
                <p className="text-xs text-muted-foreground">Up to {r.capacity} guests</p>
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

export function ShowcaseManager({ hotelId }: { hotelId: string }) {
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
      const { error } = await supabase
        .from("hotel_media")
        .insert({ hotel_id: hotelId, kind, url, caption });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Added to your showcase");
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
        <p className="text-sm font-semibold">Advertise your best service</p>
        <p className="text-xs text-muted-foreground">
          Add photos and videos of your rooms, restaurant and spa. Guests see them on your hotel
          page while your monthly plan is active.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={kind === "photo" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setKind("photo")}
          >
            <ImageIcon className="mr-2 size-4" />
            Photo
          </Button>
          <Button
            size="sm"
            variant={kind === "video" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setKind("video")}
          >
            <Video className="mr-2 size-4" />
            Video
          </Button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mu">{kind === "photo" ? "Photo" : "Video (mp4)"}</Label>
          {user ? (
            <UploadButton
              userId={user.id}
              accept={kind === "photo" ? "image/*" : "video/*"}
              label={kind === "photo" ? "Upload photo" : "Upload video"}
              onUploaded={setUrl}
            />
          ) : null}
          <Input
            id="mu"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="…or paste a URL"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mc">Caption</Label>
          <Input
            id="mc"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Rooftop restaurant with city view"
          />
        </div>
        <Button className="w-full" disabled={!url || add.isPending} onClick={() => add.mutate()}>
          <Plus className="mr-2 size-4" />
          Add to showcase
        </Button>
      </Card>

      {(media.data ?? []).length === 0 ? (
        <Card className="shadow-card p-6 text-center text-sm text-muted-foreground">
          Nothing in your showcase yet.
        </Card>
      ) : (
        (media.data ?? []).map((m) => (
          <Card key={m.id} className="shadow-card overflow-hidden p-0">
            {m.kind === "video" ? (
              <MediaVideo src={m.url} className="h-44 w-full bg-muted object-cover" />
            ) : (
              <MediaImg
                src={m.url}
                alt={m.caption ?? "Hotel service"}
                className="h-44 w-full object-cover"
              />
            )}
            <div className="flex items-center justify-between gap-2 p-3">
              <div>
                <Badge variant="secondary" className="capitalize">
                  {m.kind}
                </Badge>
                <p className="mt-1 text-xs text-muted-foreground">{m.caption}</p>
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
