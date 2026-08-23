import {
  getBucketCellMeta
} from "./GachaSystem.js";

const EPSILON = 0.0001;

const TYPE_BY_ID =
  Object.freeze({
    joy: 1,
    rage: 2,
    fear: 3,
    grief: 4
  });

const EMOTION_AXIS =
  Object.freeze({
    joy: Object.freeze({
      axis: "x",
      direction: 1,
      opposite: "grief"
    }),
    grief: Object.freeze({
      axis: "x",
      direction: -1,
      opposite: "joy"
    }),
    rage: Object.freeze({
      axis: "y",
      direction: 1,
      opposite: "fear"
    }),
    fear: Object.freeze({
      axis: "y",
      direction: -1,
      opposite: "rage"
    })
  });

export class NervousSystem {
  constructor(
    config,
    {
      onBufferChanged,
      onEmotionScored
    } = {}
  ) {
    this.config = config;

    this.x = 0;
    this.y = 0;

    // Always points at the axis with the greatest ABSOLUTE raw
    // buffer. On exact ties, the current axis is preserved to avoid
    // frame-to-frame flicker.
    this.displayAxis = null;

    this.scores = {
      joy: 0,
      grief: 0,
      rage: 0,
      fear: 0
    };

    this.onBufferChanged =
      onBufferChanged;

    this.onEmotionScored =
      onEmotionScored;

    this.emitBuffer();
  }

  get decayPerSecond() {
    const configured =
      Number(
        this.config
          .nervousBufferDecayPerSecond
      );

    return Math.max(
      0,
      Number.isFinite(
        configured
      )
        ? configured
        : 0.10
    );
  }

  get baseTarget() {
    return Math.max(
      1,
      Number(
        this.config
          .nervousBufferBaseTarget
      ) || 10
    );
  }

  get scoresPerTargetTier() {
    return Math.max(
      1,
      Math.round(
        Number(
          this.config
            .nervousBufferScoresPerTargetTier
        ) || 10
      )
    );
  }

  get targetStep() {
    return Math.max(
      1,
      Number(
        this.config
          .nervousBufferTargetStep
      ) || 10
    );
  }

  getAxisValue(
    axis
  ) {
    return (
      axis === "x"
        ? this.x
        : this.y
    );
  }

  setAxisValue(
    axis,
    value
  ) {
    if (
      axis === "x"
    ) {
      this.x = value;
    } else {
      this.y = value;
    }
  }

  getEmotionForAxisValue(
    axis,
    value
  ) {
    if (
      Math.abs(
        value
      ) <=
      EPSILON
    ) {
      return null;
    }

    if (
      axis === "x"
    ) {
      return (
        value > 0
          ? "joy"
          : "grief"
      );
    }

    return (
      value > 0
        ? "rage"
        : "fear"
    );
  }

  getTargetForEmotion(
    emotion
  ) {
    const score =
      Math.max(
        0,
        Math.floor(
          Number(
            this.scores[
              emotion
            ]
          ) || 0
        )
      );

    const tier =
      Math.floor(
        score /
        this.scoresPerTargetTier
      );

    return (
      this.baseTarget +
      tier *
      this.targetStep
    );
  }

  normalizeNearZero() {
    if (
      Math.abs(
        this.x
      ) <=
      EPSILON
    ) {
      this.x = 0;
    }

    if (
      Math.abs(
        this.y
      ) <=
      EPSILON
    ) {
      this.y = 0;
    }
  }

  refreshDisplayAxis() {
    this.normalizeNearZero();

    const xMagnitude =
      Math.abs(
        this.x
      );

    const yMagnitude =
      Math.abs(
        this.y
      );

    if (
      xMagnitude <=
        EPSILON &&
      yMagnitude <=
        EPSILON
    ) {
      this.displayAxis = null;
      return;
    }

    if (
      Math.abs(
        xMagnitude -
        yMagnitude
      ) <=
      EPSILON &&
      this.displayAxis &&
      Math.abs(
        this.getAxisValue(
          this.displayAxis
        )
      ) >
      EPSILON
    ) {
      return;
    }

    this.displayAxis =
      xMagnitude >=
        yMagnitude
        ? "x"
        : "y";
  }

  getDisplayState() {
    this.refreshDisplayAxis();

    if (
      !this.displayAxis
    ) {
      return {
        emotion: null,
        value: 0,
        maxValue:
          this.baseTarget,
        ratio: 0,
        color: null,
        x:
          this.x,
        y:
          this.y,
        scores: {
          ...this.scores
        }
      };
    }

    const rawValue =
      this.getAxisValue(
        this.displayAxis
      );

    const emotion =
      this.getEmotionForAxisValue(
        this.displayAxis,
        rawValue
      );

    const value =
      Math.abs(
        rawValue
      );

    const maxValue =
      emotion
        ? this.getTargetForEmotion(
            emotion
          )
        : this.baseTarget;

    const meta =
      emotion
        ? getBucketCellMeta(
            TYPE_BY_ID[
              emotion
            ]
          )
        : null;

    return {
      emotion,
      value,
      maxValue,
      ratio:
        Math.max(
          0,
          Math.min(
            1,
            value /
            maxValue
          )
        ),
      color:
        meta?.color ??
        null,
      x:
        this.x,
      y:
        this.y,
      scores: {
        ...this.scores
      }
    };
  }

  collectEmotion(
    emotion
  ) {
    const normalized =
      String(
        emotion ?? ""
      )
        .trim()
        .toLowerCase();

    const mapping =
      EMOTION_AXIS[
        normalized
      ];

    if (
      !mapping
    ) {
      return null;
    }

    this.setAxisValue(
      mapping.axis,
      this.getAxisValue(
        mapping.axis
      ) +
      mapping.direction
    );

    let scoredEmotion =
      null;

    const current =
      this.getAxisValue(
        mapping.axis
      );

    const currentEmotion =
      this.getEmotionForAxisValue(
        mapping.axis,
        current
      );

    if (
      currentEmotion
    ) {
      const target =
        this.getTargetForEmotion(
          currentEmotion
        );

      if (
        Math.abs(
          current
        ) >=
        target
      ) {
        scoredEmotion =
          currentEmotion;

        this.scores[
          scoredEmotion
        ] += 1;

        this.onEmotionScored?.(
          {
            emotion:
              scoredEmotion,
            total:
              this.scores[
                scoredEmotion
              ],
            completedTarget:
              target,
            nextTarget:
              this
                .getTargetForEmotion(
                  scoredEmotion
                ),
            scores: {
              ...this.scores
            }
          }
        );

        // Completing a buffer consumes that complete axis.
        this.setAxisValue(
          mapping.axis,
          0
        );
      }
    }

    // IMPORTANT: no "preferred last cell" here. The visual state is
    // always derived from the largest remaining absolute buffer.
    this.refreshDisplayAxis();

    return this.emitBuffer({
      collectedEmotion:
        normalized,
      scoredEmotion
    });
  }

  increaseActiveBuffer(
    amount = 1
  ) {
    this.refreshDisplayAxis();

    if (
      !this.displayAxis
    ) {
      return this.emitBuffer({
        debugAction:
          "increase-active-buffer-noop"
      });
    }

    const rawValue =
      this.getAxisValue(
        this.displayAxis
      );

    const emotion =
      this.getEmotionForAxisValue(
        this.displayAxis,
        rawValue
      );

    if (
      !emotion
    ) {
      return this.emitBuffer({
        debugAction:
          "increase-active-buffer-noop"
      });
    }

    const increments =
      Math.max(
        1,
        Math.floor(
          Number(
            amount
          ) || 1
        )
      );

    let state = null;

    for (
      let index = 0;
      index <
      increments;
      index += 1
    ) {
      state =
        this.collectEmotion(
          emotion
        );

      if (
        state
          ?.scoredEmotion
      ) {
        break;
      }
    }

    return state;
  }

  resetActiveBuffer() {
    this.refreshDisplayAxis();

    if (
      !this.displayAxis
    ) {
      return this.emitBuffer({
        debugAction:
          "reset-active-buffer-noop"
      });
    }

    const resetAxis =
      this.displayAxis;

    this.setAxisValue(
      resetAxis,
      0
    );

    this.refreshDisplayAxis();

    return this.emitBuffer({
      debugAction:
        "reset-active-buffer",
      resetAxis
    });
  }

  approachZero(
    value,
    amount
  ) {
    if (
      value > 0
    ) {
      return Math.max(
        0,
        value - amount
      );
    }

    if (
      value < 0
    ) {
      return Math.min(
        0,
        value + amount
      );
    }

    return 0;
  }

  update(
    deltaMs
  ) {
    const decay =
      this.decayPerSecond *
      Math.max(
        0,
        deltaMs
      ) /
      1000;

    if (
      decay <= 0
    ) {
      return;
    }

    const previousX =
      this.x;

    const previousY =
      this.y;

    this.x =
      this.approachZero(
        this.x,
        decay
      );

    this.y =
      this.approachZero(
        this.y,
        decay
      );

    this.normalizeNearZero();
    this.refreshDisplayAxis();

    if (
      previousX !==
        this.x ||
      previousY !==
        this.y
    ) {
      this.emitBuffer();
    }
  }

  getAdaptiveGachaChances(
    baseChances
  ) {
    const saturationScore =
      Math.max(
        0.01,
        Number(
          this.config
            .gachaAdaptiveSaturationScore
        ) || 12
      );

    const ownBoost =
      Math.max(
        0,
        Number(
          this.config
            .gachaAdaptiveOwnBoostPctPerScore
        ) || 0
      );

    const oppositeBoost =
      Math.max(
        0,
        Number(
          this.config
            .gachaAdaptiveOppositeBoostPctPerScore
        ) || 0
      );

    const chanceCap =
      Math.max(
        0,
        Math.min(
          100,
          Number(
            this.config
              .gachaAdaptiveEmotionChanceCapPct
          ) || 100
        )
      );

    const effectiveScore =
      (score) => {
        const normalized =
          Math.max(
            0,
            Number(
              score
            ) || 0
          );

        // Early engagement matters strongly; repeated engagement
        // continues to matter but with diminishing returns.
        return (
          saturationScore *
          (
            1 -
            Math.exp(
              -normalized /
              saturationScore
            )
          )
        );
      };

    const result = {
      ...baseChances
    };

    for (
      const emotion
      of [
        "joy",
        "rage",
        "fear",
        "grief"
      ]
    ) {
      const opposite =
        EMOTION_AXIS[
          emotion
        ].opposite;

      const learnedBoost =
        effectiveScore(
          this.scores[
            emotion
          ]
        ) *
          ownBoost +
        effectiveScore(
          this.scores[
            opposite
          ]
        ) *
          oppositeBoost;

      result[
        emotion
      ] =
        Math.min(
          chanceCap,
          Math.max(
            0,
            Number(
              baseChances[
                emotion
              ]
            ) || 0
          ) +
            learnedBoost
        );
    }

    return result;
  }

  emitBuffer(
    extra = {}
  ) {
    const state = {
      ...this
        .getDisplayState(),
      ...extra
    };

    this.onBufferChanged?.(
      state
    );

    return state;
  }
}
