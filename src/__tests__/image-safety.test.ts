import { describe, expect, it } from 'vitest';
import {
  analyzeSkinRatio,
  checkOutputSafety,
  checkPromptSafety,
  ImageSafetyError,
  normalizePrompt,
} from '../services/image-safety';

// ============================================================================
// normalizePrompt
// ============================================================================

describe('normalizePrompt', () => {
  it('folds case, umlauts and ß', () => {
    expect(normalizePrompt('Nackte FRAU')).toBe('nackte frau');
    expect(normalizePrompt('Mädchen groß')).toBe('madchen gross');
  });
  it('decodes leetspeak', () => {
    expect(normalizePrompt('p0rn')).toBe('porn');
    expect(normalizePrompt('n4k3d')).toBe('naked');
  });
  it('reduces separators to single spaces', () => {
    expect(normalizePrompt('a  girl,  with... a balloon!')).toBe('a girl with a balloon');
  });
});

// ============================================================================
// checkPromptSafety - blocked prompts
// ============================================================================

describe('checkPromptSafety (blocked)', () => {
  it.each([
    ['nude woman on a beach', 'sexual'],
    ['nackte frau am strand', 'sexual'],
    ['a hardcore porn scene', 'sexual'],
    ['p0rn star', 'sexual'],
    ['n s f w photo', 'sexual'],
    ['explicit sex, xxx', 'sexual'],
    ['erotic hentai illustration', 'sexual'],
  ])('blocks %s as %s', (prompt, category) => {
    expect(checkPromptSafety(prompt)).toEqual({ blocked: true, category });
  });

  it('blocks minor terms on their own', () => {
    expect(checkPromptSafety('a child playing football')).toEqual({
      blocked: true,
      category: 'minor',
    });
    expect(checkPromptSafety('kleinkind im garten')).toEqual({
      blocked: true,
      category: 'minor',
    });
    expect(checkPromptSafety('teenager portrait')).toEqual({
      blocked: true,
      category: 'minor',
    });
  });

  it('blocks explicit age statements up to 17', () => {
    expect(checkPromptSafety('a 12 year old girl')).toEqual({
      blocked: true,
      category: 'minor',
    });
    expect(checkPromptSafety('person, 7 jahre alt')).toEqual({
      blocked: true,
      category: 'minor',
    });
    expect(checkPromptSafety('age 15')).toEqual({
      blocked: true,
      category: 'minor',
    });
    expect(checkPromptSafety('unter 18')).toEqual({
      blocked: true,
      category: 'minor',
    });
    expect(checkPromptSafety('a twelve year old girl')).toEqual({
      blocked: true,
      category: 'minor',
    });
  });

  it('escalates sexual + youth word to minor', () => {
    expect(checkPromptSafety('nude girl')).toEqual({ blocked: true, category: 'minor' });
    expect(checkPromptSafety('nackter junge')).toEqual({ blocked: true, category: 'minor' });
  });

  it('blocks leetspeak and spaced-out evasion', () => {
    expect(checkPromptSafety('l0l1c0n artwork')).toEqual({ blocked: true, category: 'minor' });
    expect(checkPromptSafety('p o r n')).toEqual({ blocked: true, category: 'sexual' });
  });
});

// ============================================================================
// checkPromptSafety - legitimate prompts must pass
// ============================================================================

describe('checkPromptSafety (legitimate prompts pass)', () => {
  it.each([
    'a bowl of noodles with vegetables',
    'a bowl of nudeln with tomato sauce',
    'squirrel with a bushy tail in autumn forest',
    'title page of an old book, ornate letters',
    'sussex countryside at sunset',
    'a girl with a red balloon',
    'ein junge kickt einen fußball',
    'portrait of a woman in a winter coat',
    'kindergarten building, colorful facade',
    'a woman, 30 years old, smiling',
    'beach with people in swimwear, wide shot',
  ])('allows %s', (prompt) => {
    expect(checkPromptSafety(prompt).blocked).toBe(false);
  });
});

// ============================================================================
// Output heuristic
// ============================================================================

/** Build an NCHW [1, 3, h, w] planar tensor from per-pixel [r, g, b] (0..1). */
const planarTensor = (pixels: [number, number, number][]): { dims: number[]; data: Float32Array } => {
  const data = new Float32Array(pixels.length * 3);
  pixels.forEach(([r, g, b], i) => {
    data[i] = r;
    data[pixels.length + i] = g;
    data[2 * pixels.length + i] = b;
  });
  return { dims: [1, 3, 1, pixels.length], data };
};

describe('analyzeSkinRatio', () => {
  it('detects skin-toned pixels (NCHW planar)', () => {
    // 3 skin pixels + 1 blue pixel -> ratio 0.75
    const tensor = planarTensor([
      [180 / 255, 130 / 255, 110 / 255],
      [200 / 255, 150 / 255, 120 / 255],
      [160 / 255, 120 / 255, 100 / 255],
      [50 / 255, 120 / 255, 200 / 255],
    ]);
    expect(analyzeSkinRatio(tensor)).toBeCloseTo(0.75);
  });

  it('returns 0 for non-skin images', () => {
    const tensor = planarTensor([
      [50 / 255, 120 / 255, 200 / 255],
      [100 / 255, 100 / 255, 100 / 255], // grayscale: no channel spread
      [20 / 255, 60 / 255, 20 / 255],
    ]);
    expect(analyzeSkinRatio(tensor)).toBe(0);
  });

  it('handles NHWC interleaved layout', () => {
    const data = new Float32Array([
      180 / 255, 130 / 255, 110 / 255,
      50 / 255, 120 / 255, 200 / 255,
    ]);
    const ratio = analyzeSkinRatio({ dims: [1, 2, 1, 3], data });
    expect(ratio).toBeCloseTo(0.5);
  });

  it('returns 0 for degenerate tensors', () => {
    expect(analyzeSkinRatio({ dims: [], data: new Float32Array(0) })).toBe(0);
    expect(analyzeSkinRatio({ dims: [1, 3, 2, 2], data: new Float32Array(3) })).toBe(0);
  });
});

describe('checkOutputSafety', () => {
  it('blocks an all-skin image', () => {
    const tensor = planarTensor([
      [180 / 255, 130 / 255, 110 / 255],
      [200 / 255, 150 / 255, 120 / 255],
    ]);
    const verdict = checkOutputSafety(tensor);
    expect(verdict.blocked).toBe(true);
    expect(verdict.skinRatio).toBeCloseTo(1);
  });

  it('allows a landscape image', () => {
    const tensor = planarTensor([
      [50 / 255, 120 / 255, 200 / 255],
      [90 / 255, 140 / 255, 60 / 255],
    ]);
    expect(checkOutputSafety(tensor).blocked).toBe(false);
  });
});

// ============================================================================
// ImageSafetyError
// ============================================================================

describe('ImageSafetyError', () => {
  it('carries source and category', () => {
    const err = new ImageSafetyError('prompt', 'minor');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ImageSafetyError');
    expect(err.source).toBe('prompt');
    expect(err.category).toBe('minor');
    expect(err.message).toContain('prompt');
  });
});
