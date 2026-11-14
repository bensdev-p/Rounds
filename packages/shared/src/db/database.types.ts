export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      attempts: {
        Row: {
          answer: string;
          created_at: string;
          credit: number;
          elapsed_ms: number;
          grade: Database['public']['Enums']['grade'];
          grader: Database['public']['Enums']['grader'];
          grader_version: string | null;
          id: string;
          miss_tag: string | null;
          passed: boolean;
          question_id: string;
          reason: string;
          session_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          answer: string;
          created_at?: string;
          credit: number;
          elapsed_ms: number;
          grade: Database['public']['Enums']['grade'];
          grader?: Database['public']['Enums']['grader'];
          grader_version?: string | null;
          id?: string;
          miss_tag?: string | null;
          passed: boolean;
          question_id: string;
          reason: string;
          session_id: string;
          user_id?: string;
        };
        Update: {
          answer?: string;
          created_at?: string;
          credit?: number;
          elapsed_ms?: number;
          grade?: Database['public']['Enums']['grade'];
          grader?: Database['public']['Enums']['grader'];
          grader_version?: string | null;
          id?: string;
          miss_tag?: string | null;
          passed?: boolean;
          question_id?: string;
          reason?: string;
          session_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'attempts_question_id_fkey';
            columns: ['question_id'];
            isOneToOne: false;
            referencedRelation: 'questions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attempts_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'ladder_sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      illness_scripts: {
        Row: {
          content: NonNullable<Json>;
          created_at: string;
          id: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database['public']['Enums']['script_status'];
          updated_at: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          content: NonNullable<Json>;
          created_at?: string;
          id: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database['public']['Enums']['script_status'];
          updated_at?: string;
          version?: number;
        };
        Update: {
          content?: NonNullable<Json>;
          created_at?: string;
          id?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database['public']['Enums']['script_status'];
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      ladder_sessions: {
        Row: {
          ended_at: string | null;
          id: string;
          persona: Database['public']['Enums']['persona'];
          score: number;
          script_id: string;
          script_version: number;
          started_at: string;
          status: Database['public']['Enums']['ladder_status'];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          ended_at?: string | null;
          id?: string;
          persona?: Database['public']['Enums']['persona'];
          score?: number;
          script_id: string;
          script_version: number;
          started_at?: string;
          status?: Database['public']['Enums']['ladder_status'];
          user_id?: string;
        };
        Update: {
          ended_at?: string | null;
          id?: string;
          persona?: Database['public']['Enums']['persona'];
          score?: number;
          script_id?: string;
          script_version?: number;
          started_at?: string;
          status?: Database['public']['Enums']['ladder_status'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ladder_sessions_script_id_fkey';
            columns: ['script_id'];
            isOneToOne: false;
            referencedRelation: 'illness_scripts';
            referencedColumns: ['id'];
          },
        ];
      };
      question_flags: {
        Row: {
          created_at: string;
          id: string;
          note: string | null;
          question_id: string | null;
          reason: Database['public']['Enums']['flag_reason'];
          script_id: string;
          script_version: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          note?: string | null;
          question_id?: string | null;
          reason: Database['public']['Enums']['flag_reason'];
          script_id: string;
          script_version: number;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          note?: string | null;
          question_id?: string | null;
          reason?: Database['public']['Enums']['flag_reason'];
          script_id?: string;
          script_version?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'question_flags_question_id_fkey';
            columns: ['question_id'];
            isOneToOne: false;
            referencedRelation: 'questions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'question_flags_script_id_fkey';
            columns: ['script_id'];
            isOneToOne: false;
            referencedRelation: 'illness_scripts';
            referencedColumns: ['id'];
          },
        ];
      };
      questions: {
        Row: {
          content: NonNullable<Json>;
          created_at: string;
          id: string;
          rung: Database['public']['Enums']['ladder_rung'];
          script_id: string;
          script_version: number;
        };
        ComputedFields: never;
        Insert: {
          content: NonNullable<Json>;
          created_at?: string;
          id: string;
          rung: Database['public']['Enums']['ladder_rung'];
          script_id: string;
          script_version: number;
        };
        Update: {
          content?: NonNullable<Json>;
          created_at?: string;
          id?: string;
          rung?: Database['public']['Enums']['ladder_rung'];
          script_id?: string;
          script_version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'questions_script_id_fkey';
            columns: ['script_id'];
            isOneToOne: false;
            referencedRelation: 'illness_scripts';
            referencedColumns: ['id'];
          },
        ];
      };
      script_progress: {
        Row: {
          best_rung: number;
          last_played_at: string | null;
          script_id: string;
          sessions_count: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          best_rung?: number;
          last_played_at?: string | null;
          script_id: string;
          sessions_count?: number;
          user_id?: string;
        };
        Update: {
          best_rung?: number;
          last_played_at?: string | null;
          script_id?: string;
          sessions_count?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'script_progress_script_id_fkey';
            columns: ['script_id'];
            isOneToOne: false;
            referencedRelation: 'illness_scripts';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      finish_ladder_session: {
        Args: {
          p_score: number;
          p_session_id: string;
          p_status: Database['public']['Enums']['ladder_status'];
        };
        Returns: {
          best_rung: number;
          last_played_at: string | null;
          script_id: string;
          sessions_count: number;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'script_progress';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      flag_reason: 'marked_wrong' | 'unclear' | 'script_error' | 'other';
      grade: 'correct' | 'partial' | 'incorrect';
      grader: 'local' | 'llm';
      ladder_rung: 'recall' | 'second_order' | 'differentiate' | 'workup' | 'management' | 'pearl';
      ladder_status: 'in_progress' | 'missed' | 'completed';
      persona: 'teacher' | 'internist' | 'surgeon';
      script_status: 'draft' | 'in_review' | 'approved' | 'retired';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      flag_reason: ['marked_wrong', 'unclear', 'script_error', 'other'],
      grade: ['correct', 'partial', 'incorrect'],
      grader: ['local', 'llm'],
      ladder_rung: ['recall', 'second_order', 'differentiate', 'workup', 'management', 'pearl'],
      ladder_status: ['in_progress', 'missed', 'completed'],
      persona: ['teacher', 'internist', 'surgeon'],
      script_status: ['draft', 'in_review', 'approved', 'retired'],
    },
  },
} as const;
