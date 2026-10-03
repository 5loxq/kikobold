import React from 'react';
import { useTranslation } from 'react-i18next';
import { Message } from '../../types';
import MarkdownRenderer from './MarkdownRenderer';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
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
  const [copied, setCopied] = React.useState(false);
  const handleCopy = React.useCallback((): void => {
    void navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }, [message.content]);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-xs lg:max-w-2xl px-5 py-3 rounded-2xl shadow-sm ${
          isUser
            ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-br-2xl'
            : 'bg-white text-gray-800 rounded-bl-2xl border border-gray-100'
        }`}
      >
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {searchQuery?.trim() && !isUser ? (
            <HighlightedText text={content} query={searchQuery} isUser={isUser} />
          ) : (
            <MarkdownRenderer
              content={content}
              isDarkMode={isDarkMode}
              className="markdown-message"
            />
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className={`text-xs opacity-70 ${
            isUser ? 'text-blue-100' : 'text-gray-500'
          }`}>
            {timeStr}
          </p>
          <button
            type="button"
            onClick={handleCopy}
            className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
              isUser ? 'text-blue-100 hover:bg-blue-500/40' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
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
  
  // Check if the last message is the same (most common case for chat)
  const prevLast = prevProps.messages[prevProps.messages.length - 1];
  const nextLast = nextProps.messages[nextProps.messages.length - 1];
  
  if (!prevLast || !nextLast || prevLast.id !== nextLast.id) {
    return false;
  }
  
  // For simplicity, we'll re-render if the last message changed
  // This could be optimized further with deep comparison if needed
  return prevLast.content === nextLast.content && 
         prevLast.timestamp === nextLast.timestamp;
}

const MessageListInner: React.FC<MessageListProps> = ({ messages, isLoading, streamingMessage, messagesEndRef, isDarkMode, searchQuery }) => {
    const { t } = useTranslation();

    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 max-h-[calc(100vh-300px)]">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <div className="text-4xl mb-4">💬</div>
            <p className="text-lg font-medium">{t('chat.noMessagesYet')}</p>
            <p className="text-sm mt-2 text-gray-500">{t('chat.startConversation')}</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="animate-fade-in">
              <MessageBubble message={message} isDarkMode={isDarkMode} searchQuery={searchQuery} />
            </div>
          ))
        )}

        {streamingMessage && (
          <div className="flex justify-start">
            <div className={`px-5 py-3 rounded-2xl rounded-bl-2xl border shadow-sm ${
              isDarkMode ? 'bg-gray-800 text-gray-200 border-gray-700' : 'bg-white text-gray-800 border-gray-100'
            }`}>
              <div className="whitespace-pre-wrap break-words text-sm">{streamingMessage}<span className="animate-pulse">▍</span></div>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className={`px-5 py-3 rounded-2xl rounded-bl-2xl border shadow-sm ${
              isDarkMode ? 'bg-gray-800 text-gray-200 border-gray-700' : 'bg-white text-gray-800 border-gray-100'
            }`}>
              <div className="flex gap-1.5 items-center">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-typing-bounce" style={{ animationDelay: '0s' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-typing-bounce" style={{ animationDelay: '0.15s' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-typing-bounce" style={{ animationDelay: '0.3s' }}></div>
                </div>
                <span className="ml-2 text-gray-400 text-sm">{t('chat.thinking')}</span>
              </div>
            </div>
          </div>
        )}

        {messagesEndRef && <div ref={messagesEndRef} />}
      </div>
    );
};

export const MessageList = React.memo(MessageListInner, areMessagesEqual);
MessageList.displayName = 'MessageList';

export default MessageList;
