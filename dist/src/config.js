export const STORAGE_KEYS = {
  panel:
    "ascii-ocean-mobile-debug-panel-open"
};

const GAME_CONFIG_URL =
  new URL(
    "../game-config.json",
    import.meta.url
  );

const REQUIRED_NUMERIC_KEYS = [
  "coralVerticalSpacing",
  "coralHorizontalSpacing",
  "coralHeight",
  "algaeHeight",
  "animationIntensity",
  "bucketScale",
  "bucketLoadingRows",
  "bucketDrainSpeedMultiplier",
  "bucketBounceCells",
  "bucketLoadingSlotDurationMs",
  "bucketFillSpeedMultiplier",
  "bucketFillSpeedAtRows4Multiplier",
  "bucketFillSpeedAtRows7Multiplier",
  "bucketFillSpeedAtRows10Multiplier",
  "attentionValuePerCell",
  "appetiteMultiplier",
  "onboardingSwipesToBucket2",
  "gachaUnlockBucketRows",
  "gachaJoyChancePct",
  "gachaRageChancePct",
  "gachaFearChancePct",
  "gachaGriefChancePct",
  "specialCellDrainDurationMultiplier",
  "nervousBufferDecayPerSecond",
  "nervousBufferBaseTarget",
  "nervousBufferScoresPerTargetTier",
  "nervousBufferTargetStep",
  "gachaAdaptiveOwnBoostPctPerScore",
  "gachaAdaptiveOppositeBoostPctPerScore",
  "gachaAdaptiveSaturationScore",
  "gachaAdaptiveEmotionChanceCapPct",
  "aquariumBaseWordsPerMinute",
  "aquariumScoreExponent",
  "aquariumMaxWords",
  "aquariumWordSpeedCellsPerSecond",
  "aquariumMinDepthRatio",
  "aquariumMaxDepthRatio",
  "aquariumCreaturePointSamples",
  "aquariumCreatureShapeIndex",
  "aquariumCreatureMorphFps",
  "aquariumCreatureSpriteSize",
  "aquariumCreatureSizeViewportRatio",
  "aquariumCreatureSwimSpeedCellsPerSecond",
  "aquariumCreatureTurnSpeed",
  "aquariumCreatureHeadingChangeSecondsMin",
  "aquariumCreatureHeadingChangeSecondsMax",
  "aquariumCreatureMaxHeadingChangeRadians",
  "aquariumCreatureAlpha"
];

export const CONTROL_DEFINITIONS =
  Object.freeze({
    bucketLoadingRows: {
      label:
        "Tamanho do balde",
      inputType: "number",
      min: 1,
      max: 10,
      step: 1,
      suffix: " linhas",
      structural: false,
      affectsOcean: false
    },
    bucketFillSpeedMultiplier: {
      label:
        "Velocidade enchimento (balde 1-3)",
      inputType: "number",
      min: 0.25,
      max: 20,
      step: 0.25,
      suffix: "x",
      structural: false,
      affectsOcean: false
    },
    bucketDrainSpeedMultiplier: {
      label:
        "Velocidade de esvaziamento",
      min: 0.5,
      max: 16,
      step: 0.25,
      suffix: "x",
      structural: false,
      affectsOcean: false
    },
    attentionValuePerCell: {
      label:
        "Attention por célula",
      inputType: "number",
      min: 1,
      max: 9999,
      step: 1,
      suffix: " pts",
      structural: false,
      affectsOcean: false
    },
    appetiteMultiplier: {
      label:
        "Multiplicador de Apetite",
      inputType: "number",
      min: 1,
      max: 999999,
      step: 1,
      suffix: "x",
      structural: false,
      affectsOcean: false
    },
    gachaJoyChancePct: {
      label:
        "Chance JOY",
      inputType: "number",
      min: 0,
      max: 100,
      step: 0.5,
      suffix: "%",
      structural: false,
      affectsOcean: false
    },
    gachaRageChancePct: {
      label:
        "Chance RAGE",
      inputType: "number",
      min: 0,
      max: 100,
      step: 0.5,
      suffix: "%",
      structural: false,
      affectsOcean: false
    },
    gachaFearChancePct: {
      label:
        "Chance FEAR",
      inputType: "number",
      min: 0,
      max: 100,
      step: 0.5,
      suffix: "%",
      structural: false,
      affectsOcean: false
    },
    gachaGriefChancePct: {
      label:
        "Chance GRIEF",
      inputType: "number",
      min: 0,
      max: 100,
      step: 0.5,
      suffix: "%",
      structural: false,
      affectsOcean: false
    },
    specialCellDrainDurationMultiplier: {
      label:
        "Duração célula especial",
      min: 1,
      max: 12,
      step: 0.25,
      suffix: "x",
      structural: false,
      affectsOcean: false
    },
    nervousBufferDecayPerSecond: {
      label:
        "Decaimento nervous buffer",
      inputType: "number",
      min: 0,
      max: 5,
      step: 0.001,
      suffix: " pts/s",
      structural: false,
      affectsOcean: false
    },
    aquariumCreatureSizeViewportRatio: {
      label:
        "Tamanho das creatures",
      inputType: "number",
      min: 0.08,
      max: 1.20,
      step: 0.01,
      suffix: " view",
      structural: false,
      affectsOcean: false
    }
  });

function validateConfig(
  rawConfig
) {
  if (
    !rawConfig ||
    typeof rawConfig !== "object"
  ) {
    throw new Error(
      "game-config.json precisa conter um objeto JSON."
    );
  }

  const config = {};

  for (
    const key
    of REQUIRED_NUMERIC_KEYS
  ) {
    const value =
      Number(
        rawConfig[key]
      );

    if (
      !Number.isFinite(value)
    ) {
      throw new Error(
        `Config inválida: "${key}" precisa ser numérico.`
      );
    }

    config[key] =
      value;
  }

  // Valores discretos que representam unidades inteiras.
  config.bucketLoadingRows =
    Math.max(
      1,
      Math.min(
        10,
        Math.round(
          config.bucketLoadingRows
        )
      )
    );

  config.attentionValuePerCell =
    Math.max(
      1,
      Math.round(
        config.attentionValuePerCell
      )
    );

  config.appetiteMultiplier =
    Math.max(
      1,
      Math.round(
        config.appetiteMultiplier
      )
    );

  config.onboardingSwipesToBucket2 =
    Math.max(
      1,
      Math.round(
        config.onboardingSwipesToBucket2
      )
    );

  config.gachaUnlockBucketRows =
    Math.max(
      1,
      Math.min(
        10,
        Math.round(
          config.gachaUnlockBucketRows
        )
      )
    );

  for (
    const chanceKey
    of [
      "gachaJoyChancePct",
      "gachaRageChancePct",
      "gachaFearChancePct",
      "gachaGriefChancePct"
    ]
  ) {
    config[chanceKey] =
      Math.max(
        0,
        Math.min(
          100,
          Number(
            config[chanceKey]
          )
        )
      );
  }

  config.specialCellDrainDurationMultiplier =
    Math.max(
      1,
      Number(
        config
          .specialCellDrainDurationMultiplier
      )
    );

  config.bucketFillSpeedMultiplier =
    Math.max(
      0.01,
      Number(
        config
          .bucketFillSpeedMultiplier
      )
    );

  config.bucketFillSpeedAtRows4Multiplier =
    Math.max(
      0.01,
      Number(
        config
          .bucketFillSpeedAtRows4Multiplier
      )
    );

  config.bucketFillSpeedAtRows7Multiplier =
    Math.max(
      0.01,
      Number(
        config
          .bucketFillSpeedAtRows7Multiplier
      )
    );

  config.bucketFillSpeedAtRows10Multiplier =
    Math.max(
      0.01,
      Number(
        config
          .bucketFillSpeedAtRows10Multiplier
      )
    );

  config.nervousBufferDecayPerSecond =
    Math.max(
      0,
      Number(
        config
          .nervousBufferDecayPerSecond
      )
    );

  config.nervousBufferBaseTarget =
    Math.max(
      1,
      Number(
        config.nervousBufferBaseTarget
      )
    );

  config.nervousBufferScoresPerTargetTier =
    Math.max(
      1,
      Math.round(
        Number(
          config
            .nervousBufferScoresPerTargetTier
        )
      )
    );

  config.nervousBufferTargetStep =
    Math.max(
      1,
      Number(
        config.nervousBufferTargetStep
      )
    );

  config.gachaAdaptiveOwnBoostPctPerScore =
    Math.max(
      0,
      Number(
        config
          .gachaAdaptiveOwnBoostPctPerScore
      )
    );

  config.gachaAdaptiveOppositeBoostPctPerScore =
    Math.max(
      0,
      Number(
        config
          .gachaAdaptiveOppositeBoostPctPerScore
      )
    );

  config.gachaAdaptiveSaturationScore =
    Math.max(
      0.01,
      Number(
        config
          .gachaAdaptiveSaturationScore
      )
    );

  config.gachaAdaptiveEmotionChanceCapPct =
    Math.max(
      0,
      Math.min(
        100,
        Number(
          config
            .gachaAdaptiveEmotionChanceCapPct
        )
      )
    );

  config.aquariumBaseWordsPerMinute =
    Math.max(
      0,
      Number(
        config.aquariumBaseWordsPerMinute
      )
    );

  config.aquariumScoreExponent =
    Math.max(
      0.01,
      Number(
        config.aquariumScoreExponent
      )
    );

  config.aquariumMaxWords =
    Math.max(
      1,
      Math.round(
        Number(
          config.aquariumMaxWords
        )
      )
    );

  config.aquariumWordSpeedCellsPerSecond =
    Math.max(
      0.05,
      Number(
        config
          .aquariumWordSpeedCellsPerSecond
      )
    );

  config.aquariumMinDepthRatio =
    Math.max(
      0,
      Math.min(
        1,
        Number(
          config.aquariumMinDepthRatio
        )
      )
    );

  config.aquariumMaxDepthRatio =
    Math.max(
      config.aquariumMinDepthRatio,
      Math.min(
        1,
        Number(
          config.aquariumMaxDepthRatio
        )
      )
    );

  config.aquariumCreaturePointSamples =
    Math.max(
      200,
      Math.min(
        2000,
        Math.round(
          Number(
            config
              .aquariumCreaturePointSamples
          )
        )
      )
    );

  config.aquariumCreatureShapeIndex =
    Math.max(
      0,
      Math.min(
        15,
        Math.round(
          Number(
            config
              .aquariumCreatureShapeIndex
          )
        )
      )
    );

  config.aquariumCreatureMorphFps =
    Math.max(
      4,
      Math.min(
        30,
        Number(
          config
            .aquariumCreatureMorphFps
        )
      )
    );

  config.aquariumCreatureSpriteSize =
    Math.max(
      64,
      Math.min(
        256,
        Math.round(
          Number(
            config
              .aquariumCreatureSpriteSize
          )
        )
      )
    );

  config.aquariumCreatureSizeViewportRatio =
    Math.max(
      0.06,
      Math.min(
        1.20,
        Number(
          config
            .aquariumCreatureSizeViewportRatio
        )
      )
    );

  config.aquariumCreatureSwimSpeedCellsPerSecond =
    Math.max(
      0.05,
      Number(
        config
          .aquariumCreatureSwimSpeedCellsPerSecond
      )
    );

  config.aquariumCreatureTurnSpeed =
    Math.max(
      0.01,
      Number(
        config
          .aquariumCreatureTurnSpeed
      )
    );

  config.aquariumCreatureHeadingChangeSecondsMin =
    Math.max(
      0.25,
      Number(
        config
          .aquariumCreatureHeadingChangeSecondsMin
      )
    );

  config.aquariumCreatureHeadingChangeSecondsMax =
    Math.max(
      config.aquariumCreatureHeadingChangeSecondsMin,
      Number(
        config
          .aquariumCreatureHeadingChangeSecondsMax
      )
    );

  config.aquariumCreatureMaxHeadingChangeRadians =
    Math.max(
      0.05,
      Math.min(
        Math.PI,
        Number(
          config
            .aquariumCreatureMaxHeadingChangeRadians
        )
      )
    );

  config.aquariumCreatureAlpha =
    Math.max(
      0.05,
      Math.min(
        1,
        Number(
          config
            .aquariumCreatureAlpha
        )
      )
    );

  return config;
}

export async function loadConfig() {
  const response =
    await fetch(
      GAME_CONFIG_URL,
      {
        cache: "no-store"
      }
    );

  if (
    !response.ok
  ) {
    throw new Error(
      `Não foi possível carregar game-config.json (${response.status}).`
    );
  }

  return validateConfig(
    await response.json()
  );
}
