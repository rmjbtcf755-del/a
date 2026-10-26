/* Личный кабинет: вход, регистрация, восстановление. */
(function () {
  const API = "https://api.agar.su/api";
  const PASS_RE = /^[0-9a-zA-Z.]{4,64}$/;

  let registerToken = null;
  let recoverToken = null;
  let recoverNeedsEmail = false;
  let recoverHasPass = false;
  let recoverPhase = "pass";
  let recoverNewPass = "";
  let providers = null;
  let onLoggedIn = null;
  let wired = false;
  let regTimerId = null;
  let recTimerId = null;
  /** @type {{ token: string, uid: string, pass: string, fromRegister: boolean } | null} */
  let pendingDone = null;

  function $(id) {
    return document.getElementById(id);
  }

  function setErr(el, text) {
    if (!el) return;
    el.hidden = !text;
    el.textContent = text || "";
  }

  function clearRecErr() {
    setErr($("authRecError"), "");
    setErr($("authRecErrorEmail"), "");
    setErr($("authRecErrorCode"), "");
  }

  function fmtTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ":" + String(r).padStart(2, "0");
  }

  function stopTimer(kind) {
    if (kind === "reg" && regTimerId) {
      clearInterval(regTimerId);
      regTimerId = null;
    }
    if (kind === "rec" && recTimerId) {
      clearInterval(recTimerId);
      recTimerId = null;
    }
  }

  function startCooldown(kind, sec) {
    const total = Math.max(1, Number(sec) || 300);
    const timerEl = $(kind === "reg" ? "authRegTimer" : "authRecTimer");
    const resendBtn = $(kind === "reg" ? "authRegResendBtn" : "authRecResendBtn");
    stopTimer(kind);
    if (timerEl) {
      timerEl.hidden = false;
      timerEl.innerHTML = "Новый код через <b>" + fmtTime(total) + "</b>";
    }
    if (resendBtn) resendBtn.hidden = true;

    let left = total;
    const tick = () => {
      left -= 1;
      if (left <= 0) {
        stopTimer(kind);
        if (timerEl) {
          timerEl.hidden = true;
          timerEl.innerHTML = "";
        }
        if (resendBtn) resendBtn.hidden = false;
        return;
      }
      if (timerEl) timerEl.innerHTML = "Новый код через <b>" + fmtTime(left) + "</b>";
    };
    const id = setInterval(tick, 1000);
    if (kind === "reg") regTimerId = id;
    else recTimerId = id;
  }

  function setRegStep(n) {
    document.querySelectorAll("#authRegSteps .lk-auth-step").forEach((el) => {
      el.classList.toggle("is-on", Number(el.getAttribute("data-step")) <= n);
    });
  }

  function hideAll(ids) {
    ids.forEach((id) => {
      const el = $(id);
      if (el) el.hidden = true;
    });
  }

  function showView(name) {
    const login = $("authCardLogin");
    const reg = $("authCardRegister");
    const rec = $("authCardRecover");
    const done = $("authCardDone");
    if (login) login.hidden = name !== "login";
    if (reg) reg.hidden = name !== "register";
    if (rec) rec.hidden = name !== "recover";
    if (done) done.hidden = name !== "done";
    if (name !== "done") pendingDone = null;
    if (name === "register") resetRegister();
    if (name === "recover") {
      resetRecover();
    }
  }

  function resetRegister() {
    registerToken = null;
    stopTimer("reg");
    setErr($("authRegError"), "");
    setErr($("authRegErrorCode"), "");
    setErr($("authRegErrorPass"), "");
    hideAll(["authRegStepCode", "authRegStepPass"]);
    const email = $("authRegStepEmail");
    if (email) email.hidden = false;
    setRegStep(1);
    const hint = $("authRegHint");
    if (hint) hint.textContent = "Укажите почту";
    const resend = $("authRegResendBtn");
    if (resend) resend.hidden = true;
    const timer = $("authRegTimer");
    if (timer) timer.hidden = true;
  }

  function resetRecover() {
    persistRecoverToken(null);
    stopTimer("rec");
    clearRecErr();
    hideAll([
      "authRecStepEmail",
      "authRecStepCode",
      "authRecStepPass",
    ]);
    const pick = $("authRecPick");
    if (pick) pick.hidden = false;
    const hint = $("authRecHint");
    if (hint) hint.textContent = "Выберите способ";
    const resend = $("authRecResendBtn");
    if (resend) resend.hidden = true;
    const timer = $("authRecTimer");
    if (timer) timer.hidden = true;
  }

  function showRecOnly(stepId, hintText) {
    hideAll([
      "authRecPick",
      "authRecStepEmail",
      "authRecStepCode",
      "authRecStepPass",
    ]);
    const step = $(stepId);
    if (step) step.hidden = false;
    const hint = $("authRecHint");
    if (hint && hintText) hint.textContent = hintText;
  }

  function persistRecoverToken(token) {
    recoverToken = token || null;
    try {
      if (token) sessionStorage.setItem("lk_recover_token", token);
      else sessionStorage.removeItem("lk_recover_token");
    } catch (_) {}
  }

  function loadRecoverToken() {
    if (recoverToken) return recoverToken;
    try {
      recoverToken = sessionStorage.getItem("lk_recover_token");
    } catch (_) {}
    return recoverToken;
  }

  function ensureBindFields() {
    const step = $("authRecStepPass");
    if (!step || $("authRecBindEmail")) return;
    const email = document.createElement("input");
    email.className = "lk-auth-input";
    email.id = "authRecBindEmail";
    email.type = "email";
    email.maxLength = 190;
    email.placeholder = "Почта для привязки";
    email.autocomplete = "email";
    const code = document.createElement("input");
    code.className = "lk-auth-input";
    code.id = "authRecBindCode";
    code.type = "text";
    code.inputMode = "numeric";
    code.maxLength = 5;
    code.placeholder = "Код из письма";
    code.autocomplete = "one-time-code";
    code.hidden = true;
    const pass = $("authRecPass");
    let anchor = pass;
    if (anchor && anchor.parentElement !== step) anchor = anchor.parentElement;
    if (anchor && anchor.parentElement === step) {
      step.insertBefore(email, anchor);
      step.insertBefore(code, anchor);
    } else {
      step.prepend(code);
      step.prepend(email);
    }
  }

  function showPassField(show) {
    const pass = $("authRecPass");
    const label = pass && pass.closest("label");
    const hintP = label && label.nextElementSibling;
    if (label) label.hidden = !show;
    else if (pass) pass.hidden = !show;
    if (hintP && hintP.classList && hintP.classList.contains("lk-auth-hint")) hintP.hidden = !show;
    if (!show && pass) pass.value = "";
  }

  function showSetPassword(needsEmail) {
    recoverNeedsEmail = !!needsEmail;
    recoverPhase = "pass";
    recoverNewPass = "";
    clearRecErr();
    ensureBindFields();
    const email = $("authRecBindEmail");
    const code = $("authRecBindCode");
    if (email) {
      email.hidden = true;
      email.value = "";
    }
    if (code) {
      code.hidden = true;
      code.value = "";
    }
    showPassField(true);
    const btn = $("authRecSetPassBtn");
    if (btn) btn.textContent = recoverNeedsEmail ? "Дальше" : "Сохранить пароль";
    showRecOnly("authRecStepPass", "Придумайте новый пароль");
  }

  function openRecoverPassword(token, needsEmail, hasPass) {
    if (!token) return;
    const login = $("authCardLogin");
    const reg = $("authCardRegister");
    const rec = $("authCardRecover");
    const done = $("authCardDone");
    if (login) login.hidden = true;
    if (reg) reg.hidden = true;
    if (done) done.hidden = true;
    if (rec) rec.hidden = false;
    persistRecoverToken(token);
    showSetPassword(!!needsEmail);
  }

  async function api(path, body, timeoutMs = 25000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(API + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
        signal: ctrl.signal,
      });
      let data = {};
      try {
        data = await res.json();
      } catch (_) {}
      return { res, data };
    } catch (e) {
      if (e && e.name === "AbortError") {
        return {
          res: { ok: false, status: 408 },
          data: { error: "Сервер не ответил. Попробуйте ещё раз." },
        };
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadProviders() {
    if (providers) return providers;
    try {
      const res = await fetch(API + "/auth/providers");
      providers = await res.json();
    } catch (_) {
      providers = {};
    }
    return providers;
  }

  function finishLogin(token) {
    if (!token) return;
    pendingDone = null;
    if (typeof onLoggedIn === "function") onLoggedIn(token);
    else if (window.wHandle && typeof window.wHandle.onAccountLoggedIn === "function") {
      window.wHandle.onAccountLoggedIn(token);
    }
  }

  /** LK login id from API (uid / ulogin / id) — never email. */
  function resolveLkUid(data) {
    const raw = data && (data.uid ?? data.ulogin ?? data.id);
    const uid = String(raw == null ? "" : raw).trim();
    return /^\d{1,12}$/.test(uid) ? uid : "";
  }

  /** Banner instead of alert: show ID + pass, then OK → login. No OS password save. */
  function showDoneBanner(uid, pass, token, fromRegister) {
    const id = resolveLkUid({ uid });
    if (!token) return;
    if (!id) {
      finishLogin(token);
      return;
    }
    pendingDone = {
      token,
      uid: id,
      pass: String(pass || ""),
      fromRegister: !!fromRegister,
    };

    const loginId = $("authLoginId");
    if (loginId) loginId.value = id;

    const title = $("authDoneTitle");
    const hint = $("authDoneHint");
    const idEl = $("authDoneId");
    const passEl = $("authDonePass");
    const mailHint = $("authDoneMailHint");

    if (title) title.textContent = fromRegister ? "ЛК создан" : "Пароль сохранён";
    if (hint) {
      hint.textContent = fromRegister
        ? "Запомните ID и пароль для входа"
        : "Запомните ID и новый пароль для входа";
    }
    if (idEl) idEl.textContent = id;
    if (passEl) passEl.textContent = String(pass || "");
    if (mailHint) mailHint.hidden = !fromRegister;

    showView("done");
  }

  function confirmDoneBanner() {
    const pending = pendingDone;
    if (!pending || !pending.token) return;
    const loginId = $("authLoginId");
    if (loginId) loginId.value = pending.uid;
    finishLogin(pending.token);
  }

  async function doLogin(ev) {
    if (ev) ev.preventDefault();
    const err = $("authLoginError");
    const btn = $("authLoginBtn");
    const ulogin = ($("authLoginId")?.value || "").trim();
    const pass = $("authLoginPass")?.value || "";
    setErr(err, "");
    if (!/^\d{1,12}$/.test(ulogin)) return setErr(err, "Введите ID ЛК (число)");
    if (!pass) return setErr(err, "Введите пароль");
    if (btn) btn.disabled = true;
    try {
      const { res, data } = await api("/auth/login", { ulogin, pass });
      if (!res.ok || data.error || !data.token) {
        setErr(err, data.error || "Ошибка входа");
        return;
      }
      finishLogin(data.token);
    } catch (_) {
      setErr(err, "Ошибка сети");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function regSend(isResend) {
    const err = isResend ? $("authRegErrorCode") : $("authRegError");
    const btn = isResend ? $("authRegResendBtn") : $("authRegSendBtn");
    const email = ($("authRegEmail")?.value || "").trim();
    setErr(err, "");
    if (btn) btn.disabled = true;
    if (err) {
      err.hidden = false;
      err.textContent = "Отправляем код…";
    }
    try {
      const { res, data } = await api("/auth/register/send-code", { email }, 28000);
      if (!res.ok || data.error) {
        setErr(err, data.error || "Не удалось отправить код");
        if (data.cooldownSec) startCooldown("reg", data.cooldownSec);
        return;
      }
      $("authRegStepEmail").hidden = true;
      $("authRegStepCode").hidden = false;
      setRegStep(2);
      $("authRegHint").textContent = "Код из письма";
      startCooldown("reg", data.cooldownSec || 300);
    } catch (_) {
      setErr(err, "Ошибка сети");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function regVerify() {
    const err = $("authRegErrorCode") || $("authRegError");
    const email = ($("authRegEmail")?.value || "").trim();
    const code = ($("authRegCode")?.value || "").trim();
    setErr(err, "");
    try {
      const { res, data } = await api("/auth/register/verify-code", { email, code });
      if (!res.ok || data.error || !data.registerToken) {
        setErr(err, data.error || "Неверный код");
        return;
      }
      registerToken = data.registerToken;
      stopTimer("reg");
      $("authRegStepCode").hidden = true;
      $("authRegStepPass").hidden = false;
      setRegStep(3);
      $("authRegHint").textContent = "Придумайте пароль";
    } catch (_) {
      setErr(err, "Ошибка сети");
    }
  }

  async function regCreate() {
    const err = $("authRegErrorPass") || $("authRegError");
    const pass = $("authRegPass")?.value || "";
    setErr(err, "");
    if (!PASS_RE.test(pass)) {
      return setErr(err, "Пароль: латиница, цифры и точка, 4–64");
    }
    try {
      const { res, data } = await api("/auth/register/create", {
        registerToken,
        pass,
      });
      if (!res.ok || data.error || !data.token) {
        setErr(err, data.error || "Не удалось создать");
        return;
      }
      const uid = resolveLkUid(data);
      showDoneBanner(uid, pass, data.token, true);
    } catch (_) {
      setErr(err, "Ошибка сети");
    }
  }

  async function recSend(isResend) {
    const err = isResend
      ? $("authRecErrorCode") || $("authRecError")
      : $("authRecErrorEmail") || $("authRecError");
    const email = ($("authRecEmail")?.value || "").trim();
    setErr(err, "");
    try {
      const { res, data } = await api("/auth/recover/send-code", { email });
      if (!res.ok || data.error) {
        setErr(err, data.error || "Не удалось отправить код");
        if (data.cooldownSec) startCooldown("rec", data.cooldownSec);
        return;
      }
      showRecOnly("authRecStepCode", "Код из письма");
      startCooldown("rec", data.cooldownSec || 300);
    } catch (_) {
      setErr(err, "Ошибка сети");
    }
  }

  async function recVerify() {
    const err = $("authRecErrorCode") || $("authRecError");
    const email = ($("authRecEmail")?.value || "").trim();
    const code = ($("authRecCode")?.value || "").trim();
    setErr(err, "");
    try {
      const { res, data } = await api("/auth/recover/verify-code", { email, code });
      if (!res.ok || data.error || !data.recoverToken) {
        setErr(err, data.error || "Неверный код");
        return;
      }
      stopTimer("rec");
      openRecoverPassword(data.recoverToken, !!data.needs_email, !!data.has_pass);
    } catch (_) {
      setErr(err, "Ошибка сети");
    }
  }

  async function recSetPass() {
    const pass = $("authRecPass")?.value || "";
    const token = loadRecoverToken();
    const hint = $("authRecHint");
    if (!token) {
      if (hint) hint.textContent = "Сессия сброшена. Выберите способ заново.";
      resetRecover();
      return;
    }
    try {
      if (recoverNeedsEmail && recoverPhase === "mail") {
        const email = ($("authRecBindEmail")?.value || "").trim();
        const code = (($("authRecBindCode")?.value || "").trim().replace(/\D/g, ""));
        if (!email) {
          if (hint) hint.textContent = "Введите почту";
          return;
        }
        if (!/^\d{5}$/.test(code)) {
          if (!code) {
            const { res, data } = await api("/auth/recover/bind-email/send-code", {
              recoverToken: token,
              email,
            });
            if (!res.ok || data.error) {
              if (hint) hint.textContent = data.error || "Не удалось отправить код";
              return;
            }
            const codeEl = $("authRecBindCode");
            if (codeEl) {
              codeEl.hidden = false;
              codeEl.focus();
            }
            const btn = $("authRecSetPassBtn");
            if (btn) btn.textContent = "Подтвердить";
            if (hint) hint.textContent = "Код отправлен на почту";
            return;
          }
          if (hint) hint.textContent = "Введите 5-значный код из письма";
          return;
        }
        const { res, data } = await api("/auth/recover/bind-email/confirm", {
          recoverToken: token,
          email,
          code,
        });
        if (!res.ok || data.error || !data.token) {
          if (hint) hint.textContent = data.error || "Не удалось привязать";
          return;
        }
        persistRecoverToken(null);
        recoverNeedsEmail = false;
        showDoneBanner(resolveLkUid(data), recoverNewPass, data.token, false);
        return;
      }
      if (!PASS_RE.test(pass)) {
        if (hint) hint.textContent = "Пароль: латиница, цифры и точка, 4–64";
        return;
      }
      const { res, data } = await api("/auth/recover/set-password", {
        recoverToken: token,
        pass,
      });
      if (!res.ok || data.error || !data.token) {
        if (hint) hint.textContent = data.error || "Не удалось сохранить";
        return;
      }
      if (data.needs_email) {
        recoverNewPass = pass;
        recoverNeedsEmail = true;
        recoverPhase = "mail";
        showPassField(false);
        const emailEl = $("authRecBindEmail");
        if (emailEl) {
          emailEl.hidden = false;
          emailEl.focus();
        }
        const codeEl = $("authRecBindCode");
        if (codeEl) {
          codeEl.hidden = true;
          codeEl.value = "";
        }
        const btn = $("authRecSetPassBtn");
        if (btn) btn.textContent = "Отправить код";
        if (hint) hint.textContent = "Укажите почту, затем код из письма";
        return;
      }
      persistRecoverToken(null);
      showDoneBanner(resolveLkUid(data), pass, data.token, false);
    } catch (_) {
      if (hint) hint.textContent = "Ошибка сети";
    }
  }

  function pickRecoverMethod(method) {
    clearRecErr();
    if (method === "email") {
      showRecOnly("authRecStepEmail", "Email аккаунта");
    }
  }

  function wire() {
    if (wired) return;
    wired = true;

    document.querySelectorAll("[data-auth-view]").forEach((btn) => {
      btn.addEventListener("click", () => showView(btn.getAttribute("data-auth-view")));
    });

    const idInput = $("authLoginId");
    if (idInput) {
      idInput.addEventListener("input", () => {
        const digits = idInput.value.replace(/\D/g, "").slice(0, 12);
        if (idInput.value !== digits) idInput.value = digits;
      });
    }
    $("authLoginForm")?.addEventListener("submit", doLogin);
    $("authDoneOkBtn")?.addEventListener("click", confirmDoneBanner);
    $("authRegSendBtn")?.addEventListener("click", () => regSend(false));
    $("authRegResendBtn")?.addEventListener("click", () => regSend(true));
    $("authRegVerifyBtn")?.addEventListener("click", regVerify);
    $("authRegCreateBtn")?.addEventListener("click", regCreate);
    $("authRecSendBtn")?.addEventListener("click", () => recSend(false));
    $("authRecResendBtn")?.addEventListener("click", () => recSend(true));
    $("authRecVerifyBtn")?.addEventListener("click", recVerify);
    $("authRecSetPassBtn")?.addEventListener("click", recSetPass);

    document.querySelectorAll("[data-rec-method]").forEach((btn) => {
      btn.addEventListener("click", () => pickRecoverMethod(btn.getAttribute("data-rec-method")));
    });

    $("authRecBackPick")?.addEventListener("click", resetRecover);
    document.querySelectorAll("[data-rec-back]").forEach((btn) => {
      btn.addEventListener("click", resetRecover);
    });

    document.addEventListener("lk-recover-ready", (ev) => {
      const token = ev.detail?.recoverToken;
      if (!token) return;
      // НЕ вызывать showView("recover") — он делает resetRecover() и убивает токен
      openRecoverPassword(token, ev.detail?.needs_email !== false, !!ev.detail?.has_pass);
    });
  }

  window.AgarLkAuth = {
    init(hooks) {
      onLoggedIn = hooks?.onLoggedIn || null;
      wire();
      showView("login");
    },
    showView,
    applyRecoverToken(token, flags) {
      openRecoverPassword(token, !flags || flags.needs_email !== false, !!(flags && flags.has_pass));
    },
  };
})();
