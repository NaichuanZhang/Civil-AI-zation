CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed')),
  current_round INTEGER NOT NULL DEFAULT 0,
  max_rounds INTEGER NOT NULL DEFAULT 30,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  winner_agent_id TEXT
    CHECK (winner_agent_id IS NULL OR winner_agent_id IN ('opus', 'sonnet', 'haiku')),
  result TEXT
    CHECK (result IS NULL OR result IN ('elimination', 'highest_hp', 'draw')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_created_at ON games(created_at DESC);
