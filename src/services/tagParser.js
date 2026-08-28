// Smart Artist & Album Metadata Parser for Audio Filenames & Tags

export function parseFilenameMetadata(filename) {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '').trim();

  let artist = 'Unknown Artist';
  let album = 'My Uploads';
  let title = nameWithoutExt;

  // Clean common prefix numbers like "01. ", "01 - ", "1-01 "
  const cleanedName = nameWithoutExt.replace(/^[0-9]{1,2}[\s.\-_]+/, '').trim();

  // Special known artist checks (e.g. Nine Inch Nails, Electric Youth, Pixel Grip, iPrevail)
  const lower = cleanedName.toLowerCase();

  if (lower.includes('nine inch nails') || lower.includes('nin')) {
    artist = 'Nine Inch Nails';
    if (lower.includes('ghosts')) album = 'Ghosts I-IV';
  } else if (lower.includes('electric youth')) {
    artist = 'Electric Youth';
  } else if (lower.includes('pixel grip')) {
    artist = 'Pixel Grip';
  } else if (lower.includes('iprevail') || lower.includes('i prevail')) {
    artist = 'iPrevail';
  }

  // Parse by delimiters " - " or " _ "
  if (cleanedName.includes(' - ')) {
    const parts = cleanedName.split(' - ').map((p) => p.trim());
    if (parts.length >= 3) {
      // Artist - Album - Title
      artist = parts[0];
      album = parts[1];
      title = parts.slice(2).join(' - ');
    } else if (parts.length === 2) {
      // Artist - Title
      if (artist === 'Unknown Artist') artist = parts[0];
      title = parts[1];
    }
  } else if (cleanedName.includes(' _ ')) {
    const parts = cleanedName.split(' _ ').map((p) => p.trim());
    if (parts.length >= 2) {
      if (artist === 'Unknown Artist') artist = parts[0];
      title = parts[1];
    }
  }

  // Assign artist-specific artwork if matched
  let artworkUrl = '/icons/icon-512.jpg';
  const artistLower = artist.toLowerCase();
  if (artistLower.includes('synth') || artistLower.includes('electric')) {
    artworkUrl = '/assets/synthwave.jpg';
  } else if (artistLower.includes('lofi') || artistLower.includes('pixel')) {
    artworkUrl = '/assets/lofi.jpg';
  } else if (artistLower.includes('ambient') || artistLower.includes('nine inch')) {
    artworkUrl = '/assets/ambient.jpg';
  }

  return { artist, album, title, artworkUrl };
}

export function groupTracksByArtist(tracks) {
  const groups = {};

  tracks.forEach((trk) => {
    const artistKey = trk.artist || 'Unknown Artist';
    if (!groups[artistKey]) {
      groups[artistKey] = {
        artist: artistKey,
        albums: new Set(),
        tracks: [],
        artworkUrl: trk.artworkUrl || '/icons/icon-512.jpg'
      };
    }
    groups[artistKey].tracks.push(trk);
    if (trk.album) groups[artistKey].albums.add(trk.album);
  });

  return Object.values(groups).map((grp) => ({
    ...grp,
    albums: Array.from(grp.albums)
  }));
}
