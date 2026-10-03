export interface DocumentAttachment {
  id: string;
  name: string;
  size: number;
  text: string;
}

const MAX_FILE_SIZE = 512 * 1024;
const MAX_ATTACHMENTS = 3;
const ALLOWED_EXTENSIONS = ['txt', 'md', 'json', 'csv', 'tsv', 'log', 'xml', 'yml', 'yaml', 'ini', 'cfg', 'ts', 'tsx', 'js', 'jsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'rb', 'php', 'sql', 'sh', 'css', 'html'];

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
  const docs = attachments
    .map((doc) => `--- Document: ${doc.name} ---\n${doc.text}\n--- End of document ---`)
    .join('\n\n');
  return `${message}\n\nThe user attached the following documents. Use them as context:\n\n${docs}`;
};

export const ATTACHMENT_LIMITS = { MAX_FILE_SIZE, MAX_ATTACHMENTS };

export const formatBytes = (size: number): string => {
  if (size < 1024) {return `${size} B`;}
  if (size < 1024 * 1024) {return `${(size / 1024).toFixed(1)} KB`;}
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};
