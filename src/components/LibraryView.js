import { renderTrackCard } from './TrackCard.js';
import { renderArtistCard } from './ArtistCard.js';
import { groupTracksByArtist } from '../services/tagParser.js';

export function renderLibraryView(tracks, currentTrackId, isPlaying, libraryMode = 'artist') {
  const artistGroups = groupTracksByArtist(tracks);

  return `
    <div class="view-content">
      <!-- Hidden File Input triggered by + Add Music header button -->
      <input type="file" id="file-input" accept="audio/*, .mp3, .m4a, .aac, .flac, .wav, .ogg, .aiff, .alac, .m4b, audio/mpeg, audio/mp4, audio/x-m4a, audio/flac, audio/wav, *" multiple style="display:none;" />

      <!-- Mode Switcher (Artist Cards vs All Tracks) -->
      <div style="display: flex; gap: 8px; margin-bottom: 4px;">
        <button class="pill ${libraryMode === 'artist' ? 'pill-bpm' : ''} btn-lib-mode" data-mode="artist" style="padding: 8px 16px; font-size: 0.85rem; cursor: pointer;">
          👤 Grouped by Artist Cards (${artistGroups.length})
        </button>
        <button class="pill ${libraryMode === 'tracks' ? 'pill-bpm' : ''} btn-lib-mode" data-mode="tracks" style="padding: 8px 16px; font-size: 0.85rem; cursor: pointer;">
          🎵 All Individual Tracks (${tracks.length})
        </button>
      </div>

      <!-- Library Cards / Track List -->
      ${
        libraryMode === 'artist'
          ? `<div style="display: flex; flex-direction: column; gap: 14px;">
              ${
                artistGroups.length === 0
                  ? `<div class="glass-card" style="text-align:center; padding: 30px 20px; color: var(--text-muted);">
                      No artists found. Tap <b>+ Add Music</b> at the top right to upload your tracks!
                    </div>`
                  : artistGroups.map((grp) => {
                      const isCurrentGroupPlaying = grp.tracks.some((t) => t.id === currentTrackId && isPlaying);
                      return renderArtistCard(grp, isCurrentGroupPlaying);
                    }).join('')
              }
             </div>`
          : `<div class="glass-card">
              <div class="card-header">
                <span class="section-title">All Individual Tracks</span>
                <span class="badge">${tracks.length} Tracks</span>
              </div>
              
              <div class="track-list" id="library-track-list">
                ${
                  tracks.length === 0
                    ? `<div style="text-align:center; padding: 20px; color: var(--text-muted);">No tracks in library.</div>`
                    : tracks.map((t) => renderTrackCard(t, currentTrackId, isPlaying)).join('')
                }
              </div>
            </div>`
      }
    </div>
  `;
}
