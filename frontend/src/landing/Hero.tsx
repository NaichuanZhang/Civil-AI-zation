import React from 'react';

export function Hero() {
  return (
    <section className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-32 pb-40 py-[90px]">
      <button
        type="button"
        className="liquid-glass rounded-full px-14 py-5 text-base text-[hsl(var(--foreground))] mt-12 transition-transform hover:scale-[1.03] cursor-pointer animate-[fade-rise_0.8s_ease-out_0.4s_both]"
      >
        play
      </button>
    </section>
  );
}
