import { Chat, Message } from '../../types';
import { info, warn } from '../logging';
import { validateFileUpload, validateJsonContent } from '../security';

export interface ExportedChat {
  version: string;
  timestamp: number;
  chats: Chat[];
}

// Validate chat object for export/import
function validateChat(chat: unknown): chat is Chat {
  return (
    typeof chat === 'object' &&
    chat !== null &&
    typeof (chat as Chat).id === 'string' &&
    typeof (chat as Chat).title === 'string' &&
    Array.isArray((chat as Chat).messages) &&
    typeof (chat as Chat).profileId === 'string' &&
    typeof (chat as Chat).createdAt === 'number' &&
    typeof (chat as Chat).updatedAt === 'number'
  );
}

// Validate message object for export/import
function validateMessage(message: unknown): boolean {
  return (
    typeof message === 'object' &&
    message !== null &&
    typeof (message as Message).id === 'string' &&
    ((message as Message).role === 'user' || (message as Message).role === 'assistant') &&
    typeof (message as Message).content === 'string' &&
    typeof (message as Message).timestamp === 'number'
  );
}

/**
 * Export chats as JSON file
 */
export const exportChats = (chats: Chat[]): void => {
  try {
    if (!Array.isArray(chats)) {
      throw new Error('Invalid chats array');
    }

    // Filter out invalid chats
    const validChats = chats.filter(chat => validateChat(chat));
    
    if (validChats.length === 0) {
      throw new Error('No valid chats to export');
    }

    const exportData: ExportedChat = {
      version: '1.0',
      timestamp: Date.now(),
      chats: validChats,
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chats-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export chats:', error);
    throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Import chats from JSON file
 */
export const importChats = (file: File): Promise<Chat[]> => {
  return new Promise((resolve, reject) => {
    // Validate file input using security utilities
    const fileValidation = validateFileUpload(file, 10, ['.json']); // 10MB max size, only .json
    if (!fileValidation.valid) {
      reject(new Error(`Invalid file: ${fileValidation.error ?? 'too large or wrong type'}`));
      return;
    }

    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      reject(new Error('File must be a JSON file'));
      return;
    }

    const reader = new FileReader();

    reader.onload = (event): void => {
      try {
        const content = event.target?.result as string;
        if (typeof content !== 'string' || content.trim().length === 0) {
          reject(new Error('File is empty or contains invalid content'));
          return;
        }

        // Validate JSON content for security
        const contentValidation = validateJsonContent(content);
        if (!contentValidation.valid) {
          reject(new Error(`Invalid content: ${contentValidation.error ?? 'Unknown error'}`));
          return;
        }

        const data: ExportedChat = JSON.parse(content);

        // Validate format
        if (!data.version || !Array.isArray(data.chats)) {
          reject(new Error('Invalid import file format'));
          return;
        }

        // Validate version
        if (data.version !== '1.0') {
          warn(`Import file version ${data.version} may not be fully compatible`);
        }

        // Validate each chat and its messages
        const validChats = data.chats.filter((chat: unknown) => {
          if (!validateChat(chat)) {
            warn(`Invalid chat skipped during import: ${(chat as Chat).id || 'unknown'}`);
            return false;
          }
          
          // Validate all messages in the chat
          return chat.messages.every(message => validateMessage(message));
        });

        if (validChats.length === 0) {
          reject(new Error('No valid chats found in import file'));
          return;
        }

        info(`Successfully imported ${validChats.length} chats`);
        resolve(validChats);
      } catch (error) {
        console.error('Import error:', error);
        reject(new Error(`Failed to parse import file: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };

    reader.onerror = (): void => {
      console.error('File reader error:', reader.error);
      reject(new Error('Failed to read file'));
    };

    try {
      reader.readAsText(file);
    } catch (error) {
      console.error('Failed to start file reading:', error);
      reject(new Error('Failed to read file'));
    }
  });
};

/**
 * Export single chat as markdown
 */
export const exportChatAsMarkdown = (chat: Chat): void => {
  try {
    if (!validateChat(chat)) {
      throw new Error('Invalid chat object');
    }

    if (chat.messages.length === 0) {
      throw new Error('Chat has no messages to export');
    }

    let markdown = `# ${chat.title}\n\n`;
    markdown += `*Created: ${new Date(chat.createdAt).toLocaleString()}*\n\n`;

    chat.messages.forEach((message) => {
      if (!validateMessage(message)) {
        warn('Skipping invalid message in markdown export');
        return;
      }
      
      const sender = message.role === 'user' ? '👤 You' : '🤖 Assistant';
      // Escape special markdown characters in content
      const safeContent = message.content
        .replace(/\*/g, '\\*')
        .replace(/_/g, '\\_')
        .replace(/`/g, '\\`');
      markdown += `## ${sender}\n\n${safeContent}\n\n---\n\n`;
    });

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Create safe filename
    const safeTitle = chat.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').substring(0, 50);
    link.download = `${safeTitle}-${new Date().toISOString().split('T')[0]}.md`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export chat as markdown:', error);
    throw new Error(`Markdown export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
