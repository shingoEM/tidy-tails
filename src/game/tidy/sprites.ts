export type Frames = HTMLImageElement[];

export type SpriteBank = {
  sunny: { idle: Frames; run: Frames; jump: Frames };
  pip: { idle: Frames; run: Frames; jump: Frames };
  props: Frames;
  bins: Frames;
  mom: Frames;
  dad: Frames;
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(src));
    img.src = src;
  });
}

async function seq(dir: string, prefix: string) {
  return Promise.all([1, 2, 3, 4].map((n) => loadImage(`/sprites/${dir}/${prefix}-${n}.png`)));
}

export async function loadSprites(): Promise<SpriteBank> {
  const [sunnyIdle, sunnyRun, sunnyJump, pipIdle, pipRun, pipJump, props, bins, mom, dad] =
    await Promise.all([
      seq("sunny-idle", "idle"),
      seq("sunny-run", "run"),
      seq("sunny-jump", "jump"),
      seq("pip-idle", "idle"),
      seq("pip-run", "run"),
      seq("pip-jump", "jump"),
      seq("props", "frame"),
      seq("bins", "frame"),
      seq("mom", "idle"),
      seq("dad", "idle"),
    ]);
  return {
    sunny: { idle: sunnyIdle, run: sunnyRun, jump: sunnyJump },
    pip: { idle: pipIdle, run: pipRun, jump: pipJump },
    props,
    bins,
    mom,
    dad,
  };
}
