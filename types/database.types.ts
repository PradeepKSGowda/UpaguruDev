/**
 * UPA-GURU Database TypeScript Definitions
 * 
 * Auto-compatible with Supabase PostgREST client and PostgreSQL 15 schema.
 * Represents all core tables, views, enums, and functions defined in schema-v1.sql
 * and auth-schema-v1.sql.
 * 
 * Complies with:
 * - TypeScript strict mode (Zero `any`)
 * - ADR-002 (Database), ADR-003 (Authentication & RBAC), ADR-013 (Security)
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRoleEnum =
  | "guest"
  | "candidate"
  | "moderator"
  | "support"
  | "admin"
  | "super_admin";

export type ExamCategoryEnum =
  | "civil_services"
  | "banking"
  | "railways"
  | "defense"
  | "state_psc"
  | "teaching"
  | "police"
  | "other";

export type NotificationStatusEnum =
  | "draft"
  | "under_review"
  | "published"
  | "archived";

export type DraftStatusEnum =
  | "pending_review"
  | "approved"
  | "rejected";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          role: AppRoleEnum;
          email_verified: boolean;
          auth_provider: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: AppRoleEnum;
          email_verified?: boolean;
          auth_provider?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          role?: AppRoleEnum;
          email_verified?: boolean;
          auth_provider?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      exams: {
        Row: {
          id: string;
          slug: string;
          title: string;
          conducting_body: string;
          category: ExamCategoryEnum;
          state_or_central: string;
          official_website: string;
          logo_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          conducting_body: string;
          category: ExamCategoryEnum;
          state_or_central: string;
          official_website: string;
          logo_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          conducting_body?: string;
          category?: ExamCategoryEnum;
          state_or_central?: string;
          official_website?: string;
          logo_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          exam_id: string;
          slug: string;
          title: string;
          notification_number: string | null;
          total_vacancies: number;
          application_start_date: string;
          application_end_date: string;
          exam_date: string | null;
          qualification_required: string[];
          age_limit_min: number | null;
          age_limit_max: number | null;
          official_pdf_url: string | null;
          apply_online_url: string | null;
          syllabus_summary: Json;
          selection_process: string[];
          status: NotificationStatusEnum;
          verified_by: string | null;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          exam_id: string;
          slug: string;
          title: string;
          notification_number?: string | null;
          total_vacancies?: number;
          application_start_date: string;
          application_end_date: string;
          exam_date?: string | null;
          qualification_required?: string[];
          age_limit_min?: number | null;
          age_limit_max?: number | null;
          official_pdf_url?: string | null;
          apply_online_url?: string | null;
          syllabus_summary?: Json;
          selection_process?: string[];
          status?: NotificationStatusEnum;
          verified_by?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          exam_id?: string;
          slug?: string;
          title?: string;
          notification_number?: string | null;
          total_vacancies?: number;
          application_start_date?: string;
          application_end_date?: string;
          exam_date?: string | null;
          qualification_required?: string[];
          age_limit_min?: number | null;
          age_limit_max?: number | null;
          official_pdf_url?: string | null;
          apply_online_url?: string | null;
          syllabus_summary?: Json;
          selection_process?: string[];
          status?: NotificationStatusEnum;
          verified_by?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_exam_id_fkey";
            columns: ["exam_id"];
            isOneToOne: false;
            referencedRelation: "exams";
            referencedColumns: ["id"];
          }
        ];
      };
      draft_notifications: {
        Row: {
          id: string;
          source_url: string;
          raw_extracted_text: string | null;
          parsed_json: Json;
          extraction_confidence_score: number;
          status: DraftStatusEnum;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source_url: string;
          raw_extracted_text?: string | null;
          parsed_json?: Json;
          extraction_confidence_score?: number;
          status?: DraftStatusEnum;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          source_url?: string;
          raw_extracted_text?: string | null;
          parsed_json?: Json;
          extraction_confidence_score?: number;
          status?: DraftStatusEnum;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      draft_verification_sessions: {
        Row: {
          id: string;
          draft_id: string;
          admin_id: string;
          verification_action: string;
          rejection_reason: string | null;
          fields_modified: Json;
          duration_seconds: number;
          verified_at: string;
        };
        Insert: {
          id?: string;
          draft_id: string;
          admin_id: string;
          verification_action?: string;
          rejection_reason?: string | null;
          fields_modified?: Json;
          duration_seconds?: number;
          verified_at?: string;
        };
        Update: {
          id?: string;
          draft_id?: string;
          admin_id?: string;
          verification_action?: string;
          rejection_reason?: string | null;
          fields_modified?: Json;
          duration_seconds?: number;
          verified_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "draft_verification_sessions_draft_id_fkey";
            columns: ["draft_id"];
            isOneToOne: false;
            referencedRelation: "draft_notifications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "draft_verification_sessions_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      user_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          preferred_channels: string[];
          telegram_chat_id: string | null;
          whatsapp_phone_number: string | null;
          fcm_device_token: string | null;
          subscribed_exam_ids: string[];
          subscribed_categories: ExamCategoryEnum[];
          subscribed_states: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          preferred_channels?: string[];
          telegram_chat_id?: string | null;
          whatsapp_phone_number?: string | null;
          fcm_device_token?: string | null;
          subscribed_exam_ids?: string[];
          subscribed_categories?: ExamCategoryEnum[];
          subscribed_states?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          preferred_channels?: string[];
          telegram_chat_id?: string | null;
          whatsapp_phone_number?: string | null;
          fcm_device_token?: string | null;
          subscribed_exam_ids?: string[];
          subscribed_categories?: ExamCategoryEnum[];
          subscribed_states?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          admin_id: string;
          action: string;
          target_entity: string;
          target_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_id: string;
          action: string;
          target_entity: string;
          target_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          admin_id?: string;
          action?: string;
          target_entity?: string;
          target_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      isr_revalidation_queue: {
        Row: {
          id: string;
          route_path: string;
          slug: string;
          reason: string;
          status: string;
          attempts: number;
          last_error: string | null;
          created_at: string;
          revalidated_at: string;
        };
        Insert: {
          id?: string;
          route_path: string;
          slug: string;
          reason: string;
          status?: string;
          attempts?: number;
          last_error?: string | null;
          created_at?: string;
          revalidated_at?: string;
        };
        Update: {
          id?: string;
          route_path?: string;
          slug?: string;
          reason?: string;
          status?: string;
          attempts?: number;
          last_error?: string | null;
          created_at?: string;
          revalidated_at?: string;
        };
        Relationships: [];
      };
      crawl_runs: {
        Row: {
          id: string;
          portal_code: string;
          started_at: string;
          finished_at: string | null;
          status: string;
          pdfs_found: number;
          pdfs_new: number;
          pdfs_failed: number;
          error_message: string | null;
          logs: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          portal_code: string;
          started_at?: string;
          finished_at?: string | null;
          status?: string;
          pdfs_found?: number;
          pdfs_new?: number;
          pdfs_failed?: number;
          error_message?: string | null;
          logs?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          portal_code?: string;
          started_at?: string;
          finished_at?: string | null;
          status?: string;
          pdfs_found?: number;
          pdfs_new?: number;
          pdfs_failed?: number;
          error_message?: string | null;
          logs?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      crawler_heartbeat_logs: {
        Row: {
          id: string;
          crawler_name: string;
          status: string;
          active_tasks_count: number;
          last_heartbeat_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          crawler_name: string;
          status?: string;
          active_tasks_count?: number;
          last_heartbeat_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          crawler_name?: string;
          status?: string;
          active_tasks_count?: number;
          last_heartbeat_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      roles: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          is_system_role: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string | null;
          is_system_role?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          description?: string | null;
          is_system_role?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      permissions: {
        Row: {
          id: string;
          code: string;
          module: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          module: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          module?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      role_permissions: {
        Row: {
          role_id: string;
          permission_id: string;
          created_at: string;
        };
        Insert: {
          role_id: string;
          permission_id: string;
          created_at?: string;
        };
        Update: {
          role_id?: string;
          permission_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          user_id: string;
          role_id: string;
          assigned_by: string | null;
          assigned_at: string;
        };
        Insert: {
          user_id: string;
          role_id: string;
          assigned_by?: string | null;
          assigned_at?: string;
        };
        Update: {
          user_id?: string;
          role_id?: string;
          assigned_by?: string | null;
          assigned_at?: string;
        };
        Relationships: [];
      };
      admin_profiles: {
        Row: {
          id: string;
          department: string | null;
          employee_id: string | null;
          two_factor_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          department?: string | null;
          employee_id?: string | null;
          two_factor_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          department?: string | null;
          employee_id?: string | null;
          two_factor_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bookmarks: {
        Row: {
          id: string;
          user_id: string;
          entity_type: string;
          entity_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          entity_type: string;
          entity_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          entity_type?: string;
          entity_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      exam_notes: {
        Row: {
          id: string;
          user_id: string;
          exam_id: string | null;
          notification_id: string | null;
          title: string;
          content: string;
          tags: string[];
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          exam_id?: string | null;
          notification_id?: string | null;
          title: string;
          content: string;
          tags?: string[];
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          exam_id?: string | null;
          notification_id?: string | null;
          title?: string;
          content?: string;
          tags?: string[];
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_exam_tracking: {
        Row: {
          id: string;
          user_id: string;
          notification_id: string;
          application_submitted: boolean;
          application_number: string | null;
          fee_paid: boolean;
          fee_amount: number | null;
          hall_ticket_downloaded: boolean;
          exam_attended: boolean;
          result_status: string;
          custom_notes: string | null;
          personal_reminders: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          notification_id: string;
          application_submitted?: boolean;
          application_number?: string | null;
          fee_paid?: boolean;
          fee_amount?: number | null;
          hall_ticket_downloaded?: boolean;
          exam_attended?: boolean;
          result_status?: string;
          custom_notes?: string | null;
          personal_reminders?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          notification_id?: string;
          application_submitted?: boolean;
          application_number?: string | null;
          fee_paid?: boolean;
          fee_amount?: number | null;
          hall_ticket_downloaded?: boolean;
          exam_attended?: boolean;
          result_status?: string;
          custom_notes?: string | null;
          personal_reminders?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      verification_requests: {
        Row: {
          id: string;
          user_id: string;
          target_type: string;
          target_value: string;
          token_hash: string;
          attempts: number;
          expires_at: string;
          verified_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          target_type: string;
          target_value: string;
          token_hash: string;
          attempts?: number;
          expires_at: string;
          verified_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          target_type?: string;
          target_value?: string;
          token_hash?: string;
          attempts?: number;
          expires_at?: string;
          verified_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      candidate_eligibility_preferences: {
        Row: {
          id: string;
          user_id: string;
          qualifications: string[];
          include_all_india_exams: boolean;
          include_state_exams: boolean;
          preferred_categories: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          qualifications?: string[];
          include_all_india_exams?: boolean;
          include_state_exams?: boolean;
          preferred_categories?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          qualifications?: string[];
          include_all_india_exams?: boolean;
          include_state_exams?: boolean;
          preferred_categories?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_eligibility_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      eligibility_matches: {
        Row: {
          id: string;
          user_id: string;
          notification_id: string;
          overall_score: number;
          is_eligible: boolean;
          dimension_details: Json;
          matched_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          notification_id: string;
          overall_score: number;
          is_eligible?: boolean;
          dimension_details?: Json;
          matched_at?: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          notification_id?: string;
          overall_score?: number;
          is_eligible?: boolean;
          dimension_details?: Json;
          matched_at?: string;
          expires_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "eligibility_matches_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "eligibility_matches_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "notifications";
            referencedColumns: ["id"];
          }
        ];
      };
      user_profiles: {
        Row: {
          id: string;
          first_name: string | null;
          last_name: string | null;
          alternate_email: string | null;
          is_alternate_email_verified: boolean;
          phone: string | null;
          is_phone_verified: boolean;
          alternate_phone: string | null;
          gender: string | null;
          marital_status: string | null;
          date_of_birth: string | null;
          category: string | null;
          address_line: string | null;
          state: string | null;
          district: string | null;
          pincode: string | null;
          avatar_url: string | null;
          language_preference: string;
          profile_completion_percentage: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          first_name?: string | null;
          last_name?: string | null;
          alternate_email?: string | null;
          is_alternate_email_verified?: boolean;
          phone?: string | null;
          is_phone_verified?: boolean;
          alternate_phone?: string | null;
          gender?: string | null;
          marital_status?: string | null;
          date_of_birth?: string | null;
          category?: string | null;
          address_line?: string | null;
          state?: string | null;
          district?: string | null;
          pincode?: string | null;
          avatar_url?: string | null;
          language_preference?: string;
          profile_completion_percentage?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          first_name?: string | null;
          last_name?: string | null;
          alternate_email?: string | null;
          is_alternate_email_verified?: boolean;
          phone?: string | null;
          is_phone_verified?: boolean;
          alternate_phone?: string | null;
          gender?: string | null;
          marital_status?: string | null;
          date_of_birth?: string | null;
          category?: string | null;
          address_line?: string | null;
          state?: string | null;
          district?: string | null;
          pincode?: string | null;
          avatar_url?: string | null;
          language_preference?: string;
          profile_completion_percentage?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      organizations: {
        Row: {
          id: string;
          code: string;
          name: string;
          short_name: string;
          organization_type: "CENTRAL_COMMISSION" | "STATE_PSC" | "RECRUITMENT_BOARD" | "BANKING_INSTITUTE" | "PSU" | "OTHER";
          official_website: string | null;
          country: string | null;
          state: string | null;
          config_json: Json | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          short_name: string;
          organization_type: "CENTRAL_COMMISSION" | "STATE_PSC" | "RECRUITMENT_BOARD" | "BANKING_INSTITUTE" | "PSU" | "OTHER";
          official_website?: string | null;
          country?: string | null;
          state?: string | null;
          config_json?: Json | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          short_name?: string;
          organization_type?: "CENTRAL_COMMISSION" | "STATE_PSC" | "RECRUITMENT_BOARD" | "BANKING_INSTITUTE" | "PSU" | "OTHER";
          official_website?: string | null;
          country?: string | null;
          state?: string | null;
          config_json?: Json | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      exam_master: {
        Row: {
          id: string;
          organization_id: string;
          exam_code: string;
          name: string;
          normalized_name: string;
          short_name: string | null;
          description: string | null;
          category: string | null;
          aliases: Json | null;
          typical_stages: Json | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          exam_code: string;
          name: string;
          normalized_name: string;
          short_name?: string | null;
          description?: string | null;
          category?: string | null;
          aliases?: Json | null;
          typical_stages?: Json | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          exam_code?: string;
          name?: string;
          normalized_name?: string;
          short_name?: string | null;
          description?: string | null;
          category?: string | null;
          aliases?: Json | null;
          typical_stages?: Json | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exam_master_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          }
        ];
      };
      exam_cycle: {
        Row: {
          id: string;
          exam_master_id: string;
          cycle_year: number | null;
          cycle_code: string;
          cycle_label: string;
          primary_reference_no: string | null;
          status: string;
          current_stage: string | null;
          start_date: string | null;
          end_date: string | null;
          total_vacancies_current: number | null;
          latest_update_summary: string | null;
          latest_update_at: string | null;
          latest_document_id: string | null;
          verification_status: string;
          metadata_json: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          exam_master_id: string;
          cycle_year?: number | null;
          cycle_code: string;
          cycle_label: string;
          primary_reference_no?: string | null;
          status?: string;
          current_stage?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          total_vacancies_current?: number | null;
          latest_update_summary?: string | null;
          latest_update_at?: string | null;
          latest_document_id?: string | null;
          verification_status?: string;
          metadata_json?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          exam_master_id?: string;
          cycle_year?: number | null;
          cycle_code?: string;
          cycle_label?: string;
          primary_reference_no?: string | null;
          status?: string;
          current_stage?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          total_vacancies_current?: number | null;
          latest_update_summary?: string | null;
          latest_update_at?: string | null;
          latest_document_id?: string | null;
          verification_status?: string;
          metadata_json?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exam_cycle_exam_master_id_fkey";
            columns: ["exam_master_id"];
            isOneToOne: false;
            referencedRelation: "exam_master";
            referencedColumns: ["id"];
          }
        ];
      };
      recruitment: {
        Row: {
          id: string;
          exam_cycle_id: string;
          post_code: string | null;
          title: string;
          normalized_title: string;
          department_or_cadre: string | null;
          vacancies_current: number | null;
          pay_level: string | null;
          eligibility_json: Json | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          exam_cycle_id: string;
          post_code?: string | null;
          title: string;
          normalized_title: string;
          department_or_cadre?: string | null;
          vacancies_current?: number | null;
          pay_level?: string | null;
          eligibility_json?: Json | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          exam_cycle_id?: string;
          post_code?: string | null;
          title?: string;
          normalized_title?: string;
          department_or_cadre?: string | null;
          vacancies_current?: number | null;
          pay_level?: string | null;
          eligibility_json?: Json | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recruitment_exam_cycle_id_fkey";
            columns: ["exam_cycle_id"];
            isOneToOne: false;
            referencedRelation: "exam_cycle";
            referencedColumns: ["id"];
          }
        ];
      };
      exam_document: {
        Row: {
          id: string;
          organization_id: string;
          exam_master_id: string | null;
          exam_cycle_id: string | null;
          recruitment_id: string | null;
          document_type: string;
          document_subtype: string | null;
          title: string;
          normalized_title: string;
          source_url: string;
          canonical_url: string;
          source_page_url: string | null;
          file_url: string | null;
          mime_type: string | null;
          file_size_bytes: number | null;
          document_hash: string | null;
          content_hash: string | null;
          reference_type: string | null;
          reference_number: string | null;
          normalized_reference_number: string | null;
          publication_date: string | null;
          discovered_at: string;
          text_content: string | null;
          ocr_used: boolean;
          page_count: number | null;
          language: string | null;
          is_multi_exam: boolean;
          status: string;
          link_confidence: number | null;
          classification_confidence: number | null;
          verification_status: string;
          raw_metadata_json: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          exam_master_id?: string | null;
          exam_cycle_id?: string | null;
          recruitment_id?: string | null;
          document_type: string;
          document_subtype?: string | null;
          title: string;
          normalized_title: string;
          source_url: string;
          canonical_url: string;
          source_page_url?: string | null;
          file_url?: string | null;
          mime_type?: string | null;
          file_size_bytes?: number | null;
          document_hash?: string | null;
          content_hash?: string | null;
          reference_type?: string | null;
          reference_number?: string | null;
          normalized_reference_number?: string | null;
          publication_date?: string | null;
          discovered_at?: string;
          text_content?: string | null;
          ocr_used?: boolean;
          page_count?: number | null;
          language?: string | null;
          is_multi_exam?: boolean;
          status?: string;
          link_confidence?: number | null;
          classification_confidence?: number | null;
          verification_status?: string;
          raw_metadata_json?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          exam_master_id?: string | null;
          exam_cycle_id?: string | null;
          recruitment_id?: string | null;
          document_type?: string;
          document_subtype?: string | null;
          title?: string;
          normalized_title?: string;
          source_url?: string;
          canonical_url?: string;
          source_page_url?: string | null;
          file_url?: string | null;
          mime_type?: string | null;
          file_size_bytes?: number | null;
          document_hash?: string | null;
          content_hash?: string | null;
          reference_type?: string | null;
          reference_number?: string | null;
          normalized_reference_number?: string | null;
          publication_date?: string | null;
          discovered_at?: string;
          text_content?: string | null;
          ocr_used?: boolean;
          page_count?: number | null;
          language?: string | null;
          is_multi_exam?: boolean;
          status?: string;
          link_confidence?: number | null;
          classification_confidence?: number | null;
          verification_status?: string;
          raw_metadata_json?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exam_document_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          }
        ];
      };
      document_exam_cycle: {
        Row: {
          id: string;
          document_id: string;
          exam_master_id: string | null;
          exam_cycle_id: string;
          recruitment_id: string | null;
          relationship_role: string;
          confidence: number;
          link_reasons_json: Json;
          decision: string;
          verified: boolean;
          verified_by: string | null;
          verified_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          exam_master_id?: string | null;
          exam_cycle_id: string;
          recruitment_id?: string | null;
          relationship_role: string;
          confidence?: number;
          link_reasons_json?: Json;
          decision?: string;
          verified?: boolean;
          verified_by?: string | null;
          verified_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          exam_master_id?: string | null;
          exam_cycle_id?: string;
          recruitment_id?: string | null;
          relationship_role?: string;
          confidence?: number;
          link_reasons_json?: Json;
          decision?: string;
          verified?: boolean;
          verified_by?: string | null;
          verified_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      exam_event: {
        Row: {
          id: string;
          exam_cycle_id: string;
          recruitment_id: string | null;
          source_document_id: string;
          event_type: string;
          stage: string | null;
          event_name: string;
          start_datetime: string | null;
          end_datetime: string | null;
          is_date_tbd: boolean;
          date_precision: string;
          date_text_original: string;
          status: string;
          confidence: number;
          verification_status: string;
          is_current: boolean;
          version_number: number;
          supersedes_event_id: string | null;
          change_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          exam_cycle_id: string;
          recruitment_id?: string | null;
          source_document_id: string;
          event_type: string;
          stage?: string | null;
          event_name: string;
          start_datetime?: string | null;
          end_datetime?: string | null;
          is_date_tbd?: boolean;
          date_precision?: string;
          date_text_original: string;
          status?: string;
          confidence?: number;
          verification_status?: string;
          is_current?: boolean;
          version_number?: number;
          supersedes_event_id?: string | null;
          change_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          exam_cycle_id?: string;
          recruitment_id?: string | null;
          source_document_id?: string;
          event_type?: string;
          stage?: string | null;
          event_name?: string;
          start_datetime?: string | null;
          end_datetime?: string | null;
          is_date_tbd?: boolean;
          date_precision?: string;
          date_text_original?: string;
          status?: string;
          confidence?: number;
          verification_status?: string;
          is_current?: boolean;
          version_number?: number;
          supersedes_event_id?: string | null;
          change_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      exam_document_relationship: {
        Row: {
          id: string;
          source_document_id: string;
          target_document_id: string;
          relationship_type: string;
          confidence: number;
          reason: string;
          signals_json: Json;
          automated: boolean;
          verification_status: string;
          verified_by: string | null;
          verified_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_document_id: string;
          target_document_id: string;
          relationship_type: string;
          confidence?: number;
          reason: string;
          signals_json?: Json;
          automated?: boolean;
          verification_status?: string;
          verified_by?: string | null;
          verified_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          source_document_id?: string;
          target_document_id?: string;
          relationship_type?: string;
          confidence?: number;
          reason?: string;
          signals_json?: Json;
          automated?: boolean;
          verification_status?: string;
          verified_by?: string | null;
          verified_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      document_evidence: {
        Row: {
          id: string;
          document_id: string;
          exam_cycle_id: string | null;
          exam_event_id: string | null;
          field_name: string;
          field_value_json: Json;
          page_number: number | null;
          section: string | null;
          source_text: string;
          extraction_method: string;
          confidence: number;
          verified: boolean;
          verified_by: string | null;
          verified_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          exam_cycle_id?: string | null;
          exam_event_id?: string | null;
          field_name: string;
          field_value_json: Json;
          page_number?: number | null;
          section?: string | null;
          source_text: string;
          extraction_method: string;
          confidence?: number;
          verified?: boolean;
          verified_by?: string | null;
          verified_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          exam_cycle_id?: string | null;
          exam_event_id?: string | null;
          field_name?: string;
          field_value_json?: Json;
          page_number?: number | null;
          section?: string | null;
          source_text?: string;
          extraction_method?: string;
          confidence?: number;
          verified?: boolean;
          verified_by?: string | null;
          verified_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      cycle_field_version: {
        Row: {
          id: string;
          exam_cycle_id: string;
          recruitment_id: string | null;
          field_name: string;
          old_value_json: Json | null;
          new_value_json: Json;
          change_summary: string | null;
          source_document_id: string;
          evidence_id: string | null;
          effective_date: string | null;
          is_current: boolean;
          supersedes_version_id: string | null;
          verification_status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          exam_cycle_id: string;
          recruitment_id?: string | null;
          field_name: string;
          old_value_json?: Json | null;
          new_value_json: Json;
          change_summary?: string | null;
          source_document_id: string;
          evidence_id?: string | null;
          effective_date?: string | null;
          is_current?: boolean;
          supersedes_version_id?: string | null;
          verification_status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          exam_cycle_id?: string;
          recruitment_id?: string | null;
          field_name?: string;
          old_value_json?: Json | null;
          new_value_json?: Json;
          change_summary?: string | null;
          source_document_id?: string;
          evidence_id?: string | null;
          effective_date?: string | null;
          is_current?: boolean;
          supersedes_version_id?: string | null;
          verification_status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      review_queue_item: {
        Row: {
          id: string;
          item_type: string;
          priority: "HIGH" | "MEDIUM" | "LOW";
          organization_id: string | null;
          document_id: string | null;
          proposed_exam_master_id: string | null;
          proposed_exam_cycle_id: string | null;
          candidate_matches_json: Json | null;
          extracted_payload_json: Json | null;
          confidence: number | null;
          reasons_json: Json;
          status: "PENDING" | "APPROVED" | "REJECTED" | "MODIFIED" | "ESCALATED";
          resolution_action: string | null;
          resolution_notes: string | null;
          resolved_by: string | null;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          item_type: string;
          priority?: "HIGH" | "MEDIUM" | "LOW";
          organization_id?: string | null;
          document_id?: string | null;
          proposed_exam_master_id?: string | null;
          proposed_exam_cycle_id?: string | null;
          candidate_matches_json?: Json | null;
          extracted_payload_json?: Json | null;
          confidence?: number | null;
          reasons_json?: Json;
          status?: "PENDING" | "APPROVED" | "REJECTED" | "MODIFIED" | "ESCALATED";
          resolution_action?: string | null;
          resolution_notes?: string | null;
          resolved_by?: string | null;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          item_type?: string;
          priority?: "HIGH" | "MEDIUM" | "LOW";
          organization_id?: string | null;
          document_id?: string | null;
          proposed_exam_master_id?: string | null;
          proposed_exam_cycle_id?: string | null;
          candidate_matches_json?: Json | null;
          extracted_payload_json?: Json | null;
          confidence?: number | null;
          reasons_json?: Json;
          status?: "PENDING" | "APPROVED" | "REJECTED" | "MODIFIED" | "ESCALATED";
          resolution_action?: string | null;
          resolution_notes?: string | null;
          resolved_by?: string | null;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      crawler_run: {
        Row: {
          id: string;
          organization_id: string;
          adapter_name: string;
          started_at: string;
          completed_at: string | null;
          status: "RUNNING" | "COMPLETED" | "PARTIAL_SUCCESS" | "FAILED";
          documents_discovered: number;
          documents_downloaded: number;
          documents_new: number;
          documents_duplicate: number;
          documents_linked: number;
          documents_sent_for_review: number;
          events_created: number;
          events_updated: number;
          errors_count: number;
          summary_json: Json | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          adapter_name: string;
          started_at?: string;
          completed_at?: string | null;
          status?: "RUNNING" | "COMPLETED" | "PARTIAL_SUCCESS" | "FAILED";
          documents_discovered?: number;
          documents_downloaded?: number;
          documents_new?: number;
          documents_duplicate?: number;
          documents_linked?: number;
          documents_sent_for_review?: number;
          events_created?: number;
          events_updated?: number;
          errors_count?: number;
          summary_json?: Json | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          adapter_name?: string;
          started_at?: string;
          completed_at?: string | null;
          status?: "RUNNING" | "COMPLETED" | "PARTIAL_SUCCESS" | "FAILED";
          documents_discovered?: number;
          documents_downloaded?: number;
          documents_new?: number;
          documents_duplicate?: number;
          documents_linked?: number;
          documents_sent_for_review?: number;
          events_created?: number;
          events_updated?: number;
          errors_count?: number;
          summary_json?: Json | null;
        };
        Relationships: [];
      };
      crawler_error: {
        Row: {
          id: string;
          crawler_run_id: string;
          organization_id: string;
          url: string | null;
          document_id: string | null;
          stage: "DISCOVERY" | "DOWNLOAD" | "EXTRACTION" | "CLASSIFICATION" | "LINKING" | "PERSISTENCE";
          error_type: string;
          message: string;
          stack_trace: string | null;
          retry_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          crawler_run_id: string;
          organization_id: string;
          url?: string | null;
          document_id?: string | null;
          stage: "DISCOVERY" | "DOWNLOAD" | "EXTRACTION" | "CLASSIFICATION" | "LINKING" | "PERSISTENCE";
          error_type: string;
          message: string;
          stack_trace?: string | null;
          retry_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          crawler_run_id?: string;
          organization_id?: string;
          url?: string | null;
          document_id?: string | null;
          stage?: "DISCOVERY" | "DOWNLOAD" | "EXTRACTION" | "CLASSIFICATION" | "LINKING" | "PERSISTENCE";
          error_type?: string;
          message?: string;
          stack_trace?: string | null;
          retry_count?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      cycle_domain_event: {
        Row: {
          id: string;
          exam_cycle_id: string;
          source_document_id: string | null;
          exam_event_id: string | null;
          domain_event_type: string;
          title: string;
          summary: string;
          payload_json: Json;
          dedupe_key: string;
          published: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          exam_cycle_id: string;
          source_document_id?: string | null;
          exam_event_id?: string | null;
          domain_event_type: string;
          title: string;
          summary: string;
          payload_json: Json;
          dedupe_key: string;
          published?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          exam_cycle_id?: string;
          source_document_id?: string | null;
          exam_event_id?: string | null;
          domain_event_type?: string;
          title?: string;
          summary?: string;
          payload_json?: Json;
          dedupe_key?: string;
          published?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      custom_access_token_hook: {
        Args: { event: Json };
        Returns: Json;
      };
      assign_user_role: {
        Args: {
          target_user_id: string;
          new_role: AppRoleEnum;
          admin_note?: string;
        };
        Returns: undefined;
      };
      match_notification_subscribers: {
        Args: {
          p_exam_id?: string | null;
          p_category?: string | null;
          p_state?: string | null;
        };
        Returns: {
          user_id: string;
          preferred_channels: string[];
          fcm_device_token: string | null;
          telegram_chat_id: string | null;
          whatsapp_phone_number: string | null;
          email: string | null;
        }[];
      };
    };
    Enums: {
      app_role_enum: AppRoleEnum;
      exam_category_enum: ExamCategoryEnum;
      notification_status_enum: NotificationStatusEnum;
      draft_status_enum: DraftStatusEnum;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
