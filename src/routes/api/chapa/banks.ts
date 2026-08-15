import { createServerFileRoute, getRequest } from "@tanstack/react-start/server";
import { chapaGetBanks } from "@/lib/chapa.server";

export const ServerRoute = createServerFileRoute("/api/chapa/banks").methods({
  GET: async () => {
    const request = getRequest();
    const authHeader = request.headers.get("authorization");
    if (!authHeader) return Response.json({ error: "Not authenticated" }, { status: 401 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !userData?.user) return Response.json({ error: "Not authenticated" }, { status: 401 });

    try {
      const banks = await chapaGetBanks();
      return Response.json({ banks });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not load banks";
      return Response.json({ error: message }, { status: 502 });
    }
  },
});
