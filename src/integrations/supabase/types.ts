export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      agent_profiles: {
        Row: { user_id: string; active: boolean; assigned_by: string; created_at: string };
        Insert: { user_id: string; active?: boolean; assigned_by: string; created_at?: string };
        Update: { user_id?: string; active?: boolean; assigned_by?: string; created_at?: string };
        Relationships: [];
      };
      agent_client_commissions: {
        Row: {
          id: string;
          agent_id: string;
          client_id: string;
          qualifying_claim_id: string;
          amount_kes: number;
          credited_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          client_id: string;
          qualifying_claim_id: string;
          amount_kes?: number;
          credited_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          client_id?: string;
          qualifying_claim_id?: string;
          amount_kes?: number;
          credited_at?: string;
        };
        Relationships: [];
      };
      ad_views: {
        Row: {
          ad_id: string;
          completed_at: string | null;
          correct: boolean | null;
          id: string;
          points_awarded: number;
          started_at: string;
          user_id: string;
        };
        Insert: {
          ad_id: string;
          completed_at?: string | null;
          correct?: boolean | null;
          id?: string;
          points_awarded?: number;
          started_at?: string;
          user_id: string;
        };
        Update: {
          ad_id?: string;
          completed_at?: string | null;
          correct?: boolean | null;
          id?: string;
          points_awarded?: number;
          started_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ad_views_ad_id_fkey";
            columns: ["ad_id"];
            isOneToOne: false;
            referencedRelation: "ads";
            referencedColumns: ["id"];
          },
        ];
      };
      admin_agents: {
        Row: {
          active: boolean;
          commission_rate: number;
          commission_unit: string;
          country: string;
          created_at: string;
          currency: string;
          email: string | null;
          id: string;
          name: string;
          phone: string | null;
        };
        Insert: {
          active?: boolean;
          commission_rate: number;
          commission_unit: string;
          country?: string;
          created_at?: string;
          currency?: string;
          email?: string | null;
          id?: string;
          name: string;
          phone?: string | null;
        };
        Update: {
          active?: boolean;
          commission_rate?: number;
          commission_unit?: string;
          country?: string;
          created_at?: string;
          currency?: string;
          email?: string | null;
          id?: string;
          name?: string;
          phone?: string | null;
        };
        Relationships: [];
      };
      ads: {
        Row: {
          active: boolean;
          advertiser: string;
          correct_index: number;
          created_at: string;
          duration_sec: number;
          id: string;
          options: string[];
          points: number;
          question: string;
          title: string;
          video_url: string;
        };
        Insert: {
          active?: boolean;
          advertiser: string;
          correct_index: number;
          created_at?: string;
          duration_sec: number;
          id?: string;
          options: string[];
          points: number;
          question: string;
          title: string;
          video_url: string;
        };
        Update: {
          active?: boolean;
          advertiser?: string;
          correct_index?: number;
          created_at?: string;
          duration_sec?: number;
          id?: string;
          options?: string[];
          points?: number;
          question?: string;
          title?: string;
          video_url?: string;
        };
        Relationships: [];
      };
      agent_commissions: {
        Row: {
          agent_id: string;
          amount: number | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          id: string;
          note: string | null;
          paid_at: string | null;
          period_end: string;
          period_start: string;
          rate: number;
          reference: string | null;
          status: string;
          unit_label: string;
          units: number;
        };
        Insert: {
          agent_id: string;
          amount?: number | null;
          created_at?: string;
          created_by?: string | null;
          currency: string;
          id?: string;
          note?: string | null;
          paid_at?: string | null;
          period_end: string;
          period_start: string;
          rate: number;
          reference?: string | null;
          status?: string;
          unit_label: string;
          units: number;
        };
        Update: {
          agent_id?: string;
          amount?: number | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          id?: string;
          note?: string | null;
          paid_at?: string | null;
          period_end?: string;
          period_start?: string;
          rate?: number;
          reference?: string | null;
          status?: string;
          unit_label?: string;
          units?: number;
        };
        Relationships: [
          {
            foreignKeyName: "agent_commissions_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "admin_agents";
            referencedColumns: ["id"];
          },
        ];
      };
      device_accounts: {
        Row: {
          created_at: string;
          device_id: string;
          last_seen_at: string;
          user_id: string;
          verified_at: string | null;
        };
        Insert: {
          created_at?: string;
          device_id: string;
          last_seen_at?: string;
          user_id: string;
          verified_at?: string | null;
        };
        Update: {
          created_at?: string;
          device_id?: string;
          last_seen_at?: string;
          user_id?: string;
          verified_at?: string | null;
        };
        Relationships: [];
      };
      payouts: {
        Row: {
          amount: number;
          created_at: string;
          currency: string;
          destination: string;
          id: string;
          method: string;
          processed_at: string | null;
          reference: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          currency: string;
          destination: string;
          id?: string;
          method: string;
          processed_at?: string | null;
          reference?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          currency?: string;
          destination?: string;
          id?: string;
          method?: string;
          processed_at?: string | null;
          reference?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      platform_settings: {
        Row: {
          announcement: string | null;
          maintenance_mode: boolean;
          setting_key: string;
          support_email: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          announcement?: string | null;
          maintenance_mode?: boolean;
          setting_key?: string;
          support_email?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          announcement?: string | null;
          maintenance_mode?: boolean;
          setting_key?: string;
          support_email?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          balance_kes: number;
          country: string;
          created_at: string;
          device_lock_required: boolean;
          id: string;
          pending_device_id: string | null;
          phone: string;
          phone_number: string | null;
          phone_verified_at: string | null;
          referral_code: string;
          referred_by: string | null;
          username: string | null;
        };
        Insert: {
          balance_kes?: number;
          country?: string;
          created_at?: string;
          device_lock_required?: boolean;
          id: string;
          pending_device_id?: string | null;
          phone: string;
          phone_number?: string | null;
          phone_verified_at?: string | null;
          referral_code: string;
          referred_by?: string | null;
          username?: string | null;
        };
        Update: {
          balance_kes?: number;
          country?: string;
          created_at?: string;
          device_lock_required?: boolean;
          id?: string;
          pending_device_id?: string | null;
          phone?: string;
          phone_number?: string | null;
          phone_verified_at?: string | null;
          referral_code?: string;
          referred_by?: string | null;
          username?: string | null;
        };
        Relationships: [];
      };
      task_claims: {
        Row: {
          admin_note: string | null;
          claimed_at: string;
          evidence_url: string | null;
          id: string;
          report: string | null;
          reviewed_at: string | null;
          status: string;
          submitted_at: string | null;
          task_id: string;
          user_id: string;
        };
        Insert: {
          admin_note?: string | null;
          claimed_at?: string;
          evidence_url?: string | null;
          id?: string;
          report?: string | null;
          reviewed_at?: string | null;
          status?: string;
          submitted_at?: string | null;
          task_id: string;
          user_id: string;
        };
        Update: {
          admin_note?: string | null;
          claimed_at?: string;
          evidence_url?: string | null;
          id?: string;
          report?: string | null;
          reviewed_at?: string | null;
          status?: string;
          submitted_at?: string | null;
          task_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      task_private_instructions: {
        Row: { instructions: string; proof_prompt: string; task_id: string };
        Insert: { instructions: string; proof_prompt: string; task_id: string };
        Update: { instructions?: string; proof_prompt?: string; task_id?: string };
        Relationships: [];
      };
      tasks: {
        Row: {
          category: string;
          claimed_count: number;
          created_at: string;
          created_by: string;
          description: string;
          id: string;
          reward_kes: number;
          slots: number;
          task_type: "general" | "ad" | "account_subscription";
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          category?: string;
          claimed_count?: number;
          created_at?: string;
          created_by: string;
          description: string;
          id?: string;
          reward_kes: number;
          slots: number;
          task_type?: "general" | "ad" | "account_subscription";
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          claimed_count?: number;
          created_at?: string;
          created_by?: string;
          description?: string;
          id?: string;
          reward_kes?: number;
          slots?: number;
          task_type?: "general" | "ad" | "account_subscription";
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      wallet_transactions: {
        Row: {
          amount: number | null;
          created_at: string;
          currency: string | null;
          id: string;
          kind: string;
          note: string | null;
          reference_id: string | null;
          user_id: string;
        };
        Insert: {
          amount?: number | null;
          created_at?: string;
          currency?: string | null;
          id?: string;
          kind: string;
          note?: string | null;
          reference_id?: string | null;
          user_id: string;
        };
        Update: {
          amount?: number | null;
          created_at?: string;
          currency?: string | null;
          id?: string;
          kind?: string;
          note?: string | null;
          reference_id?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      complete_device_verification: {
        Args: { _device_id: string };
        Returns: undefined;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      my_referral_count: { Args: never; Returns: number };
      process_payout: {
        Args: { _id: string; _reference: string; _status: string };
        Returns: undefined;
      };
      register_device: { Args: { _device_id: string }; Returns: Json };
      claim_task: { Args: { _task_id: string }; Returns: string };
      submit_task: {
        Args: { _claim_id: string; _report: string; _evidence_url?: string | null };
        Returns: undefined;
      };
      review_task_submission: {
        Args: { _claim_id: string; _decision: string; _admin_note?: string | null };
        Returns: undefined;
      };
      request_payout: {
        Args: { _amount_kes: number; _destination: string };
        Returns: string;
      };
      sync_verified_phone: { Args: never; Returns: Json };
    };
    Enums: {
      app_role: "admin" | "user";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const;
