import { installLoop } from "../core/loop.js";
import { installSurface } from "../render/surface.js";

export function installRuntime(profile) {
  installSurface(profile);
  installLoop(profile);
}
