export const held = new Set<string>();

export function setHeld(codes: string[]) {
  held.clear();
  for (const code of codes) held.add(code);
}

export function hold(code: string, on: boolean) {
  if (on) held.add(code);
  else held.delete(code);
}

export function anyHeld(codes: readonly string[]) {
  for (const code of codes) if (held.has(code)) return true;
  return false;
}

export const LEFT_KEYS = ["KeyA", "ArrowLeft", "TouchLeft"] as const;
export const RIGHT_KEYS = ["KeyD", "ArrowRight", "TouchRight"] as const;
export const JUMP_KEYS = ["Space", "KeyW", "ArrowUp", "TouchJump"] as const;
export const DOWN_KEYS = ["KeyS", "ArrowDown", "TouchDown"] as const;
export const GRAB_KEYS = ["KeyE", "KeyF", "TouchGrab"] as const;
export const SWAP_KEYS = ["KeyQ", "Tab", "TouchSwap"] as const;
export const PAUSE_KEYS = ["Escape", "KeyP", "TouchPause"] as const;
