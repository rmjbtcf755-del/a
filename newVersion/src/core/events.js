/** Шина меню: магазин, смерть, аккаунт, смена сервера. */
  export class AppEvents extends EventTarget {
    emit(type, detail) {
      this.dispatchEvent(new CustomEvent(type, {
        detail
      }));
    }
    on(type, handler) {
      this.addEventListener(type, handler);
      return () => this.removeEventListener(type, handler);
    }
  };
  export const bus = new AppEvents();
  export const Events = {
    SHOW_CONTENT: "show-content",
    XP_UPDATE: "xp-update",
    DEATH: "death",
    BAN: "ban",
    AUTH: "auth",
    LOGOUT: "logout",
    SERVER_CHANGE: "server-change"
  };
window.AppEvents = AppEvents;
window.bus = bus;
window.Events = Events;
