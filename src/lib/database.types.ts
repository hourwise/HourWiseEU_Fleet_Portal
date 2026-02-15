export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          auth_code: string;
          auth_code_expires_at: string;
          subscription_status: 'trial' | 'active' | 'inactive' | 'cancelled';
          max_drivers: number;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_period_end: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          auth_code: string;
          auth_code_expires_at: string;
          subscription_status?: 'trial' | 'active' | 'inactive' | 'cancelled';
          max_drivers?: number;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_period_end?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          auth_code?: string;
          auth_code_expires_at?: string;
          subscription_status?: 'trial' | 'active' | 'inactive' | 'cancelled';
          max_drivers?: number;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_period_end?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          role: 'driver' | 'manager';
          company_id: string | null;
          full_name: string;
          driver_license_number: string | null;
          is_active: boolean;
          account_type: 'fleet' | 'solo';
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: 'trial' | 'active' | 'inactive' | 'cancelled';
          subscription_period_end: string | null;
          trial_ends_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role: 'driver' | 'manager';
          company_id?: string | null;
          full_name: string;
          driver_license_number?: string | null;
          is_active?: boolean;
          account_type?: 'fleet' | 'solo';
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: 'trial' | 'active' | 'inactive' | 'cancelled';
          subscription_period_end?: string | null;
          trial_ends_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          role?: 'driver' | 'manager';
          company_id?: string | null;
          full_name?: string;
          driver_license_number?: string | null;
          is_active?: boolean;
          account_type?: 'fleet' | 'solo';
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: 'trial' | 'active' | 'inactive' | 'cancelled';
          subscription_period_end?: string | null;
          trial_ends_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey";
            columns: ["company_id"];
            referencedRelation: "companies";
            referencedColumns: ["id"];
          }
        ];
      };
      driver_logs: {
        Row: {
          id: string;
          driver_id: string;
          company_id: string;
          activity_type: 'driving' | 'work' | 'rest' | 'available' | 'break';
          start_time: string;
          end_time: string | null;
          duration_minutes: number | null;
          location_start: string | null;
          location_end: string | null;
          vehicle_id: string | null;
          notes: string | null;
          status_code: 'ok' | 'warning' | 'violation';
          infraction_type: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          driver_id: string;
          company_id: string;
          activity_type: 'driving' | 'work' | 'rest' | 'available' | 'break';
          start_time?: string;
          end_time?: string | null;
          duration_minutes?: number | null;
          location_start?: string | null;
          location_end?: string | null;
          vehicle_id?: string | null;
          notes?: string | null;
          status_code?: 'ok' | 'warning' | 'violation';
          infraction_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          driver_id?: string;
          company_id?: string;
          activity_type?: 'driving' | 'work' | 'rest' | 'available' | 'break';
          start_time?: string;
          end_time?: string | null;
          duration_minutes?: number | null;
          location_start?: string | null;
          location_end?: string | null;
          vehicle_id?: string | null;
          notes?: string | null;
          status_code?: 'ok' | 'warning' | 'violation';
          infraction_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "driver_logs_driver_id_fkey";
            columns: ["driver_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "driver_logs_company_id_fkey";
            columns: ["company_id"];
            referencedRelation: "companies";
            referencedColumns: ["id"];
          }
        ];
      };
      work_sessions: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          start_time: string;
          end_time: string | null;
          total_work_minutes: number | null;
          total_poa_minutes: number | null;
          total_break_minutes: number | null;
          is_manual_entry: boolean;
          timezone: string;
          status: string;
          compliance_score: number | null;
          compliance_violations: string[] | null;
          other_data: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          start_time: string;
          end_time?: string | null;
          total_work_minutes?: number | null;
          total_poa_minutes?: number | null;
          total_break_minutes?: number | null;
          is_manual_entry?: boolean;
          timezone?: string;
          status?: string;
          compliance_score?: number | null;
          compliance_violations?: string[] | null;
          other_data?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          start_time?: string;
          end_time?: string | null;
          total_work_minutes?: number | null;
          total_poa_minutes?: number | null;
          total_break_minutes?: number | null;
          is_manual_entry?: boolean;
          timezone?: string;
          status?: string;
          compliance_score?: number | null;
          compliance_violations?: string[] | null;
          other_data?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "work_sessions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      invoices: {
        Row: {
          id: string;
          driver_id: string;
          invoice_number: string;
          client_name: string;
          client_email: string | null;
          client_address: string | null;
          issue_date: string;
          due_date: string;
          status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
          subtotal: number;
          tax_rate: number;
          tax_amount: number;
          total_amount: number;
          currency: string;
          line_items: Json;
          notes: string | null;
          payment_terms: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          driver_id: string;
          invoice_number: string;
          client_name: string;
          client_email?: string | null;
          client_address?: string | null;
          issue_date?: string;
          due_date: string;
          status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
          subtotal?: number;
          tax_rate?: number;
          tax_amount?: number;
          total_amount?: number;
          currency?: string;
          line_items?: Json;
          notes?: string | null;
          payment_terms?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          driver_id?: string;
          invoice_number?: string;
          client_name?: string;
          client_email?: string | null;
          client_address?: string | null;
          issue_date?: string;
          due_date?: string;
          status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
          subtotal?: number;
          tax_rate?: number;
          tax_amount?: number;
          total_amount?: number;
          currency?: string;
          line_items?: Json;
          notes?: string | null;
          payment_terms?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_driver_id_fkey";
            columns: ["driver_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      generate_auth_code: {
        Args: Record<string, never>;
        Returns: string;
      };
      validate_auth_code: {
        Args: { code: string };
        Returns: string;
      };
      generate_invoice_number: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: {
      user_role: 'driver' | 'manager';
      subscription_status: 'trial' | 'active' | 'inactive' | 'cancelled';
      activity_type: 'driving' | 'work' | 'rest' | 'available' | 'break';
      status_code: 'ok' | 'warning' | 'violation';
      account_type: 'fleet' | 'solo';
      invoice_status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
    };
    CompositeTypes: Record<string, never>;
  };
}
