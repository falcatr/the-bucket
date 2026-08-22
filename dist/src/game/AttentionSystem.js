export class AttentionSystem {
  constructor(
    config,
    {
      onScoreChanged,
      onCellScored,
      onSlotsDiscarded
    } = {}
  ) {
    this.config = config;

    this.total = 0;
    this.drainedCellCount = 0;
    this.discardedSlotCount = 0;

    this.onScoreChanged =
      onScoreChanged;

    this.onCellScored =
      onCellScored;

    this.onSlotsDiscarded =
      onSlotsDiscarded;
  }

  get valuePerCell() {
    const configured =
      Number(
        this.config
          .attentionValuePerCell
      );

    return Math.max(
      1,
      Math.round(
        Number.isFinite(
          configured
        )
          ? configured
          : 1
      )
    );
  }

  scoreDrainedCell({
    sourceX,
    sourceY
  } = {}) {
    const amount =
      this.valuePerCell;

    this.total +=
      amount;

    this.drainedCellCount +=
      1;

    const event = {
      amount,
      total:
        this.total,
      drainedCellCount:
        this.drainedCellCount,
      sourceX,
      sourceY
    };

    this.onCellScored?.(
      event
    );

    this.onScoreChanged?.(
      {
        total:
          this.total,
        delta:
          amount
      }
    );

    return event;
  }

  registerDiscardedSlots(
    count
  ) {
    const normalized =
      Math.max(
        0,
        Math.floor(
          Number(count) || 0
        )
      );

    if (
      normalized <= 0
    ) {
      return;
    }

    // Discarded cells never add Attention.
    this.discardedSlotCount +=
      normalized;

    this.onSlotsDiscarded?.(
      {
        count:
          normalized,
        totalDiscardedSlots:
          this.discardedSlotCount
      }
    );
  }

  reset() {
    this.total = 0;
    this.drainedCellCount = 0;
    this.discardedSlotCount = 0;

    this.onScoreChanged?.(
      {
        total: 0,
        delta: 0
      }
    );
  }
}
