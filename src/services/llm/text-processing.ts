export const stripHiddenPartsText = (text: string): string => {
  const input = text.split('\0').join('');
  const tags = /<\/?(?:think|todo_list)>/g;
  const stack: string[] = [];
  let output = '';
  let position = 0;
  for (const match of input.matchAll(tags)) {
    if (stack.length === 0) {output += input.slice(position, match.index);}
    const closing = match[0].startsWith('</');
    const name = match[0].slice(closing ? 2 : 1, -1);
    if (!closing) {stack.push(name);}
    else if (stack[stack.length - 1] === name) {stack.pop();}
    position = match.index + match[0].length;
  }
  if (stack.length === 0) {output += input.slice(position);}
  return output.trim();
};

// Rough estimate: the local models use ~4 characters per token. The context
// window (4096 tokens) is shared between prompt and the generated answer, so
// the prompt itself must stay well below it.
export const PROMPT_CHAR_BUDGET = 12000;

/** Keep the newest history messages that fit into the character budget left
 *  over by the fixed prompt parts (system prompt, memory block, user message).
 *  Oldest messages are dropped first - the recent conversation matters most. */
export const trimHistoryToCharBudget = (
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ...fixedParts: Array<string | null | undefined>
): Array<{ role: 'user' | 'assistant'; content: string }> => {
  let budget = PROMPT_CHAR_BUDGET;
  for (const part of fixedParts) {
    budget -= part?.length ?? 0;
  }
  const kept: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const message = history[i];
    if (message.content.length > budget) {
      break;
    }
    kept.unshift(message);
    budget -= message.content.length;
  }
  return kept;
};
