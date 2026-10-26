const KEY = "render_quality";

function hasSavedQuality() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "low" || saved === "medium" || saved === "high") return true;
  } catch (e) {}
  return document.cookie.split(";").some((part) => part.trim().startsWith(KEY + "="));
}

/**
 * Первый запуск: качество берётся из профиля устройства.
 * Если игрок уже выбирал качество в настройках, значение не трогаем.
 */
export function applyProfile(profile) {
  if (hasSavedQuality()) return;
  const value = profile.quality === "low" || profile.quality === "medium" ? profile.quality : "high";
  try {
    localStorage.setItem(KEY, value);
  } catch (e) {}
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = KEY + "=" + value + "; path=/; max-age=31536000; SameSite=Lax" + secure;
}
