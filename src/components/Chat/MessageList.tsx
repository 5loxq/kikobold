import React from 'react';
import { useTranslation } from 'react-i18next';
import { Message } from '../../types';
import MarkdownRenderer from './MarkdownRenderer';
import { splitThinking, ThinkingBlock } from './ThinkingBlock';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  /** True while a model is being downloaded/loaded (not while generating) */
  isModelLoading?: boolean;
  streamingMessage?: string | null;
  messagesEndRef?: React.RefObject<HTMLDivElement>;
  searchQuery?: string;
  /** Message focused via keyboard navigation (J/K) - gets a visible ring */
  focusedMessageId?: string | null;
  /** Message currently being read aloud */
  speakingMessageId?: string | null;
  /** Read a message aloud / stop the speech (read-aloud button) */
  onToggleSpeak?: (messageId: string, content: string) => void;
}

interface MessageBubbleProps {
  message: Message;
  searchQuery?: string;
  focusedMessageId?: string | null;
  speakingMessageId?: string | null;
  onToggleSpeak?: (messageId: string, content: string) => void;
}

// Memoized message component to prevent re-renders
export const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const HighlightedText: React.FC<{ text: string; query: string; isUser: boolean }> = ({ text, query, isUser }) => {
  const trimmed = query.trim();
  // Build the split parts once per text/query instead of compiling a new
  // RegExp on every render of every message bubble.
  const parts = React.useMemo(() => {
    if (!trimmed) {return null;}
    const escaped = escapeRegExp(trimmed);
    const splitParts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return splitParts.length === 1 ? null : splitParts;
  }, [text, trimmed]);
  if (!trimmed || !parts) {return <>{text}</>;}
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <mark key={i} className={isUser ? 'bg-yellow-300/80 text-gray-900 rounded px-0.5' : 'bg-yellow-200 text-gray-900 rounded px-0.5'}>
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
};

const MessageBubbleInner: React.FC<MessageBubbleProps> = ({ message, searchQuery, focusedMessageId, speakingMessageId, onToggleSpeak }) => {
  const { t } = useTranslation();
  const isUser = message.role === 'user';
  const isFocused = focusedMessageId === message.id;
  const isSpeaking = speakingMessageId === message.id;
  const timeStr = React.useMemo(
    () => new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    [message.timestamp]
  );

  // Split a possible thinking block (`` ... ``) from the answer
  const { thinking, answer } = React.useMemo(() => splitThinking(message.content), [message.content]);
  const [copied, setCopied] = React.useState(false);
  const copyTimerRef = React.useRef<number | null>(null);
  const handleCopy = React.useCallback((): void => {
    void navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 1500);
    }).catch(() => {
      // Clipboard access can fail (e.g. lost focus) - just do nothing.
    });
  }, [message.content]);
  React.useEffect((): (() => void) => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        data-message-id={message.id}
        className={`max-w-xs lg:max-w-2xl px-5 py-3.5 shadow-sm ${
          isFocused ? 'ring-2 ring-indigo-500 dark:ring-indigo-400' : ''
        } ${
          isUser
            ? 'bg-indigo-700 text-white rounded-3xl rounded-br-lg'
            : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-3xl rounded-bl-lg border border-zinc-100 dark:border-zinc-700'
        }`}
      >
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {/* Speaker label for screen readers - visual users have the bubble
              alignment, assistive technology gets an explicit "who said it" */}
          <span className="sr-only">{isUser ? `${t('a11y.userMessage')}: ` : `${t('a11y.assistantMessage')}: `}</span>
          {!isUser && thinking !== null && <ThinkingBlock thinking={thinking} />}
          {/* While searching, matches are highlighted in user AND assistant
              messages; markdown formatting is skipped then so the hits stay
              visible as plain text. */}
          {searchQuery?.trim() ? (
            <HighlightedText text={answer} query={searchQuery} isUser={isUser} />
          ) : (
            <MarkdownRenderer
              content={answer}
              className="markdown-message"
            />
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className={`text-xs ${
            isUser ? 'text-white' : 'text-zinc-600 dark:text-zinc-400'
          }`}>
            {timeStr}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleSpeak?.(message.id, message.content)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                isUser
                  ? 'text-white hover:bg-white/20'
                  : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-300'
              }`}
              title={isSpeaking ? t('chat.stopSpeaking') : t('chat.readAloud')}
              aria-label={isSpeaking ? t('chat.stopSpeaking') : t('chat.readAloud')}
              aria-pressed={isSpeaking}
            >
              {isSpeaking ? '⏹' : '🔊'}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                isUser
                  ? 'text-white hover:bg-white/20'
                  : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-300'
              }`}
              title={copied ? t('chat.copied') : t('chat.copyMessage')}
              aria-label={copied ? t('chat.copied') : t('chat.copyMessage')}
            >
              {copied ? '✓' : '⧉'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const MessageBubble = React.memo(MessageBubbleInner, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.timestamp === nextProps.message.timestamp &&
    prevProps.message.role === nextProps.message.role &&
    prevProps.searchQuery === nextProps.searchQuery &&
    prevProps.focusedMessageId === nextProps.focusedMessageId &&
    prevProps.speakingMessageId === nextProps.speakingMessageId &&
    prevProps.onToggleSpeak === nextProps.onToggleSpeak
  );
});

const StreamingBubble: React.FC<{ content: string }> = ({ content }) => {
  const { thinking, answer, isThinkingActive } = splitThinking(content);
  return (
    <div className="flex justify-start">
      <div className="px-5 py-3.5 rounded-3xl rounded-bl-lg border shadow-sm bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 border-zinc-100 dark:border-zinc-700">
        {/* Render the streaming text as markdown right away - showing raw
            **markers** while the model types reads like a bug to users. */}
        {thinking !== null && <ThinkingBlock thinking={thinking} isActive={isThinkingActive} />}
        <div className="text-sm leading-relaxed">
          <MarkdownRenderer content={answer} className="markdown-message" />
          <span className="animate-pulse">▍</span>
        </div>
      </div>
    </div>
  );
};

// How many messages render initially; scrolling to the top loads more.
// Keeps long chats (hundreds of messages) smooth without full windowing.
const MESSAGE_PAGE_SIZE = 50;

const MessageListInner: React.FC<MessageListProps> = ({ messages, isLoading, isModelLoading, streamingMessage, messagesEndRef, searchQuery, focusedMessageId, speakingMessageId, onToggleSpeak }) => {
    const { t } = useTranslation();
    const [visibleCount, setVisibleCount] = React.useState(MESSAGE_PAGE_SIZE);
    const scrollRef = React.useRef<HTMLDivElement>(null);
    // Scroll position bookkeeping so prepending older messages does not jump
    const layoutRef = React.useRef({ hiddenCount: 0, scrollHeight: 0 });

    // Grow the visible window with the list: without this, every new
    // message in a chat longer than one page would unmount the topmost
    // visible message while the user is reading it.
    const prevMessageCountRef = React.useRef(messages.length);
    React.useEffect(() => {
      const delta = messages.length - prevMessageCountRef.current;
      prevMessageCountRef.current = messages.length;
      if (delta > 0) {
        setVisibleCount((count) => Math.min(count + delta, messages.length));
      }
    }, [messages.length]);

    const visibleMessages = React.useMemo(
      () => messages.slice(Math.max(0, messages.length - visibleCount)),
      [messages, visibleCount]
    );
    const hiddenCount = messages.length - visibleMessages.length;

    const loadMore = React.useCallback((): void => {
      setVisibleCount((count) => count + MESSAGE_PAGE_SIZE);
    }, []);

    const handleScroll = React.useCallback((): void => {
      const el = scrollRef.current;
      if (!el || hiddenCount <= 0 || el.scrollTop > 120) {
        return;
      }
      loadMore();
    }, [hiddenCount, loadMore]);

    // When older messages get prepended, keep the current view anchored:
    // shift the scroll position by the height the older messages added.
    React.useLayoutEffect(() => {
      const el = scrollRef.current;
      if (!el) {
        return;
      }
      const prev = layoutRef.current;
      if (hiddenCount < prev.hiddenCount && prev.scrollHeight > 0) {
        el.scrollTop += el.scrollHeight - prev.scrollHeight;
      }
      layoutRef.current = { hiddenCount, scrollHeight: el.scrollHeight };
    }, [hiddenCount, visibleMessages]);

    return (
      <div ref={scrollRef} onScroll={handleScroll} className="messages-scroll flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto w-full">
        {messages.length === 0 ? (
          <div className="text-center text-zinc-600 dark:text-zinc-400 py-12">
            <div className="text-4xl mb-4">💬</div>
            <p className="text-lg font-medium">{t('chat.noMessagesYet')}</p>
            <p className="text-sm mt-2 text-zinc-600 dark:text-zinc-400">{t('chat.startConversation')}</p>
          </div>
        ) : (
          <>
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={loadMore}
                className="block mx-auto mb-3 px-4 py-1.5 rounded-xl text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                ↑ {t('chat.olderMessages', { count: hiddenCount })}
              </button>
            )}
            {visibleMessages.map((message) => (
              <div key={message.id} className="animate-fade-in">
                <MessageBubble
                  message={message}
                  searchQuery={searchQuery}
                  focusedMessageId={focusedMessageId}
                  speakingMessageId={speakingMessageId}
                  onToggleSpeak={onToggleSpeak}
                />
              </div>
            ))}
          </>
        )}

        {streamingMessage && (
          <StreamingBubble content={streamingMessage} />
        )}

        {isModelLoading && (
          <div className="flex justify-start">
            <div className="px-5 py-3.5 rounded-3xl rounded-bl-lg border shadow-sm bg-white dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700">
              <div className="flex gap-2.5 items-center">
                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-zinc-600 dark:text-zinc-400 text-sm">{t('chat.modelLoading')}</span>
              </div>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="px-5 py-3.5 rounded-3xl rounded-bl-lg border shadow-sm bg-white dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700">
              <div className="flex gap-1.5 items-center">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-typing-bounce" style={{ animationDelay: '0s' }}></div>
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-typing-bounce" style={{ animationDelay: '0.15s' }}></div>
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-typing-bounce" style={{ animationDelay: '0.3s' }}></div>
                </div>
                <span className="ml-2 text-zinc-600 dark:text-zinc-400 text-sm">{t('chat.thinking')}</span>
              </div>
            </div>
          </div>
        )}

        {messagesEndRef && <div ref={messagesEndRef} />}
        </div>
      </div>
    );
};

// The list is memoized with a shallow comparison: every prop is either a
// primitive or a stable ref except `messages`, and a changed message list
// always arrives as a new array reference - exactly what the shallow check
// needs. The previous deep comparison saved nothing in practice.
export const MessageList = React.memo(MessageListInner);
MessageList.displayName = 'MessageList';

export default MessageList;
