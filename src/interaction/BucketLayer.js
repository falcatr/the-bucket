const BUCKET_COLOR = "#ff8c42";
const EMPTY_BAR_COLOR = "#7188b8";
const ACTIVE_BAR_COLOR = "#fff35d";
const COMPLETE_BAR_COLOR = "#f2ffff";

const EMPTY_BAR_GLYPH = "≡";
const FILL_BAR_GLYPH = "█";
const ACTIVE_FILL_STAGES = ["░", "▒", "▓", "█"];

const SWIPE_POSE_DURATION_MS = 520;
const BUCKET_CENTER_Y = 0.39;

// `IDLE_LOADING_ART[1]` is the upper rim:
// "  ,--[___]--,"
// Refresh only becomes valid after this complete row is visually above
// the animated waterline. This is resolution-independent.
const REFRESH_BUCKET_REFERENCE_ROW = 1;
const REFRESH_CLEARANCE_CELLS = 0.08;
const RETURN_DURATION_MS = 390;
// Maximum visual travel is intentionally independent from the refresh
// threshold. Users can keep pulling after the gesture is already armed.
const MAX_PULL_VIEWPORT_RATIO = 0.50;

// Arte baseada no arquivo balde_ascii.txt enviado como referência.
// A escala do balde é uniforme e vem do config/debug para nunca deformar a arte.
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

// O preenchimento continua de baixo para cima, mas agora toda a área
// interna entre as bordas verticais é ocupada pela barra.
const LOADING_ROWS = [8, 7, 6];
const LOADING_START_COLUMN = 1;
const LOADING_SLOT_COUNT = 13;

export class BucketLayer {
  constructor(canvas, oceanEngine, { onRefresh } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ocean = oceanEngine;
    this.onRefresh = onRefresh;

    this.mode = "loading";
    this.loadingElapsedMs = 0;
    this.swipePoseElapsedMs = 0;
    this.lastFrame = performance.now();
    this.frameHandle = 0;
    this.resizeObserver = null;

    this.oceanOffsetY = 0;
    this.returnAnimation = null;

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

    this.boundLoop = this.loop.bind(this);
    this.boundPointerDown = this.handlePointerDown.bind(this);
    this.boundPointerMove = this.handlePointerMove.bind(this);
    this.boundPointerUp = this.handlePointerUp.bind(this);
    this.boundPointerCancel = this.handlePointerCancel.bind(this);
  }

  start() {
    this.resize();

    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
      this.setOceanOffset(0);
    });
    this.resizeObserver.observe(this.canvas);

    this.canvas.addEventListener("pointerdown", this.boundPointerDown);
    this.canvas.addEventListener("pointermove", this.boundPointerMove);
    this.canvas.addEventListener("pointerup", this.boundPointerUp);
    this.canvas.addEventListener("pointercancel", this.boundPointerCancel);

    this.lastFrame = performance.now();
    this.frameHandle = requestAnimationFrame(this.boundLoop);
  }

  destroy() {
    cancelAnimationFrame(this.frameHandle);
    this.resizeObserver?.disconnect();

    this.canvas.removeEventListener("pointerdown", this.boundPointerDown);
    this.canvas.removeEventListener("pointermove", this.boundPointerMove);
    this.canvas.removeEventListener("pointerup", this.boundPointerUp);
    this.canvas.removeEventListener("pointercancel", this.boundPointerCancel);

    this.setOceanOffset(0);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.imageSmoothingEnabled = false;
  }

  get loadingSlotDurationMs() {
    return Math.max(50, Number(this.ocean.config.bucketLoadingSlotDurationMs) || 1000);
  }

  get bucketScale() {
    const configured = Number(this.ocean.config.bucketScale);
    return Math.max(
      0.2,
      Math.min(
        1.5,
        Number.isFinite(configured) ? configured : 0.5
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

    // drawCellGlyph uses the center of the logical row.
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
      IDLE_LOADING_ART
    );

    // `,--[___]--,` is row 1. We compare against its BOTTOM edge so the
    // entire rim row must already be outside the underwater region.
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

  resetLoading() {
    this.loadingElapsedMs = 0;
  }

  triggerRefresh() {
    if (this.mode === "swipe") return;

    this.mode = "swipe";
    this.swipePoseElapsedMs = 0;
    this.resetLoading();
    this.onRefresh?.();
  }

  handlePointerDown(event) {
    if (this.mode === "swipe") return;

    this.returnAnimation = null;
    this.pointer.active = true;
    this.pointer.id = event.pointerId;
    this.pointer.startX = event.clientX;
    this.pointer.startY = event.clientY;
    this.pointer.currentX = event.clientX;
    this.pointer.currentY = event.clientY;
    this.pointer.rawPullDistance = 0;
    this.pointer.armed = false;

    try {
      this.canvas.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture pode não existir em browsers mais antigos.
    }
  }

  handlePointerMove(event) {
    if (!this.pointer.active || event.pointerId !== this.pointer.id) return;

    this.pointer.currentX = event.clientX;
    this.pointer.currentY = event.clientY;

    const deltaX = this.pointer.currentX - this.pointer.startX;
    const deltaY = this.pointer.currentY - this.pointer.startY;
    const downwardDistance = Math.max(0, deltaY);
    const isMostlyVertical = downwardDistance >= Math.abs(deltaX) * 0.82;

    this.pointer.rawPullDistance = downwardDistance;

    const visualDistance =
      this.calculateResistedDistance(
        downwardDistance
      );

    // Resolution-independent refresh rule: arm only when the real
    // waterline has moved below the complete `,--[___]--,` rim.
    this.pointer.armed =
      isMostlyVertical &&
      this.isRefreshGeometrySatisfied(
        visualDistance
      );

    // Pull-to-refresh: o gesto apenas desloca o MESMO canvas alto do oceano.
    // A região de reflexos já existe e está animando acima da viewport; ao
    // mover o canvas para baixo, essa continuação é revelada sem trocar cena
    // ou expor uma camada de background separada.
    this.setOceanOffset(visualDistance);
  }

  handlePointerUp(event) {
    if (!this.pointer.active || event.pointerId !== this.pointer.id) return;

    this.pointer.currentX = event.clientX;
    this.pointer.currentY = event.clientY;

    const deltaX = this.pointer.currentX - this.pointer.startX;
    const deltaY = this.pointer.currentY - this.pointer.startY;
    const downwardDistance = Math.max(
      0,
      deltaY
    );

    const visualDistance =
      this.calculateResistedDistance(
        downwardDistance
      );

    const isVerticalEnough =
      downwardDistance >=
      Math.abs(deltaX) * 1.05;

    const shouldRefresh =
      isVerticalEnough &&
      this.isRefreshGeometrySatisfied(
        visualDistance
      );

    // A pose do balde só pode mudar depois que o usuário SOLTA o input.
    // Ultrapassar o threshold durante o drag apenas arma a atualização.
    this.releasePointer(event.pointerId);

    if (shouldRefresh) {
      this.triggerRefresh();
    }

    this.startOceanReturn();
  }

  handlePointerCancel(event) {
    if (!this.pointer.active || event.pointerId !== this.pointer.id) return;

    this.releasePointer(event.pointerId);
    this.startOceanReturn();
  }

  releasePointer(pointerId) {
    try {
      if (this.canvas.hasPointerCapture(pointerId)) {
        this.canvas.releasePointerCapture(pointerId);
      }
    } catch {
      // Sem ação: o gesto já pode ser finalizado sem capture.
    }

    this.pointer.active = false;
    this.pointer.id = null;
    this.pointer.rawPullDistance = 0;
    this.pointer.armed = false;
  }

  calculateResistedDistance(rawDistance) {
    if (rawDistance <= 0) return 0;

    const viewportHeight =
      this.canvas.getBoundingClientRect().height;

    const maxVisualDistance = Math.min(
      viewportHeight *
        MAX_PULL_VIEWPORT_RATIO,
      this.ocean.upperRevealHeight *
        0.94
    );

    // Drag feel is independent from refresh validity. Refresh is
    // determined by the live bucket ↔ waterline geometry.
    const resistanceDistance =
      viewportHeight * 0.20;

    return maxVisualDistance * (
      1 -
      Math.exp(
        -rawDistance /
        Math.max(
          1,
          resistanceDistance
        )
      )
    );
  }

  setOceanOffset(offsetY) {
    this.oceanOffsetY = offsetY;
    this.ocean.canvas.style.transform = `translate3d(0, ${offsetY.toFixed(2)}px, 0)`;
  }

  startOceanReturn() {
    if (Math.abs(this.oceanOffsetY) < 0.5) {
      this.setOceanOffset(0);
      this.returnAnimation = null;
      return;
    }

    this.returnAnimation = {
      from: this.oceanOffsetY,
      elapsed: 0,
      duration: RETURN_DURATION_MS
    };
  }

  updateOceanReturn(deltaMs) {
    if (!this.returnAnimation || this.pointer.active) return;

    this.returnAnimation.elapsed += deltaMs;
    const progress = Math.min(
      1,
      this.returnAnimation.elapsed / this.returnAnimation.duration
    );

    // easeOutCubic dá a sensação de release elástico sem overshoot exagerado.
    const eased = 1 - Math.pow(1 - progress, 3);
    this.setOceanOffset(this.returnAnimation.from * (1 - eased));

    if (progress >= 1) {
      this.setOceanOffset(0);
      this.returnAnimation = null;
    }
  }

  update(deltaMs) {
    this.updateOceanReturn(deltaMs);

    if (this.mode === "loading") {
      const totalSlots = LOADING_ROW_COUNT * LOADING_SLOT_COUNT;
      const totalDuration = this.loadingSlotDurationMs * totalSlots;

      this.loadingElapsedMs = Math.min(
        totalDuration,
        this.loadingElapsedMs + deltaMs
      );
      return;
    }

    this.swipePoseElapsedMs += deltaMs;

    if (this.swipePoseElapsedMs >= SWIPE_POSE_DURATION_MS) {
      this.mode = "loading";
      this.swipePoseElapsedMs = 0;
    }
  }

  render() {
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);

    if (!this.ocean.cellW || !this.ocean.cellH || !this.ocean.rows) return;

    if (this.mode === "swipe") {
      this.renderArt(IDLE_SWIPE_ART);
      return;
    }

    this.renderLoadingArt();
  }

  getArtLayout(lines) {
    const width = Math.max(...lines.map((line) => Array.from(line).length));
    const height = lines.length;
    const scale = this.bucketScale;
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;
    const originX = (this.ocean.cols - scaledWidth) / 2;
    const centerRow = this.ocean.rows * BUCKET_CENTER_Y;
    const originY = centerRow - scaledHeight / 2;

    return { originX, originY };
  }

  drawBucketGlyph(glyph, originX, originY, colIndex, rowIndex, color, alpha = 1) {
    this.ocean.drawCellGlyph(
      this.ctx,
      glyph,
      originX + colIndex * this.bucketScale,
      originY + rowIndex * this.bucketScale,
      color,
      alpha,
      this.bucketScale,
      false
    );
  }

  renderArt(lines) {
    const { originX, originY } = this.getArtLayout(lines);

    lines.forEach((line, rowIndex) => {
      Array.from(line).forEach((glyph, colIndex) => {
        if (glyph === " ") return;

        this.drawBucketGlyph(
          glyph,
          originX,
          originY,
          colIndex,
          rowIndex,
          BUCKET_COLOR
        );
      });
    });
  }

  renderLoadingArt() {
    const lines = IDLE_LOADING_ART;
    const { originX, originY } = this.getArtLayout(lines);

    lines.forEach((line, rowIndex) => {
      const glyphs = Array.from(line);

      glyphs.forEach((glyph, colIndex) => {
        if (glyph === " ") return;

        const isLoadingInterior =
          LOADING_ROWS.includes(rowIndex) &&
          colIndex >= LOADING_START_COLUMN &&
          colIndex < LOADING_START_COLUMN + LOADING_SLOT_COUNT;

        if (isLoadingInterior) return;

        this.drawBucketGlyph(
          glyph,
          originX,
          originY,
          colIndex,
          rowIndex,
          BUCKET_COLOR
        );
      });
    });

    this.renderLoadingBars(originX, originY);
  }

  renderLoadingBars(originX, originY) {
    const slotDuration = this.loadingSlotDurationMs;

    LOADING_ROWS.forEach((rowIndex, loadingOrder) => {
      const rowStartSlot = loadingOrder * LOADING_SLOT_COUNT;
      const rowEndMs = (rowStartSlot + LOADING_SLOT_COUNT) * slotDuration;
      const rowComplete = this.loadingElapsedMs >= rowEndMs;

      for (let slot = 0; slot < LOADING_SLOT_COUNT; slot += 1) {
        const globalSlotIndex = rowStartSlot + slot;
        const slotStartMs = globalSlotIndex * slotDuration;
        const slotProgress = Math.max(
          0,
          Math.min(1, (this.loadingElapsedMs - slotStartMs) / slotDuration)
        );

        let glyph = EMPTY_BAR_GLYPH;
        let color = EMPTY_BAR_COLOR;
        let alpha = 0.62;

        if (rowComplete) {
          glyph = FILL_BAR_GLYPH;
          color = COMPLETE_BAR_COLOR;
          alpha = 1;
        } else if (slotProgress >= 1) {
          glyph = FILL_BAR_GLYPH;
          color = ACTIVE_BAR_COLOR;
          alpha = 1;
        } else if (slotProgress > 0) {
          const stageIndex = Math.min(
            ACTIVE_FILL_STAGES.length - 1,
            Math.floor(slotProgress * ACTIVE_FILL_STAGES.length)
          );
          glyph = ACTIVE_FILL_STAGES[stageIndex];
          color = ACTIVE_BAR_COLOR;
          alpha = 1;
        }

        this.drawBucketGlyph(
          glyph,
          originX,
          originY,
          LOADING_START_COLUMN + slot,
          rowIndex,
          color,
          alpha
        );
      }
    });
  }

  loop(now) {
    const delta = Math.min(120, now - this.lastFrame);
    this.lastFrame = now;

    if (!document.hidden) {
      this.update(delta);
    }

    this.render();
    this.frameHandle = requestAnimationFrame(this.boundLoop);
  }
}

const LOADING_ROW_COUNT = LOADING_ROWS.length;
