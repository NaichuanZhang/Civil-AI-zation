ALTER TABLE agent_states DROP CONSTRAINT agent_states_orientation_check;
ALTER TABLE agent_states ADD CONSTRAINT agent_states_orientation_check
  CHECK (orientation IN ('up', 'down', 'left', 'right'));
