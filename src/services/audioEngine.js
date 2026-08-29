// Web Audio Engine with Single-Element Background Playback, Crossfade, 5-Band EQ, Visualizer Analyser, & MediaSession Integration

class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.audio = new Audio();
    this.audio.setAttribute('playsinline', 'true');
    this.audio.preload = 'auto';

    this.currentTrack = null;
    this.queue = [];
    this.currentIndex = -1;
    this.isPlaying = false;
    this.crossfadeTime = 3; // default 3s crossfade
    this.isCrossfading = false;
    this.fadeInterval = null;

    this.listeners = new Set();
    this.visualizerCanvas = null;
    this.animFrameId = null;
    this.wakeLock = null;

    // EQ bands
    this.eqBands = [60, 250, 1000, 4000, 12000];
    this.eqNodes = [];
    this.analyser = null;

    this.setupAudioElement();
    this.setupVisibilityListener();
  }

  setupVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      if (this.isPlaying) {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
        this.syncMediaSessionState();
      }
    });
  }

  initContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
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

        try {
          const source = this.audioCtx.createMediaElementSource(this.audio);
          source.connect(this.masterDestination);
        } catch (err) {
          console.warn('Audio node connection notice:', err);
        }

        this.audioCtx.onstatechange = () => {
          if (this.isPlaying && this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
          }
        };
      }
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  setupAudioElement() {
    this.audio.addEventListener('ended', () => this.onTrackEnded());
    this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.syncMediaSessionState();
      this.requestWakeLock();
    });
    this.audio.addEventListener('pause', () => {
      if (!this.isCrossfading) {
        this.isPlaying = false;
        this.syncMediaSessionState();
        this.releaseWakeLock();
      }
    });
    this.audio.addEventListener('error', (e) => {
      console.error('Audio playback error:', e);
      // Auto advance on corrupt/unplayable track
      if (this.isPlaying && this.queue.length > 1) {
        setTimeout(() => this.nextTrack(), 1000);
      }
    });
  }

  async requestWakeLock() {
    if ('wakeLock' in navigator && !this.wakeLock) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
      } catch (err) {}
    }
  }

  releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
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

    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
    this.isCrossfading = false;
    this.audio.volume = 1;

    this.currentTrack = track;

    // Create object URL from audio Blob if needed
    let srcUrl = '';
    if (track.audioBlob) {
      srcUrl = URL.createObjectURL(track.audioBlob);
    } else if (track.url) {
      srcUrl = track.url;
    }

    if (srcUrl.startsWith('http://') || srcUrl.startsWith('https://')) {
      this.audio.crossOrigin = 'anonymous';
    } else {
      this.audio.removeAttribute('crossorigin');
    }

    this.audio.src = srcUrl;
    this.audio.currentTime = 0;

    if (autoPlay) {
      try {
        await this.audio.play();
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
    if (!this.audio.src) return;

    if (this.isPlaying) {
      this.audio.pause();
      this.isPlaying = false;
    } else {
      this.audio.play().catch((err) => console.warn('Play error:', err));
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
    if (this.audio) {
      this.audio.currentTime = seconds;
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
    if (!this.audio || !this.currentTrack) return;
    const currentTime = this.audio.currentTime;
    const duration = this.audio.duration || this.currentTrack.duration || 1;

    // Sync position state for iOS Lock Screen & Control Center
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
      try {
        if (duration > 0 && currentTime <= duration) {
          navigator.mediaSession.setPositionState({
            duration: duration,
            playbackRate: this.audio.playbackRate || 1,
            position: currentTime
          });
        }
      } catch (err) {
        // Ignore duration rounding edge cases
      }
    }

    // Gentle volume fade near track end if crossfade is enabled and app is in foreground
    if (
      this.crossfadeTime > 0 &&
      duration - currentTime <= this.crossfadeTime &&
      !this.isCrossfading &&
      !document.hidden &&
      this.queue.length > 1
    ) {
      this.triggerCrossfade();
    }

    this.notifyListeners('timeUpdate', { currentTime, duration });
  }

  triggerCrossfade() {
    if (this.isCrossfading) return;
    this.isCrossfading = true;

    // Fade out volume gracefully on current track before transitioning
    const startTime = Date.now();
    const durationMs = Math.min(this.crossfadeTime * 1000, 3000);

    if (this.fadeInterval) clearInterval(this.fadeInterval);
    this.fadeInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);

      this.audio.volume = Math.max(0, 1 - progress);

      if (progress >= 1 || !this.isPlaying || document.hidden) {
        clearInterval(this.fadeInterval);
        this.fadeInterval = null;
        this.isCrossfading = false;
        this.nextTrack();
      }
    }, 50);
  }

  onTrackEnded() {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
    this.isCrossfading = false;
    this.audio.volume = 1;
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
      navigator.mediaSession.setActionHandler('stop', () => {
        if (this.isPlaying) this.togglePlay();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prevTrack());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.nextTrack());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) this.seek(details.seekTime);
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const skip = details.seekOffset || 10;
        this.seek(Math.max(this.audio.currentTime - skip, 0));
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const skip = details.seekOffset || 10;
        const dur = this.audio.duration || 1;
        this.seek(Math.min(this.audio.currentTime + skip, dur));
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

