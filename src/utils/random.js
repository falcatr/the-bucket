export function randomSeed() {
  if (globalThis.crypto?.getRandomValues) {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0];
  }
  return Math.floor(Math.random() * 0xffffffff);
}

export function createRng(initialSeed) {
  let state = initialSeed >>> 0;
  return function random() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomHelpers(rng) {
  const rand = (min, max) => min + (max - min) * rng();
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const choose = (items) => items[Math.floor(rng() * items.length)];
  const chance = (probability) => rng() < probability;
  return { rand, randInt, choose, chance };
}
