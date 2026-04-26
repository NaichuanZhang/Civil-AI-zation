import React from 'react';

export function BackgroundVideo() {
  return (
    <div className="absolute inset-0 w-full h-full z-0 overflow-hidden">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-cover"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4"
      />
      {/* Optional overlay to ensure text contrast if needed, but the prompt says no radial gradients or overlays.
          The background color in CSS is deep navy blue (201 100% 13%) which the video container sits in. */}
    </div>
  );
}
