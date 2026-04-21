// AppBackground.jsx — replaces legacy <AppBackground /> with the Arena backdrop.
// Floating color orbs + grid + vignette + subtle scanlines, driven by CSS.
import React from 'react';

export function AppBackground({ scanlines = true }) {
  return (
    <div className="fp-bg" aria-hidden="true">
      <div className="fp-bg-orb fp-bg-orb-1" />
      <div className="fp-bg-orb fp-bg-orb-2" />
      <div className="fp-bg-orb fp-bg-orb-3" />
      <div className="fp-bg-grid" />
      <div className="fp-bg-vignette" />
      {scanlines && <div className="fp-bg-scanlines" />}
    </div>
  );
}
