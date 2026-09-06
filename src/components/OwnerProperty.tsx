
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { UploadButton, MediaImg } from "@/components/Media";

type Hotel = {
  id: string;
  name: string;
  city: string;
  description: string | null;
  photo_url: string | null;
  price_from: number;
  trade_license_url?: string | null;
  total_beds?: number | null;
};

type Room = {
  id: string;
  room_type: string;
  price: number;
  capacity: number;
};

export function OwnerProperty() {
  const { user } = useAuth();
  const { t } = useLang();
  const qc = useQueryClient();

  const hotelQuery = useQuery({
    queryKey: ["my-hotel", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hotels")
        .select("id, name, city, description, photo_url, price_from, trade_license_url, total_beds")
        .eq("owner_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Hotel | null;
    },
  });

  const roomsQuery = useQuery({
    queryKey: ["my-rooms", hotelQuery.data?.id],
    enabled: !!hotelQuery.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("id, room_type, price, capacity")
        .eq("hotel_id", hotelQuery.data!.id)
        .order("price");
      if (error) throw error;
      return (data ?? []) as Room[];
    },
  });

  return (
    <div className="space-y-4">
      <Card className="shadow-card space-y-4 p-4">
        <h2 className="text-base font-semibold">{t("dashboard")}: Property</h2>
        <PropertyForm
          hotel={hotelQuery.data}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ["my-hotel"] });
          }}
        />
      </Card>

      {hotelQuery.data?.id ? (
        <Card className="shadow-card space-y-4 p-4">
          <h3 className="text-sm font-semibold">Rooms</h3>
          <RoomsEditor
            hotelId={hotelQuery.data.id}
            rooms={roomsQuery.data ?? []}
            onChanged={() => void qc.invalidateQueries({ queryKey: ["my-rooms"] })}
          />
        </Card>
      ) : null}
    </div>
  );
}

function PropertyForm({
  hotel,
  onSaved,
}: {
  hotel: Hotel | null | undefined;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState(hotel?.name ?? "");
  const [city, setCity] = useState(hotel?.city ?? "");
  const [description, setDescription] = useState(hotel?.description ?? "");
  const [photoUrl, setPhotoUrl] = useState(hotel?.photo_url ?? "");
  const [priceFrom, setPriceFrom] = useState(hotel ? String(hotel.price_from) : "");
  const [tradeLicenseUrl, setTradeLicenseUrl] = useState(hotel?.trade_license_url ?? "");
  const [totalBeds, setTotalBeds] = useState(
    hotel?.total_beds != null ? String(hotel.total_beds) : "",
  );

  useEffect(() => {
    if (!hotel) return;
    setName(hotel.name ?? "");
    setCity(hotel.city ?? "");
    setDescription(hotel.description ?? "");
    setPhotoUrl(hotel.photo_url ?? "");
    setPriceFrom(String(hotel.price_from ?? ""));
    setTradeLicenseUrl(hotel.trade_license_url ?? "");
    setTotalBeds(hotel.total_beds != null ? String(hotel.total_beds) : "");
  }, [hotel]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: hotelId, error } = await supabase.rpc("save_my_hotel", {
        _name: name,
        _city: city,
        _description: description,
        _photo_url: photoUrl,
        _price_from: priceFrom ? Number(priceFrom) : 0,
      });
      if (error) throw error;

      if (hotelId) {
        const { error: e2 } = await supabase
          .from("hotels")
          .update({
            trade_license_url: tradeLicenseUrl || null,
            total_beds: totalBeds ? Number(totalBeds) : null,
          })
          .eq("id", hotelId);
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      toast.success("Property saved");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="hn">Hotel / place name</Label>
        <Input id="hn" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sheba Grand Hotel" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="city">City</Label>
          <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Addis Ababa" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="price">From price (ETB)</Label>
          <Input
            id="price"
            type="number"
            inputMode="decimal"
            value={priceFrom}
            onChange={(e) => setPriceFrom(e.target.value)}
            placeholder="1500"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="beds">
          Total beds <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <p className="text-xs text-muted-foreground">
          For hotels with rooms/beds. Leave empty for restaurant-only places.
        </p>
        <Input
          id="beds"
          type="number"
          inputMode="numeric"
          value={totalBeds}
          onChange={(e) => setTotalBeds(e.target.value)}
          placeholder="e.g. 40"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="desc">Description</Label>
        <Textarea
          id="desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description of your place"
        />
      </div>

      <div className="space-y-2">
        <Label>Cover photo</Label>
        {photoUrl ? (
          <MediaImg src={photoUrl} alt={name || "Hotel"} className="h-36 w-full rounded-xl object-cover" />
        ) : null}
        {user ? (
          <UploadButton
            userId={user.id}
            label="Upload cover photo"
            accept="image/*"
            onUploaded={(url) => setPhotoUrl(url)}
          />
        ) : null}
      </div>

      <div className="space-y-2">
        <Label>
          Trade licence <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        {tradeLicenseUrl ? (
          <a href={tradeLicenseUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
            View uploaded licence
          </a>
        ) : null}
        {user ? (
          <UploadButton
            userId={user.id}
            label="Upload trade licence"
            accept="image/*,application/pdf"
            onUploaded={(url) => setTradeLicenseUrl(url)}
          />
        ) : null}
      </div>

      <Button className="w-full" disabled={save.isPending || !name} onClick={() => save.mutate()}>
        {save.isPending ? "Saving…" : "Save property"}
      </Button>
    </div>
  );
}

function RoomsEditor({
  hotelId,
  rooms,
  onChanged,
}: {
  hotelId: string;
  rooms: Room[];
  onChanged: () => void;
}) {
  const [roomType, setRoomType] = useState("");
  const [price, setPrice] = useState("");
  const [capacity, setCapacity] = useState("2");

  const addRoom = useMutation({
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
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeRoom = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rooms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Room removed");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      {rooms.length === 0 ? (
        <p className="text-sm text-muted-foreground">No rooms yet. Add your first room below.</p>
      ) : (
        <div className="space-y-2">
          {rooms.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">{r.room_type}</p>
                <p className="text-xs text-muted-foreground">
                  {r.price} ETB · capacity {r.capacity}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => removeRoom.mutate(r.id)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
        <Input value={roomType} onChange={(e) => setRoomType(e.target.value)} placeholder="Room type (e.g. Deluxe)" />
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price ETB" />
          <Input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Capacity" />
        </div>
        <Button
          className="w-full"
          disabled={!roomType || !price || addRoom.isPending}
          onClick={() => addRoom.mutate()}
        >
          Add room
        </Button>
      </div>
    </div>
  );
}
