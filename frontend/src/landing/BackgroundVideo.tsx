import React from 'react';

import backgroundVideo from '@assets/civAI_video_output.mp4';

export function BackgroundVideo() {
  return (
    <div className="absolute inset-0 w-full h-full z-0 overflow-hidden">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-cover"
        src={backgroundVideo}
      />
      {/* Optional overlay to ensure text contrast if needed, but the prompt says no radial gradients or overlays.
          The background color in CSS is deep navy blue (201 100% 13%) which the video container sits in. */}
    </div>
  );
}
