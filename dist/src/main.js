import { loadConfig } from "./config.js";
import { OceanEngine } from "./ocean/OceanEngine.js";
import { BucketLayer } from "./interaction/BucketLayer.js";
import { AttentionSystem } from "./game/AttentionSystem.js";
import { HudLayer } from "./ui/HudLayer.js";
import { setupDebugPanel } from "./ui/debugPanel.js";
import { setupFullscreen } from "./ui/fullscreen.js";

const config = loadConfig();
const oceanCanvas = document.getElementById("ocean");
const interactionCanvas = document.getElementById("interactionLayer");
const hudCanvas = document.getElementById("hudLayer");

const engine = new OceanEngine(oceanCanvas, config);
const hud = new HudLayer(hudCanvas, engine);

const attention = new AttentionSystem(config, {
  onCellScored: (event) => {
    hud.addAttention(event);
  },
  onScoreChanged: ({ total }) => {
    hud.setAttention(total);
  }
});

const bucket = new BucketLayer(interactionCanvas, engine, {
  onRefresh: () => {
    engine.regenerate(true, false);
  },
  onAttentionCellDrained: ({ sourceX, sourceY }) => {
    attention.scoreDrainedCell({
      sourceX,
      sourceY
    });
  },
  onDiscardedSlots: (count) => {
    attention.registerDiscardedSlots(count);
  }
});

setupFullscreen();
setupDebugPanel({ config, engine });

document.addEventListener("visibilitychange", () => {
  engine.paused = document.hidden;
});

// R não gera mais uma nova variação. Novos mares só surgem pelo
// botão do debug ou pelo pull-to-refresh (arraste de cima para baixo).
window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    engine.paused = !engine.paused;
  }
});

async function boot() {
  try {
    await document.fonts?.ready;
  } finally {
    engine.start();
    hud.start();
    bucket.start();
  }
}

boot();
