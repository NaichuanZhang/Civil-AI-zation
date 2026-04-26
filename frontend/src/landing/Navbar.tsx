import React from 'react';
import logoUrl from '@assets/logo.png';

export function Navbar() {
  return (
    <nav className="relative z-10 flex row justify-between items-center px-8 py-6 max-w-7xl mx-auto w-full">
      <div className="h-24 md:h-32 flex items-center">
        <img
          src={logoUrl}
          alt="civilAIzation"
          className="h-full w-auto object-contain drop-shadow-2xl"
        />
      </div>
    </nav>
  );
}
