'use strict';

/**
 * Acquires the Windows system-audio loopback stream and exposes the raw
 * frequency / time-domain buffers from a single AnalyserNode.
 *
 * The main process answers getDisplayMedia() with `audio: 'loopback'`, so the
 * audio track carries whatever the machine is playing. The paired video track
 * is unused and stopped immediately to avoid a pointless screen capture.
 */
export class AudioEngine {
  constructor({ fftSize = 4096, smoothing = 0.72 } = {}) {
    this.fftSize = fftSize;
    this.smoothing = smoothing;

    this.context = null;
    this.analyser = null;
    this.stream = null;
    this.sourceNode = null;

    this.frequencyData = null; // Uint8Array, 0..255 per bin
    this.timeDomainData = null; // Uint8Array, 128 = silence

    /** Called when the loopback track dies on its own. @type {?Function} */
    this.onLost = null;
    this._stopping = false;
  }

  /** @returns {Promise<void>} Resolves once buffers are live. */
  async start() {
    this.stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });

    // Keep only audio; the video track exists solely to satisfy Electron.
    for (const track of this.stream.getVideoTracks()) {
      track.stop();
      this.stream.removeTrack(track);
    }

    const [track] = this.stream.getAudioTracks();
    if (!track) {
      throw new Error('NO_AUDIO_TRACK');
    }

    // Windows can tear the loopback endpoint down underneath us — a default
    // output device change is the usual trigger. Sometimes the track reports
    // it; the caller decides what to do about it. (Stopping a track from
    // script does not fire `ended`, so our own stop() cannot loop back here.)
    track.addEventListener('ended', () => this._reportLost('ended'));
    track.addEventListener('mute', () => this._reportLost('muted'));

    this.context = new AudioContext();
    if (this.context.state === 'suspended') await this.context.resume();

    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = this.smoothing;
    // Widen the useful range: default -30dB max clips loud music flat.
    this.analyser.minDecibels = -95;
    this.analyser.maxDecibels = -12;

    this.sourceNode = this.context.createMediaStreamSource(this.stream);
    this.sourceNode.connect(this.analyser);
    // Deliberately not connected to the destination: routing loopback back to
    // the speakers would create a feedback loop.

    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeDomainData = new Uint8Array(this.analyser.fftSize);
  }

  /** Refreshes both buffers in place. Call once per animation frame. */
  poll() {
    if (!this.analyser) return;
    this.analyser.getByteFrequencyData(this.frequencyData);
    this.analyser.getByteTimeDomainData(this.timeDomainData);
  }

  /** Hz represented by one FFT bin, needed for log band mapping. */
  get binWidthHz() {
    if (!this.context) return 0;
    return this.context.sampleRate / this.fftSize;
  }

  get isRunning() {
    return Boolean(this.analyser);
  }

  /**
   * True digital silence, as opposed to merely quiet. A loopback stream bound
   * to a dead endpoint reads exactly like an idle machine, so this is only
   * evidence, not proof, that the capture needs rebuilding.
   */
  get isSilent() {
    if (!this.frequencyData) return false;
    // Strided: a stream with any content at all lights up far more than every
    // eighth bin, and this runs every frame.
    for (let i = 0; i < this.frequencyData.length; i += 8) {
      if (this.frequencyData[i] !== 0) return false;
    }
    return true;
  }

  /** Drops the current capture and acquires a fresh one. */
  async restart() {
    await this.stop();
    await this.start();
  }

  _reportLost(reason) {
    if (this._stopping) return;
    this.onLost?.(reason);
  }

  async stop() {
    this._stopping = true;
    try {
      this.stream?.getTracks().forEach((track) => track.stop());
      if (this.context && this.context.state !== 'closed') await this.context.close();
      this.context = null;
      this.analyser = null;
      this.stream = null;
      this.sourceNode = null;
      this.frequencyData = null;
      this.timeDomainData = null;
    } finally {
      this._stopping = false;
    }
  }
}
