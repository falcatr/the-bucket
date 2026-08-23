import {
  getBucketCellMeta
} from "../game/GachaSystem.js";

import {
  getEmotionTranslation
} from "../game/EmotionLexicon.js";

import {
  ProceduralBufferCreatureRenderer
} from "./ProceduralBufferCreatureRenderer.js";

const TYPE_BY_ID =
  Object.freeze({
    joy: 1,
    rage: 2,
    fear: 3,
    grief: 4
  });

const EMOTIONS =
  Object.freeze([
    "joy",
    "rage",
    "fear",
    "grief"
  ]);

const CREATURE_VARIANTS = 4;
const TWO_PI = Math.PI * 2;

const AQUARIUM_FONT =
  '"DotGothic16", "Pixelify Sans", "Noto Sans", "Segoe UI", sans-serif';

export class AquariumLayer {
  constructor(
    canvas,
    oceanEngine,
    config
  ) {
    this.canvas = canvas;

    this.ctx =
      canvas.getContext(
        "2d"
      );

    this.ocean =
      oceanEngine;

    this.config =
      config;

    this.width = 0;
    this.height = 0;
    this.dpr = 1;

    this.words = [];
    this.creatures = [];
    this.variantBag = [];

    this.scores = {
      joy: 0,
      rage: 0,
      fear: 0,
      grief: 0
    };

    this.spawnBudget = {
      joy: 0,
      rage: 0,
      fear: 0,
      grief: 0
    };

    this.creatureRenderer =
      new ProceduralBufferCreatureRenderer(
        config
      );

    this.lastFrame =
      performance.now();

    this.frameHandle = 0;
    this.resizeObserver = null;

    this.boundLoop =
      this.loop.bind(
        this
      );
  }

  start() {
    this.resize();

    this.setViewOffset(
      0
    );

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

  resize() {
    const previousWidth =
      this.width;

    const previousHeight =
      this.height;

    const rect =
      this.canvas
        .parentElement
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
        window
          .devicePixelRatio ||
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

    if (
      previousWidth > 0 &&
      previousHeight > 0
    ) {
      const scaleX =
        this.width /
        previousWidth;

      const scaleY =
        this.height /
        previousHeight;

      for (
        const creature
        of this.creatures
      ) {
        creature.centerX *=
          scaleX;

        creature.baseY *=
          scaleY;

        creature.horizontalAmplitude *=
          scaleX;

        creature.verticalAmplitude *=
          scaleY;

        creature.secondaryVerticalAmplitude *=
          scaleY;
      }

      for (
        const word
        of this.words
      ) {
        word.x *=
          scaleX;

        word.y *=
          scaleY;
      }
    }

    this.updateCreaturePositions();
  }

  setViewOffset(
    offsetY
  ) {
    // Spatially follows the ocean during pull, without changing any
    // Aquarium simulation state.
    this.canvas.style.transform =
      `translate3d(0, ${Number(
        offsetY
      ).toFixed(2)}px, 0)`;
  }

  getAquariumBounds(
    padding = 0
  ) {
    const minDepth =
      Math.max(
        0,
        Math.min(
          1,
          Number(
            this.config
              .aquariumMinDepthRatio
          ) || 0.42
        )
      );

    const maxDepth =
      Math.max(
        minDepth,
        Math.min(
          1,
          Number(
            this.config
              .aquariumMaxDepthRatio
          ) || 0.90
        )
      );

    const top =
      Math.min(
        this.height,
        this.height *
          minDepth +
          padding
      );

    const bottom =
      Math.max(
        top,
        Math.min(
          this.height -
            24 -
            padding,
          this.height *
            maxDepth -
            padding
        )
      );

    return {
      top,
      bottom
    };
  }

  refillVariantBag() {
    const preferred =
      Math.max(
        0,
        Math.min(
          CREATURE_VARIANTS - 1,
          Math.round(
            Number(
              this.config
                .aquariumCreatureShapeIndex
            ) || 0
          ) %
            CREATURE_VARIANTS
        )
      );

    const bag =
      Array.from(
        {
          length:
            CREATURE_VARIANTS
        },
        (
          _,
          index
        ) => index
      );

    for (
      let index =
        bag.length - 1;
      index > 0;
      index -= 1
    ) {
      const swapIndex =
        Math.floor(
          Math.random() *
          (
            index + 1
          )
        );

      const temporary =
        bag[index];

      bag[index] =
        bag[
          swapIndex
        ];

      bag[
        swapIndex
      ] =
        temporary;
    }

    const preferredIndex =
      bag.indexOf(
        preferred
      );

    if (
      preferredIndex >= 0
    ) {
      bag.splice(
        preferredIndex,
        1
      );

      bag.push(
        preferred
      );
    }

    this.variantBag =
      bag;
  }

  takeNextVariantIndex() {
    if (
      this.variantBag.length ===
      0
    ) {
      this.refillVariantBag();
    }

    return (
      this.variantBag.pop() ??
      0
    );
  }

  getBetaCreatureCount(
    emotion
  ) {
    const score =
      Math.max(
        0,
        Math.floor(
          Number(
            this.scores[
              emotion
            ]
          ) || 0
        )
      );

    return Math.floor(
      score / 3
    );
  }

  registerEmotionScore(
    emotion,
    total
  ) {
    const normalized =
      String(
        emotion ?? ""
      )
        .trim()
        .toLowerCase();

    if (
      !EMOTIONS.includes(
        normalized
      )
    ) {
      return;
    }

    const previous =
      this.scores[
        normalized
      ];

    const next =
      Math.max(
        0,
        Math.floor(
          Number(
            total
          ) || 0
        )
      );

    this.scores[
      normalized
    ] = next;

    if (
      next <= previous
    ) {
      return;
    }

    let betaTriggered =
      false;

    for (
      let score =
        previous;
      score < next;
      score += 1
    ) {
      const ordinal =
        score + 1;

      this.spawnCreature(
        normalized,
        ordinal
      );

      if (
        ordinal % 3 === 0
      ) {
        betaTriggered =
          true;
      }
    }

    this.spawnWord(
      normalized,
      true
    );

    if (
      betaTriggered
    ) {
      const extraBursts =
        Math.max(
          1,
          Math.floor(
            Number(
              this.config
                .aquariumImmediateWordsOnBetaSpawn
            ) || 3
          )
        );

      for (
        let index = 0;
        index < extraBursts;
        index += 1
      ) {
        this.spawnWord(
          normalized,
          true
        );
      }
    }

    this.creatureRenderer
      .setActiveCreatures(
        this.creatures
      );
  }

  spawnCreature(
    emotion,
    completedScoreOrdinal = 1
  ) {
    const normalizedOrdinal =
      Math.max(
        1,
        Math.floor(
          Number(
            completedScoreOrdinal
          ) || 1
        )
      );

    const shapeFamily =
      normalizedOrdinal % 3 === 0
        ? "beta"
        : "alpha";
    const cellW =
      this.ocean.cellW ||
      Math.max(
        6,
        this.width / 42
      );

    const sizeRatio =
      Math.max(
        0.06,
        Math.min(
          1.20,
          Number(
            this.config
              .aquariumCreatureSizeViewportRatio
          ) || 0.35
        )
      );

    const baseSize =
      Math.max(
        cellW * 6,
        Math.min(
          this.width,
          this.height
        ) *
          sizeRatio *
          (
            0.92 +
            Math.random() *
              0.16
          )
      );

    const betaScaleMultiplier =
      shapeFamily ===
      "beta"
        ? Math.max(
            1,
            Number(
              this.config
                .aquariumCreatureBetaScaleMultiplier
            ) || 1.28
          )
        : 1;

    const size =
      baseSize *
      betaScaleMultiplier;

    const radius =
      size *
      (
        shapeFamily ===
        "beta"
          ? 0.45
          : 0.42
      );

    const bounds =
      this.getAquariumBounds(
        radius
      );

    const horizontalSpace =
      Math.max(
        0,
        this.width -
          radius * 2
      );

    const horizontalAmplitude =
      horizontalSpace *
      (
        0.25 +
        Math.random() *
          0.16
      );

    const limitedAmplitude =
      Math.min(
        horizontalAmplitude,
        horizontalSpace *
          0.46
      );

    const minCenterX =
      radius +
      limitedAmplitude;

    const maxCenterX =
      Math.max(
        minCenterX,
        this.width -
          radius -
          limitedAmplitude
      );

    const centerX =
      minCenterX +
      Math.random() *
      Math.max(
        0,
        maxCenterX -
          minCenterX
      );

    const verticalRoom =
      Math.max(
        0,
        bounds.bottom -
          bounds.top
      );

    const verticalAmplitude =
      Math.min(
        Math.max(
          5,
          size * 0.055
        ),
        verticalRoom *
          0.18
      );

    const secondaryVerticalAmplitude =
      verticalAmplitude *
      (
        0.20 +
        Math.random() *
          0.18
      );

    const totalVerticalAmplitude =
      verticalAmplitude +
      secondaryVerticalAmplitude;

    const minBaseY =
      bounds.top +
      totalVerticalAmplitude;

    const maxBaseY =
      Math.max(
        minBaseY,
        bounds.bottom -
          totalVerticalAmplitude
      );

    const baseY =
      minBaseY +
      Math.random() *
      Math.max(
        0,
        maxBaseY -
          minBaseY
      );

    const speedCells =
      Math.max(
        0.05,
        Number(
          this.config
            .aquariumCreatureSwimSpeedCellsPerSecond
        ) || 0.55
      );

    const targetSpeedPx =
      cellW *
      speedCells *
      (
        0.70 +
        Math.random() *
          0.55
      );

    const horizontalPeriodMs =
      Math.max(
        7000,
        Math.min(
          22000,
          (
            TWO_PI *
            Math.max(
              limitedAmplitude,
              cellW * 3
            ) /
            Math.max(
              1,
              targetSpeedPx
            )
          ) *
          1000
        )
      );

    const verticalPeriodMs =
      5200 +
      Math.random() *
        5200;

    const secondaryVerticalPeriodMs =
      verticalPeriodMs *
      (
        0.48 +
        Math.random() *
          0.18
      );

    const creature = {
      emotion,

      completedScoreOrdinal:
        normalizedOrdinal,

      shapeFamily,

      variantIndex:
        this.takeNextVariantIndex(),

      size,
      radius,

      centerX,
      horizontalAmplitude:
        limitedAmplitude,

      horizontalPeriodMs,
      horizontalPhase:
        Math.random() *
        TWO_PI,

      baseY,

      verticalAmplitude,
      verticalPeriodMs,
      verticalPhase:
        Math.random() *
        TWO_PI,

      secondaryVerticalAmplitude,
      secondaryVerticalPeriodMs,
      secondaryVerticalPhase:
        Math.random() *
        TWO_PI,

      x:
        centerX,

      renderY:
        baseY,

      rotation: 0,

      squashX:
        (
          shapeFamily ===
          "beta"
            ? Math.max(
                1.05,
                Number(
                  this.config
                    .aquariumCreatureBetaWidthMultiplier
                ) || 1.0
              )
            : 1
        ) *
        (
          0.95 +
          Math.random() *
            0.10
        ),

      squashY:
        (
          shapeFamily ===
          "beta"
            ? Math.max(
                0.85,
                Number(
                  this.config
                    .aquariumCreatureBetaHeightMultiplier
                ) || 1.0
              )
            : 1
        ) *
        (
          0.95 +
          Math.random() *
            0.10
        ),

      alpha:
        Math.max(
          0.05,
          Math.min(
            1,
            Number(
              this.config
                .aquariumCreatureAlpha
            ) || 0.72
          )
        ) *
        (
          0.91 +
          Math.random() *
            0.09
        )
    };

    this.creatures.push(
      creature
    );

    this.updateCreaturePosition(
      creature
    );
  }

  updateCreaturePosition(
    creature
  ) {
    creature.x =
      creature.centerX +
      Math.sin(
        creature.horizontalPhase
      ) *
      creature.horizontalAmplitude;

    creature.renderY =
      creature.baseY +
      Math.sin(
        creature.verticalPhase
      ) *
        creature.verticalAmplitude +
      Math.sin(
        creature
          .secondaryVerticalPhase
      ) *
        creature
          .secondaryVerticalAmplitude;

    const horizontalVelocity =
      Math.cos(
        creature.horizontalPhase
      ) *
      creature.horizontalAmplitude *
      (
        TWO_PI /
        creature.horizontalPeriodMs
      );

    const verticalVelocity =
      Math.cos(
        creature.verticalPhase
      ) *
      creature.verticalAmplitude *
      (
        TWO_PI /
        creature.verticalPeriodMs
      );

    creature.rotation =
      Math.max(
        -0.16,
        Math.min(
          0.16,
          verticalVelocity *
            18 +
          horizontalVelocity *
            0.8
        )
      );
  }

  updateCreaturePositions() {
    for (
      const creature
      of this.creatures
    ) {
      this.updateCreaturePosition(
        creature
      );
    }
  }

  updateCreatures(
    deltaMs
  ) {
    if (
      this.creatures.length ===
      0
    ) {
      this.creatureRenderer
        .setActiveCreatures(
          []
        );

      return;
    }

    this.creatureRenderer
      .setActiveCreatures(
        this.creatures
      );

    this.creatureRenderer
      .update(
        deltaMs
      );

    for (
      const creature
      of this.creatures
    ) {
      creature.horizontalPhase =
        (
          creature.horizontalPhase +
          (
            TWO_PI *
            deltaMs
          ) /
          creature.horizontalPeriodMs
        ) %
        TWO_PI;

      creature.verticalPhase =
        (
          creature.verticalPhase +
          (
            TWO_PI *
            deltaMs
          ) /
          creature.verticalPeriodMs
        ) %
        TWO_PI;

      creature.secondaryVerticalPhase =
        (
          creature
            .secondaryVerticalPhase +
          (
            TWO_PI *
            deltaMs
          ) /
          creature
            .secondaryVerticalPeriodMs
        ) %
        TWO_PI;

      this.updateCreaturePosition(
        creature
      );
    }
  }

  getSpawnRatePerMinute(
    emotion
  ) {
    const score =
      this.scores[
        emotion
      ];

    if (
      score <= 0
    ) {
      return 0;
    }

    const baseRate =
      Math.max(
        0,
        Number(
          this.config
            .aquariumBaseWordsPerMinute
        ) || 0
      );

    const exponent =
      Math.max(
        0.01,
        Number(
          this.config
            .aquariumScoreExponent
        ) || 0.8
      );

    const trioCount =
      this.getBetaCreatureCount(
        emotion
      );

    const trioMultiplier =
      trioCount <= 0
        ? 1
        : Math.max(
            1,
            Number(
              this.config
                .aquariumWordsPerTrioMultiplier
            ) || 2.4
          ) ** trioCount;

    return (
      baseRate *
      Math.pow(
        score,
        exponent
      ) *
      trioMultiplier
    );
  }

  spawnWord(
    emotion,
    immediate = false
  ) {
    const maxWords =
      Math.max(
        1,
        Math.floor(
          Number(
            this.config
              .aquariumMaxWords
          ) || 32
        )
      );

    if (
      this.words.length >=
      maxWords
    ) {
      this.words.shift();
    }

    const translation =
      getEmotionTranslation(
        emotion
      );

    if (
      !translation
    ) {
      return;
    }

    const text =
      String(
        translation.word
      ).toLocaleLowerCase();

    const cellW =
      this.ocean.cellW ||
      Math.max(
        6,
        this.width / 42
      );

    const cellH =
      this.ocean.cellH ||
      cellW * 1.28;

    const fontSize =
      Math.max(
        10,
        cellH *
        (
          0.80 +
          Math.random() *
            0.34
        )
      );

    const bounds =
      this.getAquariumBounds(
        fontSize
      );

    const y =
      bounds.top +
      Math.random() *
      Math.max(
        1,
        bounds.bottom -
          bounds.top
      );

    const speedCells =
      Math.max(
        0.05,
        Number(
          this.config
            .aquariumWordSpeedCellsPerSecond
        ) || 2.2
      );

    const speedPx =
      cellW *
      speedCells *
      (
        0.78 +
        Math.random() *
          0.46
      );

    const meta =
      getBucketCellMeta(
        TYPE_BY_ID[
          emotion
        ]
      );

    this.ctx.font =
      `${fontSize}px ${AQUARIUM_FONT}`;

    const measuredWidth =
      this.ctx
        .measureText(
          text
        )
        .width;

    this.words.push({
      emotion,
      text,
      language:
        translation.language,
      x:
        this.width +
        measuredWidth +
        (
          immediate
            ? 8
            : Math.random() *
              this.width *
              0.22
        ),
      y,
      width:
        measuredWidth,
      speedPx,
      fontSize,
      color:
        meta.color,
      alpha:
        0.42 +
        Math.random() *
          0.24
    });
  }

  updateSpawning(
    deltaMs
  ) {
    for (
      const emotion
      of EMOTIONS
    ) {
      const rate =
        this.getSpawnRatePerMinute(
          emotion
        );

      if (
        rate <= 0
      ) {
        this.spawnBudget[
          emotion
        ] = 0;

        continue;
      }

      this.spawnBudget[
        emotion
      ] +=
        rate *
        deltaMs /
        60000;

      while (
        this.spawnBudget[
          emotion
        ] >= 1
      ) {
        this.spawnBudget[
          emotion
        ] -= 1;

        this.spawnWord(
          emotion
        );
      }
    }
  }

  updateWords(
    deltaMs
  ) {
    const seconds =
      deltaMs /
      1000;

    let writeIndex = 0;

    for (
      let index = 0;
      index <
      this.words.length;
      index += 1
    ) {
      const word =
        this.words[
          index
        ];

      word.x -=
        word.speedPx *
        seconds;

      if (
        word.x +
          word.width <
        -12
      ) {
        continue;
      }

      this.words[
        writeIndex
      ] = word;

      writeIndex += 1;
    }

    this.words.length =
      writeIndex;
  }

  update(
    deltaMs
  ) {
    this.updateSpawning(
      deltaMs
    );

    this.updateWords(
      deltaMs
    );

    this.updateCreatures(
      deltaMs
    );
  }

  renderCreatures() {
    for (
      const creature
      of this.creatures
    ) {
      this.creatureRenderer
        .draw(
          this.ctx,
          creature
        );
    }
  }

  renderWords() {
    const ctx =
      this.ctx;

    ctx.textAlign =
      "left";

    ctx.textBaseline =
      "middle";

    for (
      const word
      of this.words
    ) {
      ctx.save();

      ctx.globalAlpha =
        word.alpha;

      ctx.font =
        `${word.fontSize}px ${AQUARIUM_FONT}`;

      ctx.fillStyle =
        word.color;

      ctx.shadowColor =
        word.color;

      ctx.shadowBlur = 3;

      ctx.fillText(
        word.text,
        word.x,
        word.y
      );

      ctx.restore();
    }
  }

  render() {
    const ctx =
      this.ctx;

    ctx.clearRect(
      0,
      0,
      this.width,
      this.height
    );

    const bounds =
      this.getAquariumBounds(
        0
      );

    ctx.save();

    ctx.beginPath();

    ctx.rect(
      0,
      bounds.top,
      this.width,
      Math.max(
        0,
        bounds.bottom -
          bounds.top
      )
    );

    ctx.clip();

    this.renderCreatures();
    this.renderWords();

    ctx.restore();
  }

  loop(
    now
  ) {
    const delta =
      Math.min(
        100,
        now -
          this.lastFrame
      );

    this.lastFrame =
      now;

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
