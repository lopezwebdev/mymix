// Smart Playlist Curator Engine — Rule Filter & Flow Sequence Optimizer

export const curatorEngine = {
  /**
   * Filter tracks based on user curation rules
   */
  filterTracks(allTracks, rules = {}) {
    const {
      minBpm = 0,
      maxBpm = 250,
      minEnergy = 1,
      maxEnergy = 10,
      selectedMoods = [],
      selectedTags = [],
      searchQuery = ''
    } = rules;

    return allTracks.filter((track) => {
      // BPM check
      const bpm = track.bpm || 120;
      if (bpm < minBpm || bpm > maxBpm) return false;

      // Energy check
      const energy = track.energy || 5;
      if (energy < minEnergy || energy > maxEnergy) return false;

      // Mood check
      if (selectedMoods.length > 0 && !selectedMoods.includes(track.mood)) {
        return false;
      }

      // Tag check
      if (selectedTags.length > 0) {
        const trackTags = track.tags || [];
        const hasTagMatch = selectedTags.some((tag) => trackTags.includes(tag));
        if (!hasTagMatch) return false;
      }

      // Search Query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchTitle = (track.title || '').toLowerCase().includes(q);
        const matchArtist = (track.artist || '').toLowerCase().includes(q);
        const matchAlbum = (track.album || '').toLowerCase().includes(q);
        if (!matchTitle && !matchArtist && !matchAlbum) return false;
      }

      return true;
    });
  },

  /**
   * Sort & sequence tracks based on flow mode
   */
  sequenceTracks(tracks, flowMode = 'tempo') {
    const list = [...tracks];

    switch (flowMode) {
      case 'tempo_asc':
        // Smooth BPM ramp up
        return list.sort((a, b) => (a.bpm || 120) - (b.bpm || 120));

      case 'tempo_desc':
        // Smooth BPM ramp down
        return list.sort((a, b) => (b.bpm || 120) - (a.bpm || 120));

      case 'energy_ramp':
        // Energy ramp build-up from chill to climax
        return list.sort((a, b) => (a.energy || 5) - (b.energy || 5));

      case 'harmonic':
        // Key-compatible sequence sorting
        return this.sortByHarmonicKey(list);

      case 'smart_shuffle':
        // Harmonic-aware shuffle
        return this.smartShuffle(list);

      default:
        return list;
    }
  },

  /**
   * Parse Camelot key format (e.g. "8A / A Minor" -> number 8, letter A)
   */
  parseCamelotKey(keyStr) {
    if (!keyStr) return { num: 1, letter: 'A' };
    const match = keyStr.match(/(\d+)([AB])/i);
    if (match) {
      return { num: parseInt(match[1], 10), letter: match[2].toUpperCase() };
    }
    return { num: 1, letter: 'A' };
  },

  /**
   * Sort tracks into a harmonically compatible chain
   */
  sortByHarmonicKey(tracks) {
    if (tracks.length <= 1) return tracks;

    const unvisited = [...tracks];
    const sequenced = [unvisited.shift()];

    while (unvisited.length > 0) {
      const current = sequenced[sequenced.length - 1];
      const currentKey = this.parseCamelotKey(current.key);

      // Find best harmonic match in unvisited
      let bestIdx = 0;
      let bestScore = Infinity;

      unvisited.forEach((trk, idx) => {
        const key = this.parseCamelotKey(trk.key);
        // Score based on distance on Camelot wheel
        let numDiff = Math.abs(currentKey.num - key.num);
        if (numDiff > 6) numDiff = 12 - numDiff;

        const letterDiff = currentKey.letter === key.letter ? 0 : 1;
        const totalScore = numDiff * 2 + letterDiff;

        if (totalScore < bestScore) {
          bestScore = totalScore;
          bestIdx = idx;
        }
      });

      sequenced.push(unvisited.splice(bestIdx, 1)[0]);
    }

    return sequenced;
  },

  smartShuffle(tracks) {
    const list = [...tracks];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }
};
