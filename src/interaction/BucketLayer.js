import {
  BUCKET_CELL_TYPES,
  getBucketCellMeta,
  isSpecialBucketCell
} from "../game/GachaSystem.js";

const BUCKET_COLOR = "#ffffff";
const EMPTY_BAR_COLOR = "#7188b8";
const ACTIVE_BAR_COLOR = "#fff35d";
const COMPLETE_BAR_COLOR = "#ffffff";

const EMPTY_BAR_GLYPH = "≡";
const FILL_BAR_GLYPH = "█";
const ACTIVE_FILL_STAGES = ["░", "▒", "▓", "█"];
const DRAIN_FILL_STAGES = ["█", "▓", "▒", "░"];
const SPECIAL_DRAIN_FILL_STAGES = ["█", "▓", "▒", "x"];

const DISCARD_GLYPH = "X";
const DISCARD_COLOR = "#fff35d";
const DISCARD_MARK_DURATION_MS = 240;

const DOUBLE_TAP_MAX_INTERVAL_MS = 320;
const DOUBLE_TAP_MAX_DURATION_MS = 260;
const DOUBLE_TAP_MAX_MOVE_PX = 18;
const DOUBLE_TAP_MAX_DISTANCE_PX = 42;

const BUCKET_CENTER_Y = 0.39;

// `IDLE_LOADING` row 1 is always the upper rim:
// "  ,--[___]--,"
// The generated bucket grows DOWNWARD for capacities > 3, so this reference
// stays at the same screen position regardless of bucket capacity.
const REFRESH_BUCKET_REFERENCE_ROW = 1;
const REFRESH_CLEARANCE_CELLS = 0.08;

const MAX_PULL_VIEWPORT_RATIO = 0.50;
const SWIPE_HOLD_VIEWPORT_RATIO = 0.20;

const RELEASE_TO_HOLD_DURATION_MS = 360;
const RETURN_TO_OCEAN_DURATION_MS = 420;

const BOUNCE_PERIOD_MS = 560;
const BOUNCE_DECAY_MS = 1250;

const MIN_BUCKET_BODY_ROWS = 3;
const MAX_BUCKET_LOADING_ROWS = 10;
const LOADING_SLOT_COUNT = 13;

const LOADING_START_COLUMN = 1;
const SWIPE_LOADING_START_COLUMN = 2;

// Static pieces of the original ASCII. Only the internal body is generated.
const IDLE_LOADING_TOP_ART = [
  "      ___",
  "  ,--[___]--,",
  " /           \\",
  "|,.--'```'--.,|",
  "|'-.,_____,.-'|",
  "|'-.,_____,.-'|"
];

const IDLE_LOADING_BODY_LINE =
  "|             |";

const IDLE_LOADING_BOTTOM_ART = [
  "|'-.,_____,.-'|",
  "`'-.,_____,.-''"
];

const IDLE_SWIPE_TOP_ART = [
  " ,.--'`````'--.,",
  "(\\'-.,_____,.-'/)",
  " \\\\-.,_____,.-//",
  " ;\\\\         //|",
  " | \\\\  ___  // |",
  " |  '-[___]-'  |"
];

const IDLE_SWIPE_BODY_LINE =
  " |             |";

const IDLE_SWIPE_BOTTOM_ART = [
  " `'-.,_____,.-''"
];

const BASE_LOADING_ART_HEIGHT =
  IDLE_LOADING_TOP_ART.length +
  MIN_BUCKET_BODY_ROWS +
  IDLE_LOADING_BOTTOM_ART.length;

const BASE_SWIPE_ART_HEIGHT =
  IDLE_SWIPE_TOP_ART.length +
  MIN_BUCKET_BODY_ROWS +
  IDLE_SWIPE_BOTTOM_ART.length;

// Generated once per mode/capacity and reused every frame.
const BUCKET_ART_CACHE =
  new Map();

function normalizeBucketLoadingRows(
  value
) {
  const numeric =
    Number(value);

  return Math.max(
    1,
    Math.min(
      MAX_BUCKET_LOADING_ROWS,
      Math.round(
        Number.isFinite(numeric)
          ? numeric
          : 3
      )
    )
  );
}

function getBucketArt(
  mode,
  requestedCapacityRows
) {
  const capacityRows =
    normalizeBucketLoadingRows(
      requestedCapacityRows
    );

  const cacheKey =
    `${mode}:${capacityRows}`;

  const cached =
    BUCKET_ART_CACHE.get(
      cacheKey
    );

  if (cached) {
    return cached;
  }

  const isSwipe =
    mode === "swipe";

  const topLines =
    isSwipe
      ? IDLE_SWIPE_TOP_ART
      : IDLE_LOADING_TOP_ART;

  const bottomLines =
    isSwipe
      ? IDLE_SWIPE_BOTTOM_ART
      : IDLE_LOADING_BOTTOM_ART;

  const bodyLine =
    isSwipe
      ? IDLE_SWIPE_BODY_LINE
      : IDLE_LOADING_BODY_LINE;

  // For capacities 1–3, silhouette stays identical to the original bucket.
  // For capacities >3, every extra capacity row adds one physical body row.
  const bodyRowCount =
    Math.max(
      MIN_BUCKET_BODY_ROWS,
      capacityRows
    );

  const bodyLines =
    Array.from(
      {
        length:
          bodyRowCount
      },
      () => bodyLine
    );

  const lines = [
    ...topLines,
    ...bodyLines,
    ...bottomLines
  ];

  const bodyStartRow =
    topLines.length;

  // Loading order is always bottom -> top.
  // If capacity is 1 or 2, the remaining body rows are simply blank.
  const loadingRows = [];

  for (
    let index = 0;
    index < capacityRows;
    index += 1
  ) {
    loadingRows.push(
      bodyStartRow +
      bodyRowCount -
      1 -
      index
    );
  }

  const width =
    Math.max(
      ...lines.map(
        (line) =>
          Array.from(line).length
      )
    );

  const art = {
    mode,
    capacityRows,
    lines,
    loadingRows,
    loadingStartColumn:
      isSwipe
        ? SWIPE_LOADING_START_COLUMN
        : LOADING_START_COLUMN,
    width,
    height:
      lines.length,
    baseHeight:
      isSwipe
        ? BASE_SWIPE_ART_HEIGHT
        : BASE_LOADING_ART_HEIGHT
  };

  BUCKET_ART_CACHE.set(
    cacheKey,
    art
  );

  return art;
}

export class BucketLayer {
  constructor(
    canvas,
    oceanEngine,
    {
      onRefresh,
      onAttentionCellDrained,
      onSpecialCellDrainStart,
      onSpecialCellDrained,
      onDiscardedSlots,
      onOceanOffsetChanged,
      onFirstLoadingRowCompleted,
      onSwipeCycleCompleted,
      gachaSystem
    } = {}
  ) {
    this.canvas = canvas;
    this.ctx =
      canvas.getContext("2d");
    this.ocean =
      oceanEngine;
    this.onRefresh =
      onRefresh;

    this.onAttentionCellDrained =
      onAttentionCellDrained;

    this.onSpecialCellDrainStart =
      onSpecialCellDrainStart;

    this.onSpecialCellDrained =
      onSpecialCellDrained;

    this.onDiscardedSlots =
      onDiscardedSlots;

    this.onOceanOffsetChanged =
      onOceanOffsetChanged;

    this.onFirstLoadingRowCompleted =
      onFirstLoadingRowCompleted;

    this.onSwipeCycleCompleted =
      onSwipeCycleCompleted;

    this.firstLoadingRowCompletionEmitted =
      false;

    this.gachaSystem =
      gachaSystem;

    // loading | swipe
    this.mode = "loading";

    // draining | returning | null
    this.swipePhase = null;

    this.loadingElapsedMs = 0;

    // Bottom -> top. A row is rolled only after all 13 yellow loading slots
    // complete, so unfinished rows never expose their gacha result.
    this.loadingRewardRows = [];

    this.drainElapsedMs = 0;
    this.drainCompletedRows = 0;
    this.drainBucketCapacityRows = 0;
    this.drainRowOrder = [];
    this.drainRewardRows = [];

    // Timeline is built once on release. Variable per-cell duration therefore
    // adds no timers and is ready for future contextual drain-speed rules.
    this.drainTimeline = [];
    this.drainTimelineIndexByCell =
      new Int32Array(0);

    this.creditedDrainSlots = 0;
    this.announcedDrainSlots = 0;
    this.drainFinished = false;

    // Double-tap discard state. `lastDiscardedSlotCount` intentionally
    // survives the return to IDLE-LOADING so the next accounting mechanic
    // can consume this information without changing the gesture again.
    this.discardElapsedMs = 0;
    this.discardSlotMask =
      new Uint8Array(0);
    this.discardedSlotCount = 0;
    this.lastDiscardedSlotCount = 0;

    this.swipeTap = {
      active: false,
      id: null,
      startX: 0,
      startY: 0,
      startAt: 0,
      lastTapAt: -Infinity,
      lastTapX: 0,
      lastTapY: 0
    };

    this.bounceElapsedMs = 0;

    this.lastFrame =
      performance.now();
    this.frameHandle = 0;
    this.resizeObserver = null;

    this.oceanOffsetY = 0;
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

  get bucketFillSpeedMultiplier() {
    const configured =
      Number(
        this.ocean.config
          .bucketFillSpeedMultiplier
      );

    return Math.max(
      0.01,
      Math.min(
        50,
        Number.isFinite(configured)
          ? configured
          : 1
      )
    );
  }

  get loadingSlotDurationMs() {
    const baseDurationMs =
      Math.max(
        50,
        Number(
          this.ocean.config
            .bucketLoadingSlotDurationMs
        ) || 1000
      );

    // Tuning keeps the old 1000ms-per-slot baseline in JSON while exposing
    // a more intuitive speed multiplier in debug. Speed changes only the
    // elapsed-time math; it never adds timers or work per frame.
    return Math.max(
      16,
      baseDurationMs /
        this.bucketFillSpeedMultiplier
    );
  }

  get bucketLoadingRows() {
    return normalizeBucketLoadingRows(
      this.ocean.config
        .bucketLoadingRows
    );
  }

  get drainSpeedMultiplier() {
    const configured =
      Number(
        this.ocean.config
          .bucketDrainSpeedMultiplier
      );

    // Roadmap 0.3.x:
    // this fixed value will later be resolved from the number of completed
    // rows captured at release. Keeping this behind one getter means that
    // change will not require rewriting the drain renderer.
    return Math.max(
      0.25,
      Math.min(
        16,
        Number.isFinite(configured)
          ? configured
          : 7
      )
    );
  }

  get drainSlotDurationMs() {
    return (
      this.loadingSlotDurationMs /
      this.drainSpeedMultiplier
    );
  }

  get specialCellDrainDurationMultiplier() {
    const configured =
      Number(
        this.ocean.config
          .specialCellDrainDurationMultiplier
      );

    return Math.max(
      1,
      Math.min(
        24,
        Number.isFinite(
          configured
        )
          ? configured
          : 6
      )
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
          : 1.6
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
    const art =
      getBucketArt(
        "loading",
        this.bucketLoadingRows
      );

    const {
      originY
    } = this.getArtLayout(
      art,
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

  isBucketOutOfWater(
    visualOceanOffset =
      this.oceanOffsetY
  ) {
    // Single source of truth:
    // the exact geometry that arms IDLE-SWIPE also determines whether the
    // IDLE-LOADING bars are allowed to keep filling.
    return this.isRefreshGeometrySatisfied(
      visualOceanOffset
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
        this.bucketLoadingRows,
        Math.floor(
          this.loadingElapsedMs /
          rowDuration
        )
      )
    );
  }

  getDrainTotalDurationMs() {
    if (
      this.drainTimeline.length === 0
    ) {
      return 0;
    }

    return this.drainTimeline[
      this.drainTimeline.length - 1
    ].endMs;
  }

  resolveNewlyCompletedRows() {
    const completedRows =
      this.getCompletedLoadingRows();

    while (
      this.loadingRewardRows.length <
      completedRows
    ) {
      const loadingOrder =
        this.loadingRewardRows.length;

      const rowRewards =
        this.gachaSystem?.rollRow(
          LOADING_SLOT_COUNT,
          {
            bucketRows:
              this.bucketLoadingRows,
            loadingOrder
          }
        ) ??
        new Uint8Array(
          LOADING_SLOT_COUNT
        );

      this.loadingRewardRows.push(
        rowRewards
      );
    }

    if (
      !this.firstLoadingRowCompletionEmitted &&
      completedRows > 0
    ) {
      this.firstLoadingRowCompletionEmitted =
        true;

      this.onFirstLoadingRowCompleted?.(
        {
          bucketRows:
            this.bucketLoadingRows,
          completedRows
        }
      );
    }
  }

  buildDrainTimeline(
    swipeArt
  ) {
    this.drainTimeline = [];

    this.drainTimelineIndexByCell =
      new Int32Array(
        swipeArt.height *
        LOADING_SLOT_COUNT
      );

    this.drainTimelineIndexByCell.fill(
      -1
    );

    const normalDuration =
      this.drainSlotDurationMs;

    const specialDuration =
      normalDuration *
      this
        .specialCellDrainDurationMultiplier;

    let cursorMs = 0;

    for (
      let drainRowIndex = 0;
      drainRowIndex <
      this.drainRowOrder.length;
      drainRowIndex += 1
    ) {
      const rowIndex =
        this.drainRowOrder[
          drainRowIndex
        ];

      // loadingRewardRows is bottom -> top, while drainRowOrder is
      // highest-completed -> bottom.
      const rewardRowIndex =
        this.drainCompletedRows -
        1 -
        drainRowIndex;

      const rewardRow =
        this.drainRewardRows[
          rewardRowIndex
        ] ??
        new Uint8Array(
          LOADING_SLOT_COUNT
        );

      for (
        let withinRowIndex = 0;
        withinRowIndex <
        LOADING_SLOT_COUNT;
        withinRowIndex += 1
      ) {
        const slot =
          LOADING_SLOT_COUNT -
          1 -
          withinRowIndex;

        const cellType =
          rewardRow[slot] ??
          BUCKET_CELL_TYPES.ATTENTION;

        const durationMs =
          isSpecialBucketCell(
            cellType
          )
            ? specialDuration
            : normalDuration;

        const timelineIndex =
          this.drainTimeline.length;

        const entry = {
          timelineIndex,
          rowIndex,
          slot,
          cellType,
          startMs:
            cursorMs,
          durationMs,
          endMs:
            cursorMs +
            durationMs
        };

        this.drainTimeline.push(
          entry
        );

        this.drainTimelineIndexByCell[
          rowIndex *
          LOADING_SLOT_COUNT +
          slot
        ] =
          timelineIndex;

        cursorMs =
          entry.endMs;
      }
    }
  }

  getDrainTimelineEntry(
    rowIndex,
    slot
  ) {
    const lookupIndex =
      rowIndex *
      LOADING_SLOT_COUNT +
      slot;

    if (
      lookupIndex < 0 ||
      lookupIndex >=
        this.drainTimelineIndexByCell
          .length
    ) {
      return null;
    }

    const timelineIndex =
      this.drainTimelineIndexByCell[
        lookupIndex
      ];

    if (
      timelineIndex < 0
    ) {
      return null;
    }

    return (
      this.drainTimeline[
        timelineIndex
      ] ?? null
    );
  }

  getBucketBounceOffsetCells() {
    if (
      this.mode !== "swipe" ||
      (
        this.swipePhase !== "draining" &&
        this.swipePhase !== "discarding"
      ) ||
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

    this.drainBucketCapacityRows =
      this.bucketLoadingRows;

    this.drainCompletedRows =
      Math.min(
        this.drainBucketCapacityRows,
        completedRows
      );

    const swipeArt =
      getBucketArt(
        "swipe",
        this.drainBucketCapacityRows
      );

    // Make sure the just-completed row has already received its gacha roll.
    this.resolveNewlyCompletedRows();

    // Completed rows are bottom-first. Drain highest completed row first.
    this.drainRowOrder =
      swipeArt.loadingRows
        .slice(
          0,
          this.drainCompletedRows
        )
        .reverse();

    // Freeze the row contents for the current IDLE-SWIPE. Future gacha
    // probability changes affect only rows completed after this cycle.
    this.drainRewardRows =
      this.loadingRewardRows
        .slice(
          0,
          this.drainCompletedRows
        )
        .map(
          (row) =>
            new Uint8Array(
              row
            )
        );

    this.buildDrainTimeline(
      swipeArt
    );

    this.discardElapsedMs = 0;
    this.discardSlotMask =
      new Uint8Array(0);
    this.discardedSlotCount = 0;
    this.creditedDrainSlots = 0;
    this.announcedDrainSlots = 0;

    this.loadingElapsedMs = 0;
    this.drainElapsedMs = 0;
    this.bounceElapsedMs = 0;
    this.drainFinished = false;

    this.mode = "swipe";
    this.swipePhase =
      "draining";

    // New sea appears on release.
    this.onRefresh?.();

    this.startOffsetAnimation(
      this.getSwipeHoldOffset(),
      RELEASE_TO_HOLD_DURATION_MS
    );

    return true;
  }

  finishDrainAndReturn(
    completedNaturally = true
  ) {
    if (
      this.drainFinished
    ) {
      return;
    }

    if (
      completedNaturally
    ) {
      this.onSwipeCycleCompleted?.(
        {
          bucketRows:
            this.drainBucketCapacityRows,
          completedRows:
            this.drainCompletedRows
        }
      );
    }

    this.drainFinished = true;
    this.swipePhase =
      "returning";

    this.startOffsetAnimation(
      0,
      RETURN_TO_OCEAN_DURATION_MS,
      () => {
        this.mode = "loading";
        this.swipePhase = null;
        this.drainElapsedMs = 0;
        this.drainCompletedRows = 0;
        this.drainBucketCapacityRows = 0;
        this.drainRowOrder = [];
        this.drainRewardRows = [];
        this.drainTimeline = [];
        this.drainTimelineIndexByCell =
          new Int32Array(0);
        this.creditedDrainSlots = 0;
        this.announcedDrainSlots = 0;
        this.drainFinished = false;
        this.discardElapsedMs = 0;
        this.discardSlotMask =
          new Uint8Array(0);
        this.discardedSlotCount = 0;
        this.resetSwipeTapState(
          true
        );
        this.bounceElapsedMs = 0;
        this.loadingElapsedMs = 0;
        this.loadingRewardRows = [];
        this.firstLoadingRowCompletionEmitted =
          false;
      }
    );
  }

  getDrainSlotProgress(
    rowIndex,
    slot
  ) {
    const entry =
      this.getDrainTimelineEntry(
        rowIndex,
        slot
      );

    if (
      !entry
    ) {
      return 1;
    }

    return Math.max(
      0,
      Math.min(
        1,
        (
          this.drainElapsedMs -
          entry.startMs
        ) /
        Math.max(
          1,
          entry.durationMs
        )
      )
    );
  }

  getDrainEntryScreenPosition(
    entry
  ) {
    if (
      !entry
    ) {
      return null;
    }

    const capacityRows =
      this.drainBucketCapacityRows ||
      this.bucketLoadingRows;

    const art =
      getBucketArt(
        "swipe",
        capacityRows
      );

    const {
      originX,
      originY
    } =
      this.getArtLayout(
        art
      );

    const logicalX =
      originX +
      (
        art.loadingStartColumn +
        entry.slot
      ) *
      this.bucketScale;

    const logicalY =
      originY +
      entry.rowIndex *
      this.bucketScale;

    return {
      x:
        logicalX *
        this.ocean.cellW +
        this.ocean.cellW *
        0.5,
      y:
        logicalY *
        this.ocean.cellH +
        this.ocean.cellH *
        0.5
    };
  }

  announceNewlyStartedSpecialCells() {
    while (
      this.announcedDrainSlots <
        this.drainTimeline.length &&
      this.drainTimeline[
        this.announcedDrainSlots
      ].startMs <=
        this.drainElapsedMs
    ) {
      const entry =
        this.drainTimeline[
          this.announcedDrainSlots
        ];

      if (
        isSpecialBucketCell(
          entry.cellType
        )
      ) {
        const meta =
          getBucketCellMeta(
            entry.cellType
          );

        const source =
          this.getDrainEntryScreenPosition(
            entry
          );

        this.onSpecialCellDrainStart?.(
          {
            type:
              entry.cellType,
            id:
              meta.id,
            label:
              meta.label,
            color:
              meta.color,
            durationMs:
              entry.durationMs,
            sourceX:
              source?.x,
            sourceY:
              source?.y
          }
        );
      }

      this.announcedDrainSlots +=
        1;
    }
  }

  creditNewlyDrainedSlots() {
    while (
      this.creditedDrainSlots <
        this.drainTimeline.length &&
      this.drainTimeline[
        this.creditedDrainSlots
      ].endMs <=
        this.drainElapsedMs +
        0.0001
    ) {
      const entry =
        this.drainTimeline[
          this.creditedDrainSlots
        ];

      const source =
        this.getDrainEntryScreenPosition(
          entry
        );

      if (
        entry.cellType ===
        BUCKET_CELL_TYPES.ATTENTION
      ) {
        this.onAttentionCellDrained?.(
          {
            sourceX:
              source?.x,
            sourceY:
              source?.y,
            drainSlotIndex:
              entry.timelineIndex
          }
        );
      } else {
        const meta =
          getBucketCellMeta(
            entry.cellType
          );

        this.onSpecialCellDrained?.(
          {
            type:
              entry.cellType,
            id:
              meta.id,
            label:
              meta.label,
            color:
              meta.color,
            sourceX:
              source?.x,
            sourceY:
              source?.y,
            drainSlotIndex:
              entry.timelineIndex
          }
        );
      }

      this.creditedDrainSlots +=
        1;
    }
  }

  captureRemainingDiscardSlots() {
    const capacityRows =
      this.drainBucketCapacityRows ||
      this.bucketLoadingRows;

    const art =
      getBucketArt(
        "swipe",
        capacityRows
      );

    const mask =
      new Uint8Array(
        art.loadingRows.length *
        LOADING_SLOT_COUNT
      );

    let remainingCount = 0;

    for (
      let rowListIndex = 0;
      rowListIndex <
      art.loadingRows.length;
      rowListIndex += 1
    ) {
      const rowIndex =
        art.loadingRows[
          rowListIndex
        ];

      for (
        let slot = 0;
        slot <
        LOADING_SLOT_COUNT;
        slot += 1
      ) {
        if (
          this.getDrainSlotProgress(
            rowIndex,
            slot
          ) >= 1
        ) {
          continue;
        }

        mask[
          rowListIndex *
          LOADING_SLOT_COUNT +
          slot
        ] = 1;

        remainingCount += 1;
      }
    }

    this.discardSlotMask =
      mask;

    this.discardedSlotCount =
      remainingCount;

    this.lastDiscardedSlotCount =
      remainingCount;

    this.onDiscardedSlots?.(
      remainingCount
    );

    return remainingCount;
  }

  triggerDiscard() {
    if (
      this.mode !== "swipe" ||
      this.swipePhase !== "draining"
    ) {
      return false;
    }

    const remainingCount =
      this.captureRemainingDiscardSlots();

    if (
      remainingCount <= 0
    ) {
      this.finishDrainAndReturn();
      return false;
    }

    // Freeze normal drain progression. All still-existing slots are now
    // represented by a visible yellow X until the short discard cue ends.
    this.swipePhase =
      "discarding";

    this.discardElapsedMs = 0;

    this.resetSwipeTapState(
      true
    );

    return true;
  }

  finishDiscardAndReturn() {
    if (
      this.mode !== "swipe" ||
      this.swipePhase !== "discarding"
    ) {
      return;
    }

    // Everything represented by the yellow Xs is now considered discarded.
    // Mark drain time as fully complete so the returning pose renders empty.
    this.drainElapsedMs =
      this.getDrainTotalDurationMs();

    this.discardElapsedMs =
      DISCARD_MARK_DURATION_MS;

    this.discardSlotMask =
      new Uint8Array(0);

    this.discardedSlotCount = 0;

    this.finishDrainAndReturn(
      false
    );
  }

  resetSwipeTapState(
    clearPreviousTap = false
  ) {
    this.swipeTap.active = false;
    this.swipeTap.id = null;
    this.swipeTap.startX = 0;
    this.swipeTap.startY = 0;
    this.swipeTap.startAt = 0;

    if (
      clearPreviousTap
    ) {
      this.swipeTap.lastTapAt =
        -Infinity;

      this.swipeTap.lastTapX = 0;
      this.swipeTap.lastTapY = 0;
    }
  }

  beginSwipeTap(event) {
    if (
      this.mode !== "swipe" ||
      this.swipePhase !== "draining"
    ) {
      return;
    }

    this.swipeTap.active = true;
    this.swipeTap.id =
      event.pointerId;
    this.swipeTap.startX =
      event.clientX;
    this.swipeTap.startY =
      event.clientY;
    this.swipeTap.startAt =
      performance.now();

    try {
      this.canvas.setPointerCapture(
        event.pointerId
      );
    } catch {
      // No-op.
    }
  }

  updateSwipeTap(event) {
    if (
      !this.swipeTap.active ||
      event.pointerId !==
        this.swipeTap.id
    ) {
      return false;
    }

    const deltaX =
      event.clientX -
      this.swipeTap.startX;

    const deltaY =
      event.clientY -
      this.swipeTap.startY;

    if (
      Math.hypot(
        deltaX,
        deltaY
      ) >
      DOUBLE_TAP_MAX_MOVE_PX
    ) {
      this.resetSwipeTapState(
        false
      );
    }

    return true;
  }

  finishSwipeTap(event) {
    if (
      !this.swipeTap.active ||
      event.pointerId !==
        this.swipeTap.id
    ) {
      return false;
    }

    const now =
      performance.now();

    const duration =
      now -
      this.swipeTap.startAt;

    const deltaX =
      event.clientX -
      this.swipeTap.startX;

    const deltaY =
      event.clientY -
      this.swipeTap.startY;

    const movement =
      Math.hypot(
        deltaX,
        deltaY
      );

    try {
      if (
        this.canvas.hasPointerCapture(
          event.pointerId
        )
      ) {
        this.canvas.releasePointerCapture(
          event.pointerId
        );
      }
    } catch {
      // No-op.
    }

    const isTap =
      duration <=
        DOUBLE_TAP_MAX_DURATION_MS &&
      movement <=
        DOUBLE_TAP_MAX_MOVE_PX;

    this.swipeTap.active = false;
    this.swipeTap.id = null;

    if (
      !isTap
    ) {
      this.swipeTap.lastTapAt =
        -Infinity;

      return true;
    }

    const distanceFromPreviousTap =
      Math.hypot(
        event.clientX -
          this.swipeTap.lastTapX,
        event.clientY -
          this.swipeTap.lastTapY
      );

    const isDoubleTap =
      now -
        this.swipeTap.lastTapAt <=
        DOUBLE_TAP_MAX_INTERVAL_MS &&
      distanceFromPreviousTap <=
        DOUBLE_TAP_MAX_DISTANCE_PX;

    if (
      isDoubleTap
    ) {
      this.swipeTap.lastTapAt =
        -Infinity;

      this.triggerDiscard();
      return true;
    }

    this.swipeTap.lastTapAt =
      now;
    this.swipeTap.lastTapX =
      event.clientX;
    this.swipeTap.lastTapY =
      event.clientY;

    return true;
  }

  handlePointerDown(event) {
    if (
      this.mode === "swipe"
    ) {
      this.beginSwipeTap(
        event
      );
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
      this.mode === "swipe" &&
      this.swipeTap.active
    ) {
      this.updateSwipeTap(
        event
      );
      return;
    }

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
      this.mode === "swipe" &&
      this.swipeTap.active
    ) {
      this.finishSwipeTap(
        event
      );
      return;
    }

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
      this.mode === "swipe" &&
      this.swipeTap.active &&
      event.pointerId ===
        this.swipeTap.id
    ) {
      this.resetSwipeTapState(
        true
      );
      return;
    }

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

    this.onOceanOffsetChanged?.(
      offsetY
    );
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
      // Loading only progresses while the bucket rim is submerged.
      //
      // This check is based on the CURRENT visual ocean offset, not on
      // pointer state. Therefore it also behaves correctly when:
      //
      // 1. the user pulls the bucket out of the water -> loading freezes;
      // 2. without releasing, drags back below the surface -> loading resumes;
      // 3. an invalid release returns the ocean from above the surface ->
      //    loading stays frozen during the return until the rim is submerged.
      if (
        this.isBucketOutOfWater()
      ) {
        return;
      }

      const totalSlots =
        this.bucketLoadingRows *
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

      this.resolveNewlyCompletedRows();

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

      // Special cells announce themselves when their individual drain starts.
      // The terminal animation uses the same precomputed duration.
      this.announceNewlyStartedSpecialCells();

      // Only white/ATTENTION cells score. Emotion cells replace Attention
      // rather than adding to it.
      this.creditNewlyDrainedSlots();

      if (
        this.drainElapsedMs >=
        totalDrainDuration
      ) {
        this.finishDrainAndReturn();
      }

      return;
    }

    if (
      this.swipePhase ===
      "discarding"
    ) {
      this.bounceElapsedMs +=
        deltaMs;

      this.discardElapsedMs =
        Math.min(
          DISCARD_MARK_DURATION_MS,
          this.discardElapsedMs +
          deltaMs
        );

      if (
        this.discardElapsedMs >=
        DISCARD_MARK_DURATION_MS
      ) {
        this.finishDiscardAndReturn();
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
    art,
    includeBounce = true
  ) {
    const scale =
      this.bucketScale;

    const scaledWidth =
      art.width *
      scale;

    // Important: extra capacity grows DOWNWARD. We position the top using
    // the original 3-row silhouette height instead of recentering the taller
    // generated art.
    const baseScaledHeight =
      art.baseHeight *
      scale;

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
      baseScaledHeight / 2 +
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

  drawRewardBucketGlyph(
    glyph,
    originX,
    originY,
    colIndex,
    rowIndex,
    cellType,
    alpha = 1
  ) {
    const meta =
      getBucketCellMeta(
        cellType
      );

    if (
      !isSpecialBucketCell(
        cellType
      )
    ) {
      this.drawBucketGlyph(
        glyph,
        originX,
        originY,
        colIndex,
        rowIndex,
        meta.color,
        alpha
      );

      return;
    }

    this.ctx.save();

    this.ctx.shadowColor =
      meta.glowColor;

    this.ctx.shadowBlur =
      Math.max(
        5,
        this.ocean.cellW *
        0.72
      );

    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;

    this.drawBucketGlyph(
      glyph,
      originX,
      originY,
      colIndex,
      rowIndex,
      meta.color,
      alpha
    );

    this.ctx.restore();
  }

  renderLoadingArt() {
    const art =
      getBucketArt(
        "loading",
        this.bucketLoadingRows
      );

    const {
      originX,
      originY
    } =
      this.getArtLayout(
        art
      );

    this.renderBucketStructure(
      art,
      originX,
      originY
    );

    this.renderLoadingBars(
      art,
      originX,
      originY
    );
  }

  renderSwipeArt() {
    const capacityRows =
      this.drainBucketCapacityRows ||
      this.bucketLoadingRows;

    const art =
      getBucketArt(
        "swipe",
        capacityRows
      );

    const {
      originX,
      originY
    } =
      this.getArtLayout(
        art
      );

    this.renderBucketStructure(
      art,
      originX,
      originY
    );

    if (
      this.swipePhase ===
      "discarding"
    ) {
      this.renderDiscardBars(
        art,
        originX,
        originY
      );
      return;
    }

    this.renderDrainBars(
      art,
      originX,
      originY
    );
  }

  renderBucketStructure(
    art,
    originX,
    originY
  ) {
    art.lines.forEach(
      (
        line,
        rowIndex
      ) => {
        const glyphs =
          Array.from(line);

        const isLoadingRow =
          art.loadingRows.includes(
            rowIndex
          );

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
              isLoadingRow &&
              colIndex >=
                art.loadingStartColumn &&
              colIndex <
                art.loadingStartColumn +
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
  }

  renderLoadingBars(
    art,
    originX,
    originY
  ) {
    const slotDuration =
      this.loadingSlotDurationMs;

    for (
      let loadingOrder = 0;
      loadingOrder <
      art.loadingRows.length;
      loadingOrder += 1
    ) {
      const rowIndex =
        art.loadingRows[
          loadingOrder
        ];

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

        let completedCellType =
          BUCKET_CELL_TYPES.ATTENTION;

        if (
          rowComplete
        ) {
          glyph =
            FILL_BAR_GLYPH;

          completedCellType =
            this.loadingRewardRows[
              loadingOrder
            ]?.[slot] ??
            BUCKET_CELL_TYPES.ATTENTION;

          color =
            getBucketCellMeta(
              completedCellType
            ).color;

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

        if (
          rowComplete
        ) {
          this.drawRewardBucketGlyph(
            glyph,
            originX,
            originY,
            art.loadingStartColumn +
              slot,
            rowIndex,
            completedCellType,
            alpha
          );
        } else {
          this.drawBucketGlyph(
            glyph,
            originX,
            originY,
            art.loadingStartColumn +
              slot,
            rowIndex,
            color,
            alpha
          );
        }
      }
    }
  }

  renderDiscardBars(
    art,
    originX,
    originY
  ) {
    for (
      let rowListIndex = 0;
      rowListIndex <
      art.loadingRows.length;
      rowListIndex += 1
    ) {
      const rowIndex =
        art.loadingRows[
          rowListIndex
        ];

      for (
        let slot = 0;
        slot <
        LOADING_SLOT_COUNT;
        slot += 1
      ) {
        const maskIndex =
          rowListIndex *
          LOADING_SLOT_COUNT +
          slot;

        const shouldDiscard =
          this.discardSlotMask[
            maskIndex
          ] === 1;

        this.drawBucketGlyph(
          shouldDiscard
            ? DISCARD_GLYPH
            : EMPTY_BAR_GLYPH,
          originX,
          originY,
          art.loadingStartColumn +
            slot,
          rowIndex,
          shouldDiscard
            ? DISCARD_COLOR
            : EMPTY_BAR_COLOR,
          shouldDiscard
            ? 1
            : 0.62
        );
      }
    }
  }

  renderDrainBars(
    art,
    originX,
    originY
  ) {
    // Timeline lookup keeps render cost linear in visible bucket capacity.
    // Special duration does not add timers or extra update loops.
    for (
      let rowListIndex = 0;
      rowListIndex <
      art.loadingRows.length;
      rowListIndex += 1
    ) {
      const rowIndex =
        art.loadingRows[
          rowListIndex
        ];

      for (
        let slot = 0;
        slot <
        LOADING_SLOT_COUNT;
        slot += 1
      ) {
        const entry =
          this.getDrainTimelineEntry(
            rowIndex,
            slot
          );

        let glyph =
          EMPTY_BAR_GLYPH;

        let color =
          EMPTY_BAR_COLOR;

        let alpha = 0.62;

        let cellType =
          BUCKET_CELL_TYPES.ATTENTION;

        if (
          entry
        ) {
          const slotProgress =
            this.getDrainSlotProgress(
              rowIndex,
              slot
            );

          if (
            slotProgress < 1
          ) {
            cellType =
              entry.cellType;

            color =
              getBucketCellMeta(
                cellType
              ).color;

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
                (
                  isSpecialBucketCell(
                    cellType
                  )
                    ? SPECIAL_DRAIN_FILL_STAGES
                    : DRAIN_FILL_STAGES
                )[
                  stageIndex
                ];
            } else {
              glyph =
                FILL_BAR_GLYPH;
            }
          }
        }

        if (
          entry &&
          glyph !==
            EMPTY_BAR_GLYPH &&
          isSpecialBucketCell(
            cellType
          )
        ) {
          this.drawRewardBucketGlyph(
            glyph,
            originX,
            originY,
            art.loadingStartColumn +
              slot,
            rowIndex,
            cellType,
            alpha
          );
        } else {
          this.drawBucketGlyph(
            glyph,
            originX,
            originY,
            art.loadingStartColumn +
              slot,
            rowIndex,
            color,
            alpha
          );
        }
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
