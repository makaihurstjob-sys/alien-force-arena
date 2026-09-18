-- Commit the enum value before using it in constraints or room creation.
alter type public.game_mode add value if not exists 'ffa';
