export class AudioSystem {
  ctx: AudioContext;
  masterGain: GainNode;

  constructor() {
    // Check for AudioContext support
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.3; // Master volume
    this.masterGain.connect(this.ctx.destination);
  }

  play(type: 'shoot' | 'enemyShoot' | 'explosion' | 'hit' | 'dash' | 'powerup' | 'alert' | 'nova' | 'xp') {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const t = this.ctx.currentTime;

    switch (type) {
      case 'shoot':
        this.playTone(t, 400, 'square', 0.1, -1000);
        break;
      case 'enemyShoot':
        this.playTone(t, 200, 'sawtooth', 0.15, -500);
        break;
      case 'hit':
        this.playNoise(t, 0.1, 500, 'lowpass');
        break;
      case 'explosion':
        this.playNoise(t, 0.4, 100, 'lowpass');
        this.playTone(t, 100, 'sawtooth', 0.3, -50);
        break;
      case 'dash':
        this.playNoise(t, 0.2, 1000, 'bandpass', true);
        break;
      case 'powerup':
        this.playTone(t, 600, 'sine', 0.1, 600);
        setTimeout(() => this.playTone(this.ctx.currentTime, 900, 'sine', 0.2, 0), 100);
        break;
      case 'alert':
        this.playTone(t, 800, 'square', 0.1, -200);
        setTimeout(() => this.playTone(this.ctx.currentTime, 800, 'square', 0.1, -200), 150);
        break;
      case 'xp':
        this.playTone(t, 800 + Math.random() * 200, 'sine', 0.05, 0);
        break;
      case 'nova':
        this.playNoise(t, 0.5, 200, 'lowpass', true); // Boom
        this.playTone(t, 150, 'sawtooth', 0.4, -100); // Zap
        break;
    }
  }

  playTone(startTime: number, freq: number, type: OscillatorType, duration: number, slide: number) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    if (slide !== 0) {
      osc.frequency.linearRampToValueAtTime(Math.max(0, freq + slide), startTime + duration);
    }

    gain.gain.setValueAtTime(0.5, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  playNoise(startTime: number, duration: number, filterFreq: number, filterType: BiquadFilterType, sweep: boolean = false) {
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, startTime);
    if (sweep) {
        filter.frequency.exponentialRampToValueAtTime(filterFreq * 0.1, startTime + duration);
    }

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(startTime);
    noise.stop(startTime + duration);
  }
}