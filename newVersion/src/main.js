import { startGame } from "./core/Game.js";

startGame().catch((err) => {
  console.error("Boot failed:", err);
});
