import { createClient } from '@insforge/sdk';

const baseUrl = import.meta.env.VITE_INSFORGE_URL;
const anonKey = import.meta.env.VITE_INSFORGE_ANON_KEY;

console.log('[insforge] Initializing client with:', {
  baseUrl: baseUrl || 'MISSING',
  anonKeyPresent: !!anonKey,
});

export const insforge = createClient({
  baseUrl,
  anonKey,
});
