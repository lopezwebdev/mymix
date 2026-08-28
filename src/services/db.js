import { get, set, del, keys, entries } from 'idb-keyval';

const TRACKS_PREFIX = 'track_';
const PLAYLISTS_KEY = 'mymix_playlists';
const SETTINGS_KEY = 'mymix_settings';

export const dbService = {
  // --- Tracks Storage ---
  async saveTrack(track) {
    // track object: { id, title, artist, album, duration, bpm, key, energy, mood, tags, artworkUrl, audioBlob }
    const key = `${TRACKS_PREFIX}${track.id}`;
    await set(key, track);
    return track;
  },

  async getTrack(id) {
    return await get(`${TRACKS_PREFIX}${id}`);
  },

  async getAllTracks() {
    const allKeys = await keys();
    const trackKeys = allKeys.filter((k) => typeof k === 'string' && k.startsWith(TRACKS_PREFIX));
    const trackList = [];
    for (const key of trackKeys) {
      const trk = await get(key);
      if (trk) trackList.push(trk);
    }
    return trackList;
  },

  async deleteTrack(id) {
    await del(`${TRACKS_PREFIX}${id}`);
  },

  // --- Playlists Storage ---
  async getPlaylists() {
    const playlists = await get(PLAYLISTS_KEY);
    return playlists || [];
  },

  async savePlaylist(playlist) {
    const playlists = await this.getPlaylists();
    const existingIdx = playlists.findIndex((p) => p.id === playlist.id);
    if (existingIdx >= 0) {
      playlists[existingIdx] = playlist;
    } else {
      playlists.push(playlist);
    }
    await set(PLAYLISTS_KEY, playlists);
    return playlists;
  },

  async deletePlaylist(id) {
    const playlists = await this.getPlaylists();
    const filtered = playlists.filter((p) => p.id !== id);
    await set(PLAYLISTS_KEY, filtered);
    return filtered;
  },

  // --- Settings ---
  async getSettings() {
    const settings = await get(SETTINGS_KEY);
    return settings || { crossfade: 3, eq: [0, 0, 0, 0, 0] };
  },

  async saveSettings(settings) {
    await set(SETTINGS_KEY, settings);
  }
};
