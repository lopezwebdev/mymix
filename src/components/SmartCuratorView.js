import { renderTrackCard } from './TrackCard.js';
import { renderSVG } from '../utils/svg.js';

export function renderSmartCuratorView(curatedTracks, rules, currentTrackId, isPlaying) {
  const {
    minBpm = 60,
    maxBpm = 180,
    minEnergy = 1,
    maxEnergy = 10,
    flowMode = 'harmonic',
    selectedMood = 'All'
  } = rules;

  const moods = ['All', 'Energetic', 'Relaxed', 'Ethereal', 'Cozy'];

  return `
    <div class="view-content">
      <!-- Curation Rules Card -->
      <div class="glass-card">
        <div class="card-header">
          <span class="section-title">Smart Curation Studio</span>
          <span class="badge">${renderSVG('zap', 14)} Specific Taste Engine</span>
        </div>

        <div class="curator-grid">
          <!-- BPM Range Slider -->
          <div class="rule-box">
            <span class="rule-label">Tempo / BPM Range</span>
            <div class="range-slider-group">
              <span class="slider-val" id="val-bpm">${minBpm} - ${maxBpm} BPM</span>
              <input type="range" id="slider-min-bpm" min="50" max="200" value="${minBpm}" />
              <input type="range" id="slider-max-bpm" min="50" max="200" value="${maxBpm}" />
            </div>
          </div>

          <!-- Energy Level Slider -->
          <div class="rule-box">
            <span class="rule-label">Energy Level</span>
            <div class="range-slider-group">
              <span class="slider-val" id="val-energy">${minEnergy} - ${maxEnergy} / 10</span>
              <input type="range" id="slider-min-energy" min="1" max="10" value="${minEnergy}" />
              <input type="range" id="slider-max-energy" min="1" max="10" value="${maxEnergy}" />
            </div>
          </div>
        </div>

        <!-- Mood Selector Pills -->
        <div style="margin-top: 16px;">
          <span class="rule-label" style="display:block; margin-bottom: 8px;">Target Mood Vibe</span>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${moods.map((m) => `
              <button class="pill ${selectedMood === m ? 'pill-bpm' : ''} btn-mood-pill" data-mood="${m}" style="padding: 6px 14px; font-size: 0.82rem; cursor: pointer;">
                ${m}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Flow Ordering Selector -->
        <div style="margin-top: 16px;">
          <span class="rule-label" style="display:block; margin-bottom: 8px;">Transition Flow Strategy</span>
          <div class="flow-switch">
            <button class="flow-btn ${flowMode === 'harmonic' ? 'active' : ''}" data-flow="harmonic">
              ${renderSVG('disc', 16)} 
              <div>
                <div>Harmonic Key Flow (Camelot Wheel)</div>
                <div style="font-size:0.72rem; color:var(--text-muted);">Seamless key transitions between tracks</div>
              </div>
            </button>

            <button class="flow-btn ${flowMode === 'tempo_asc' ? 'active' : ''}" data-flow="tempo_asc">
              ${renderSVG('zap', 16)} 
              <div>
                <div>Tempo Acceleration Ramp</div>
                <div style="font-size:0.72rem; color:var(--text-muted);">Gradually increases BPM speed track by track</div>
              </div>
            </button>

            <button class="flow-btn ${flowMode === 'energy_ramp' ? 'active' : ''}" data-flow="energy_ramp">
              ${renderSVG('sliders', 16)} 
              <div>
                <div>Energy Build-Up</div>
                <div style="font-size:0.72rem; color:var(--text-muted);">Starts ambient/chill, climaxes at high intensity</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- Curated Track Results & Actions -->
      <div class="glass-card">
        <div class="card-header">
          <span class="section-title">Curated Track Sequence</span>
          <div style="display: flex; gap: 8px;">
            <button class="btn-primary" id="btn-play-curated" style="padding: 6px 14px; font-size: 0.82rem;">
              ${renderSVG('play', 14)} Play Flow (${curatedTracks.length})
            </button>
            <button class="btn-icon" id="btn-save-playlist" title="Save as Playlist">
              ${renderSVG('plus', 16)}
            </button>
          </div>
        </div>

        <div class="track-list">
          ${
            curatedTracks.length === 0
              ? `<div style="text-align:center; padding: 20px; color: var(--text-muted);">No tracks match these curation rules. Try expanding BPM or Energy ranges!</div>`
              : curatedTracks.map((t) => renderTrackCard(t, currentTrackId, isPlaying)).join('')
          }
        </div>
      </div>
    </div>
  `;
}
