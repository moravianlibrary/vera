// Seeded draws keep a generated seed stable across runs.
export type Random = () => number;

export function mulberry32(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(random: Random, values: readonly T[]): T {
  return values[Math.floor(random() * values.length)]!;
}

export function weighted<T>(random: Random, values: readonly (readonly [T, number])[]): T {
  const total = values.reduce((sum, [, weight]) => sum + weight, 0);
  let draw = random() * total;
  for (const [value, weight] of values) {
    draw -= weight;
    if (draw < 0) return value;
  }
  return values.at(-1)![0];
}

export function logNormal(random: Random, median: number, p90: number): number {
  const u1 = Math.max(random(), Number.EPSILON);
  const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * random());
  const sigma = Math.log(p90 / median) / 1.2815515655446004;
  return Math.max(1, Math.round(median * Math.exp(normal * sigma)));
}

export function poisson(random: Random, mean: number): number {
  const limit = Math.exp(-mean);
  let product = 1;
  let count = 0;
  do {
    count += 1;
    product *= random();
  } while (product > limit);
  return count - 1;
}
