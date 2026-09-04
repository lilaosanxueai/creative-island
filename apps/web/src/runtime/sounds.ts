/** WebAudio 合成音效，零素材依赖 */

let ctx: AudioContext | null = null;
let muted = localStorage.getItem('island-muted') === '1';

export function isMuted(): boolean { return muted; }

export function setMuted(next: boolean): void {
  muted = next;
  localStorage.setItem('island-muted', next ? '1' : '0');
}

function audio(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.15): void {
  const ac = audio();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, ac.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + start + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + dur);
}

export function playSound(name: string): void {
  if (muted) return;
  try {
    switch (name) {
      case 'ding': tone(880, 0, 0.3); tone(1320, 0.08, 0.4); break;
      case 'cheer': [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.09, 0.25, 'triangle')); break;
      case 'meow': tone(600, 0, 0.15, 'sawtooth', 0.08); tone(500, 0.12, 0.25, 'sawtooth', 0.08); break;
      case 'pop': tone(200, 0, 0.08, 'square', 0.1); tone(90, 0.02, 0.15, 'sine', 0.2); break;
      default: tone(660, 0, 0.2);
    }
  } catch { /* 音频不可用（如无用户手势）时静默 */ }
}
