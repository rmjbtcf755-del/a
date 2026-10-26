import { installLoop } from "../core/loop.js";
import { installSurface } from "../render/surface.js";

/** Ставится до загрузки игровой сессии: она читает devicePixelRatio и getContext при старте. */
export function installRuntime(profile) {
  installSurface(profile);
  installLoop(profile);
}
