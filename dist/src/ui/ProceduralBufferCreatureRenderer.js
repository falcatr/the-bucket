const ORIGINAL_POINT_DOMAIN = 10000;
const VARIANT_COUNT = 4;
const TWO_PI = Math.PI * 2;
const FOUR_PI = Math.PI * 4;
const LOOP_ALPHA_MS = 8000;
const LOOP_BETA_MS = 16000;

// Faithful reference viewport from createCanvas(400, 400).
// Beta points outside this viewport must be clipped, not included in auto-fit.
const BETA_REFERENCE_MIN_X = -200;
const BETA_REFERENCE_MAX_X = 200;
const BETA_REFERENCE_MIN_Y = 0;
const BETA_REFERENCE_MAX_Y = 400;
const BETA_REFERENCE_ALPHA = 116 / 255;

const EMOTION_COLORS =
  Object.freeze({
    joy: "#fff35d",
    rage: "#ff3b52",
    fear: "#4cff79",
    grief: "#4798ff"
  });

const FAMILY_ALPHA =
  "alpha";

const FAMILY_BETA =
  "beta";

const FAMILY_KEYS =
  Object.freeze([
    FAMILY_ALPHA,
    FAMILY_BETA
  ]);

function safeDivisor(
  value
) {
  if (
    Math.abs(
      value
    ) >=
    0.0001
  ) {
    return value;
  }

  return value < 0
    ? -0.0001
    : 0.0001;
}

export class ProceduralBufferCreatureRenderer {
  constructor(
    config
  ) {
    this.config = config;

    this.spriteSize = 0;
    this.cachedPointSamples = 0;

    this.familyState = {
      [FAMILY_ALPHA]: {
        elapsedMs: 0,
        time: 0
      },
      [FAMILY_BETA]: {
        elapsedMs: 0,
        time: 0
      }
    };

    this.familyCaches =
      new Map();

    this.sprites =
      new Map();

    this.activeSpriteKeys =
      new Set();

    this.activeVariantsByFamily =
      new Map();

    this.rebuildStorage();
  }

  get pointSamples() {
    return Math.max(
      200,
      Math.min(
        2000,
        Math.round(
          Number(
            this.config
              .aquariumCreaturePointSamples
          ) || 900
        )
      )
    );
  }

  get betaPointSamples() {
    return Math.max(
      200,
      Math.min(
        ORIGINAL_POINT_DOMAIN,
        Math.round(
          Number(
            this.config
              .aquariumCreatureBetaPointSamples
          ) || ORIGINAL_POINT_DOMAIN
        )
      )
    );
  }

  get desiredSpriteSize() {
    return Math.max(
      64,
      Math.min(
        256,
        Math.round(
          Number(
            this.config
              .aquariumCreatureSpriteSize
          ) || 160
        )
      )
    );
  }

  normalizeVariantIndex(
    variantIndex
  ) {
    return Math.max(
      0,
      Math.min(
        VARIANT_COUNT - 1,
        Math.round(
          Number(
            variantIndex
          ) || 0
        )
      )
    );
  }

  normalizeFamily(
    family
  ) {
    return family ===
      FAMILY_BETA
      ? FAMILY_BETA
      : FAMILY_ALPHA;
  }

  getLoopDurationMs(
    family
  ) {
    return family ===
      FAMILY_BETA
      ? LOOP_BETA_MS
      : LOOP_ALPHA_MS;
  }

  getLoopTimeRange(
    family
  ) {
    return family ===
      FAMILY_BETA
      ? FOUR_PI
      : TWO_PI;
  }

  getLoopPhaseOffset(
    family,
    variantIndex
  ) {
    const normalizedVariant =
      this.normalizeVariantIndex(
        variantIndex
      );

    // Keep the variant offsets inside one visual loop of each family.
    return (
      this.getLoopTimeRange(
        family
      ) *
      normalizedVariant
    ) / VARIANT_COUNT;
  }

  rebuildStorage() {
    const sampleCount =
      this.pointSamples;

    if (
      this.cachedPointSamples !==
      sampleCount
    ) {
      this.cachedPointSamples =
        sampleCount;

      this.familyCaches.clear();
      this.sprites.clear();
    }

    if (
      this.spriteSize !==
      this.desiredSpriteSize
    ) {
      this.spriteSize =
        this.desiredSpriteSize;

      this.sprites.clear();
    }
  }

  ensureFamilyCache(
    family
  ) {
    const normalizedFamily =
      this.normalizeFamily(
        family
      );

    let cache =
      this.familyCaches.get(
        normalizedFamily
      );

    const expectedSampleCount =
      normalizedFamily ===
      FAMILY_BETA
        ? this.betaPointSamples
        : this.cachedPointSamples;

    if (
      cache &&
      cache.sampleCount ===
        expectedSampleCount
    ) {
      return cache;
    }

    cache =
      normalizedFamily ===
      FAMILY_BETA
        ? this.buildBetaCache()
        : this.buildAlphaCache();

    this.familyCaches.set(
      normalizedFamily,
      cache
    );

    return cache;
  }

  buildAlphaCache() {
    const sampleCount =
      this.cachedPointSamples;

    const sampleD =
      new Float32Array(
        sampleCount
      );

    const sampleBaseQ =
      new Float32Array(
        sampleCount
      );

    const sampleKOverD =
      new Float32Array(
        sampleCount
      );

    const sampleCBase =
      new Float32Array(
        sampleCount
      );

    const sampleD9 =
      new Float32Array(
        sampleCount
      );

    for (
      let sample = 0;
      sample <
      sampleCount;
      sample += 1
    ) {
      const i =
        Math.floor(
          (
            sample /
            sampleCount
          ) *
          ORIGINAL_POINT_DOMAIN
        );

      const x = i;
      const y = i / 41;

      const k =
        5 *
        Math.cos(
          x / 19
        ) *
        Math.cos(
          y / 30
        );

      const e =
        y / 8 - 12;

      const d =
        (
          Math.hypot(
            k,
            e
          ) ** 2
        ) /
          59 +
        2;

      sampleD[
        sample
      ] = d;

      sampleBaseQ[
        sample
      ] =
        4 *
        Math.sin(
          Math.atan2(
            k,
            e
          ) * 9
        );

      sampleKOverD[
        sample
      ] =
        k / d;

      sampleCBase[
        sample
      ] =
        d * d / 7;

      sampleD9[
        sample
      ] =
        d * 9;
    }

    const cache = {
      family:
        FAMILY_ALPHA,
      sampleCount,
      sampleD,
      sampleBaseQ,
      sampleKOverD,
      sampleCBase,
      sampleD9,
      geometryByVariant:
        new Map()
    };

    cache.bounds =
      this.computeBounds(
        cache
      );

    return cache;
  }

  buildBetaCache() {
    const sampleCount =
      this.betaPointSamples;

    const sampleBaseQ =
      new Float32Array(
        sampleCount
      );

    const sampleD =
      new Float32Array(
        sampleCount
      );

    const sampleCBase =
      new Float32Array(
        sampleCount
      );

    const sampleCosYOverK =
      new Float32Array(
        sampleCount
      );

    const sampleSinYOver25 =
      new Float32Array(
        sampleCount
      );

    const sampleE9MinusD3 =
      new Float32Array(
        sampleCount
      );

    for (
      let sample = 0;
      sample <
      sampleCount;
      sample += 1
    ) {
      // Exact source loop: for(i=1e4;i--;) a(i/295)
      const i =
        ORIGINAL_POINT_DOMAIN -
        1 -
        sample;

      const y =
        i / 295;

      const cosI =
        Math.cos(
          i / 29
        );

      const e =
        y / 7 - 13;

      sampleBaseQ[
        sample
      ] =
        y;

      sampleD[
        sample
      ] = e;

      sampleCBase[
        sample
      ] =
        Math.cos(y);

      sampleSinYOver25[
        sample
      ] =
        Math.sin(
          y / 25
        );

      sampleE9MinusD3[
        sample
      ] =
        e * 9;

      sampleCosYOverK[
        sample
      ] = cosI;
    }

    const cache = {
      family:
        FAMILY_BETA,
      sampleCount,
      sampleBaseQ,
      sampleD,
      sampleCBase,
      sampleCosYOverK,
      sampleSinYOver25,
      sampleE9MinusD3,
      geometryByVariant:
        new Map()
    };

    // The source sketch draws into a fixed 400x400 canvas.
    // sampleBetaPoint omits only the source +200 X translation, therefore
    // local X [-200,200] and Y [0,400] reproduce the original clipping.
    cache.bounds = {
      minX:
        BETA_REFERENCE_MIN_X,
      maxX:
        BETA_REFERENCE_MAX_X,
      minY:
        BETA_REFERENCE_MIN_Y,
      maxY:
        BETA_REFERENCE_MAX_Y
    };

    return cache;
  }

  computeBounds(
    cache
  ) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    const timeSteps = 48;
    const stride =
      Math.max(
        1,
        Math.floor(
          cache.sampleCount / 450
        )
      );

    const loopRange =
      this.getLoopTimeRange(
        cache.family
      );

    for (
      let step = 0;
      step <
      timeSteps;
      step += 1
    ) {
      const t =
        (
          step /
          timeSteps
        ) *
        loopRange;

      for (
        let sample = 0;
        sample <
        cache.sampleCount;
        sample += stride
      ) {
        const [
          x,
          y
        ] =
          cache.family ===
          FAMILY_BETA
            ? this.sampleBetaPoint(
                cache,
                sample,
                t
              )
            : this.sampleAlphaPoint(
                cache,
                sample,
                t
              );

        if (
          Number.isFinite(
            x
          ) &&
          Number.isFinite(
            y
          )
        ) {
          if (
            x < minX
          ) {
            minX = x;
          }

          if (
            x > maxX
          ) {
            maxX = x;
          }

          if (
            y < minY
          ) {
            minY = y;
          }

          if (
            y > maxY
          ) {
            maxY = y;
          }
        }
      }
    }

    if (
      !Number.isFinite(
        minX
      ) ||
      !Number.isFinite(
        maxX
      ) ||
      !Number.isFinite(
        minY
      ) ||
      !Number.isFinite(
        maxY
      )
    ) {
      return {
        minX: -100,
        maxX: 100,
        minY: -100,
        maxY: 100
      };
    }

    const paddingX =
      Math.max(
        8,
        (
          maxX - minX
        ) * 0.06
      );

    const paddingY =
      Math.max(
        8,
        (
          maxY - minY
        ) * 0.06
      );

    return {
      minX:
        minX - paddingX,
      maxX:
        maxX + paddingX,
      minY:
        minY - paddingY,
      maxY:
        maxY + paddingY
    };
  }

  sampleAlphaPoint(
    cache,
    sample,
    t
  ) {
    const d =
      cache.sampleD[
        sample
      ];

    const q =
      cache.sampleBaseQ[
        sample
      ] +
      9 *
        Math.sin(
          d - t
        ) -
      cache.sampleKOverD[
        sample
      ] *
        (
          9 +
          Math.sin(
            cache.sampleD9[
              sample
            ] -
            t * 16
          ) * 3
        );

    const c =
      cache.sampleCBase[
        sample
      ] - t;

    return [
      q +
        50 *
          Math.cos(
            c
          ),
      q *
          Math.sin(
            c
          ) +
        d * 45 -
        9
    ];
  }

  sampleBetaPoint(
    cache,
    sample,
    t
  ) {
    const y =
      cache.sampleBaseQ[
        sample
      ];

    const sinY2MinusTHalf =
      Math.sin(
        y * 2 -
        t / 2
      );

    const k =
      (
        5 +
        sinY2MinusTHalf *
          2
      ) *
      cache.sampleCosYOverK[
        sample
      ];

    const e =
      cache.sampleD[
        sample
      ];

    const d =
      Math.hypot(
        k,
        e
      ) - 6;

    const safeK =
      safeDivisor(k);

    const c =
      d - t;

    const q =
      3 *
        Math.sin(
          k * 2
        ) +
      cache.sampleCBase[
        sample
      ] /
        safeK +
      cache.sampleSinYOver25[
        sample
      ] *
        k *
        (
          9 +
          4 *
            Math.sin(
              cache.sampleE9MinusD3[
                sample
              ] -
              d * 3 +
              t * 2
            )
        );

    return [
      q +
        50 *
          Math.cos(c),
      q *
        Math.sin(c) +
        d * 39
    ];
  }

  setActiveCreatures(
    creatures
  ) {
    this.activeSpriteKeys.clear();
    this.activeVariantsByFamily =
      new Map();

    for (
      const creature
      of creatures
    ) {
      const family =
        this.normalizeFamily(
          creature.shapeFamily
        );

      const variantIndex =
        this.normalizeVariantIndex(
          creature.variantIndex
        );

      const spriteKey =
        `${family}:${variantIndex}:${creature.emotion}`;

      this.activeSpriteKeys.add(
        spriteKey
      );

      if (
        !this.activeVariantsByFamily.has(
          family
        )
      ) {
        this.activeVariantsByFamily.set(
          family,
          new Set()
        );
      }

      this.activeVariantsByFamily
        .get(family)
        .add(
          variantIndex
        );

      this.ensureFamilyCache(
        family
      );
    }
  }

  getVariantGeometry(
    family,
    variantIndex
  ) {
    const normalizedFamily =
      this.normalizeFamily(
        family
      );

    const normalizedVariant =
      this.normalizeVariantIndex(
        variantIndex
      );

    const cache =
      this.ensureFamilyCache(
        normalizedFamily
      );

    const expectedLength =
      cache.sampleCount * 2;

    let points =
      cache.geometryByVariant.get(
        normalizedVariant
      );

    if (
      !points ||
      points.length !==
        expectedLength
    ) {
      points =
        new Float32Array(
          expectedLength
        );

      cache.geometryByVariant.set(
        normalizedVariant,
        points
      );
    }

    return points;
  }

  createSprite(
    family,
    variantIndex,
    emotion
  ) {
    const canvas =
      document.createElement(
        "canvas"
      );

    canvas.width =
      this.spriteSize;

    canvas.height =
      this.spriteSize;

    const ctx =
      canvas.getContext(
        "2d",
        {
          alpha: true
        }
      );

    ctx.imageSmoothingEnabled =
      false;

    const sprite = {
      canvas,
      ctx
    };

    this.sprites.set(
      `${family}:${variantIndex}:${emotion}`,
      sprite
    );

    return sprite;
  }

  getSprite(
    family,
    variantIndex,
    emotion
  ) {
    const normalizedFamily =
      this.normalizeFamily(
        family
      );

    const normalizedVariant =
      this.normalizeVariantIndex(
        variantIndex
      );

    const key =
      `${normalizedFamily}:${normalizedVariant}:${emotion}`;

    return (
      this.sprites.get(
        key
      ) ??
      this.createSprite(
        normalizedFamily,
        normalizedVariant,
        emotion
      )
    );
  }

  update(
    deltaMs
  ) {
    this.rebuildStorage();

    for (
      const family
      of FAMILY_KEYS
    ) {
      const loopDurationMs =
        this.getLoopDurationMs(
          family
        );

      const familyState =
        this.familyState[
          family
        ];

      familyState.elapsedMs =
        (
          familyState.elapsedMs +
          Math.max(
            0,
            deltaMs
          )
        ) %
        loopDurationMs;

      familyState.time =
        (
          familyState.elapsedMs /
          loopDurationMs
        ) *
        this.getLoopTimeRange(
          family
        );
    }

    if (
      this.activeSpriteKeys.size ===
      0
    ) {
      return;
    }

    for (
      const [
        family,
        variantSet
      ]
      of this
        .activeVariantsByFamily
    ) {
      for (
        const variantIndex
        of variantSet
      ) {
        this.calculateGeometry(
          family,
          variantIndex
        );
      }
    }

    for (
      const spriteKey
      of this.activeSpriteKeys
    ) {
      const [
        family,
        variantString,
        emotion
      ] =
        spriteKey.split(
          ":"
        );

      this.renderSprite(
        family,
        Number(
          variantString
        ),
        emotion
      );
    }
  }

  calculateGeometry(
    family,
    variantIndex
  ) {
    const normalizedFamily =
      this.normalizeFamily(
        family
      );

    const normalizedVariant =
      this.normalizeVariantIndex(
        variantIndex
      );

    const cache =
      this.ensureFamilyCache(
        normalizedFamily
      );

    const points =
      this.getVariantGeometry(
        normalizedFamily,
        normalizedVariant
      );

    const loopRange =
      this.getLoopTimeRange(
        normalizedFamily
      );

    const t =
      (
        this.familyState[
          normalizedFamily
        ].time +
        this.getLoopPhaseOffset(
          normalizedFamily,
          normalizedVariant
        )
      ) %
      loopRange;

    for (
      let sample = 0;
      sample <
      cache.sampleCount;
      sample += 1
    ) {
      const [
        x,
        y
      ] =
        normalizedFamily ===
        FAMILY_BETA
          ? this.sampleBetaPoint(
              cache,
              sample,
              t
            )
          : this.sampleAlphaPoint(
              cache,
              sample,
              t
            );

      points[
        sample * 2
      ] = x;

      points[
        sample * 2 + 1
      ] = y;
    }
  }

  renderSprite(
    family,
    variantIndex,
    emotion
  ) {
    const normalizedFamily =
      this.normalizeFamily(
        family
      );

    const sprite =
      this.getSprite(
        normalizedFamily,
        variantIndex,
        emotion
      );

    const points =
      this.getVariantGeometry(
        normalizedFamily,
        variantIndex
      );

    const cache =
      this.ensureFamilyCache(
        normalizedFamily
      );

    const {
      ctx
    } = sprite;

    const size =
      this.spriteSize;

    ctx.clearRect(
      0,
      0,
      size,
      size
    );

    ctx.fillStyle =
      EMOTION_COLORS[
        emotion
      ] ??
      "#ffffff";

    ctx.globalAlpha =
      normalizedFamily ===
      FAMILY_BETA
        ? BETA_REFERENCE_ALPHA
        : 0.60;

    const formWidth =
      cache.bounds.maxX -
      cache.bounds.minX;

    const formHeight =
      cache.bounds.maxY -
      cache.bounds.minY;

    const fillRatio =
      normalizedFamily ===
      FAMILY_BETA
        ? Math.max(
            0.70,
            Math.min(
              1.10,
              Number(
                this.config
                  .aquariumCreatureBetaSpriteFill
              ) || 1.0
            )
          )
        : 0.88;

    const scale =
      Math.min(
        size / formWidth,
        size / formHeight
      ) *
      fillRatio;

    const centerX =
      (
        cache.bounds.minX +
        cache.bounds.maxX
      ) /
      2;

    const centerY =
      (
        cache.bounds.minY +
        cache.bounds.maxY
      ) /
      2;

    const offsetX =
      size * 0.5 -
      centerX * scale;

    const offsetY =
      size * 0.5 -
      centerY * scale;

    const pointSize =
      normalizedFamily ===
        FAMILY_BETA
        ? 1.05 *
          Math.max(
            1,
            Number(
              this.config
                .aquariumCreatureBetaPointSizeMultiplier
            ) || 1.0
          )
        : 1.15;

    for (
      let sample = 0;
      sample <
      cache.sampleCount;
      sample += 1
    ) {
      const x =
        offsetX +
        points[
          sample * 2
        ] *
        scale;

      const y =
        offsetY +
        points[
          sample * 2 + 1
        ] *
        scale;

      ctx.fillRect(
        x,
        y,
        pointSize,
        pointSize
      );
    }

    ctx.globalAlpha = 1;
  }

  draw(
    ctx,
    creature
  ) {
    const family =
      this.normalizeFamily(
        creature.shapeFamily
      );

    const sprite =
      this.getSprite(
        family,
        creature.variantIndex,
        creature.emotion
      );

    const size =
      creature.size;

    ctx.save();

    ctx.translate(
      creature.x,
      creature.renderY
    );

    ctx.rotate(
      creature.rotation
    );

    ctx.scale(
      creature.squashX,
      creature.squashY
    );

    ctx.globalAlpha =
      creature.alpha *
      0.14;

    ctx.drawImage(
      sprite.canvas,
      -size * 0.55,
      -size * 0.55,
      size * 1.10,
      size * 1.10
    );

    ctx.globalAlpha =
      creature.alpha;

    ctx.drawImage(
      sprite.canvas,
      -size * 0.5,
      -size * 0.5,
      size,
      size
    );

    ctx.restore();
  }
}
