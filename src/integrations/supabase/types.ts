export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          address_line: string
          city: string | null
          created_at: string
          id: string
          is_default: boolean
          label: string
          lat: number | null
          lng: number | null
          user_id: string
        }
        Insert: {
          address_line: string
          city?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label: string
          lat?: number | null
          lng?: number | null
          user_id: string
        }
        Update: {
          address_line?: string
          city?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          lat?: number | null
          lng?: number | null
          user_id?: string
        }
        Relationships: []
      }
      order_events: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lat: number | null
          lng: number | null
          note: string | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          note?: string | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          note?: string | null
          order_id?: string
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          code: string
          commission_xof: number
          created_at: string
          customer_id: string
          customer_rating: number | null
          delivered_at: string | null
          delivery_otp: string | null
          delivery_type: Database["public"]["Enums"]["delivery_type"]
          distance_km: number | null
          dropoff_address: string
          dropoff_contact_name: string
          dropoff_contact_phone: string
          dropoff_lat: number
          dropoff_lng: number
          id: string
          insurance: boolean
          parcel_category: Database["public"]["Enums"]["parcel_category"]
          parcel_image_url: string | null
          parcel_notes: string | null
          parcel_weight_kg: number | null
          picked_up_at: string | null
          pickup_address: string
          pickup_contact_name: string | null
          pickup_contact_phone: string | null
          pickup_lat: number
          pickup_lng: number
          price_xof: number
          rider_id: string | null
          rider_rating: number | null
          scheduled_for: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        Insert: {
          code?: string
          commission_xof?: number
          created_at?: string
          customer_id: string
          customer_rating?: number | null
          delivered_at?: string | null
          delivery_otp?: string | null
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          distance_km?: number | null
          dropoff_address: string
          dropoff_contact_name: string
          dropoff_contact_phone: string
          dropoff_lat: number
          dropoff_lng: number
          id?: string
          insurance?: boolean
          parcel_category?: Database["public"]["Enums"]["parcel_category"]
          parcel_image_url?: string | null
          parcel_notes?: string | null
          parcel_weight_kg?: number | null
          picked_up_at?: string | null
          pickup_address: string
          pickup_contact_name?: string | null
          pickup_contact_phone?: string | null
          pickup_lat: number
          pickup_lng: number
          price_xof: number
          rider_id?: string | null
          rider_rating?: number | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          commission_xof?: number
          created_at?: string
          customer_id?: string
          customer_rating?: number | null
          delivered_at?: string | null
          delivery_otp?: string | null
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          distance_km?: number | null
          dropoff_address?: string
          dropoff_contact_name?: string
          dropoff_contact_phone?: string
          dropoff_lat?: number
          dropoff_lng?: number
          id?: string
          insurance?: boolean
          parcel_category?: Database["public"]["Enums"]["parcel_category"]
          parcel_image_url?: string | null
          parcel_notes?: string | null
          parcel_weight_kg?: number | null
          picked_up_at?: string | null
          pickup_address?: string
          pickup_contact_name?: string | null
          pickup_contact_phone?: string | null
          pickup_lat?: number
          pickup_lng?: number
          price_xof?: number
          rider_id?: string | null
          rider_rating?: number | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          locale: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      riders: {
        Row: {
          created_at: string
          current_lat: number | null
          current_lng: number | null
          id: string
          id_document_url: string | null
          insurance_url: string | null
          is_online: boolean
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          last_seen_at: string | null
          license_number: string | null
          license_plate: string | null
          rating: number
          total_deliveries: number
          updated_at: string
          user_id: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          id?: string
          id_document_url?: string | null
          insurance_url?: string | null
          is_online?: boolean
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          last_seen_at?: string | null
          license_number?: string | null
          license_plate?: string | null
          rating?: number
          total_deliveries?: number
          updated_at?: string
          user_id: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          id?: string
          id_document_url?: string | null
          insurance_url?: string | null
          is_online?: boolean
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          last_seen_at?: string | null
          license_number?: string | null
          license_plate?: string | null
          rating?: number
          total_deliveries?: number
          updated_at?: string
          user_id?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount_xof: number
          created_at: string
          description: string | null
          id: string
          order_id: string | null
          reference: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount_xof: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          reference?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          wallet_id: string
        }
        Update: {
          amount_xof?: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          reference?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance_xof: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_xof?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_xof?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "customer" | "rider" | "merchant" | "admin" | "support"
      delivery_type: "standard" | "express" | "scheduled" | "multi_stop"
      kyc_status: "pending" | "in_review" | "approved" | "rejected"
      order_status:
        | "pending"
        | "searching_rider"
        | "rider_assigned"
        | "rider_arriving"
        | "picked_up"
        | "in_transit"
        | "delivered"
        | "cancelled"
        | "failed"
      parcel_category:
        | "document"
        | "food"
        | "electronics"
        | "clothing"
        | "fragile"
        | "other"
      transaction_type:
        | "topup"
        | "payment"
        | "refund"
        | "payout"
        | "bonus"
        | "commission"
      vehicle_type: "motorbike" | "bicycle" | "car" | "van" | "truck"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["customer", "rider", "merchant", "admin", "support"],
      delivery_type: ["standard", "express", "scheduled", "multi_stop"],
      kyc_status: ["pending", "in_review", "approved", "rejected"],
      order_status: [
        "pending",
        "searching_rider",
        "rider_assigned",
        "rider_arriving",
        "picked_up",
        "in_transit",
        "delivered",
        "cancelled",
        "failed",
      ],
      parcel_category: [
        "document",
        "food",
        "electronics",
        "clothing",
        "fragile",
        "other",
      ],
      transaction_type: [
        "topup",
        "payment",
        "refund",
        "payout",
        "bonus",
        "commission",
      ],
      vehicle_type: ["motorbike", "bicycle", "car", "van", "truck"],
    },
  },
} as const
