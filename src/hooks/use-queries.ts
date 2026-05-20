import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, phone")
        .eq("id", userId!)
        .single();
      return data;
    },
    enabled: !!userId,
  });
}

export function useWallet(userId: string | undefined) {
  return useQuery({
    queryKey: ["wallet", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("wallets")
        .select("balance_xof")
        .eq("user_id", userId!)
        .single();
      return data;
    },
    enabled: !!userId,
  });
}

export function useRiderProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["rider-profile", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("riders")
        .select("rating, total_deliveries, vehicle_type, license_plate, is_online, kyc_status")
        .eq("user_id", userId!)
        .single();
      return data;
    },
    enabled: !!userId,
  });
}
