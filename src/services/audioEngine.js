// Web Audio Engine with Crossfade, 5-Band EQ, Visualizer Analyser, & MediaSession Integration

class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.audioA = new Audio();
    this.audioB = new Audio();
    this.activeAudio = this.audioA;
    this.inactiveAudio = this.audioB;

    this.currentTrack = null;
    this.queue = [];
    this.currentIndex = -1;
    this.isPlaying = false;
    this.crossfadeTime = 3; // default 3s crossfade
    this.isCrossfading = false;

    this.listeners = new Set();
    this.visualizerCanvas = null;
    this.animFrameId = null;

    // EQ bands
    this.eqBands = [60, 250, 1000, 4000, 12000];
    this.eqNodes = [];
    this.analyser = null;

    this.setupAudioElements();
    this.setupVisibilityListener();
  }

  setupVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isPlaying) {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }
        this.syncMediaSessionState();
      }
    });
  }

  initContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtxClass();

      // Master EQ & Analyser setup
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 64;

      let lastNode = this.audioCtx.destination;
      this.eqNodes = this.eqBands.map((freq, idx) => {
        const filter = this.audioCtx.createBiquadFilter();
        if (idx === 0) filter.type = 'lowshelf';
        else if (idx === this.eqBands.length - 1) filter.type = 'highshelf';
        else filter.type = 'peaking';
        filter.frequency.value = freq;
        filter.gain.value = 0;
        return filter;
      });

      // Chain EQ nodes to Analyser and Destination
      for (let i = this.eqNodes.length - 1; i >= 0; i--) {
        this.eqNodes[i].connect(lastNode);
        lastNode = this.eqNodes[i];
      }

      this.analyser.connect(lastNode);
      this.masterDestination = this.analyser;
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  setupAudioElements() {
    [this.audioA, this.audioB].forEach((aud) => {
      aud.addEventListener('ended', () => this.onTrackEnded());
      aud.addEventListener('timeupdate', () => this.onTimeUpdate());
    });
  }

  setQueue(tracks, startIndex = 0) {
    this.queue = tracks;
    this.currentIndex = startIndex;
    if (this.queue.length > 0 && startIndex < this.queue.length) {
      this.playTrack(this.queue[startIndex]);
    }
  }

  async playTrack(track, autoPlay = true) {
    this.initContext();
    this.currentTrack = track;

    // Create object URL from audio Blob if needed
    let srcUrl = '';
    if (track.audioBlob) {
      srcUrl = URL.createObjectURL(track.audioBlob);
    } else if (track.url) {
      srcUrl = track.url;
    }

    const targetAudio = this.activeAudio;

    // Only set crossOrigin for remote HTTP(S) resources to avoid iOS Safari Blob CORS issues
    if (srcUrl.startsWith('http://') || srcUrl.startsWith('https://')) {
      targetAudio.crossOrigin = 'anonymous';
    } else {
      targetAudio.removeAttribute('crossorigin');
    }

    targetAudio.src = srcUrl;
    targetAudio.currentTime = 0;

    if (autoPlay) {
      try {
        await targetAudio.play();
        this.isPlaying = true;
        this.updateMediaSession(track);
        this.notifyListeners('playStateChange', { isPlaying: true, track });
      } catch (err) {
        console.warn('Autoplay blocked or audio load error:', err);
      }
    }

    this.notifyListeners('trackChange', track);
  }

  togglePlay() {
    this.initContext();
    if (!this.activeAudio.src) return;

    if (this.isPlaying) {
      this.activeAudio.pause();
      this.isPlaying = false;
    } else {
      this.activeAudio.play();
      this.isPlaying = true;
    }
    this.syncMediaSessionState();
    this.notifyListeners('playStateChange', { isPlaying: this.isPlaying, track: this.currentTrack });
  }

  nextTrack() {
    if (this.queue.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.queue.length;
    this.playTrack(this.queue[this.currentIndex]);
  }

  prevTrack() {
    if (this.queue.length === 0) return;
    this.currentIndex = (this.currentIndex - 1 + this.queue.length) % this.queue.length;
    this.playTrack(this.queue[this.currentIndex]);
  }

  seek(seconds) {
    if (this.activeAudio) {
      this.activeAudio.currentTime = seconds;
      this.syncMediaSessionState();
    }
  }

  setCrossfade(seconds) {
    this.crossfadeTime = Number(seconds);
  }

  setEQGain(bandIndex, gainValue) {
    if (this.eqNodes[bandIndex]) {
      this.eqNodes[bandIndex].gain.value = Number(gainValue);
    }
  }

  onTimeUpdate() {
    if (!this.activeAudio || !this.currentTrack) return;
    const currentTime = this.activeAudio.currentTime;
    const duration = this.activeAudio.duration || this.currentTrack.duration || 1;

    // Sync position state for iOS Lock Screen & Control Center
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
      try {
        if (duration > 0 && currentTime <= duration) {
          navigator.mediaSession.setPositionState({
            duration: duration,
            playbackRate: this.activeAudio.playbackRate || 1,
            position: currentTime
          });
        }
      } catch (err) {
        // Ignore duration rounding edge cases
      }
    }

    // Crossfade trigger near end of track
    if (
      this.crossfadeTime > 0 &&
      duration - currentTime <= this.crossfadeTime &&
      !this.isCrossfading &&
      this.queue.length > 1
    ) {
      this.triggerCrossfade();
    }

    this.notifyListeners('timeUpdate', { currentTime, duration });
  }

  triggerCrossfade() {
    if (this.isCrossfading) return;
    this.isCrossfading = true;

    const nextIndex = (this.currentIndex + 1) % this.queue.length;
    const nextTrack = this.queue[nextIndex];
    if (!nextTrack) {
      this.isCrossfading = false;
      return;
    }

    const incomingAudio = this.inactiveAudio;
    let nextSrc = nextTrack.audioBlob ? URL.createObjectURL(nextTrack.audioBlob) : nextTrack.url;
    if (nextSrc.startsWith('http://') || nextSrc.startsWith('https://')) {
      incomingAudio.crossOrigin = 'anonymous';
    } else {
      incomingAudio.removeAttribute('crossorigin');
    }
    incomingAudio.src = nextSrc;
    incomingAudio.volume = 0;
    incomingAudio.play().catch(() => {});

    // If document is hidden (screen locked / app backgrounded), complete track switch instantly to avoid timer throttling
    if (document.hidden) {
      this.activeAudio.pause();
      this.activeAudio.volume = 1;
      incomingAudio.volume = 1;

      const temp = this.activeAudio;
      this.activeAudio = this.inactiveAudio;
      this.inactiveAudio = temp;
      this.currentIndex = nextIndex;
      this.currentTrack = nextTrack;
      this.isCrossfading = false;
      this.updateMediaSession(nextTrack);
      this.notifyListeners('trackChange', nextTrack);
      return;
    }

    const startTime = Date.now();
    const durationMs = this.crossfadeTime * 1000;

    const fadeInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);

      this.activeAudio.volume = Math.max(0, 1 - progress);
      incomingAudio.volume = Math.min(1, progress);

      if (progress >= 1 || !this.isPlaying || document.hidden) {
        clearInterval(fadeInterval);
        this.activeAudio.pause();
        this.activeAudio.volume = 1;
        incomingAudio.volume = 1;

        // Swap active and inactive audio elements
        const temp = this.activeAudio;
        this.activeAudio = this.inactiveAudio;
        this.inactiveAudio = temp;
        this.currentIndex = nextIndex;
        this.currentTrack = nextTrack;
        this.isCrossfading = false;
        this.updateMediaSession(nextTrack);
        this.notifyListeners('trackChange', nextTrack);
      }
    }, 50);
  }

  onTrackEnded() {
    if (this.isCrossfading) {
      // Clean up crossfade state if track ended while fading
      this.isCrossfading = false;
      this.activeAudio.volume = 1;
      this.inactiveAudio.volume = 1;
    }
    this.nextTrack();
  }

  syncMediaSessionState() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
    }
  }

  // iOS Lock Screen MediaSession Controls & Background Session Keeper
  updateMediaSession(track) {
    if ('mediaSession' in navigator) {
      if (track) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title || 'Unknown Track',
          artist: track.artist || 'Unknown Artist',
          album: track.album || 'MyMix Playlist',
          artwork: track.artworkUrl
            ? [{ src: track.artworkUrl, sizes: '512x512', type: 'image/jpeg' }]
            : [{ src: '/icons/icon-512.jpg', sizes: '512x512', type: 'image/jpeg' }]
        });
      }

      navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';

      navigator.mediaSession.setActionHandler('play', () => {
        if (!this.isPlaying) this.togglePlay();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (this.isPlaying) this.togglePlay();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prevTrack());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.nextTrack());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) this.seek(details.seekTime);
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const skip = details.seekOffset || 10;
        this.seek(Math.max(this.activeAudio.currentTime - skip, 0));
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const skip = details.seekOffset || 10;
        const dur = this.activeAudio.duration || 1;
        this.seek(Math.min(this.activeAudio.currentTime + skip, dur));
      });
    }
  }

  // Visualizer renderer on Canvas
  attachVisualizer(canvasElement) {
    this.visualizerCanvas = canvasElement;
    if (!this.visualizerCanvas) return;
    const ctx = this.visualizerCanvas.getContext('2d');

    const render = () => {
      this.animFrameId = requestAnimationFrame(render);
      if (document.hidden) return; // Skip canvas rendering while backgrounded to save CPU/battery

      const width = this.visualizerCanvas.width;
      const height = this.visualizerCanvas.height;
      ctx.clearRect(0, 0, width, height);

      if (!this.analyser || !this.isPlaying) {
        // Flat line default animation
        ctx.fillStyle = 'rgba(139, 92, 246, 0.2)';
        ctx.fillRect(0, height / 2 - 1, width, 2);
        return;
      }

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      this.analyser.getByteFrequencyData(dataArray);

      const barWidth = (width / bufferLength) * 1.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height;
        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, '#8b5cf6');
        gradient.addColorStop(0.5, '#ec4899');
        gradient.addColorStop(1, '#06b6d4');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, height - barHeight, barWidth - 2, barHeight);
        x += barWidth;
      }
    };

    render();
  }

  subscribe(event, callback) {
    this.listeners.add({ event, callback });
  }

  notifyListeners(event, data) {
    this.listeners.forEach((listener) => {
      if (listener.event === event) listener.callback(data);
    });
  }
}

export const audioEngine = new AudioEngine();

