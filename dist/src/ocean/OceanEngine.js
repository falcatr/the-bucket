import {
  PALETTE,
  BRIGHT_COLORS,
  TERRAIN_GLYPHS,
  ROCK_GLYPHS,
  CORAL_FAMILIES,
  PLANT_GLYPHS,
  PLANT_TIPS,
  SEDIMENT_GLYPHS,
  SMALL_FISH_GLYPHS,
  LARGE_FISH_GLYPHS,
  BUBBLE_GLYPHS,
  REEF_CRAWLER_FORMS,
  REEF_MUTATION_FRAMES,
  isJapaneseGlyph
} from "./glyphs.js";
import { createRng, randomHelpers, randomSeed } from "../utils/random.js";

const NORMAL_FONT = '"Pixelify Sans", monospace';
const JAPANESE_FONT = '"DotGothic16", monospace';

const TARGET_COLUMNS = 42;
const CELL_HEIGHT_RATIO = 1.28;
const STEP_MS = 78;
const MAX_STATIC_GLYPHS = 7800;

export class OceanEngine {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.config = config;

    this.dpr = 1;
    this.width = 0;
    this.height = 0;
    this.cellW = 0;
    this.cellH = 0;
    this.cols = TARGET_COLUMNS;
    this.rows = 0;

    this.seed = randomSeed();
    this.rng = createRng(this.seed);
    this.random = randomHelpers(this.rng);

    this.terrain = [];
    this.plants = [];
    this.sediment = [];
    this.fish = [];
    this.bubbles = [];
    this.reefMutations = [];
    this.reefCrawlers = [];
    this.reefCrawlerBaseCount = 5;
    this.reefTopRow = 0;
    this.seabedTop = 0;
    this.maxReefHeight = 0;
    this.maxAlgaeHeight = 0;
    this.algaeTopRow = 0;

    this.staticLayer = document.createElement("canvas");
    this.staticCtx = this.staticLayer.getContext("2d");

    this.paused = false;
    this.lastFrame = performance.now();
    this.accumulator = 0;
    this.frameHandle = 0;
    this.resizeObserver = null;
  }

  start() {
    this.resize();
    this.regenerate(true, false);

    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
      this.regenerate(false, false);
    });

    this.resizeObserver.observe(this.canvas);
    this.frameHandle = requestAnimationFrame(this.loop.bind(this));
  }

  destroy() {
    cancelAnimationFrame(this.frameHandle);
    this.resizeObserver?.disconnect();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();

    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.imageSmoothingEnabled = false;

    this.cellW = this.width / TARGET_COLUMNS;
    this.cellH = this.cellW * CELL_HEIGHT_RATIO;
    this.cols = TARGET_COLUMNS;
    this.rows = Math.ceil(this.height / this.cellH) + 1;

    this.staticLayer.width = Math.round(this.width * this.dpr);
    this.staticLayer.height = Math.round(this.height * this.dpr);
    this.staticCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.staticCtx.textAlign = "center";
    this.staticCtx.textBaseline = "middle";
    this.staticCtx.imageSmoothingEnabled = false;
  }

  updateConfig(key, value) {
    this.config[key] = value;

    if (key === "animationIntensity") {
      this.syncFishPopulation();
      this.syncReefCrawlerPopulation();
      return;
    }

    this.rebuildCurrentVariation();
  }

  regenerate(useNewSeed = true, resize = false) {
    if (resize) this.resize();
    if (useNewSeed || !this.seed) this.seed = randomSeed();

    this.resetRng();
    this.generateTerrain();
    this.generateReefLife();
    this.generateFish();
    this.generateBubbles();
    this.paintStaticLayer();
  }

  rebuildCurrentVariation() {
    this.regenerate(false, false);
  }

  resetRng() {
    this.rng = createRng(this.seed);
    this.random = randomHelpers(this.rng);
  }

  generateTerrain() {
    const { rand, choose, chance } = this.random;

    this.terrain = [];
    this.plants = [];
    this.sediment = [];

    const maxReefHeight = Math.max(
      5,
      Math.round(
        this.rows * (this.config.coralHeight / 100)
      )
    );

    const maxAlgaeHeight = Math.max(
      6,
      Math.round(
        this.rows * (this.config.algaeHeight / 100)
      )
    );

    this.maxReefHeight = maxReefHeight;
    this.maxAlgaeHeight = maxAlgaeHeight;

    this.reefTopRow = Math.max(
      2,
      this.rows - maxReefHeight
    );

    this.algaeTopRow = Math.max(
      2,
      this.rows - maxAlgaeHeight
    );

    // A linha-base muda de seed para seed. Isso impede que todas as
    // gerações tenham o mesmo "horizonte" visual.
    this.seabedTop = Math.min(
      this.rows - 5,
      Math.max(
        Math.floor(this.rows * 0.68),
        Math.round(
          this.rows -
          maxReefHeight * rand(0.22, 0.38)
        )
      )
    );

    const hSpacing = Math.max(
      0.25,
      this.config.coralHorizontalSpacing
    );
    const vSpacing = Math.max(
      0.25,
      this.config.coralVerticalSpacing
    );

    // Cada seed recebe uma personalidade diferente. A proporção de
    // coral, alga, cascalho e largura muda sem permitir que as algas
    // dominem todas as gerações.
    const reefProfile = choose([
      {
        coral: 1.25,
        algae: 0.78,
        rubble: 0.90,
        width: 1.05
      },
      {
        coral: 1.05,
        algae: 0.92,
        rubble: 1.10,
        width: 1.20
      },
      {
        coral: 0.90,
        algae: 0.84,
        rubble: 1.25,
        width: 0.86
      },
      {
        coral: 1.18,
        algae: 0.70,
        rubble: 0.76,
        width: 1.38
      }
    ]);

    // Fundo/cascalho irregular.
    const baseDensity =
      rand(0.28, 0.43) * reefProfile.rubble;

    for (
      let y = this.seabedTop;
      y < this.rows + 2;
      y += vSpacing
    ) {
      const depth =
        (y - this.seabedTop) /
        Math.max(1, this.rows - this.seabedTop);

      for (
        let x = 0;
        x < this.cols;
        x += hSpacing
      ) {
        const wave =
          0.82 +
          Math.sin(
            x * 0.31 + this.seed * 0.000001
          ) * 0.16;

        const density = Math.max(
          0.08,
          baseDensity * wave - depth * 0.10
        );

        if (!chance(density)) continue;

        this.pushTerrain({
          x,
          y,
          glyph: choose(TERRAIN_GLYPHS),
          color: this.pickTerrainColor(),
          alpha: rand(0.31, 0.72)
        });
      }
    }

    const spacingFactor = Math.max(
      0.75,
      Math.sqrt(hSpacing)
    );

    const formationCount = Math.max(
      6,
      Math.round(
        rand(8, 14) *
        reefProfile.coral /
        spacingFactor
      )
    );

    for (
      let index = 0;
      index < formationCount;
      index += 1
    ) {
      const heightRoll = rand(0, 1);

      const normalizedHeight =
        heightRoll < 0.18
          ? rand(0.72, 1.0)
          : heightRoll < 0.56
            ? rand(0.38, 0.74)
            : rand(0.10, 0.39);

      const type = choose([
        "pillar",
        "mound",
        "fan",
        "shelf"
      ]);

      const typeWidthMultiplier =
        type === "mound"
          ? 1.25
          : type === "fan"
            ? 1.12
            : type === "shelf"
              ? 1.38
              : 0.72;

      this.generateCoralFormation({
        type,
        centerX: rand(
          0.5,
          this.cols - 0.5
        ),
        height: Math.max(
          2,
          maxReefHeight * normalizedHeight
        ),
        width:
          rand(0.9, 3.9) *
          reefProfile.width *
          typeWidthMultiplier,
        hSpacing,
        vSpacing,
        family: choose(CORAL_FAMILIES)
      });
    }

    // Algas como complemento do coral. A maior parte é baixa/média,
    // enquanto algas muito altas ficam raras.
    const algaeCount = Math.max(
      6,
      Math.round(
        rand(8, 15) *
        reefProfile.algae /
        spacingFactor
      )
    );

    for (
      let index = 0;
      index < algaeCount;
      index += 1
    ) {
      this.generateAlgae({
        baseX: rand(
          0.5,
          this.cols - 0.5
        ),
        hSpacing,
        vSpacing,
        maxAlgaeHeight
      });
    }

    const sedimentCount = Math.floor(
      this.cols *
      this.rows *
      rand(0.012, 0.021)
    );

    for (
      let index = 0;
      index < sedimentCount;
      index += 1
    ) {
      this.sediment.push({
        x: rand(0, this.cols),
        y: rand(
          this.rows * 0.08,
          this.seabedTop + 1
        ),
        glyph: choose(SEDIMENT_GLYPHS),
        color: chance(0.78)
          ? PALETTE.shadow
          : PALETTE.blue,
        alpha: rand(0.14, 0.40),
        drift: rand(-0.012, 0.012),
        phase: rand(0, Math.PI * 2)
      });
    }
  }

  generateCoralFormation({
    type,
    centerX,
    height,
    width,
    hSpacing,
    vSpacing,
    family
  }) {
    const {
      rand,
      choose,
      chance
    } = this.random;

    const steps = Math.max(
      1,
      Math.floor(height / vSpacing)
    );

    const primaryColor =
      this.pickTerrainColor();

    const secondaryColor =
      chance(0.42)
        ? this.pickTerrainColor()
        : primaryColor;

    const lean = rand(-0.75, 0.75);
    const phase = rand(
      0,
      Math.PI * 2
    );

    for (
      let step = 0;
      step <= steps;
      step += 1
    ) {
      const progress =
        step / Math.max(1, steps);

      const y =
        this.seabedTop -
        step * vSpacing;

      if (y < this.reefTopRow) break;

      let halfWidth =
        width * 0.25;

      let rowDensity = 0.66;

      if (type === "pillar") {
        halfWidth =
          width *
          (
            0.20 +
            Math.sin(progress * Math.PI) *
            0.18
          );

        rowDensity = 0.72;
      } else if (type === "mound") {
        halfWidth =
          width *
          (
            0.18 +
            Math.pow(
              1 - progress,
              0.62
            ) *
            0.82
          );

        rowDensity = 0.60;
      } else if (type === "fan") {
        halfWidth =
          width *
          (
            0.15 +
            progress * 0.86
          );

        rowDensity =
          0.55 +
          progress * 0.12;
      } else if (type === "shelf") {
        const ledge =
          Math.abs(progress - 0.28) < 0.07 ||
          Math.abs(progress - 0.55) < 0.065 ||
          Math.abs(progress - 0.78) < 0.055;

        halfWidth =
          ledge
            ? width
            : width * 0.18;

        rowDensity =
          ledge
            ? 0.82
            : 0.67;
      }

      const centerShift =
        lean * progress +
        Math.sin(
          progress *
          Math.PI *
          1.6 +
          phase
        ) *
        width *
        0.12;

      for (
        let offset = -halfWidth;
        offset <= halfWidth;
        offset += hSpacing
      ) {
        if (!chance(rowDensity)) {
          continue;
        }

        const edgeRatio =
          Math.abs(offset) /
          Math.max(
            0.001,
            halfWidth
          );

        if (
          edgeRatio > 0.72 &&
          !chance(0.58)
        ) {
          continue;
        }

        const accent =
          chance(0.16);

        const glyph =
          accent
            ? choose(family.accent)
            : choose(family.body);

        this.pushTerrain({
          x:
            centerX +
            centerShift +
            offset,
          y,
          glyph,
          color:
            chance(0.78)
              ? primaryColor
              : secondaryColor,
          alpha: rand(
            0.45,
            0.88
          )
        });
      }

      if (
        chance(
          type === "fan"
            ? 0.32
            : 0.17
        )
      ) {
        const side =
          choose([-1, 1]);

        this.pushTerrain({
          x:
            centerX +
            centerShift +
            side *
            halfWidth *
            rand(0.65, 1.15),
          y:
            y +
            vSpacing *
            rand(-0.25, 0.25),
          glyph:
            choose(family.accent),
          color:
            secondaryColor,
          alpha:
            rand(0.45, 0.82)
        });
      }
    }
  }

  generateAlgae({
    baseX,
    hSpacing,
    vSpacing,
    maxAlgaeHeight
  }) {
    const {
      rand,
      randInt,
      choose,
      chance
    } = this.random;

    const heightRoll = rand(
      0,
      1
    );

    const normalizedHeight =
      heightRoll < 0.16
        ? rand(0.58, 1.0)
        : heightRoll < 0.58
          ? rand(0.28, 0.62)
          : rand(0.08, 0.34);

    const strandCount =
      chance(0.25)
        ? randInt(2, 3)
        : 1;

    const color =
      chance(0.64)
        ? PALETTE.green
        : choose([
            PALETTE.cyan,
            PALETTE.blue,
            PALETTE.magenta
          ]);

    for (
      let strand = 0;
      strand < strandCount;
      strand += 1
    ) {
      const strandHeight =
        maxAlgaeHeight *
        normalizedHeight *
        rand(0.76, 1.10);

      const steps = Math.max(
        1,
        Math.floor(
          strandHeight /
          vSpacing
        )
      );

      const strandX =
        baseX +
        (
          strand -
          (strandCount - 1) / 2
        ) *
        hSpacing *
        rand(0.55, 1.05);

      const lean =
        choose([-1, 0, 0, 1]) *
        rand(0.20, 0.75);

      const phase =
        rand(
          0,
          Math.PI * 2
        );

      const sway =
        rand(
          0.12,
          normalizedHeight > 0.5
            ? 0.72
            : 0.48
        );

      for (
        let step = 0;
        step < steps;
        step += 1
      ) {
        const progress =
          step /
          Math.max(
            1,
            steps - 1
          );

        const y =
          this.seabedTop -
          step * vSpacing;

        if (
          y < this.algaeTopRow
        ) {
          break;
        }

        if (
          step > 1 &&
          step < steps - 1 &&
          chance(0.10)
        ) {
          continue;
        }

        this.plants.push({
          x:
            strandX +
            lean *
            progress *
            hSpacing,
          y,
          glyph:
            step === steps - 1
              ? choose(PLANT_TIPS)
              : choose(PLANT_GLYPHS),
          color,
          alpha:
            rand(0.48, 0.88),
          phase:
            phase +
            step * 0.16,
          sway:
            sway *
            (
              0.30 +
              progress * 0.90
            )
        });
      }
    }
  }

  generateReefLife() {
    const {
      rand,
      randInt,
      choose,
      chance
    } = this.random;

    this.reefMutations = [];
    this.reefCrawlers = [];

    const candidates =
      this.terrain.filter(
        (item) =>
          item.y >= this.reefTopRow &&
          item.y <= this.rows - 2 &&
          item.alpha >= 0.42
      );

    const mutationCount =
      Math.min(
        24,
        Math.max(
          4,
          Math.floor(
            candidates.length *
            rand(0.008, 0.018)
          )
        )
      );

    for (
      let index = 0;
      index < mutationCount &&
      candidates.length;
      index += 1
    ) {
      const source =
        choose(candidates);

      this.reefMutations.push({
        x: source.x,
        y: source.y,
        frames:
          choose(
            REEF_MUTATION_FRAMES
          ),
        color:
          chance(0.72)
            ? source.color
            : choose(
                BRIGHT_COLORS
              ),
        alpha:
          rand(0.18, 0.42),
        phase:
          rand(
            0,
            Math.PI * 2
          ),
        frameDuration:
          rand(520, 1250),
        twitch:
          rand(0.008, 0.045)
      });
    }

    this.reefCrawlerBaseCount =
      randInt(4, 8);

    this.syncReefCrawlerPopulation();
  }

  reefCrawlerTarget() {
    const intensity = Math.max(
      0,
      this.config.animationIntensity / 100
    );

    return Math.max(
      0,
      Math.round(
        this.reefCrawlerBaseCount *
        intensity
      )
    );
  }

  syncReefCrawlerPopulation() {
    const target =
      this.reefCrawlerTarget();

    while (
      this.reefCrawlers.length <
      target
    ) {
      this.reefCrawlers.push(
        this.makeReefCrawler()
      );
    }

    if (
      this.reefCrawlers.length >
      target
    ) {
      this.reefCrawlers.length =
        target;
    }
  }

  makeReefCrawler() {
    const {
      rand,
      choose,
      chance
    } = this.random;

    const dir =
      chance(0.5)
        ? 1
        : -1;

    const lower =
      Math.max(
        this.reefTopRow + 1,
        this.seabedTop -
        this.maxReefHeight * 0.68
      );

    const upper =
      Math.min(
        this.rows - 2,
        this.seabedTop +
        this.maxReefHeight * 0.28
      );

    return {
      x: rand(
        -5,
        this.cols + 5
      ),
      y: rand(
        lower,
        Math.max(
          lower + 0.5,
          upper
        )
      ),
      dir,
      frames:
        choose(
          REEF_CRAWLER_FORMS
        ),
      color:
        choose(
          BRIGHT_COLORS
        ),
      alpha:
        rand(0.48, 0.90),
      speed:
        rand(0.025, 0.085),
      phase:
        rand(
          0,
          Math.PI * 2
        ),
      frameDuration:
        rand(160, 390),
      bob:
        rand(0.04, 0.22),
      scale:
        rand(0.72, 0.92)
    };
  }

  resetReefCrawler(entity) {
    const fresh =
      this.makeReefCrawler();

    const dir =
      this.random.chance(0.5)
        ? 1
        : -1;

    Object.assign(
      entity,
      fresh,
      {
        dir,
        x:
          dir > 0
            ? this.random.rand(-5, -1)
            : this.random.rand(
                this.cols + 1,
                this.cols + 5
              )
      }
    );
  }

  pushTerrain(item) {
    if (this.terrain.length < MAX_STATIC_GLYPHS) this.terrain.push(item);
  }

  pickTerrainColor() {
    const { rand, choose } = this.random;
    const roll = rand(0, 1);
    if (roll < 0.24) return PALETTE.green;
    if (roll < 0.38) return PALETTE.cyan;
    if (roll < 0.49) return PALETTE.magenta;
    if (roll < 0.57) return PALETTE.red;
    if (roll < 0.64) return PALETTE.yellow;
    if (roll < 0.76) return PALETTE.blue;
    return choose([PALETTE.shadow, PALETTE.deep]);
  }

  generateFish() {
    this.fish = [];
    this.syncFishPopulation();
  }

  fishTargets() {
    const scale = this.config.animationIntensity / 100;
    const baseSmallCount = Math.max(11, Math.floor((this.cols * this.rows) / 145));
    const baseLargeCount = Math.max(3, Math.floor((this.cols * this.rows) / 760));
    return {
      small: Math.max(0, Math.round(baseSmallCount * scale)),
      large: Math.max(0, Math.round(baseLargeCount * scale))
    };
  }

  syncFishPopulation() {
    const targets = this.fishTargets();
    let small = this.fish.filter((entity) => !entity.isLarge);
    let large = this.fish.filter((entity) => entity.isLarge);

    while (small.length < targets.small) {
      const entity = this.makeFish(false);
      this.fish.push(entity);
      small.push(entity);
    }
    while (large.length < targets.large) {
      const entity = this.makeFish(true);
      this.fish.push(entity);
      large.push(entity);
    }

    if (small.length > targets.small) {
      const remove = new Set(small.slice(targets.small));
      this.fish = this.fish.filter((entity) => !remove.has(entity));
    }

    large = this.fish.filter((entity) => entity.isLarge);
    if (large.length > targets.large) {
      const remove = new Set(large.slice(targets.large));
      this.fish = this.fish.filter((entity) => !remove.has(entity));
    }
  }

  makeFish(isLarge) {
    const { rand, choose, chance, randInt } = this.random;
    return {
      x: rand(-8, this.cols + 8),
      y: rand(this.rows * 0.11, this.rows * 0.68),
      dir: chance(0.5) ? 1 : -1,
      baseSpeed: isLarge ? rand(0.075, 0.20) : rand(0.11, 0.34),
      glyph: isLarge ? choose(LARGE_FISH_GLYPHS) : choose(SMALL_FISH_GLYPHS),
      color: choose(BRIGHT_COLORS),
      alpha: isLarge ? rand(0.72, 1) : rand(0.58, 1),
      isLarge,
      phase: rand(0, Math.PI * 2),
      frequency: rand(0.035, 0.085),
      amplitude: isLarge ? rand(0.16, 0.58) : rand(0.12, 0.92),
      depth: rand(0.15, 0.78),
      echo: chance(0.62),
      jitterTimer: randInt(5, 20)
    };
  }

  resetFish(entity) {
    const { rand, choose, chance, randInt } = this.random;
    entity.dir = chance(0.5) ? 1 : -1;
    entity.x = entity.dir > 0 ? rand(-8, -2) : rand(this.cols + 2, this.cols + 8);
    entity.y = rand(this.rows * 0.11, this.rows * 0.68);
    entity.phase = rand(0, Math.PI * 2);
    entity.color = choose(BRIGHT_COLORS);
    entity.alpha = entity.isLarge ? rand(0.72, 1) : rand(0.55, 1);
    entity.glyph = entity.isLarge ? choose(LARGE_FISH_GLYPHS) : choose(SMALL_FISH_GLYPHS);
    entity.baseSpeed = entity.isLarge ? rand(0.075, 0.20) : rand(0.11, 0.34);
    entity.jitterTimer = randInt(5, 20);
  }

  generateBubbles() {
    this.bubbles = [];
    const count = Math.max(17, Math.floor((this.cols * this.rows) / 112));
    for (let i = 0; i < count; i += 1) this.bubbles.push(this.makeBubble(true));
  }

  makeBubble(randomizedStart = false) {
    const { rand, randInt, choose, chance } = this.random;
    const life = randInt(48, 125);
    return {
      x: rand(1, this.cols - 2),
      y: randomizedStart
        ? rand(this.rows * 0.18, this.rows * 0.91)
        : rand(this.rows * 0.66, this.rows * 0.93),
      speed: rand(0.075, 0.22),
      sway: rand(0.08, 0.52),
      phase: rand(0, Math.PI * 2),
      age: randomizedStart ? randInt(0, life - 1) : 0,
      life,
      color: chance(0.78)
        ? PALETTE.paleCyan
        : choose([PALETTE.cyan, PALETTE.blue, PALETTE.white]),
      alpha: rand(0.42, 0.90)
    };
  }

  paintStaticLayer() {
    const ctx = this.staticCtx;
    ctx.clearRect(0, 0, this.width, this.height);

    const gradient = ctx.createRadialGradient(
      this.width * 0.5,
      this.height * 0.18,
      0,
      this.width * 0.5,
      this.height * 0.56,
      Math.max(this.width, this.height) * 0.78
    );
    gradient.addColorStop(0, "#0827c9");
    gradient.addColorStop(0.52, PALETTE.background);
    gradient.addColorStop(1, "#020a58");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    for (const item of this.terrain) {
      this.drawStringToContext(ctx, item.glyph, item.x, item.y, item.color, item.alpha, 0.92);
    }
  }

  update() {
    const intensity = this.config.animationIntensity / 100;

    for (const particle of this.sediment) {
      particle.x += particle.drift * Math.max(0.2, intensity);
      if (particle.x < -1) particle.x = this.cols + 1;
      if (particle.x > this.cols + 1) particle.x = -1;
    }

    for (const entity of this.fish) {
      entity.x += entity.baseSpeed * intensity * entity.dir;
      entity.phase += entity.frequency * intensity;
      entity.jitterTimer -= intensity;

      if (intensity > 0 && entity.jitterTimer <= 0) {
        entity.y += this.random.choose([-0.4, 0, 0, 0.4]);
        entity.jitterTimer = this.random.randInt(5, 20);
      }

      if (
        (entity.dir > 0 && entity.x > this.cols + 10) ||
        (entity.dir < 0 && entity.x < -10)
      ) {
        this.resetFish(entity);
      }
    }

    for (const crawler of this.reefCrawlers) {
      crawler.x +=
        crawler.speed *
        intensity *
        crawler.dir;

      crawler.phase +=
        0.035 *
        intensity;

      if (
        (
          crawler.dir > 0 &&
          crawler.x > this.cols + 6
        ) ||
        (
          crawler.dir < 0 &&
          crawler.x < -6
        )
      ) {
        this.resetReefCrawler(
          crawler
        );
      }
    }

    for (let i = 0; i < this.bubbles.length; i += 1) {
      const bubble = this.bubbles[i];
      bubble.age += 1;
      bubble.y -= bubble.speed;
      bubble.phase += 0.12;
      bubble.x += Math.sin(bubble.phase) * bubble.sway * 0.035;

      if (bubble.age >= bubble.life || bubble.y < -2) {
        this.bubbles[i] = this.makeBubble(false);
      }
    }
  }

  render(time) {
    this.ctx.drawImage(
      this.staticLayer,
      0,
      0,
      this.staticLayer.width,
      this.staticLayer.height,
      0,
      0,
      this.width,
      this.height
    );

    this.drawSediment(time);
    this.drawReefMutations(time);
    this.drawPlants(time);
    this.drawReefCrawlers(time);
    this.drawBubbles();
    this.drawFish(time);
  }

  drawSediment(time) {
    for (const particle of this.sediment) {
      const pulse = 0.78 + Math.sin(time * 0.0014 + particle.phase) * 0.22;
      this.drawString(
        particle.glyph,
        particle.x,
        particle.y,
        particle.color,
        particle.alpha * pulse,
        0.77
      );
    }
  }

  drawReefMutations(time) {
    const intensity = Math.max(
      0,
      this.config.animationIntensity / 100
    );

    if (intensity <= 0) {
      return;
    }

    for (
      const mutation
      of this.reefMutations
    ) {
      const mutationIntensity =
        0.55 +
        Math.min(2, intensity) * 0.30;

      const animationTime =
        time * mutationIntensity;

      const frameIndex =
        Math.floor(
          (
            animationTime +
            mutation.phase * 1000
          ) /
          mutation.frameDuration
        ) %
        mutation.frames.length;

      const pulse =
        0.76 +
        (
          (
            Math.sin(
              animationTime * 0.0032 +
              mutation.phase
            ) +
            1
          ) *
          0.08
        );

      const twitch =
        Math.sin(
          animationTime * 0.0022 +
          mutation.phase
        ) *
        mutation.twitch;

      this.drawString(
        mutation.frames[
          frameIndex
        ],
        mutation.x + twitch,
        mutation.y,
        mutation.color,
        mutation.alpha * pulse,
        0.88
      );
    }
  }

  drawReefCrawlers(time) {
    const intensity = Math.max(
      0,
      this.config.animationIntensity / 100
    );

    if (intensity <= 0) {
      return;
    }

    for (
      const crawler
      of this.reefCrawlers
    ) {
      const animationTime =
        time *
        Math.max(
          0.18,
          intensity
        );

      const frameIndex =
        Math.floor(
          (
            animationTime +
            crawler.phase * 800
          ) /
          crawler.frameDuration
        ) %
        crawler.frames.length;

      const frame =
        crawler.frames[
          frameIndex
        ];

      const y =
        crawler.y +
        Math.sin(
          animationTime * 0.003 +
          crawler.phase
        ) *
        crawler.bob;

      const flicker =
        0.76 +
        (
          (
            Math.sin(
              animationTime * 0.006 +
              crawler.phase
            ) +
            1
          ) *
          0.12
        );

      this.drawFishString(
        frame,
        crawler.x,
        y,
        crawler.dir,
        crawler.color,
        crawler.alpha * flicker,
        crawler.scale
      );
    }
  }

  drawPlants(time) {
    const intensity = this.config.animationIntensity / 100;
    const animatedTime = time * intensity;

    for (const plant of this.plants) {
      const swayOffset =
        intensity === 0
          ? 0
          : Math.sin(animatedTime * 0.0012 + plant.phase) *
            plant.sway *
            Math.min(1.75, 0.48 + intensity * 0.58);

      this.drawString(
        plant.glyph,
        plant.x + swayOffset,
        plant.y,
        plant.color,
        plant.alpha,
        0.93
      );
    }
  }

  bubbleGlyph(entity) {
    const progress = entity.age / entity.life;
    const index = Math.min(
      BUBBLE_GLYPHS.length - 1,
      Math.floor(progress * BUBBLE_GLYPHS.length)
    );
    return BUBBLE_GLYPHS[index];
  }

  drawBubbles() {
    for (const bubble of this.bubbles) {
      const progress = bubble.age / bubble.life;
      const fade = Math.sin(Math.min(1, progress) * Math.PI);
      this.drawString(
        this.bubbleGlyph(bubble),
        bubble.x,
        bubble.y,
        bubble.color,
        bubble.alpha * (0.48 + fade * 0.52),
        0.82
      );
    }
  }

  drawFish(time) {
    const intensity = this.config.animationIntensity / 100;
    const sorted = [...this.fish].sort((a, b) => a.depth - b.depth);

    for (const entity of sorted) {
      const wave =
        intensity === 0
          ? 0
          : Math.sin(time * 0.00072 * intensity + entity.phase) * entity.amplitude;
      const y = entity.y + wave;
      const alpha = entity.alpha * (0.45 + entity.depth * 0.55);

      if (entity.echo) {
        this.drawFishString(
          entity.glyph,
          entity.x - entity.dir * (entity.isLarge ? 1.55 : 1.0),
          y,
          entity.dir,
          PALETTE.deep,
          alpha * 0.20,
          entity.isLarge ? 0.98 : 0.89
        );
      }

      this.drawFishString(
        entity.glyph,
        entity.x,
        y,
        entity.dir,
        entity.color,
        alpha,
        entity.isLarge ? 1.0 : 0.90
      );
    }
  }

  drawFishString(text, x, y, direction, color, alpha, scale) {
    const glyphs = Array.from(text);
    const count = glyphs.length;

    for (let i = 0; i < count; i += 1) {
      const sourceIndex = direction > 0 ? i : count - 1 - i;
      const glyph = glyphs[sourceIndex];
      const targetX = direction > 0 ? x + i : x - i;
      this.drawString(glyph, targetX, y, color, alpha, scale, direction < 0);
    }
  }

  drawString(text, x, y, color, alpha = 1, scale = 1, mirror = false) {
    this.drawStringToContext(this.ctx, text, x, y, color, alpha, scale, mirror);
  }

  drawStringToContext(ctx, text, x, y, color, alpha = 1, scale = 1, mirror = false) {
    const glyphs = Array.from(text);
    glyphs.forEach((glyph, index) => {
      this.drawCellGlyph(ctx, glyph, x + index, y, color, alpha, scale, mirror);
    });
  }

  drawCellGlyph(ctx, glyph, col, row, color, alpha, scale, mirror) {
    const centerX = col * this.cellW + this.cellW * 0.5;
    const centerY = row * this.cellH + this.cellH * 0.5;
    const japanese = isJapaneseGlyph(glyph);
    const fontSize = this.cellH * (japanese ? 0.83 : 0.79) * scale;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.fillStyle = color;
    ctx.font = `${fontSize}px ${japanese ? JAPANESE_FONT : NORMAL_FONT}`;

    if (mirror) {
      ctx.translate(centerX, centerY);
      ctx.scale(-1, 1);
      ctx.fillText(glyph, 0, 0);
    } else {
      ctx.fillText(glyph, centerX, centerY);
    }

    ctx.restore();
  }

  loop(now) {
    const delta = Math.min(200, now - this.lastFrame);
    this.lastFrame = now;

    if (!this.paused) {
      this.accumulator += delta;
      while (this.accumulator >= STEP_MS) {
        this.update();
        this.accumulator -= STEP_MS;
      }
    }

    this.render(now);
    this.frameHandle = requestAnimationFrame(this.loop.bind(this));
  }
}
