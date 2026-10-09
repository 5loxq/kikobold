import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatBytes } from '../../services/attachments';
import { isAllowedLibraryFile, type LibraryFile } from '../../services/storage/LibraryStorage';

interface LibraryManagerProps {
  files: LibraryFile[];
  onAddFile: (name: string, content: string) => Promise<void>;
  onDeleteFile: (id: string) => Promise<void>;
}

export const LibraryManager: React.FC<LibraryManagerProps> = ({ files, onAddFile, onDeleteFile }) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) {return;}

    try {
      setError(null);
      if (!isAllowedLibraryFile(file)) {
        setError(t('library.errorType', { name: file.name }));
        return;
      }
      const content = await file.text();
      if (!content.trim()) {
        setError(t('library.errorEmpty'));
        return;
      }
      await onAddFile(file.name, content);
      setStatus(t('library.added', { name: file.name }));
      window.setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add file');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 sm:p-8 max-w-3xl mx-auto" data-tour="library-page">
        <h2 className="text-2xl font-bold mb-2 text-zinc-800 dark:text-zinc-100">
          📚 {t('library.title')}
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
          {t('library.introText')}
        </p>

        {/* Add file */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4">
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-2">
            {t('library.addTitle')}
          </p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-3">
            {t('library.addHint')}
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:opacity-90 transition-opacity"
          >
            + {t('library.addFile')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.json,.csv,.tsv,.log,.xml,.yml,.yaml,.ini,.cfg,.ts,.tsx,.js,.jsx,.py,.java,.c,.cpp,.h,.hpp,.cs,.go,.rs,.rb,.php,.sql,.sh,.css,.html"
            onChange={(e) => void handleFileSelected(e)}
            style={{ display: 'none' }}
          />
        </div>

        {error && (
          <div className="mb-4 text-sm px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60">
            {error}
          </div>
        )}
        {status && (
          <div className="mb-4 text-sm px-3 py-2 rounded-xl bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-900/60">
            {status}
          </div>
        )}

        {/* File list */}
        {files.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 text-center">
            <p className="text-zinc-600 dark:text-zinc-400 text-sm">{t('library.empty')}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {files.map((file) => (
              <li
                key={file.id}
                className="bg-white dark:bg-zinc-900 rounded-2xl p-4 shadow-sm border border-zinc-200 dark:border-zinc-800"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      {formatBytes(file.size)} · <code className="text-indigo-600 dark:text-indigo-400">@{file.name.replace(/\.[^.]+$/, '')}</code>
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => setPreviewId(previewId === file.id ? null : file.id)}
                      className="p-2 text-sm rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      aria-label={t('library.preview')}
                    >
                      👁️
                    </button>
                    <button
                      onClick={() => void onDeleteFile(file.id)}
                      className="p-2 text-sm rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      aria-label={t('common.delete')}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                {previewId === file.id && (
                  <pre className="mt-3 max-h-64 overflow-auto text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl p-3 whitespace-pre-wrap break-words">
                    {file.content.slice(0, 2000)}
                    {file.content.length > 2000 ? '\n...' : ''}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* How to reference */}
        <div className="mt-4 bg-white dark:bg-zinc-900 rounded-2xl p-5 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 mb-2">
            {t('library.howToTitle')}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {t('library.howToText')}
          </p>
        </div>
      </div>
    </div>
  );
};
