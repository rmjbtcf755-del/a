export function markDocument(device, profile) {
  const root = document.documentElement;
  root.classList.add("os-" + device.os, "form-" + device.form, "tier-" + profile.tier);
  if (device.weak) root.classList.add("tier-weak");
  if (device.touch) root.classList.add("has-touch");
  if (device.reducedMotion) root.classList.add("reduce-motion");
  if (device.standalone) root.classList.add("standalone");
  root.dataset.os = device.os;
  root.dataset.form = device.form;
  root.dataset.tier = profile.tier;
  root.style.setProperty("--vvh", window.innerHeight + "px");
}

export function attachViewport() {
  const root = document.documentElement;
  let timer = 0;
  let lastW = 0;
  let lastH = 0;

  const apply = () => {
    const vv = window.visualViewport;
    const w = Math.round(vv ? vv.width : window.innerWidth);
    const h = Math.round(vv ? vv.height : window.innerHeight);
    root.style.setProperty("--vvw", w + "px");
    root.style.setProperty("--vvh", h + "px");
    if (w === lastW && h === lastH) return;
    lastW = w;
    lastH = h;
    window.scrollTo(0, 0);
    window.dispatchEvent(new Event("resize"));
  };

  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(apply, 80);
  };

  apply();
  window.addEventListener("orientationchange", schedule);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) schedule();
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", schedule);
  }
}
