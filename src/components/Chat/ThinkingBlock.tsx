import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const THINKING_OPEN = '<think>';
const THINKING_CLOSE = '</think>';

export interface SplitThinkingResult {
  /** Content of the `` block, null if the message has no thinking block */
  thinking: string | null;
  /** The visible answer (everything outside the thinking block) */
  answer: string;
  /** True while the thinking block is still being streamed (no closing tag yet) */
  isThinkingActive: boolean;
}

/**
 * Splits raw model output into the thinking part (`` ... ``)
 * and the visible answer. Models like Qwen3 emit their reasoning inside
 * these tags; the tags themselves are never part of the visible answer.
 * Only a thinking block at the very start of the message is recognized,
 * so answers that merely mention the tag are left untouched.
 */
export const splitThinking = (content: string): SplitThinkingResult => {
  const leading = content.match(/^\s*/)?.[0] ?? '';
  const afterLeading = content.slice(leading.length);

  if (!afterLeading.startsWith(THINKING_OPEN)) {
    return { thinking: null, answer: content, isThinkingActive: false };
  }

  const thinkStart = leading.length + THINKING_OPEN.length;
  const closeIndex = content.indexOf(THINKING_CLOSE, thinkStart);

  if (closeIndex === -1) {
    // Still streaming: no closing tag yet
    return {
      thinking: content.slice(thinkStart).trim(),
      answer: '',
      isThinkingActive: true,
    };
  }

  return {
    thinking: content.slice(thinkStart, closeIndex).trim(),
    answer: content.slice(closeIndex + THINKING_CLOSE.length).trimStart(),
    isThinkingActive: false,
  };
};

interface ThinkingBlockProps {
  thinking: string;
  /** True while the thinking block is still being generated */
  isActive?: boolean;
}

/**
 * Collapsible display of a model's thinking process. Collapsed by default
 * so the user goes straight to the answer and can expand the reasoning.
 */
export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ thinking, isActive = false }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
        aria-expanded={expanded}
      >
        <span className={isActive ? 'animate-pulse' : ''}>💭</span>
        <span className="font-medium">
          {isActive ? t('chat.thinkingActive') : t('chat.thinkingProcess')}
        </span>
        <span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>›</span>
      </button>
      {expanded && (
        <div className="mt-1.5 pl-3 pr-2 py-2 text-xs text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap break-words border-l-2 border-zinc-200 dark:border-zinc-600 max-h-64 overflow-y-auto">
          {thinking}
        </div>
      )}
    </div>
  );
};
