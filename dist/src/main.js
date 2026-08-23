import {
  loadConfig
} from "./config.js";

import {
  OceanEngine
} from "./ocean/OceanEngine.js";

import {
  BucketLayer
} from "./interaction/BucketLayer.js";

import {
  AttentionSystem
} from "./game/AttentionSystem.js";

import {
  ProgressionSystem
} from "./game/ProgressionSystem.js";

import {
  GachaSystem
} from "./game/GachaSystem.js";

import {
  NervousSystem
} from "./game/NervousSystem.js";

import {
  HudLayer
} from "./ui/HudLayer.js";

import {
  AquariumLayer
} from "./ui/AquariumLayer.js";

import {
  setupDebugPanel
} from "./ui/debugPanel.js";

import {
  setupFullscreen
} from "./ui/fullscreen.js";

setupFullscreen();

async function boot() {
  const config =
    await loadConfig();

  const oceanCanvas =
    document.getElementById(
      "ocean"
    );

  const interactionCanvas =
    document.getElementById(
      "interactionLayer"
    );

  const aquariumCanvas =
    document.getElementById(
      "aquariumLayer"
    );

  const hudCanvas =
    document.getElementById(
      "hudLayer"
    );

  const engine =
    new OceanEngine(
      oceanCanvas,
      config
    );

  const aquarium =
    new AquariumLayer(
      aquariumCanvas,
      engine,
      config
    );

  const hud =
    new HudLayer(
      hudCanvas,
      engine
    );

  const nervous =
    new NervousSystem(
      config,
      {
        onBufferChanged:
          (state) => {
            hud.setNervousBufferState(
              state
            );
          },
        onEmotionScored:
          ({
            emotion,
            total
          }) => {
            aquarium
              .registerEmotionScore(
                emotion,
                total
              );

            console.debug(
              `[nervous] ${emotion}: ${total}`
            );
          }
      }
    );

  const gacha =
    new GachaSystem(
      config,
      {
        chanceResolver:
          ({
            base,
            context
          }) => {
            const bucketRows =
              Math.max(
                1,
                Math.round(
                  Number(
                    context
                      ?.bucketRows
                  ) || 1
                )
              );

            if (
              bucketRows <
              config.gachaUnlockBucketRows
            ) {
              return {
                joy: 0,
                rage: 0,
                fear: 0,
                grief: 0
              };
            }

            return nervous
              .getAdaptiveGachaChances(
                base
              );
          }
      }
    );

  hud.setFrameUpdateHook(
    (deltaMs) => {
      nervous.update(
        deltaMs
      );
    }
  );

  let attention;

  const progression =
    new ProgressionSystem(
      config,
      {
        onProgressionChanged:
          ({
            appetiteTarget,
            leveledUp
          }) => {
            hud.setAppetite(
              appetiteTarget,
              {
                pulse:
                  leveledUp
              }
            );
          }
      }
    );

  attention =
    new AttentionSystem(
      config,
      {
        onCellScored: (
          event
        ) => {
          hud.addAttention(
            event
          );
        },
        onScoreChanged:
          ({
            total
          }) => {
            hud.setAttention(
              total
            );

            progression
              .syncWithAttention(
                total
              );
          }
      }
    );

  const bucket =
    new BucketLayer(
      interactionCanvas,
      engine,
      {
        onRefresh: () => {
          // First valid swipe: remove the onboarding prompt character by
          // character. This is independent from whether the bucket has
          // already finished draining.
          hud.dismissNervousPrompt();

          engine.regenerate(
            true,
            false
          );
        },
        onAttentionCellDrained:
          ({
            sourceX,
            sourceY
          }) => {
            attention
              .scoreDrainedCell({
                sourceX,
                sourceY
              });
          },
        onSpecialCellDrainStart:
          (event) => {
            hud.announceNervousSignal(
              event
            );
          },
        onSpecialCellDrained:
          ({
            id,
            color,
            sourceX,
            sourceY
          }) => {
            nervous.collectEmotion(
              id
            );

            hud.addNervousEmotionBurst({
              emotion:
                id,
              color,
              sourceX,
              sourceY
            });
          },
        onDiscardedSlots:
          (count) => {
            attention
              .registerDiscardedSlots(
                count
              );

            // If the current special cell is discarded, its terminal message
            // is discarded with it.
            hud.cancelNervousSignal();
          },
        onOceanOffsetChanged:
          (offsetY) => {
            aquarium
              .setViewOffset(
                offsetY
              );
          },
        onFirstLoadingRowCompleted:
          () => {
            if (
              progression.bucketRows === 1 &&
              progression.completedSwipeCount <
                progression.onboardingSwipeTarget
            ) {
              hud.showNervousPrompt(
                "swipe"
              );
            }
          },
        onSwipeCycleCompleted:
          () => {
            // Progression 1 -> 2 is counted only after the swipe cycle has
            // naturally finished, so all onboarding Attention is excluded
            // from the later +100 progression baseline.
            progression
              .registerCompletedSwipe();
          },
        gachaSystem:
          gacha
      }
    );

  // Initial HUD state from game-config.json.
  hud.setAttention(
    attention.total
  );

  progression
    .syncWithAttention(
      attention.total,
      {
        allowLevelUp: false
      }
    );

  setupDebugPanel({
    config,
    engine,
    onIncreaseActiveBuffer:
      () => {
        nervous.increaseActiveBuffer(
          1
        );
      },
    onResetActiveBuffer:
      () => {
        nervous.resetActiveBuffer();
      },
    onConfigChanged:
      (
        key
      ) => {
        if (
          key ===
            "bucketLoadingRows" ||
          key ===
            "appetiteMultiplier"
        ) {
          progression
            .refreshFromConfig(
              attention.total
            );
        }
      }
  });

  document.addEventListener(
    "visibilitychange",
    () => {
      engine.paused =
        document.hidden;
    }
  );

  // R does not create a new variation.
  window.addEventListener(
    "keydown",
    (event) => {
      if (
        event.code === "Space"
      ) {
        event.preventDefault();

        engine.paused =
          !engine.paused;
      }
    }
  );

  await document.fonts?.ready;

  engine.start();
  aquarium.start();
  hud.start();
  bucket.start();
}

boot().catch(
  (error) => {
    console.error(
      "Falha ao iniciar ASCII Ocean:",
      error
    );

    const fallback =
      document.createElement(
        "pre"
      );

    fallback.style.cssText =
      [
        "position:absolute",
        "inset:0",
        "z-index:100",
        "margin:0",
        "padding:16px",
        "overflow:auto",
        "background:#02091f",
        "color:#fff35d",
        "font:14px monospace"
      ].join(";");

    fallback.textContent =
      [
        "ERRO DE CONFIGURAÇÃO",
        "",
        error.message,
        "",
        "Revise game-config.json e recarregue."
      ].join("\n");

    document.body.appendChild(
      fallback
    );
  }
);
