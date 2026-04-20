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
          require_vehicle_checklist: boolean;
          default_fuel_cost_per_litre: number | null; // ADDED — run: ALTER TABLE companies ADD COLUMN IF NOT EXISTS default_fuel_cost_per_litre numeric(6,3);
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
          require_vehicle_checklist?: boolean;
          default_fuel_cost_per_litre?: number | null;
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
          require_vehicle_checklist?: boolean;
          default_fuel_cost_per_litre?: number | null;
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
          payroll_number: string | null;
          phone_number: string | null;
          date_of_birth: string | null;
          national_insurance_number: string | null;
          full_address: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          driving_licence_number: string | null;
          driving_licence_expiry: string | null;
          cpc_dqc_number: string | null;
          cpc_dqc_expiry: string | null;
          cpc_training_hours_done: number;
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
          payroll_number?: string | null;
          phone_number?: string | null;
          date_of_birth?: string | null;
          national_insurance_number?: string | null;
          full_address?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          driving_licence_number?: string | null;
          driving_licence_expiry?: string | null;
          cpc_dqc_number?: string | null;
          cpc_dqc_expiry?: string | null;
          cpc_training_hours_done?: number;
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
          payroll_number?: string | null;
          phone_number?: string | null;
          date_of_birth?: string | null;
          national_insurance_number?: string | null;
          full_address?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          driving_licence_number?: string | null;
          driving_licence_expiry?: string | null;
          cpc_dqc_number?: string | null;
          cpc_dqc_expiry?: string | null;
          cpc_training_hours_done?: number;
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
      vehicle_checks: {
        Row: {
          id: string;
          driver_id: string;
          company_id: string | null;
          reg_number: string;
          vehicle_type: string;
          vehicle_make: string | null;
          check_status: 'pass' | 'defect';
          items: Json;
          defect_details: string | null;
          odometer_reading: number | null;
          created_at: string;
          defect_lifecycle_status: 'reported' | 'in_progress' | 'fixed' | null;
          resolution_notes: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
        };
        Insert: {
          id?: string;
          driver_id: string;
          company_id?: string | null;
          reg_number: string;
          vehicle_type: string;
          vehicle_make?: string | null;
          check_status?: 'pass' | 'defect';
          items: Json;
          defect_details?: string | null;
          odometer_reading?: number | null;
          created_at?: string;
          defect_lifecycle_status?: 'reported' | 'in_progress' | 'fixed' | null;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Update: {
          id?: string;
          driver_id?: string;
          company_id?: string | null;
          reg_number?: string;
          vehicle_type?: string;
          vehicle_make?: string | null;
          check_status?: 'pass' | 'defect';
          items?: Json;
          defect_details?: string | null;
          odometer_reading?: number | null;
          created_at?: string;
          defect_lifecycle_status?: 'reported' | 'in_progress' | 'fixed' | null;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_checks_driver_id_fkey";
            columns: ["driver_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vehicle_checks_company_id_fkey";
            columns: ["company_id"];
            referencedRelation: "companies";
            referencedColumns: ["id"];
          }
        ];
      };
      vehicles: {
        Row: {
          id: string;
          company_id: string;
          reg_number: string;
          make: string;
          model: string | null;
          year: number | null;
          vehicle_type: string;
          vin_number: string | null;
          is_vor: boolean;
          status_notes: string | null;
          current_odometer: number;
          mot_due_date: string | null;
          pmi_due_date: string | null;
          tacho_calibration_due: string | null;
          loler_due_date: string | null;
          insurance_expiry: string | null;
          pmi_interval_weeks: number;
          maintenance_called: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          reg_number: string;
          make: string;
          model?: string | null;
          year?: number | null;
          vehicle_type: string;
          vin_number?: string | null;
          is_vor?: boolean;
          status_notes?: string | null;
          current_odometer?: number;
          mot_due_date?: string | null;
          pmi_due_date?: string | null;
          tacho_calibration_due?: string | null;
          loler_due_date?: string | null;
          insurance_expiry?: string | null;
          pmi_interval_weeks?: number;
          maintenance_called?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          reg_number?: string;
          make?: string;
          model?: string | null;
          year?: number | null;
          vehicle_type?: string;
          vin_number?: string | null;
          is_vor?: boolean;
          status_notes?: string | null;
          current_odometer?: number;
          mot_due_date?: string | null;
          pmi_due_date?: string | null;
          tacho_calibration_due?: string | null;
          loler_due_date?: string | null;
          insurance_expiry?: string | null;
          pmi_interval_weeks?: number;
          maintenance_called?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicles_company_id_fkey";
            columns: ["company_id"];
            referencedRelation: "companies";
            referencedColumns: ["id"];
          }
        ];
      };
      maintenance_logs: {
        Row: {
          id: string;
          vehicle_id: string;
          company_id: string;
          event_type: string;
          service_provider: string;
          odometer_at_service: number;
          cost: number;
          description: string;
          document_url: string | null;
          completed_at: string;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          company_id: string;
          event_type: string;
          service_provider: string;
          odometer_at_service: number;
          cost?: number;
          description: string;
          document_url?: string | null;
          completed_at: string;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          company_id?: string;
          event_type?: string;
          service_provider?: string;
          odometer_at_service?: number;
          cost?: number;
          description?: string;
          document_url?: string | null;
          completed_at?: string;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_vehicle_id_fkey";
            columns: ["vehicle_id"];
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_logs_company_id_fkey";
            columns: ["company_id"];
            referencedRelation: "companies";
            referencedColumns: ["id"];
          }
        ];
      };
      training_records: {
        Row: {
          id: string;
          company_id: string;
          driver_id: string;
          training_type: string;
          module_id: string | null;
          title: string;
          hours_credited: number;
          status: 'assigned' | 'in_progress' | 'complete';
          assigned_by: string | null;
          assigned_at: string;
          completed_at: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          driver_id: string;
          training_type: string;
          module_id?: string | null;
          title: string;
          hours_credited?: number;
          status?: 'assigned' | 'in_progress' | 'complete';
          assigned_by?: string | null;
          assigned_at?: string;
          completed_at?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          company_id?: string;
          driver_id?: string;
          training_type?: string;
          module_id?: string | null;
          title?: string;
          hours_credited?: number;
          status?: 'assigned' | 'in_progress' | 'complete';
          assigned_by?: string | null;
          assigned_at?: string;
          completed_at?: string | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "training_records_company_id_fkey";
            columns: ["company_id"];
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_records_driver_id_fkey";
            columns: ["driver_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      driver_documents: {
        Row: {
          id: string;
          user_id: string;
          company_id: string;
          document_type: string;
          storage_path: string;
          uploaded_at: string;
          uploaded_by: string | null;
          id_number: string | null;
          expiry_date: string | null;
          verified_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          company_id: string;
          document_type: string;
          storage_path: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
          id_number?: string | null;
          expiry_date?: string | null;
          verified_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          company_id?: string;
          document_type?: string;
          storage_path?: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
          id_number?: string | null;
          expiry_date?: string | null;
          verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "driver_documents_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "driver_documents_company_id_fkey";
            columns: ["company_id"];
            referencedRelation: "companies";
            referencedColumns: ["id"];
          }
        ];
      };
      infringements: {
        Row: {
          id: string;
          company_id: string;
          driver_id: string;
          session_id: string | null;
          violation_type: string;
          regulation: 'REG_561' | 'WTD' | 'DOMESTIC' | 'OTHER';
          severity: 'minor' | 'serious' | 'very_serious';
          occurred_at: string;
          status: 'open' | 'debriefed' | 'closed';
          driver_statement: string | null;
          manager_notes: string | null;
          debriefed_at: string | null;
          debriefed_by: string | null;
          training_record_id: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          driver_id: string;
          session_id?: string | null;
          violation_type: string;
          regulation?: 'REG_561' | 'WTD' | 'DOMESTIC' | 'OTHER';
          severity?: 'minor' | 'serious' | 'very_serious';
          occurred_at: string;
          status?: 'open' | 'debriefed' | 'closed';
          driver_statement?: string | null;
          manager_notes?: string | null;
          debriefed_at?: string | null;
          debriefed_by?: string | null;
          training_record_id?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          company_id?: string;
          driver_id?: string;
          session_id?: string | null;
          violation_type?: string;
          regulation?: 'REG_561' | 'WTD' | 'DOMESTIC' | 'OTHER';
          severity?: 'minor' | 'serious' | 'very_serious';
          occurred_at?: string;
          status?: 'open' | 'debriefed' | 'closed';
          driver_statement?: string | null;
          manager_notes?: string | null;
          debriefed_at?: string | null;
          debriefed_by?: string | null;
          training_record_id?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
      defect_photos: {
        Row: {
          id: string;
          vehicle_check_id: string;
          storage_path: string;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          vehicle_check_id: string;
          storage_path: string;
          uploaded_at?: string;
        };
        Update: {
          id?: string;
          vehicle_check_id?: string;
          storage_path?: string;
          uploaded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "defect_photos_vehicle_check_id_fkey";
            columns: ["vehicle_check_id"];
            referencedRelation: "vehicle_checks";
            referencedColumns: ["id"];
          }
        ];
      };
      fuel_logs: {
        Row: {
          id: string;
          company_id: string | null;
          reg_number: string;
          vehicle_id: string | null;
          driver_id: string; // references auth.users(id) — same uuid as profiles.id
          vehicle_check_id: string | null;
          log_date: string;
          start_odometer: number | null;
          end_odometer: number | null;
          distance_covered: number | null; // GENERATED ALWAYS AS (end_odometer - start_odometer) STORED
          fuel_added_litres: number;
          fuel_type: 'diesel' | 'petrol' | 'hvo' | 'adblue' | 'electric_kwh' | 'other';
          fuel_cost_per_litre: number | null;
          total_fuel_cost: number | null;
          mpg: number | null;
          notes: string | null;
          source: 'driver_app' | 'manual_entry';
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id?: string | null;
          reg_number: string;
          vehicle_id?: string | null;
          driver_id: string;
          vehicle_check_id?: string | null;
          log_date?: string;
          start_odometer?: number | null;
          end_odometer?: number | null;
          // distance_covered is GENERATED — do not include in Insert
          fuel_added_litres?: number;
          fuel_type: string;
          fuel_cost_per_litre?: number | null;
          total_fuel_cost?: number | null;
          mpg?: number | null;
          notes?: string | null;
          source?: 'driver_app' | 'manual_entry';
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string | null;
          reg_number?: string;
          vehicle_id?: string | null;
          driver_id?: string;
          vehicle_check_id?: string | null;
          log_date?: string;
          start_odometer?: number | null;
          end_odometer?: number | null;
          fuel_added_litres?: number;
          fuel_type?: string;
          fuel_cost_per_litre?: number | null;
          total_fuel_cost?: number | null;
          mpg?: number | null;
          notes?: string | null;
          source?: 'driver_app' | 'manual_entry';
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fuel_logs_company_id_fkey";
            columns: ["company_id"];
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fuel_logs_vehicle_id_fkey";
            columns: ["vehicle_id"];
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          }
        ];
      };
      messages: {
        Row: {
          id: string;
          company_id: string;
          sender_id: string | null;
          recipient_id: string | null;
          body: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          sender_id?: string | null;
          recipient_id?: string | null;
          body: string;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          sender_id?: string | null;
          recipient_id?: string | null;
          body?: string;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_company_id_fkey";
            columns: ["company_id"];
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_recipient_id_fkey";
            columns: ["recipient_id"];
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
