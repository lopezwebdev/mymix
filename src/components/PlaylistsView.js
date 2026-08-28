import { renderSVG } from '../utils/svg.js';

export function renderPlaylistsView(playlists, activePlaylistId) {
  return `
    <div class="view-content">
      <div class="glass-card">
        <div class="card-header">
          <span class="section-title">Your Curated Playlists</span>
          <span class="badge">${playlists.length} Playlists</span>
        </div>

        ${
          playlists.length === 0
            ? `<div style="text-align:center; padding: 30px 20px; color: var(--text-muted);">
                No saved playlists yet.<br>Go to the <b>Smart Curator</b> tab to build and save custom flow playlists!
               </div>`
            : `<div style="display: flex; flex-direction: column; gap: 12px;">
                ${playlists.map((p) => `
                  <div class="track-item ${p.id === activePlaylistId ? 'active' : ''}" style="cursor: default;">
                    <div class="brand-icon" style="width: 48px; height: 48px; flex-shrink: 0; background: var(--accent-gradient);">
                      ${renderSVG('disc', 22)}
                    </div>
                    <div class="track-info">
                      <div class="track-title">${p.title}</div>
                      <div class="track-artist">${p.tracks.length} Tracks • Flow: ${p.flowMode || 'Harmonic'}</div>
                      <div class="track-meta-pills" style="margin-top: 4px;">
                        <span class="pill pill-bpm">${p.rules?.minBpm || 60}-${p.rules?.maxBpm || 180} BPM</span>
                        <span class="pill pill-energy">⚡ Energy ${p.rules?.minEnergy || 1}-${p.rules?.maxEnergy || 10}</span>
                      </div>
                    </div>
                    <div class="track-actions">
                      <button class="btn-icon btn-play-playlist" data-playlist-id="${p.id}" title="Play Playlist">
                        ${renderSVG('play', 18)}
                      </button>
                      <button class="btn-icon btn-delete-playlist" data-playlist-id="${p.id}" title="Delete Playlist">
                        ${renderSVG('trash', 16)}
                      </button>
                    </div>
                  </div>
                `).join('')}
               </div>`
        }
      </div>
    </div>
  `;
}
