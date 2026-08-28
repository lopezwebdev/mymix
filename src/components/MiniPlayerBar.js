import { renderSVG } from '../utils/svg.js';

export function renderMiniPlayerBar(track, isPlaying) {
  if (!track) {
    return `
      <div class="mini-player" id="mini-player" style="display: none;"></div>
    `;
  }

  return `
    <div class="mini-player" id="mini-player">
      <img class="mini-art ${isPlaying ? 'spinning' : ''}" src="${track.artworkUrl || '/icons/icon-512.jpg'}" alt="${track.title}" />
      <div class="mini-details" id="mini-player-details">
        <div class="mini-title">${track.title}</div>
        <div class="mini-artist">${track.artist}</div>
      </div>
      <div class="mini-controls">
        <button class="btn-icon" id="mini-btn-prev" title="Previous Track">
          ${renderSVG('skipPrev', 16)}
        </button>
        <button class="btn-icon" id="mini-btn-play" title="Play/Pause">
          ${isPlaying ? renderSVG('pause', 18) : renderSVG('play', 18)}
        </button>
        <button class="btn-icon" id="mini-btn-next" title="Next Track">
          ${renderSVG('skipNext', 16)}
        </button>
      </div>
    </div>
  `;
}
