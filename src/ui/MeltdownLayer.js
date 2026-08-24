const BACKGROUND_COLOR =
  "#03158f";

// Base matrix palette (game palette).
const MATRIX_COLORS =
  Object.freeze([
    "#d9ffff",
    "#20f5e8",
    "#fff35d",
    "#4798ff",
    "#4cff79",
    "#c46dff",
    "#ff6b7f"
  ]);

// Exact pattern from play.core / basics / time_milliseconds.
const TIME_PATTERN =
  "ABCxyz01═|+:. ";

// Chroma Spiral density adapted from the user reference.
const SPIRAL_DENSITY =
  "#Wabc:+-. ";

// Chroma Spiral colors mixed with the game palette.
const SPIRAL_COLORS =
  Object.freeze([
    "#ff5fb0", // deeppink-ish
    "#03158f", // deep ocean blue instead of black
    "#ff6b7f", // red-ish
    "#4798ff", // blue
    "#ffa53a", // orange
    "#fff35d"  // yellow
  ]);

const MESSAGES =
  Object.freeze([
    "Permanent record of everything you do...",
    "...messages become 'mere contributions to the circulation of images, opinions and information, to the billions of nuggets of information and affect trying to catch and hold attention, to push or sway opinion, taste and trends in one direction rather than another.'",
    "It doesn't care how many 'anti-capitalist' messages are circulating, only that the circulation of messages continues incessantly."
  ]);

const CODE_FRAGMENTS =
  Object.freeze([
    "for(;;){message++;record++;attention--;circulation++;}",
    "if(channel){circulate();proliferate();archive();}",
    "const record=attention.map(message=>circulation(message));",
    "return communicativeCapitalism.publish(subject,signal,affect);",
    "//// affect :: image :: opinion :: information :: taste :: trend",
    "while(attention){signal=message+record+affect;}"
  ]);

const CASCADE_DURATION_MS =
  7600;

const ROW_ACTIVATION_BLEND_MS =
  1100;

const TARGET_FPS =
  30;

const FRAME_INTERVAL_MS =
  1000 /
  TARGET_FPS;

const MIN_GAP =
  1;

const MAX_GAP =
  22;

const MIN_COLS =
  42;

const MAX_COLS =
  120;

const MIN_ROWS =
  40;

const MAX_ROWS =
  92;

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

function clamp(
  value,
  min,
  max
) {
  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );
}

function lerp(
  from,
  to,
  amount
) {
  return (
    from +
    (
      to - from
    ) *
    amount
  );
}

function invLerp(
  value,
  min,
  max
) {
  if (
    max === min
  ) {
    return 0;
  }

  return (
    value - min
  ) /
  (
    max - min
  );
}

function smoothstep01(
  value
) {
  const t =
    clamp01(
      value
    );

  return (
    t *
    t *
    (
      3 -
      2 * t
    )
  );
}

function mapRange(
  value,
  inMin,
  inMax,
  outMin,
  outMax
) {
  return lerp(
    outMin,
    outMax,
    clamp01(
      invLerp(
        value,
        inMin,
        inMax
      )
    )
  );
}

function hash01(
  value
) {
  const raw =
    Math.sin(
      value *
        12.9898 +
      78.233
    ) *
    43758.5453;

  return (
    raw -
    Math.floor(
      raw
    )
  );
}

function signedHash(
  value
) {
  return (
    hash01(
      value
    ) *
      2 -
    1
  );
}

function mod(
  value,
  divisor
) {
  if (
    divisor <=
    0
  ) {
    return 0;
  }

  return (
    (
      value %
      divisor
    ) +
    divisor
  ) %
  divisor;
}

function splitIntoChunks(
  text,
  minWords,
  maxWords
) {
  const words =
    String(text)
      .trim()
      .split(/\s+/);

  const chunks = [];

  let index = 0;
  let chunkIndex = 0;

  while (
    index <
    words.length
  ) {
    const span =
      minWords +
      (
        chunkIndex %
        Math.max(
          1,
          maxWords -
            minWords +
            1
        )
      );

    chunks.push(
      words
        .slice(
          index,
          index + span
        )
        .join(" ")
    );

    index += span;
    chunkIndex += 1;
  }

  return chunks;
}

const MESSAGE_CHUNKS =
  Object.freeze(
    MESSAGES.flatMap(
      (
        message,
        messageIndex
      ) =>
        splitIntoChunks(
          message,
          messageIndex ===
            0
            ? 2
            : 3,
          messageIndex ===
            0
            ? 4
            : 6
        )
    )
  );

export class MeltdownLayer {
  constructor(
    canvas
  ) {
    this.canvas =
      canvas;

    this.ctx =
      canvas.getContext(
        "2d",
        {
          alpha: false
        }
      );

    this.width = 0;
    this.height = 0;
    this.dpr = 1;

    this.cols = 0;
    this.rowsCount = 0;

    this.cellW = 1;
    this.cellH = 1;
    this.fontSize = 9;

    this.rows = [];

    this.active = false;

    this.elapsedMs = 0;
    this.logicalFrame = 0;
    this.logicalFrameElapsedMs = 0;

    this.lastFrame =
      performance.now();

    this.frameHandle = 0;

    this.boundLoop =
      this.loop.bind(
        this
      );

    this.boundResize =
      this.resize.bind(
        this
      );

    this.boundBlockInput =
      this.blockInput.bind(
        this
      );
  }

  start() {
    this.resize();

    window.addEventListener(
      "resize",
      this.boundResize,
      {
        passive: true
      }
    );

    window.visualViewport
      ?.addEventListener(
        "resize",
        this.boundResize,
        {
          passive: true
        }
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

    window.removeEventListener(
      "resize",
      this.boundResize
    );

    window.visualViewport
      ?.removeEventListener(
        "resize",
        this.boundResize
      );

    this.canvas.removeEventListener(
      "pointerdown",
      this.boundBlockInput,
      true
    );

    this.canvas.removeEventListener(
      "pointermove",
      this.boundBlockInput,
      true
    );

    this.canvas.removeEventListener(
      "pointerup",
      this.boundBlockInput,
      true
    );
  }

  blockInput(
    event
  ) {
    event.preventDefault();
    event.stopPropagation();
  }

  getViewportSize() {
    const visualViewport =
      window.visualViewport;

    return {
      width:
        Math.max(
          1,
          visualViewport
            ?.width ??
          window.innerWidth ??
          document.documentElement
            .clientWidth ??
          1
        ),

      height:
        Math.max(
          1,
          visualViewport
            ?.height ??
          window.innerHeight ??
          document.documentElement
            .clientHeight ??
          1
        )
    };
  }

  resize() {
    const viewport =
      this.getViewportSize();

    this.width =
      viewport.width;

    this.height =
      viewport.height;

    this.dpr =
      Math.min(
        window.devicePixelRatio ||
        1,
        1.5
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

    this.cols =
      clamp(
        Math.round(
          this.width /
          8.4
        ),
        MIN_COLS,
        MAX_COLS
      );

    this.rowsCount =
      clamp(
        Math.round(
          this.height /
          10.8
        ),
        MIN_ROWS,
        MAX_ROWS
      );

    this.cellW =
      this.width /
      this.cols;

    this.cellH =
      this.height /
      this.rowsCount;

    this.fontSize =
      Math.max(
        7,
        Math.min(
          this.cellH *
            0.98,
          this.cellW *
            1.44
        )
      );

    this.ctx.font =
      `${this.fontSize}px "DotGothic16", monospace`;

    this.ctx.textAlign =
      "center";

    this.ctx.textBaseline =
      "middle";

    this.rebuildRows();
  }

  activate() {
    if (
      this.active
    ) {
      return false;
    }

    this.active = true;

    this.elapsedMs = 0;
    this.logicalFrame = 0;
    this.logicalFrameElapsedMs = 0;

    this.canvas.hidden =
      false;

    this.canvas.setAttribute(
      "aria-hidden",
      "false"
    );

    this.canvas.addEventListener(
      "pointerdown",
      this.boundBlockInput,
      true
    );

    this.canvas.addEventListener(
      "pointermove",
      this.boundBlockInput,
      true
    );

    this.canvas.addEventListener(
      "pointerup",
      this.boundBlockInput,
      true
    );

    this.resize();

    return true;
  }

  buildRowChunks(
    rowIndex
  ) {
    const chunks = [];

    const count =
      8 +
      Math.floor(
        hash01(
          rowIndex *
            31.7 +
          2.1
        ) *
        6
      );

    for (
      let index = 0;
      index <
      count;
      index += 1
    ) {
      const selector =
        hash01(
          rowIndex *
            83.17 +
          index *
            19.73 +
          11.5
        );

      if (
        selector <
        0.76
      ) {
        chunks.push(
          MESSAGE_CHUNKS[
            (
              rowIndex *
                3 +
              index *
                2
            ) %
            MESSAGE_CHUNKS.length
          ]
        );
      } else {
        chunks.push(
          CODE_FRAGMENTS[
            (
              rowIndex +
              index *
                3
            ) %
            CODE_FRAGMENTS.length
          ]
        );
      }
    }

    return chunks;
  }

  rebuildRows() {
    const rows = [];

    for (
      let y = 0;
      y <
      this.rowsCount;
      y += 1
    ) {
      const chunks =
        this.buildRowChunks(
          y
        );

      const gaps =
        chunks.map(
          (
            _,
            gapIndex
          ) => {
            const seed =
              y *
                131.19 +
              gapIndex *
                37.71 +
              4.3;

            return {
              base:
                1 +
                Math.floor(
                  hash01(
                    seed
                  ) *
                  5
                ),

              amplitude:
                4 +
                Math.floor(
                  hash01(
                    seed + 1.7
                  ) *
                  9
                ),

              phase:
                hash01(
                  seed + 3.1
                ) *
                Math.PI *
                2
            };
          }
        );

      const seed =
        y *
          173.17 +
        7.9;

      rows.push({
        index:
          y,

        chunks,
        gaps,

        baseColorIndex:
          y %
          MATRIX_COLORS.length,

        activationMs:
          (
            y /
            Math.max(
              1,
              this.rowsCount -
                1
            )
          ) *
            CASCADE_DURATION_MS +
          signedHash(
            seed + 1.1
          ) *
            70,

        flowSpeed:
          lerp(
            0.18,
            0.74,
            hash01(
              seed + 2.7
            )
          ),

        flowDirection:
          y %
            2 ===
            0
            ? -1
            : 1,

        phase:
          hash01(
            seed + 4.3
          ) *
            Math.PI *
            2
      });
    }

    this.rows =
      rows;
  }

  getRowActivation(
    row
  ) {
    if (
      this.elapsedMs <
      row.activationMs
    ) {
      return 0;
    }

    return smoothstep01(
      (
        this.elapsedMs -
        row.activationMs
      ) /
      ROW_ACTIVATION_BLEND_MS
    );
  }

  getGlobalMelt() {
    const cascade =
      clamp01(
        this.elapsedMs /
        CASCADE_DURATION_MS
      );

    if (
      cascade <
      1
    ) {
      return (
        0.22 +
        cascade *
          0.60
      );
    }

    const seconds =
      this.elapsedMs /
      1000;

    const slow =
      (
        Math.sin(
          seconds *
            0.29
        ) +
        1
      ) /
      2;

    const medium =
      (
        Math.sin(
          seconds *
            0.67 +
          1.8
        ) +
        1
      ) /
      2;

    return (
      0.68 +
      slow *
        0.18 +
      medium *
        0.14
    );
  }

  getReferenceTime() {
    return (
      this.elapsedMs *
      0.0001
    );
  }

  getReferenceWave(
    x,
    y,
    t
  ) {
    // Directly from the time_milliseconds concept:
    // o = sin(y * sin(t) * 0.2 + x * 0.04 + t) * 20
    return (
      Math.sin(
        y *
          Math.sin(
            t
          ) *
          0.2 +
        x *
          0.04 +
        t
      ) *
      20
    );
  }

  getPatternIndex(
    x,
    y,
    wave
  ) {
    return mod(
      Math.round(
        Math.abs(
          x +
          y +
          wave
        )
      ),
      TIME_PATTERN.length
    );
  }

  getSpiralState(
    x,
    y
  ) {
    // Chroma Spiral adapted to our fixed console grid.
    const t =
      this.elapsedMs *
      0.0002;

    const m =
      Math.min(
        this.cols,
        this.rowsCount
      );

    const aspect =
      this.cols /
      this.rowsCount;

    let stx =
      2.0 *
      (
        x -
        this.cols / 2
      ) /
      m *
      aspect;

    let sty =
      2.0 *
      (
        y -
        this.rowsCount / 2
      ) /
      m;

    for (
      let i = 0;
      i < 3;
      i += 1
    ) {
      const o =
        i * 3;

      const vx =
        Math.sin(
          t * 3 + o
        );

      const vy =
        Math.cos(
          t * 2 + o
        );

      stx += vx;
      sty += vy;

      const dx =
        stx - 0.5;

      const dy =
        sty - 0.5;

      const ang =
        -t +
        Math.hypot(
          dx,
          dy
        );

      const cosA =
        Math.cos(
          ang
        );

      const sinA =
        Math.sin(
          ang
        );

      const rx =
        stx * cosA -
        sty * sinA;

      const ry =
        stx * sinA +
        sty * cosA;

      stx = rx;
      sty = ry;
    }

    stx *= 0.6;
    sty *= 0.6;

    const s =
      Math.cos(
        t
      ) *
      2.0;

    let c =
      Math.sin(
        stx * 3.0 + s
      ) +
      Math.sin(
        sty * 21
      );

    c =
      mapRange(
        Math.sin(
          c * 0.5
        ),
        -1,
        1,
        0,
        1
      );

    const densityIndex =
      Math.floor(
        c *
        (
          SPIRAL_DENSITY.length -
          1
        )
      );

    const colorIndex =
      Math.floor(
        c *
        (
          SPIRAL_COLORS.length -
          1
        )
      );

    return {
      value:
        c,
      char:
        SPIRAL_DENSITY[
          densityIndex
        ],
      color:
        SPIRAL_COLORS[
          colorIndex
        ],
      densityIndex,
      colorIndex
    };
  }

  buildDynamicStream(
    row,
    t,
    activation,
    globalMelt
  ) {
    const parts = [];

    for (
      let index = 0;
      index <
      row.chunks.length;
      index += 1
    ) {
      parts.push(
        row.chunks[
          index
        ]
      );

      const gap =
        row.gaps[
          index
        ];

      const wave =
        this.getReferenceWave(
          index *
            7 +
            gap.phase,
          row.index,
          t
        );

      const breathing =
        Math.abs(
          wave
        ) /
        20;

      const extra =
        Math.round(
          gap.amplitude *
          activation *
          globalMelt *
          breathing *
          1.3
        );

      const gapSize =
        clamp(
          gap.base +
            extra,
          MIN_GAP,
          MAX_GAP
        );

      parts.push(
        " ".repeat(
          gapSize
        )
      );
    }

    let stream =
      parts.join(
        ""
      );

    if (
      !stream
    ) {
      stream = " ";
    }

    const minimumLength =
      this.cols *
      4;

    if (
      stream.length <
      minimumLength
    ) {
      const source =
        stream;

      while (
        stream.length <
        minimumLength
      ) {
        stream +=
          source;
      }
    }

    return stream;
  }

  getRowBaseOffset(
    row,
    activation,
    t
  ) {
    if (
      activation <=
      0
    ) {
      return 0;
    }

    const flow =
      t *
      18 *
      row.flowSpeed *
      row.flowDirection;

    const phaseDrift =
      Math.sin(
        t *
          2.7 +
        row.index *
          0.22 +
        row.phase
      ) *
      4;

    return Math.round(
      (
        flow +
        phaseDrift
      ) *
      activation
    );
  }

  getCellState(
    row,
    x,
    t,
    activation,
    globalMelt,
    stream,
    baseOffset
  ) {
    const wave =
      this.getReferenceWave(
        x,
        row.index,
        t
      );

    const patternIndex =
      this.getPatternIndex(
        x,
        row.index,
        wave
      );

    const patternChar =
      TIME_PATTERN[
        patternIndex
      ];

    const spiral =
      this.getSpiralState(
        x,
        row.index
      );

    // Main text material.
    const waveShift =
      Math.round(
        wave *
        activation *
        globalMelt *
        0.64
      );

    const streamIndex =
      mod(
        x +
          baseOffset +
          waveShift,
        stream.length
      );

    let char =
      stream[
        streamIndex
      ];

    // Core fields.
    const waveStrength =
      Math.abs(
        wave
      ) /
      20;

    const spiralPresence =
      smoothstep01(
        invLerp(
          spiral.value,
          0.28,
          0.92
        )
      );

    const spiralCore =
      smoothstep01(
        invLerp(
          spiral.value,
          0.50,
          1.0
        )
      );

    const combinedPresence =
      clamp01(
        (
          spiralPresence *
          0.7 +
          waveStrength *
          0.3
        ) *
        activation *
        (
          0.7 +
          globalMelt *
            0.3
        )
      );

    // Deterministic negative-space carving using both systems.
    const voidField =
      Math.sin(
        x *
          0.11 +
        row.index *
          0.39 -
        t *
          2.1 +
        wave *
          0.055 +
        spiral.value *
          4.5
      );

    const voidThreshold =
      lerp(
        1.18,
        0.72,
        activation *
          globalMelt
      );

    if (
      voidField >
      voidThreshold
    ) {
      char =
        " ";
    }

    let color =
      MATRIX_COLORS[
        row.baseColorIndex
      ];

    let alpha =
      0.72 +
      activation *
        0.26;

    // Overlay the spiral FORM over the text field. This is the key refinement:
    // instead of only deforming text, we allow coherent spiral masses to
    // occupy cells and make the structure visible.
    if (
      combinedPresence >
      0.52
    ) {
      if (
        spiral.char !==
        " "
      ) {
        char =
          spiral.char;
      }

      color =
        spiral.color;

      alpha =
        0.68 +
        combinedPresence *
          0.30;
    } else if (
      combinedPresence >
        0.22 &&
      char !== " "
    ) {
      color =
        spiral.color;

      alpha =
        0.72 +
        combinedPresence *
          0.22;
    }

    // Where the text has already opened space, let the time_milliseconds
    // pattern appear to reinforce the sense of moving cascading texture.
    if (
      char ===
        " " &&
      activation >
        0.18 &&
      patternChar !==
        " "
    ) {
      const patternField =
        (
          Math.sin(
            t *
              3.2 +
            row.index *
              0.31 +
            x *
              0.19 +
            spiral.value *
              3.1
          ) +
          1
        ) /
        2;

      const threshold =
        lerp(
          0.99,
          0.77,
          activation *
            globalMelt
        );

      if (
        patternField >
        threshold
      ) {
        char =
          patternChar;

        color =
          MATRIX_COLORS[
            (
              patternIndex +
              row.baseColorIndex
            ) %
            MATRIX_COLORS.length
          ];

        alpha =
          0.56 +
          waveStrength *
            0.18 +
          spiralPresence *
            0.16;
      }
    }

    // Subtle re-introduction of phrase material around the spiral edges.
    if (
      spiralCore <
        0.38 &&
      char !== " " &&
      combinedPresence >
        0.12 &&
      char === spiral.char
    ) {
      char =
        stream[
          streamIndex
        ] !== " "
          ? stream[
              streamIndex
            ]
          : char;
    }

    return {
      char,
      color,
      alpha
    };
  }

  drawCell(
    x,
    y,
    state
  ) {
    if (
      state.char ===
      " "
    ) {
      return;
    }

    const ctx =
      this.ctx;

    ctx.globalAlpha =
      state.alpha;

    ctx.fillStyle =
      state.color;

    ctx.fillText(
      state.char,
      (
        x +
        0.5
      ) *
        this.cellW,
      (
        y +
        0.5
      ) *
        this.cellH
    );
  }

  drawRow(
    row,
    t,
    globalMelt
  ) {
    const activation =
      this.getRowActivation(
        row
      );

    const stream =
      this.buildDynamicStream(
        row,
        t,
        activation,
        globalMelt
      );

    const baseOffset =
      this.getRowBaseOffset(
        row,
        activation,
        t
      );

    for (
      let x = 0;
      x <
      this.cols;
      x += 1
    ) {
      const state =
        this.getCellState(
          row,
          x,
          t,
          activation,
          globalMelt,
          stream,
          baseOffset
        );

      this.drawCell(
        x,
        row.index,
        state
      );
    }
  }

  render() {
    const ctx =
      this.ctx;

    ctx.fillStyle =
      BACKGROUND_COLOR;

    ctx.fillRect(
      0,
      0,
      this.width,
      this.height
    );

    if (
      !this.active
    ) {
      return;
    }

    ctx.font =
      `${this.fontSize}px "DotGothic16", monospace`;

    ctx.textAlign =
      "center";

    ctx.textBaseline =
      "middle";

    const t =
      this.getReferenceTime();

    const globalMelt =
      this.getGlobalMelt();

    for (
      const row
      of this.rows
    ) {
      this.drawRow(
        row,
        t,
        globalMelt
      );
    }

    ctx.globalAlpha =
      1;
  }

  loop(
    now
  ) {
    const delta =
      Math.max(
        0,
        Math.min(
          100,
          now -
          this.lastFrame
        )
      );

    this.lastFrame =
      now;

    if (
      this.active &&
      !document.hidden
    ) {
      this.elapsedMs +=
        delta;

      this.logicalFrameElapsedMs +=
        delta;

      while (
        this.logicalFrameElapsedMs >=
        FRAME_INTERVAL_MS
      ) {
        this.logicalFrameElapsedMs -=
          FRAME_INTERVAL_MS;

        this.logicalFrame +=
          1;
      }
    }

    this.render();

    this.frameHandle =
      requestAnimationFrame(
        this.boundLoop
      );
  }
}
