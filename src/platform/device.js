/**
 * Класс устройства: ПК, Android, iOS и запас по CPU/памяти.
 * deviceMemory нет в Safari и Firefox — тогда решают ядра, сеть и указатель.
 */
export function detectDevice() {
  const ua = navigator.userAgent || "";
  const touchPoints = navigator.maxTouchPoints || 0;
  const ios = /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === "MacIntel" && touchPoints > 1);
  const android = /Android/i.test(ua);
  let os = "other";
  if (ios) os = "ios";
  else if (android) os = "android";
  else if (/Windows/i.test(ua)) os = "windows";
  else if (/Mac OS/i.test(ua)) os = "macos";
  else if (/Linux/i.test(ua)) os = "linux";

  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const mobileOs = ios || android;
  const shortSide = Math.min(screen.width || 0, screen.height || 0);
  const tablet = mobileOs && shortSide >= 768;
  const form = tablet ? "tablet" : mobileOs || coarse ? "mobile" : "desktop";
  const mem = Number(navigator.deviceMemory) || 0;
  const cores = Number(navigator.hardwareConcurrency) || 8;
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const weak = saveData || cores <= 2 || (mem > 0 && mem <= 2) || (android && mem > 0 && mem <= 3);

  return {
    os,
    form,
    touch: touchPoints > 0 || coarse,
    mem,
    cores,
    saveData,
    weak,
    dpr: window.devicePixelRatio || 1,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    standalone: window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true
  };
}

export function resolveProfile(device) {
  let tier = "high";
  if (device.weak) tier = "low";
  else if (device.form !== "desktop" || device.cores <= 4 || (device.mem > 0 && device.mem <= 4)) tier = "medium";

  const quality = tier === "high" ? "high" : tier;
  const dprCap = tier === "low" ? 1.5 : 2;
  const fpsCap = tier === "low" ? 30 : tier === "medium" && device.form !== "desktop" ? 45 : 0;
  return { tier, quality, dprCap, fpsCap };
}
