-- =====================================================================
-- Alien Force Arena — core relational schema
--
-- Design notes (for the write-up):
--  * Rooms are kept SEPARATE from matches so one room can host many
--    matches (rematches). rooms.id is referenced by matches.room_id.
--  * Ratings are per (player, mode) so 1v1 and 2v2 skill are independent.
--  * Telemetry is event-level (shots/hits/eliminations/disconnects), never
--    per-movement-tick, so the table stays small enough to query.
--  * All timestamps are timestamptz, always stored in UTC.
--  * Every write that decides an outcome is done by the server (service_role)
--    or by a SECURITY DEFINER function; clients get read-only access.
-- =====================================================================

-- ---------- enumerated types -----------------------------------------
CREATE TYPE public.game_mode          AS ENUM ('1v1', '2v2');
CREATE TYPE public.room_status        AS ENUM ('open', 'in_match', 'closed');
CREATE TYPE public.match_status       AS ENUM ('pending', 'live', 'completed', 'abandoned');
CREATE TYPE public.participant_outcome AS ENUM ('win', 'loss', 'draw', 'disconnect');
CREATE TYPE public.queue_status       AS ENUM ('waiting', 'matched', 'cancelled');
CREATE TYPE public.event_type         AS ENUM ('shot', 'hit', 'elimination', 'disconnect', 'round_start', 'round_end');

-- ---------- profiles --------------------------------------------------
-- One row per authenticated player. id matches auth.users.id (no FK: the
-- auth schema is managed by the platform). Demo rows use generated uuids.
CREATE TABLE public.profiles (
  id           uuid PRIMARY KEY,
  display_name text NOT NULL,
  region       text NOT NULL DEFAULT 'unknown',
  is_demo      boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT display_name_length CHECK (char_length(display_name) BETWEEN 2 AND 24),
  CONSTRAINT display_name_unique UNIQUE (display_name)
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon; -- leaderboards show display names publicly
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are publicly readable"
  ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Players can create their own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
-- Players may edit their own profile. The WITH CHECK keeps id pinned to them;
-- rating lives in another table entirely so it cannot be edited here at all.
CREATE POLICY "Players can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ---------- ratings ---------------------------------------------------
CREATE TABLE public.player_ratings (
  player_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode          public.game_mode NOT NULL,
  rating        integer NOT NULL DEFAULT 1200,
  matches_played integer NOT NULL DEFAULT 0,
  wins          integer NOT NULL DEFAULT 0,
  losses        integer NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, mode),
  CONSTRAINT rating_range CHECK (rating BETWEEN 100 AND 4000),
  CONSTRAINT counts_non_negative CHECK (matches_played >= 0 AND wins >= 0 AND losses >= 0)
);

-- Read-only for clients: ratings are written by the server only.
GRANT SELECT ON public.player_ratings TO authenticated, anon;
GRANT ALL ON public.player_ratings TO service_role;
ALTER TABLE public.player_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ratings are publicly readable"
  ON public.player_ratings FOR SELECT USING (true);

CREATE INDEX player_ratings_mode_rating_idx
  ON public.player_ratings (mode, rating DESC);

-- ---------- rooms and membership -------------------------------------
CREATE TABLE public.rooms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  host_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode        public.game_mode NOT NULL,
  status      public.room_status NOT NULL DEFAULT 'open',
  max_players smallint NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  closed_at   timestamptz,
  CONSTRAINT room_code_format CHECK (code ~ '^[A-Z0-9]{4,6}$'),
  -- capacity must agree with the mode: 1v1 seats 2, 2v2 seats 4
  CONSTRAINT capacity_matches_mode CHECK (
    (mode = '1v1' AND max_players = 2) OR (mode = '2v2' AND max_players = 4)
  )
);

GRANT SELECT, INSERT, UPDATE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in players can look up rooms"
  ON public.rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Players can create rooms they host"
  ON public.rooms FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Hosts can update their own room"
  ON public.rooms FOR UPDATE TO authenticated
  USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);

CREATE TABLE public.room_members (
  room_id   uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team      smallint NOT NULL,
  is_ready  boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, player_id),
  CONSTRAINT team_is_0_or_1 CHECK (team IN (0, 1))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_members TO authenticated;
GRANT ALL ON public.room_members TO service_role;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in players can read room rosters"
  ON public.room_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Players join rooms as themselves"
  ON public.room_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = player_id);
CREATE POLICY "Players update their own seat"
  ON public.room_members FOR UPDATE TO authenticated
  USING (auth.uid() = player_id) WITH CHECK (auth.uid() = player_id);
CREATE POLICY "Players can leave a room"
  ON public.room_members FOR DELETE TO authenticated USING (auth.uid() = player_id);

CREATE INDEX room_members_player_idx ON public.room_members (player_id);

-- Capacity and team-balance are enforced in the database, not in the client.
CREATE OR REPLACE FUNCTION public.enforce_room_capacity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  room        public.rooms%ROWTYPE;
  seats_taken integer;
  team_taken  integer;
BEGIN
  SELECT * INTO room FROM public.rooms WHERE id = NEW.room_id FOR UPDATE;
  IF room.id IS NULL THEN
    RAISE EXCEPTION 'Room does not exist';
  END IF;
  IF room.status <> 'open' THEN
    RAISE EXCEPTION 'Room % is not open for new players', room.code;
  END IF;

  SELECT count(*) INTO seats_taken FROM public.room_members WHERE room_id = NEW.room_id;
  IF seats_taken >= room.max_players THEN
    RAISE EXCEPTION 'Room % is full (% of % seats)', room.code, seats_taken, room.max_players;
  END IF;

  SELECT count(*) INTO team_taken
    FROM public.room_members WHERE room_id = NEW.room_id AND team = NEW.team;
  IF team_taken >= room.max_players / 2 THEN
    RAISE EXCEPTION 'Team % in room % is already full', NEW.team, room.code;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER room_members_capacity
  BEFORE INSERT ON public.room_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_room_capacity();

-- ---------- matchmaking queue ----------------------------------------
CREATE TABLE public.matchmaking_queue (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode        public.game_mode NOT NULL,
  rating      integer NOT NULL,
  region      text NOT NULL,
  latency_ms  integer NOT NULL,
  status      public.queue_status NOT NULL DEFAULT 'waiting',
  enqueued_at timestamptz NOT NULL DEFAULT now(),
  matched_at  timestamptz,
  CONSTRAINT latency_sane CHECK (latency_ms BETWEEN 0 AND 5000),
  CONSTRAINT matched_at_after_enqueue CHECK (matched_at IS NULL OR matched_at >= enqueued_at)
);

-- A player may only sit in one queue per mode at a time.
CREATE UNIQUE INDEX matchmaking_queue_one_active_per_mode
  ON public.matchmaking_queue (player_id, mode)
  WHERE status = 'waiting';
CREATE INDEX matchmaking_queue_search_idx
  ON public.matchmaking_queue (mode, status, rating, enqueued_at);

GRANT SELECT, INSERT, UPDATE ON public.matchmaking_queue TO authenticated;
GRANT ALL ON public.matchmaking_queue TO service_role;
ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players read their own queue entries"
  ON public.matchmaking_queue FOR SELECT TO authenticated USING (auth.uid() = player_id);
CREATE POLICY "Players queue as themselves"
  ON public.matchmaking_queue FOR INSERT TO authenticated WITH CHECK (auth.uid() = player_id);
-- Players may cancel their own entry; only the server may mark it 'matched'.
CREATE POLICY "Players cancel their own queue entry"
  ON public.matchmaking_queue FOR UPDATE TO authenticated
  USING (auth.uid() = player_id)
  WITH CHECK (auth.uid() = player_id AND status IN ('waiting', 'cancelled'));

-- ---------- matches ---------------------------------------------------
CREATE TABLE public.matches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  mode          public.game_mode NOT NULL,
  status        public.match_status NOT NULL DEFAULT 'pending',
  server_id     text,
  winning_team  smallint,
  created_at    timestamptz NOT NULL DEFAULT now(),
  started_at    timestamptz,
  ended_at      timestamptz,
  CONSTRAINT winning_team_valid CHECK (winning_team IS NULL OR winning_team IN (0, 1)),
  -- a completed match must have an end time and a winner recorded
  CONSTRAINT completed_has_result CHECK (
    status <> 'completed' OR (ended_at IS NOT NULL AND winning_team IS NOT NULL)
  ),
  CONSTRAINT ended_after_started CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);

GRANT SELECT ON public.matches TO authenticated, anon;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
-- Clients can read match records but never write them: results come from the
-- authoritative game server through service_role / SECURITY DEFINER functions.
CREATE POLICY "Matches are publicly readable"
  ON public.matches FOR SELECT USING (true);

CREATE INDEX matches_mode_status_idx ON public.matches (mode, status, created_at DESC);
CREATE INDEX matches_room_idx ON public.matches (room_id);

CREATE TABLE public.match_participants (
  match_id      uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team          smallint NOT NULL,
  outcome       public.participant_outcome,
  rating_before integer NOT NULL,
  rating_after  integer,
  shots         integer NOT NULL DEFAULT 0,
  hits          integer NOT NULL DEFAULT 0,
  PRIMARY KEY (match_id, player_id),
  CONSTRAINT participant_team_valid CHECK (team IN (0, 1)),
  CONSTRAINT hits_not_above_shots CHECK (hits <= shots),
  CONSTRAINT stats_non_negative CHECK (shots >= 0 AND hits >= 0)
);

GRANT SELECT ON public.match_participants TO authenticated, anon;
GRANT ALL ON public.match_participants TO service_role;
ALTER TABLE public.match_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Match participants are publicly readable"
  ON public.match_participants FOR SELECT USING (true);

CREATE INDEX match_participants_player_idx ON public.match_participants (player_id);

CREATE TABLE public.match_rounds (
  match_id     uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  round_number smallint NOT NULL,
  winning_team smallint,
  started_at   timestamptz NOT NULL DEFAULT now(),
  ended_at     timestamptz,
  PRIMARY KEY (match_id, round_number),
  CONSTRAINT round_number_positive CHECK (round_number > 0),
  CONSTRAINT round_winner_valid CHECK (winning_team IS NULL OR winning_team IN (0, 1))
);

GRANT SELECT ON public.match_rounds TO authenticated, anon;
GRANT ALL ON public.match_rounds TO service_role;
ALTER TABLE public.match_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Match rounds are publicly readable"
  ON public.match_rounds FOR SELECT USING (true);

-- ---------- gameplay telemetry ---------------------------------------
-- One row per meaningful event, NOT per animation frame.
CREATE TABLE public.match_events (
  id               bigserial PRIMARY KEY,
  match_id         uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  round_number     smallint NOT NULL,
  event_type       public.event_type NOT NULL,
  player_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_player_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  game_tick        integer,
  occurred_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_round_positive CHECK (round_number > 0),
  CONSTRAINT event_tick_non_negative CHECK (game_tick IS NULL OR game_tick >= 0)
);

GRANT SELECT ON public.match_events TO authenticated;
GRANT ALL ON public.match_events TO service_role;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in players can read telemetry"
  ON public.match_events FOR SELECT TO authenticated USING (true);

CREATE INDEX match_events_match_idx ON public.match_events (match_id, round_number);
CREATE INDEX match_events_type_idx  ON public.match_events (event_type, occurred_at);

-- ---------- daily leaderboard snapshots -------------------------------
CREATE TABLE public.leaderboard_snapshots (
  snapshot_date date NOT NULL,
  mode          public.game_mode NOT NULL,
  player_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rank          integer NOT NULL,
  rating        integer NOT NULL,
  wins          integer NOT NULL DEFAULT 0,
  losses        integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (snapshot_date, mode, player_id),
  CONSTRAINT rank_positive CHECK (rank > 0),
  CONSTRAINT snapshot_rank_unique UNIQUE (snapshot_date, mode, rank)
);

GRANT SELECT ON public.leaderboard_snapshots TO authenticated, anon;
GRANT ALL ON public.leaderboard_snapshots TO service_role;
ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leaderboard snapshots are publicly readable"
  ON public.leaderboard_snapshots FOR SELECT USING (true);

-- keep updated_at honest on profiles
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();