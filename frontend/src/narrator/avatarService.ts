const ANON_KEY = import.meta.env.VITE_INSFORGE_ANON_KEY;
const APP_ID = import.meta.env.VITE_SPATIALREAL_APP_ID;
const AVATAR_ID = import.meta.env.VITE_NARRATOR_AVATAR_ID;

function getFunctionsUrl(): string {
  const baseUrl = import.meta.env.VITE_INSFORGE_URL as string;
  const match = baseUrl.match(/https?:\/\/([^.]+)\./);
  const appKey = match ? match[1] : '';
  return `https://${appKey}.functions.insforge.app`;
}

const PCM_CHUNK_SIZE = 4096;
const PCM_SAMPLE_RATE = 16000;
const BYTES_PER_SAMPLE = 2;
const CHUNK_DURATION_MS = (PCM_CHUNK_SIZE / BYTES_PER_SAMPLE / PCM_SAMPLE_RATE) * 1000;

interface AvatarController {
  initializeAudioContext(): Promise<void>;
  start(): Promise<void>;
  send(data: ArrayBuffer, end: boolean): string;
  close(): void;
  onConnectionState: ((state: string) => void) | null;
  onConversationState: ((state: string) => void) | null;
  onError: ((error: { code: string; message: string }) => void) | null;
}

interface AvatarViewInstance {
  controller: AvatarController;
  dispose(): void;
}

let avatarView: AvatarViewInstance | null = null;
let sdkModule: Record<string, unknown> | null = null;

async function loadSdk(): Promise<Record<string, unknown>> {
  if (sdkModule) return sdkModule;
  try {
    sdkModule = await import('@spatialwalk/avatarkit');
    return sdkModule;
  } catch {
    throw new Error('SpatialReal SDK not available');
  }
}

async function fetchSessionToken(): Promise<string> {
  const url = `${getFunctionsUrl()}/narrator-auth`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
    },
    body: '{}',
  });

  if (!response.ok) {
    throw new Error(`Session token fetch failed: ${response.status}`);
  }

  const data = await response.json();
  return data.sessionToken;
}

let audioContextInitialized = false;

export async function prepareAvatarAudio(): Promise<void> {
  if (audioContextInitialized || !avatarView) return;
  try {
    await avatarView.controller.initializeAudioContext();
    audioContextInitialized = true;
  } catch {
    // will retry on next user gesture
  }
}

export async function initializeAvatar(
  container: HTMLElement,
): Promise<AvatarController> {
  if (!APP_ID || !AVATAR_ID) {
    throw new Error('VITE_SPATIALREAL_APP_ID or VITE_NARRATOR_AVATAR_ID not configured');
  }

  const sdk = await loadSdk();
  const AvatarSDK = sdk.AvatarSDK as {
    initialize(appId: string, config: Record<string, unknown>): Promise<void>;
    setSessionToken(token: string): void;
  };
  const AvatarManager = sdk.AvatarManager as {
    shared: { load(id: string, onProgress?: (p: { progress: number }) => void): Promise<unknown> };
  };
  const AvatarView = sdk.AvatarView as {
    new (avatar: unknown, container: HTMLElement): AvatarViewInstance;
  };
  const Environment = sdk.Environment as Record<string, string>;
  const DrivingServiceMode = sdk.DrivingServiceMode as Record<string, string>;

  await AvatarSDK.initialize(APP_ID, {
    environment: Environment.intl,
    drivingServiceMode: DrivingServiceMode.sdk,
    audioFormat: { channelCount: 1, sampleRate: PCM_SAMPLE_RATE },
  });

  const sessionToken = await fetchSessionToken();
  AvatarSDK.setSessionToken(sessionToken);

  const avatar = await AvatarManager.shared.load(AVATAR_ID);
  if (!avatar) {
    throw new Error(`Failed to load avatar: ${AVATAR_ID}`);
  }

  avatarView = new AvatarView(avatar, container);
  await avatarView.controller.start();

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Avatar connection timeout')), 10_000);
    avatarView!.controller.onConnectionState = (state: string) => {
      if (state === 'connected') {
        clearTimeout(timeout);
        resolve();
      } else if (state === 'failed') {
        clearTimeout(timeout);
        reject(new Error('Avatar connection failed'));
      }
    };
  });

  return avatarView.controller;
}

export function sendAudioToAvatar(
  controller: AvatarController,
  pcm16Buffer: ArrayBuffer,
): Promise<void> {
  return new Promise((resolve) => {
    const totalChunks = Math.ceil(pcm16Buffer.byteLength / PCM_CHUNK_SIZE);
    let chunkIndex = 0;

    function sendNextChunk() {
      if (chunkIndex >= totalChunks) {
        resolve();
        return;
      }

      const offset = chunkIndex * PCM_CHUNK_SIZE;
      const end = Math.min(offset + PCM_CHUNK_SIZE, pcm16Buffer.byteLength);
      const chunk = pcm16Buffer.slice(offset, end);
      const isLast = chunkIndex === totalChunks - 1;

      controller.send(chunk, isLast);
      chunkIndex++;

      if (isLast) {
        resolve();
      } else {
        setTimeout(sendNextChunk, CHUNK_DURATION_MS);
      }
    }

    sendNextChunk();
  });
}

export function destroyAvatar(): void {
  if (avatarView) {
    avatarView.controller.close();
    avatarView.dispose();
    avatarView = null;
  }
  sdkModule = null;
  audioContextInitialized = false;
}

export function isAvatarConfigured(): boolean {
  return !!(APP_ID && AVATAR_ID);
}
