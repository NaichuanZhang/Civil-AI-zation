ALTER TABLE turns DROP CONSTRAINT IF EXISTS turns_action_type_check;
ALTER TABLE turns ADD CONSTRAINT turns_action_type_check
  CHECK (action_type IN ('move', 'attack', 'rest', 'turn', 'invalid'));
