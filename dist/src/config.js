export const STORAGE_KEYS = {
  config: "ascii-ocean-mobile-config-v5",
  panel: "ascii-ocean-mobile-debug-panel-open"
};

export const DEFAULT_CONFIG = Object.freeze({
  coralVerticalSpacing: 1,
  coralHorizontalSpacing: 1,
  coralHeight: 35,
  algaeHeight: 60,
  animationIntensity: 150,
  bucketScale: 1,
  bucketDrainSpeedMultiplier: 12,
  bucketBounceCells: 1.6,
  // Cada segmento individual das três barras do balde leva este tempo.
  // Mantido fora do menu de debug por enquanto, mas centralizado aqui para
  // calibração futura.
  bucketLoadingSlotDurationMs: 1000
});

export const CONTROL_DEFINITIONS = Object.freeze({
  coralVerticalSpacing: {
    label: "Distância vertical do coral",
    min: 0.25,
    max: 6,
    step: 0.25,
    suffix: " cel",
    structural: true
  },
  coralHorizontalSpacing: {
    label: "Distância horizontal do coral",
    min: 0.25,
    max: 8,
    step: 0.25,
    suffix: " cel",
    structural: true
  },
  coralHeight: {
    label: "Altura máxima dos corais",
    min: 10,
    max: 65,
    step: 1,
    suffix: "%",
    structural: true
  },
  algaeHeight: {
    label: "Altura máxima das algas",
    min: 15,
    max: 80,
    step: 1,
    suffix: "%",
    structural: true
  },
  bucketDrainSpeedMultiplier: {
    label: "Velocidade de esvaziamento",
    min: 0.5,
    max: 16,
    step: 0.25,
    suffix: "x",
    structural: false,
    affectsOcean: false
  },
  bucketBounceCells: {
    label: "Elasticidade do balde",
    min: 0,
    max: 2.5,
    step: 0.1,
    suffix: " cel",
    structural: false,
    affectsOcean: false
  }
});

export function loadConfig() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.config) || "{}");
    return {
      ...DEFAULT_CONFIG,
      ...Object.fromEntries(
        Object.keys(DEFAULT_CONFIG).map((key) => {
          const numericValue = Number(stored[key]);
          return [
            key,
            Number.isFinite(numericValue)
              ? numericValue
              : DEFAULT_CONFIG[key]
          ];
        })
      )
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config) {
  try {
    localStorage.setItem(
      STORAGE_KEYS.config,
      JSON.stringify(config)
    );
  } catch {
    // O app continua funcionando se o storage estiver indisponível.
  }
}
