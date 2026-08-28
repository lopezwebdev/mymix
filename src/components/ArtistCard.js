import { renderSVG } from '../utils/svg.js';

export function renderArtistCard(artistGroup, isCurrentArtistPlaying) {
  const { artist, albums, tracks, artworkUrl } = artistGroup;
  const albumText = albums.length > 0 ? albums.join(', ') : 'Single / Collection';

  return `
    <div class="glass-card artist-card" data-artist="${artist}" style="padding: 16px; transition: transform 0.2s ease, border-color 0.2s ease;">
      <!-- Top Row: Artwork + Artist Name & Albums -->
      <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 12px;">
        <img src="${artworkUrl || tracks[0]?.artworkUrl || '/icons/icon-512.jpg'}" alt="${artist}" style="width: 56px; height: 56px; border-radius: var(--radius-md); object-fit: cover; flex-shrink: 0; box-shadow: 0 4px 12px rgba(0,0,0,0.4);" />
        
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <h3 class="section-title" style="font-size: 1.1rem; margin: 0; word-break: break-word; line-height: 1.3;">${artist}</h3>
            ${isCurrentArtistPlaying ? `<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: var(--accent-emerald); border-color: rgba(16, 185, 129, 0.4); padding: 2px 6px; font-size: 0.65rem;">▶ Playing</span>` : ''}
          </div>
          
          <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            📁 ${albumText}
          </div>
        </div>
      </div>

      <!-- Bottom Row: Meta Pills + Action Buttons (Dedicated row, zero overlap!) -->
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-top: 10px; border-top: 1px solid var(--border-glass);">
        <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
          <span class="pill pill-bpm" style="font-size: 0.7rem; padding: 3px 8px;">${tracks.length} ${tracks.length === 1 ? 'Track' : 'Tracks'}</span>
          <span class="pill pill-key" style="font-size: 0.7rem; padding: 3px 8px;">${tracks[0]?.key || '8A'}</span>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
          <button class="btn-primary btn-random-artist" data-artist="${artist}" title="Pick Random Track" style="padding: 7px 14px; font-size: 0.78rem; gap: 6px; border-radius: var(--radius-full);">
            🎲 Pick Random
          </button>
          <button class="btn-icon btn-rename-artist" data-artist="${artist}" title="Rename Artist" style="width: 36px; height: 36px;">
            ✏️
          </button>
          <button class="btn-icon btn-expand-artist" data-artist="${artist}" title="View Tracks" style="width: 36px; height: 36px;">
            ${renderSVG('disc', 16)}
          </button>
        </div>
      </div>
    </div>
  `;
}

export function renderArtistDrawerModal(artistGroup, currentTrackId, isPlaying) {
  if (!artistGroup) return '';
  const { artist, albums, tracks } = artistGroup;

  return `
    <div class="player-drawer" id="artist-drawer" style="display: flex; transform: translateY(0); z-index: 90;">
      <div class="drawer-header">
        <button class="btn-icon" id="btn-close-artist-drawer" title="Close Artist View">
          ${renderSVG('chevronDown', 24)}
        </button>
        <span class="section-title" style="font-size: 1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px;">${artist}</span>
        <button class="btn-primary btn-random-artist" data-artist="${artist}" style="padding: 6px 12px; font-size: 0.78rem;">
          🎲 Random Track
        </button>
      </div>

      <div class="glass-card" style="margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div class="brand-icon" style="width: 52px; height: 52px; flex-shrink: 0; background: var(--accent-gradient);">
            ${renderSVG('disc', 24)}
          </div>
          <div style="min-width: 0; flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <h3 style="font-family: var(--font-heading); font-size: 1.15rem; font-weight: 700; word-break: break-word;">${artist}</h3>
              <button class="btn-icon btn-rename-artist" data-artist="${artist}" style="width: 28px; height: 28px; font-size: 0.75rem;" title="Rename Artist">
                ✏️
              </button>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">${tracks.length} Tracks in ${albums.join(', ') || 'Collection'}</p>
          </div>
        </div>
      </div>

      <div class="glass-card">
        <div class="card-header">
          <span class="section-title">Tracks by ${artist}</span>
          <span class="badge">Tap to Play</span>
        </div>

        <div class="track-list">
          ${tracks.map((t) => `
            <div class="track-item ${t.id === currentTrackId ? 'active' : ''}" data-track-id="${t.id}">
              <img class="track-art" src="${t.artworkUrl || '/icons/icon-512.jpg'}" alt="${t.title}" />
              <div class="track-info">
                <div class="track-title">${t.title}</div>
                <div class="track-artist">${t.album || artist}</div>
                <div class="track-meta-pills">
                  <span class="pill pill-bpm">${t.bpm || 120} BPM</span>
                  <span class="pill pill-energy">⚡ Energy ${t.energy || 5}/10</span>
                  <span class="pill pill-key">${t.key || '8A'}</span>
                </div>
              </div>
              <div class="track-actions">
                <button class="btn-icon btn-play-track" data-track-id="${t.id}">
                  ${t.id === currentTrackId && isPlaying ? renderSVG('pause', 16) : renderSVG('play', 16)}
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}
