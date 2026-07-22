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
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      bulk_order_batches: {
        Row: {
          completed_at: string | null
          created_at: string
          failed_rows: number
          file_name: string | null
          id: string
          status: string
          success_rows: number
          total_rows: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          failed_rows?: number
          file_name?: string | null
          id?: string
          status?: string
          success_rows?: number
          total_rows?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          failed_rows?: number
          file_name?: string | null
          id?: string
          status?: string
          success_rows?: number
          total_rows?: number
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          order_id: string | null
          participant_1: string
          participant_2: string
          type: string
          unread_1: number
          unread_2: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          order_id?: string | null
          participant_1: string
          participant_2: string
          type?: string
          unread_1?: number
          unread_2?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          order_id?: string | null
          participant_1?: string
          participant_2?: string
          type?: string
          unread_1?: number
          unread_2?: number
        }
        Relationships: [
          {
            foreignKeyName: "conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_documents: {
        Row: {
          created_at: string
          file_url: string
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          rider_id: string
          status: string
          type: string
        }
        Insert: {
          created_at?: string
          file_url: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rider_id: string
          status?: string
          type: string
        }
        Update: {
          created_at?: string
          file_url?: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rider_id?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_documents_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
        ]
      }
      escrows: {
        Row: {
          amount_xof: number
          buyer_id: string
          created_at: string
          id: string
          order_id: string
          seller_id: string
          status: Database["public"]["Enums"]["escrow_status"]
          updated_at: string
        }
        Insert: {
          amount_xof: number
          buyer_id: string
          created_at?: string
          id?: string
          order_id: string
          seller_id: string
          status?: Database["public"]["Enums"]["escrow_status"]
          updated_at?: string
        }
        Update: {
          amount_xof?: number
          buyer_id?: string
          created_at?: string
          id?: string
          order_id?: string
          seller_id?: string
          status?: Database["public"]["Enums"]["escrow_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrows_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrows_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrows_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_api_keys: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          media_url: string | null
          sender_id: string
          translate_from: string | null
          translated_content: string | null
          type: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          media_url?: string | null
          sender_id: string
          translate_from?: string | null
          translated_content?: string | null
          type?: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          media_url?: string | null
          sender_id?: string
          translate_from?: string | null
          translated_content?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string | null
          created_at: string
          data: Json | null
          id: string
          is_read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          title?: string
          type?: string
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
          batch_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
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
          rating_submitted: boolean
          refund_status: string
          rider_id: string | null
          rider_rating: number | null
          route_batch_id: string | null
          scheduled_for: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        Insert: {
          batch_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
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
          rating_submitted?: boolean
          refund_status?: string
          rider_id?: string | null
          rider_rating?: number | null
          route_batch_id?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Update: {
          batch_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
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
          rating_submitted?: boolean
          refund_status?: string
          rider_id?: string | null
          rider_rating?: number | null
          route_batch_id?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "bulk_order_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_profiles_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_route_batch_id_fkey"
            columns: ["route_batch_id"]
            isOneToOne: false
            referencedRelation: "route_batches"
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
          id_document_url: string | null
          kyc_status: Database["public"]["Enums"]["kyc_status"] | null
          locale: string
          phone: string | null
          phone_verified: boolean | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          id_document_url?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"] | null
          locale?: string
          phone?: string | null
          phone_verified?: boolean | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          id_document_url?: string | null
          kyc_status?: Database["public"]["Enums"]["kyc_status"] | null
          locale?: string
          phone?: string | null
          phone_verified?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      promo_code_uses: {
        Row: {
          discount_xof: number
          id: string
          order_id: string | null
          promo_code_id: string
          used_at: string
          user_id: string
        }
        Insert: {
          discount_xof: number
          id?: string
          order_id?: string | null
          promo_code_id: string
          used_at?: string
          user_id: string
        }
        Update: {
          discount_xof?: number
          id?: string
          order_id?: string | null
          promo_code_id?: string
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_uses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_code_uses_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          max_discount_xof: number | null
          max_uses: number | null
          min_order_xof: number
          times_used: number
          type: string
          uses_per_user: number
          valid_from: string
          valid_until: string | null
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_discount_xof?: number | null
          max_uses?: number | null
          min_order_xof?: number
          times_used?: number
          type: string
          uses_per_user?: number
          valid_from?: string
          valid_until?: string | null
          value: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          max_discount_xof?: number | null
          max_uses?: number | null
          min_order_xof?: number
          times_used?: number
          type?: string
          uses_per_user?: number
          valid_from?: string
          valid_until?: string | null
          value?: number
        }
        Relationships: []
      }
      rate_limit_log: {
        Row: {
          created_at: string
          id: number
          user_action: string
        }
        Insert: {
          created_at?: string
          id?: number
          user_action: string
        }
        Update: {
          created_at?: string
          id?: number
          user_action?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          order_id: string
          rating: number
          reviewee_id: string
          reviewer_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          rating: number
          reviewee_id: string
          reviewer_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          rating?: number
          reviewee_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "riders_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      route_batches: {
        Row: {
          created_at: string
          id: string
          merchant_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          merchant_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          merchant_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_batches_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_places: {
        Row: {
          address: string
          created_at: string
          icon: string
          id: string
          is_default: boolean
          label: string
          lat: number
          lng: number
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          icon?: string
          id?: string
          is_default?: boolean
          label: string
          lat: number
          lng: number
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          icon?: string
          id?: string
          is_default?: boolean
          label?: string
          lat?: number
          lng?: number
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          id: string
          message: string
          order_id: string | null
          priority: string
          resolution: string | null
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category: string
          created_at?: string
          id?: string
          message: string
          order_id?: string | null
          priority?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          id?: string
          message?: string
          order_id?: string | null
          priority?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      surge_zones: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          multiplier: number
          name: string
          polygon: Json
          reason: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          multiplier?: number
          name: string
          polygon: Json
          reason?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          multiplier?: number
          name?: string
          polygon?: Json
          reason?: string | null
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
          status: string
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
          status?: string
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
          status?: string
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
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _wallet_credit: {
        Args: {
          p_amount_xof: number
          p_description?: string
          p_order_id?: string
          p_reference?: string
          p_type: Database["public"]["Enums"]["transaction_type"]
          p_user_id: string
        }
        Returns: boolean
      }
      accept_order: { Args: { p_order_id: string }; Returns: boolean }
      admin_approve_topup: { Args: { p_tx_id: string }; Returns: boolean }
      admin_reject_order: {
        Args: { p_order_id: string; p_reason: string }
        Returns: boolean
      }
      admin_reject_topup: {
        Args: { p_reason?: string; p_tx_id: string }
        Returns: boolean
      }
      admin_set_refund_status: {
        Args: { p_order_id: string; p_status: string }
        Returns: boolean
      }
      assign_order: {
        Args: { p_order_id: string; p_rider_id: string }
        Returns: boolean
      }
      auto_complete_stale_deliveries: { Args: never; Returns: undefined }
      check_and_log_rate_limit: {
        Args: {
          p_max_requests: number
          p_user_action: string
          p_window_seconds: number
        }
        Returns: boolean
      }
      claim_order: {
        Args: { p_order_id: string; p_rider_id: string }
        Returns: boolean
      }
      complete_delivery: {
        Args: { p_order_id: string; p_otp: string }
        Returns: boolean
      }
      create_notification: {
        Args: {
          p_action_url?: string
          p_body?: string
          p_data?: Json
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      decline_order: { Args: { p_order_id: string }; Returns: boolean }
      expire_stale_orders: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_order_returned: { Args: { p_order_id: string }; Returns: boolean }
      open_or_get_conversation: {
        Args: { p_order_id: string; p_other_user_id: string }
        Returns: string
      }
      rate_delivery: {
        Args: { p_order_id: string; p_rating: number }
        Returns: boolean
      }
      redeem_promo_code: {
        Args: { p_code: string; p_order_total: number }
        Returns: {
          discount_xof: number
          use_id: string
        }[]
      }
      report_delivery_failure: {
        Args: { p_order_id: string; p_reason: string }
        Returns: boolean
      }
      request_rider_role: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role:
        | "customer"
        | "rider"
        | "merchant"
        | "admin"
        | "support"
        | "dispatcher"
        | "banned"
      delivery_type:
        | "standard"
        | "express"
        | "scheduled"
        | "multi_stop"
        | "errand"
      escrow_status: "held" | "released" | "disputed" | "refunded"
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
        | "rejected"
        | "failed_pickup"
        | "failed_delivery"
        | "returned"
        | "expired"
        | "rider_accepted"
        | "near_destination"
        | "delivery_verification"
        | "completed"
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
      app_role: [
        "customer",
        "rider",
        "merchant",
        "admin",
        "support",
        "dispatcher",
        "banned",
      ],
      delivery_type: [
        "standard",
        "express",
        "scheduled",
        "multi_stop",
        "errand",
      ],
      escrow_status: ["held", "released", "disputed", "refunded"],
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
        "rejected",
        "failed_pickup",
        "failed_delivery",
        "returned",
        "expired",
        "rider_accepted",
        "near_destination",
        "delivery_verification",
        "completed",
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
