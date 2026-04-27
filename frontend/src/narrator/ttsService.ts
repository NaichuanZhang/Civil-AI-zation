const ANON_KEY = import.meta.env.VITE_INSFORGE_ANON_KEY;
const VOICE_ID = import.meta.env.VITE_NARRATOR_VOICE_ID || 'cgSgspJ2msm6clMCkdW9';

function getFunctionsUrl(): string {
  const baseUrl = import.meta.env.VITE_INSFORGE_URL as string;
  const match = baseUrl.match(/https?:\/\/([^.]+)\./);
  const appKey = match ? match[1] : '';
  return `https://${appKey}.functions.insforge.app`;
}

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioContext();
  }
  return sharedAudioContext;
}

export function resumeAudioContext(): void {
  if (sharedAudioContext?.state === 'suspended') {
    sharedAudioContext.resume();
  }
}

export async function fetchTTSAudio(text: string): Promise<ArrayBuffer> {
  const url = `${getFunctionsUrl()}/narrator-tts`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ text, voiceId: VOICE_ID }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TTS fetch failed (${response.status}): ${errorText}`);
  }

  return response.arrayBuffer();
}

export async function convertMp3ToPcm16(
  mp3Buffer: ArrayBuffer,
  targetSampleRate = 16000,
): Promise<ArrayBuffer> {
  const ctx = getAudioContext();
  const audioBuffer = await ctx.decodeAudioData(mp3Buffer.slice(0));
  const sourceData = audioBuffer.getChannelData(0);
  const sourceSampleRate = audioBuffer.sampleRate;

  const ratio = sourceSampleRate / targetSampleRate;
  const outputLength = Math.floor(sourceData.length / ratio);
  const pcm16 = new ArrayBuffer(outputLength * 2);
  const view = new DataView(pcm16);

  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const srcFloor = Math.floor(srcIndex);
    const srcCeil = Math.min(srcFloor + 1, sourceData.length - 1);
    const fraction = srcIndex - srcFloor;

    const a = sourceData[srcFloor] ?? 0;
    const b = sourceData[srcCeil] ?? 0;
    const sample = a * (1 - fraction) + b * fraction;
    const clamped = Math.max(-1, Math.min(1, sample));
    const int16 = Math.round(clamped * 32767);
    view.setInt16(i * 2, int16, true);
  }

  return pcm16;
}

export function playMp3Audio(mp3Buffer: ArrayBuffer, volume: number): Promise<void> {
  return new Promise((resolve) => {
    const blob = new Blob([mp3Buffer], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = volume;

    const cleanup = () => URL.revokeObjectURL(url);

    const maxDuration = 30_000;
    const fallbackTimer = setTimeout(() => {
      cleanup();
      resolve();
    }, maxDuration);

    audio.onended = () => {
      clearTimeout(fallbackTimer);
      cleanup();
      resolve();
    };
    audio.onerror = () => {
      clearTimeout(fallbackTimer);
      cleanup();
      resolve();
    };
    audio.play().catch(() => {
      clearTimeout(fallbackTimer);
      cleanup();
      resolve();
    });
  });
}
