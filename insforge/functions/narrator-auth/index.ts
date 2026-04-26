const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const SESSION_TOKEN_URL = 'https://console.us-west.spatialwalk.cloud/v1/console/session-tokens';
const DEFAULT_EXPIRE_MINUTES = 60;

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405);
  }

  const apiKey = Deno.env.get('SPATIALREAL_API_KEY');
  if (!apiKey) {
    return jsonError('SPATIALREAL_API_KEY not configured', 500);
  }

  const expireAt = Math.floor(Date.now() / 1000) + DEFAULT_EXPIRE_MINUTES * 60;

  const response = await fetch(SESSION_TOKEN_URL, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expireAt }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return jsonError(`SpatialReal API error: ${response.status} - ${errorText}`, 502);
  }

  const data = await response.json();
  const sessionToken = data.sessionToken || data.session_token || data.token;
  if (!sessionToken) {
    return jsonError(`Unexpected SpatialReal response: ${JSON.stringify(data)}`, 502);
  }
  return new Response(JSON.stringify({ sessionToken }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
