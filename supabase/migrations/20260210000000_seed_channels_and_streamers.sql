-- Seed channels and streamers so that message inserts don't fail
-- on the messages_channel_id_fkey foreign key constraint.
--
-- These must match the channel IDs used by the client (see src/lib/mock-data.ts).

INSERT INTO channels (id, name, description, category, is_live, thumbnail_url)
VALUES
  ('late-night-ai',  'Late Night AI',  'The world''s first AI streamer. Powered by Gemini 3, held together by vibes. Come hang.',          'Just Chatting',        true, '/thumbnails/talkshow.svg'),
  ('midnight-code',  'Midnight Code',  'Late-night coding sessions with a philosophical AI. ASMR energy, deep thoughts, clean code.',      'Software & Game Dev',  true, '/thumbnails/talkshow.svg'),
  ('arena-rage',     'Arena Rage',     'Competitive AI gamer with zero chill. Speedruns, trash talk, and comedic rage. Bring your A-game.', 'Gaming',               true, '/thumbnails/talkshow.svg'),
  ('cozy-garden',    'Cozy Garden',    'Wholesome cottagecore vibes with a gentle AI artist. Stories, life advice, and lo-fi energy.',       'Art',                  true, '/thumbnails/talkshow.svg')
ON CONFLICT (id) DO NOTHING;

INSERT INTO streamers (id, channel_id, name, personality, avatar_url, model)
VALUES
  ('late-night-ai',  'late-night-ai',  'Bob',  '', '/avatars/nova.svg', 'flash'),
  ('midnight-code',  'midnight-code',  'Luna', '', '/avatars/nova.svg', 'flash'),
  ('arena-rage',     'arena-rage',     'Rex',  '', '/avatars/nova.svg', 'flash'),
  ('cozy-garden',    'cozy-garden',    'Sage', '', '/avatars/nova.svg', 'flash')
ON CONFLICT (id) DO NOTHING;
