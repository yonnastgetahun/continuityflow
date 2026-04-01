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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      documents_optin: {
        Row: {
          created_at: string
          document_type: string
          encrypted: boolean
          file_path: string
          id: string
          related_invoice_id: string | null
          related_vendor_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          document_type: string
          encrypted?: boolean
          file_path: string
          id?: string
          related_invoice_id?: string | null
          related_vendor_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          document_type?: string
          encrypted?: boolean
          file_path?: string
          id?: string
          related_invoice_id?: string | null
          related_vendor_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_optin_related_invoice_id_fkey"
            columns: ["related_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_optin_related_vendor_id_fkey"
            columns: ["related_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_optin_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      extraction_field_candidates: {
        Row: {
          candidate_value: string | null
          confidence: Database["public"]["Enums"]["extraction_confidence"]
          created_at: string
          evidence_snippet: string | null
          field_key: string
          id: string
          metadata: Json
          page_number: number | null
          selected_for_review: boolean
          session_id: string
          source: Database["public"]["Enums"]["extraction_provider"]
        }
        Insert: {
          candidate_value?: string | null
          confidence?: Database["public"]["Enums"]["extraction_confidence"]
          created_at?: string
          evidence_snippet?: string | null
          field_key: string
          id?: string
          metadata?: Json
          page_number?: number | null
          selected_for_review?: boolean
          session_id: string
          source: Database["public"]["Enums"]["extraction_provider"]
        }
        Update: {
          candidate_value?: string | null
          confidence?: Database["public"]["Enums"]["extraction_confidence"]
          created_at?: string
          evidence_snippet?: string | null
          field_key?: string
          id?: string
          metadata?: Json
          page_number?: number | null
          selected_for_review?: boolean
          session_id?: string
          source?: Database["public"]["Enums"]["extraction_provider"]
        }
        Relationships: [
          {
            foreignKeyName: "extraction_field_candidates_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "extraction_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      extraction_sessions: {
        Row: {
          ai_cost_usd: number
          ai_pages: number
          ai_processed_at: string | null
          ai_provider: string | null
          completed_at: string | null
          created_at: string
          failure_reason: string | null
          final_provider: Database["public"]["Enums"]["extraction_provider"] | null
          id: string
          invoice_id: string | null
          is_scanned: boolean
          metadata: Json
          mode: Database["public"]["Enums"]["extraction_mode"]
          requested_provider: Database["public"]["Enums"]["extraction_provider"]
          source_document_type: string
          started_at: string
          status: Database["public"]["Enums"]["extraction_status"]
          updated_at: string
          used_fallback: boolean
          user_id: string
          vendor_id: string | null
        }
        Insert: {
          ai_cost_usd?: number
          ai_pages?: number
          ai_processed_at?: string | null
          ai_provider?: string | null
          completed_at?: string | null
          created_at?: string
          failure_reason?: string | null
          final_provider?: Database["public"]["Enums"]["extraction_provider"] | null
          id?: string
          invoice_id?: string | null
          is_scanned?: boolean
          metadata?: Json
          mode?: Database["public"]["Enums"]["extraction_mode"]
          requested_provider?: Database["public"]["Enums"]["extraction_provider"]
          source_document_type?: string
          started_at?: string
          status?: Database["public"]["Enums"]["extraction_status"]
          updated_at?: string
          used_fallback?: boolean
          user_id: string
          vendor_id?: string | null
        }
        Update: {
          ai_cost_usd?: number
          ai_pages?: number
          ai_processed_at?: string | null
          ai_provider?: string | null
          completed_at?: string | null
          created_at?: string
          failure_reason?: string | null
          final_provider?: Database["public"]["Enums"]["extraction_provider"] | null
          id?: string
          invoice_id?: string | null
          is_scanned?: boolean
          metadata?: Json
          mode?: Database["public"]["Enums"]["extraction_mode"]
          requested_provider?: Database["public"]["Enums"]["extraction_provider"]
          source_document_type?: string
          started_at?: string
          status?: Database["public"]["Enums"]["extraction_status"]
          updated_at?: string
          used_fallback?: boolean
          user_id?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extraction_sessions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extraction_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extraction_sessions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          due_date: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          line_items: Json | null
          raw_data: Json | null
          subtotal: number | null
          tax: number | null
          total: number | null
          updated_at: string
          user_id: string
          vendor_id: string | null
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          line_items?: Json | null
          raw_data?: Json | null
          subtotal?: number | null
          tax?: number | null
          total?: number | null
          updated_at?: string
          user_id: string
          vendor_id?: string | null
        }
        Update: {
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          line_items?: Json | null
          raw_data?: Json | null
          subtotal?: number | null
          tax?: number | null
          total?: number | null
          updated_at?: string
          user_id?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          plan_type: Database["public"]["Enums"]["plan_type"] | null
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          plan_type?: Database["public"]["Enums"]["plan_type"] | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          plan_type?: Database["public"]["Enums"]["plan_type"] | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          bill_to: string | null
          created_at: string
          exported_at: string | null
          id: string
          invoice_id: string | null
          line_items: Json | null
          notes: string | null
          po_date: string
          po_number: string
          ship_to: string | null
          status: string | null
          subtotal: number | null
          tax: number | null
          total: number | null
          updated_at: string
          user_id: string
          vendor_id: string | null
        }
        Insert: {
          bill_to?: string | null
          created_at?: string
          exported_at?: string | null
          id?: string
          invoice_id?: string | null
          line_items?: Json | null
          notes?: string | null
          po_date?: string
          po_number: string
          ship_to?: string | null
          status?: string | null
          subtotal?: number | null
          tax?: number | null
          total?: number | null
          updated_at?: string
          user_id: string
          vendor_id?: string | null
        }
        Update: {
          bill_to?: string | null
          created_at?: string
          exported_at?: string | null
          id?: string
          invoice_id?: string | null
          line_items?: Json | null
          notes?: string | null
          po_date?: string
          po_number?: string
          ship_to?: string | null
          status?: string | null
          subtotal?: number | null
          tax?: number | null
          total?: number | null
          updated_at?: string
          user_id?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      review_field_decisions: {
        Row: {
          ai_value: string | null
          chosen_source: Database["public"]["Enums"]["review_decision_source"]
          created_at: string
          field_key: string
          final_value: string | null
          id: string
          local_value: string | null
          notes: string | null
          reviewed_at: string
          session_id: string
          user_changed: boolean
        }
        Insert: {
          ai_value?: string | null
          chosen_source?: Database["public"]["Enums"]["review_decision_source"]
          created_at?: string
          field_key: string
          final_value?: string | null
          id?: string
          local_value?: string | null
          notes?: string | null
          reviewed_at?: string
          session_id: string
          user_changed?: boolean
        }
        Update: {
          ai_value?: string | null
          chosen_source?: Database["public"]["Enums"]["review_decision_source"]
          created_at?: string
          field_key?: string
          final_value?: string | null
          id?: string
          local_value?: string | null
          notes?: string | null
          reviewed_at?: string
          session_id?: string
          user_changed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "review_field_decisions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "extraction_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_monthly: {
        Row: {
          ai_cost_usd: number
          ai_docs: number
          ai_pages: number
          created_at: string
          id: string
          updated_at: string
          usage_month: string
          user_id: string
        }
        Insert: {
          ai_cost_usd?: number
          ai_docs?: number
          ai_pages?: number
          created_at?: string
          id?: string
          updated_at?: string
          usage_month: string
          user_id: string
        }
        Update: {
          ai_cost_usd?: number
          ai_docs?: number
          ai_pages?: number
          created_at?: string
          id?: string
          updated_at?: string
          usage_month?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_monthly_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          state: string | null
          tax_id: string | null
          updated_at: string
          user_id: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
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
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "collaborator" | "viewer"
      extraction_confidence: "high" | "medium" | "low"
      extraction_mode: "local_only" | "enhanced_accuracy"
      extraction_provider: "local" | "ai" | "fallback_local" | "fused"
      extraction_status: "processing" | "completed" | "failed" | "cancelled"
      plan_type: "pilot" | "pro"
      review_decision_source: "local" | "ai" | "heuristic" | "fused" | "manual"
      subscription_status:
        | "trial_not_started"
        | "trial_active"
        | "trial_expiring"
        | "trial_expired"
        | "subscribed"
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
      app_role: ["owner", "collaborator", "viewer"],
      extraction_confidence: ["high", "medium", "low"],
      extraction_mode: ["local_only", "enhanced_accuracy"],
      extraction_provider: ["local", "ai", "fallback_local", "fused"],
      extraction_status: ["processing", "completed", "failed", "cancelled"],
      plan_type: ["pilot", "pro"],
      review_decision_source: ["local", "ai", "heuristic", "fused", "manual"],
      subscription_status: [
        "trial_not_started",
        "trial_active",
        "trial_expiring",
        "trial_expired",
        "subscribed",
      ],
    },
  },
} as const
