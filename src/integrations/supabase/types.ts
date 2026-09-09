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
      leaderboard_snapshots: {
        Row: {
          created_at: string
          losses: number
          mode: Database["public"]["Enums"]["game_mode"]
          player_id: string
          rank: number
          rating: number
          snapshot_date: string
          wins: number
        }
        Insert: {
          created_at?: string
          losses?: number
          mode: Database["public"]["Enums"]["game_mode"]
          player_id: string
          rank: number
          rating: number
          snapshot_date: string
          wins?: number
        }
        Update: {
          created_at?: string
          losses?: number
          mode?: Database["public"]["Enums"]["game_mode"]
          player_id?: string
          rank?: number
          rating?: number
          snapshot_date?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_snapshots_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_events: {
        Row: {
          event_type: Database["public"]["Enums"]["event_type"]
          game_tick: number | null
          id: number
          match_id: string
          occurred_at: string
          player_id: string | null
          round_number: number
          target_player_id: string | null
        }
        Insert: {
          event_type: Database["public"]["Enums"]["event_type"]
          game_tick?: number | null
          id?: number
          match_id: string
          occurred_at?: string
          player_id?: string | null
          round_number: number
          target_player_id?: string | null
        }
        Update: {
          event_type?: Database["public"]["Enums"]["event_type"]
          game_tick?: number | null
          id?: number
          match_id?: string
          occurred_at?: string
          player_id?: string | null
          round_number?: number
          target_player_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_target_player_id_fkey"
            columns: ["target_player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_participants: {
        Row: {
          hits: number
          match_id: string
          outcome: Database["public"]["Enums"]["participant_outcome"] | null
          player_id: string
          rating_after: number | null
          rating_before: number
          shots: number
          team: number
        }
        Insert: {
          hits?: number
          match_id: string
          outcome?: Database["public"]["Enums"]["participant_outcome"] | null
          player_id: string
          rating_after?: number | null
          rating_before: number
          shots?: number
          team: number
        }
        Update: {
          hits?: number
          match_id?: string
          outcome?: Database["public"]["Enums"]["participant_outcome"] | null
          player_id?: string
          rating_after?: number | null
          rating_before?: number
          shots?: number
          team?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_participants_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_participants_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_rounds: {
        Row: {
          ended_at: string | null
          match_id: string
          round_number: number
          started_at: string
          winning_team: number | null
        }
        Insert: {
          ended_at?: string | null
          match_id: string
          round_number: number
          started_at?: string
          winning_team?: number | null
        }
        Update: {
          ended_at?: string | null
          match_id?: string
          round_number?: number
          started_at?: string
          winning_team?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "match_rounds_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          mode: Database["public"]["Enums"]["game_mode"]
          room_id: string | null
          server_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["match_status"]
          winning_team: number | null
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          mode: Database["public"]["Enums"]["game_mode"]
          room_id?: string | null
          server_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          winning_team?: number | null
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["game_mode"]
          room_id?: string | null
          server_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          winning_team?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      matchmaking_queue: {
        Row: {
          enqueued_at: string
          id: string
          latency_ms: number
          matched_at: string | null
          mode: Database["public"]["Enums"]["game_mode"]
          player_id: string
          rating: number
          region: string
          status: Database["public"]["Enums"]["queue_status"]
        }
        Insert: {
          enqueued_at?: string
          id?: string
          latency_ms: number
          matched_at?: string | null
          mode: Database["public"]["Enums"]["game_mode"]
          player_id: string
          rating: number
          region: string
          status?: Database["public"]["Enums"]["queue_status"]
        }
        Update: {
          enqueued_at?: string
          id?: string
          latency_ms?: number
          matched_at?: string | null
          mode?: Database["public"]["Enums"]["game_mode"]
          player_id?: string
          rating?: number
          region?: string
          status?: Database["public"]["Enums"]["queue_status"]
        }
        Relationships: [
          {
            foreignKeyName: "matchmaking_queue_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_ratings: {
        Row: {
          losses: number
          matches_played: number
          mode: Database["public"]["Enums"]["game_mode"]
          player_id: string
          rating: number
          updated_at: string
          wins: number
        }
        Insert: {
          losses?: number
          matches_played?: number
          mode: Database["public"]["Enums"]["game_mode"]
          player_id: string
          rating?: number
          updated_at?: string
          wins?: number
        }
        Update: {
          losses?: number
          matches_played?: number
          mode?: Database["public"]["Enums"]["game_mode"]
          player_id?: string
          rating?: number
          updated_at?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_ratings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_demo: boolean
          region: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          is_demo?: boolean
          region?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_demo?: boolean
          region?: string
          updated_at?: string
        }
        Relationships: []
      }
      room_members: {
        Row: {
          is_ready: boolean
          joined_at: string
          player_id: string
          room_id: string
          team: number
        }
        Insert: {
          is_ready?: boolean
          joined_at?: string
          player_id: string
          room_id: string
          team: number
        }
        Update: {
          is_ready?: boolean
          joined_at?: string
          player_id?: string
          room_id?: string
          team?: number
        }
        Relationships: [
          {
            foreignKeyName: "room_members_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          closed_at: string | null
          code: string
          created_at: string
          host_id: string
          id: string
          max_players: number
          mode: Database["public"]["Enums"]["game_mode"]
          status: Database["public"]["Enums"]["room_status"]
        }
        Insert: {
          closed_at?: string | null
          code: string
          created_at?: string
          host_id: string
          id?: string
          max_players: number
          mode: Database["public"]["Enums"]["game_mode"]
          status?: Database["public"]["Enums"]["room_status"]
        }
        Update: {
          closed_at?: string | null
          code?: string
          created_at?: string
          host_id?: string
          id?: string
          max_players?: number
          mode?: Database["public"]["Enums"]["game_mode"]
          status?: Database["public"]["Enums"]["room_status"]
        }
        Relationships: [
          {
            foreignKeyName: "rooms_host_id_fkey"
            columns: ["host_id"]
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
      complete_match: {
        Args: { p_match_id: string; p_winning_team: number }
        Returns: undefined
      }
      elo_delta: {
        Args: {
          matches_played: number
          rating_a: number
          rating_b: number
          score_a: number
        }
        Returns: number
      }
      snapshot_leaderboard: { Args: { p_date?: string }; Returns: number }
    }
    Enums: {
      event_type:
        | "shot"
        | "hit"
        | "elimination"
        | "disconnect"
        | "round_start"
        | "round_end"
      game_mode: "1v1" | "2v2"
      match_status: "pending" | "live" | "completed" | "abandoned"
      participant_outcome: "win" | "loss" | "draw" | "disconnect"
      queue_status: "waiting" | "matched" | "cancelled"
      room_status: "open" | "in_match" | "closed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      event_type: [
        "shot",
        "hit",
        "elimination",
        "disconnect",
        "round_start",
        "round_end",
      ],
      game_mode: ["1v1", "2v2"],
      match_status: ["pending", "live", "completed", "abandoned"],
      participant_outcome: ["win", "loss", "draw", "disconnect"],
      queue_status: ["waiting", "matched", "cancelled"],
      room_status: ["open", "in_match", "closed"],
    },
  },
} as const
