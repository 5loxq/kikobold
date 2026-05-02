import React from 'react';
import { useTranslation } from 'react-i18next';
import { Message } from '../../types';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  messagesEndRef?: React.RefObject<HTMLDivElement>;
}

// Memoized message component to prevent re-renders
const MessageBubble: React.FC<{
  message: Message;
}> = React.memo(({ message }) => {
  const isUser = message.role === 'user';
  const timeStr = React.useMemo(
    () => new Date(message.timestamp).toLocaleTimeString(),
    [message.timestamp]
  );

  // Use useMemo for the content to prevent re-renders when content hasn't changed
  const content = React.useMemo(() => message.content, [message.content]);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-none'
            : 'bg-gray-200 text-gray-800 rounded-bl-none'
        }`}
      >
        <p className="whitespace-pre-wrap break-words text-sm">
          {content}
        </p>
        <p className={`text-xs mt-1 ${
          isUser ? 'text-blue-100' : 'text-gray-500'
        }`}>
          {timeStr}
        </p>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.timestamp === nextProps.message.timestamp &&
    prevProps.message.role === nextProps.message.role
  );
});

// Custom equality function for messages array
function areMessagesEqual(
  prevProps: MessageListProps,
  nextProps: MessageListProps
): boolean {
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

export const MessageList: React.FC<MessageListProps> = React.memo(
  ({ messages, isLoading, messagesEndRef }) => {
    const { t } = useTranslation();

    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>{t('chat.noMessagesYet')}</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg rounded-bl-none">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}

        {messagesEndRef && <div ref={messagesEndRef} />}
      </div>
    );
  },
  areMessagesEqual
);

export default MessageList;
