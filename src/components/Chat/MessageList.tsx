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
  isDarkMode?: boolean;
  searchQuery?: string;
}

interface MessageBubbleProps {
  message: Message;
  isDarkMode?: boolean;
  searchQuery?: string;
}

// Memoized message component to prevent re-renders
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const HighlightedText: React.FC<{ text: string; query: string; isUser: boolean }> = ({ text, query, isUser }) => {
  if (!query.trim()) {return <>{text}</>;}
  const escaped = escapeRegExp(query.trim());
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  if (parts.length === 1) {return <>{text}</>;}
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.trim().toLowerCase() ? (
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

const MessageBubbleInner: React.FC<MessageBubbleProps> = ({ message, isDarkMode, searchQuery }) => {
  const { t } = useTranslation();
  const isUser = message.role === 'user';
  const timeStr = React.useMemo(
    () => new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    [message.timestamp]
  );

  // Use useMemo for the content to prevent re-renders when content hasn't changed
  const content = React.useMemo(() => message.content, [message.content]);
  // Split a possible thinking block (`` ... ``) from the answer
  const { thinking, answer } = React.useMemo(() => splitThinking(content), [content]);
  const [copied, setCopied] = React.useState(false);
  const handleCopy = React.useCallback((): void => {
    void navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }, [message.content]);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-xs lg:max-w-2xl px-5 py-3.5 shadow-sm ${
          isUser
            ? 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-3xl rounded-br-lg'
            : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-3xl rounded-bl-lg border border-zinc-100 dark:border-zinc-700'
        }`}
      >
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {!isUser && thinking !== null && <ThinkingBlock thinking={thinking} />}
          {/* While searching, matches are highlighted in user AND assistant
              messages; markdown formatting is skipped then so the hits stay
              visible as plain text. */}
          {searchQuery?.trim() ? (
            <HighlightedText text={answer} query={searchQuery} isUser={isUser} />
          ) : (
            <MarkdownRenderer
              content={answer}
              isDarkMode={isDarkMode}
              className="markdown-message"
            />
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className={`text-xs opacity-60 ${
            isUser ? 'text-indigo-100' : 'text-zinc-400 dark:text-zinc-500'
          }`}>
            {timeStr}
          </p>
          <button
            type="button"
            onClick={handleCopy}
            className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
              isUser
                ? 'text-indigo-100 hover:bg-white/20'
                : 'text-zinc-400 hover:bg-zinc-100 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-300'
            }`}
            title={copied ? t('chat.copied') : t('chat.copyMessage')}
          >
            {copied ? '✓' : '⧉'}
          </button>
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
    prevProps.isDarkMode === nextProps.isDarkMode &&
    prevProps.searchQuery === nextProps.searchQuery
  );
});

// Custom equality function for messages array
function areMessagesEqual(
  prevProps: MessageListProps,
  nextProps: MessageListProps
): boolean {
  // Streaming message, loading state, search and theme always force a re-render
  if (
    prevProps.streamingMessage !== nextProps.streamingMessage ||
    prevProps.isLoading !== nextProps.isLoading ||
    prevProps.isModelLoading !== nextProps.isModelLoading ||
    prevProps.searchQuery !== nextProps.searchQuery ||
    prevProps.isDarkMode !== nextProps.isDarkMode
  ) {
    return false;
  }
  // Only re-render if messages array reference changes or length changes
  // This prevents unnecessary re-renders when only other props change
  if (prevProps.messages === nextProps.messages) {
    return true;
  }
  
  // If lengths are different, we need to re-render
  if (prevProps.messages.length !== nextProps.messages.length) {
    return false;
  }

  // Compare all messages: a change in the middle of the list (e.g. after a
  // backup import) must re-render too, not just a changed last message.
  return prevProps.messages.every(
    (message, index) =>
      message.id === nextProps.messages[index].id &&
      message.content === nextProps.messages[index].content &&
      message.timestamp === nextProps.messages[index].timestamp
  );
}

const StreamingBubble: React.FC<{ content: string; isDarkMode?: boolean }> = ({ content, isDarkMode }) => {
  const { thinking, answer, isThinkingActive } = splitThinking(content);
  return (
    <div className="flex justify-start">
      <div className={`px-5 py-3.5 rounded-3xl rounded-bl-lg border shadow-sm ${
        isDarkMode ? 'bg-zinc-800 text-zinc-100 border-zinc-700' : 'bg-white text-zinc-800 border-zinc-100'
      }`}>
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {thinking !== null && <ThinkingBlock thinking={thinking} isActive={isThinkingActive} />}
          {answer}
          <span className="animate-pulse">▍</span>
        </div>
      </div>
    </div>
  );
};

const MessageListInner: React.FC<MessageListProps> = ({ messages, isLoading, isModelLoading, streamingMessage, messagesEndRef, isDarkMode, searchQuery }) => {
    const { t } = useTranslation();

    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6 max-h-[calc(100vh-320px)]">
        <div className="max-w-3xl mx-auto w-full">
        {messages.length === 0 ? (
          <div className="text-center text-zinc-400 dark:text-zinc-500 py-12">
            <div className="text-4xl mb-4">💬</div>
            <p className="text-lg font-medium">{t('chat.noMessagesYet')}</p>
            <p className="text-sm mt-2 text-zinc-500 dark:text-zinc-500">{t('chat.startConversation')}</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="animate-fade-in">
              <MessageBubble message={message} isDarkMode={isDarkMode} searchQuery={searchQuery} />
            </div>
          ))
        )}

        {streamingMessage && (
          <StreamingBubble content={streamingMessage} isDarkMode={isDarkMode} />
        )}

        {isModelLoading && (
          <div className="flex justify-start">
            <div className={`px-5 py-3.5 rounded-3xl rounded-bl-lg border shadow-sm ${
              isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-100'
            }`}>
              <div className="flex gap-2.5 items-center">
                <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-zinc-500 dark:text-zinc-400 text-sm">{t('chat.modelLoading')}</span>
              </div>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className={`px-5 py-3.5 rounded-3xl rounded-bl-lg border shadow-sm ${
              isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-100'
            }`}>
              <div className="flex gap-1.5 items-center">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-typing-bounce" style={{ animationDelay: '0s' }}></div>
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-typing-bounce" style={{ animationDelay: '0.15s' }}></div>
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-typing-bounce" style={{ animationDelay: '0.3s' }}></div>
                </div>
                <span className="ml-2 text-zinc-400 dark:text-zinc-500 text-sm">{t('chat.thinking')}</span>
              </div>
            </div>
          </div>
        )}

        {messagesEndRef && <div ref={messagesEndRef} />}
        </div>
      </div>
    );
};

export const MessageList = React.memo(MessageListInner, areMessagesEqual);
MessageList.displayName = 'MessageList';

export default MessageList;
