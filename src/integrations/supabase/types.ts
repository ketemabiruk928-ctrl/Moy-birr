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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          check_in: string
          check_out: string
          commission: number
          created_at: string
          guest_id: string
          hotel_id: string
          id: string
          nights: number
          room_id: string | null
          room_type: string
          status: string
          total: number
        }
        Insert: {
          check_in: string
          check_out: string
          commission?: number
          created_at?: string
          guest_id: string
          hotel_id: string
          id?: string
          nights?: number
          room_id?: string | null
          room_type?: string
          status?: string
          total: number
        }
        Update: {
          check_in?: string
          check_out?: string
          commission?: number
          created_at?: string
          guest_id?: string
          hotel_id?: string
          id?: string
          nights?: number
          room_id?: string | null
          room_type?: string
          status?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "bookings_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_media: {
        Row: {
          caption: string | null
          created_at: string
          hotel_id: string
          id: string
          kind: string
          sort_order: number
          url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          hotel_id: string
          id?: string
          kind?: string
          sort_order?: number
          url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          hotel_id?: string
          id?: string
          kind?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_media_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_ratings: {
        Row: {
          booking_id: string | null
          comment: string | null
          created_at: string
          guest_id: string
          hotel_id: string
          id: string
          stars: number
        }
        Insert: {
          booking_id?: string | null
          comment?: string | null
          created_at?: string
          guest_id: string
          hotel_id: string
          id?: string
          stars: number
        }
        Update: {
          booking_id?: string | null
          comment?: string | null
          created_at?: string
          guest_id?: string
          hotel_id?: string
          id?: string
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "hotel_ratings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_ratings_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels: {
        Row: {
          city: string
          created_at: string
          description: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          owner_id: string | null
          photo_url: string | null
          price_from: number
        }
        Insert: {
          city?: string
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          owner_id?: string | null
          photo_url?: string | null
          price_from?: number
        }
        Update: {
          city?: string
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          owner_id?: string | null
          photo_url?: string | null
          price_from?: number
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          created_at: string
          id: string
          job_id: string
          message: string | null
          staff_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          message?: string | null
          staff_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          message?: string | null
          staff_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          created_at: string
          description: string
          hotel_id: string | null
          id: string
          location: string
          owner_id: string
          salary: number | null
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string
          hotel_id?: string | null
          id?: string
          location?: string
          owner_id: string
          salary?: number | null
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          hotel_id?: string | null
          id?: string
          location?: string
          owner_id?: string
          salary?: number | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          language: string
          phone: string
          photo_url: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          language?: string
          phone?: string
          photo_url?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          language?: string
          phone?: string
          photo_url?: string | null
        }
        Relationships: []
      }
      ratings: {
        Row: {
          booking_id: string | null
          comment: string | null
          created_at: string
          guest_id: string
          id: string
          staff_id: string
          stars: number
        }
        Insert: {
          booking_id?: string | null
          comment?: string | null
          created_at?: string
          guest_id: string
          id?: string
          staff_id: string
          stars: number
        }
        Update: {
          booking_id?: string | null
          comment?: string | null
          created_at?: string
          guest_id?: string
          id?: string
          staff_id?: string
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          capacity: number
          created_at: string
          hotel_id: string
          id: string
          price: number
          room_type: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          hotel_id: string
          id?: string
          price: number
          room_type: string
        }
        Update: {
          capacity?: number
          created_at?: string
          hotel_id?: string
          id?: string
          price?: number
          room_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_profiles: {
        Row: {
          city: string
          created_at: string
          hotel_id: string | null
          id: string
          lat: number | null
          lng: number | null
          position: string
          rating: number
          rating_count: number
          user_id: string
        }
        Insert: {
          city?: string
          created_at?: string
          hotel_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          position?: string
          rating?: number
          rating_count?: number
          user_id: string
        }
        Update: {
          city?: string
          created_at?: string
          hotel_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          position?: string
          rating?: number
          rating_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_profiles_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          end_date: string
          id: string
          owner_id: string
          plan: string
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          owner_id: string
          plan?: string
          start_date?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          owner_id?: string
          plan?: string
          start_date?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          receiver_id: string | null
          sender_id: string | null
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          receiver_id?: string | null
          sender_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          receiver_id?: string | null
          sender_id?: string | null
          type?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          bank_linked: string | null
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          balance?: number
          bank_linked?: string | null
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          balance?: number
          bank_linked?: string | null
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      book_hotel: {
        Args: { _check_in: string; _check_out: string; _room_id: string }
        Returns: string
      }
      cancel_booking: { Args: { _booking_id: string }; Returns: number }
      ensure_my_account: {
        Args: {
          _full_name?: string
          _phone?: string
          _role?: Database["public"]["Enums"]["app_role"]
        }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      owner_plan_active: { Args: { _owner: string }; Returns: boolean }
      pay_service: {
        Args: {
          _amount: number
          _hotel_id: string
          _staff_profile_id: string
          _tip: number
        }
        Returns: number
      }
      post_job: {
        Args: {
          _description: string
          _hotel_id: string
          _location: string
          _salary: number
          _title: string
        }
        Returns: string
      }
      rate_staff: {
        Args: {
          _booking_id: string
          _comment: string
          _staff_profile_id: string
          _stars: number
        }
        Returns: undefined
      }
      save_my_hotel: {
        Args: {
          _city: string
          _description: string
          _name: string
          _photo_url: string
          _price_from: number
        }
        Returns: string
      }
      subscribe_premium: { Args: never; Returns: string }
      wallet_deposit: {
        Args: { _amount: number; _source: string }
        Returns: number
      }
      wallet_transfer: {
        Args: { _amount: number; _note: string; _phone: string }
        Returns: number
      }
      wallet_withdraw: {
        Args: { _amount: number; _destination: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "guest" | "staff" | "owner"
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
      app_role: ["guest", "staff", "owner"],
    },
  },
} as const
