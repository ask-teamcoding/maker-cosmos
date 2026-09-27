// Audio Synthesizer mimicking the ESP32 active/passive piezo buzzer using Web Audio API

let audioCtx: AudioContext | null = null;
let activeOsc: OscillatorNode | null = null;
let activeGain: GainNode | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playBuzzerTone(freq: number, durationMs: number, type: OscillatorType = 'square'): Promise<void> {
  return new Promise((resolve) => {
    const ctx = getAudioContext();
    if (!ctx) {
      resolve();
      return;
    }

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + durationMs / 1000);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);

      setTimeout(() => {
        resolve();
      }, durationMs);
    } catch {
      resolve();
    }
  });
}

export function playBeep(): void {
  playBuzzerTone(1200, 90);
}

export async function playSuccessMelody(): Promise<void> {
  const notes = [523, 659, 784, 1046]; // C5, E5, G5, C6
  const durations = [80, 80, 80, 160];

  for (let i = 0; i < notes.length; i++) {
    await playBuzzerTone(notes[i], durations[i]);
    await new Promise((r) => setTimeout(r, 20));
  }
}

export async function playErrorTone(): Promise<void> {
  await playBuzzerTone(300, 160);
  await new Promise((r) => setTimeout(r, 40));
  await playBuzzerTone(180, 260);
}

export function startContinuousBuzzer(freq: number = 2400): void {
  const ctx = getAudioContext();
  if (!ctx || activeOsc) return;

  try {
    activeOsc = ctx.createOscillator();
    activeGain = ctx.createGain();

    activeOsc.type = 'square';
    activeOsc.frequency.setValueAtTime(freq, ctx.currentTime);

    activeGain.gain.setValueAtTime(0.08, ctx.currentTime);

    activeOsc.connect(activeGain);
    activeGain.connect(ctx.destination);

    activeOsc.start();
  } catch {
    // Ignore errors
  }
}

export function stopContinuousBuzzer(): void {
  if (activeOsc) {
    try {
      activeOsc.stop();
      activeOsc.disconnect();
    } catch {}
    activeOsc = null;
  }
  if (activeGain) {
    try {
      activeGain.disconnect();
    } catch {}
    activeGain = null;
  }
}
