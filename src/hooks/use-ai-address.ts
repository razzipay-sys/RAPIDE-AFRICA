import { useState } from "react";
import type { GeoResult } from "@/lib/pricing";
import { toast } from "sonner";

export function useAIAddress() {
  const [isResolving, setIsResolving] = useState(false);

  // Simulates an AI backend parsing natural language to GPS coordinates
  const resolveAddress = async (naturalLanguage: string): Promise<GeoResult | null> => {
    setIsResolving(true);
    try {
      // In production, this would call a Supabase Edge Function that uses 
      // OpenAI/Gemini to extract landmarks and cross-reference with Mapbox.
      await new Promise(r => setTimeout(r, 1500)); // Simulate AI latency
      
      const lower = naturalLanguage.toLowerCase();
      
      // Mock logic based on keywords
      if (lower.includes("market") || lower.includes("dantokpa")) {
        return { name: "Dantokpa Market, Cotonou (AI Resolved)", lat: 6.3650, lng: 2.4350 };
      }
      if (lower.includes("airport") || lower.includes("cadjehoun")) {
        return { name: "Cadjehoun Airport, Cotonou (AI Resolved)", lat: 6.3533, lng: 2.3814 };
      }
      if (lower.includes("stade") || lower.includes("stadium")) {
        return { name: "Stade de l'Amitié, Cotonou (AI Resolved)", lat: 6.3789, lng: 2.3846 };
      }
      
      // Fallback
      return { name: `Resolved: ${naturalLanguage.substring(0, 20)}...`, lat: 6.3676, lng: 2.4252 };
    } catch (e) {
      toast.error("AI Address Resolution failed");
      return null;
    } finally {
      setIsResolving(false);
    }
  };

  return { resolveAddress, isResolving };
}
