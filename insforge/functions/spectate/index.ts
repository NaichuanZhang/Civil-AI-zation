import { createClient } from 'npm:@insforge/sdk';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const client = createClient({
    baseUrl: Deno.env.get('INSFORGE_BASE_URL')!,
    anonKey: Deno.env.get('ANON_KEY')!,
  });

  const url = new URL(req.url);
  const gameId = url.searchParams.get('gameId');

  if (!gameId) {
    const { data: running } = await client.database
      .from('games')
      .select('*')
      .eq('status', 'running')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (running) {
      return await fetchFullGame(client, running.id);
    }

    const { data: completed } = await client.database
      .from('games')
      .select('*')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (completed) {
      return await fetchFullGame(client, completed.id);
    }

    return jsonResponse({ game: null, message: 'No games found' });
  }

  return await fetchFullGame(client, gameId);
}

async function fetchFullGame(client: ReturnType<typeof createClient>, gameId: string): Promise<Response> {
  const [gameRes, agentsRes, summariesRes, turnsRes] = await Promise.all([
    client.database.from('games').select('*').eq('id', gameId).single(),
    client.database.from('agent_states').select('*').eq('game_id', gameId),
    client.database
      .from('round_summaries')
      .select('*')
      .eq('game_id', gameId)
      .order('round_number', { ascending: true }),
    client.database
      .from('turns')
      .select('*')
      .eq('game_id', gameId)
      .order('round_number', { ascending: true }),
  ]);

  return jsonResponse({
    game: gameRes.data,
    agents: agentsRes.data,
    summaries: summariesRes.data,
    turns: turnsRes.data,
  });
}
