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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      account_deletion_requests: {
        Row: {
          company_id: string | null
          email: string | null
          id: string
          metadata: Json
          profile_id: string | null
          reason: string | null
          requested_at: string
          role: string | null
          source: string
          status: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          email?: string | null
          id?: string
          metadata?: Json
          profile_id?: string | null
          reason?: string | null
          requested_at?: string
          role?: string | null
          source?: string
          status?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          email?: string | null
          id?: string
          metadata?: Json
          profile_id?: string | null
          reason?: string | null
          requested_at?: string
          role?: string | null
          source?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_deletion_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "account_deletion_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_dismissed: boolean
          is_read: boolean
          message: string
          metadata: Json | null
          severity: string
          type: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_dismissed?: boolean
          is_read?: boolean
          message: string
          metadata?: Json | null
          severity?: string
          type: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_dismissed?: boolean
          is_read?: boolean
          message?: string
          metadata?: Json | null
          severity?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_rates: {
        Row: {
          base_rate: number
          created_at: string | null
          empty_running_rate: number | null
          fuel_surcharge_pct: number | null
          id: string
          is_active: boolean | null
          overtime_multiplier: number | null
          overtime_threshold_hours: number | null
          rate_type: string
          user_id: string | null
          waiting_time_free_minutes: number | null
          waiting_time_rate: number | null
        }
        Insert: {
          base_rate: number
          created_at?: string | null
          empty_running_rate?: number | null
          fuel_surcharge_pct?: number | null
          id?: string
          is_active?: boolean | null
          overtime_multiplier?: number | null
          overtime_threshold_hours?: number | null
          rate_type: string
          user_id?: string | null
          waiting_time_free_minutes?: number | null
          waiting_time_rate?: number | null
        }
        Update: {
          base_rate?: number
          created_at?: string | null
          empty_running_rate?: number | null
          fuel_surcharge_pct?: number | null
          id?: string
          is_active?: boolean | null
          overtime_multiplier?: number | null
          overtime_threshold_hours?: number | null
          rate_type?: string
          user_id?: string | null
          waiting_time_free_minutes?: number | null
          waiting_time_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_rates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "billing_rates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcasts: {
        Row: {
          company_id: string
          content: string
          created_at: string
          id: string
          sent_by: string | null
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string
          id?: string
          sent_by?: string | null
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          sent_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcasts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcasts_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "broadcasts_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_profiles: {
        Row: {
          address: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_sort_code: string | null
          created_at: string | null
          email: string | null
          iban: string | null
          id: number
          invoice_counter: number | null
          legal_name: string | null
          logo_url: string | null
          payment_terms: string | null
          phone: string | null
          tax_id: string | null
          user_id: string
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_sort_code?: string | null
          created_at?: string | null
          email?: string | null
          iban?: string | null
          id?: number
          invoice_counter?: number | null
          legal_name?: string | null
          logo_url?: string | null
          payment_terms?: string | null
          phone?: string | null
          tax_id?: string | null
          user_id: string
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_sort_code?: string | null
          created_at?: string | null
          email?: string | null
          iban?: string | null
          id?: number
          invoice_counter?: number | null
          legal_name?: string | null
          logo_url?: string | null
          payment_terms?: string | null
          phone?: string | null
          tax_id?: string | null
          user_id?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          billing_type: string | null
          billing_types: string | null
          created_at: string | null
          custom_line_items: Json | null
          daily_rate: number | null
          email: string | null
          fuel_surcharge_pct: number | null
          hourly_rate: number | null
          id: string
          name: string
          night_out_rate: number | null
          notes: string | null
          payment_terms: string | null
          ppm_empty_rate: number | null
          ppm_loaded_rate: number | null
          user_id: string | null
          waiting_time_free_minutes: number | null
          waiting_time_rate: number | null
        }
        Insert: {
          address?: string | null
          billing_type?: string | null
          billing_types?: string | null
          created_at?: string | null
          custom_line_items?: Json | null
          daily_rate?: number | null
          email?: string | null
          fuel_surcharge_pct?: number | null
          hourly_rate?: number | null
          id?: string
          name: string
          night_out_rate?: number | null
          notes?: string | null
          payment_terms?: string | null
          ppm_empty_rate?: number | null
          ppm_loaded_rate?: number | null
          user_id?: string | null
          waiting_time_free_minutes?: number | null
          waiting_time_rate?: number | null
        }
        Update: {
          address?: string | null
          billing_type?: string | null
          billing_types?: string | null
          created_at?: string | null
          custom_line_items?: Json | null
          daily_rate?: number | null
          email?: string | null
          fuel_surcharge_pct?: number | null
          hourly_rate?: number | null
          id?: string
          name?: string
          night_out_rate?: number | null
          notes?: string | null
          payment_terms?: string | null
          ppm_empty_rate?: number | null
          ppm_loaded_rate?: number | null
          user_id?: string | null
          waiting_time_free_minutes?: number | null
          waiting_time_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "clients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          auth_code: string | null
          auth_code_expires_at: string | null
          created_at: string | null
          created_by: string | null
          default_fuel_cost_per_litre: number | null
          id: string
          max_drivers: number | null
          name: string
          pmi_alert_days: number | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_period_end: string | null
          subscription_status: string | null
          subscription_tier: string | null
        }
        Insert: {
          auth_code?: string | null
          auth_code_expires_at?: string | null
          created_at?: string | null
          created_by?: string | null
          default_fuel_cost_per_litre?: number | null
          id?: string
          max_drivers?: number | null
          name: string
          pmi_alert_days?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_period_end?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
        }
        Update: {
          auth_code?: string | null
          auth_code_expires_at?: string | null
          created_at?: string | null
          created_by?: string | null
          default_fuel_cost_per_litre?: number | null
          id?: string
          max_drivers?: number | null
          name?: string
          pmi_alert_days?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_period_end?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
        }
        Relationships: []
      }
      company_operator_licence_profiles: {
        Row: {
          authorised_trailer_count: number
          authorised_vehicle_count: number
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          operator_licence_expiry: string | null
          operator_licence_number: string | null
          operator_licence_region: string | null
          operator_licence_status: string | null
          operator_licence_type: string | null
          transport_manager_cpc_expiry: string | null
          transport_manager_name: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          authorised_trailer_count?: number
          authorised_vehicle_count?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          operator_licence_expiry?: string | null
          operator_licence_number?: string | null
          operator_licence_region?: string | null
          operator_licence_status?: string | null
          operator_licence_type?: string | null
          transport_manager_cpc_expiry?: string | null
          transport_manager_name?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          authorised_trailer_count?: number
          authorised_vehicle_count?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          operator_licence_expiry?: string | null
          operator_licence_number?: string | null
          operator_licence_region?: string | null
          operator_licence_status?: string | null
          operator_licence_type?: string | null
          transport_manager_cpc_expiry?: string | null
          transport_manager_name?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_operator_licence_profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_operator_licence_profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "company_operator_licence_profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_operator_licence_profiles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "company_operator_licence_profiles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_timeline_summaries: {
        Row: {
          availability_seconds: number
          break_seconds: number
          company_id: string
          confidence_state: string
          created_at: string
          driver_id: string | null
          driving_seconds: number
          duty_end: string | null
          duty_start: string | null
          finding_count: number
          gap_count: number
          id: string
          metadata: Json
          rest_seconds: number
          summary_date: string
          timeline_generation_id: string
          unknown_seconds: number
          updated_at: string
          vehicle_id: string | null
          work_seconds: number
        }
        Insert: {
          availability_seconds?: number
          break_seconds?: number
          company_id: string
          confidence_state?: string
          created_at?: string
          driver_id?: string | null
          driving_seconds?: number
          duty_end?: string | null
          duty_start?: string | null
          finding_count?: number
          gap_count?: number
          id?: string
          metadata?: Json
          rest_seconds?: number
          summary_date: string
          timeline_generation_id: string
          unknown_seconds?: number
          updated_at?: string
          vehicle_id?: string | null
          work_seconds?: number
        }
        Update: {
          availability_seconds?: number
          break_seconds?: number
          company_id?: string
          confidence_state?: string
          created_at?: string
          driver_id?: string | null
          driving_seconds?: number
          duty_end?: string | null
          duty_start?: string | null
          finding_count?: number
          gap_count?: number
          id?: string
          metadata?: Json
          rest_seconds?: number
          summary_date?: string
          timeline_generation_id?: string
          unknown_seconds?: number
          updated_at?: string
          vehicle_id?: string | null
          work_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_timeline_summaries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_timeline_summaries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "daily_timeline_summaries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_timeline_summaries_timeline_generation_id_fkey"
            columns: ["timeline_generation_id"]
            isOneToOne: false
            referencedRelation: "timeline_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_timeline_summaries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      defect_photos: {
        Row: {
          id: string
          storage_path: string
          uploaded_at: string | null
          vehicle_check_id: string | null
        }
        Insert: {
          id?: string
          storage_path: string
          uploaded_at?: string | null
          vehicle_check_id?: string | null
        }
        Update: {
          id?: string
          storage_path?: string
          uploaded_at?: string | null
          vehicle_check_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "defect_photos_vehicle_check_id_fkey"
            columns: ["vehicle_check_id"]
            isOneToOne: false
            referencedRelation: "vehicle_checks"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_acknowledgements: {
        Row: {
          acknowledged_at: string
          company_id: string
          created_at: string
          driver_id: string
          event_id: string
          id: string
          note: string | null
        }
        Insert: {
          acknowledged_at?: string
          company_id: string
          created_at?: string
          driver_id: string
          event_id: string
          id?: string
          note?: string | null
        }
        Update: {
          acknowledged_at?: string
          company_id?: string
          created_at?: string
          driver_id?: string
          event_id?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_acknowledgements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_acknowledgements_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "driver_acknowledgements_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_acknowledgements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "driver_visible_fleet_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_acknowledgements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "fleet_events"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_card_downloads: {
        Row: {
          card_expiry: string | null
          card_number: string
          company_id: string | null
          created_at: string
          download_status: string
          downloaded_at: string
          driver_id: string | null
          driver_name: string | null
          id: string
          import_id: string
          issuing_country: string | null
          parser_run_id: string | null
          period_end: string
          period_start: string
        }
        Insert: {
          card_expiry?: string | null
          card_number: string
          company_id?: string | null
          created_at?: string
          download_status: string
          downloaded_at: string
          driver_id?: string | null
          driver_name?: string | null
          id?: string
          import_id: string
          issuing_country?: string | null
          parser_run_id?: string | null
          period_end: string
          period_start: string
        }
        Update: {
          card_expiry?: string | null
          card_number?: string
          company_id?: string | null
          created_at?: string
          download_status?: string
          downloaded_at?: string
          driver_id?: string | null
          driver_name?: string | null
          id?: string
          import_id?: string
          issuing_country?: string | null
          parser_run_id?: string | null
          period_end?: string
          period_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_card_downloads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_card_downloads_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "driver_card_downloads_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_card_downloads_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "tachograph_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_card_downloads_parser_run_id_fkey"
            columns: ["parser_run_id"]
            isOneToOne: false
            referencedRelation: "tachograph_processing_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_documents: {
        Row: {
          company_id: string
          document_type: string
          expiry_date: string | null
          id: string
          id_number: string | null
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
          user_id: string
          verified_at: string | null
        }
        Insert: {
          company_id: string
          document_type: string
          expiry_date?: string | null
          id?: string
          id_number?: string | null
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
          user_id: string
          verified_at?: string | null
        }
        Update: {
          company_id?: string
          document_type?: string
          expiry_date?: string | null
          id?: string
          id_number?: string | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "driver_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "driver_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_invites: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          full_name: string
          id: string
          invite_code: string
          pay_config_snapshot: Json | null
          status: string
          tacho_card_expiry: string | null
          tacho_card_holder_name: string | null
          tacho_card_issuing_authority: string | null
          tacho_card_number: string | null
          tacho_source_import_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at: string
          full_name: string
          id?: string
          invite_code: string
          pay_config_snapshot?: Json | null
          status?: string
          tacho_card_expiry?: string | null
          tacho_card_holder_name?: string | null
          tacho_card_issuing_authority?: string | null
          tacho_card_number?: string | null
          tacho_source_import_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invite_code?: string
          pay_config_snapshot?: Json | null
          status?: string
          tacho_card_expiry?: string | null
          tacho_card_holder_name?: string | null
          tacho_card_issuing_authority?: string | null
          tacho_card_number?: string | null
          tacho_source_import_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_invites_tacho_source_import_id_fkey"
            columns: ["tacho_source_import_id"]
            isOneToOne: false
            referencedRelation: "tachograph_files"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_tacho_compliance_signals: {
        Row: {
          average_score: number
          company_id: string | null
          driver_id: string
          generated_at: string
          has_data: boolean
          id: string
          missing_mileage: Json
          period_days: number
          recent_violations: Json
          reconciliation_summary: Json
          review_focus: Json | null
          source: string
          total_violations: number
          violations: Json
        }
        Insert: {
          average_score: number
          company_id?: string | null
          driver_id: string
          generated_at?: string
          has_data?: boolean
          id?: string
          missing_mileage?: Json
          period_days: number
          recent_violations?: Json
          reconciliation_summary?: Json
          review_focus?: Json | null
          source?: string
          total_violations: number
          violations?: Json
        }
        Update: {
          average_score?: number
          company_id?: string | null
          driver_id?: string
          generated_at?: string
          has_data?: boolean
          id?: string
          missing_mileage?: Json
          period_days?: number
          recent_violations?: Json
          reconciliation_summary?: Json
          review_focus?: Json | null
          source?: string
          total_violations?: number
          violations?: Json
        }
        Relationships: [
          {
            foreignKeyName: "driver_tacho_compliance_signals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_tacho_compliance_signals_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "driver_tacho_compliance_signals_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_tacho_risk_signals: {
        Row: {
          app_mismatch_count: number
          company_id: string | null
          driver_id: string
          generated_at: string
          id: string
          legal_compliance_score: number
          missing_mileage_count: number
          period_days: number
          reconciliation_summary: Json
          review_focus: Json | null
          source: string
          violation_count: number
        }
        Insert: {
          app_mismatch_count?: number
          company_id?: string | null
          driver_id: string
          generated_at?: string
          id?: string
          legal_compliance_score: number
          missing_mileage_count?: number
          period_days: number
          reconciliation_summary?: Json
          review_focus?: Json | null
          source?: string
          violation_count: number
        }
        Update: {
          app_mismatch_count?: number
          company_id?: string | null
          driver_id?: string
          generated_at?: string
          id?: string
          legal_compliance_score?: number
          missing_mileage_count?: number
          period_days?: number
          reconciliation_summary?: Json
          review_focus?: Json | null
          source?: string
          violation_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "driver_tacho_risk_signals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_tacho_risk_signals_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "driver_tacho_risk_signals_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_reviews: {
        Row: {
          created_at: string
          decision: string
          expense_id: string
          id: string
          note: string | null
          reviewed_at: string
          reviewed_by: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decision: string
          expense_id: string
          id?: string
          note?: string | null
          reviewed_at?: string
          reviewed_by: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decision?: string
          expense_id?: string
          id?: string
          note?: string | null
          reviewed_at?: string
          reviewed_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_reviews_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: true
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "expense_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          currency: string | null
          date: string
          fuel_litres: number | null
          id: string
          image_url: string | null
          merchant: string | null
          notes: string | null
          raw_ocr_text: string | null
          session_id: string | null
          user_id: string
          vehicle_check_id: string | null
          vehicle_reg: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string | null
          currency?: string | null
          date: string
          fuel_litres?: number | null
          id?: string
          image_url?: string | null
          merchant?: string | null
          notes?: string | null
          raw_ocr_text?: string | null
          session_id?: string | null
          user_id: string
          vehicle_check_id?: string | null
          vehicle_reg?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          currency?: string | null
          date?: string
          fuel_litres?: number | null
          id?: string
          image_url?: string | null
          merchant?: string | null
          notes?: string | null
          raw_ocr_text?: string | null
          session_id?: string | null
          user_id?: string
          vehicle_check_id?: string | null
          vehicle_reg?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "work_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_vehicle_check_id_fkey"
            columns: ["vehicle_check_id"]
            isOneToOne: false
            referencedRelation: "vehicle_checks"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_events: {
        Row: {
          actor_id: string | null
          body: string | null
          company_id: string
          created_at: string
          event_type: string
          expires_at: string | null
          id: string
          payload: Json
          priority: string
          recipient_driver_id: string | null
          related_message_id: string | null
          related_shift_id: string | null
          requires_ack: boolean
          thread_id: string | null
          title: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          company_id: string
          created_at?: string
          event_type: string
          expires_at?: string | null
          id?: string
          payload?: Json
          priority?: string
          recipient_driver_id?: string | null
          related_message_id?: string | null
          related_shift_id?: string | null
          requires_ack?: boolean
          thread_id?: string | null
          title: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          company_id?: string
          created_at?: string
          event_type?: string
          expires_at?: string | null
          id?: string
          payload?: Json
          priority?: string
          recipient_driver_id?: string | null
          related_message_id?: string | null
          related_shift_id?: string | null
          requires_ack?: boolean
          thread_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fleet_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_events_recipient_driver_id_fkey"
            columns: ["recipient_driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fleet_events_recipient_driver_id_fkey"
            columns: ["recipient_driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_events_related_message_id_fkey"
            columns: ["related_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_events_related_shift_id_fkey"
            columns: ["related_shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_events_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_logs: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          distance_covered: number | null
          driver_id: string
          end_odometer: number | null
          fuel_added_litres: number
          fuel_cost_per_litre: number | null
          fuel_type: string
          id: string
          log_date: string
          mpg: number | null
          notes: string | null
          reg_number: string
          source: string
          start_odometer: number | null
          total_fuel_cost: number | null
          vehicle_check_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          distance_covered?: number | null
          driver_id: string
          end_odometer?: number | null
          fuel_added_litres?: number
          fuel_cost_per_litre?: number | null
          fuel_type: string
          id?: string
          log_date?: string
          mpg?: number | null
          notes?: string | null
          reg_number: string
          source?: string
          start_odometer?: number | null
          total_fuel_cost?: number | null
          vehicle_check_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          distance_covered?: number | null
          driver_id?: string
          end_odometer?: number | null
          fuel_added_litres?: number
          fuel_cost_per_litre?: number | null
          fuel_type?: string
          id?: string
          log_date?: string
          mpg?: number | null
          notes?: string | null
          reg_number?: string
          source?: string
          start_odometer?: number | null
          total_fuel_cost?: number | null
          vehicle_check_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fuel_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_logs_vehicle_check_id_fkey"
            columns: ["vehicle_check_id"]
            isOneToOne: false
            referencedRelation: "vehicle_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          company_id: string
          created_at: string
          description: string
          driver_id: string
          has_injury: boolean | null
          id: string
          injury_details: string | null
          is_third_party_involved: boolean | null
          location: string
          manager_notes: string | null
          occurred_at: string
          photo_urls: string[] | null
          police_ref: string | null
          status: string
          third_party_details: Json | null
          type: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          description: string
          driver_id: string
          has_injury?: boolean | null
          id?: string
          injury_details?: string | null
          is_third_party_involved?: boolean | null
          location: string
          manager_notes?: string | null
          occurred_at: string
          photo_urls?: string[] | null
          police_ref?: string | null
          status?: string
          third_party_details?: Json | null
          type: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string
          driver_id?: string
          has_injury?: boolean | null
          id?: string
          injury_details?: string | null
          is_third_party_involved?: boolean | null
          location?: string
          manager_notes?: string | null
          occurred_at?: string
          photo_urls?: string[] | null
          police_ref?: string | null
          status?: string
          third_party_details?: Json | null
          type?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "incidents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      infringements: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string | null
          debriefed_at: string | null
          debriefed_by: string | null
          driver_id: string
          driver_statement: string | null
          id: string
          manager_notes: string | null
          occurred_at: string
          regulation: string
          session_id: string | null
          severity: string
          status: string
          training_record_id: string | null
          violation_type: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by?: string | null
          debriefed_at?: string | null
          debriefed_by?: string | null
          driver_id: string
          driver_statement?: string | null
          id?: string
          manager_notes?: string | null
          occurred_at: string
          regulation?: string
          session_id?: string | null
          severity?: string
          status?: string
          training_record_id?: string | null
          violation_type: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          debriefed_at?: string | null
          debriefed_by?: string | null
          driver_id?: string
          driver_statement?: string | null
          id?: string
          manager_notes?: string | null
          occurred_at?: string
          regulation?: string
          session_id?: string | null
          severity?: string
          status?: string
          training_record_id?: string | null
          violation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "infringements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infringements_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "infringements_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infringements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "work_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "infringements_training_record_id_fkey"
            columns: ["training_record_id"]
            isOneToOne: false
            referencedRelation: "training_records"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_address: string | null
          client_email: string | null
          client_name: string
          created_at: string | null
          currency: string
          driver_id: string
          due_date: string
          id: string
          invoice_number: string
          issue_date: string
          line_items: Json | null
          notes: string | null
          payment_terms: string | null
          status: string
          subtotal: number
          tax_amount: number | null
          tax_rate: number | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          client_address?: string | null
          client_email?: string | null
          client_name: string
          created_at?: string | null
          currency?: string
          driver_id: string
          due_date: string
          id?: string
          invoice_number: string
          issue_date?: string
          line_items?: Json | null
          notes?: string | null
          payment_terms?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number | null
          tax_rate?: number | null
          total_amount?: number
          updated_at?: string | null
        }
        Update: {
          client_address?: string | null
          client_email?: string | null
          client_name?: string
          created_at?: string | null
          currency?: string
          driver_id?: string
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          line_items?: Json | null
          notes?: string | null
          payment_terms?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number | null
          tax_rate?: number | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "invoices_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_assignments: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          company_id: string
          created_at: string
          driver_id: string
          expected_duration_minutes: number | null
          id: string
          job_id: string
          planned_arrival_at: string | null
          planned_departure_at: string | null
          published_at: string | null
          published_by: string | null
          sequence: number
          shift_id: string
          status: Database["public"]["Enums"]["job_assignment_status"]
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id: string
          created_at?: string
          driver_id: string
          expected_duration_minutes?: number | null
          id?: string
          job_id: string
          planned_arrival_at?: string | null
          planned_departure_at?: string | null
          published_at?: string | null
          published_by?: string | null
          sequence?: number
          shift_id: string
          status?: Database["public"]["Enums"]["job_assignment_status"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id?: string
          created_at?: string
          driver_id?: string
          expected_duration_minutes?: number | null
          id?: string
          job_id?: string
          planned_arrival_at?: string | null
          planned_departure_at?: string | null
          published_at?: string | null
          published_by?: string | null
          sequence?: number
          shift_id?: string
          status?: Database["public"]["Enums"]["job_assignment_status"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_assignments_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "job_assignments_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "job_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "job_assignments_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          address_text: string
          company_id: string
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          customer_name: string | null
          id: string
          instructions: string | null
          job_type: string
          manager_notes: string | null
          reference: string
          title: string
          updated_at: string
        }
        Insert: {
          address_text: string
          company_id: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          id?: string
          instructions?: string | null
          job_type?: string
          manager_notes?: string | null
          reference: string
          title: string
          updated_at?: string
        }
        Update: {
          address_text?: string
          company_id?: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          id?: string
          instructions?: string | null
          job_type?: string
          manager_notes?: string | null
          reference?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_logs: {
        Row: {
          company_id: string | null
          completed_at: string
          cost: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          document_url: string | null
          event_type: string
          id: string
          odometer_at_service: number | null
          service_provider: string | null
          vehicle_check_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          company_id?: string | null
          completed_at: string
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          document_url?: string | null
          event_type: string
          id?: string
          odometer_at_service?: number | null
          service_provider?: string | null
          vehicle_check_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          company_id?: string | null
          completed_at?: string
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          document_url?: string | null
          event_type?: string
          id?: string
          odometer_at_service?: number | null
          service_provider?: string | null
          vehicle_check_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_vehicle_check_id_fkey"
            columns: ["vehicle_check_id"]
            isOneToOne: false
            referencedRelation: "vehicle_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reads: {
        Row: {
          id: string
          message_id: string | null
          read_at: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          message_id?: string | null
          read_at?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          message_id?: string | null
          read_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "message_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          archived_at: string | null
          company_id: string
          created_at: string
          created_by: string | null
          driver_id: string | null
          id: string
          last_event_id: string | null
          subject: string | null
          thread_type: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          id?: string
          last_event_id?: string | null
          subject?: string | null
          thread_type: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          id?: string
          last_event_id?: string | null
          subject?: string | null
          thread_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "message_threads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "message_threads_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_last_event_id_fkey"
            columns: ["last_event_id"]
            isOneToOne: false
            referencedRelation: "driver_visible_fleet_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_last_event_id_fkey"
            columns: ["last_event_id"]
            isOneToOne: false
            referencedRelation: "fleet_events"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          company_id: string
          created_at: string | null
          fleet_event_id: string | null
          id: string
          read_at: string | null
          recipient_id: string | null
          sender_id: string | null
          thread_id: string | null
        }
        Insert: {
          body: string
          company_id: string
          created_at?: string | null
          fleet_event_id?: string | null
          id?: string
          read_at?: string | null
          recipient_id?: string | null
          sender_id?: string | null
          thread_id?: string | null
        }
        Update: {
          body?: string
          company_id?: string
          created_at?: string | null
          fleet_event_id?: string | null
          id?: string
          read_at?: string | null
          recipient_id?: string | null
          sender_id?: string | null
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_fleet_event_id_fkey"
            columns: ["fleet_event_id"]
            isOneToOne: false
            referencedRelation: "driver_visible_fleet_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_fleet_event_id_fkey"
            columns: ["fleet_event_id"]
            isOneToOne: false
            referencedRelation: "fleet_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_configurations: {
        Row: {
          additional_overtime_tiers: Json | null
          allowance_tiers: Json | null
          created_at: string | null
          hourly_rate: number
          id: string
          overtime_rate_multiplier: number | null
          overtime_rate_percentage: number | null
          overtime_threshold_hours: number | null
          overtime_threshold_unit: string | null
          unpaid_break_minutes: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          additional_overtime_tiers?: Json | null
          allowance_tiers?: Json | null
          created_at?: string | null
          hourly_rate?: number
          id?: string
          overtime_rate_multiplier?: number | null
          overtime_rate_percentage?: number | null
          overtime_threshold_hours?: number | null
          overtime_threshold_unit?: string | null
          unpaid_break_minutes?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          additional_overtime_tiers?: Json | null
          allowance_tiers?: Json | null
          created_at?: string | null
          hourly_rate?: number
          id?: string
          overtime_rate_multiplier?: number | null
          overtime_rate_percentage?: number | null
          overtime_threshold_hours?: number | null
          overtime_threshold_unit?: string | null
          unpaid_break_minutes?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: string | null
          agency_name: string | null
          company_id: string | null
          cpc_dqc_expiry: string | null
          cpc_dqc_number: string | null
          cpc_training_hours_done: number | null
          created_at: string | null
          date_of_birth: string | null
          deactivated_at: string | null
          deletion_requested_at: string | null
          driver_license_number: string | null
          driving_licence_expiry: string | null
          driving_licence_number: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          expo_push_token: string | null
          first_time_setup_completed_at: string | null
          full_address: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          is_contractor: boolean | null
          last_shift_onboarding_completed_at: string | null
          national_insurance_number: string | null
          payroll_number: string | null
          phone_number: string | null
          role: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_period_end: string | null
          subscription_status: string | null
          tacho_card_expiry: string | null
          tacho_card_number: string | null
          trial_ends_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_type?: string | null
          agency_name?: string | null
          company_id?: string | null
          cpc_dqc_expiry?: string | null
          cpc_dqc_number?: string | null
          cpc_training_hours_done?: number | null
          created_at?: string | null
          date_of_birth?: string | null
          deactivated_at?: string | null
          deletion_requested_at?: string | null
          driver_license_number?: string | null
          driving_licence_expiry?: string | null
          driving_licence_number?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          expo_push_token?: string | null
          first_time_setup_completed_at?: string | null
          full_address?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          is_contractor?: boolean | null
          last_shift_onboarding_completed_at?: string | null
          national_insurance_number?: string | null
          payroll_number?: string | null
          phone_number?: string | null
          role?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_period_end?: string | null
          subscription_status?: string | null
          tacho_card_expiry?: string | null
          tacho_card_number?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_type?: string | null
          agency_name?: string | null
          company_id?: string | null
          cpc_dqc_expiry?: string | null
          cpc_dqc_number?: string | null
          cpc_training_hours_done?: number | null
          created_at?: string | null
          date_of_birth?: string | null
          deactivated_at?: string | null
          deletion_requested_at?: string | null
          driver_license_number?: string | null
          driving_licence_expiry?: string | null
          driving_licence_number?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          expo_push_token?: string | null
          first_time_setup_completed_at?: string | null
          full_address?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          is_contractor?: boolean | null
          last_shift_onboarding_completed_at?: string | null
          national_insurance_number?: string | null
          payroll_number?: string | null
          phone_number?: string | null
          role?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_period_end?: string | null
          subscription_status?: string | null
          tacho_card_expiry?: string | null
          tacho_card_number?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      public_atlas_feedback: {
        Row: {
          atlas_matched_intent: string | null
          consent_contact: boolean
          created_at: string
          email: string | null
          id: string
          message_content: string
          message_type: string
          name: string | null
          user_agent: string | null
        }
        Insert: {
          atlas_matched_intent?: string | null
          consent_contact?: boolean
          created_at?: string
          email?: string | null
          id?: string
          message_content: string
          message_type: string
          name?: string | null
          user_agent?: string | null
        }
        Update: {
          atlas_matched_intent?: string | null
          consent_contact?: boolean
          created_at?: string
          email?: string | null
          id?: string
          message_content?: string
          message_type?: string
          name?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      security_permission_audit_events: {
        Row: {
          actor_kind: string
          actor_user_id: string | null
          company_id: string | null
          created_at: string
          decision: string
          id: string
          metadata: Json
          operation: string | null
          permission_key: string | null
          reason: string
          request_id: string | null
          resource_id: string | null
          resource_type: string | null
          site_id: string | null
        }
        Insert: {
          actor_kind?: string
          actor_user_id?: string | null
          company_id?: string | null
          created_at?: string
          decision: string
          id?: string
          metadata?: Json
          operation?: string | null
          permission_key?: string | null
          reason?: string
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          site_id?: string | null
        }
        Update: {
          actor_kind?: string
          actor_user_id?: string | null
          company_id?: string | null
          created_at?: string
          decision?: string
          id?: string
          metadata?: Json
          operation?: string | null
          permission_key?: string | null
          reason?: string
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_permission_audit_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "security_permission_audit_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_permission_audit_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_permission_audit_events_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "security_permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      security_permissions: {
        Row: {
          area: string
          created_at: string
          description: string
          key: string
          operation: string
          requires_audit: boolean
          resource: string
          risk_level: string
        }
        Insert: {
          area: string
          created_at?: string
          description?: string
          key: string
          operation: string
          requires_audit?: boolean
          resource: string
          risk_level: string
        }
        Update: {
          area?: string
          created_at?: string
          description?: string
          key?: string
          operation?: string
          requires_audit?: boolean
          resource?: string
          risk_level?: string
        }
        Relationships: []
      }
      security_role_assignments: {
        Row: {
          company_id: string
          created_at: string
          created_by_user_id: string | null
          ends_at: string | null
          id: string
          role_key: string
          scope_level: string
          site_id: string | null
          source: string
          starts_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by_user_id?: string | null
          ends_at?: string | null
          id?: string
          role_key: string
          scope_level?: string
          site_id?: string | null
          source?: string
          starts_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by_user_id?: string | null
          ends_at?: string | null
          id?: string
          role_key?: string
          scope_level?: string
          site_id?: string | null
          source?: string
          starts_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_role_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_role_assignments_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "security_role_assignments_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_role_assignments_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "security_roles"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "security_role_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "security_role_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      security_role_permissions: {
        Row: {
          created_at: string
          effect: string
          permission_key: string
          role_key: string
          scope_level: string
        }
        Insert: {
          created_at?: string
          effect?: string
          permission_key: string
          role_key: string
          scope_level: string
        }
        Update: {
          created_at?: string
          effect?: string
          permission_key?: string
          role_key?: string
          scope_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "security_permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "security_role_permissions_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "security_roles"
            referencedColumns: ["key"]
          },
        ]
      }
      security_roles: {
        Row: {
          created_at: string
          description: string
          is_assignable: boolean
          is_system: boolean
          key: string
          name: string
          parent_role_key: string | null
          scope_level: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          is_assignable?: boolean
          is_system?: boolean
          key: string
          name: string
          parent_role_key?: string | null
          scope_level: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          is_assignable?: boolean
          is_system?: boolean
          key?: string
          name?: string
          parent_role_key?: string | null
          scope_level?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_roles_parent_role_key_fkey"
            columns: ["parent_role_key"]
            isOneToOne: false
            referencedRelation: "security_roles"
            referencedColumns: ["key"]
          },
        ]
      }
      shift_audit_events: {
        Row: {
          actor_id: string | null
          company_id: string
          created_at: string
          event_payload: Json
          event_type: string
          id: string
          new_status: Database["public"]["Enums"]["shift_status"] | null
          previous_status: Database["public"]["Enums"]["shift_status"] | null
          shift_id: string | null
        }
        Insert: {
          actor_id?: string | null
          company_id: string
          created_at?: string
          event_payload?: Json
          event_type: string
          id?: string
          new_status?: Database["public"]["Enums"]["shift_status"] | null
          previous_status?: Database["public"]["Enums"]["shift_status"] | null
          shift_id?: string | null
        }
        Update: {
          actor_id?: string | null
          company_id?: string
          created_at?: string
          event_payload?: Json
          event_type?: string
          id?: string
          new_status?: Database["public"]["Enums"]["shift_status"] | null
          previous_status?: Database["public"]["Enums"]["shift_status"] | null
          shift_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "shift_audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_audit_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_jobs: {
        Row: {
          client_id: string | null
          collection_point: string | null
          created_at: string | null
          delivery_point: string | null
          drop_count: number | null
          empty_miles: number | null
          id: string
          job_reference: string | null
          loaded_miles: number | null
          logged_at: string | null
          night_out: boolean | null
          notes: string | null
          session_id: string | null
          user_id: string | null
          waiting_minutes: number | null
        }
        Insert: {
          client_id?: string | null
          collection_point?: string | null
          created_at?: string | null
          delivery_point?: string | null
          drop_count?: number | null
          empty_miles?: number | null
          id?: string
          job_reference?: string | null
          loaded_miles?: number | null
          logged_at?: string | null
          night_out?: boolean | null
          notes?: string | null
          session_id?: string | null
          user_id?: string | null
          waiting_minutes?: number | null
        }
        Update: {
          client_id?: string | null
          collection_point?: string | null
          created_at?: string | null
          delivery_point?: string | null
          drop_count?: number | null
          empty_miles?: number | null
          id?: string
          job_reference?: string | null
          loaded_miles?: number | null
          logged_at?: string | null
          night_out?: boolean | null
          notes?: string | null
          session_id?: string | null
          user_id?: string | null
          waiting_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_jobs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "work_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "shift_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          company_id: string
          created_at: string
          date: string
          driver_id: string
          end_time: string
          id: string
          notes: string | null
          published_at: string | null
          published_by: string | null
          start_time: string
          status: Database["public"]["Enums"]["shift_status"]
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id: string
          created_at?: string
          date: string
          driver_id: string
          end_time: string
          id?: string
          notes?: string | null
          published_at?: string | null
          published_by?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["shift_status"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          company_id?: string
          created_at?: string
          date?: string
          driver_id?: string
          end_time?: string
          id?: string
          notes?: string | null
          published_at?: string | null
          published_by?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["shift_status"]
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "shifts_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "shifts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "shifts_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          target_audience: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          target_audience?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          target_audience?: string
        }
        Relationships: []
      }
      tacho_activities: {
        Row: {
          activity_type: string
          company_id: string | null
          created_at: string | null
          driver_id: string | null
          duration_minutes: number | null
          end_time: string
          id: string
          start_time: string
        }
        Insert: {
          activity_type: string
          company_id?: string | null
          created_at?: string | null
          driver_id?: string | null
          duration_minutes?: number | null
          end_time: string
          id?: string
          start_time: string
        }
        Update: {
          activity_type?: string
          company_id?: string | null
          created_at?: string | null
          driver_id?: string | null
          duration_minutes?: number | null
          end_time?: string
          id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "tacho_activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tacho_activities_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tacho_activities_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tacho_infringements: {
        Row: {
          company_id: string | null
          created_at: string | null
          description: string | null
          driver_explanation: string | null
          driver_id: string | null
          id: string
          infringement_type: string
          is_signed: boolean | null
          occurrence_date: string
          signed_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          driver_explanation?: string | null
          driver_id?: string | null
          id?: string
          infringement_type: string
          is_signed?: boolean | null
          occurrence_date: string
          signed_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          driver_explanation?: string | null
          driver_id?: string | null
          id?: string
          infringement_type?: string
          is_signed?: boolean | null
          occurrence_date?: string
          signed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tacho_infringements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tacho_infringements_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tacho_infringements_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tachograph_activities: {
        Row: {
          activity_type: string
          distance_km: number | null
          driver_id: string | null
          end_time: string
          file_id: string | null
          id: string
          is_manual_entry: boolean | null
          slot: number | null
          start_time: string
        }
        Insert: {
          activity_type: string
          distance_km?: number | null
          driver_id?: string | null
          end_time: string
          file_id?: string | null
          id?: string
          is_manual_entry?: boolean | null
          slot?: number | null
          start_time: string
        }
        Update: {
          activity_type?: string
          distance_km?: number | null
          driver_id?: string | null
          end_time?: string
          file_id?: string | null
          id?: string
          is_manual_entry?: boolean | null
          slot?: number | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "tachograph_activities_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tachograph_activities_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_activities_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "tachograph_files"
            referencedColumns: ["id"]
          },
        ]
      }
      tachograph_activity_segments: {
        Row: {
          activity_type: string
          company_id: string | null
          confidence: string | null
          created_at: string
          distance_km: number | null
          driver_id: string | null
          duration_mins: number
          end_time: string
          id: string
          import_id: string
          label: string | null
          parser_run_id: string | null
          source: string
          start_time: string
          vehicle_id: string | null
        }
        Insert: {
          activity_type: string
          company_id?: string | null
          confidence?: string | null
          created_at?: string
          distance_km?: number | null
          driver_id?: string | null
          duration_mins: number
          end_time: string
          id?: string
          import_id: string
          label?: string | null
          parser_run_id?: string | null
          source: string
          start_time: string
          vehicle_id?: string | null
        }
        Update: {
          activity_type?: string
          company_id?: string | null
          confidence?: string | null
          created_at?: string
          distance_km?: number | null
          driver_id?: string | null
          duration_mins?: number
          end_time?: string
          id?: string
          import_id?: string
          label?: string | null
          parser_run_id?: string | null
          source?: string
          start_time?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tachograph_activity_segments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_activity_segments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tachograph_activity_segments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_activity_segments_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "tachograph_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_activity_segments_parser_run_id_fkey"
            columns: ["parser_run_id"]
            isOneToOne: false
            referencedRelation: "tachograph_processing_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_activity_segments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      tachograph_day_summaries: {
        Row: {
          app_driving_mins: number | null
          company_id: string | null
          created_at: string
          driver_id: string | null
          driving_mins: number
          findings_count: number
          id: string
          import_id: string
          parser_run_id: string | null
          poa_mins: number
          rest_mins: number
          summary_date: string
          vehicle_id: string | null
          vu_event_count: number | null
          work_mins: number
        }
        Insert: {
          app_driving_mins?: number | null
          company_id?: string | null
          created_at?: string
          driver_id?: string | null
          driving_mins?: number
          findings_count?: number
          id?: string
          import_id: string
          parser_run_id?: string | null
          poa_mins?: number
          rest_mins?: number
          summary_date: string
          vehicle_id?: string | null
          vu_event_count?: number | null
          work_mins?: number
        }
        Update: {
          app_driving_mins?: number | null
          company_id?: string | null
          created_at?: string
          driver_id?: string | null
          driving_mins?: number
          findings_count?: number
          id?: string
          import_id?: string
          parser_run_id?: string | null
          poa_mins?: number
          rest_mins?: number
          summary_date?: string
          vehicle_id?: string | null
          vu_event_count?: number | null
          work_mins?: number
        }
        Relationships: [
          {
            foreignKeyName: "tachograph_day_summaries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_day_summaries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tachograph_day_summaries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_day_summaries_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "tachograph_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_day_summaries_parser_run_id_fkey"
            columns: ["parser_run_id"]
            isOneToOne: false
            referencedRelation: "tachograph_processing_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_day_summaries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      tachograph_files: {
        Row: {
          company_id: string | null
          driver_id: string | null
          external_card_number: string | null
          file_path: string
          file_type: string | null
          filename: string
          id: string
          metadata: Json | null
          processed_at: string | null
          source_type: string | null
          status: string | null
          uploaded_at: string | null
          vehicle_id: string | null
        }
        Insert: {
          company_id?: string | null
          driver_id?: string | null
          external_card_number?: string | null
          file_path: string
          file_type?: string | null
          filename: string
          id?: string
          metadata?: Json | null
          processed_at?: string | null
          source_type?: string | null
          status?: string | null
          uploaded_at?: string | null
          vehicle_id?: string | null
        }
        Update: {
          company_id?: string | null
          driver_id?: string | null
          external_card_number?: string | null
          file_path?: string
          file_type?: string | null
          filename?: string
          id?: string
          metadata?: Json | null
          processed_at?: string | null
          source_type?: string | null
          status?: string | null
          uploaded_at?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tachograph_files_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_files_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tachograph_files_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_files_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      tachograph_finding_review_events: {
        Row: {
          actor_user_id: string | null
          company_id: string
          created_at: string
          event_type: string
          finding_id: string
          id: string
          metadata: Json
          new_status: string
          note: string | null
          previous_status: string | null
          review_id: string
        }
        Insert: {
          actor_user_id?: string | null
          company_id: string
          created_at?: string
          event_type: string
          finding_id: string
          id?: string
          metadata?: Json
          new_status: string
          note?: string | null
          previous_status?: string | null
          review_id: string
        }
        Update: {
          actor_user_id?: string | null
          company_id?: string
          created_at?: string
          event_type?: string
          finding_id?: string
          id?: string
          metadata?: Json
          new_status?: string
          note?: string | null
          previous_status?: string | null
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tachograph_finding_review_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tachograph_finding_review_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_finding_review_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_finding_review_events_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "tachograph_findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_finding_review_events_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "tachograph_finding_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      tachograph_finding_reviews: {
        Row: {
          closed_at: string | null
          closed_by_user_id: string | null
          company_id: string
          corrective_action_ref_id: string | null
          corrective_action_type: string | null
          created_at: string
          driver_acknowledged_at: string | null
          driver_acknowledged_by_user_id: string | null
          driver_id: string | null
          finding_id: string
          id: string
          import_id: string
          manager_note: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by_user_id?: string | null
          company_id: string
          corrective_action_ref_id?: string | null
          corrective_action_type?: string | null
          created_at?: string
          driver_acknowledged_at?: string | null
          driver_acknowledged_by_user_id?: string | null
          driver_id?: string | null
          finding_id: string
          id?: string
          import_id: string
          manager_note?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by_user_id?: string | null
          company_id?: string
          corrective_action_ref_id?: string | null
          corrective_action_type?: string | null
          created_at?: string
          driver_acknowledged_at?: string | null
          driver_acknowledged_by_user_id?: string | null
          driver_id?: string | null
          finding_id?: string
          id?: string
          import_id?: string
          manager_note?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tachograph_finding_reviews_closed_by_user_id_fkey"
            columns: ["closed_by_user_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tachograph_finding_reviews_closed_by_user_id_fkey"
            columns: ["closed_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_finding_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_finding_reviews_driver_acknowledged_by_user_id_fkey"
            columns: ["driver_acknowledged_by_user_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tachograph_finding_reviews_driver_acknowledged_by_user_id_fkey"
            columns: ["driver_acknowledged_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_finding_reviews_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tachograph_finding_reviews_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_finding_reviews_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: true
            referencedRelation: "tachograph_findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_finding_reviews_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "tachograph_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_finding_reviews_reviewed_by_user_id_fkey"
            columns: ["reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tachograph_finding_reviews_reviewed_by_user_id_fkey"
            columns: ["reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tachograph_findings: {
        Row: {
          company_id: string | null
          created_at: string
          driver_id: string | null
          evidence_refs: Json
          id: string
          import_id: string
          legal_basis: string | null
          metadata: Json
          occurred_at: string
          parser_run_id: string | null
          period_end: string
          period_start: string
          rule_code: string
          severity: string
          source: string
          status: string
          summary: string
          title: string
          vehicle_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          driver_id?: string | null
          evidence_refs?: Json
          id?: string
          import_id: string
          legal_basis?: string | null
          metadata?: Json
          occurred_at: string
          parser_run_id?: string | null
          period_end: string
          period_start: string
          rule_code: string
          severity: string
          source: string
          status: string
          summary: string
          title: string
          vehicle_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          driver_id?: string | null
          evidence_refs?: Json
          id?: string
          import_id?: string
          legal_basis?: string | null
          metadata?: Json
          occurred_at?: string
          parser_run_id?: string | null
          period_end?: string
          period_start?: string
          rule_code?: string
          severity?: string
          source?: string
          status?: string
          summary?: string
          title?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tachograph_findings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_findings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tachograph_findings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_findings_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "tachograph_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_findings_parser_run_id_fkey"
            columns: ["parser_run_id"]
            isOneToOne: false
            referencedRelation: "tachograph_processing_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_findings_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      tachograph_parser_errors: {
        Row: {
          company_id: string | null
          created_at: string
          details_json: Json
          error_code: string
          id: string
          import_id: string
          message: string
          parser_run_id: string
          severity: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          details_json?: Json
          error_code?: string
          id?: string
          import_id: string
          message: string
          parser_run_id: string
          severity?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          details_json?: Json
          error_code?: string
          id?: string
          import_id?: string
          message?: string
          parser_run_id?: string
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "tachograph_parser_errors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_parser_errors_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "tachograph_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_parser_errors_parser_run_id_fkey"
            columns: ["parser_run_id"]
            isOneToOne: false
            referencedRelation: "tachograph_processing_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      tachograph_parser_outputs: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          import_id: string
          output_type: string
          parser_run_id: string
          payload: Json
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          import_id: string
          output_type: string
          parser_run_id: string
          payload?: Json
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          import_id?: string
          output_type?: string
          parser_run_id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "tachograph_parser_outputs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_parser_outputs_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "tachograph_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_parser_outputs_parser_run_id_fkey"
            columns: ["parser_run_id"]
            isOneToOne: false
            referencedRelation: "tachograph_processing_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      tachograph_processing_runs: {
        Row: {
          company_id: string | null
          completed_at: string | null
          duration_ms: number | null
          error_summary: string | null
          errors: Json
          id: string
          import_id: string
          is_current: boolean
          metadata: Json
          parser_config_json: Json
          parser_name: string
          parser_version: string
          processed_at: string
          run_sequence: number | null
          source: string
          started_at: string | null
          status: string
          supersedes_parser_run_id: string | null
          triggered_by: string | null
          warnings: Json
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
          duration_ms?: number | null
          error_summary?: string | null
          errors?: Json
          id?: string
          import_id: string
          is_current?: boolean
          metadata?: Json
          parser_config_json?: Json
          parser_name: string
          parser_version: string
          processed_at?: string
          run_sequence?: number | null
          source?: string
          started_at?: string | null
          status?: string
          supersedes_parser_run_id?: string | null
          triggered_by?: string | null
          warnings?: Json
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
          duration_ms?: number | null
          error_summary?: string | null
          errors?: Json
          id?: string
          import_id?: string
          is_current?: boolean
          metadata?: Json
          parser_config_json?: Json
          parser_name?: string
          parser_version?: string
          processed_at?: string
          run_sequence?: number | null
          source?: string
          started_at?: string | null
          status?: string
          supersedes_parser_run_id?: string | null
          triggered_by?: string | null
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "tachograph_processing_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_processing_runs_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "tachograph_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_processing_runs_supersedes_parser_run_id_fkey"
            columns: ["supersedes_parser_run_id"]
            isOneToOne: false
            referencedRelation: "tachograph_processing_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      tachograph_reconciliation_items: {
        Row: {
          app_driving_mins: number
          app_label: string
          company_id: string | null
          created_at: string
          driver_id: string | null
          id: string
          import_id: string
          metadata: Json
          parser_run_id: string | null
          recon_date: string
          status: string
          summary: string
          tacho_driving_mins: number
          tacho_label: string
          vehicle_id: string | null
        }
        Insert: {
          app_driving_mins?: number
          app_label: string
          company_id?: string | null
          created_at?: string
          driver_id?: string | null
          id?: string
          import_id: string
          metadata?: Json
          parser_run_id?: string | null
          recon_date: string
          status: string
          summary: string
          tacho_driving_mins?: number
          tacho_label: string
          vehicle_id?: string | null
        }
        Update: {
          app_driving_mins?: number
          app_label?: string
          company_id?: string | null
          created_at?: string
          driver_id?: string | null
          id?: string
          import_id?: string
          metadata?: Json
          parser_run_id?: string | null
          recon_date?: string
          status?: string
          summary?: string
          tacho_driving_mins?: number
          tacho_label?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tachograph_reconciliation_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_reconciliation_items_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tachograph_reconciliation_items_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_reconciliation_items_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "tachograph_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_reconciliation_items_parser_run_id_fkey"
            columns: ["parser_run_id"]
            isOneToOne: false
            referencedRelation: "tachograph_processing_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_reconciliation_items_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      tachograph_speed_logs: {
        Row: {
          file_id: string | null
          id: number
          speed_kmh: number
          timestamp: string
        }
        Insert: {
          file_id?: string | null
          id?: number
          speed_kmh: number
          timestamp: string
        }
        Update: {
          file_id?: string | null
          id?: number
          speed_kmh?: number
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "tachograph_speed_logs_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "tachograph_files"
            referencedColumns: ["id"]
          },
        ]
      }
      tachograph_technical_events: {
        Row: {
          company_id: string | null
          created_at: string
          driver_id: string | null
          evidence_refs: Json
          id: string
          import_id: string
          metadata: Json
          occurred_at: string
          parser_run_id: string | null
          period_end: string
          period_start: string
          rule_code: string
          severity: string
          source: string
          status: string
          summary: string
          title: string
          vehicle_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          driver_id?: string | null
          evidence_refs?: Json
          id?: string
          import_id: string
          metadata?: Json
          occurred_at: string
          parser_run_id?: string | null
          period_end: string
          period_start: string
          rule_code: string
          severity: string
          source?: string
          status: string
          summary: string
          title: string
          vehicle_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          driver_id?: string | null
          evidence_refs?: Json
          id?: string
          import_id?: string
          metadata?: Json
          occurred_at?: string
          parser_run_id?: string | null
          period_end?: string
          period_start?: string
          rule_code?: string
          severity?: string
          source?: string
          status?: string
          summary?: string
          title?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tachograph_technical_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_technical_events_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tachograph_technical_events_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_technical_events_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "tachograph_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_technical_events_parser_run_id_fkey"
            columns: ["parser_run_id"]
            isOneToOne: false
            referencedRelation: "tachograph_processing_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_technical_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      tachograph_vehicle_motion_discrepancies: {
        Row: {
          company_id: string | null
          created_at: string
          discrepancy_date: string
          driver_id: string | null
          duration_mins: number
          end_time: string
          evidence_refs: Json
          id: string
          import_id: string
          linked_driver_name: string | null
          metadata: Json
          parser_run_id: string | null
          severity: string
          start_time: string
          status: string
          summary: string
          vehicle_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          discrepancy_date: string
          driver_id?: string | null
          duration_mins?: number
          end_time: string
          evidence_refs?: Json
          id?: string
          import_id: string
          linked_driver_name?: string | null
          metadata?: Json
          parser_run_id?: string | null
          severity: string
          start_time: string
          status: string
          summary: string
          vehicle_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          discrepancy_date?: string
          driver_id?: string | null
          duration_mins?: number
          end_time?: string
          evidence_refs?: Json
          id?: string
          import_id?: string
          linked_driver_name?: string | null
          metadata?: Json
          parser_run_id?: string | null
          severity?: string
          start_time?: string
          status?: string
          summary?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tachograph_vehicle_motion_discrepancies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_vehicle_motion_discrepancies_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "tachograph_vehicle_motion_discrepancies_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_vehicle_motion_discrepancies_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "tachograph_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_vehicle_motion_discrepancies_parser_run_id_fkey"
            columns: ["parser_run_id"]
            isOneToOne: false
            referencedRelation: "tachograph_processing_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tachograph_vehicle_motion_discrepancies_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_event_sources: {
        Row: {
          company_id: string
          created_at: string
          id: string
          import_file_id: string | null
          normalised_activity_id: string | null
          parser_output_id: string | null
          parser_run_id: string | null
          source_external_id: string | null
          source_id: string | null
          source_reference_json: Json
          source_type: string
          timeline_event_id: string
          timeline_generation_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          import_file_id?: string | null
          normalised_activity_id?: string | null
          parser_output_id?: string | null
          parser_run_id?: string | null
          source_external_id?: string | null
          source_id?: string | null
          source_reference_json?: Json
          source_type: string
          timeline_event_id: string
          timeline_generation_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          import_file_id?: string | null
          normalised_activity_id?: string | null
          parser_output_id?: string | null
          parser_run_id?: string | null
          source_external_id?: string | null
          source_id?: string | null
          source_reference_json?: Json
          source_type?: string
          timeline_event_id?: string
          timeline_generation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_event_sources_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_event_sources_import_file_id_fkey"
            columns: ["import_file_id"]
            isOneToOne: false
            referencedRelation: "tachograph_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_event_sources_parser_output_id_fkey"
            columns: ["parser_output_id"]
            isOneToOne: false
            referencedRelation: "tachograph_parser_outputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_event_sources_parser_run_id_fkey"
            columns: ["parser_run_id"]
            isOneToOne: false
            referencedRelation: "tachograph_processing_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_event_sources_timeline_event_id_fkey"
            columns: ["timeline_event_id"]
            isOneToOne: false
            referencedRelation: "timeline_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_event_sources_timeline_generation_id_fkey"
            columns: ["timeline_generation_id"]
            isOneToOne: false
            referencedRelation: "timeline_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_events: {
        Row: {
          company_id: string
          confidence_state: string
          created_at: string
          driver_id: string | null
          duration_seconds: number | null
          ended_at: string | null
          event_type: string
          id: string
          import_file_id: string | null
          is_current: boolean
          metadata: Json
          parser_run_id: string | null
          source_id: string | null
          source_summary: string
          source_table: string | null
          started_at: string
          status: string
          timeline_generation_id: string
          timezone: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          company_id: string
          confidence_state?: string
          created_at?: string
          driver_id?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          event_type: string
          id?: string
          import_file_id?: string | null
          is_current?: boolean
          metadata?: Json
          parser_run_id?: string | null
          source_id?: string | null
          source_summary?: string
          source_table?: string | null
          started_at: string
          status?: string
          timeline_generation_id: string
          timezone?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          company_id?: string
          confidence_state?: string
          created_at?: string
          driver_id?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          event_type?: string
          id?: string
          import_file_id?: string | null
          is_current?: boolean
          metadata?: Json
          parser_run_id?: string | null
          source_id?: string | null
          source_summary?: string
          source_table?: string | null
          started_at?: string
          status?: string
          timeline_generation_id?: string
          timezone?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timeline_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "timeline_events_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_import_file_id_fkey"
            columns: ["import_file_id"]
            isOneToOne: false
            referencedRelation: "tachograph_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_parser_run_id_fkey"
            columns: ["parser_run_id"]
            isOneToOne: false
            referencedRelation: "tachograph_processing_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_timeline_generation_id_fkey"
            columns: ["timeline_generation_id"]
            isOneToOne: false
            referencedRelation: "timeline_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_gaps: {
        Row: {
          company_id: string
          created_at: string
          driver_id: string | null
          duration_seconds: number
          ended_at: string
          gap_type: string
          id: string
          metadata: Json
          reason: string
          severity: string
          started_at: string
          status: string
          timeline_generation_id: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          driver_id?: string | null
          duration_seconds: number
          ended_at: string
          gap_type: string
          id?: string
          metadata?: Json
          reason: string
          severity?: string
          started_at: string
          status?: string
          timeline_generation_id: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          driver_id?: string | null
          duration_seconds?: number
          ended_at?: string
          gap_type?: string
          id?: string
          metadata?: Json
          reason?: string
          severity?: string
          started_at?: string
          status?: string
          timeline_generation_id?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timeline_gaps_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_gaps_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "timeline_gaps_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_gaps_timeline_generation_id_fkey"
            columns: ["timeline_generation_id"]
            isOneToOne: false
            referencedRelation: "timeline_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_gaps_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_generations: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string
          driver_id: string | null
          generated_by: string | null
          generated_by_kind: string
          generated_reason: string
          generation_version: string
          id: string
          is_current: boolean
          metadata: Json
          parser_run_id: string | null
          range_end: string
          range_start: string
          scope_id: string | null
          scope_type: string
          source_import_id: string | null
          started_at: string
          status: string
          superseded_at: string | null
          superseded_by_generation_id: string | null
          supersedes_generation_id: string | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string
          driver_id?: string | null
          generated_by?: string | null
          generated_by_kind?: string
          generated_reason?: string
          generation_version?: string
          id?: string
          is_current?: boolean
          metadata?: Json
          parser_run_id?: string | null
          range_end: string
          range_start: string
          scope_id?: string | null
          scope_type: string
          source_import_id?: string | null
          started_at?: string
          status?: string
          superseded_at?: string | null
          superseded_by_generation_id?: string | null
          supersedes_generation_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          driver_id?: string | null
          generated_by?: string | null
          generated_by_kind?: string
          generated_reason?: string
          generation_version?: string
          id?: string
          is_current?: boolean
          metadata?: Json
          parser_run_id?: string | null
          range_end?: string
          range_start?: string
          scope_id?: string | null
          scope_type?: string
          source_import_id?: string | null
          started_at?: string
          status?: string
          superseded_at?: string | null
          superseded_by_generation_id?: string | null
          supersedes_generation_id?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timeline_generations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_generations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "timeline_generations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_generations_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "timeline_generations_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_generations_parser_run_id_fkey"
            columns: ["parser_run_id"]
            isOneToOne: false
            referencedRelation: "tachograph_processing_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_generations_source_import_id_fkey"
            columns: ["source_import_id"]
            isOneToOne: false
            referencedRelation: "tachograph_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_generations_superseded_by_generation_id_fkey"
            columns: ["superseded_by_generation_id"]
            isOneToOne: false
            referencedRelation: "timeline_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_generations_supersedes_generation_id_fkey"
            columns: ["supersedes_generation_id"]
            isOneToOne: false
            referencedRelation: "timeline_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_generations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_records: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          company_id: string | null
          completed_at: string | null
          driver_id: string | null
          hours_credited: number | null
          id: string
          module_id: string | null
          notes: string | null
          status: string | null
          title: string
          training_type: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          company_id?: string | null
          completed_at?: string | null
          driver_id?: string | null
          hours_credited?: number | null
          id?: string
          module_id?: string | null
          notes?: string | null
          status?: string | null
          title: string
          training_type: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          company_id?: string | null
          completed_at?: string | null
          driver_id?: string | null
          hours_credited?: number | null
          id?: string
          module_id?: string | null
          notes?: string | null
          status?: string | null
          title?: string
          training_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_records_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "training_records_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_records_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "training_records_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_checks: {
        Row: {
          check_status: string | null
          closing_odometer: number | null
          company_id: string | null
          created_at: string | null
          defect_details: string | null
          defect_lifecycle_status: string | null
          driver_id: string | null
          id: string
          inspection_duration_seconds: number | null
          items: Json
          odometer_reading: number | null
          reg_number: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          session_id: string | null
          signature_url: string | null
          trailer_reg: string | null
          updated_at: string
          vehicle_make: string | null
          vehicle_type: string
        }
        Insert: {
          check_status?: string | null
          closing_odometer?: number | null
          company_id?: string | null
          created_at?: string | null
          defect_details?: string | null
          defect_lifecycle_status?: string | null
          driver_id?: string | null
          id?: string
          inspection_duration_seconds?: number | null
          items: Json
          odometer_reading?: number | null
          reg_number: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string | null
          signature_url?: string | null
          trailer_reg?: string | null
          updated_at?: string
          vehicle_make?: string | null
          vehicle_type: string
        }
        Update: {
          check_status?: string | null
          closing_odometer?: number | null
          company_id?: string | null
          created_at?: string | null
          defect_details?: string | null
          defect_lifecycle_status?: string | null
          driver_id?: string | null
          id?: string
          inspection_duration_seconds?: number | null
          items?: Json
          odometer_reading?: number | null
          reg_number?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string | null
          signature_url?: string | null
          trailer_reg?: string | null
          updated_at?: string
          vehicle_make?: string | null
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_checks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_checks_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "vehicle_checks_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_checks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "work_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_documents: {
        Row: {
          company_id: string | null
          document_type: string
          expiry_date: string | null
          id: string
          id_number: string | null
          storage_path: string
          uploaded_at: string | null
          uploaded_by: string | null
          vehicle_id: string | null
        }
        Insert: {
          company_id?: string | null
          document_type: string
          expiry_date?: string | null
          id?: string
          id_number?: string | null
          storage_path: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          vehicle_id?: string | null
        }
        Update: {
          company_id?: string | null
          document_type?: string
          expiry_date?: string | null
          id?: string
          id_number?: string | null
          storage_path?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_documents_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_unit_downloads: {
        Row: {
          calibration_due: string | null
          company_id: string | null
          created_at: string
          download_status: string
          downloaded_at: string
          id: string
          import_id: string
          parser_run_id: string | null
          period_end: string
          period_start: string
          reg_number: string | null
          vehicle_id: string | null
          vu_serial: string
        }
        Insert: {
          calibration_due?: string | null
          company_id?: string | null
          created_at?: string
          download_status: string
          downloaded_at: string
          id?: string
          import_id: string
          parser_run_id?: string | null
          period_end: string
          period_start: string
          reg_number?: string | null
          vehicle_id?: string | null
          vu_serial: string
        }
        Update: {
          calibration_due?: string | null
          company_id?: string | null
          created_at?: string
          download_status?: string
          downloaded_at?: string
          id?: string
          import_id?: string
          parser_run_id?: string | null
          period_end?: string
          period_start?: string
          reg_number?: string | null
          vehicle_id?: string | null
          vu_serial?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_unit_downloads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_unit_downloads_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "tachograph_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_unit_downloads_parser_run_id_fkey"
            columns: ["parser_run_id"]
            isOneToOne: false
            referencedRelation: "tachograph_processing_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_unit_downloads_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          company_id: string | null
          created_at: string | null
          current_odometer: number | null
          id: string
          insurance_expiry: string | null
          is_vor: boolean | null
          loler_due_date: string | null
          maintenance_called: boolean | null
          make: string
          model: string | null
          mot_due_date: string | null
          pmi_due_date: string | null
          pmi_interval_weeks: number | null
          reg_number: string
          status_notes: string | null
          tacho_calibration_due: string | null
          updated_at: string | null
          user_id: string | null
          vehicle_class: string | null
          vehicle_type: string
          vin_number: string | null
          year: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          current_odometer?: number | null
          id?: string
          insurance_expiry?: string | null
          is_vor?: boolean | null
          loler_due_date?: string | null
          maintenance_called?: boolean | null
          make: string
          model?: string | null
          mot_due_date?: string | null
          pmi_due_date?: string | null
          pmi_interval_weeks?: number | null
          reg_number: string
          status_notes?: string | null
          tacho_calibration_due?: string | null
          updated_at?: string | null
          user_id?: string | null
          vehicle_class?: string | null
          vehicle_type: string
          vin_number?: string | null
          year?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          current_odometer?: number | null
          id?: string
          insurance_expiry?: string | null
          is_vor?: boolean | null
          loler_due_date?: string | null
          maintenance_called?: boolean | null
          make?: string
          model?: string | null
          mot_due_date?: string | null
          pmi_due_date?: string | null
          pmi_interval_weeks?: number | null
          reg_number?: string
          status_notes?: string | null
          tacho_calibration_due?: string | null
          updated_at?: string | null
          user_id?: string | null
          vehicle_class?: string | null
          vehicle_type?: string
          vin_number?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      work_session_segments: {
        Row: {
          activity_type: string
          client_created_at: string
          client_updated_at: string
          confidence: number
          created_at: string | null
          end_time: string | null
          id: string
          session_id: string
          source: string
          start_time: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activity_type: string
          client_created_at: string
          client_updated_at: string
          confidence?: number
          created_at?: string | null
          end_time?: string | null
          id: string
          session_id: string
          source?: string
          start_time: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activity_type?: string
          client_created_at?: string
          client_updated_at?: string
          confidence?: number
          created_at?: string | null
          end_time?: string | null
          id?: string
          session_id?: string
          source?: string
          start_time?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_session_segments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "work_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_session_segments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "work_session_segments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      work_sessions: {
        Row: {
          client_id: string | null
          compliance_score: number | null
          compliance_violations: string[] | null
          created_at: string | null
          current_break_start: string | null
          current_poa_start: string | null
          date: string
          drop_count: number | null
          empty_miles: number | null
          end_lat: number | null
          end_lng: number | null
          end_time: string | null
          id: string
          is_manual_entry: boolean | null
          job_reference: string | null
          loaded_miles: number | null
          notes: string | null
          other_data: Json | null
          start_lat: number | null
          start_lng: number | null
          start_time: string
          status: string
          timezone: string
          total_break_minutes: number | null
          total_poa_minutes: number | null
          total_work_minutes: number | null
          updated_at: string | null
          user_id: string
          waiting_minutes: number | null
        }
        Insert: {
          client_id?: string | null
          compliance_score?: number | null
          compliance_violations?: string[] | null
          created_at?: string | null
          current_break_start?: string | null
          current_poa_start?: string | null
          date: string
          drop_count?: number | null
          empty_miles?: number | null
          end_lat?: number | null
          end_lng?: number | null
          end_time?: string | null
          id?: string
          is_manual_entry?: boolean | null
          job_reference?: string | null
          loaded_miles?: number | null
          notes?: string | null
          other_data?: Json | null
          start_lat?: number | null
          start_lng?: number | null
          start_time: string
          status?: string
          timezone?: string
          total_break_minutes?: number | null
          total_poa_minutes?: number | null
          total_work_minutes?: number | null
          updated_at?: string | null
          user_id: string
          waiting_minutes?: number | null
        }
        Update: {
          client_id?: string | null
          compliance_score?: number | null
          compliance_violations?: string[] | null
          created_at?: string | null
          current_break_start?: string | null
          current_poa_start?: string | null
          date?: string
          drop_count?: number | null
          empty_miles?: number | null
          end_lat?: number | null
          end_lng?: number | null
          end_time?: string | null
          id?: string
          is_manual_entry?: boolean | null
          job_reference?: string | null
          loaded_miles?: number | null
          notes?: string | null
          other_data?: Json | null
          start_lat?: number | null
          start_lng?: number | null
          start_time?: string
          status?: string
          timezone?: string
          total_break_minutes?: number | null
          total_poa_minutes?: number | null
          total_work_minutes?: number | null
          updated_at?: string | null
          user_id?: string
          waiting_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "work_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "work_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      driver_visible_fleet_events: {
        Row: {
          actor_id: string | null
          body: string | null
          company_id: string | null
          created_at: string | null
          event_type: string | null
          expires_at: string | null
          id: string | null
          payload: Json | null
          priority: string | null
          recipient_driver_id: string | null
          related_message_id: string | null
          related_shift_id: string | null
          requires_ack: boolean | null
          thread_id: string | null
          title: string | null
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          company_id?: string | null
          created_at?: string | null
          event_type?: string | null
          expires_at?: string | null
          id?: string | null
          payload?: Json | null
          priority?: string | null
          recipient_driver_id?: string | null
          related_message_id?: string | null
          related_shift_id?: string | null
          requires_ack?: boolean | null
          thread_id?: string | null
          title?: string | null
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          company_id?: string | null
          created_at?: string | null
          event_type?: string | null
          expires_at?: string | null
          id?: string | null
          payload?: Json | null
          priority?: string | null
          recipient_driver_id?: string | null
          related_message_id?: string | null
          related_shift_id?: string | null
          requires_ack?: boolean | null
          thread_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fleet_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_events_recipient_driver_id_fkey"
            columns: ["recipient_driver_id"]
            isOneToOne: false
            referencedRelation: "organisation_memberships_v"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "fleet_events_recipient_driver_id_fkey"
            columns: ["recipient_driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_events_related_message_id_fkey"
            columns: ["related_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_events_related_shift_id_fkey"
            columns: ["related_shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_events_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_memberships_v: {
        Row: {
          company_id: string | null
          legacy_role: string | null
          source: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          legacy_role?: string | null
          source?: never
          status?: never
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          legacy_role?: string | null
          source?: never
          status?: never
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_driver_invite:
        | { Args: { invite_id: string; user_id: string }; Returns: undefined }
        | { Args: { p_invite_code: string }; Returns: Json }
      acknowledge_tachograph_finding_review: {
        Args: { p_note?: string; p_review_id: string }
        Returns: Json
      }
      actor_can_access_driver: {
        Args: { p_driver_id: string; p_operation: string }
        Returns: boolean
      }
      actor_can_access_vehicle: {
        Args: { p_operation: string; p_vehicle_id: string }
        Returns: boolean
      }
      actor_can_export: {
        Args: {
          p_company_id: string
          p_permission_key: string
          p_resource_id: string
          p_resource_type: string
        }
        Returns: boolean
      }
      actor_has_permission: {
        Args: {
          p_company_id: string
          p_permission_key: string
          p_site_id?: string
        }
        Returns: boolean
      }
      archive_tacho_candidate_import: {
        Args: {
          p_company_id: string
          p_delete_storage_file?: boolean
          p_import_id: string
          p_reason?: string
        }
        Returns: Json
      }
      assign_tachograph_training: {
        Args: {
          p_driver_id: string
          p_finding_ids?: string[]
          p_module_id: string
          p_notes?: string
          p_title: string
        }
        Returns: Json
      }
      can_access_defect_photo_object: {
        Args: { p_name: string }
        Returns: boolean
      }
      can_access_driver_document_object: {
        Args: { p_name: string }
        Returns: boolean
      }
      can_access_vehicle_document_object: {
        Args: { p_name: string }
        Returns: boolean
      }
      cancel_job_assignment_with_event: {
        Args: {
          p_assignment_id: string
          p_expected_updated_at?: string
          p_requires_ack?: boolean
        }
        Returns: Json
      }
      cancel_shift_with_event: {
        Args: { p_requires_ack?: boolean; p_shift_id: string }
        Returns: Json
      }
      check_is_manager: { Args: never; Returns: boolean }
      configure_tacho_processing_runtime: {
        Args: { p_patch?: Json }
        Returns: {
          process_tacho_url: string
          trigger_enabled: boolean
          trigger_token_configured: boolean
          updated_at: string
        }[]
      }
      confirm_tacho_candidate_import_storage_deleted: {
        Args: {
          p_company_id: string
          p_import_id: string
          p_storage_path: string
        }
        Returns: Json
      }
      create_job_assignment_with_event: {
        Args: {
          p_address_text: string
          p_contact_name?: string
          p_contact_phone?: string
          p_customer_name?: string
          p_expected_duration_minutes?: number
          p_instructions?: string
          p_job_type: string
          p_manager_notes?: string
          p_planned_arrival_at?: string
          p_planned_departure_at?: string
          p_reference: string
          p_requires_ack?: boolean
          p_sequence?: number
          p_shift_id: string
          p_title: string
        }
        Returns: Json
      }
      current_actor_company_id: { Args: never; Returns: string }
      current_actor_legacy_role: { Args: never; Returns: string }
      daily_timeline_summary_json: {
        Args: {
          p_summary: Database["public"]["Tables"]["daily_timeline_summaries"]["Row"]
        }
        Returns: Json
      }
      generate_invoice_number: { Args: never; Returns: string }
      get_auth_user_company: { Args: never; Returns: string }
      get_auth_user_company_id: { Args: never; Returns: string }
      get_auth_user_role: { Args: never; Returns: string }
      get_company_tacho_signals: {
        Args: { p_company_id: string; p_days?: number }
        Returns: {
          compliance_signal: Json
          driver_id: string
          risk_signal: Json
        }[]
      }
      get_current_user_company_id: { Args: never; Returns: string }
      get_driver_tacho_analysis_bundle: {
        Args: { p_company_id: string; p_driver_id: string; p_range?: string }
        Returns: Json
      }
      get_driver_timeline_bundle: {
        Args: { p_company_id: string; p_driver_id: string; p_range?: string }
        Returns: Json
      }
      get_import_timeline_bundle: {
        Args: { p_company_id: string; p_import_id: string }
        Returns: Json
      }
      get_my_company_id: { Args: never; Returns: string }
      get_my_role: { Args: never; Returns: string }
      get_tacho_import_bundle: {
        Args: { p_company_id: string; p_import_id: string }
        Returns: Json
      }
      get_tacho_processing_runtime: {
        Args: never
        Returns: {
          process_tacho_url: string
          trigger_enabled: boolean
          trigger_token_configured: boolean
          updated_at: string
        }[]
      }
      get_user_company_id: { Args: never; Returns: string }
      get_vehicle_timeline_bundle: {
        Args: { p_company_id: string; p_range?: string; p_vehicle_id: string }
        Returns: Json
      }
      get_vehicle_unit_analysis_bundle: {
        Args: { p_company_id: string; p_range?: string; p_vehicle_id: string }
        Returns: Json
      }
      is_manager: { Args: never; Returns: boolean }
      is_manager_for_company_path: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      is_uuid: { Args: { p_value: string }; Returns: boolean }
      lookup_pending_driver_invite: {
        Args: { p_invite_code: string }
        Returns: {
          company_name: string
          email: string
          expires_at: string
          full_name: string
          invite_code: string
          status: string
          tacho_card_expiry: string
          tacho_card_holder_name: string
          tacho_card_issuing_authority: string
          tacho_card_number: string
        }[]
      }
      map_tachograph_status_to_contract: {
        Args: { p_status: string }
        Returns: string
      }
      mark_tacho_candidate_card_review: {
        Args: {
          p_company_id: string
          p_decision: string
          p_import_id: string
          p_note?: string
        }
        Returns: Json
      }
      pair_tacho_card_import_to_driver: {
        Args: {
          p_card_number?: string
          p_company_id: string
          p_driver_id: string
          p_import_id: string
        }
        Returns: Json
      }
      patch_tachograph_import_metadata: {
        Args: { p_import_id: string; p_metadata_patch: Json }
        Returns: Json
      }
      prepare_tacho_import_reprocess: {
        Args: { p_company_id: string; p_import_id: string; p_reason?: string }
        Returns: Json
      }
      publish_shift_with_event: {
        Args: { p_requires_ack?: boolean; p_shift_id: string }
        Returns: Json
      }
      purge_company_driver_card_reads: {
        Args: {
          p_company_id: string
          p_dry_run?: boolean
          p_include_linked?: boolean
          p_reason?: string
        }
        Returns: Json
      }
      record_security_event: {
        Args: {
          p_actor_kind?: string
          p_company_id?: string
          p_decision?: string
          p_metadata?: Json
          p_operation?: string
          p_permission_key?: string
          p_reason?: string
          p_request_id?: string
          p_resource_id?: string
          p_resource_type?: string
          p_site_id?: string
        }
        Returns: string
      }
      resolve_tacho_range_start: { Args: { p_range: string }; Returns: string }
      review_expense: {
        Args: {
          p_decision: string
          p_expected_updated_at?: string
          p_expense_id: string
          p_note?: string
        }
        Returns: {
          created_at: string
          decision: string
          expense_id: string
          id: string
          note: string | null
          reviewed_at: string
          reviewed_by: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "expense_reviews"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rotate_company_auth_code: {
        Args: never
        Returns: {
          auth_code: string
          auth_code_expires_at: string
        }[]
      }
      save_tachograph_finding_review: {
        Args: {
          p_company_id: string
          p_corrective_action_ref_id?: string
          p_corrective_action_type?: string
          p_finding_id: string
          p_manager_note?: string
          p_status: string
        }
        Returns: Json
      }
      send_manager_message_with_event: {
        Args: { p_body: string; p_recipient_driver_id?: string }
        Returns: Json
      }
      timeline_event_json: {
        Args: {
          p_event: Database["public"]["Tables"]["timeline_events"]["Row"]
        }
        Returns: Json
      }
      timeline_gap_json: {
        Args: { p_gap: Database["public"]["Tables"]["timeline_gaps"]["Row"] }
        Returns: Json
      }
      timeline_generation_json: {
        Args: {
          p_generation: Database["public"]["Tables"]["timeline_generations"]["Row"]
        }
        Returns: Json
      }
      update_company_name: {
        Args: { p_name: string }
        Returns: {
          auth_code: string | null
          auth_code_expires_at: string | null
          created_at: string | null
          created_by: string | null
          default_fuel_cost_per_litre: number | null
          id: string
          max_drivers: number | null
          name: string
          pmi_alert_days: number | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_period_end: string | null
          subscription_status: string | null
          subscription_tier: string | null
        }
        SetofOptions: {
          from: "*"
          to: "companies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_driver_profile: {
        Args: {
          p_driver_id: string
          p_expected_updated_at?: string
          p_patch: Json
        }
        Returns: {
          account_type: string | null
          agency_name: string | null
          company_id: string | null
          cpc_dqc_expiry: string | null
          cpc_dqc_number: string | null
          cpc_training_hours_done: number | null
          created_at: string | null
          date_of_birth: string | null
          deactivated_at: string | null
          deletion_requested_at: string | null
          driver_license_number: string | null
          driving_licence_expiry: string | null
          driving_licence_number: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          expo_push_token: string | null
          first_time_setup_completed_at: string | null
          full_address: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          is_contractor: boolean | null
          last_shift_onboarding_completed_at: string | null
          national_insurance_number: string | null
          payroll_number: string | null
          phone_number: string | null
          role: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_period_end: string | null
          subscription_status: string | null
          tacho_card_expiry: string | null
          tacho_card_number: string | null
          trial_ends_at: string | null
          updated_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_incident_follow_up: {
        Args: {
          p_expected_updated_at: string
          p_incident_id: string
          p_manager_notes: string
          p_to_status: string
        }
        Returns: Json
      }
      update_job_assignment_with_event: {
        Args: {
          p_address_text: string
          p_assignment_id: string
          p_contact_name?: string
          p_contact_phone?: string
          p_customer_name?: string
          p_expected_duration_minutes?: number
          p_expected_updated_at?: string
          p_instructions?: string
          p_job_type: string
          p_planned_arrival_at?: string
          p_planned_departure_at?: string
          p_reference: string
          p_requires_ack?: boolean
          p_sequence?: number
          p_title: string
        }
        Returns: Json
      }
      update_shift_with_event: {
        Args: {
          p_date: string
          p_end_time: string
          p_notes?: string
          p_requires_ack?: boolean
          p_shift_id: string
          p_start_time: string
          p_vehicle_id?: string
        }
        Returns: Json
      }
      update_vehicle_check_lifecycle: {
        Args: {
          p_check_id: string
          p_closing_odometer?: number
          p_expected_updated_at?: string
          p_maintenance_log_id?: string
          p_resolution_notes?: string
          p_to_status: string
        }
        Returns: Json
      }
      upsert_company_operator_licence_profile: {
        Args: {
          p_authorised_trailer_count?: number
          p_authorised_vehicle_count?: number
          p_operator_licence_expiry?: string
          p_operator_licence_number?: string
          p_operator_licence_region?: string
          p_operator_licence_status?: string
          p_operator_licence_type?: string
          p_transport_manager_cpc_expiry?: string
          p_transport_manager_name?: string
        }
        Returns: {
          authorised_trailer_count: number
          authorised_vehicle_count: number
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          operator_licence_expiry: string | null
          operator_licence_number: string | null
          operator_licence_region: string | null
          operator_licence_status: string | null
          operator_licence_type: string | null
          transport_manager_cpc_expiry: string | null
          transport_manager_name: string | null
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "company_operator_licence_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      validate_auth_code: { Args: { code: string }; Returns: string }
    }
    Enums: {
      job_assignment_status: "draft" | "published" | "updated" | "cancelled"
      shift_status: "draft" | "published" | "updated" | "cancelled"
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
      job_assignment_status: ["draft", "published", "updated", "cancelled"],
      shift_status: ["draft", "published", "updated", "cancelled"],
    },
  },
} as const
