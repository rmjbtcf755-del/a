export function installLoop(profile) {
  const native = window.requestAnimationFrame.bind(window);
  const minDelta = profile.fpsCap > 0 ? 1000 / profile.fpsCap : 0;
  let last = 0;

  function schedule(callback) {
    return native((time) => {
      if (document.hidden) {
        const resume = () => {
          if (document.hidden) return;
          document.removeEventListener("visibilitychange", resume);
          schedule(callback);
        };
        document.addEventListener("visibilitychange", resume);
        return;
      }
      if (minDelta > 0 && time - last < minDelta) {
        window.setTimeout(() => schedule(callback), minDelta - (time - last));
        return;
      }
      last = time;
      callback(time);
    });
  }

  window.requestAnimationFrame = (callback) => schedule(callback);
}
