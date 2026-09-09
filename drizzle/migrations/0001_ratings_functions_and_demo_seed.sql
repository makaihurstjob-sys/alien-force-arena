-- =====================================================================
-- Elo rating maths, transactional match completion, leaderboard snapshot
-- and a small demo dataset so every screen has something to show.
-- =====================================================================

-- Standard Elo expectation. K-factor is larger for new players so ratings
-- settle quickly, then tightens once a player has 30+ matches.
CREATE OR REPLACE FUNCTION public.elo_delta(
  rating_a integer, rating_b integer, score_a numeric, matches_played integer
) RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$
  SELECT round(
    (CASE WHEN matches_played < 10 THEN 40
          WHEN matches_played < 30 THEN 28
          ELSE 20 END)
    * (score_a - (1.0 / (1.0 + power(10.0, (rating_b - rating_a) / 400.0))))
  )::integer;
$$;

-- Completes a match in ONE transaction: writes the result, per-player
-- outcomes and the new ratings. Idempotent — calling it twice on the same
-- match is rejected, so a retrying game server cannot double-count Elo.
CREATE OR REPLACE FUNCTION public.complete_match(
  p_match_id uuid,
  p_winning_team smallint
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m            public.matches%ROWTYPE;
  part         record;
  team_avg     numeric[];
  opp_rating   integer;
  delta        integer;
  score        numeric;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = p_match_id FOR UPDATE;
  IF m.id IS NULL THEN
    RAISE EXCEPTION 'Match % does not exist', p_match_id;
  END IF;
  IF m.status = 'completed' THEN
    RAISE EXCEPTION 'Match % has already been completed', p_match_id;
  END IF;
  IF p_winning_team NOT IN (0, 1) THEN
    RAISE EXCEPTION 'Winning team must be 0 or 1';
  END IF;

  -- average rating of each team, used as the opponent strength in 2v2
  SELECT array[
    coalesce(avg(rating_before) FILTER (WHERE team = 0), 1200),
    coalesce(avg(rating_before) FILTER (WHERE team = 1), 1200)
  ] INTO team_avg
  FROM public.match_participants WHERE match_id = p_match_id;

  FOR part IN
    SELECT * FROM public.match_participants WHERE match_id = p_match_id
  LOOP
    opp_rating := round(team_avg[CASE WHEN part.team = 0 THEN 2 ELSE 1 END])::integer;
    score      := CASE WHEN part.team = p_winning_team THEN 1 ELSE 0 END;

    delta := public.elo_delta(
      part.rating_before,
      opp_rating,
      score,
      coalesce((SELECT matches_played FROM public.player_ratings
                WHERE player_id = part.player_id AND mode = m.mode), 0)
    );

    UPDATE public.match_participants
       SET outcome      = CASE WHEN part.team = p_winning_team THEN 'win' ELSE 'loss' END::public.participant_outcome,
           rating_after = part.rating_before + delta
     WHERE match_id = p_match_id AND player_id = part.player_id;

    INSERT INTO public.player_ratings (player_id, mode, rating, matches_played, wins, losses, updated_at)
    VALUES (
      part.player_id, m.mode, part.rating_before + delta, 1,
      CASE WHEN score = 1 THEN 1 ELSE 0 END,
      CASE WHEN score = 1 THEN 0 ELSE 1 END,
      now()
    )
    ON CONFLICT (player_id, mode) DO UPDATE
      SET rating         = EXCLUDED.rating,
          matches_played = public.player_ratings.matches_played + 1,
          wins           = public.player_ratings.wins   + EXCLUDED.wins,
          losses         = public.player_ratings.losses + EXCLUDED.losses,
          updated_at     = now();
  END LOOP;

  UPDATE public.matches
     SET status = 'completed', winning_team = p_winning_team, ended_at = now()
   WHERE id = p_match_id;

  UPDATE public.rooms SET status = 'open' WHERE id = m.room_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_match(uuid, smallint) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_match(uuid, smallint) TO service_role;

-- Rank every rated player and store today's standings.
CREATE OR REPLACE FUNCTION public.snapshot_leaderboard(p_date date DEFAULT current_date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted integer;
BEGIN
  DELETE FROM public.leaderboard_snapshots WHERE snapshot_date = p_date;

  INSERT INTO public.leaderboard_snapshots (snapshot_date, mode, player_id, rank, rating, wins, losses)
  SELECT p_date, r.mode, r.player_id,
         row_number() OVER (PARTITION BY r.mode ORDER BY r.rating DESC, r.wins DESC, r.player_id),
         r.rating, r.wins, r.losses
    FROM public.player_ratings r
   WHERE r.matches_played > 0;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.snapshot_leaderboard(date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.snapshot_leaderboard(date) TO service_role;

-- =====================================================================
-- Demo data. Every row is flagged is_demo = true so it can be deleted with
-- a single statement before a real deployment.
-- =====================================================================
INSERT INTO public.profiles (id, display_name, region, is_demo) VALUES
  ('11111111-1111-4111-8111-000000000001', 'NovaRaider',  'na-east', true),
  ('11111111-1111-4111-8111-000000000002', 'PlasmaPete',  'na-east', true),
  ('11111111-1111-4111-8111-000000000003', 'IonQueen',    'eu-west', true),
  ('11111111-1111-4111-8111-000000000004', 'RustyBolt',   'eu-west', true),
  ('11111111-1111-4111-8111-000000000005', 'VectorVix',   'na-west', true),
  ('11111111-1111-4111-8111-000000000006', 'CometCarl',   'na-west', true),
  ('11111111-1111-4111-8111-000000000007', 'GridGhost',   'ap-south', true),
  ('11111111-1111-4111-8111-000000000008', 'DebrisDiana', 'ap-south', true);

INSERT INTO public.player_ratings (player_id, mode, rating, matches_played, wins, losses) VALUES
  ('11111111-1111-4111-8111-000000000001', '1v1', 1412, 24, 16, 8),
  ('11111111-1111-4111-8111-000000000002', '1v1', 1288, 21, 10, 11),
  ('11111111-1111-4111-8111-000000000003', '1v1', 1501, 30, 21, 9),
  ('11111111-1111-4111-8111-000000000004', '1v1', 1174, 18,  6, 12),
  ('11111111-1111-4111-8111-000000000005', '1v1', 1330, 15,  8,  7),
  ('11111111-1111-4111-8111-000000000006', '1v1', 1207, 12,  5,  7),
  ('11111111-1111-4111-8111-000000000007', '2v2', 1355, 19, 11,  8),
  ('11111111-1111-4111-8111-000000000008', '2v2', 1290, 19,  8, 11),
  ('11111111-1111-4111-8111-000000000001', '2v2', 1402, 19, 12,  7),
  ('11111111-1111-4111-8111-000000000003', '2v2', 1248, 19,  7, 12);

-- One finished 1v1 and one finished 2v2 so results/analytics have real rows.
INSERT INTO public.matches (id, mode, status, server_id, winning_team, started_at, ended_at) VALUES
  ('22222222-2222-4222-8222-000000000001', '1v1', 'completed', 'demo-server-1', 0,
   now() - interval '3 hours', now() - interval '2 hours 52 minutes'),
  ('22222222-2222-4222-8222-000000000002', '2v2', 'completed', 'demo-server-1', 1,
   now() - interval '1 hour',  now() - interval '48 minutes');

INSERT INTO public.match_participants (match_id, player_id, team, outcome, rating_before, rating_after, shots, hits) VALUES
  ('22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-000000000001', 0, 'win',  1394, 1412, 22, 3),
  ('22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-000000000002', 1, 'loss', 1306, 1288, 19, 1),
  ('22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-000000000007', 0, 'loss', 1372, 1355, 17, 2),
  ('22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-000000000003', 0, 'loss', 1265, 1248, 14, 1),
  ('22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-000000000008', 1, 'win',  1273, 1290, 20, 3),
  ('22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-000000000001', 1, 'win',  1385, 1402, 25, 4);

INSERT INTO public.match_rounds (match_id, round_number, winning_team, started_at, ended_at) VALUES
  ('22222222-2222-4222-8222-000000000001', 1, 0, now() - interval '3 hours',              now() - interval '2 hours 57 minutes'),
  ('22222222-2222-4222-8222-000000000001', 2, 1, now() - interval '2 hours 57 minutes',   now() - interval '2 hours 55 minutes'),
  ('22222222-2222-4222-8222-000000000001', 3, 0, now() - interval '2 hours 55 minutes',   now() - interval '2 hours 53 minutes'),
  ('22222222-2222-4222-8222-000000000001', 4, 0, now() - interval '2 hours 53 minutes',   now() - interval '2 hours 52 minutes'),
  ('22222222-2222-4222-8222-000000000002', 1, 1, now() - interval '1 hour',               now() - interval '56 minutes'),
  ('22222222-2222-4222-8222-000000000002', 2, 1, now() - interval '56 minutes',           now() - interval '52 minutes'),
  ('22222222-2222-4222-8222-000000000002', 3, 1, now() - interval '52 minutes',           now() - interval '48 minutes');

INSERT INTO public.match_events (match_id, round_number, event_type, player_id, target_player_id, game_tick) VALUES
  ('22222222-2222-4222-8222-000000000001', 1, 'round_start', NULL, NULL, 0),
  ('22222222-2222-4222-8222-000000000001', 1, 'shot',        '11111111-1111-4111-8111-000000000001', NULL, 42),
  ('22222222-2222-4222-8222-000000000001', 1, 'shot',        '11111111-1111-4111-8111-000000000002', NULL, 55),
  ('22222222-2222-4222-8222-000000000001', 1, 'hit',         '11111111-1111-4111-8111-000000000001', '11111111-1111-4111-8111-000000000002', 96),
  ('22222222-2222-4222-8222-000000000001', 1, 'elimination', '11111111-1111-4111-8111-000000000001', '11111111-1111-4111-8111-000000000002', 96),
  ('22222222-2222-4222-8222-000000000001', 1, 'round_end',   NULL, NULL, 97),
  ('22222222-2222-4222-8222-000000000002', 3, 'shot',        '11111111-1111-4111-8111-000000000008', NULL, 120),
  ('22222222-2222-4222-8222-000000000002', 3, 'hit',         '11111111-1111-4111-8111-000000000008', '11111111-1111-4111-8111-000000000007', 168),
  ('22222222-2222-4222-8222-000000000002', 3, 'elimination', '11111111-1111-4111-8111-000000000008', '11111111-1111-4111-8111-000000000007', 168),
  ('22222222-2222-4222-8222-000000000002', 3, 'elimination', '11111111-1111-4111-8111-000000000001', '11111111-1111-4111-8111-000000000003', 204),
  ('22222222-2222-4222-8222-000000000002', 3, 'round_end',   NULL, NULL, 205);

-- Two days of leaderboard history.
INSERT INTO public.leaderboard_snapshots (snapshot_date, mode, player_id, rank, rating, wins, losses)
SELECT current_date - 1, r.mode, r.player_id,
       row_number() OVER (PARTITION BY r.mode ORDER BY r.rating DESC, r.player_id),
       r.rating - 8, r.wins, r.losses
  FROM public.player_ratings r;

SELECT public.snapshot_leaderboard(current_date);