import { Chat, MemoryEntry, Message } from '../../types';
import { info, warn } from '../logging';
import { validateFileUpload } from '../security';
import type { LibraryFile } from './LibraryStorage';

export interface ExportedChat {
  version: string;
  timestamp: number;
  chats: Chat[];
  /** Optional memory entries (added in v1.1 of the export format) */
  memories?: MemoryEntry[];
  /** Optional library files (added in v1.2 of the export format) */
  library?: LibraryFile[];
}

// Validate a memory entry for export/import
function validateMemoryEntry(entry: unknown): entry is MemoryEntry {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    typeof (entry as MemoryEntry).id === 'string' &&
    typeof (entry as MemoryEntry).content === 'string' &&
    typeof (entry as MemoryEntry).createdAt === 'number' &&
    typeof (entry as MemoryEntry).updatedAt === 'number'
  );
}

// Validate a library file for export/import
function validateLibraryFile(entry: unknown): entry is LibraryFile {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    typeof (entry as LibraryFile).id === 'string' &&
    typeof (entry as LibraryFile).name === 'string' &&
    typeof (entry as LibraryFile).content === 'string' &&
    typeof (entry as LibraryFile).size === 'number' &&
    typeof (entry as LibraryFile).createdAt === 'number' &&
    typeof (entry as LibraryFile).updatedAt === 'number'
  );
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
 * Export chats (and optionally memory entries / library files) as JSON file
 */
export const exportChats = (chats: Chat[], memories: MemoryEntry[] = [], library: LibraryFile[] = []): void => {
  try {
    if (!Array.isArray(chats)) {
      throw new Error('Invalid chats array');
    }

    // Filter out invalid chats
    const validChats = chats.filter(chat => validateChat(chat));

    if (validChats.length === 0) {
      throw new Error('No valid chats to export');
    }

    const validMemories = Array.isArray(memories)
      ? memories.filter((entry) => validateMemoryEntry(entry))
      : [];

    const validLibrary = Array.isArray(library)
      ? library.filter((entry) => validateLibraryFile(entry))
      : [];

    const exportData: ExportedChat = {
      version: '1.2',
      timestamp: Date.now(),
      chats: validChats,
      ...(validMemories.length > 0 ? { memories: validMemories } : {}),
      ...(validLibrary.length > 0 ? { library: validLibrary } : {}),
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

export interface ChatImportResult {
  chats: Chat[];
  memories: MemoryEntry[];
  library: LibraryFile[];
}

/**
 * Import chats (and memory entries / library files, if present) from a JSON file
 */
export const importChats = (file: File): Promise<ChatImportResult> => {
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

        // Note: the raw file content is NOT scanned for code patterns here.
        // Chat messages are data and may legitimately contain code snippets
        // ("require(", "eval(", "import ... from ..." etc.) - scanning for
        // those rejected valid exports. Security is handled by the structural
        // validation below plus sanitizeInput() when the chat is saved.
        const data: ExportedChat = JSON.parse(content);

        // Validate format
        if (!data.version || !Array.isArray(data.chats)) {
          reject(new Error('Invalid import file format'));
          return;
        }

        // Validate version
        if (data.version !== '1.0' && data.version !== '1.1' && data.version !== '1.2') {
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

        // Memory entries are optional (export format 1.0 has none)
        const validMemories = Array.isArray(data.memories)
          ? data.memories.filter((entry: unknown) => {
              if (!validateMemoryEntry(entry)) {
                warn('Invalid memory entry skipped during import');
                return false;
              }
              return true;
            })
          : [];

        // Library files are optional (export formats < 1.2 have none)
        const validLibrary = Array.isArray(data.library)
          ? data.library.filter((entry: unknown) => {
              if (!validateLibraryFile(entry)) {
                warn('Invalid library file skipped during import');
                return false;
              }
              return true;
            })
          : [];

        info(`Successfully imported ${validChats.length} chats`);
        resolve({ chats: validChats, memories: validMemories, library: validLibrary });
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
 * Build shareable markdown text of a single chat
 */
export const buildChatMarkdown = (chat: Chat): string => {
  if (!validateChat(chat)) {
    throw new Error('Invalid chat object');
  }
  if (chat.messages.length === 0) {
    throw new Error('Chat has no messages to share');
  }
  let markdown = `# ${chat.title}\n\n`;
  markdown += `*Created: ${new Date(chat.createdAt).toLocaleString()}*\n\n`;
  chat.messages.forEach((message) => {
    if (!validateMessage(message)) {
      warn('Skipping invalid message in markdown export');
      return;
    }
    const sender = message.role === 'user' ? '\ud83d\udc64 You' : '\ud83e\udd16 Assistant';
    const safeContent = message.content
      .replace(/\*/g, '\\*')
      .replace(/_/g, '\\_')
      .replace(/`/g, '\\`');
    markdown += `## ${sender}\n\n${safeContent}\n\n---\n\n`;
  });
  return markdown;
};

/**
 * Copy a chat as markdown to the clipboard (with legacy execCommand fallback)
 */
export const shareChatToClipboard = async (chat: Chat): Promise<void> => {
  const markdown = buildChatMarkdown(chat);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(markdown);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = markdown;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!ok) {
    throw new Error('Clipboard copy not supported in this browser');
  }
};
