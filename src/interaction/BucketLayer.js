const BUCKET_COLOR = "#ffffff";
const EMPTY_BAR_COLOR = "#7188b8";
const ACTIVE_BAR_COLOR = "#fff35d";
const COMPLETE_BAR_COLOR = "#ffffff";

const EMPTY_BAR_GLYPH = "≡";
const FILL_BAR_GLYPH = "█";
const ACTIVE_FILL_STAGES = ["░", "▒", "▓", "█"];
const DRAIN_FILL_STAGES = ["█", "▓", "▒", "░"];

const BUCKET_CENTER_Y = 0.39;

// `IDLE_LOADING_ART[1]` is the upper rim:
// "  ,--[___]--,"
// Refresh only becomes valid after this complete row is visually above
// the animated waterline. This is resolution-independent.
const REFRESH_BUCKET_REFERENCE_ROW = 1;
const REFRESH_CLEARANCE_CELLS = 0.08;

const MAX_PULL_VIEWPORT_RATIO = 0.50;

// After a valid release, keep approximately this much of the hidden
// upper-water region visible while the fake refresh/drain runs.
const SWIPE_HOLD_VIEWPORT_RATIO = 0.20;

const RELEASE_TO_HOLD_DURATION_MS = 360;
const RETURN_TO_OCEAN_DURATION_MS = 420;

// Damped bucket bounce after release. Amplitude comes from debug config.
const BOUNCE_PERIOD_MS = 560;
const BOUNCE_DECAY_MS = 1250;

// Arte baseada no arquivo balde_ascii.txt enviado como referência.
const IDLE_LOADING_ART = [
  "      ___",
  "  ,--[___]--,",
  " /           \\",
  "|,.--'```'--.,|",
  "|'-.,_____,.-'|",
  "|'-.,_____,.-'|",
  "|   LOADING   |",
  "|   LOADING   |",
  "|   LOADING   |",
  "|'-.,_____,.-'|",
  "`'-.,_____,.-''"
];

const IDLE_SWIPE_ART = [
  " ,.--'`````'--.,",
  "(\\'-.,_____,.-'/)",
  " \\\\-.,_____,.-//",
  " ;\\\\         //|",
  " | \\\\  ___  // |",
  " |  '-[___]-'  |",
  " |             |",
  " |             |",
  " |             |",
  " `'-.,_____,.-''"
];

// Loading fills bottom -> middle -> top.
const LOADING_ROWS = [8, 7, 6];
const LOADING_START_COLUMN = 1;

// IDLE-SWIPE has one extra leading space, so its 13-cell interior starts at 2.
const SWIPE_LOADING_START_COLUMN = 2;
const LOADING_SLOT_COUNT = 13;
const LOADING_ROW_COUNT = LOADING_ROWS.length;

export class BucketLayer {
  constructor(
    canvas,
    oceanEngine,
    {
      onRefresh
    } = {}
  ) {
    this.canvas = canvas;
    this.ctx =
      canvas.getContext("2d");
    this.ocean =
      oceanEngine;
    this.onRefresh =
      onRefresh;

    // loading | swipe
    this.mode = "loading";

    // draining | returning | null
    this.swipePhase = null;

    this.loadingElapsedMs = 0;

    this.drainElapsedMs = 0;
    this.drainCompletedRows = 0;
    this.drainRowOrder = [];
    this.drainFinished = false;

    this.bounceElapsedMs = 0;

    this.lastFrame =
      performance.now();
    this.frameHandle = 0;
    this.resizeObserver = null;

    this.oceanOffsetY = 0;

    // Generic visual translation animation for the same tall ocean canvas.
    this.offsetAnimation = null;

    this.pointer = {
      active: false,
      id: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      rawPullDistance: 0,
      armed: false
    };

    this.boundLoop =
      this.loop.bind(this);

    this.boundPointerDown =
      this.handlePointerDown.bind(this);

    this.boundPointerMove =
      this.handlePointerMove.bind(this);

    this.boundPointerUp =
      this.handlePointerUp.bind(this);

    this.boundPointerCancel =
      this.handlePointerCancel.bind(this);
  }

  start() {
    this.resize();

    this.resizeObserver =
      new ResizeObserver(() => {
        this.resize();

        if (
          this.mode === "swipe"
        ) {
          this.setOceanOffset(
            this.getSwipeHoldOffset()
          );
        } else {
          this.setOceanOffset(0);
        }
      });

    this.resizeObserver.observe(
      this.canvas
    );

    this.canvas.addEventListener(
      "pointerdown",
      this.boundPointerDown
    );

    this.canvas.addEventListener(
      "pointermove",
      this.boundPointerMove
    );

    this.canvas.addEventListener(
      "pointerup",
      this.boundPointerUp
    );

    this.canvas.addEventListener(
      "pointercancel",
      this.boundPointerCancel
    );

    this.lastFrame =
      performance.now();

    this.frameHandle =
      requestAnimationFrame(
        this.boundLoop
      );
  }

  destroy() {
    cancelAnimationFrame(
      this.frameHandle
    );

    this.resizeObserver?.disconnect();

    this.canvas.removeEventListener(
      "pointerdown",
      this.boundPointerDown
    );

    this.canvas.removeEventListener(
      "pointermove",
      this.boundPointerMove
    );

    this.canvas.removeEventListener(
      "pointerup",
      this.boundPointerUp
    );

    this.canvas.removeEventListener(
      "pointercancel",
      this.boundPointerCancel
    );

    this.setOceanOffset(0);
  }

  resize() {
    const rect =
      this.canvas.getBoundingClientRect();

    const dpr =
      Math.min(
        window.devicePixelRatio || 1,
        2
      );

    this.canvas.width =
      Math.max(
        1,
        Math.round(
          rect.width * dpr
        )
      );

    this.canvas.height =
      Math.max(
        1,
        Math.round(
          rect.height * dpr
        )
      );

    this.ctx.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );

    this.ctx.textAlign =
      "center";

    this.ctx.textBaseline =
      "middle";

    this.ctx.imageSmoothingEnabled =
      false;
  }

  get loadingSlotDurationMs() {
    return Math.max(
      50,
      Number(
        this.ocean.config
          .bucketLoadingSlotDurationMs
      ) || 1000
    );
  }

  get drainSpeedMultiplier() {
    const configured =
      Number(
        this.ocean.config
          .bucketDrainSpeedMultiplier
      );

    return Math.max(
      0.25,
      Math.min(
        16,
        Number.isFinite(configured)
          ? configured
          : 2
      )
    );
  }

  get drainSlotDurationMs() {
    return (
      this.loadingSlotDurationMs /
      this.drainSpeedMultiplier
    );
  }

  get bucketBounceCells() {
    const configured =
      Number(
        this.ocean.config
          .bucketBounceCells
      );

    return Math.max(
      0,
      Math.min(
        4,
        Number.isFinite(configured)
          ? configured
          : 0.9
      )
    );
  }

  get bucketScale() {
    const configured =
      Number(
        this.ocean.config
          .bucketScale
      );

    return Math.max(
      0.2,
      Math.min(
        1.5,
        Number.isFinite(configured)
          ? configured
          : 1
      )
    );
  }

  getSurfaceScreenY(
    visualOceanOffset =
      this.oceanOffsetY
  ) {
    const boundaryWorldRow =
      this.ocean
        .getSurfaceBoundaryWorldRow();

    const canvasTop =
      -this.ocean.upperRevealHeight +
      visualOceanOffset;

    return (
      canvasTop +
      (
        boundaryWorldRow +
        0.5
      ) *
      this.ocean.cellH
    );
  }

  getBucketRefreshReferenceY() {
    const {
      originY
    } = this.getArtLayout(
      IDLE_LOADING_ART,
      false
    );

    const referenceRowTop =
      (
        originY +
        REFRESH_BUCKET_REFERENCE_ROW *
        this.bucketScale
      ) *
      this.ocean.cellH;

    return (
      referenceRowTop +
      this.ocean.cellH *
        this.bucketScale +
      this.ocean.cellH *
        REFRESH_CLEARANCE_CELLS
    );
  }

  isRefreshGeometrySatisfied(
    visualOceanOffset
  ) {
    if (
      !this.ocean.cellH ||
      !this.ocean.upperRevealHeight
    ) {
      return false;
    }

    return (
      this.getSurfaceScreenY(
        visualOceanOffset
      ) >=
      this.getBucketRefreshReferenceY()
    );
  }

  getSwipeHoldOffset() {
    const viewportHeight =
      this.canvas
        .getBoundingClientRect()
        .height;

    return Math.min(
      viewportHeight *
        SWIPE_HOLD_VIEWPORT_RATIO,
      this.ocean.upperRevealHeight *
        0.90
    );
  }

  getCompletedLoadingRows() {
    const rowDuration =
      this.loadingSlotDurationMs *
      LOADING_SLOT_COUNT;

    return Math.max(
      0,
      Math.min(
        LOADING_ROW_COUNT,
        Math.floor(
          this.loadingElapsedMs /
          rowDuration
        )
      )
    );
  }

  getDrainTotalDurationMs() {
    return (
      this.drainCompletedRows *
      LOADING_SLOT_COUNT *
      this.drainSlotDurationMs
    );
  }

  getBucketBounceOffsetCells() {
    if (
      this.mode !== "swipe" ||
      this.swipePhase !== "draining" ||
      this.bucketBounceCells <= 0
    ) {
      return 0;
    }

    const time =
      this.bounceElapsedMs;

    const decay =
      Math.exp(
        -time /
        BOUNCE_DECAY_MS
      );

    const oscillation =
      Math.sin(
        (
          Math.PI * 2 *
          time
        ) /
        BOUNCE_PERIOD_MS
      );

    // Positive row offset moves the bucket downward first, then upward,
    // producing the requested elastic "dip back toward the sea".
    return (
      this.bucketBounceCells *
      decay *
      oscillation
    );
  }

  beginSwipeDrain(
    completedRows
  ) {
    if (
      this.mode === "swipe" ||
      completedRows <= 0
    ) {
      return false;
    }

    // Only fully-white rows enter IDLE-SWIPE. Any yellow/incomplete row
    // disappears at release.
    this.drainCompletedRows =
      Math.min(
        LOADING_ROW_COUNT,
        completedRows
      );

    // Cache the small row order once. Drain rendering stays allocation-free
    // even at 16x; speed only changes time-to-state, never update frequency.
    this.drainRowOrder =
      LOADING_ROWS
        .slice(
          0,
          this.drainCompletedRows
        )
        .reverse();

    this.loadingElapsedMs = 0;
    this.drainElapsedMs = 0;
    this.bounceElapsedMs = 0;
    this.drainFinished = false;

    this.mode = "swipe";
    this.swipePhase =
      "draining";

    // The content refresh belongs to the RELEASE, not to the end of the fake
    // loading. The new sea is immediately present behind IDLE-SWIPE.
    this.onRefresh?.();

    this.startOffsetAnimation(
      this.getSwipeHoldOffset(),
      RELEASE_TO_HOLD_DURATION_MS
    );

    return true;
  }

  finishDrainAndReturn() {
    if (
      this.drainFinished
    ) {
      return;
    }

    this.drainFinished = true;
    this.swipePhase =
      "returning";

    // The sea was already regenerated at release. Once the fake drain
    // finishes, only the visual return to the underwater resting position
    // remains.
    this.startOffsetAnimation(
      0,
      RETURN_TO_OCEAN_DURATION_MS,
      () => {
        this.mode = "loading";
        this.swipePhase = null;
        this.drainElapsedMs = 0;
        this.drainCompletedRows = 0;
        this.drainRowOrder = [];
        this.drainFinished = false;
        this.bounceElapsedMs = 0;
        this.loadingElapsedMs = 0;
      }
    );
  }

  handlePointerDown(event) {
    if (
      this.mode === "swipe"
    ) {
      return;
    }

    this.offsetAnimation = null;

    this.pointer.active = true;
    this.pointer.id =
      event.pointerId;

    this.pointer.startX =
      event.clientX;

    this.pointer.startY =
      event.clientY;

    this.pointer.currentX =
      event.clientX;

    this.pointer.currentY =
      event.clientY;

    this.pointer.rawPullDistance = 0;
    this.pointer.armed = false;

    try {
      this.canvas.setPointerCapture(
        event.pointerId
      );
    } catch {
      // Pointer capture may be unavailable in older browsers.
    }
  }

  handlePointerMove(event) {
    if (
      !this.pointer.active ||
      event.pointerId !==
        this.pointer.id
    ) {
      return;
    }

    this.pointer.currentX =
      event.clientX;

    this.pointer.currentY =
      event.clientY;

    const deltaX =
      this.pointer.currentX -
      this.pointer.startX;

    const deltaY =
      this.pointer.currentY -
      this.pointer.startY;

    const downwardDistance =
      Math.max(
        0,
        deltaY
      );

    const isMostlyVertical =
      downwardDistance >=
      Math.abs(deltaX) *
        0.82;

    this.pointer.rawPullDistance =
      downwardDistance;

    const visualDistance =
      this.calculateResistedDistance(
        downwardDistance
      );

    this.pointer.armed =
      isMostlyVertical &&
      this.isRefreshGeometrySatisfied(
        visualDistance
      );

    this.setOceanOffset(
      visualDistance
    );
  }

  handlePointerUp(event) {
    if (
      !this.pointer.active ||
      event.pointerId !==
        this.pointer.id
    ) {
      return;
    }

    this.pointer.currentX =
      event.clientX;

    this.pointer.currentY =
      event.clientY;

    const deltaX =
      this.pointer.currentX -
      this.pointer.startX;

    const deltaY =
      this.pointer.currentY -
      this.pointer.startY;

    const downwardDistance =
      Math.max(
        0,
        deltaY
      );

    const visualDistance =
      this.calculateResistedDistance(
        downwardDistance
      );

    const isVerticalEnough =
      downwardDistance >=
      Math.abs(deltaX) *
        1.05;

    const completedRows =
      this.getCompletedLoadingRows();

    const shouldRefresh =
      isVerticalEnough &&
      completedRows > 0 &&
      this.isRefreshGeometrySatisfied(
        visualDistance
      );

    this.releasePointer(
      event.pointerId
    );

    if (
      shouldRefresh &&
      this.beginSwipeDrain(
        completedRows
      )
    ) {
      return;
    }

    this.startOffsetAnimation(
      0,
      RETURN_TO_OCEAN_DURATION_MS
    );
  }

  handlePointerCancel(event) {
    if (
      !this.pointer.active ||
      event.pointerId !==
        this.pointer.id
    ) {
      return;
    }

    this.releasePointer(
      event.pointerId
    );

    this.startOffsetAnimation(
      0,
      RETURN_TO_OCEAN_DURATION_MS
    );
  }

  releasePointer(pointerId) {
    try {
      if (
        this.canvas.hasPointerCapture(
          pointerId
        )
      ) {
        this.canvas.releasePointerCapture(
          pointerId
        );
      }
    } catch {
      // No-op.
    }

    this.pointer.active = false;
    this.pointer.id = null;
    this.pointer.rawPullDistance = 0;
    this.pointer.armed = false;
  }

  calculateResistedDistance(
    rawDistance
  ) {
    if (
      rawDistance <= 0
    ) {
      return 0;
    }

    const viewportHeight =
      this.canvas
        .getBoundingClientRect()
        .height;

    const maxVisualDistance =
      Math.min(
        viewportHeight *
          MAX_PULL_VIEWPORT_RATIO,
        this.ocean.upperRevealHeight *
          0.94
      );

    const resistanceDistance =
      viewportHeight * 0.20;

    return (
      maxVisualDistance *
      (
        1 -
        Math.exp(
          -rawDistance /
          Math.max(
            1,
            resistanceDistance
          )
        )
      )
    );
  }

  setOceanOffset(offsetY) {
    this.oceanOffsetY =
      offsetY;

    this.ocean.canvas.style.transform =
      `translate3d(0, ${offsetY.toFixed(2)}px, 0)`;
  }

  startOffsetAnimation(
    targetOffset,
    duration,
    onComplete = null
  ) {
    this.offsetAnimation = {
      from:
        this.oceanOffsetY,
      to:
        targetOffset,
      elapsed: 0,
      duration:
        Math.max(
          1,
          duration
        ),
      onComplete
    };
  }

  updateOffsetAnimation(deltaMs) {
    if (
      !this.offsetAnimation ||
      this.pointer.active
    ) {
      return;
    }

    const animation =
      this.offsetAnimation;

    animation.elapsed +=
      deltaMs;

    const progress =
      Math.min(
        1,
        animation.elapsed /
        animation.duration
      );

    // easeOutCubic: quick response immediately after release,
    // then a softer arrival at 20% / zero.
    const eased =
      1 -
      Math.pow(
        1 - progress,
        3
      );

    this.setOceanOffset(
      animation.from +
      (
        animation.to -
        animation.from
      ) *
      eased
    );

    if (
      progress >= 1
    ) {
      const callback =
        animation.onComplete;

      this.setOceanOffset(
        animation.to
      );

      this.offsetAnimation = null;

      callback?.();
    }
  }

  update(deltaMs) {
    this.updateOffsetAnimation(
      deltaMs
    );

    if (
      this.mode === "loading"
    ) {
      const totalSlots =
        LOADING_ROW_COUNT *
        LOADING_SLOT_COUNT;

      const totalDuration =
        this.loadingSlotDurationMs *
        totalSlots;

      this.loadingElapsedMs =
        Math.min(
          totalDuration,
          this.loadingElapsedMs +
          deltaMs
        );

      return;
    }

    if (
      this.swipePhase ===
      "draining"
    ) {
      this.bounceElapsedMs +=
        deltaMs;

      const totalDrainDuration =
        this.getDrainTotalDurationMs();

      this.drainElapsedMs =
        Math.min(
          totalDrainDuration,
          this.drainElapsedMs +
          deltaMs
        );

      if (
        this.drainElapsedMs >=
        totalDrainDuration
      ) {
        this.finishDrainAndReturn();
      }
    }
  }

  render() {
    const rect =
      this.canvas.getBoundingClientRect();

    this.ctx.clearRect(
      0,
      0,
      rect.width,
      rect.height
    );

    if (
      !this.ocean.cellW ||
      !this.ocean.cellH ||
      !this.ocean.rows
    ) {
      return;
    }

    if (
      this.mode === "swipe"
    ) {
      this.renderSwipeArt();
      return;
    }

    this.renderLoadingArt();
  }

  getArtLayout(
    lines,
    includeBounce = true
  ) {
    const width =
      Math.max(
        ...lines.map(
          (line) =>
            Array.from(line).length
        )
      );

    const height =
      lines.length;

    const scale =
      this.bucketScale;

    const scaledWidth =
      width * scale;

    const scaledHeight =
      height * scale;

    const originX =
      (
        this.ocean.cols -
        scaledWidth
      ) / 2;

    const centerRow =
      this.ocean.rows *
      BUCKET_CENTER_Y;

    const bounceOffset =
      includeBounce
        ? this.getBucketBounceOffsetCells()
        : 0;

    const originY =
      centerRow -
      scaledHeight / 2 +
      bounceOffset;

    return {
      originX,
      originY
    };
  }

  drawBucketGlyph(
    glyph,
    originX,
    originY,
    colIndex,
    rowIndex,
    color,
    alpha = 1
  ) {
    this.ocean.drawCellGlyph(
      this.ctx,
      glyph,
      originX +
        colIndex *
        this.bucketScale,
      originY +
        rowIndex *
        this.bucketScale,
      color,
      alpha,
      this.bucketScale,
      false
    );
  }

  renderLoadingArt() {
    const lines =
      IDLE_LOADING_ART;

    const {
      originX,
      originY
    } =
      this.getArtLayout(
        lines
      );

    lines.forEach(
      (
        line,
        rowIndex
      ) => {
        const glyphs =
          Array.from(line);

        glyphs.forEach(
          (
            glyph,
            colIndex
          ) => {
            if (
              glyph === " "
            ) {
              return;
            }

            const isLoadingInterior =
              LOADING_ROWS.includes(
                rowIndex
              ) &&
              colIndex >=
                LOADING_START_COLUMN &&
              colIndex <
                LOADING_START_COLUMN +
                LOADING_SLOT_COUNT;

            if (
              isLoadingInterior
            ) {
              return;
            }

            this.drawBucketGlyph(
              glyph,
              originX,
              originY,
              colIndex,
              rowIndex,
              BUCKET_COLOR
            );
          }
        );
      }
    );

    this.renderLoadingBars(
      originX,
      originY
    );
  }

  renderSwipeArt() {
    const lines =
      IDLE_SWIPE_ART;

    const {
      originX,
      originY
    } =
      this.getArtLayout(
        lines
      );

    lines.forEach(
      (
        line,
        rowIndex
      ) => {
        const glyphs =
          Array.from(line);

        glyphs.forEach(
          (
            glyph,
            colIndex
          ) => {
            if (
              glyph === " "
            ) {
              return;
            }

            const isLoadingInterior =
              LOADING_ROWS.includes(
                rowIndex
              ) &&
              colIndex >=
                SWIPE_LOADING_START_COLUMN &&
              colIndex <
                SWIPE_LOADING_START_COLUMN +
                LOADING_SLOT_COUNT;

            if (
              isLoadingInterior
            ) {
              return;
            }

            this.drawBucketGlyph(
              glyph,
              originX,
              originY,
              colIndex,
              rowIndex,
              BUCKET_COLOR
            );
          }
        );
      }
    );

    this.renderDrainBars(
      originX,
      originY
    );
  }

  renderLoadingBars(
    originX,
    originY
  ) {
    const slotDuration =
      this.loadingSlotDurationMs;

    LOADING_ROWS.forEach(
      (
        rowIndex,
        loadingOrder
      ) => {
        const rowStartSlot =
          loadingOrder *
          LOADING_SLOT_COUNT;

        const rowEndMs =
          (
            rowStartSlot +
            LOADING_SLOT_COUNT
          ) *
          slotDuration;

        const rowComplete =
          this.loadingElapsedMs >=
          rowEndMs;

        for (
          let slot = 0;
          slot <
          LOADING_SLOT_COUNT;
          slot += 1
        ) {
          const globalSlotIndex =
            rowStartSlot +
            slot;

          const slotStartMs =
            globalSlotIndex *
            slotDuration;

          const slotProgress =
            Math.max(
              0,
              Math.min(
                1,
                (
                  this.loadingElapsedMs -
                  slotStartMs
                ) /
                slotDuration
              )
            );

          let glyph =
            EMPTY_BAR_GLYPH;

          let color =
            EMPTY_BAR_COLOR;

          let alpha = 0.62;

          if (
            rowComplete
          ) {
            glyph =
              FILL_BAR_GLYPH;

            color =
              COMPLETE_BAR_COLOR;

            alpha = 1;
          } else if (
            slotProgress >= 1
          ) {
            glyph =
              FILL_BAR_GLYPH;

            color =
              ACTIVE_BAR_COLOR;

            alpha = 1;
          } else if (
            slotProgress > 0
          ) {
            const stageIndex =
              Math.min(
                ACTIVE_FILL_STAGES.length -
                  1,
                Math.floor(
                  slotProgress *
                  ACTIVE_FILL_STAGES.length
                )
              );

            glyph =
              ACTIVE_FILL_STAGES[
                stageIndex
              ];

            color =
              ACTIVE_BAR_COLOR;

            alpha = 1;
          }

          this.drawBucketGlyph(
            glyph,
            originX,
            originY,
            LOADING_START_COLUMN +
              slot,
            rowIndex,
            color,
            alpha
          );
        }
      }
    );
  }

  renderDrainBars(
    originX,
    originY
  ) {
    // Performance note:
    // - always exactly 39 potential bucket slots;
    // - no setInterval/setTimeout per slot;
    // - no objects/arrays created per slot or per frame;
    // - 16x only changes slotDuration, not amount of work.
    const slotDuration =
      this.drainSlotDurationMs;

    for (
      let rowListIndex = 0;
      rowListIndex <
      LOADING_ROW_COUNT;
      rowListIndex += 1
    ) {
      const rowIndex =
        LOADING_ROWS[
          rowListIndex
        ];

      let drainRowIndex = -1;

      // At most 3 comparisons. `drainRowOrder` was cached at release.
      for (
        let index = 0;
        index <
        this.drainRowOrder.length;
        index += 1
      ) {
        if (
          this.drainRowOrder[index] ===
          rowIndex
        ) {
          drainRowIndex =
            index;
          break;
        }
      }

      for (
        let slot = 0;
        slot <
        LOADING_SLOT_COUNT;
        slot += 1
      ) {
        let glyph =
          EMPTY_BAR_GLYPH;

        let color =
          EMPTY_BAR_COLOR;

        let alpha = 0.62;

        if (
          drainRowIndex >= 0
        ) {
          // Drain each completed white row from right -> left.
          const drainSlotIndex =
            (
              drainRowIndex *
              LOADING_SLOT_COUNT
            ) +
            (
              LOADING_SLOT_COUNT -
              1 -
              slot
            );

          const slotStartMs =
            drainSlotIndex *
            slotDuration;

          const slotProgress =
            Math.max(
              0,
              Math.min(
                1,
                (
                  this.drainElapsedMs -
                  slotStartMs
                ) /
                slotDuration
              )
            );

          if (
            slotProgress < 1
          ) {
            color =
              COMPLETE_BAR_COLOR;

            alpha = 1;

            if (
              slotProgress > 0
            ) {
              const stageIndex =
                Math.min(
                  DRAIN_FILL_STAGES.length -
                    1,
                  Math.floor(
                    slotProgress *
                    DRAIN_FILL_STAGES.length
                  )
                );

              glyph =
                DRAIN_FILL_STAGES[
                  stageIndex
                ];
            } else {
              glyph =
                FILL_BAR_GLYPH;
            }
          }
        }

        this.drawBucketGlyph(
          glyph,
          originX,
          originY,
          SWIPE_LOADING_START_COLUMN +
            slot,
          rowIndex,
          color,
          alpha
        );
      }
    }
  }

  loop(now) {
    const delta =
      Math.min(
        120,
        now -
        this.lastFrame
      );

    this.lastFrame = now;

    if (
      !document.hidden
    ) {
      this.update(delta);
    }

    this.render();

    this.frameHandle =
      requestAnimationFrame(
        this.boundLoop
      );
  }
}
