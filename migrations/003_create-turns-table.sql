CREATE TABLE turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  agent_id TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('move', 'attack', 'rest', 'invalid')),
  action_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  llm_reasoning TEXT,
  raw_llm_response JSONB
);

CREATE INDEX idx_turns_game_round ON turns(game_id, round_number);
