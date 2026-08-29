import { renderSVG } from '../utils/svg.js';

export function renderFullPlayerDrawer(track, isPlaying, currentTime = 0, duration = 1, eqValues = [0, 0, 0, 0, 0]) {
  const currentTitle = track ? track.title : 'No Track Selected';
  const currentArtist = track ? track.artist : 'Choose a track to play';
  const artwork = track ? (track.artworkUrl || '/icons/icon-512.jpg') : '/icons/icon-512.jpg';

  const formatTime = (secs) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return `
    <div class="player-drawer" id="player-drawer">
      <div class="drawer-header">
        <button class="btn-icon" id="btn-close-drawer" title="Collapse Player">
          ${renderSVG('chevronDown', 24)}
        </button>
        <span class="section-title" style="font-size: 1rem;">Now Playing</span>
        <div style="width: 40px;"></div>
      </div>

      <!-- Hero Artwork -->
      <div class="hero-art-container">
        <img class="hero-art ${isPlaying ? 'spinning' : ''}" src="${artwork}" alt="${currentTitle}" />
      </div>

      <!-- Track Info & Metadata -->
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="font-family: var(--font-heading); font-size: 1.4rem; font-weight: 700; margin-bottom: 4px;">${currentTitle}</h2>
        <p style="color: var(--text-muted); font-size: 0.9rem;">${currentArtist}</p>
        ${
          track
            ? `<div class="track-meta-pills" style="justify-content: center; margin-top: 10px;">
                <span class="pill pill-bpm">${track.bpm || 120} BPM</span>
                <span class="pill pill-energy">⚡ Energy ${track.energy || 5}/10</span>
                <span class="pill pill-key">${track.key || '8A / Am'}</span>
               </div>`
            : ''
        }
      </div>

      <!-- Real-Time Audio Visualizer Canvas -->
      <canvas class="visualizer-canvas" id="player-visualizer" width="340" height="60"></canvas>

      <!-- Scrub Bar -->
      <div class="scrub-container">
        <input type="range" id="player-scrubber" min="0" max="${duration}" value="${currentTime}" step="0.1" />
        <div class="time-row">
          <span id="time-current">${formatTime(currentTime)}</span>
          <span id="time-duration">${formatTime(duration)}</span>
        </div>
      </div>

      <!-- Transport Controls -->
      <div class="main-controls">
        <button class="btn-icon" id="btn-player-prev" title="Previous Track">
          ${renderSVG('skipPrev', 22)}
        </button>
        <button class="btn-play-lg" id="btn-player-play" title="Play/Pause">
          ${isPlaying ? renderSVG('pause', 28) : renderSVG('play', 28)}
        </button>
        <button class="btn-icon" id="btn-player-next" title="Next Track">
          ${renderSVG('skipNext', 22)}
        </button>
      </div>

    </div>
  `;
}
