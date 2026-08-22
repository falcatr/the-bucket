const MIN_BUCKET_ROWS = 1;
const MAX_BUCKET_ROWS = 30;

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
          ) || 50
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

  get appetiteTarget() {
    return (
      this.bucketRows *
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
      bucketRows:
        this.bucketRows,
      appetiteTarget:
        this.appetiteTarget,
      appetiteMultiplier:
        this.multiplier,
      leveledUp,
      levelsGained,
      isMaxBucket:
        this.bucketRows >=
        MAX_BUCKET_ROWS
    };

    this.onProgressionChanged?.(
      snapshot
    );

    return snapshot;
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

    let levelsGained = 0;

    if (
      allowLevelUp
    ) {
      while (
        this.bucketRows <
          MAX_BUCKET_ROWS &&
        this.attentionTotal >=
          this.appetiteTarget
      ) {
        const previousRows =
          this.bucketRows;

        const previousTarget =
          this.appetiteTarget;

        this.config
          .bucketLoadingRows =
          previousRows + 1;

        levelsGained += 1;

        this.onBucketLevelUp?.(
          {
            previousRows,
            bucketRows:
              this.bucketRows,
            reachedAppetite:
              previousTarget,
            attention:
              this.attentionTotal,
            nextAppetite:
              this.appetiteTarget
          }
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
    return this.syncWithAttention(
      attentionTotal,
      {
        allowLevelUp: true
      }
    );
  }
}
