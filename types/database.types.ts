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
