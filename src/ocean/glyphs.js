export const PALETTE = Object.freeze({
  background: "#03158f",
  deep: "#06176e",
  shadow: "#093094",
  cyan: "#20f5e8",
  paleCyan: "#9ffcff",
  green: "#22e77a",
  yellow: "#fff35d",
  magenta: "#ff2daf",
  red: "#ff4d65",
  blue: "#159fff",
  white: "#d9ffff"
});

export const BRIGHT_COLORS = [
  PALETTE.cyan,
  PALETTE.green,
  PALETTE.yellow,
  PALETTE.magenta,
  PALETTE.red,
  PALETTE.paleCyan,
  PALETTE.blue
];

export const TERRAIN_GLYPHS = [
  "|", "Y", "y", "(", ")", "[", "]", "{", "}",
  "X", "x", "@", "§", "$", "¥", "*", "+", "=",
  "0", "O", ":", ".", "·", "※"
];

export const ROCK_GLYPHS = [
  "X", "x", "@", "§", "$", "¥", "*", "=", "[", "]", "0", "O"
];

export const CORAL_FAMILIES = [
  {
    body: ["X", "x", "*", "※"],
    accent: ["@", "§", "0"]
  },
  {
    body: ["@", "0", "O", "§"],
    accent: ["x", "*", "(", ")"]
  },
  {
    body: ["(", ")", "{", "}", "[", "]"],
    accent: ["|", "x", "="]
  },
  {
    body: ["=", "-", "_", "x", "X"],
    accent: ["*", "@", "+"]
  }
];

export const PLANT_GLYPHS = [
  "|", "|", "Y", "y", ")", "(", "ミ", "い"
];

export const PLANT_TIPS = [
  "Y", "y", "ミ", "い", "て"
];

export const SEDIMENT_GLYPHS = [
  ".", "·", ":", "'", "`", "-", "_", "o"
];

export const SMALL_FISH_GLYPHS = [
  "て", "て", "て", "を", "を", "い"
];

export const LARGE_FISH_GLYPHS = [
  "た彡", "だ彡", "魚>", "たミ"
];

export const BUBBLE_GLYPHS = [
  "O", "o", "0", "°", "·", "."
];

// Pequena vida que atravessa o recife. Não representa uma espécie literal:
// são formas inspiradas nos glifos móveis observados no vídeo de referência.
export const REEF_CRAWLER_FORMS = [
  ["ミ", "彡"],
  ["て", "を"],
  ["x=x", "X-X"],
  ["<x>", "<*>"],
  ["≋", "≈"]
];

// Alguns pontos do recife alternam entre formas próximas, criando a sensação
// de coral vivo / pequenos organismos parcialmente escondidos.
export const REEF_MUTATION_FRAMES = [
  ["Y", "y"],
  ["X", "x"],
  ["@", "O"],
  ["(", ")"],
  ["§", "$"],
  ["|", "!"],
  ["ミ", "彡"]
];

const JAPANESE_RANGE =
  /[\u3000-\u30ff\u3400-\u9fff\uf900-\ufaff\uff00-\uffef]/u;

export function isJapaneseGlyph(glyph) {
  return JAPANESE_RANGE.test(glyph);
}
