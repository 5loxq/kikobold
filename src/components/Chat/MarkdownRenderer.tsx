/**
 * MarkdownRenderer Component
 * 
 * Renders chat messages with full Markdown support including:
 * - Headers
 * - Bold, Italic, Strikethrough
 * - Lists (ordered and unordered)
 * - Links
 * - Images
 * - Code blocks with syntax highlighting
 * - Inline code
 * - Blockquotes
 * - Horizontal rules
 * - Tables
 * - Task lists
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Prism } from 'prism-react-renderer';
import { error as logError } from '../../services/logging';

// KaTeX (~300 KB plus fonts) is loaded lazily on the first math block: it is
// not part of the main bundle and only downloads when a message actually
// contains math. The CSS travels with it - the fonts inside are only
// fetched by the browser when a formula really uses them.
type KatexModule = typeof import('katex');
let katexPromise: Promise<KatexModule> | null = null;
const loadKatex = (): Promise<KatexModule> => {
  if (!katexPromise) {
    katexPromise = Promise.all([
      import('katex'),
      import('katex/dist/katex.min.css'),
    ]).then(([katex]) => katex);
  }
  return katexPromise;
};

const renderKatex = (katex: KatexModule, tex: string, displayMode: boolean): string | null => {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      strict: false,
      output: 'html',
    });
  } catch {
    return null;
  }
};

// Only these URL schemes are rendered as clickable links / image sources.
// Everything else (javascript:, vbscript:, data:, ...) is dropped so
// markdown in a message can never turn into a script URL.
const SAFE_URL = /^(https?:\/\/|mailto:|\/|#)/i;
export const isSafeUrl = (url: string): boolean => SAFE_URL.test(url.trim());

const MathBlock: React.FC<{ tex: string }> = ({ tex }) => {
  // undefined = still loading, null = rendering failed, string = HTML
  const [html, setHtml] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void loadKatex().then((katex) => {
      if (!cancelled) {
        setHtml(renderKatex(katex, tex, true));
      }
    });
    return (): void => { cancelled = true; };
  }, [tex]);

  if (html === undefined || html === null) {
    return <Paragraph>{tex}</Paragraph>;
  }
  return <div className="math-block my-3 text-center overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />;
};

const MathInline: React.FC<{ tex: string }> = ({ tex }) => {
  const [html, setHtml] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void loadKatex().then((katex) => {
      if (!cancelled) {
        setHtml(renderKatex(katex, tex, false));
      }
    });
    return (): void => { cancelled = true; };
  }, [tex]);

  if (html === undefined || html === null) {
    return <>{tex}</>;
  }
  return <span className="math-inline" dangerouslySetInnerHTML={{ __html: html }} />;
};

// Type assertion for SyntaxHighlighter to work around type issues
const SyntaxHighlighter = Prism as unknown as React.ComponentType<{
  language: string;
  style: Record<string, unknown>;
  customStyle?: React.CSSProperties;
  children: React.ReactNode;
}>;

// Supported programming languages for syntax highlighting
const SUPPORTED_LANGUAGES = [
  'javascript', 'typescript', 'jsx', 'tsx',
  'python', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'swift', 'kotlin',
  'php', 'ruby', 'scala', 'elixir', 'clojure',
  'html', 'css', 'scss', 'sass', 'less',
  'json', 'yaml', 'toml', 'xml',
  'sql', 'graphql',
  'bash', 'shell', 'powershell', 'zsh',
  'dockerfile', 'makefile',
  'markdown', 'md',
  'text', 'plaintext',
];

// Default theme for syntax highlighting
const DARK_THEME = {
  plain: {
    color: '#e2e8f0',
    backgroundColor: '#2d3748',
  },
  styles: [
    {
      types: ['comment', 'prolog', 'doctype', 'cdata', 'punctuation'],
      style: {
        color: '#8892b0',
        fontStyle: 'italic',
      },
    },
    {
      types: ['namespace'],
      style: {
        opacity: 0.7,
      },
    },
    {
      types: ['property', 'tag', 'boolean', 'number', 'constant', 'symbol', 'deleted'],
      style: {
        color: '#fbbf24',
      },
    },
    {
      types: ['selector', 'attr-name', 'string', 'char', 'builtin', 'inserted'],
      style: {
        color: '#a3e635',
      },
    },
    {
      types: ['operator', 'entity', 'url', 'language-css .token.punctuation', 'language-html .token.tag'],
      style: {
        color: '#fbbf24',
      },
    },
    {
      types: ['atrule', 'attr-value', 'keyword'],
      style: {
        color: '#60a5fa',
      },
    },
    {
      types: ['function', 'class-name'],
      style: {
        color: '#34d399',
      },
    },
    {
      types: ['regex', 'important', 'variable'],
      style: {
        color: '#f87171',
      },
    },
    {
      types: ['bold', 'important'],
      style: {
        fontWeight: 'bold',
      },
    },
    {
      types: ['italic'],
      style: {
        fontStyle: 'italic',
      },
    },
    {
      types: ['entity'],
      style: {
        cursor: 'help',
      },
    },
  ],
};

const LIGHT_THEME = {
  plain: {
    color: '#374151',
    backgroundColor: '#f8fafc',
  },
  styles: [
    {
      types: ['comment', 'prolog', 'doctype', 'cdata', 'punctuation'],
      style: {
        color: '#9ca3af',
        fontStyle: 'italic',
      },
    },
    {
      types: ['namespace'],
      style: {
        opacity: 0.7,
      },
    },
    {
      types: ['property', 'tag', 'boolean', 'number', 'constant', 'symbol', 'deleted'],
      style: {
        color: '#f59e0b',
      },
    },
    {
      types: ['selector', 'attr-name', 'string', 'char', 'builtin', 'inserted'],
      style: {
        color: '#10b981',
      },
    },
    {
      types: ['operator', 'entity', 'url'],
      style: {
        color: '#f59e0b',
      },
    },
    {
      types: ['atrule', 'attr-value', 'keyword'],
      style: {
        color: '#3b82f6',
      },
    },
    {
      types: ['function', 'class-name'],
      style: {
        color: '#10b981',
      },
    },
    {
      types: ['regex', 'important', 'variable'],
      style: {
        color: '#ef4444',
      },
    },
    {
      types: ['bold'],
      style: {
        fontWeight: 'bold',
      },
    },
    {
      types: ['italic'],
      style: {
        fontStyle: 'italic',
      },
    },
  ],
};

interface MarkdownRendererProps {
  content: string;
  className?: string;
  isDarkMode?: boolean;
  onLinkClick?: (url: string) => void;
  onImageClick?: (src: string) => void;
  maxCodeBlockHeight?: string | number;
}

// Custom components for markdown rendering
const Heading1: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h1 className="text-3xl font-bold my-4 text-gray-800 dark:text-gray-100">{children}</h1>
);

const Heading2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-2xl font-bold my-3 text-gray-800 dark:text-gray-100">{children}</h2>
);

const Heading3: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-xl font-bold my-2 text-gray-800 dark:text-gray-100">{children}</h3>
);

const Heading4: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h4 className="text-lg font-semibold my-2 text-gray-700 dark:text-gray-300">{children}</h4>
);

const Heading5: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h5 className="text-base font-semibold my-1 text-gray-700 dark:text-gray-300">{children}</h5>
);

const Heading6: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h6 className="text-sm font-semibold my-1 text-gray-600 dark:text-gray-400">{children}</h6>
);

const Paragraph: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="my-2 text-gray-700 dark:text-gray-300 leading-relaxed">{children}</p>
);

const Strong: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <strong className="font-bold text-gray-800 dark:text-gray-200">{children}</strong>
);

const Emphasis: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <em className="italic text-gray-700 dark:text-gray-300">{children}</em>
);

const Strikethrough: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <s className="line-through text-gray-500 dark:text-gray-400">{children}</s>
);

const Link: React.FC<{ href?: string; children: React.ReactNode; onClick?: (url: string) => void }> = ({ href, children, onClick }) => {
  // Drop unsafe schemes (javascript:, vbscript:, ...) instead of rendering them
  const safeHref = href !== undefined && isSafeUrl(href) ? href : undefined;

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (safeHref && onClick) {
      e.preventDefault();
      onClick(safeHref);
    }
  }, [safeHref, onClick]);

  return (
    <a
      href={safeHref}
      onClick={handleClick}
      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline transition-colors"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
};

const Image: React.FC<{ src?: string; alt?: string; onClick?: (src: string) => void }> = ({ src, alt, onClick }) => {
  const [loaded, setLoaded] = useState(false);

  const handleClick = useCallback(() => {
    if (src && onClick) {
      onClick(src);
    }
  }, [src, onClick]);

  if (!src || !isSafeUrl(src)) {return null;}

  return (
    <div className="my-4">
      <img
        src={src}
        alt={alt ?? ''}
        onLoad={() => setLoaded(true)}
        onClick={handleClick}
        className={`rounded-lg shadow-md cursor-pointer transition-all duration-300 ${
          loaded ? 'opacity-100' : 'opacity-50'
        }`}
        style={{ maxWidth: '100%', height: 'auto' }}
      />
      {!loaded && (
        <div className="text-center text-gray-400 text-sm py-2">Loading image...</div>
      )}
    </div>
  );
};

const Blockquote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 my-3 italic text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 py-2 px-3 rounded-r-lg">
    {children}
  </blockquote>
);

const HorizontalRule: React.FC = () => (
  <hr className="my-6 border-gray-200 dark:border-gray-700" />
);

const List: React.FC<{ children: React.ReactNode; ordered?: boolean }> = ({ children, ordered = false }) => {
  const Component = ordered ? 'ol' : 'ul';
  return (
    <Component className="my-3 pl-6 text-gray-700 dark:text-gray-300">
      {children}
    </Component>
  );
};

const ListItem: React.FC<{ children: React.ReactNode; checked?: boolean }> = ({ children, checked }) => (
  <li className={`my-1 ${checked !== undefined ? 'flex items-center gap-2' : ''}`}>
    {checked !== undefined && (
      <input
        type="checkbox"
        checked={checked}
        readOnly
        className="rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
      />
    )}
    {children}
  </li>
);

// Code block with copy button
interface CodeBlockProps {
  language?: string;
  value: string;
  isDarkMode?: boolean;
  maxHeight?: string | number;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, value, isDarkMode, maxHeight }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (typeof navigator === 'undefined') {return;}

    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch((err) => {
      logError('Failed to copy code:', err);
    });
  }, [value]);

  // Detect language from className or use default
  const detectedLanguage = useMemo(() => {
    if (language) {
      const lang = language.toLowerCase();
      if (SUPPORTED_LANGUAGES.includes(lang)) {
        return lang;
      }
      // Try to match without extension
      const baseLang = lang.split('-')[0];
      if (SUPPORTED_LANGUAGES.includes(baseLang)) {
        return baseLang;
      }
    }
    return 'text';
  }, [language]);

  const theme = isDarkMode ? DARK_THEME : LIGHT_THEME;

  return (
    <div className="my-4 relative">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-mono text-gray-500 dark:text-gray-400">
          {detectedLanguage}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Copy code"
        >
          <span className="text-sm">📋</span>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div
        className="overflow-auto rounded-lg shadow-sm"
        style={{ maxHeight: maxHeight ?? '400px' }}
      >
        <SyntaxHighlighter
          language={detectedLanguage}
          style={theme}
          customStyle={{
            margin: 0,
            padding: '1rem',
            fontSize: '0.875rem',
            lineHeight: '1.5',
            borderRadius: '0.5rem',
          }}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

// Inline code
const InlineCode: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-red-600 dark:text-red-400 rounded font-mono text-sm">
    {children}
  </code>
);

// Main MarkdownRenderer component
const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
  isDarkMode = false,
  onLinkClick,
  onImageClick,
  maxCodeBlockHeight,
}) => {
  if (!content || content.trim().length === 0) {
    return <p className="text-gray-500 dark:text-gray-400 italic">No content</p>;
  }

  return (
    <div className={`markdown-content ${className}`}>
      {/* We'll use a simple approach: parse markdown manually for basic formatting */}
      <MarkdownContent
        content={content}
        isDarkMode={isDarkMode}
        onLinkClick={onLinkClick}
        onImageClick={onImageClick}
        maxCodeBlockHeight={maxCodeBlockHeight}
      />
    </div>
  );
};

/**
 * Split content into blocks on blank lines. Fenced code blocks are kept
 * intact: their content may contain blank lines, which must not cut the
 * block in half (the code would otherwise render as broken paragraphs).
 */
export const splitBlocks = (content: string): string[] => {
  const blocks: string[] = [];
  let current: string[] = [];
  let fence: string | null = null;

  const flush = (): void => {
    const text = current.join('\n');
    if (text.trim()) {
      blocks.push(text);
    }
    current = [];
  };

  for (const line of content.split('\n')) {
    const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (fence === null) {
        fence = fenceMatch[1];
      } else if (fenceMatch[1].startsWith(fence)) {
        fence = null;
      }
      current.push(line);
    } else if (fence === null && line.trim() === '') {
      flush();
    } else {
      current.push(line);
    }
  }
  flush();

  return blocks;
};

// Internal component to render markdown content
interface MarkdownContentProps {
  content: string;
  isDarkMode: boolean;
  onLinkClick?: (url: string) => void;
  onImageClick?: (src: string) => void;
  maxCodeBlockHeight?: string | number;
}

const MarkdownContent: React.FC<MarkdownContentProps> = ({
  content,
  isDarkMode,
  onLinkClick,
  onImageClick,
  maxCodeBlockHeight,
}) => {
  // Split content by double newlines to get paragraphs/blocks
  const blocks = splitBlocks(content);

  return (
    <>
      {blocks.map((block, index) => {
        // Skip empty blocks
        if (!block.trim()) {
          return <br key={index} />;
        }

        // Check for headers
        if (block.startsWith('###### ')) {
          return <Heading6 key={index}>{block.substring(7)}</Heading6>;
        }
        if (block.startsWith('##### ')) {
          return <Heading5 key={index}>{block.substring(6)}</Heading5>;
        }
        if (block.startsWith('#### ')) {
          return <Heading4 key={index}>{block.substring(5)}</Heading4>;
        }
        if (block.startsWith('### ')) {
          return <Heading3 key={index}>{block.substring(4)}</Heading3>;
        }
        if (block.startsWith('## ')) {
          return <Heading2 key={index}>{block.substring(3)}</Heading2>;
        }
        if (block.startsWith('# ')) {
          return <Heading1 key={index}>{block.substring(2)}</Heading1>;
        }

        // Check for display math ($$...$$)
        const displayMathMatch = block.match(/^\$\$([\s\S]*?)\$\$$/);
        if (displayMathMatch) {
          return <MathBlock key={index} tex={displayMathMatch[1].trim()} />;
        }
        // Check for horizontal rule
        if (/^[-*_]{3,}$/.test(block.trim())) {
          return <HorizontalRule key={index} />;
        }

        // Check for blockquote
        if (block.startsWith('> ')) {
          return (
            <Blockquote key={index}>
              <MarkdownContent
                content={block.substring(2)}
                isDarkMode={isDarkMode}
                onLinkClick={onLinkClick}
                onImageClick={onImageClick}
                maxCodeBlockHeight={maxCodeBlockHeight}
              />
            </Blockquote>
          );
        }

        // Check for code blocks (```language or ~~~language)
        const codeBlockMatch = block.match(/^(`{3,4}|~{3,4})([^\n]*)\n?([\s\S]*?)\n?\1$/);
        if (codeBlockMatch) {
          const [, , language, code] = codeBlockMatch;
          return (
            <CodeBlock
              key={index}
              language={language || 'text'}
              value={code}
              isDarkMode={isDarkMode}
              maxHeight={maxCodeBlockHeight}
            />
          );
        }

        // Check for unordered list
        if (block.startsWith('* ') || block.startsWith('- ') || block.startsWith('+ ')) {
          return (
            <List key={index}>
              <ListItem>
                <MarkdownContent
                  content={block.substring(2)}
                  isDarkMode={isDarkMode}
                  onLinkClick={onLinkClick}
                  onImageClick={onImageClick}
                  maxCodeBlockHeight={maxCodeBlockHeight}
                />
              </ListItem>
            </List>
          );
        }

        // Check for ordered list
        const orderedListMatch = block.match(/^(\d+)\. (.*)$/);
        if (orderedListMatch) {
          return (
            <List key={index} ordered>
              <ListItem>
                <MarkdownContent
                  content={orderedListMatch[2]}
                  isDarkMode={isDarkMode}
                  onLinkClick={onLinkClick}
                  onImageClick={onImageClick}
                  maxCodeBlockHeight={maxCodeBlockHeight}
                />
              </ListItem>
            </List>
          );
        }

        // Check for task list
        const taskListMatch = block.match(/^(-|\[x\]|\[ \]) (.*)$/);
        if (taskListMatch) {
          const [, checkbox, text] = taskListMatch;
          const checked = checkbox === '[x]';
          const notChecked = checkbox === '[ ]';
          return (
            <List key={index}>
              <ListItem checked={notChecked ? false : checked}>
                <MarkdownContent
                  content={text}
                  isDarkMode={isDarkMode}
                  onLinkClick={onLinkClick}
                  onImageClick={onImageClick}
                  maxCodeBlockHeight={maxCodeBlockHeight}
                />
              </ListItem>
            </List>
          );
        }

        // Check for image
        const imageMatch = block.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        if (imageMatch) {
          return <Image key={index} src={imageMatch[2]} alt={imageMatch[1]} onClick={onImageClick} />;
        }

        // Check for link
        const linkMatch = block.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
          return (
            <Paragraph key={index}>
              <Link href={linkMatch[2]} onClick={onLinkClick}>
                {linkMatch[1]}
              </Link>
            </Paragraph>
          );
        }

        // Default: render as paragraph with inline formatting
        return (
          <Paragraph key={index}>
            <InlineMarkdown
              content={block}
              onLinkClick={onLinkClick}
            />
          </Paragraph>
        );
      })}
    </>
  );
};

// Component for inline markdown formatting
interface InlineMarkdownProps {
  content: string;
  onLinkClick?: (url: string) => void;
}

const InlineMarkdown: React.FC<InlineMarkdownProps> = ({ content, onLinkClick }) => {
  // Split by markdown formatting
  const parts: React.ReactNode[] = [];
  let remaining = content;

  // Process bold (**text**)
  remaining = processMarkdown(remaining, parts, /\*\*(.*?)\*\*/g, (text) => (
    <Strong key={parts.length}>{text}</Strong>
  ));

  // Process italic (*text* or _text_)
  // Group 1 captures the character before the asterisk (so `**` is not
  // matched as italic); it is re-emitted as plain text by processMarkdown.
  remaining = processMarkdown(remaining, parts, /(^|[^*])\*([^*]+)\*|_([^_]+)_/g, (text) => (
    <Emphasis key={parts.length}>{text}</Emphasis>
  ), [2, 3], 1);

  // Process strikethrough (~~text~~)
  remaining = processMarkdown(remaining, parts, /~~(.*?)~~/g, (text) => (
    <Strikethrough key={parts.length}>{text}</Strikethrough>
  ));

  // Process inline math ($...$ or \(...\)) before inline code
  remaining = processMarkdownMath(remaining, parts);
  // Process inline code (`code`)
  remaining = processMarkdown(remaining, parts, /`([^`]+)`/g, (text) => (
    <InlineCode key={parts.length}>{text}</InlineCode>
  ));

  // Process links
  remaining = processMarkdown(remaining, parts, /\[([^\]]+)\]\(([^)]+)\)/g, (text, link) => (
    <Link key={parts.length} href={link} onClick={onLinkClick}>
      {text}
    </Link>
  ));

  // Add remaining text
  if (remaining) {
    parts.push(remaining);
  }

  return <>{parts}</>;
};

// Helper function to process inline math without breaking other formatting
function processMarkdownMath(
  content: string,
  parts: React.ReactNode[]
): string {
  const regex = /(^|[^\w$\\])\$([^$\n]+?)\$(?=$|[^\w$\\])|\\\(([\s\S]*?)\\\)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const leading = match[1] ?? '';
    const mathStart = match.index + leading.length;
    if (mathStart > lastIndex) {
      parts.push(content.substring(lastIndex, mathStart));
    }
    const tex = (match[2] ?? match[3] ?? '').trim();
    parts.push(<MathInline key={`math-${match.index}`} tex={tex} />);
    lastIndex = match.index + match[0].length;
  }
  return content.substring(lastIndex);
}

// Helper function to process markdown patterns
function processMarkdown(
  content: string,
  parts: React.ReactNode[],
  regex: RegExp,
  replacer: (text: string, ...args: string[]) => React.ReactNode,
  contentGroups: number[] = [1, 2, 3],
  prefixGroup?: number
): string {
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = regex.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }

    // Patterns with a prefix group (e.g. italic) consume a leading character
    // to anchor the match; re-emit it as plain text so nothing is lost.
    if (prefixGroup !== undefined && match[prefixGroup]) {
      parts.push(match[prefixGroup]);
    }

    // Add the formatted text
    const text = contentGroups.map((g) => match?.[g] ?? '').find(Boolean) ?? '';
    parts.push(replacer(text, ...match.slice(1)));

    lastIndex = match.index + match[0].length;
    regex.lastIndex = lastIndex;
  }

  // Return remaining text
  return content.substring(lastIndex);
}

export default React.memo(MarkdownRenderer);
