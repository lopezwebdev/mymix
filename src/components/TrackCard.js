import { renderSVG } from '../utils/svg.js';

export function renderTrackCard(track, currentTrackId, isPlaying) {
  const isCurrent = track.id === currentTrackId;

  return `
    <div class="track-item ${isCurrent ? 'active' : ''}" data-track-id="${track.id}">
      <img class="track-art" src="${track.artworkUrl || '/icons/icon-512.jpg'}" alt="${track.title}" />
      <div class="track-info">
        <div class="track-title">${track.title}</div>
        <div class="track-artist">${track.artist}</div>
        <div class="track-meta-pills">
          <span class="pill pill-bpm">${track.bpm || 120} BPM</span>
          <span class="pill pill-energy">⚡ Energy ${track.energy || 5}/10</span>
          <span class="pill pill-key">${track.key || '8A / Am'}</span>
          ${(track.tags || []).map(t => `<span class="pill">${t}</span>`).join('')}
        </div>
      </div>
      <div class="track-actions">
        <button class="btn-icon btn-play-track" data-track-id="${track.id}" title="Play Track">
          ${isCurrent && isPlaying ? renderSVG('pause', 16) : renderSVG('play', 16)}
        </button>
        <button class="btn-icon btn-delete-track" data-track-id="${track.id}" title="Delete Track">
          ${renderSVG('trash', 16)}
        </button>
      </div>
    </div>
  `;
}
