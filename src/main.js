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
  EntropySystem
} from "./game/EntropySystem.js";

import {
  HudLayer
} from "./ui/HudLayer.js";

import {
  EntropyLayer
} from "./ui/EntropyLayer.js";

import {
  MeltdownLayer
} from "./ui/MeltdownLayer.js";

import {
  FinaleController
} from "./ui/FinaleController.js";

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

  const entropyCanvas =
    document.getElementById(
      "entropyLayer"
    );

  const entityOverlay =
    document.getElementById(
      "entityOverlay"
    );

  const entityPanel =
    entityOverlay.querySelector(
      ".entity-terminal"
    );

  const meltdownCanvas =
    document.getElementById(
      "meltdownLayer"
    );

  const debugPanel =
    document.getElementById(
      "debugPanel"
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

  const entropyLayer =
    new EntropyLayer(
      entropyCanvas,
      [
        oceanCanvas,
        aquariumCanvas,
        interactionCanvas,
        hudCanvas
      ],
      config
    );

  const meltdownLayer =
    new MeltdownLayer(
      meltdownCanvas
    );

  let bucket =
    null;

  let gameTerminated =
    false;

  const terminateGameForMeltdown =
    () => {
      if (
        gameTerminated
      ) {
        return;
      }

      gameTerminated =
        true;

      // The Congratulations input is the real end of the game. Stop every
      // lower animation loop; Meltdown is the only system that keeps running.
      bucket?.destroy();
      entropyLayer.destroy();
      hud.destroy();
      aquarium.destroy();
      engine.destroy();

      for (
        const layer
        of [
          oceanCanvas,
          aquariumCanvas,
          interactionCanvas,
          hudCanvas,
          entropyCanvas
        ]
      ) {
        layer.hidden =
          true;
      }

      if (
        debugPanel
      ) {
        debugPanel.hidden =
          true;
      }
    };

  const finale =
    new FinaleController(
      entityOverlay,
      entityPanel,
      meltdownLayer,
      {
        onLockInput:
          () => {
            bucket?.setInputEnabled(
              false
            );
          },
        onMeltdownStart:
          () => {
            terminateGameForMeltdown();
          }
      }
    );

  const entropy =
    new EntropySystem(
      config,
      {
        onDisplayChanged:
          ({
            label,
            value
          }) => {
            hud.setProgressionOverride(
              label,
              value
            );
          },
        onStateChanged:
          (state) => {
            entropyLayer.setState(
              state
            );
          },
        onStarted:
          ({
            source
          }) => {
            console.debug(
              `[entropy] started: ${source}`
            );
          },
        onCompleted:
          () => {
            console.debug(
              "[entropy] reached zero"
            );

            finale.showEntity();
          }
      }
    );

  const startEntropy =
    (
      source,
      {
        restart = false
      } = {}
    ) => {
      return entropy.start(
        source,
        {
          restart,
          startValue:
            hud.appetite
        }
      );
    };

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

            if (
              total >= 3
            ) {
              startEntropy(
                `buffer-${emotion}-3`
              );
            }

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

      entropy.update(
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
            leveledUp,
            bucketRows
          }) => {
            hud.setAppetite(
              appetiteTarget,
              {
                pulse:
                  leveledUp
              }
            );

            if (
              bucketRows >= 10
            ) {
              startEntropy(
                "bucket-10"
              );
            }
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

  bucket =
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
    onStartEntropy:
      () => {
        startEntropy(
          "debug",
          {
            restart: true
          }
        );
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
        finale.active
      ) {
        return;
      }

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
  entropyLayer.start();
  meltdownLayer.start();
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
