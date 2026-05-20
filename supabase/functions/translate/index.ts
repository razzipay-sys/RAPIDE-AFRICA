import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rateLimiter.ts";

const MAX_TEXT_LENGTH = 2000;

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

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

    // 30 translations per minute per user
    const rateCheck = await checkRateLimit(supabase, user.id, "translate", 30, 60);
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in 1 minute." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const text: string = body.text;
    const targetLang: string = body.targetLang;
    const messageId: string | undefined = body.messageId;

    if (!text || !targetLang) {
      return new Response(JSON.stringify({ error: "text and targetLang are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof text !== "string" || text.length > MAX_TEXT_LENGTH) {
      return new Response(JSON.stringify({ error: "Text exceeds maximum length" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate targetLang is one of the supported languages
    const langMap: Record<string, string> = { en: "EN", fr: "FR" };
    const targetCode = langMap[targetLang.toLowerCase()];
    if (!targetCode) {
      return new Response(JSON.stringify({ error: "Unsupported target language" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const deeplKey = Deno.env.get("DEEPL_API_KEY")!;

    const deeplRes = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: {
        "Authorization": `DeepL-Auth-Key ${deeplKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: [text], target_lang: targetCode }),
    });

    if (!deeplRes.ok) {
      const errBody = await deeplRes.text();
      console.error("DeepL error:", deeplRes.status, errBody);
      return new Response(JSON.stringify({ error: "Translation service unavailable" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const deeplData = await deeplRes.json();
    const translated: string = deeplData.translations[0].text;
    const detectedLang: string = deeplData.translations[0].detected_source_language;

    // Persist translation on the message row (cache for future viewers)
    if (messageId && typeof messageId === "string" && messageId.length === 36) {
      await supabase
        .from("messages")
        .update({ translated_content: translated, translate_from: detectedLang })
        .eq("id", messageId);
    }

    return new Response(JSON.stringify({ translated, detectedLang }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("translate error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
