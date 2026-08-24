const ENTROPY_MAX =
  1000;

const SOURCE_LABEL =
  "APETITE";

const TARGET_LABEL =
  "ENTROPY";

const TRANSITION_DURATION_MS =
  1750;

const SCRAMBLE_INTERVAL_MS =
  48;

const SCRAMBLE_GLYPHS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&?*+-=/";

function clamp01(
  value
) {
  return Math.max(
    0,
    Math.min(
      1,
      Number(value) || 0
    )
  );
}

function shuffle(
  values
) {
  const copy =
    [...values];

  for (
    let index =
      copy.length - 1;
    index > 0;
    index -= 1
  ) {
    const swapIndex =
      Math.floor(
        Math.random() *
        (
          index + 1
        )
      );

    const current =
      copy[index];

    copy[index] =
      copy[swapIndex];

    copy[swapIndex] =
      current;
  }

  return copy;
}

export class EntropySystem {
  constructor(
    config,
    {
      onDisplayChanged,
      onStateChanged,
      onStarted,
      onCompleted
    } = {}
  ) {
    this.config =
      config;

    this.onDisplayChanged =
      onDisplayChanged;

    this.onStateChanged =
      onStateChanged;

    this.onStarted =
      onStarted;

    this.onCompleted =
      onCompleted;

    this.state =
      "idle";

    this.value =
      ENTROPY_MAX;

    this.displayValue =
      0;

    this.displayLabel =
      SOURCE_LABEL;

    this.triggerSource =
      null;

    this.transitionElapsedMs =
      0;

    this.scrambleElapsedMs =
      0;

    this.startDisplayValue =
      0;

    this.lockOrder =
      [];

    this.scrambleChars =
      SOURCE_LABEL.split(
        ""
      );

    this.completedEmitted =
      false;
  }

  get maxValue() {
    return ENTROPY_MAX;
  }

  get active() {
    return (
      this.state !==
      "idle"
    );
  }

  get decayPerSecond() {
    const configured =
      Number(
        this.config
          .entropyDecayPerSecond
      );

    return Math.max(
      0,
      Number.isFinite(
        configured
      )
        ? configured
        : 10
    );
  }

  get corruption() {
    if (
      this.state ===
      "idle"
    ) {
      return 0;
    }

    if (
      this.state ===
      "transition"
    ) {
      return (
        0.012 +
        this.transitionProgress *
          0.018
      );
    }

    return clamp01(
      1 -
      this.value /
      ENTROPY_MAX
    );
  }

  get visualIntensity() {
    if (
      this.state ===
      "idle"
    ) {
      return 0;
    }

    if (
      this.state ===
      "transition"
    ) {
      return (
        0.012 +
        this.transitionProgress *
          0.020
      );
    }

    const corruption =
      this.corruption;

    return clamp01(
      0.035 +
      Math.pow(
        corruption,
        1.34
      ) *
      0.965
    );
  }

  get transitionProgress() {
    return clamp01(
      this.transitionElapsedMs /
      TRANSITION_DURATION_MS
    );
  }

  start(
    source = "unknown",
    {
      restart = false,
      startValue = 0
    } = {}
  ) {
    if (
      this.active &&
      !restart
    ) {
      return false;
    }

    this.state =
      "transition";

    this.triggerSource =
      String(
        source ??
        "unknown"
      );

    this.value =
      ENTROPY_MAX;

    this.startDisplayValue =
      Math.max(
        0,
        Math.min(
          ENTROPY_MAX,
          Math.floor(
            Number(
              startValue
            ) || 0
          )
        )
      );

    this.displayValue =
      this.startDisplayValue;

    this.displayLabel =
      SOURCE_LABEL;

    this.transitionElapsedMs =
      0;

    this.scrambleElapsedMs =
      SCRAMBLE_INTERVAL_MS;

    this.lockOrder =
      shuffle(
        Array.from(
          {
            length:
              TARGET_LABEL.length
          },
          (
            _,
            index
          ) => index
        )
      );

    this.scrambleChars =
      SOURCE_LABEL.split(
        ""
      );

    this.completedEmitted =
      false;

    this.emitDisplay();
    this.emitState();

    this.onStarted?.(
      {
        source:
          this.triggerSource,
        value:
          this.value
      }
    );

    return true;
  }

  updateTransition(
    deltaMs
  ) {
    this.transitionElapsedMs +=
      deltaMs;

    this.scrambleElapsedMs +=
      deltaMs;

    const progress =
      this.transitionProgress;

    const lockedCount =
      Math.min(
        TARGET_LABEL.length,
        Math.floor(
          progress *
          (
            TARGET_LABEL.length +
            0.8
          )
        )
      );

    const locked =
      new Set(
        this.lockOrder.slice(
          0,
          lockedCount
        )
      );

    if (
      this.scrambleElapsedMs >=
      SCRAMBLE_INTERVAL_MS
    ) {
      this.scrambleElapsedMs =
        this.scrambleElapsedMs %
        SCRAMBLE_INTERVAL_MS;

      for (
        let index = 0;
        index <
        TARGET_LABEL.length;
        index += 1
      ) {
        if (
          locked.has(
            index
          )
        ) {
          this.scrambleChars[
            index
          ] =
            TARGET_LABEL[
              index
            ];

          continue;
        }

        const keepSourceChance =
          Math.max(
            0,
            0.60 -
            progress *
              0.70
          );

        if (
          Math.random() <
          keepSourceChance
        ) {
          this.scrambleChars[
            index
          ] =
            SOURCE_LABEL[
              index
            ];
        } else {
          this.scrambleChars[
            index
          ] =
            SCRAMBLE_GLYPHS[
              Math.floor(
                Math.random() *
                SCRAMBLE_GLYPHS.length
              )
            ];
        }
      }
    }

    for (
      const index
      of locked
    ) {
      this.scrambleChars[
        index
      ] =
        TARGET_LABEL[
          index
        ];
    }

    this.displayLabel =
      this.scrambleChars.join(
        ""
      );

    const eased =
      1 -
      Math.pow(
        1 - progress,
        3
      );

    const interpolated =
      this.startDisplayValue +
      (
        ENTROPY_MAX -
        this.startDisplayValue
      ) *
      eased;

    const jitterStrength =
      (
        1 - progress
      ) *
      34;

    const jitter =
      progress < 0.88
        ? (
            Math.random() -
            0.5
          ) *
          jitterStrength
        : 0;

    this.displayValue =
      Math.max(
        0,
        Math.min(
          ENTROPY_MAX,
          Math.round(
            interpolated +
            jitter
          )
        )
      );

    if (
      progress >= 1
    ) {
      this.state =
        "running";

      this.value =
        ENTROPY_MAX;

      this.displayValue =
        ENTROPY_MAX;

      this.displayLabel =
        TARGET_LABEL;
    }
  }

  updateRunning(
    deltaMs
  ) {
    this.value =
      Math.max(
        0,
        this.value -
        this.decayPerSecond *
          deltaMs /
          1000
      );

    this.displayValue =
      Math.ceil(
        this.value
      );

    this.displayLabel =
      TARGET_LABEL;

    if (
      this.value <= 0
    ) {
      this.value = 0;
      this.displayValue = 0;
      this.state =
        "complete";

      if (
        !this.completedEmitted
      ) {
        this.completedEmitted =
          true;

        this.onCompleted?.(
          {
            source:
              this.triggerSource
          }
        );
      }
    }
  }

  update(
    deltaMs
  ) {
    if (
      this.state ===
      "idle"
    ) {
      return;
    }

    const safeDelta =
      Math.max(
        0,
        Math.min(
          100,
          Number(
            deltaMs
          ) || 0
        )
      );

    if (
      this.state ===
      "transition"
    ) {
      this.updateTransition(
        safeDelta
      );
    } else if (
      this.state ===
      "running"
    ) {
      this.updateRunning(
        safeDelta
      );
    }

    this.emitDisplay();
    this.emitState();
  }

  emitDisplay() {
    this.onDisplayChanged?.(
      {
        label:
          this.displayLabel,
        value:
          this.displayValue,
        state:
          this.state
      }
    );
  }

  emitState() {
    this.onStateChanged?.(
      {
        active:
          this.active,
        state:
          this.state,
        value:
          this.value,
        maxValue:
          ENTROPY_MAX,
        corruption:
          this.corruption,
        intensity:
          this.visualIntensity,
        transitionProgress:
          this.transitionProgress,
        source:
          this.triggerSource
      }
    );
  }
}
