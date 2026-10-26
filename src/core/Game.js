import { detectDevice, resolveProfile } from "../platform/device.js";
import { installRuntime } from "../platform/runtime.js";
import { attachViewport, markDocument } from "../platform/viewport.js";
import { applyProfile } from "../settings/profile.js";
import "../core/math.js";
import "../core/events.js";
import "../net/Reader.js";
import "../net/opcodes.js";

let started = false;

function loadClassic(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load " + url));
    document.head.appendChild(script);
  });
}

function scriptUrl(relativePath) {
  return new URL(relativePath, import.meta.url).href;
}

export async function startGame() {
  if (started) return;
  started = true;

  const device = detectDevice();
  const profile = resolveProfile(device);
  window.__clientProfile = { device, profile };

  markDocument(device, profile);
  installRuntime(profile);
  applyProfile(profile);
  attachViewport();

  await loadClassic(scriptUrl("../i18n/i18n.js"));
  await loadClassic(scriptUrl("../account/auth.js"));
  await loadClassic(scriptUrl("../social/friends.js"));
  await loadClassic(scriptUrl("../social/admin.js"));
  await loadClassic(scriptUrl("../game/engine.js"));

  if (typeof window.__agarStartEngine !== "function") {
    throw new Error("Game session did not register");
  }
  await window.__agarStartEngine();
}
