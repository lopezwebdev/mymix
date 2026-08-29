// Web Audio Engine with Single-Element Background Playback,
// Crossfade, 5-Band EQ, Analyser Visualizer, & MediaSession Integration

/**
 * DEVELOPER NOTE ON BACKGROUND PLAYBACK:
 * Mobile operating systems and browsers, especially iOS Safari and standalone PWAs,
 * may apply background-execution policies that suspend Web Audio processing.
 *
 * This engine keeps native HTMLAudioElement playback independent from the Web Audio
 * visualizer. The analyser and canvas are optional observers: if visual rendering
 * pauses while the app is backgrounded, they must never pause, replace, disconnect,
 * or otherwise affect audio playback.
 *
 * - HTMLAudioElement (`this.audio`) is persistent and is the playback source of truth.
 * - MediaElementAudioSourceNode (`this.analysisSourceNode`) is created exactly once from
 *   a silent `this.analysisAudio` element and feeds the analyser → gain(0) → destination graph.
 * - `this.audio` NEVER enters the Web Audio graph (`createMediaElementSource(this.audio)` is NEVER called).
 * - The visualizer render loop is passive and may pause when backgrounded.
 * - Browser/OS policies may still interrupt playback; this code must not cause it.
 */

class AudioEngine {
  constructor() {
    this.audioCtx = null;

    // Primary audible HTMLAudioElement (Direct native output; NEVER enters Web Audio graph)
    this.audio = new Audio();
    this.audio.setAttribute('playsinline', 'true');
    this.audio.preload = 'auto';

    // Silent Analysis-only HTMLAudioElement (Feeds Web Audio graph for AnalyserNode)
    this.analysisAudio = new Audio();
    this.analysisAudio.setAttribute('playsinline', 'true');
    this.analysisAudio.preload = 'auto';

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
    this.currentObjectUrl = null;

    // EQ bands & Web Audio Graph Nodes
    this.eqBands = [60, 250, 1000, 4000, 12000];
    this.eqNodes = [];
    this.analyser = null;
    this.analysisSourceNode = null;
    this.analysisGainNode = null;

    this.setupAudioElement();
    this.setupVisibilityListener();
  }

  setupVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        // App returned to foreground
        if (this.isPlaying && this.audio && !this.audio.paused) {
          if (this.analysisAudio) {
            this.analysisAudio.currentTime = this.audio.currentTime;
            this.analysisAudio.playbackRate = this.audio.playbackRate || 1;
          }
          if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch((err) => {
              console.debug('AudioContext foreground resume notice:', err);
            });
          }
          if (this.analysisAudio && this.analysisAudio.paused) {
            this.analysisAudio.play().catch((err) => {
              console.warn('Silent analysisAudio play notice on visibility:', err);
            });
          }
        }
        this.syncMediaSessionState();
      } else {
        // App hidden or phone locked: pause silent analysis player to save battery
        if (this.analysisAudio && !this.analysisAudio.paused) {
          this.analysisAudio.pause();
        }
      }
    });
  }

  initContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        try {
          this.audioCtx = new AudioCtxClass();
          this.analyser = this.audioCtx.createAnalyser();
          this.analyser.fftSize = 64;

          // Create GainNode set to 0 gain so analysisAudio remains 100% silent
          this.analysisGainNode = this.audioCtx.createGain();
          this.analysisGainNode.gain.value = 0;

          // Create MediaElementAudioSourceNode ONLY for analysisAudio (NEVER for this.audio)
          if (!this.analysisSourceNode) {
            this.analysisSourceNode = this.audioCtx.createMediaElementSource(this.analysisAudio);
          }

          // Build Audio Analysis Graph:
          // analysisAudio -> MediaElementAudioSourceNode -> AnalyserNode -> GainNode(gain=0) -> AudioContext.destination
          this.analysisSourceNode.connect(this.analyser);
          this.analyser.connect(this.analysisGainNode);
          this.analysisGainNode.connect(this.audioCtx.destination);
        } catch (err) {
          console.warn('AudioContext analysis graph setup notice:', err);
        }
      }
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch((err) => {
        console.debug('AudioContext resume notice:', err);
      });
    }
  }

  setupAudioElement() {
    this.audio.addEventListener('ended', () => this.onTrackEnded());
    this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.syncMediaSessionState();
    });
    this.audio.addEventListener('pause', () => {
      if (!this.isCrossfading) {
        this.isPlaying = false;
        if (this.analysisAudio) this.analysisAudio.pause();
        this.syncMediaSessionState();
      }
    });
    this.audio.addEventListener('error', (e) => {
      console.error('Audio playback error:', e);
      if (this.isPlaying && this.queue.length > 1) {
        setTimeout(() => this.nextTrack(), 1000);
      }
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

    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
    this.isCrossfading = false;
    this.audio.volume = 1;

    this.currentTrack = track;

    // Manage object URL creation & safe revocation
    let srcUrl = '';
    let newObjectUrl = null;
    if (track.audioBlob) {
      newObjectUrl = URL.createObjectURL(track.audioBlob);
      srcUrl = newObjectUrl;
    } else if (track.url) {
      srcUrl = track.url;
    }

    if (srcUrl.startsWith('http://') || srcUrl.startsWith('https://')) {
      this.audio.crossOrigin = 'anonymous';
      this.analysisAudio.crossOrigin = 'anonymous';
    } else {
      this.audio.removeAttribute('crossorigin');
      this.analysisAudio.removeAttribute('crossorigin');
    }

    // Set source on primary audible player
    this.audio.src = srcUrl;
    this.audio.currentTime = 0;

    // Set source on silent analysis player
    this.analysisAudio.src = srcUrl;
    this.analysisAudio.currentTime = 0;
    this.analysisAudio.playbackRate = this.audio.playbackRate || 1;

    // Revoke previous Blob URL only after both primary and analysis elements have updated source
    if (this.currentObjectUrl && this.currentObjectUrl !== newObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
    }
    this.currentObjectUrl = newObjectUrl;

    if (autoPlay) {
      try {
        await this.audio.play();
        this.isPlaying = true;
        this.updateMediaSession(track);
        this.notifyListeners('playStateChange', { isPlaying: true, track });

        // Start silent analysis player alongside primary player if visible
        if (!document.hidden && this.analysisAudio) {
          this.analysisAudio.play().catch((err) => {
            console.warn('Silent analysisAudio play notice:', err);
          });
        }
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
      if (this.analysisAudio) this.analysisAudio.pause();
      this.isPlaying = false;
    } else {
      this.audio.play().catch((err) => console.warn('Play error:', err));
      if (this.analysisAudio && !document.hidden) {
        this.analysisAudio.currentTime = this.audio.currentTime;
        this.analysisAudio.play().catch((err) => console.warn('analysisAudio play notice:', err));
      }
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
    if (this.analysisAudio) {
      this.analysisAudio.currentTime = seconds;
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

    // Resync silent analysis player if drift exceeds 0.25s while app is visible
    if (!document.hidden && this.analysisAudio && !this.audio.paused) {
      const drift = Math.abs(this.audio.currentTime - this.analysisAudio.currentTime);
      if (drift > 0.25) {
        this.analysisAudio.currentTime = this.audio.currentTime;
      }
      if (this.analysisAudio.paused) {
        this.analysisAudio.play().catch(() => {});
      }
    }

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

    // Trigger crossfade transition near track end if crossfade is enabled and foregrounded
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

    // Fade out volume gracefully before transitioning tracks
    const startTime = Date.now();
    const durationMs = Math.min(this.crossfadeTime * 1000, 3000);

    if (this.fadeInterval) clearInterval(this.fadeInterval);
    this.fadeInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);

      this.audio.volume = Math.max(0, 1 - progress);

      if (progress >= 1 || !this.isPlaying) {
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
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    this.visualizerCanvas = canvasElement;
    if (!this.visualizerCanvas) return;
    const ctx = this.visualizerCanvas.getContext('2d');

    // Pre-allocate frequency data array once per attachment
    const bufferLength = this.analyser ? this.analyser.frequencyBinCount : 32;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      this.animFrameId = requestAnimationFrame(render);
      if (document.hidden) return; // Skip canvas rendering while backgrounded to save CPU/battery

      const width = this.visualizerCanvas.width;
      const height = this.visualizerCanvas.height;
      ctx.clearRect(0, 0, width, height);

      if (!this.analyser || !this.isPlaying || (this.audio && this.audio.paused)) {
        // Flat line default animation when paused or idle
        ctx.fillStyle = 'rgba(139, 92, 246, 0.2)';
        ctx.fillRect(0, height / 2 - 1, width, 2);
        return;
      }

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
