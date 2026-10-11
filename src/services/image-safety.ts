/**
 * Safety layer for the image generation engine.
 *
 * Two independent checks (defense in depth):
 *
 * 1. Prompt filter (`checkPromptSafety`): blocks prompts that request
 *    sexual content or content involving minors BEFORE the model is
 *    loaded or run. Normalization folds case, diacritics, leetspeak and
 *    separator characters, so trivial obfuscation ("p0rn", "n u d e")
 *    does not slip through.
 *
 * 2. Output heuristic (`checkOutputSafety`): estimates the skin-tone
 *    ratio of the generated tensor and blocks obviously sexualized
 *    outputs before they are shown or downloadable.
 *
 * Honest scope: everything runs client-side, so a determined user can
 * bypass it (devtools, other tools). This raises the bar, blocks the
 * casual path and documents the operator's stance - it is not a
 * guarantee. The prompt filter deliberately does NOT inspect the
 * negative prompt: negative prompts SUPPRESS concepts, so entries like
 * "nsfw" there are legitimate safety usage, not attacks.
 */

export type ImageSafetyCategory = 'minor' | 'sexual';

/** Where the block happened - the studio shows a matching message. */
export type ImageSafetySource = 'prompt' | 'output';

export class ImageSafetyError extends Error {
  readonly source: ImageSafetySource;
  readonly category: ImageSafetyCategory;

  constructor(source: ImageSafetySource, category: ImageSafetyCategory) {
    super(`image safety: blocked ${source} (${category})`);
    this.name = 'ImageSafetyError';
    this.source = source;
    this.category = category;
  }
}

// ---------------------------------------------------------------------------
// Prompt filter
// ---------------------------------------------------------------------------

/** Leetspeak/homoglyph folding applied before term matching. */
const LEET_MAP: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b',
  '@': 'a', '$': 's',
};

/**
 * Fold a prompt for matching: lowercase, fold umlauts/diacritics (NFKD +
 * strip combining marks, ß -> ss), reduce everything else to single
 * spaces. Digits stay intact - the age patterns below need them.
 */
const foldText = (text: string): string =>
  text
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * normalizePrompt = foldText + leetspeak decoding, for TERM matching
 * ("p0rn" -> "porn"). Terms are stored in this folded form (e.g.
 * "minderjahrig", "madchen"). Age patterns run on foldText instead -
 * the leet decode would destroy their digits ("12" -> "i2").
 */
export const normalizePrompt = (text: string): string => {
  let decoded = '';
  for (const ch of foldText(text)) {
    decoded += LEET_MAP[ch] ?? ch;
  }
  return decoded;
};

/**
 * Terms that always block. Word-boundary matched against the normalized
 * prompt, so "kindergarten" does not trip "kind" and "title" does not
 * trip "tit".
 */
const SEXUAL_TERMS = [
  // English
  'porn', 'pornos', 'porno', 'pornographic', 'pornography', 'nsfw', 'nude',
  'nudes', 'nudity', 'naked', 'sexual', 'sex', 'hardcore', 'xxx', 'erotic',
  'erotica', 'orgasm', 'orgasms', 'masturbation', 'masturbate', 'genital',
  'genitals', 'penis', 'vagina', 'vulva', 'breasts', 'boob', 'boobs', 'tit',
  'tits', 'titties', 'nipple', 'nipples', 'areola', 'cum', 'cumshot', 'sperm',
  'blowjob', 'handjob', 'deepthroat', 'upskirt', 'topless', 'bottomless',
  'fetish', 'bdsm', 'bondage', 'gangbang', 'threesome', 'hentai', 'milf',
  'slut', 'whore', 'stripper', 'striptease', 'lewd', 'explicit', 'rape',
  'raped', 'rapist', 'molestation', 'sexy', 'undressed', 'unclothed',
  // German (folded)
  'pornografie', 'pornographie', 'pornografisch', 'pornographisch',
  'nackt', 'nackig', 'nacktbild', 'nacktfoto', 'fkk',
  'sexuell', 'erotik', 'erotisch', 'orgasmus', 'masturbieren', 'onanie', 'geschlechtsteil',
  'geschlechtsteile', 'fotze', 'votze', 'muschi', 'pimmel', 'dildo', 'bruste',
  'titten', 'busen', 'nippel', 'sperma', 'fetisch', 'schlampe', 'hure', 'nutte',
  'vergewaltigung', 'vergewaltigt', 'missbrauch', 'missbraucht', 'unzucht',
];

/** Minor-related terms that always block (sexual context or not). */
const MINOR_TERMS = [
  // English
  'child', 'children', 'childlike', 'kid', 'kids', 'toddler', 'baby', 'babies',
  'infant', 'infants', 'minor', 'minors', 'underage', 'preteen', 'preteens',
  'teen', 'teens', 'teenager', 'teenagers', 'teenage', 'schoolgirl',
  'schoolgirls', 'schoolboy', 'schoolboys', 'loli', 'lolis', 'lolicon',
  'shota', 'shotacon', 'cp', 'csam',
  // German (folded)
  'kind', 'kinder', 'kleinkind', 'jugendlich', 'jugendliche', 'minderjahrig',
  'minderjahrige', 'teenie', 'teenies', 'schulkind', 'schulkinder',
  'schulmadchen', 'kindesmissbrauch',
];

/**
 * Youth words that do NOT block on their own ("a girl with a red
 * balloon" is a legitimate prompt) but escalate a sexual match to the
 * stricter 'minor' category.
 */
const YOUTH_TERMS = [
  'girl', 'girls', 'boy', 'boys', 'madchen', 'junge', 'schuler', 'schulerin',
  'teen', 'teens', 'teenager', 'teenage', 'teenie',
];

/**
 * Terms additionally matched against the fully de-spaced prompt, to
 * catch separator evasion ("n s f w", "p o r n"). Only long,
 * unambiguous terms: short ones would false-positive as substrings
 * (e.g. "sex" inside "sussex", "nude" inside "nudel").
 */
const DESPACED_TERMS = [
  'porn', 'porno', 'pornos', 'pornographic', 'pornography', 'pornografie',
  'pornographie', 'nsfw', 'hentai', 'lolicon', 'shotacon', 'erotik', 'erotic',
  'orgasmus', 'orgasm', 'masturbation', 'masturbieren', 'vergewaltigung',
  'nacktbild', 'nacktfoto', 'missbrauch', 'kindesmissbrauch', 'minderjahrig',
];

/**
 * Explicit age statements about persons: "12 years old", "7 jahre alt",
 * "age 14", "unter 18", "twelve year old". Numbers up to 17 mark a
 * minor; 18+ does not. Run on foldText output (digits intact).
 */
const AGE_MINOR_RE =
  /\b(?:1[0-7]|[1-9])\s*(?:years?|yrs?|jahre?)\s*(?:old|alt|jahrig)\b/i;
const AGE_LABEL_RE = /\b(?:age|alter)\s*[:=]?\s*(?:1[0-7]|[1-9])\b/i;
const UNDERAGE_RE = /\b(?:under|unter)\s*(?:18|achtzehn)\b/i;
const AGE_SPOKEN_RE = /\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|zwei|drei|vier|funf|sechs|sieben|acht|neun|zehn|elf|zwolf|dreizehn|vierzehn|funfzehn|sechzehn|siebzehn)\s*(?:years?|yrs?|jahre?)\s*(?:old|alt)\b/i;

/**
 * Word-boundary regex with optional German inflection suffixes, so
 * "nackt" also matches "nackte/nackter/nackten" and "kind" matches
 * "kinder/kindes". Compound words still do not match (no boundary
 * inside "kindergarten" or "nacktschnecke").
 */
const toWordRegex = (term: string): RegExp =>
  new RegExp(`\\b${term}(?:e|er|en|es|em|s|n)?\\b`);

const SEXUAL_RES = SEXUAL_TERMS.map(toWordRegex);
const MINOR_RES = MINOR_TERMS.map(toWordRegex);
const YOUTH_RES = YOUTH_TERMS.map(toWordRegex);

export interface PromptSafetyVerdict {
  blocked: boolean;
  /** null when not blocked; 'minor' takes precedence over 'sexual' */
  category: ImageSafetyCategory | null;
}

/**
 * Check the POSITIVE prompt only (see module comment for why the
 * negative prompt is deliberately not inspected).
 */
export const checkPromptSafety = (prompt: string): PromptSafetyVerdict => {
  const folded = foldText(prompt);
  if (folded.length === 0) {
    return { blocked: false, category: null };
  }
  const normalized = normalizePrompt(prompt);
  const despaced = normalized.replace(/ /g, '');

  const sexualHit = SEXUAL_RES.some((re) => re.test(normalized))
    || DESPACED_TERMS.some((term) => despaced.includes(term));
  const minorHit = MINOR_RES.some((re) => re.test(normalized))
    || AGE_MINOR_RE.test(folded)
    || AGE_LABEL_RE.test(folded)
    || AGE_SPOKEN_RE.test(folded)
    || UNDERAGE_RE.test(folded);

  if (minorHit) {
    return { blocked: true, category: 'minor' };
  }
  if (sexualHit) {
    const youthHit = YOUTH_RES.some((re) => re.test(normalized));
    return { blocked: true, category: youthHit ? 'minor' : 'sexual' };
  }
  return { blocked: false, category: null };
};

// ---------------------------------------------------------------------------
// Output heuristic
// ---------------------------------------------------------------------------

/**
 * Share of skin-toned pixels above which an image is blocked. Chosen
 * conservatively: legitimate portraits (head shot ~15-25% skin,
 * full-body ~35-45%) stay below it, while full-frame nudity typically
 * reaches 60-80%. Partial nudity can slip through - this is a
 * threshold-raiser, not a classifier (see module comment).
 */
const SKIN_RATIO_THRESHOLD = 0.55;

/**
 * Classic RGB skin rule (used by skin-detection literature since
 * Peer et al.): a pixel counts as skin-like when it is reddish,
 * sufficiently bright and has enough channel spread. Grayscale,
 * blue/green and dark surfaces do not match.
 */
const isSkinPixel = (r: number, g: number, b: number): boolean => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return r > 95 && g > 40 && b > 20 && max - min > 15 && Math.abs(r - g) > 15
    && r > g && r > b;
};

export interface ImageTensor {
  dims: number[];
  data: Float32Array;
}

/**
 * Estimate the skin-tone ratio of a VAE decoder output tensor. Handles
 * both NCHW [1, 3, H, W] (planar) and NHWC [1, H, W, 3] (interleaved)
 * layouts, mirroring the detection in sd-engine's tensorToDataUrl.
 */
export const analyzeSkinRatio = (image: ImageTensor): number => {
  const dims = image.dims;
  const isNchw = dims.length === 4 && dims[1] === 3;
  const height = isNchw ? dims[2] : dims[1];
  const width = isNchw ? dims[3] : dims[2];
  const pixelCount = width * height;
  if (!Number.isFinite(pixelCount) || pixelCount <= 0
    || image.data.length < pixelCount * 3) {
    return 0;
  }

  const data = image.data;
  let skinCount = 0;
  for (let i = 0; i < pixelCount; i++) {
    const r = isNchw ? data[i] : data[i * 3];
    const g = isNchw ? data[pixelCount + i] : data[i * 3 + 1];
    const b = isNchw ? data[2 * pixelCount + i] : data[i * 3 + 2];
    if (isSkinPixel(r * 255, g * 255, b * 255)) {
      skinCount++;
    }
  }
  return skinCount / pixelCount;
};

export interface OutputSafetyVerdict {
  blocked: boolean;
  /** Share of skin-toned pixels, 0..1 (logged for diagnostics) */
  skinRatio: number;
}

export const checkOutputSafety = (image: ImageTensor): OutputSafetyVerdict => {
  const skinRatio = analyzeSkinRatio(image);
  return { blocked: skinRatio >= SKIN_RATIO_THRESHOLD, skinRatio };
};
