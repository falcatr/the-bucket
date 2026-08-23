const MIN_BUCKET_ROWS = 1;
const MAX_BUCKET_ROWS = 10;

export class ProgressionSystem {
  constructor(
    config,
    {
      onProgressionChanged,
      onBucketLevelUp
    } = {}
  ) {
    this.config = config;

    this.attentionTotal = 0;
    this.completedSwipeCount = 0;

    // v0.4.11:
    // onboarding Attention now counts toward the total targets.
    this.attentionBaseline = 0;

    this.onProgressionChanged =
      onProgressionChanged;

    this.onBucketLevelUp =
      onBucketLevelUp;

    this.normalizeRuntimeConfig();
  }

  normalizeRuntimeConfig() {
    this.config.bucketLoadingRows =
      Math.max(
        MIN_BUCKET_ROWS,
        Math.min(
          MAX_BUCKET_ROWS,
          Math.round(
            Number(
              this.config
                .bucketLoadingRows
            ) || 1
          )
        )
      );

    this.config.appetiteMultiplier =
      Math.max(
        1,
        Math.round(
          Number(
            this.config
              .appetiteMultiplier
          ) || 100
        )
      );

    this.config.onboardingSwipesToBucket2 =
      Math.max(
        1,
        Math.round(
          Number(
            this.config
              .onboardingSwipesToBucket2
          ) || 2
        )
      );
  }

  get bucketRows() {
    return this.config
      .bucketLoadingRows;
  }

  get multiplier() {
    return this.config
      .appetiteMultiplier;
  }

  get onboardingSwipeTarget() {
    return this.config
      .onboardingSwipesToBucket2;
  }

  get isMaxBucket() {
    return (
      this.bucketRows >=
      MAX_BUCKET_ROWS
    );
  }

  get progressionMode() {
    if (
      this.isMaxBucket
    ) {
      return "complete";
    }

    if (
      this.bucketRows === 1
    ) {
      return "swipes";
    }

    return "attention";
  }

  get attentionProgress() {
    return Math.max(
      0,
      this.attentionTotal
    );
  }

  get appetiteTarget() {
    if (
      this.isMaxBucket
    ) {
      return 0;
    }

    if (
      this.bucketRows === 1
    ) {
      return this
        .onboardingSwipeTarget;
    }

    return (
      (
        this.bucketRows -
        1
      ) *
      this.multiplier
    );
  }

  emitProgression(
    {
      leveledUp = false,
      levelsGained = 0
    } = {}
  ) {
    const snapshot = {
      attention:
        this.attentionTotal,

      attentionBaseline:
        this.attentionBaseline,

      attentionProgress:
        this.attentionProgress,

      completedSwipes:
        this.completedSwipeCount,

      onboardingSwipeTarget:
        this.onboardingSwipeTarget,

      progressionMode:
        this.progressionMode,

      bucketRows:
        this.bucketRows,

      appetiteTarget:
        this.appetiteTarget,

      appetiteMultiplier:
        this.multiplier,

      leveledUp,
      levelsGained,

      isMaxBucket:
        this.isMaxBucket
    };

    this.onProgressionChanged?.(
      snapshot
    );

    return snapshot;
  }

  emitLevelUp(
    previousRows,
    reachedAppetite
  ) {
    this.onBucketLevelUp?.(
      {
        previousRows,

        bucketRows:
          this.bucketRows,

        reachedAppetite,

        attention:
          this.attentionTotal,

        attentionProgress:
          this.attentionProgress,

        nextAppetite:
          this.appetiteTarget,

        progressionMode:
          this.progressionMode
      }
    );
  }

  registerCompletedSwipe() {
    this.normalizeRuntimeConfig();

    if (
      this.bucketRows !== 1
    ) {
      return this.emitProgression();
    }

    this.completedSwipeCount +=
      1;

    if (
      this.completedSwipeCount <
      this.onboardingSwipeTarget
    ) {
      return this.emitProgression();
    }

    const previousRows =
      this.bucketRows;

    const reachedAppetite =
      this.onboardingSwipeTarget;

    this.config.bucketLoadingRows =
      2;

    this.attentionBaseline = 0;

    this.emitLevelUp(
      previousRows,
      reachedAppetite
    );

    return this.emitProgression(
      {
        leveledUp: true,
        levelsGained: 1
      }
    );
  }

  syncWithAttention(
    attentionTotal,
    {
      allowLevelUp = true
    } = {}
  ) {
    this.attentionTotal =
      Math.max(
        0,
        Math.floor(
          Number(
            attentionTotal
          ) || 0
        )
      );

    this.normalizeRuntimeConfig();

    if (
      this.bucketRows === 1
    ) {
      return this.emitProgression();
    }

    let levelsGained = 0;

    if (
      allowLevelUp
    ) {
      while (
        !this.isMaxBucket &&
        this.attentionProgress >=
          this.appetiteTarget
      ) {
        const previousRows =
          this.bucketRows;

        const previousTarget =
          this.appetiteTarget;

        this.config
          .bucketLoadingRows =
          previousRows + 1;

        levelsGained +=
          1;

        this.emitLevelUp(
          previousRows,
          previousTarget
        );
      }
    }

    return this.emitProgression(
      {
        leveledUp:
          levelsGained > 0,

        levelsGained
      }
    );
  }

  refreshFromConfig(
    attentionTotal =
      this.attentionTotal
  ) {
    this.normalizeRuntimeConfig();

    if (
      this.bucketRows === 1
    ) {
      this.completedSwipeCount =
        0;
    }

    this.attentionBaseline = 0;

    return this.syncWithAttention(
      attentionTotal,
      {
        allowLevelUp: true
      }
    );
  }
}
