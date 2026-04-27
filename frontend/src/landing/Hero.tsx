import { useNavigate } from 'react-router-dom';
import glmLogoUrl from '@assets/logo/glm.png';
import gptLogoUrl from '@assets/logo/gpt.png';
import claudeLogoUrl from '@assets/logo/claude.png';

const CONTESTANTS = [
  { name: 'GLM-5 Turbo', logo: glmLogoUrl, color: '#8b5cf6' },
  { name: 'GPT-4o Mini', logo: gptLogoUrl, color: '#3b82f6' },
  { name: 'Claude Haiku', logo: claudeLogoUrl, color: '#22c55e' },
];

export function Hero() {
  const navigate = useNavigate();

  return (
    <section className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-32 pb-40 py-[90px]">
      <button
        type="button"
        onClick={() => navigate('/game')}
        className="liquid-glass rounded-full px-14 py-5 text-base text-[hsl(var(--foreground))] mt-12 transition-transform hover:scale-[1.03] cursor-pointer animate-[fade-rise_0.8s_ease-out_0.4s_both]"
      >
        play
      </button>

      <div className="flex items-center gap-8 mt-10 animate-[fade-rise_0.8s_ease-out_0.6s_both]">
        {CONTESTANTS.map((c) => (
          <div key={c.name} className="flex flex-col items-center gap-2">
            <img
              src={c.logo}
              alt={c.name}
              className="w-14 h-14 rounded-full object-cover"
              style={{ border: `3px solid ${c.color}`, backgroundColor: 'rgba(255,255,255,0.1)' }}
            />
            <span className="text-xs font-semibold" style={{ color: c.color }}>
              {c.name}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
