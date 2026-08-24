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

const NERVOUS_FRAGMENT_GLYPHS = [
  "x",
  "+",
  "*",
  "·"
];

const NERVOUS_FRAGMENTS_PER_CELL = 8;
const MAX_NERVOUS_FRAGMENTS = 96;

const SCORE_PULSE_MS = 190;
const NERVOUS_PULSE_MS = 280;

const NERVOUS_PANEL_TITLE =
  "c:\\nervous>systems";

const NERVOUS_CURSOR_BLINK_MS = 420;
const NERVOUS_MIN_SIGNAL_MS = 360;

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

    this.appetite = 0;

    this.progressionOverride =
      null;

    this.attentionPulseMs = 0;
    this.appetitePulseMs = 0;

    this.particles = [];
    this.nervousFragments = [];

    this.nervousPulseMs = 0;
    this.nervousPulseColor =
      HUD_BAR_COLOR;

    this.nervousTerminal = {
      state: "idle",
      target: "",
      text: "",
      elapsedMs: 0,
      durationMs: 0,
      cursorElapsedMs: 0,
      queue: [],
      persistentEmotion: null,
      promptDeleteSource: ""
    };

    this.nervousBuffer = {
      emotion: null,
      value: 0,
      maxValue: 10,
      ratio: 0,
      color: null
    };

    this.frameUpdateHook = null;

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
      this.progressionOverride
        ?.label ??
      "APETITE";

    const attentionValue =
      this.formatScore(
        this.attention
      );

    const appetiteValue =
      this.formatScore(
        this.progressionOverride
          ?.value ??
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

  setAppetite(
    target,
    {
      pulse = false
    } = {}
  ) {
    this.appetite =
      Math.max(
        0,
        Math.floor(
          Number(target) || 0
        )
      );

    if (
      pulse
    ) {
      this.appetitePulseMs =
        SCORE_PULSE_MS;
    }
  }

  setProgressionOverride(
    label,
    value
  ) {
    const normalizedLabel =
      String(
        label ?? ""
      )
        .trim()
        .toUpperCase();

    if (
      !normalizedLabel
    ) {
      return;
    }

    this.progressionOverride = {
      label:
        normalizedLabel,
      value:
        Math.max(
          0,
          Math.floor(
            Number(
              value
            ) || 0
          )
        )
    };
  }

  clearProgressionOverride() {
    this.progressionOverride =
      null;
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

  setFrameUpdateHook(callback) {
    this.frameUpdateHook = typeof callback === "function" ? callback : null;
  }

  setNervousBufferState({ emotion, value, maxValue, ratio, color }) {
    const normalizedEmotion = emotion ? String(emotion).trim().toLowerCase() : null;
    this.nervousBuffer.emotion = normalizedEmotion;
    this.nervousBuffer.value = Math.max(0, Number(value) || 0);
    this.nervousBuffer.maxValue = Math.max(1, Number(maxValue) || 10);
    this.nervousBuffer.ratio = Math.max(0, Math.min(1, Number(ratio) || 0));
    this.nervousBuffer.color = color ?? null;
    this.nervousTerminal.persistentEmotion = normalizedEmotion;
    if (this.nervousTerminal.state === "idle") {
      this.nervousTerminal.text = normalizedEmotion ?? "";
    }
  }

  showNervousPrompt(
    label,
    {
      typeDurationMs = 520
    } = {}
  ) {
    const normalizedLabel =
      String(
        label ?? ""
      )
        .trim()
        .toLowerCase();

    if (
      !normalizedLabel
    ) {
      return;
    }

    const terminal =
      this.nervousTerminal;

    terminal.state =
      "promptTyping";

    terminal.target =
      normalizedLabel;

    terminal.text =
      "";

    terminal.elapsedMs =
      0;

    terminal.durationMs =
      Math.max(
        120,
        Number(
          typeDurationMs
        ) || 520
      );

    terminal.promptDeleteSource =
      "";
  }

  dismissNervousPrompt(
    {
      durationMs = 440
    } = {}
  ) {
    const terminal =
      this.nervousTerminal;

    if (
      terminal.state !==
        "promptTyping" &&
      terminal.state !==
        "prompt"
    ) {
      return false;
    }

    terminal.promptDeleteSource =
      terminal.text ||
      terminal.target;

    terminal.state =
      "promptDeleting";

    terminal.elapsedMs =
      0;

    terminal.durationMs =
      Math.max(
        120,
        Number(
          durationMs
        ) || 440
      );

    return true;
  }

  announceNervousSignal({
    label,
    durationMs
  }) {
    const normalizedLabel =
      String(
        label ?? ""
      )
        .trim()
        .toLowerCase();

    if (
      !normalizedLabel
    ) {
      return;
    }

    this.nervousTerminal
      .queue
      .push({
        label:
          normalizedLabel,
        durationMs:
          Math.max(
            NERVOUS_MIN_SIGNAL_MS,
            Number(
              durationMs
            ) ||
            NERVOUS_MIN_SIGNAL_MS
          )
      });

    if (
      this.nervousTerminal
        .state === "idle"
    ) {
      this.startNextNervousSignal();
    }
  }

  startNextNervousSignal() {
    const next =
      this.nervousTerminal
        .queue
        .shift();

    if (
      !next
    ) {
      this.nervousTerminal.state =
        "idle";

      this.nervousTerminal.target =
        "";

      this.nervousTerminal.text =
        this.nervousTerminal
          .persistentEmotion ??
        "";

      this.nervousTerminal.elapsedMs =
        0;

      this.nervousTerminal.durationMs =
        0;

      return;
    }

    this.nervousTerminal.state =
      "signal";

    this.nervousTerminal.target =
      next.label;

    this.nervousTerminal.text =
      "";

    this.nervousTerminal.elapsedMs =
      0;

    this.nervousTerminal.durationMs =
      next.durationMs;
  }

  cancelNervousSignal() {
    this.nervousTerminal.state =
      "idle";

    this.nervousTerminal.target =
      "";

    this.nervousTerminal.text =
      this.nervousTerminal
        .persistentEmotion ??
      "";

    this.nervousTerminal.elapsedMs =
      0;

    this.nervousTerminal.durationMs =
      0;

    this.nervousTerminal.queue.length =
      0;
  }

  updateNervousTerminal(
    deltaMs
  ) {
    const terminal =
      this.nervousTerminal;

    terminal.cursorElapsedMs =
      (
        terminal.cursorElapsedMs +
        deltaMs
      ) %
      (
        NERVOUS_CURSOR_BLINK_MS *
        2
      );

    if (
      terminal.state ===
      "promptTyping"
    ) {
      terminal.elapsedMs +=
        deltaMs;

      const progress =
        Math.max(
          0,
          Math.min(
            1,
            terminal.elapsedMs /
            Math.max(
              1,
              terminal.durationMs
            )
          )
        );

      const visibleCharacters =
        Math.min(
          terminal.target.length,
          Math.floor(
            progress *
            (
              terminal.target.length +
              1
            )
          )
        );

      terminal.text =
        terminal.target.slice(
          0,
          visibleCharacters
        );

      if (
        progress >= 1
      ) {
        terminal.state =
          "prompt";

        terminal.text =
          terminal.target;
      }

      return;
    }

    if (
      terminal.state ===
      "prompt"
    ) {
      terminal.text =
        terminal.target;

      return;
    }

    if (
      terminal.state ===
      "promptDeleting"
    ) {
      terminal.elapsedMs +=
        deltaMs;

      const progress =
        Math.max(
          0,
          Math.min(
            1,
            terminal.elapsedMs /
            Math.max(
              1,
              terminal.durationMs
            )
          )
        );

      const source =
        terminal
          .promptDeleteSource ||
        terminal.target;

      const visibleCharacters =
        Math.max(
          0,
          Math.ceil(
            source.length *
            (
              1 -
              progress
            )
          )
        );

      terminal.text =
        source.slice(
          0,
          visibleCharacters
        );

      if (
        progress >= 1
      ) {
        terminal.state =
          "idle";

        terminal.target =
          "";

        terminal.text =
          terminal
            .persistentEmotion ??
          "";

        terminal.elapsedMs =
          0;

        terminal.durationMs =
          0;

        terminal.promptDeleteSource =
          "";

        if (
          terminal.queue.length >
          0
        ) {
          this.startNextNervousSignal();
        }
      }

      return;
    }

    if (
      terminal.state !== "signal"
    ) {
      terminal.text =
        terminal
          .persistentEmotion ??
        "";

      return;
    }

    terminal.elapsedMs +=
      deltaMs;

    const duration =
      Math.max(
        1,
        terminal.durationMs
      );

    const progress =
      Math.max(
        0,
        Math.min(
          1,
          terminal.elapsedMs /
          duration
        )
      );

    const length =
      terminal.target.length;

    let visibleCharacters = 0;

    // Type -> short hold -> delete. These phases are proportional to the
    // actual special-cell drain duration.
    if (
      progress < 0.46
    ) {
      visibleCharacters =
        Math.min(
          length,
          Math.floor(
            (
              progress /
              0.46
            ) *
            (
              length + 1
            )
          )
        );
    } else if (
      progress < 0.72
    ) {
      visibleCharacters =
        length;
    } else {
      visibleCharacters =
        Math.max(
          0,
          Math.ceil(
            length *
            (
              1 -
              (
                progress -
                0.72
              ) /
              0.28
            )
          )
        );
    }

    terminal.text =
      terminal.target.slice(
        0,
        visibleCharacters
      );

    if (
      progress >= 1
    ) {
      this.startNextNervousSignal();
    }
  }

  getNervousPanelLayout() {
    const cellH = this.ocean.cellH || 14;
    const margin = Math.max(8, this.width * 0.022);
    const panelWidth = Math.min(224, Math.max(164, this.width * 0.46));
    const panelHeight = Math.max(40, Math.min(50, cellH * 3.15));
    const x = margin;
    const y = margin;
    const titleFontSize = Math.max(8, Math.min(10.5, cellH * 0.66));
    const terminalFontSize = Math.max(10, Math.min(14.5, cellH * 0.88));
    const bufferWidth = Math.max(8, Math.min(12, panelWidth * 0.055));
    return {
      x, y, width: panelWidth, height: panelHeight,
      titleFontSize, terminalFontSize,
      contentY: y + panelHeight * 0.62,
      bufferX: x + panelWidth - bufferWidth - 8,
      bufferY: y + 10,
      bufferWidth,
      bufferHeight: panelHeight - 17
    };
  }

  renderNervousBufferBar(layout) {
    const ctx = this.ctx;
    const { ratio, color } = this.nervousBuffer;
    const segmentCount = 10;
    const gap = 1;
    const segmentHeight = (layout.bufferHeight - gap * (segmentCount - 1)) / segmentCount;
    ctx.save();
    ctx.fillStyle = "rgba(2, 9, 31, 0.76)";
    ctx.fillRect(layout.bufferX - 2, layout.bufferY - 2, layout.bufferWidth + 4, layout.bufferHeight + 4);
    const filledUnits = ratio * segmentCount;
    for (let index = 0; index < segmentCount; index += 1) {
      const y = layout.bufferY + layout.bufferHeight - (index + 1) * segmentHeight - index * gap;
      const fillAmount = Math.max(0, Math.min(1, filledUnits - index));
      ctx.strokeStyle = "rgba(25, 201, 199, 0.45)";
      ctx.lineWidth = 1;
      ctx.strokeRect(layout.bufferX, y, layout.bufferWidth, segmentHeight);
      if (fillAmount <= 0 || !color) continue;
      const filledHeight = segmentHeight * fillAmount;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;
      ctx.fillRect(layout.bufferX + 1, y + segmentHeight - filledHeight + 1, Math.max(1, layout.bufferWidth - 2), Math.max(1, filledHeight - 2));
    }
    ctx.restore();
  }

  renderNervousTerminal() {
    const ctx =
      this.ctx;

    const terminal =
      this.nervousTerminal;

    const layout =
      this.getNervousPanelLayout();

    ctx.save();

    ctx.fillStyle =
      "rgba(2, 16, 104, 0.82)";

    ctx.fillRect(
      layout.x,
      layout.y,
      layout.width,
      layout.height
    );

    const nervousPulseRatio =
      this.nervousPulseMs /
      NERVOUS_PULSE_MS;

    ctx.strokeStyle =
      nervousPulseRatio > 0
        ? this.nervousPulseColor
        : HUD_BAR_COLOR;

    ctx.lineWidth =
      2 +
      nervousPulseRatio *
        1.4;

    if (
      nervousPulseRatio > 0
    ) {
      ctx.shadowColor =
        this.nervousPulseColor;

      ctx.shadowBlur =
        nervousPulseRatio *
        12;
    }

    ctx.strokeRect(
      layout.x + 1,
      layout.y + 1,
      layout.width - 2,
      layout.height - 2
    );

    ctx.font =
      `${layout.titleFontSize}px ${NORMAL_FONT}`;

    ctx.textAlign =
      "left";

    ctx.textBaseline =
      "middle";

    const titleWidth =
      ctx.measureText(
        NERVOUS_PANEL_TITLE
      ).width;

    const titleX =
      layout.x + 12;

    // Cut the border behind the title like the SONAR reference.
    ctx.fillStyle =
      "rgba(2, 16, 104, 0.98)";

    ctx.fillRect(
      titleX - 4,
      layout.y - 2,
      titleWidth + 8,
      layout.titleFontSize + 7
    );

    ctx.fillStyle =
      HUD_BAR_COLOR;

    ctx.fillText(
      NERVOUS_PANEL_TITLE.toLowerCase(),
      titleX,
      layout.y + 4
    );

    this.renderNervousBufferBar(
      layout
    );

    const cursorVisible =
      terminal.cursorElapsedMs <
      NERVOUS_CURSOR_BLINK_MS;

    const terminalText =
      `${String(
        terminal.text ?? ""
      ).toLowerCase()}${
        cursorVisible
          ? "|"
          : " "
      }`;

    ctx.font =
      `${layout.terminalFontSize}px ${NORMAL_FONT}`;

    ctx.fillStyle =
      HUD_BAR_COLOR;

    ctx.fillText(
      terminalText,
      layout.x + 13,
      layout.contentY
    );

    ctx.restore();
  }

  addNervousEmotionBurst({
    emotion,
    color,
    sourceX,
    sourceY
  }) {
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

    const fragmentColor =
      color ||
      this.nervousBuffer.color ||
      HUD_BAR_COLOR;

    this.nervousPulseMs =
      NERVOUS_PULSE_MS;

    this.nervousPulseColor =
      fragmentColor;

    const layout =
      this.getNervousPanelLayout();

    const targetX =
      layout.bufferX +
      layout.bufferWidth * 0.5;

    const targetY =
      layout.bufferY +
      layout.bufferHeight *
        (
          1 -
          Math.max(
            0.08,
            Math.min(
              0.92,
              this.nervousBuffer.ratio
            )
          )
        );

    for (
      let index = 0;
      index <
      NERVOUS_FRAGMENTS_PER_CELL;
      index += 1
    ) {
      if (
        this.nervousFragments.length >=
        MAX_NERVOUS_FRAGMENTS
      ) {
        this.nervousFragments.shift();
      }

      const angle =
        Math.random() *
        Math.PI *
        2;

      const burstDistance =
        14 +
        Math.random() *
          26;

      const burstX =
        sourceX +
        Math.cos(
          angle
        ) *
        burstDistance;

      const burstY =
        sourceY +
        Math.sin(
          angle
        ) *
        burstDistance *
        0.72;

      this.nervousFragments.push({
        color:
          fragmentColor,

        startX:
          sourceX +
          (
            Math.random() -
            0.5
          ) * 5,

        startY:
          sourceY +
          (
            Math.random() -
            0.5
          ) * 5,

        burstX,
        burstY,

        controlX:
          (
            burstX +
            targetX
          ) /
          2 +
          (
            Math.random() -
            0.5
          ) * 38,

        controlY:
          Math.min(
            burstY,
            targetY
          ) -
          20 -
          Math.random() *
            34,

        targetX:
          targetX +
          (
            Math.random() -
            0.5
          ) * 8,

        targetY:
          targetY +
          (
            Math.random() -
            0.5
          ) * 7,

        elapsed: 0,

        duration:
          520 +
          Math.random() *
            260,

        burstRatio:
          0.26 +
          Math.random() *
            0.08,

        rotation:
          Math.random() *
          Math.PI *
          2,

        spin:
          (
            Math.random() -
            0.5
          ) * 8,

        glyph:
          NERVOUS_FRAGMENT_GLYPHS[
            Math.floor(
              Math.random() *
              NERVOUS_FRAGMENT_GLYPHS.length
            )
          ]
      });
    }
  }

  updateNervousFragments(
    deltaMs
  ) {
    let writeIndex = 0;

    for (
      let index = 0;
      index <
      this.nervousFragments.length;
      index += 1
    ) {
      const fragment =
        this.nervousFragments[
          index
        ];

      fragment.elapsed +=
        deltaMs;

      if (
        fragment.elapsed <
        fragment.duration
      ) {
        this.nervousFragments[
          writeIndex
        ] = fragment;

        writeIndex += 1;
      }
    }

    this.nervousFragments.length =
      writeIndex;
  }

  renderNervousFragments() {
    const ctx =
      this.ctx;

    ctx.textAlign =
      "center";

    ctx.textBaseline =
      "middle";

    for (
      const fragment
      of this.nervousFragments
    ) {
      const rawT =
        Math.max(
          0,
          Math.min(
            1,
            fragment.elapsed /
            fragment.duration
          )
        );

      let x;
      let y;

      if (
        rawT <
        fragment.burstRatio
      ) {
        const localT =
          rawT /
          fragment.burstRatio;

        const eased =
          1 -
          Math.pow(
            1 -
            localT,
            3
          );

        x =
          fragment.startX +
          (
            fragment.burstX -
            fragment.startX
          ) *
          eased;

        y =
          fragment.startY +
          (
            fragment.burstY -
            fragment.startY
          ) *
          eased;
      } else {
        const localT =
          (
            rawT -
            fragment.burstRatio
          ) /
          (
            1 -
            fragment.burstRatio
          );

        const eased =
          localT *
          localT *
          (
            3 -
            2 *
              localT
          );

        const inverse =
          1 -
          eased;

        x =
          inverse *
            inverse *
            fragment.burstX +
          2 *
            inverse *
            eased *
            fragment.controlX +
          eased *
            eased *
            fragment.targetX;

        y =
          inverse *
            inverse *
            fragment.burstY +
          2 *
            inverse *
            eased *
            fragment.controlY +
          eased *
            eased *
            fragment.targetY;
      }

      const alpha =
        rawT < 0.78
          ? 1
          : 1 -
            (
              rawT -
              0.78
            ) /
            0.22;

      const size =
        13 +
        (
          1 -
          rawT
        ) * 5;

      ctx.save();

      ctx.translate(
        x,
        y
      );

      ctx.rotate(
        fragment.rotation +
        fragment.spin *
          rawT
      );

      ctx.globalAlpha =
        Math.max(
          0,
          alpha
        );

      ctx.fillStyle =
        fragment.color;

      ctx.shadowColor =
        fragment.color;

      ctx.shadowBlur =
        6 +
        (
          1 -
          rawT
        ) * 4;

      ctx.font =
        `${size}px ${NORMAL_FONT}`;

      ctx.fillText(
        fragment.glyph,
        0,
        0
      );

      ctx.restore();
    }

    ctx.globalAlpha = 1;
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
    this.frameUpdateHook?.(
      deltaMs
    );

    this.attentionPulseMs =
      Math.max(
        0,
        this.attentionPulseMs -
        deltaMs
      );

    this.appetitePulseMs =
      Math.max(
        0,
        this.appetitePulseMs -
        deltaMs
      );

    this.nervousPulseMs =
      Math.max(
        0,
        this.nervousPulseMs -
        deltaMs
      );

    this.updateNervousTerminal(
      deltaMs
    );

    this.updateNervousFragments(
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

    const appetitePulseRatio =
      this.appetitePulseMs /
      SCORE_PULSE_MS;

    const appetiteFontSize =
      layout.fontSize *
      (
        1 +
        appetitePulseRatio *
          0.16
      );

    ctx.font =
      `${appetiteFontSize}px ${NORMAL_FONT}`;

    ctx.fillText(
      layout.appetiteValue,
      layout.appetiteValueX,
      layout.baselineY -
        appetitePulseRatio * 1.2
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
    this.renderNervousFragments();
    this.renderNervousTerminal();
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
