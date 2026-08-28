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
      aud.crossOrigin = 'anonymous';
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
    if (!nextTrack) return;

    const incomingAudio = this.inactiveAudio;
    let nextSrc = nextTrack.audioBlob ? URL.createObjectURL(nextTrack.audioBlob) : nextTrack.url;
    incomingAudio.src = nextSrc;
    incomingAudio.volume = 0;
    incomingAudio.play();

    const fadeStep = 50;
    const totalSteps = (this.crossfadeTime * 1000) / fadeStep;
    let step = 0;

    const fadeInterval = setInterval(() => {
      step++;
      const progress = step / totalSteps;
      this.activeAudio.volume = Math.max(0, 1 - progress);
      incomingAudio.volume = Math.min(1, progress);

      if (step >= totalSteps) {
        clearInterval(fadeInterval);
        this.activeAudio.pause();
        this.activeAudio.volume = 1;
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
    }, fadeStep);
  }

  onTrackEnded() {
    if (!this.isCrossfading) {
      this.nextTrack();
    }
  }

  // iOS Lock Screen MediaSession Controls
  updateMediaSession(track) {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || 'Unknown Track',
        artist: track.artist || 'Unknown Artist',
        album: track.album || 'MyMix Playlist',
        artwork: track.artworkUrl
          ? [{ src: track.artworkUrl, sizes: '512x512', type: 'image/jpeg' }]
          : [{ src: '/icons/icon-512.jpg', sizes: '512x512', type: 'image/jpeg' }]
      });

      navigator.mediaSession.setActionHandler('play', () => this.togglePlay());
      navigator.mediaSession.setActionHandler('pause', () => this.togglePlay());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prevTrack());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.nextTrack());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) this.seek(details.seekTime);
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
