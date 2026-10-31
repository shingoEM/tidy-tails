export function createAudio() {
  let ctx: AudioContext | null = null;
  let muted = false;
  let step = 0;
  let nextAt = 0;
  const melody = [523, 659, 784, 880, 784, 659, 587, 698, 784, 659, 523, 587];

  function ac() {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }

  function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0) {
    if (muted) return;
    const audio = ac();
    const t = audio.currentTime + delay;
    const osc = audio.createOscillator();
    const g = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(audio.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  return {
    unlock() {
      ac();
    },
    toggle() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    jump() {
      tone(620, 0.12, "triangle", 0.05);
    },
    pickup() {
      tone(880, 0.08, "sine", 0.05);
      tone(1170, 0.1, "sine", 0.04, 0.06);
    },
    bin() {
      tone(523, 0.1, "triangle", 0.06);
      tone(659, 0.1, "triangle", 0.05, 0.07);
      tone(784, 0.16, "triangle", 0.05, 0.14);
    },
    toss() {
      tone(420, 0.08, "square", 0.03);
    },
    swap() {
      tone(700, 0.1, "sine", 0.05);
      tone(520, 0.12, "sine", 0.04, 0.08);
    },
    star() {
      tone(988, 0.1, "sine", 0.05);
      tone(1318, 0.16, "sine", 0.04, 0.08);
    },
    whoops() {
      tone(330, 0.16, "sine", 0.05);
      tone(220, 0.2, "sine", 0.04, 0.08);
    },
    nope() {
      tone(200, 0.1, "square", 0.03);
    },
    win() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.2, "triangle", 0.06, i * 0.12));
    },
    music(nowPlaying: boolean) {
      if (!ctx || muted || !nowPlaying) return;
      const t = ctx.currentTime;
      if (t < nextAt) return;
      const freq = melody[step % melody.length];
      if (freq) tone(freq, 0.22, "sine", 0.018);
      step += 1;
      nextAt = t + (step % 8 === 0 ? 0.42 : 0.28);
    },
  };
}

export type AudioBus = ReturnType<typeof createAudio>;
