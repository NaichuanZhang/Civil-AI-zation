CREATE TABLE agent_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL CHECK (agent_id IN ('opus', 'sonnet', 'haiku')),
  model_id TEXT NOT NULL,
  hp INTEGER NOT NULL,
  ep INTEGER NOT NULL DEFAULT 1,
  position_x INTEGER NOT NULL,
  position_y INTEGER NOT NULL,
  orientation TEXT NOT NULL CHECK (orientation IN ('N', 'S', 'E', 'W')),
  status TEXT NOT NULL DEFAULT 'alive' CHECK (status IN ('alive', 'eliminated')),
  speed INTEGER NOT NULL,
  eliminated_at_round INTEGER,
  memory JSONB NOT NULL DEFAULT '[]'::jsonb,
  turn_order INTEGER NOT NULL,
  UNIQUE (game_id, agent_id)
);

CREATE INDEX idx_agent_states_game_id ON agent_states(game_id);
