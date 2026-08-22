const HUD_BAR_COLOR =
  "#19c9c7";

const HUD_INK_COLOR =
  "#02091f";

const HUD_ACCENT_COLOR =
  "#fff35d";

const HUD_LABEL_TEXT_COLOR =
  "#20f5e8";

const PARTICLE_GLYPHS = [
  "+",
  "·",
  "*"
];

const PARTICLES_PER_CELL = 3;
const MAX_PARTICLES = 84;
const SCORE_PULSE_MS = 190;

const NORMAL_FONT =
  '"Pixelify Sans", monospace';

export class HudLayer {
  constructor(
    canvas,
    oceanEngine
  ) {
    this.canvas = canvas;

    this.ctx =
      canvas.getContext(
        "2d"
      );

    this.ocean =
      oceanEngine;

    this.width = 0;
    this.height = 0;
    this.dpr = 1;

    this.attention = 0;

    // Placeholder for the next mechanic.
    this.appetite = 0;

    this.attentionPulseMs = 0;

    this.particles = [];

    this.lastFrame =
      performance.now();

    this.frameHandle = 0;
    this.resizeObserver = null;

    this.boundLoop =
      this.loop.bind(this);
  }

  start() {
    this.resize();

    this.resizeObserver =
      new ResizeObserver(
        () => {
          this.resize();
        }
      );

    this.resizeObserver.observe(
      this.canvas.parentElement
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

    this.resizeObserver
      ?.disconnect();
  }

  resize() {
    const rect =
      this.canvas.parentElement
        .getBoundingClientRect();

    this.width =
      Math.max(
        1,
        rect.width
      );

    this.height =
      Math.max(
        1,
        rect.height
      );

    this.dpr =
      Math.min(
        window.devicePixelRatio ||
          1,
        2
      );

    this.canvas.width =
      Math.round(
        this.width *
        this.dpr
      );

    this.canvas.height =
      Math.round(
        this.height *
        this.dpr
      );

    this.ctx.setTransform(
      this.dpr,
      0,
      0,
      this.dpr,
      0,
      0
    );

    this.ctx.imageSmoothingEnabled =
      false;

    this.ctx.textBaseline =
      "middle";
  }

  getBarHeight() {
    return Math.max(
      28,
      Math.min(
        46,
        (
          this.ocean.cellH ||
          16
        ) *
        1.55
      )
    );
  }

  getHudLayout() {
    const barHeight =
      this.getBarHeight();

    const barTop =
      this.height -
      barHeight;

    let fontSize =
      Math.max(
        10,
        Math.min(
          15,
          barHeight * 0.48
        )
      );

    const horizontalPadding =
      Math.max(
        5,
        fontSize * 0.45
      );

    const gap =
      Math.max(
        5,
        fontSize * 0.52
      );

    const measure =
      (text) => {
        this.ctx.font =
          `${fontSize}px ${NORMAL_FONT}`;

        return this.ctx
          .measureText(text)
          .width;
      };

    const attentionLabel =
      "ATTENTION";

    const appetiteLabel =
      "APETITE";

    const attentionValue =
      this.formatScore(
        this.attention
      );

    const appetiteValue =
      this.formatScore(
        this.appetite
      );

    const calculateWidths =
      () => {
        const attentionLabelWidth =
          measure(
            attentionLabel
          ) +
          horizontalPadding *
            1.2;

        const attentionValueWidth =
          measure(
            attentionValue
          );

        const appetiteLabelWidth =
          measure(
            appetiteLabel
          ) +
          horizontalPadding *
            1.2;

        const appetiteValueWidth =
          measure(
            appetiteValue
          );

        const totalWidth =
          horizontalPadding +
          attentionLabelWidth +
          gap +
          attentionValueWidth +
          gap * 1.65 +
          appetiteLabelWidth +
          gap +
          appetiteValueWidth +
          horizontalPadding;

        return {
          attentionLabelWidth,
          attentionValueWidth,
          appetiteLabelWidth,
          appetiteValueWidth,
          totalWidth
        };
      };

    let widths =
      calculateWidths();

    while (
      widths.totalWidth >
        this.width &&
      fontSize > 8
    ) {
      fontSize -= 0.5;
      widths =
        calculateWidths();
    }

    let x =
      horizontalPadding;

    const attentionLabelRect = {
      x,
      y:
        barTop +
        barHeight * 0.20,
      width:
        widths
          .attentionLabelWidth,
      height:
        barHeight * 0.60
    };

    x +=
      attentionLabelRect.width +
      gap;

    const attentionValueX =
      x +
      widths
        .attentionValueWidth /
        2;

    x +=
      widths
        .attentionValueWidth +
      gap * 1.65;

    const appetiteLabelRect = {
      x,
      y:
        barTop +
        barHeight * 0.20,
      width:
        widths
          .appetiteLabelWidth,
      height:
        barHeight * 0.60
    };

    x +=
      appetiteLabelRect.width +
      gap;

    const appetiteValueX =
      x +
      widths
        .appetiteValueWidth /
        2;

    return {
      barTop,
      barHeight,
      fontSize,
      attentionLabel,
      appetiteLabel,
      attentionValue,
      appetiteValue,
      attentionLabelRect,
      attentionValueX,
      appetiteLabelRect,
      appetiteValueX,
      baselineY:
        barTop +
        barHeight * 0.51,
      attentionTarget: {
        x:
          attentionValueX,
        y:
          barTop +
          barHeight * 0.30
      }
    };
  }

  formatScore(value) {
    const normalized =
      Math.max(
        0,
        Math.floor(
          Number(value) || 0
        )
      );

    return String(
      normalized
    ).padStart(
      4,
      "0"
    );
  }

  setAttention(
    total
  ) {
    this.attention =
      Math.max(
        0,
        Math.floor(
          Number(total) || 0
        )
      );
  }

  addAttention({
    amount,
    total,
    sourceX,
    sourceY
  }) {
    this.setAttention(
      total
    );

    this.attentionPulseMs =
      SCORE_PULSE_MS;

    this.spawnAttentionFragments(
      sourceX,
      sourceY,
      amount
    );
  }

  spawnAttentionFragments(
    sourceX,
    sourceY,
    amount
  ) {
    if (
      !Number.isFinite(
        sourceX
      ) ||
      !Number.isFinite(
        sourceY
      )
    ) {
      return;
    }

    const {
      attentionTarget
    } =
      this.getHudLayout();

    for (
      let index = 0;
      index <
      PARTICLES_PER_CELL;
      index += 1
    ) {
      if (
        this.particles.length >=
        MAX_PARTICLES
      ) {
        this.particles.shift();
      }

      const duration =
        300 +
        Math.random() *
          220;

      const controlX =
        (
          sourceX +
          attentionTarget.x
        ) /
        2 +
        (
          Math.random() -
          0.5
        ) *
        44;

      const controlY =
        Math.min(
          sourceY,
          attentionTarget.y
        ) -
        22 -
        Math.random() *
          36;

      this.particles.push({
        startX:
          sourceX +
          (
            Math.random() -
            0.5
          ) *
          7,
        startY:
          sourceY +
          (
            Math.random() -
            0.5
          ) *
          5,
        controlX,
        controlY,
        targetX:
          attentionTarget.x +
          (
            Math.random() -
            0.5
          ) *
          12,
        targetY:
          attentionTarget.y,
        elapsed: 0,
        duration,
        glyph:
          PARTICLE_GLYPHS[
            Math.floor(
              Math.random() *
              PARTICLE_GLYPHS.length
            )
          ],
        amount
      });
    }
  }

  update(deltaMs) {
    this.attentionPulseMs =
      Math.max(
        0,
        this.attentionPulseMs -
        deltaMs
      );

    let writeIndex = 0;

    for (
      let index = 0;
      index <
      this.particles.length;
      index += 1
    ) {
      const particle =
        this.particles[
          index
        ];

      particle.elapsed +=
        deltaMs;

      if (
        particle.elapsed <
        particle.duration
      ) {
        this.particles[
          writeIndex
        ] = particle;

        writeIndex += 1;
      }
    }

    this.particles.length =
      writeIndex;
  }

  renderParticles() {
    const ctx =
      this.ctx;

    ctx.textAlign =
      "center";

    ctx.textBaseline =
      "middle";

    for (
      const particle
      of this.particles
    ) {
      const rawT =
        Math.max(
          0,
          Math.min(
            1,
            particle.elapsed /
            particle.duration
          )
        );

      const t =
        1 -
        Math.pow(
          1 - rawT,
          2
        );

      const inverse =
        1 - t;

      const x =
        inverse *
          inverse *
          particle.startX +
        2 *
          inverse *
          t *
          particle.controlX +
        t *
          t *
          particle.targetX;

      const y =
        inverse *
          inverse *
          particle.startY +
        2 *
          inverse *
          t *
          particle.controlY +
        t *
          t *
          particle.targetY;

      const alpha =
        rawT < 0.72
          ? 1
          : 1 -
            (
              rawT -
              0.72
            ) /
            0.28;

      const size =
        11 +
        (
          1 - rawT
        ) *
        4;

      ctx.globalAlpha =
        Math.max(
          0,
          Math.min(
            1,
            alpha
          )
        );

      ctx.fillStyle =
        HUD_ACCENT_COLOR;

      ctx.font =
        `${size}px ${NORMAL_FONT}`;

      ctx.fillText(
        particle.glyph,
        x,
        y
      );
    }

    ctx.globalAlpha = 1;
  }

  renderBar() {
    const ctx =
      this.ctx;

    const layout =
      this.getHudLayout();

    ctx.fillStyle =
      HUD_BAR_COLOR;

    ctx.fillRect(
      0,
      layout.barTop,
      this.width,
      layout.barHeight
    );

    ctx.fillStyle =
      HUD_INK_COLOR;

    ctx.fillRect(
      0,
      layout.barTop,
      this.width,
      2
    );

    ctx.fillStyle =
      HUD_INK_COLOR;

    ctx.fillRect(
      layout
        .attentionLabelRect
        .x,
      layout
        .attentionLabelRect
        .y,
      layout
        .attentionLabelRect
        .width,
      layout
        .attentionLabelRect
        .height
    );

    ctx.fillRect(
      layout
        .appetiteLabelRect
        .x,
      layout
        .appetiteLabelRect
        .y,
      layout
        .appetiteLabelRect
        .width,
      layout
        .appetiteLabelRect
        .height
    );

    ctx.textBaseline =
      "middle";

    ctx.textAlign =
      "center";

    ctx.font =
      `${layout.fontSize}px ${NORMAL_FONT}`;

    ctx.fillStyle =
      HUD_LABEL_TEXT_COLOR;

    ctx.fillText(
      layout.attentionLabel,
      layout
        .attentionLabelRect
        .x +
        layout
          .attentionLabelRect
          .width /
          2,
      layout.baselineY
    );

    ctx.fillText(
      layout.appetiteLabel,
      layout
        .appetiteLabelRect
        .x +
        layout
          .appetiteLabelRect
          .width /
          2,
      layout.baselineY
    );

    const pulseRatio =
      this.attentionPulseMs /
      SCORE_PULSE_MS;

    const attentionFontSize =
      layout.fontSize *
      (
        1 +
        pulseRatio *
          0.16
      );

    ctx.fillStyle =
      HUD_INK_COLOR;

    ctx.font =
      `${attentionFontSize}px ${NORMAL_FONT}`;

    ctx.fillText(
      layout.attentionValue,
      layout.attentionValueX,
      layout.baselineY -
        pulseRatio * 1.2
    );

    ctx.font =
      `${layout.fontSize}px ${NORMAL_FONT}`;

    ctx.fillText(
      layout.appetiteValue,
      layout.appetiteValueX,
      layout.baselineY
    );
  }

  render() {
    this.ctx.clearRect(
      0,
      0,
      this.width,
      this.height
    );

    // Particles can travel over both sea and bucket because this
    // canvas is above both visual layers.
    this.renderParticles();
    this.renderBar();
  }

  loop(now) {
    const delta =
      Math.min(
        100,
        now -
        this.lastFrame
      );

    this.lastFrame = now;

    if (
      !document.hidden
    ) {
      this.update(
        delta
      );
    }

    this.render();

    this.frameHandle =
      requestAnimationFrame(
        this.boundLoop
      );
  }
}
