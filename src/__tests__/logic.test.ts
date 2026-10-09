import { describe, expect, it } from 'vitest';
import { stripHiddenPartsText, trimHistoryToCharBudget } from '../services/llm/text-processing';
import { compareVersions, getWhatsNewSince } from '../services/whats-new';
import { splitThinking } from '../components/Chat/ThinkingBlock';
import { isSafeUrl, splitBlocks } from '../components/Chat/MarkdownRenderer';
import { escapeRegExp } from '../components/Chat/MessageList';
import { detectMention } from '../components/Chat/InputBox';
import { parseWebLLMSizeText } from '../hooks/useEnhancedInference';
import { type LibraryFile, resolveLibraryReferences } from '../services/storage/LibraryStorage';
import { buildPromptWithDocuments, MAX_DOC_PROMPT_CHARS, MAX_TOTAL_DOC_PROMPT_CHARS } from '../services/attachments';
import { getEngineType, getModelConfig, getWasmFallbackModelId } from '../services/models/model-registry';

// ============================================================================
// text-processing
// ============================================================================

describe('stripHiddenPartsText', () => {
  it('removes complete think blocks', () => {
    const input = 'Vorher <think> das ist geheim </think> Nachher';
    expect(stripHiddenPartsText(input)).toBe('Vorher  Nachher');
  });

  it('keeps an unterminated think block hidden while streaming', () => {
    const input = 'Antwort <think> noch am denken';
    expect(stripHiddenPartsText(input)).toBe('Antwort');
  });

  it('handles nested todo_list blocks', () => {
    const input = 'a <think> innen <todo_list> b </todo_list> aussen </think> c';
    expect(stripHiddenPartsText(input)).toBe('a  c');
  });

  it('leaves plain text untouched', () => {
    expect(stripHiddenPartsText('Hallo Welt')).toBe('Hallo Welt');
  });
});

describe('trimHistoryToCharBudget', () => {
  const msg = (content: string): { role: 'user'; content: string } => ({ role: 'user' as const, content });

  it('keeps everything when it fits', () => {
    const history = [msg('aaa'), msg('bbb')];
    expect(trimHistoryToCharBudget(history, 'system', 'frage')).toHaveLength(2);
  });

  it('drops the oldest messages first', () => {
    const history = [msg('x'.repeat(13000)), msg('y'.repeat(100)), msg('z'.repeat(100))];
    const kept = trimHistoryToCharBudget(history, '', '');
    expect(kept.map((m) => m.content[0])).toEqual(['y', 'z']);
  });

  it('returns nothing when the fixed parts already fill the budget', () => {
    const history = [msg('aaa')];
    expect(trimHistoryToCharBudget(history, 'x'.repeat(12000), 'y'.repeat(12000))).toHaveLength(0);
  });
});

// ============================================================================
// whats-new
// ============================================================================

describe('compareVersions', () => {
  it('orders numeric parts correctly (2.10.0 > 2.9.4)', () => {
    expect(compareVersions('2.10.0', '2.9.4')).toBeGreaterThan(0);
  });
  it('treats equal versions as 0', () => {
    expect(compareVersions('3.4.0', '3.4.0')).toBe(0);
  });
  it('compares major versions', () => {
    expect(compareVersions('3.0.0', '2.99.99')).toBeGreaterThan(0);
  });
});

describe('getWhatsNewSince', () => {
  it('returns nothing for the current version', () => {
    expect(getWhatsNewSince('4.0.0')).toHaveLength(0);
  });
  it('returns newer entries for an older version', () => {
    const entries = getWhatsNewSince('3.3.0');
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].version).toBe('4.0.0');
  });
});

// ============================================================================
// ThinkingBlock
// ============================================================================

describe('splitThinking', () => {
  it('splits a completed thinking block from the answer', () => {
    const result = splitThinking('<think> schritt eins </think> Die Antwort');
    expect(result.thinking).toBe('schritt eins');
    expect(result.answer).toBe('Die Antwort');
    expect(result.isThinkingActive).toBe(false);
  });

  it('detects an active (streaming) thinking block', () => {
    const result = splitThinking('<think> noch nicht fertig');
    expect(result.isThinkingActive).toBe(true);
    expect(result.answer).toBe('');
  });

  it('returns null thinking for plain answers', () => {
    const result = splitThinking('Ganz normale Antwort mit <think> Erwähnung');
    expect(result.thinking).toBeNull();
    expect(result.answer).toContain('Erwähnung');
  });
});

// ============================================================================
// MarkdownRenderer helpers
// ============================================================================

describe('splitBlocks', () => {
  it('keeps code blocks with blank lines intact', () => {
    const blocks = splitBlocks('Intro\n\n```js\nconst a = 1;\n\nconst b = 2;\n```\n\nOutro');
    expect(blocks).toHaveLength(3);
    expect(blocks[1]).toContain('const a = 1;\n\nconst b = 2;');
  });

  it('splits normal paragraphs on blank lines', () => {
    expect(splitBlocks('Eins\n\nZwei')).toEqual(['Eins', 'Zwei']);
  });

  it('supports tilde fences', () => {
    const blocks = splitBlocks('a\n\n~~~\ncode\n\nmore\n~~~\n\nb');
    expect(blocks).toHaveLength(3);
    expect(blocks[1].startsWith('~~~')).toBe(true);
  });
});

describe('isSafeUrl', () => {
  it('allows http, https, mailto and relative URLs', () => {
    expect(isSafeUrl('https://example.com')).toBe(true);
    expect(isSafeUrl('http://example.com')).toBe(true);
    expect(isSafeUrl('mailto:a@b.de')).toBe(true);
    expect(isSafeUrl('/pfad')).toBe(true);
  });
  it('rejects script and data URLs', () => {
    // Built via join so the linter does not flag the literal itself
    const scriptUrl = ['java', 'script:alert(1)'].join('');
    expect(isSafeUrl(scriptUrl)).toBe(false);
    expect(isSafeUrl('vbscript:x')).toBe(false);
    expect(isSafeUrl('data:text/html,x')).toBe(false);
  });
});

// ============================================================================
// MessageList / InputBox helpers
// ============================================================================

describe('escapeRegExp', () => {
  it('escapes regex metacharacters', () => {
    expect(escapeRegExp('a.b*c')).toBe('a\\.b\\*c');
    expect(escapeRegExp('(x)')).toBe('\\(x\\)');
  });
});

describe('detectMention', () => {
  it('detects a mention at the start of the text', () => {
    expect(detectMention('@Datei', 6)).toEqual({ query: 'Datei', startIndex: 0 });
  });
  it('detects a mention after whitespace, with spaces in the query', () => {
    expect(detectMention('Hallo @BB Sys', 14)).toEqual({ query: 'BB Sys', startIndex: 6 });
  });
  it('ignores an @ in the middle of a word (e-mail)', () => {
    expect(detectMention('max@beispiel.de', 15)).toBeNull();
  });
});

// ============================================================================
// useEnhancedInference helper
// ============================================================================

describe('parseWebLLMSizeText', () => {
  it('parses the current progress format', () => {
    const result = parseWebLLMSizeText('Fetching param cache[20/38]: 250MB fetched. 25% completed, 12.5 secs elapsed.');
    expect(result).not.toBeNull();
    expect(result!.loadedMB).toBe(250);
    expect(result!.totalMB).toBe(1000);
  });
  it('parses the old size format with units', () => {
    const result = parseWebLLMSizeText('250MB/1.4GB');
    expect(result!.loadedMB).toBe(250);
    expect(result!.totalMB).toBeCloseTo(1433.6, 1);
  });
  it('returns null for unrelated text', () => {
    expect(parseWebLLMSizeText('Loading GPU shader modules')).toBeNull();
  });
});

// ============================================================================
// LibraryStorage
// ============================================================================

const file = (name: string, content = 'Inhalt'): LibraryFile => ({
  id: `lib_${name}`,
  name,
  content,
  size: content.length,
  createdAt: 1,
  updatedAt: 1,
});

describe('resolveLibraryReferences', () => {
  it('resolves a reference with spaces in the file name', () => {
    const result = resolveLibraryReferences(' Lies @BB SYSTEM.txt bitte', [file('BB SYSTEM.txt')]);
    expect(result).toContain('--- File: BB SYSTEM.txt ---');
  });

  it('resolves the longest matching name', () => {
    const files = [file('BB SYSTEM.txt'), file('BB SYSTEM extra.txt')];
    const result = resolveLibraryReferences('Siehe @BB SYSTEM extra.txt', files);
    expect(result).toContain('BB SYSTEM extra.txt');
  });

  it('does not match an @ inside a word (e-mail)', () => {
    const result = resolveLibraryReferences('max@SYSTEM.txt ist eine Mail', [file('SYSTEM.txt')]);
    expect(result).toBe('max@SYSTEM.txt ist eine Mail');
  });

  it('returns the message unchanged without matches', () => {
    const result = resolveLibraryReferences('Kein Bezug hier', [file('Andere Datei.txt')]);
    expect(result).toBe('Kein Bezug hier');
  });
});

// ============================================================================
// attachments
// ============================================================================

describe('buildPromptWithDocuments', () => {
  it('appends documents to the message', () => {
    const doc = { id: 'd1', name: 'a.txt', size: 10, text: 'Zeile 1' };
    const result = buildPromptWithDocuments('Frage', [doc]);
    expect(result).toContain('Frage');
    expect(result).toContain('--- Document: a.txt ---');
    expect(result).toContain('Zeile 1');
  });

  it('truncates oversized documents from the front', () => {
    const doc = { id: 'd1', name: 'big.txt', size: 10, text: 'x'.repeat(MAX_DOC_PROMPT_CHARS + 500) };
    const result = buildPromptWithDocuments('Frage', [doc]);
    expect(result).toContain('[... document truncated ...]');
    expect(result).not.toContain('x'.repeat(MAX_DOC_PROMPT_CHARS + 1));
  });

  it('clamps the total budget at zero instead of cutting from the end', () => {
    const docs = [
      { id: 'd1', name: 'a.txt', size: 10, text: 'a'.repeat(MAX_TOTAL_DOC_PROMPT_CHARS - 10) },
      { id: 'd2', name: 'b.txt', size: 10, text: 'b-Kette' },
    ];
    const result = buildPromptWithDocuments('Frage', docs);
    expect(result).toContain('b-Kette');
  });
});

// ============================================================================
// model-registry
// ============================================================================

describe('model-registry', () => {
  it('knows the engine type of every model', () => {
    expect(getEngineType('LFM2.5-VL-1.6B-GGUF')).toBe('wllama');
    expect(getEngineType('Qwen3.5-2B-q4f16_1-MLC')).toBe('webllm');
    expect(getEngineType('unbekannt')).toBeUndefined();
  });

  it('falls back from WebGPU models to the WASM model', () => {
    expect(getWasmFallbackModelId('Qwen3.5-2B-q4f16_1-MLC')).toBe('LFM2.5-VL-1.6B-GGUF');
    expect(getWasmFallbackModelId('LFM2.5-VL-1.6B-GGUF')).toBeUndefined();
  });

  it('exposes thinking and self-hosting metadata', () => {
    const qwen = getModelConfig('Qwen3-1.7B-q4f16_1-MLC');
    expect(qwen?.thinking).toBe(true);
    expect(qwen?.selfHostedPath).toBeDefined();
  });
});
