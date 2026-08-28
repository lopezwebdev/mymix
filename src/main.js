import { dbService } from './services/db.js';
import { audioEngine } from './services/audioEngine.js';
import { curatorEngine } from './services/curatorEngine.js';
import { generatePresetTracks } from './services/synthAudio.js';
import { parseFilenameMetadata, groupTracksByArtist } from './services/tagParser.js';

import { renderHeader } from './components/Header.js';
import { renderLibraryView } from './components/LibraryView.js';
import { renderSmartCuratorView } from './components/SmartCuratorView.js';
import { renderPlaylistsView } from './components/PlaylistsView.js';
import { renderMiniPlayerBar } from './components/MiniPlayerBar.js';
import { renderFullPlayerDrawer } from './components/FullPlayerDrawer.js';
import { renderInstallGuideModal } from './components/InstallGuideModal.js';
import { renderArtistDrawerModal } from './components/ArtistCard.js';
import { renderSVG } from './utils/svg.js';

// Application State
const state = {
  tracks: [],
  playlists: [],
  activeTab: 'library', // 'library' | 'curator' | 'playlists'
  libraryMode: 'artist', // 'artist' (grouped cards) | 'tracks' (all list)
  selectedArtist: null, // Artist group opened in drawer
  curationRules: {
    minBpm: 60,
    maxBpm: 180,
    minEnergy: 1,
    maxEnergy: 10,
    flowMode: 'harmonic',
    selectedMood: 'All'
  },
  settings: {
    crossfade: 3,
    eq: [0, 0, 0, 0, 0]
  },
  isDrawerOpen: false,
  isInstallGuideOpen: false,
  currentTime: 0,
  duration: 1
};

async function init() {
  registerServiceWorker();

  // Load state from IndexedDB
  let tracks = await dbService.getAllTracks();
  if (tracks.length === 0) {
    // Generate high-quality procedural demo tracks on first launch
    tracks = await generatePresetTracks();
    for (const trk of tracks) {
      await dbService.saveTrack(trk);
    }
  }
  state.tracks = tracks;
  state.playlists = await dbService.getPlaylists();
  state.settings = await dbService.getSettings();

  audioEngine.setCrossfade(state.settings.crossfade);

  // Subscribe to audio engine updates
  audioEngine.subscribe('timeUpdate', ({ currentTime, duration }) => {
    state.currentTime = currentTime;
    state.duration = duration || 1;
    updateTimeDisplay();
  });

  audioEngine.subscribe('playStateChange', () => {
    renderApp();
  });

  audioEngine.subscribe('trackChange', () => {
    renderApp();
  });

  renderApp();
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service Worker registration failed:', err);
    });
  }
}

function getFilteredAndCuratedTracks() {
  const rules = { ...state.curationRules };
  if (rules.selectedMood === 'All') delete rules.selectedMood;

  const filtered = curatorEngine.filterTracks(state.tracks, {
    minBpm: rules.minBpm,
    maxBpm: rules.maxBpm,
    minEnergy: rules.minEnergy,
    maxEnergy: rules.maxEnergy,
    selectedMoods: rules.selectedMood ? [rules.selectedMood] : []
  });

  return curatorEngine.sequenceTracks(filtered, rules.flowMode);
}

function renderApp() {
  const appContainer = document.getElementById('app');
  const currentTrack = audioEngine.currentTrack;
  const isPlaying = audioEngine.isPlaying;
  const curated = getFilteredAndCuratedTracks();
  const artistGroups = groupTracksByArtist(state.tracks);
  const selectedGroup = state.selectedArtist ? artistGroups.find((g) => g.artist === state.selectedArtist) : null;

  appContainer.innerHTML = `
    ${renderHeader()}

    <!-- Nav Tabs -->
    <nav class="app-tabs">
      <button class="tab-btn ${state.activeTab === 'library' ? 'active' : ''}" data-tab="library">
        ${renderSVG('music', 16)} Library
      </button>
      <button class="tab-btn ${state.activeTab === 'curator' ? 'active' : ''}" data-tab="curator">
        ${renderSVG('sliders', 16)} Smart Curator
      </button>
      <button class="tab-btn ${state.activeTab === 'playlists' ? 'active' : ''}" data-tab="playlists">
        ${renderSVG('disc', 16)} Playlists
      </button>
    </nav>

    <!-- Main View Content -->
    <main id="main-view">
      ${
        state.activeTab === 'library'
          ? renderLibraryView(state.tracks, currentTrack?.id, isPlaying, state.libraryMode)
          : state.activeTab === 'curator'
          ? renderSmartCuratorView(curated, state.curationRules, currentTrack?.id, isPlaying)
          : renderPlaylistsView(state.playlists, null)
      }
    </main>

    <!-- Persistent Mini Player Bar -->
    ${renderMiniPlayerBar(currentTrack, isPlaying)}

    <!-- Slide-Up Full Player Drawer -->
    ${renderFullPlayerDrawer(currentTrack, isPlaying, state.currentTime, state.duration, state.settings.crossfade, state.settings.eq)}

    <!-- iOS Install Guide Modal -->
    ${renderInstallGuideModal()}

    <!-- Artist Tracks Drawer Modal -->
    ${selectedGroup ? renderArtistDrawerModal(selectedGroup, currentTrack?.id, isPlaying) : ''}
  `;

  attachEventHandlers();

  // Attach visualizer canvas to Audio Engine if player drawer open
  if (state.isDrawerOpen) {
    const canvas = document.getElementById('player-visualizer');
    if (canvas) audioEngine.attachVisualizer(canvas);
    const drawer = document.getElementById('player-drawer');
    if (drawer) drawer.classList.add('open');
  }
}

function attachEventHandlers() {
  // Navigation Tabs
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      state.activeTab = e.currentTarget.dataset.tab;
      renderApp();
    });
  });

  // Library Mode Switcher (Artist Cards vs All Tracks)
  document.querySelectorAll('.btn-lib-mode').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      state.libraryMode = e.currentTarget.dataset.mode;
      renderApp();
    });
  });

  // Rename Artist Group Handler
  document.querySelectorAll('.btn-rename-artist').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const oldArtist = btn.dataset.artist;
      const newArtist = prompt(`Rename artist group "${oldArtist}" to:`, oldArtist);
      if (newArtist && newArtist.trim() !== '' && newArtist !== oldArtist) {
        const cleanName = newArtist.trim();
        for (const trk of state.tracks) {
          if (trk.artist === oldArtist) {
            trk.artist = cleanName;
            await dbService.saveTrack(trk);
          }
        }
        if (state.selectedArtist === oldArtist) {
          state.selectedArtist = cleanName;
        }
        renderApp();
      }
    });
  });

  // Artist Card Click -> Open Artist Drawer
  document.querySelectorAll('.artist-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      // Ignore if random button clicked
      if (e.target.closest('.btn-random-artist')) return;
      const artist = card.dataset.artist;
      state.selectedArtist = artist;
      renderApp();
    });
  });

  // Random Track Picker per Artist
  document.querySelectorAll('.btn-random-artist').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const artist = btn.dataset.artist;
      const artistGroups = groupTracksByArtist(state.tracks);
      const group = artistGroups.find((g) => g.artist === artist);
      if (group && group.tracks.length > 0) {
        // Pick a random track from this artist
        const randomIdx = Math.floor(Math.random() * group.tracks.length);
        audioEngine.setQueue(group.tracks, randomIdx);
        toggleDrawer(true);
      }
    });
  });

  // Close Artist Drawer
  document.getElementById('btn-close-artist-drawer')?.addEventListener('click', () => {
    state.selectedArtist = null;
    renderApp();
  });

  // Header Actions
  document.getElementById('btn-add-track')?.addEventListener('click', () => {
    document.getElementById('file-input')?.click();
  });

  document.getElementById('btn-install-guide')?.addEventListener('click', () => {
    toggleInstallModal(true);
  });

  // Upload Dropzone & Smart File Parsing
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');

  dropzone?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      // Smart infer Artist, Album, Title from filename
      const parsed = parseFilenameMetadata(file.name);

      // Get audio duration
      let duration = 180;
      try {
        const audioUrl = URL.createObjectURL(file);
        const tempAudio = new Audio();
        tempAudio.src = audioUrl;
        await new Promise((res) => {
          tempAudio.onloadedmetadata = () => {
            duration = Math.round(tempAudio.duration) || 180;
            res();
          };
          tempAudio.onerror = () => res();
          setTimeout(res, 2000);
        });
      } catch (err) {
        console.warn('Metadata read fallback:', err);
      }

      const newTrack = {
        id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        title: parsed.title,
        artist: parsed.artist,
        album: parsed.album,
        duration: duration,
        bpm: Math.floor(Math.random() * (140 - 85 + 1)) + 85,
        key: ['8A / Am', '5A / Cm', '11B / A', '1B / B'][Math.floor(Math.random() * 4)],
        energy: Math.floor(Math.random() * 8) + 2,
        mood: ['Energetic', 'Relaxed', 'Ethereal', 'Cozy'][Math.floor(Math.random() * 4)],
        tags: [`#${parsed.artist.toLowerCase().replace(/\s+/g, '')}`, '#local'],
        artworkUrl: parsed.artworkUrl,
        audioBlob: file
      };
      await dbService.saveTrack(newTrack);
      state.tracks.push(newTrack);
    }
    renderApp();
  });

  // Track Play & Delete
  document.querySelectorAll('.btn-play-track').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const trackId = e.currentTarget.dataset.trackId;
      const trk = state.tracks.find((t) => t.id === trackId);
      if (trk) {
        if (audioEngine.currentTrack?.id === trackId) {
          audioEngine.togglePlay();
        } else {
          audioEngine.setQueue(state.tracks, state.tracks.findIndex((t) => t.id === trackId));
        }
      }
    });
  });

  document.querySelectorAll('.btn-delete-track').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const trackId = e.currentTarget.dataset.trackId;
      await dbService.deleteTrack(trackId);
      state.tracks = state.tracks.filter((t) => t.id !== trackId);
      renderApp();
    });
  });

  // Smart Curator Sliders & Switches
  document.getElementById('slider-min-bpm')?.addEventListener('input', (e) => {
    state.curationRules.minBpm = Number(e.target.value);
    document.getElementById('val-bpm').textContent = `${state.curationRules.minBpm} - ${state.curationRules.maxBpm} BPM`;
    renderApp();
  });

  document.getElementById('slider-max-bpm')?.addEventListener('input', (e) => {
    state.curationRules.maxBpm = Number(e.target.value);
    document.getElementById('val-bpm').textContent = `${state.curationRules.minBpm} - ${state.curationRules.maxBpm} BPM`;
    renderApp();
  });

  document.getElementById('slider-min-energy')?.addEventListener('input', (e) => {
    state.curationRules.minEnergy = Number(e.target.value);
    document.getElementById('val-energy').textContent = `${state.curationRules.minEnergy} - ${state.curationRules.maxEnergy} / 10`;
    renderApp();
  });

  document.getElementById('slider-max-energy')?.addEventListener('input', (e) => {
    state.curationRules.maxEnergy = Number(e.target.value);
    document.getElementById('val-energy').textContent = `${state.curationRules.minEnergy} - ${state.curationRules.maxEnergy} / 10`;
    renderApp();
  });

  document.querySelectorAll('.btn-mood-pill').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      state.curationRules.selectedMood = e.currentTarget.dataset.mood;
      renderApp();
    });
  });

  document.querySelectorAll('.flow-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      state.curationRules.flowMode = e.currentTarget.dataset.flow;
      renderApp();
    });
  });

  // Play Curated Flow & Save Playlist
  document.getElementById('btn-play-curated')?.addEventListener('click', () => {
    const curated = getFilteredAndCuratedTracks();
    if (curated.length > 0) {
      audioEngine.setQueue(curated, 0);
      toggleDrawer(true);
    }
  });

  document.getElementById('btn-save-playlist')?.addEventListener('click', async () => {
    const curated = getFilteredAndCuratedTracks();
    if (curated.length === 0) return;
    const name = prompt('Enter a title for this curated playlist:', `Flow Mix ${state.playlists.length + 1}`);
    if (name) {
      const newPlaylist = {
        id: 'pl_' + Date.now(),
        title: name,
        tracks: curated,
        flowMode: state.curationRules.flowMode,
        rules: { ...state.curationRules }
      };
      await dbService.savePlaylist(newPlaylist);
      state.playlists.push(newPlaylist);
      state.activeTab = 'playlists';
      renderApp();
    }
  });

  // Saved Playlists Actions
  document.querySelectorAll('.btn-play-playlist').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const plId = e.currentTarget.dataset.playlistId;
      const pl = state.playlists.find((p) => p.id === plId);
      if (pl && pl.tracks.length > 0) {
        audioEngine.setQueue(pl.tracks, 0);
        toggleDrawer(true);
      }
    });
  });

  document.querySelectorAll('.btn-delete-playlist').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const plId = e.currentTarget.dataset.playlistId;
      state.playlists = await dbService.deletePlaylist(plId);
      renderApp();
    });
  });

  // Mini Player Controls & Expand Drawer
  document.getElementById('mini-player-details')?.addEventListener('click', () => toggleDrawer(true));
  document.getElementById('mini-btn-play')?.addEventListener('click', (e) => {
    e.stopPropagation();
    audioEngine.togglePlay();
  });
  document.getElementById('mini-btn-prev')?.addEventListener('click', (e) => {
    e.stopPropagation();
    audioEngine.prevTrack();
  });
  document.getElementById('mini-btn-next')?.addEventListener('click', (e) => {
    e.stopPropagation();
    audioEngine.nextTrack();
  });

  // Full Player Drawer Controls
  document.getElementById('btn-close-drawer')?.addEventListener('click', () => toggleDrawer(false));
  document.getElementById('btn-player-play')?.addEventListener('click', () => audioEngine.togglePlay());
  document.getElementById('btn-player-prev')?.addEventListener('click', () => audioEngine.prevTrack());
  document.getElementById('btn-player-next')?.addEventListener('click', () => audioEngine.nextTrack());

  // Scrubber & Audio Tweaks
  document.getElementById('player-scrubber')?.addEventListener('input', (e) => {
    audioEngine.seek(Number(e.target.value));
  });

  document.getElementById('slider-crossfade')?.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    state.settings.crossfade = val;
    document.getElementById('val-crossfade').textContent = `${val} Seconds`;
    audioEngine.setCrossfade(val);
    dbService.saveSettings(state.settings);
  });

  document.querySelectorAll('.eq-slider').forEach((slider) => {
    slider.addEventListener('input', (e) => {
      const band = Number(e.target.dataset.band);
      const val = Number(e.target.value);
      state.settings.eq[band] = val;
      audioEngine.setEQGain(band, val);
      dbService.saveSettings(state.settings);
    });
  });

  // Install Modal Controls
  document.getElementById('btn-close-install')?.addEventListener('click', () => toggleInstallModal(false));
  document.getElementById('btn-got-it')?.addEventListener('click', () => toggleInstallModal(false));
}

function toggleDrawer(open) {
  state.isDrawerOpen = open;
  const drawer = document.getElementById('player-drawer');
  if (drawer) {
    if (open) {
      drawer.style.display = 'flex';
      setTimeout(() => drawer.classList.add('open'), 10);
      const canvas = document.getElementById('player-visualizer');
      if (canvas) audioEngine.attachVisualizer(canvas);
    } else {
      drawer.classList.remove('open');
      setTimeout(() => (drawer.style.display = 'none'), 350);
    }
  }
}

function toggleInstallModal(open) {
  state.isInstallGuideOpen = open;
  const modal = document.getElementById('install-modal');
  if (modal) {
    if (open) {
      modal.style.display = 'flex';
      setTimeout(() => modal.classList.add('open'), 10);
    } else {
      modal.classList.remove('open');
      setTimeout(() => (modal.style.display = 'none'), 350);
    }
  }
}

function updateTimeDisplay() {
  const scrubber = document.getElementById('player-scrubber');
  const currentEl = document.getElementById('time-current');
  const durEl = document.getElementById('time-duration');

  if (scrubber && !scrubber.matches(':active')) {
    scrubber.value = state.currentTime;
    scrubber.max = state.duration;
  }

  const formatTime = (secs) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (currentEl) currentEl.textContent = formatTime(state.currentTime);
  if (durEl) durEl.textContent = formatTime(state.duration);
}

// Initialize immediately or on DOM load if loading
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
