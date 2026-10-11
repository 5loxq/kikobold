import { describe, expect, it } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import MarkdownRenderer from './MarkdownRenderer';

const renderToHtml = (content: string): string => {
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => {
    root.render(React.createElement(MarkdownRenderer, { content }));
  });
  return host.innerHTML;
};

describe('MarkdownRenderer rendering', () => {
  it('parses bold text', () => {
    const html = renderToHtml('Vor **fett** und **nach** normal.');
    expect(html).toContain('<strong');
    expect(html).toContain('>fett<');
    expect(html).toContain('>nach<');
    expect(html).not.toContain('**');
  });

  it('parses the numbered-list-with-bold scenario from the bug report', () => {
    const content = [
      '**4. Soziale und kulturelle Faktoren:**',
      '- **Kulturelle Drucke:** In einigen kulturellen Kontexten können religiöse Normen und Erwartungen zu großen Druck auf Individuen wirken.',
    ].join('\n');
    const html = renderToHtml(content);
    expect(html).toContain('<strong');
    expect(html).toContain('>4. Soziale und kulturelle Faktoren:<');
    expect(html).toContain('>Kulturelle Drucke:<');
    expect(html).not.toContain('**');
  });

  it('parses a multi-section answer with bold headers and lists', () => {
    const content = [
      'Hier sind die Faktoren:',
      '',
      '**1. Erster Faktor:** Erklärung.',
      '',
      '4. **Soziale Faktoren:**',
      '- **Druck:** In einigen Kontexten.',
    ].join('\n');
    const html = renderToHtml(content);
    expect(html).toContain('<strong');
    expect(html).toContain('>1. Erster Faktor:<');
    expect(html).toContain('>Soziale Faktoren:<');
    expect(html).toContain('>Druck:<');
    expect(html).not.toContain('**');
  });

  it('does not mangle inline code with underscores', () => {
    const html = renderToHtml('Siehe `some_var_name` im Code.');
    expect(html).toContain('<code');
    expect(html).toContain('some_var_name');
    expect(html).not.toContain('<em');
  });

  it('renders multi-line ordered and unordered lists', () => {
    const html = renderToHtml('1. Erstens\n2. Zweitens\n\n- Punkt a\n- Punkt b');
    expect(html).toContain('<ol');
    expect(html).toContain('<ul');
    expect(html).toContain('>Erstens<');
    expect(html).toContain('>Punkt b<');
  });
});
