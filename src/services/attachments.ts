export interface DocumentAttachment {
  id: string;
  name: string;
  size: number;
  text: string;
}

export const MAX_FILE_SIZE = 512 * 1024;
const MAX_ATTACHMENTS = 3;
// Attached documents are injected into the prompt verbatim, so their text must
// be capped to fit the small context windows of the local models (~4 chars per
// token, 4096-token context shared with system prompt, memory and history).
export const MAX_DOC_PROMPT_CHARS = 4000;
export const MAX_TOTAL_DOC_PROMPT_CHARS = 10000;
// Also used by the library (LibraryStorage) to decide which files it accepts
export const ALLOWED_EXTENSIONS = ['txt', 'md', 'json', 'csv', 'tsv', 'log', 'xml', 'yml', 'yaml', 'ini', 'cfg', 'ts', 'tsx', 'js', 'jsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'rb', 'php', 'sql', 'sh', 'css', 'html'];

export const isAllowedDocument = (file: File): boolean => {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ALLOWED_EXTENSIONS.includes(ext) && file.size <= MAX_FILE_SIZE;
};

export const extractDocumentText = (file: File): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (): void => resolve(String(reader.result ?? ''));
    reader.onerror = (): void => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsText(file);
  });

export const createDocumentAttachment = async (file: File): Promise<DocumentAttachment> => {
  if (!isAllowedDocument(file)) {
    throw new Error(`Unsupported file: ${file.name}`);
  }
  const text = await extractDocumentText(file);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    size: file.size,
    text,
  };
};

export const buildPromptWithDocuments = (message: string, attachments: DocumentAttachment[]): string => {
  if (attachments.length === 0) {return message;}
  let budget = MAX_TOTAL_DOC_PROMPT_CHARS;
  const docs = attachments
    .map((doc) => {
      // Wrapper overhead (header, end marker, truncation note, joins) counts
      // against the budget too - otherwise the final prompt overshoots the
      // limit by the wrapper length of every document.
      const wrapperOverhead =
        doc.name.length + '--- Document:  ---\n--- End of document ---'.length + 2;
      const limit = Math.max(0, Math.min(MAX_DOC_PROMPT_CHARS, budget - wrapperOverhead));
      if (limit === 0) {
        // Budget used up: skip the document entirely instead of injecting
        // an empty header.
        return null;
      }
      const truncated = doc.text.length > limit;
      const text = truncated
        ? `${doc.text.slice(0, limit)}\n[... document truncated ...]`
        : doc.text;
      // The truncation marker is part of the prompt: count it against the
      // budget so the final prompt stays within the declared limit.
      const markerOverhead = truncated ? '\n[... document truncated ...]'.length : 0;
      budget -= wrapperOverhead + markerOverhead + Math.min(limit, doc.text.length);
      return `--- Document: ${doc.name} ---\n${text}\n--- End of document ---`;
    })
    .filter((doc): doc is string => doc !== null)
    .join('\n\n');
  if (docs.length === 0) {return message;}
  return `${message}\n\nThe user attached the following documents. Use them as context:\n\n${docs}`;
};

export interface ImageAttachment {
  id: string;
  name: string;
  size: number;
  data: ArrayBuffer;
  previewUrl: string;
}

export const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export const isAllowedImage = (file: File): boolean => {
  return ALLOWED_IMAGE_TYPES.includes(file.type) && file.size <= MAX_IMAGE_SIZE;
};

export const createImageAttachment = (file: File): Promise<ImageAttachment> =>
  new Promise<ImageAttachment>((resolve, reject) => {
    if (!isAllowedImage(file)) {
      reject(new Error(`Unsupported image: ${file.name}`));
      return;
    }
    const reader = new FileReader();
    reader.onload = (): void => {
      resolve({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        size: file.size,
        data: reader.result as ArrayBuffer,
        previewUrl: URL.createObjectURL(file),
      });
    };
    reader.onerror = (): void => reject(reader.error ?? new Error('Failed to read image'));
    reader.readAsArrayBuffer(file);
  });

export const ATTACHMENT_LIMITS = { MAX_FILE_SIZE, MAX_ATTACHMENTS };

export const formatBytes = (size: number): string => {
  if (size < 1024) {return `${size} B`;}
  if (size < 1024 * 1024) {return `${(size / 1024).toFixed(1)} KB`;}
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};
