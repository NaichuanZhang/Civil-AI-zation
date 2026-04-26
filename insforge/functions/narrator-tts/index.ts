const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const DEFAULT_VOICE_ID = 'cgSgspJ2msm6clMCkdW9';
const TTS_MODEL = 'eleven_v3';
const OUTPUT_FORMAT = 'mp3_44100_128';

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ELEVENLABS_API_KEY not configured' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  let text: string;
  let voiceId: string;
  try {
    const body = await req.json();
    text = body.text;
    voiceId = body.voiceId || DEFAULT_VOICE_ID;
    if (!text || typeof text !== 'string') {
      throw new Error('Missing or invalid "text" field');
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: `Invalid request body: ${(err as Error).message}` }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const ttsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const ttsResponse = await fetch(ttsUrl, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: TTS_MODEL,
      output_format: OUTPUT_FORMAT,
    }),
  });

  if (!ttsResponse.ok) {
    const errorText = await ttsResponse.text();
    return new Response(JSON.stringify({ error: `ElevenLabs API error: ${ttsResponse.status}`, details: errorText }), {
      status: ttsResponse.status === 429 ? 429 : 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const audioData = await ttsResponse.arrayBuffer();
  return new Response(audioData, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(audioData.byteLength),
    },
  });
}
