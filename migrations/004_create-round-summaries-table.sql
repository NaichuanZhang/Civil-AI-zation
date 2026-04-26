CREATE TABLE round_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  summary TEXT NOT NULL,
  state_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (game_id, round_number)
);

CREATE INDEX idx_round_summaries_game_round ON round_summaries(game_id, round_number);
