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
