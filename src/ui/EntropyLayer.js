const MAX_GLITCH_STAINS =
  112;

const MAX_ACTIVE_STAINS =
  86;

const SUBSLICE_MAX =
  12;

const CHANNEL_ACCENTS =
  Object.freeze([
    "#e94362",
    "#4798ff",
    "#9d4dff"
  ]);

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

function randomRange(
  min,
  max
) {
  return (
    min +
    Math.random() *
    (
      max - min
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

export class EntropyLayer {
  constructor(
    canvas,
    sourceCanvases,
    config
  ) {
    this.canvas =
      canvas;

    this.ctx =
      canvas.getContext(
        "2d",
        {
          alpha: true
        }
      );

    this.sourceCanvases =
      sourceCanvases.filter(
        Boolean
      );

    this.config =
      config;

    this.width = 0;
    this.height = 0;
    this.dpr = 1;

    this.snapshot =
      document.createElement(
        "canvas"
      );

    this.snapshotCtx =
      this.snapshot.getContext(
        "2d",
        {
          alpha: true
        }
      );

    this.stains = [];

    this.active = false;
    this.state = "idle";
    this.value = 1000;
    this.intensity = 0;
    this.corruption = 0;

    this.spawnAccumulator = 0;
    this.coverageEstimate = 0;
    this.lastState = "idle";
    this.activeCursor = 0;

    this.lastFrame =
      performance.now();

    this.frameHandle = 0;
    this.resizeObserver =
      null;

    this.boundLoop =
      this.loop.bind(
        this
      );
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
      this.canvas
        .parentElement
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

  setState({
    active,
    state,
    value,
    intensity,
    corruption
  }) {
    const nextState =
      String(
        state ??
        "idle"
      );

    const restarting =
      Boolean(active) &&
      nextState ===
        "transition" &&
      this.lastState !==
        "transition";

    this.active =
      Boolean(active);

    this.state =
      nextState;

    this.value =
      Math.max(
        0,
        Number(
          value
        ) || 0
      );

    this.intensity =
      clamp01(
        intensity
      );

    this.corruption =
      clamp01(
        corruption
      );

    if (
      restarting ||
      !this.active
    ) {
      this.resetStains();
    }

    this.lastState =
      nextState;
  }

  resize() {
    const rect =
      this.canvas
        .parentElement
        .getBoundingClientRect();

    const previousWidth =
      this.width;

    const previousHeight =
      this.height;

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
        window
          .devicePixelRatio ||
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

    this.snapshot.width =
      Math.max(
        1,
        Math.round(
          this.width
        )
      );

    this.snapshot.height =
      Math.max(
        1,
        Math.round(
          this.height
        )
      );

    this.snapshotCtx
      .imageSmoothingEnabled =
      false;

    if (
      previousWidth > 0 &&
      previousHeight > 0 &&
      (
        Math.abs(
          previousWidth -
          this.width
        ) > 1 ||
        Math.abs(
          previousHeight -
          this.height
        ) > 1
      )
    ) {
      // Geometry is viewport-relative. Re-seed after a real resize
      // instead of warping old stain masks.
      this.resetStains();
    }
  }

  resetStains() {
    this.stains.length =
      0;

    this.spawnAccumulator =
      0;

    this.coverageEstimate =
      0;

    this.activeCursor =
      0;
  }

  captureSnapshot() {
    const ctx =
      this.snapshotCtx;

    ctx.clearRect(
      0,
      0,
      this.width,
      this.height
    );

    const shellRect =
      this.canvas
        .parentElement
        .getBoundingClientRect();

    for (
      const source
      of this.sourceCanvases
    ) {
      if (
        !source.width ||
        !source.height
      ) {
        continue;
      }

      const rect =
        source
          .getBoundingClientRect();

      const x =
        rect.left -
        shellRect.left;

      const y =
        rect.top -
        shellRect.top;

      try {
        ctx.drawImage(
          source,
          0,
          0,
          source.width,
          source.height,
          x,
          y,
          rect.width,
          rect.height
        );
      } catch {
        // Safe during responsive resize / orientation transitions.
      }
    }
  }

  getTargetCoverage() {
    if (
      !this.active
    ) {
      return 0;
    }

    if (
      this.state ===
      "transition"
    ) {
      return (
        0.004 +
        this.intensity *
          0.045
      );
    }

    return Math.min(
      0.93,
      0.008 +
        Math.pow(
          this.corruption,
          1.10
        ) *
          0.922
    );
  }

  getSpawnRate() {
    const intensity =
      this.intensity;

    return (
      0.46 +
      Math.pow(
        intensity,
        1.40
      ) *
        18
    );
  }

  estimateCoverageContribution(
    stain
  ) {
    const area =
      stain.maskArea /
      Math.max(
        1,
        this.width *
          this.height
      );

    return (
      area *
      randomRange(
        0.58,
        0.78
      ) *
      (
        1 -
        this.coverageEstimate *
          0.46
      )
    );
  }

  createFragments(
    mode,
    width,
    height,
    intensity
  ) {
    const fragments = [];

    if (
      mode === "band"
    ) {
      // Keep the v0.5.0 wide-horizontal DNA, but make each stain
      // fragmented instead of one painted rectangle.
      const rows =
        Math.max(
          1,
          Math.min(
            6,
            Math.round(
              randomRange(
                1,
                lerp(
                  2.5,
                  5.5,
                  intensity
                )
              )
            )
          )
        );

      const unitH =
        height /
        Math.max(
          1,
          rows * 2 - 1
        );

      for (
        let row = 0;
        row < rows;
        row += 1
      ) {
        const localY =
          row *
          unitH *
          2;

        const localX =
          randomRange(
            0,
            width *
              0.10
          );

        fragments.push({
          x:
            localX,
          y:
            localY,
          width:
            width *
            randomRange(
              0.76,
              1.0
            ),
          height:
            Math.max(
              1,
              unitH *
                randomRange(
                  0.62,
                  1.18
                )
            )
        });
      }

      return fragments;
    }

    const fragmentCount =
      Math.max(
        1,
        Math.min(
          SUBSLICE_MAX,
          Math.round(
            randomRange(
              mode ===
                "grid"
                ? 3
                : 2,
              lerp(
                mode ===
                  "grid"
                  ? 6
                  : 4,
                mode ===
                  "grid"
                  ? 11
                  : 8,
                intensity
              )
            )
          )
        )
      );

    for (
      let index = 0;
      index <
      fragmentCount;
      index += 1
    ) {
      const fragmentW =
        width *
        randomRange(
          mode ===
            "grid"
            ? 0.18
            : 0.28,
          mode ===
            "grid"
            ? 0.62
            : 0.88
        );

      const fragmentH =
        height *
        randomRange(
          mode ===
            "grid"
            ? 0.16
            : 0.28,
          mode ===
            "grid"
            ? 0.58
            : 0.82
        );

      fragments.push({
        x:
          randomRange(
            0,
            Math.max(
              0,
              width -
                fragmentW
            )
          ),
        y:
          randomRange(
            0,
            Math.max(
              0,
              height -
                fragmentH
            )
          ),
        width:
          fragmentW,
        height:
          fragmentH
      });
    }

    return fragments;
  }

  createStain() {
    const intensity =
      this.intensity;

    // v0.5.0 dimensions preserved as the main basis.
    // We only lower the old extreme band bias because the user
    // preferred blocks/patches over a screen full of thin lines.
    const bandChance =
      lerp(
        0.42,
        0.18,
        intensity
      );

    const mode =
      Math.random() <
        bandChance
        ? "band"
        : (
            Math.random() <
            0.60
              ? "grid"
              : "cell"
          );

    let width;
    let height;

    if (
      mode === "band"
    ) {
      width =
        randomRange(
          this.width *
            0.28,
          this.width *
            lerp(
              0.55,
              0.96,
              intensity
            )
        );

      height =
        randomRange(
          5,
          lerp(
            14,
            38,
            intensity
          )
        );
    } else {
      const cellBase =
        lerp(
          72,
          11,
          intensity
        );

      width =
        randomRange(
          cellBase *
            0.70,
          cellBase *
            randomRange(
              1.4,
              4.0
            )
        );

      height =
        randomRange(
          cellBase *
            0.45,
          cellBase *
            randomRange(
              0.9,
              2.7
            )
        );
    }

    width =
      clamp(
        width,
        3,
        this.width
      );

    height =
      clamp(
        height,
        2,
        this.height
      );

    // Important change from v0.5.0:
    // stains are always independently/randomly positioned.
    // They do not grow from or chase older stains.
    const x =
      randomRange(
        -width *
          0.10,
        this.width -
          width *
            0.90
      );

    const y =
      randomRange(
        0,
        Math.max(
          1,
          this.height -
            height
        )
      );

    const fragments =
      this.createFragments(
        mode,
        width,
        height,
        intensity
      );

    const maskArea =
      fragments.reduce(
        (
          total,
          fragment
        ) =>
          total +
          fragment.width *
            fragment.height,
        0
      );

    const baseAmplitude =
      randomRange(
        1.5,
        lerp(
          7,
          42,
          intensity
        )
      );

    const periodMs =
      randomRange(
        lerp(
          1500,
          160,
          intensity
        ),
        lerp(
          4300,
          780,
          intensity
        )
      );

    return {
      x,
      y,
      width,
      height,
      mode,
      fragments,
      maskArea,

      baseAmplitude,
      verticalAmplitude:
        randomRange(
          0.2,
          lerp(
            1.4,
            7,
            intensity
          )
        ),

      periodMs,
      phase:
        Math.random() *
        Math.PI *
        2,

      channelPhase:
        Math.random() *
        Math.PI *
        2,

      birthIntensity:
        intensity,

      accent:
        CHANNEL_ACCENTS[
          Math.floor(
            Math.random() *
            CHANNEL_ACCENTS.length
          )
        ],

      accentDirection:
        Math.random() <
          0.5
          ? -1
          : 1
    };
  }

  spawnStain() {
    if (
      this.stains.length >=
      MAX_GLITCH_STAINS
    ) {
      return false;
    }

    const stain =
      this.createStain();

    this.stains.push(
      stain
    );

    this.coverageEstimate =
      Math.min(
        0.985,
        this.coverageEstimate +
          this
            .estimateCoverageContribution(
              stain
            )
      );

    return true;
  }

  updateStains(
    deltaMs
  ) {
    if (
      !this.active
    ) {
      return;
    }

    const target =
      this.getTargetCoverage();

    if (
      this.coverageEstimate >=
      target
    ) {
      return;
    }

    this.spawnAccumulator +=
      this.getSpawnRate() *
      deltaMs /
      1000;

    const gap =
      target -
      this.coverageEstimate;

    // Catch up progressively, but still only by ADDING new stains.
    // Existing spatial masks are never relocated.
    this.spawnAccumulator +=
      gap *
      lerp(
        1.2,
        13,
        this.intensity
      ) *
      deltaMs /
      1000;

    let spawnCount =
      Math.floor(
        this.spawnAccumulator
      );

    if (
      spawnCount <= 0
    ) {
      return;
    }

    this.spawnAccumulator -=
      spawnCount;

    spawnCount =
      Math.min(
        spawnCount,
        Math.floor(
          lerp(
            1,
            7,
            this.intensity
          )
        )
      );

    for (
      let index = 0;
      index <
      spawnCount;
      index += 1
    ) {
      if (
        this.coverageEstimate >=
          target ||
        !this.spawnStain()
      ) {
        break;
      }
    }

    if (
      this.state ===
        "complete" &&
      this.coverageEstimate <
        0.93
    ) {
      for (
        let index = 0;
        index < 4;
        index += 1
      ) {
        if (
          !this.spawnStain()
        ) {
          break;
        }
      }
    }
  }

  drawFragment(
    stain,
    fragment,
    primaryDx,
    primaryDy,
    pulse,
    accentPulse
  ) {
    const ctx =
      this.ctx;

    const x =
      stain.x +
      fragment.x;

    const y =
      stain.y +
      fragment.y;

    ctx.save();

    ctx.beginPath();

    ctx.rect(
      x,
      y,
      fragment.width,
      fragment.height
    );

    ctx.clip();

    // This is the key visual rule:
    // draw the LIVE scene under the Entropy layer, offset inside a
    // fixed spatial mask. No random cube is painted on top.
    ctx.globalAlpha =
      lerp(
        0.28,
        0.82,
        this.intensity
      ) *
      (
        0.56 +
        pulse *
          0.44
      );

    ctx.drawImage(
      this.snapshot,
      primaryDx,
      primaryDy,
      this.width,
      this.height
    );

    // Secondary displaced live-sample. This reproduces the feeling of
    // channel disagreement from the reference without replacing the
    // underlying image with a colored rectangle.
    ctx.globalCompositeOperation =
      "screen";

    ctx.globalAlpha =
      lerp(
        0.035,
        0.16,
        this.intensity
      ) *
      accentPulse;

    ctx.drawImage(
      this.snapshot,
      primaryDx *
        -0.24,
      primaryDy *
        -0.20,
      this.width,
      this.height
    );

    // Tiny channel-edge accent only at the clipping boundary.
    // It does not fill the stain.
    if (
      this.intensity >
      0.36 &&
      accentPulse >
        0.42
    ) {
      const edge =
        Math.max(
          1,
          Math.min(
            2.5,
            fragment.width *
              0.025
          )
        );

      ctx.globalCompositeOperation =
        "source-over";

      ctx.globalAlpha =
        lerp(
          0.04,
          0.24,
          this.intensity
        ) *
        accentPulse;

      ctx.fillStyle =
        stain.accent;

      ctx.fillRect(
        primaryDx *
          stain
            .accentDirection >
          0
          ? x
          : x +
            fragment.width -
            edge,
        y,
        edge,
        fragment.height
      );
    }

    ctx.restore();
  }

  drawStain(
    stain,
    now
  ) {
    const speedBoost =
      lerp(
        0.78,
        2.75,
        Math.pow(
          this.intensity,
          1.10
        )
      );

    const phase =
      (
        now /
        stain.periodMs
      ) *
        Math.PI *
        2 *
        speedBoost +
      stain.phase;

    const pulse =
      (
        Math.sin(
          phase
        ) +
        1
      ) /
      2;

    const accentPulse =
      (
        Math.sin(
          phase *
            1.93 +
          stain.channelPhase
        ) +
        1
      ) /
      2;

    // Slow stains early on are allowed to settle for longer. Late in
    // Entropy the same fixed masks glitch more continuously.
    const activationThreshold =
      lerp(
        0.78,
        0.14,
        this.intensity
      );

    if (
      pulse <
      activationThreshold
    ) {
      return;
    }

    const globalAmplitude =
      stain.baseAmplitude *
      lerp(
        0.72,
        1.28,
        this.intensity
      );

    // Quantized-ish direction change gives the original v0.5.0
    // "digital jump" while position/mask stays stable.
    const wave =
      Math.sin(
        phase *
          1.21
      );

    const direction =
      wave >=
        0
        ? 1
        : -1;

    const primaryDx =
      direction *
      globalAmplitude *
      (
        0.40 +
        Math.abs(
          wave
        ) *
          0.60
      );

    const primaryDy =
      Math.sin(
        phase *
          0.61
      ) *
      stain
        .verticalAmplitude;

    for (
      const fragment
      of stain.fragments
    ) {
      this.drawFragment(
        stain,
        fragment,
        primaryDx,
        primaryDy,
        pulse,
        accentPulse
      );
    }
  }

  drawActiveStains(
    now
  ) {
    const count =
      this.stains.length;

    if (
      count <= 0
    ) {
      return;
    }

    const desired =
      Math.min(
        MAX_ACTIVE_STAINS,
        Math.max(
          1,
          Math.floor(
            2 +
            Math.pow(
              this.intensity,
              1.30
            ) *
              MAX_ACTIVE_STAINS
          )
        )
      );

    const stride =
      Math.max(
        1,
        Math.floor(
          count /
          desired
        )
      );

    const offset =
      this.activeCursor %
      count;

    for (
      let index = 0;
      index <
      desired;
      index += 1
    ) {
      const stain =
        this.stains[
          (
            offset +
            index *
              stride
          ) %
          count
        ];

      this.drawStain(
        stain,
        now
      );
    }

    this.activeCursor =
      (
        this.activeCursor +
        Math.max(
          1,
          Math.floor(
            lerp(
              1,
              4,
              this.intensity
            )
          )
        )
      ) %
      count;
  }

  drawLateNoise() {
    // Keep the v0.5.0 white-noise flavor, but only as a late and
    // restrained accent. It must never become the main Entropy shape.
    if (
      this.intensity <
      0.84
    ) {
      return;
    }

    const ctx =
      this.ctx;

    const count =
      Math.floor(
        (
          this.intensity -
          0.84
        ) /
        0.16 *
        18
      );

    ctx.save();

    for (
      let index = 0;
      index <
      count;
      index += 1
    ) {
      const size =
        randomRange(
          1,
          2.5
        );

      ctx.globalAlpha =
        randomRange(
          0.025,
          0.09
        );

      ctx.fillStyle =
        Math.random() <
          0.75
          ? "#f3eeea"
          : "#02091f";

      ctx.fillRect(
        Math.random() *
          this.width,
        Math.random() *
          this.height,
        size,
        size
      );
    }

    ctx.restore();
  }

  render(
    now
  ) {
    const ctx =
      this.ctx;

    ctx.clearRect(
      0,
      0,
      this.width,
      this.height
    );

    if (
      !this.active ||
      this.intensity <=
        0.001
    ) {
      return;
    }

    // Always capture the CURRENT lower layers so the glitch follows
    // fish, ocean, bucket and HUD instead of freezing their pixels.
    this.captureSnapshot();

    this.drawActiveStains(
      now
    );

    this.drawLateNoise();
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
      !document.hidden &&
      this.active
    ) {
      this.updateStains(
        delta
      );
    }

    this.render(
      now
    );

    this.frameHandle =
      requestAnimationFrame(
        this.boundLoop
      );
  }
}
