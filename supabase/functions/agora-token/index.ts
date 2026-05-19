import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { RtcTokenBuilder, RtcRole } from "npm:agora-token@1.0.0";
import { corsHeaders } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rateLimiter.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rateCheck = await checkRateLimit(supabase, user.id, "agora-token", 10, 60);
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in 1 minute." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const channelName: string = body.channelName;
    const uid: number = body.uid;

    if (!channelName || !uid) {
      return new Response(JSON.stringify({ error: "channelName and uid are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appId = Deno.env.get("AGORA_APP_ID")!;
    const appCertificate = Deno.env.get("AGORA_APP_CERTIFICATE")!;
    const expireTs = Math.floor(Date.now() / 1000) + 3600;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      RtcRole.PUBLISHER,
      expireTs,
    );

    return new Response(JSON.stringify({ token, appId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("agora-token error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
