import React from 'react';
import { Navbar } from './Navbar';
import { Hero } from './Hero';
import { BackgroundVideo } from './BackgroundVideo';
import './landing.css';

export function LandingPage() {
  return (
    <main className="landing-root relative min-h-screen w-full overflow-x-hidden flex flex-col items-center">
      {/* Background Video Layer */}
      <BackgroundVideo />

      {/* Content Layer */}
      <div className="relative z-10 w-full flex flex-col min-h-screen">
        <Navbar />

        {/* Positioned Hero Content in the bottom half - moved lower */}
        <div className="flex-1 flex items-end justify-center pb-8">
          <Hero />
        </div>
      </div>
    </main>
  );
}
