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
  "attentionValuePerCell",
  "appetiteMultiplier",
  "gachaJoyChancePct",
  "gachaRageChancePct",
  "gachaFearChancePct",
  "gachaGriefChancePct",
  "specialCellDrainDurationMultiplier",
  "nervousBufferDecayPerSecond"
];

export const CONTROL_DEFINITIONS =
  Object.freeze({
    bucketLoadingRows: {
      label:
        "Tamanho do balde",
      inputType: "number",
      min: 1,
      max: 30,
      step: 1,
      suffix: " linhas",
      structural: false,
      affectsOcean: false
    },
    bucketFillSpeedMultiplier: {
      label:
        "Velocidade de enchimento",
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
      Math.round(
        config.bucketLoadingRows
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

  config.nervousBufferDecayPerSecond =
    Math.max(
      0,
      Number(
        config
          .nervousBufferDecayPerSecond
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
