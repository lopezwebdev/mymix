// Procedural High-Quality Web Audio Synthesizer for Demo Music Generation

export async function generatePresetTracks() {
  const offlineCtx = new OfflineAudioContext(2, 44100 * 20, 44100); // 20-second high quality loopable tracks

  // --- Track 1: Synthwave Neon ---
  const synthwaveBlob = await renderSynthwaveTrack();

  // --- Track 2: Lofi Chill ---
  const lofiBlob = await renderLofiTrack();

  // --- Track 3: Ambient Drift ---
  const ambientBlob = await renderAmbientTrack();

  return [
    {
      id: 'preset_1',
      title: 'Midnight Neon Drive',
      artist: 'Synthwave Velocity',
      album: 'Neon Horizon',
      duration: 20,
      bpm: 118,
      key: '8A / A Minor',
      energy: 8,
      mood: 'Energetic',
      tags: ['#synthwave', '#night', '#drive', '#upbeat'],
      artworkUrl: '/assets/synthwave.jpg',
      audioBlob: synthwaveBlob
    },
    {
      id: 'preset_2',
      title: 'Rainy Cafe Vibes',
      artist: 'Lofi Study Beats',
      album: 'Night Rain',
      duration: 20,
      bpm: 84,
      key: '5A / C Minor',
      energy: 4,
      mood: 'Relaxed',
      tags: ['#lofi', '#chill', '#study', '#cozy'],
      artworkUrl: '/assets/lofi.jpg',
      audioBlob: lofiBlob
    },
    {
      id: 'preset_3',
      title: 'Celestial Drift',
      artist: 'Aetherial Echoes',
      album: 'Harmonies of Space',
      duration: 20,
      bpm: 65,
      key: '11B / A Major',
      energy: 2,
      mood: 'Ethereal',
      tags: ['#ambient', '#sleep', '#deep', '#meditation'],
      artworkUrl: '/assets/ambient.jpg',
      audioBlob: ambientBlob
    }
  ];
}

function bufferToWavBlob(buffer) {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const outBuffer = new ArrayBuffer(length);
  const view = new DataView(outBuffer);
  const channels = [];
  let sample = 0;
  let offset = 0;
  let pos = 0;

  function setUint16(data) {
    view.setUint16(pos, data, true);
    pos += 2;
  }
  function setUint32(data) {
    view.setUint32(pos, data, true);
    pos += 4;
  }

  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit sample

  setUint32(0x61746164); // "data" chunk
  setUint32(length - pos - 4);

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (offset < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([outBuffer], { type: 'audio/wav' });
}

async function renderSynthwaveTrack() {
  const duration = 20;
  const sampleRate = 44100;
  const ctx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

  // Bass Synth Sawtooth
  const bass = ctx.createOscillator();
  bass.type = 'sawtooth';
  const bassFilter = ctx.createBiquadFilter();
  bassFilter.type = 'lowpass';
  bassFilter.frequency.setValueAtTime(400, 0);

  // Notes sequence: A1 -> C2 -> F1 -> G1
  const now = 0;
  const bpm = 118;
  const sixteenth = 60 / bpm / 4;

  const bassGain = ctx.createGain();
  bassGain.gain.setValueAtTime(0.3, 0);

  bass.connect(bassFilter);
  bassFilter.connect(bassGain);
  bassGain.connect(ctx.destination);

  bass.frequency.setValueAtTime(55, 0); // A1
  bass.start(0);
  bass.stop(duration);

  // Drums (Kick & Snare beats)
  for (let t = 0; t < duration; t += (60 / bpm)) {
    // Kick
    const kick = ctx.createOscillator();
    const kickGain = ctx.createGain();
    kick.frequency.setValueAtTime(150, t);
    kick.frequency.exponentialRampToValueAtTime(30, t + 0.1);
    kickGain.gain.setValueAtTime(0.8, t);
    kickGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    kick.connect(kickGain);
    kickGain.connect(ctx.destination);
    kick.start(t);
    kick.stop(t + 0.15);

    // Snare on beat 2 and 4
    if ((Math.round(t / (60 / bpm)) % 2) === 1) {
      const snareNoise = ctx.createBufferSource();
      const noiseBuf = ctx.createBuffer(1, sampleRate * 0.1, sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      snareNoise.buffer = noiseBuf;
      const snareGain = ctx.createGain();
      snareGain.gain.setValueAtTime(0.4, t);
      snareGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
      snareNoise.connect(snareGain);
      snareGain.connect(ctx.destination);
      snareNoise.start(t);
      snareNoise.stop(t + 0.1);
    }
  }

  const renderedBuffer = await ctx.startRendering();
  return bufferToWavBlob(renderedBuffer);
}

async function renderLofiTrack() {
  const duration = 20;
  const sampleRate = 44100;
  const ctx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

  // Soft Rhodes Chord Pad
  const chords = [261.63, 311.13, 392.00, 466.16]; // C minor 7 chord
  chords.forEach((freq) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1, 0);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);
    osc.stop(duration);
  });

  // Soft vinyl noise
  const noise = ctx.createBufferSource();
  const noiseBuf = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.015;
  noise.buffer = noiseBuf;
  noise.connect(ctx.destination);
  noise.start(0);

  const renderedBuffer = await ctx.startRendering();
  return bufferToWavBlob(renderedBuffer);
}

async function renderAmbientTrack() {
  const duration = 20;
  const sampleRate = 44100;
  const ctx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

  // Ethereal Sine Swells
  const freqs = [110, 164.81, 220, 329.63, 440];
  freqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.02, 0);
    // LFO Modulation for ethereal swell
    gain.gain.linearRampToValueAtTime(0.08, 5 + idx);
    gain.gain.linearRampToValueAtTime(0.02, 12 + idx);
    gain.gain.linearRampToValueAtTime(0.06, 18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);
    osc.stop(duration);
  });

  const renderedBuffer = await ctx.startRendering();
  return bufferToWavBlob(renderedBuffer);
}
