import { describe, it, expect } from 'vitest';
import { buildUserMessage } from '../src/agent-prompt.js';
import type { SharedGameView, PersonalAgentView, AgentState } from '../src/types.js';

describe('Agent Prompt - SURROUNDING field', () => {
  const createMockAgent = (
    id: 'opus' | 'sonnet' | 'haiku',
    x: number,
    y: number,
    orientation: 'up' | 'down' | 'left' | 'right'
  ): AgentState => ({
    agentId: id,
    modelId: 'test',
    speed: 3,
    hp: 20,
    ep: 1,
    position: { x, y },
    orientation,
    status: 'alive',
    eliminatedAtRound: null,
    memory: [],
    turnOrder: 0,
  });

  it('correctly identifies agent to the left', () => {
    // Sonnet at (2,1), Opus at (0,1) - Opus should be "2 LEFT"
    const sonnet = createMockAgent('sonnet', 2, 1, 'up');
    const opus = createMockAgent('opus', 0, 1, 'down');
    const haiku = createMockAgent('haiku', 1, 2, 'up');

    const sharedView: SharedGameView = {
      round: 1,
      mapWidth: 3,
      mapHeight: 3,
      agents: [
        { agentId: 'sonnet', position: { x: 2, y: 1 }, hp: 20, orientation: 'up' },
        { agentId: 'opus', position: { x: 0, y: 1 }, hp: 20, orientation: 'down' },
        { agentId: 'haiku', position: { x: 1, y: 2 }, hp: 15, orientation: 'up' },
      ],
      eliminatedAgents: [],
      previousRoundSummary: null,
      chests: [],
    };

    const personalView: PersonalAgentView = {
      agentId: 'sonnet',
      hp: 20,
      ep: 1,
      position: { x: 2, y: 1 },
      orientation: 'up',
      memory: [],
    };

    const aliveAgents = [sonnet, opus, haiku];
    const validMoves = ['up', 'down'] as const;

    const message = buildUserMessage(sharedView, personalView, aliveAgents, validMoves);

    // Sonnet at (2,1): left cell is (1,1) which should be empty
    expect(message).toContain('left: "Empty"');
    // up is (2,0) which should be empty
    expect(message).toContain('up: "Empty"');
    // down is (2,2) which should be empty
    expect(message).toContain('down: "Empty"');
    // right is (3,1) which is out of bounds
    expect(message).toContain('right: "Wall"');
  });

  it('correctly identifies agent above', () => {
    // Agent at (1,1), Opus at (1,0) - Opus should be "up"
    const haiku = createMockAgent('haiku', 1, 1, 'down');
    const opus = createMockAgent('opus', 1, 0, 'down');
    const sonnet = createMockAgent('sonnet', 2, 2, 'left');

    const sharedView: SharedGameView = {
      round: 1,
      mapWidth: 3,
      mapHeight: 3,
      agents: [
        { agentId: 'haiku', position: { x: 1, y: 1 }, hp: 15, orientation: 'down' },
        { agentId: 'opus', position: { x: 1, y: 0 }, hp: 25, orientation: 'down' },
        { agentId: 'sonnet', position: { x: 2, y: 2 }, hp: 20, orientation: 'left' },
      ],
      eliminatedAgents: [],
      previousRoundSummary: null,
      chests: [],
    };

    const personalView: PersonalAgentView = {
      agentId: 'haiku',
      hp: 15,
      ep: 1,
      position: { x: 1, y: 1 },
      orientation: 'down',
      memory: [],
    };

    const aliveAgents = [haiku, opus, sonnet];
    const validMoves = ['left', 'right'] as const;

    const message = buildUserMessage(sharedView, personalView, aliveAgents, validMoves);

    // Haiku at (1,1): up is (1,0) where opus is
    expect(message).toContain('up: "opus"');
    // down is (1,2) which should be empty
    expect(message).toContain('down: "Empty"');
    // left is (0,1) which should be empty
    expect(message).toContain('left: "Empty"');
    // right is (2,1) which should be empty
    expect(message).toContain('right: "Empty"');
  });

  it('correctly identifies agent below', () => {
    // Opus at (1,0), Haiku at (1,1) - Haiku should be "down"
    const opus = createMockAgent('opus', 1, 0, 'down');
    const haiku = createMockAgent('haiku', 1, 1, 'up');
    const sonnet = createMockAgent('sonnet', 2, 2, 'left');

    const sharedView: SharedGameView = {
      round: 1,
      mapWidth: 3,
      mapHeight: 3,
      agents: [
        { agentId: 'opus', position: { x: 1, y: 0 }, hp: 25, orientation: 'down' },
        { agentId: 'haiku', position: { x: 1, y: 1 }, hp: 15, orientation: 'up' },
        { agentId: 'sonnet', position: { x: 2, y: 2 }, hp: 20, orientation: 'left' },
      ],
      eliminatedAgents: [],
      previousRoundSummary: null,
      chests: [],
    };

    const personalView: PersonalAgentView = {
      agentId: 'opus',
      hp: 25,
      ep: 1,
      position: { x: 1, y: 0 },
      orientation: 'down',
      memory: [],
    };

    const aliveAgents = [opus, haiku, sonnet];
    const validMoves = ['left', 'right'] as const;

    const message = buildUserMessage(sharedView, personalView, aliveAgents, validMoves);

    // Opus at (1,0): up is (1,-1) which is wall
    expect(message).toContain('up: "Wall"');
    // down is (1,1) where haiku is
    expect(message).toContain('down: "haiku"');
    // left is (0,0) which should be empty
    expect(message).toContain('left: "Empty"');
    // right is (2,0) which should be empty
    expect(message).toContain('right: "Empty"');
  });

  it('correctly identifies agent to the right', () => {
    // Agent at (0,1), Haiku at (1,1) - Haiku should be "right"
    const opus = createMockAgent('opus', 0, 1, 'right');
    const haiku = createMockAgent('haiku', 1, 1, 'down');
    const sonnet = createMockAgent('sonnet', 2, 2, 'left');

    const sharedView: SharedGameView = {
      round: 1,
      mapWidth: 3,
      mapHeight: 3,
      agents: [
        { agentId: 'opus', position: { x: 0, y: 1 }, hp: 25, orientation: 'right' },
        { agentId: 'haiku', position: { x: 1, y: 1 }, hp: 15, orientation: 'down' },
        { agentId: 'sonnet', position: { x: 2, y: 2 }, hp: 20, orientation: 'left' },
      ],
      eliminatedAgents: [],
      previousRoundSummary: null,
      chests: [],
    };

    const personalView: PersonalAgentView = {
      agentId: 'opus',
      hp: 25,
      ep: 1,
      position: { x: 0, y: 1 },
      orientation: 'right',
      memory: [],
    };

    const aliveAgents = [opus, haiku, sonnet];
    const validMoves = ['up', 'down'] as const;

    const message = buildUserMessage(sharedView, personalView, aliveAgents, validMoves);

    // Opus at (0,1): up is (0,0) which should be empty
    expect(message).toContain('up: "Empty"');
    // down is (0,2) which should be empty
    expect(message).toContain('down: "Empty"');
    // left is (-1,1) which is wall
    expect(message).toContain('left: "Wall"');
    // right is (1,1) where haiku is
    expect(message).toContain('right: "haiku"');
  });
});
