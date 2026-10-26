export function installSurface(profile) {
  const nativeDpr = window.devicePixelRatio || 1;
  const cap = Math.max(1, profile.dprCap || nativeDpr);
  try {
    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      get() {
        return Math.min(nativeDpr, cap);
      }
    });
  } catch (e) {}

  const nativeGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, options) {
    if (type === "2d" && this.id === "canvas" && (options == null || options.alpha == null)) {
      options = Object.assign({ alpha: false, desynchronized: true }, options || {});
    }
    return nativeGetContext.call(this, type, options);
  };
}
