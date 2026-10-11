import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { error, log } from '../../services/logging';
import { sanitizeInputLight } from '../../services/security';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { type LibraryFile } from '../../services/storage/LibraryStorage';
import {
  ATTACHMENT_LIMITS,
  createDocumentAttachment,
  createImageAttachment,
  DOC_ACCEPT_ATTRIBUTE,
  type DocumentAttachment,
  formatBytes,
  type ImageAttachment,
  isAllowedDocument,
  isAllowedImage,
} from '../../services/attachments';

interface InputBoxProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isModelLoaded: boolean;
  /** Whether a model is selected (it may not be loaded yet) */
  hasModelSelected?: boolean;
  isGenerating?: boolean;
  onStopGeneration?: () => void;
  onSendMessageWithDocuments?: (message: string, attachments: DocumentAttachment[]) => void;
  supportsImageInput?: boolean;
  onSendMessageWithImages?: (message: string, images: ImageAttachment[]) => void;
  /** Library files offered in the "@" mention autocomplete */
  libraryFiles?: LibraryFile[];
}

// Type definition for SpeechRecognition API
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  onstart: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionType {
  new (): SpeechRecognitionInstance;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  onstart: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  [0]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionErrorEvent {
  error: string | Error;
}

// Get SpeechRecognition API with proper typing
const getSpeechRecognition = (): SpeechRecognitionType | null => {
  if ('SpeechRecognition' in window) {
    return (window as Window & { SpeechRecognition?: unknown }).SpeechRecognition as SpeechRecognitionType;
  }
  if ('webkitSpeechRecognition' in window) {
    return (window as Window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition as SpeechRecognitionType;
  }
  return null;
};

const SpeechRecognition = getSpeechRecognition();

/**
 * Detect an active "@" mention: the caret must sit after an "@" that starts
 * the text or follows whitespace. The query is everything between the "@"
 * and the caret and may contain spaces - file names can too. Scans backwards
 * from the caret so earlier "@" occurrences do not shadow the current token.
 */
export const detectMention = (value: string, caret: number): { query: string; startIndex: number } | null => {
  const before = value.slice(0, caret);
  for (let i = before.length - 1; i >= 0; i--) {
    if (before[i] === '@') {
      if (i === 0 || /\s/.test(before[i - 1])) {
        return { query: before.slice(i + 1), startIndex: i };
      }
      return null;
    }
  }
  return null;
};

export const InputBox: React.FC<InputBoxProps> = ({
  onSendMessage,
  isLoading,
  isModelLoaded,
  hasModelSelected = false,
  isGenerating = false,
  onStopGeneration,
  onSendMessageWithDocuments,
  supportsImageInput = false,
  onSendMessageWithImages,
  libraryFiles = [],
}) => {
  const { t, i18n } = useTranslation();
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<DocumentAttachment[]>([]);
  const [isAttaching, setIsAttaching] = useState(false);
  const [images, setImages] = useState<ImageAttachment[]>([]);
  // Mirrors `images` for the unmount cleanup: the effect below runs with an
  // empty dependency array, so it must not close over a stale empty array.
  const imagesRef = useRef<ImageAttachment[]>([]);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [previewImage, setPreviewImage] = useState<ImageAttachment | null>(null);
  // Focus trap for the fullscreen image preview (Esc closes, Tab stays inside)
  const previewTrapRef = useFocusTrap(previewImage !== null, () => setPreviewImage(null));

  // "@" mention autocomplete: active while the caret is right after an
  // @token (at the start of the text or after whitespace). `startIndex`
  // points at the "@" itself; `query` is what the user typed after it.
  const [mention, setMention] = useState<ReturnType<typeof detectMention>>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  // Start index of the @token the user dismissed with Escape - the popup
  // stays closed for this token until a different one is started.
  const dismissedMentionRef = useRef<number | null>(null);
  // Library picker opened via the 📚 button: shows all files, no query
  const [pickerOpen, setPickerOpen] = useState(false);

  // Only file names the resolver can handle are offered: no "@" inside the
  // name (spaces, umlauts, accents and punctuation are all fine - the
  // resolver matches by longest file name).
  const mentionableFiles = useMemo(() => {
    return libraryFiles.filter((file) => file.name.length > 0 && !file.name.includes('@'));
  }, [libraryFiles]);

  const mentionSuggestions = useMemo(() => {
    if (!mention) {
      return [];
    }
    const query = mention.query.toLowerCase();
    return mentionableFiles
      .filter((file) => {
        const name = file.name.toLowerCase();
        const stem = name.replace(/\.[^.]+$/, '');
        return name.startsWith(query) || stem.startsWith(query);
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [mention, mentionableFiles]);

  // All files for the 📚 picker mode (no query filter, sorted by name)
  const pickerSuggestions = useMemo(() => {
    if (!pickerOpen) {
      return [];
    }
    return [...mentionableFiles].sort((a, b) => a.name.localeCompare(b.name));
  }, [pickerOpen, mentionableFiles]);

  // Whatever the popup currently shows: @-filtered files or the picker list
  const activeSuggestions = mention ? mentionSuggestions : pickerSuggestions;

  // The popup is only visible while it has something to show: matching
  // suggestions, the empty-library hint, or the picker opened via the button.
  // While the user keeps typing a sentence after an "@", the query stops
  // matching and the popup closes instead of blocking the view.
  const suggestionsVisible =
    pickerOpen ||
    (mention !== null && (mentionableFiles.length === 0 || mentionSuggestions.length > 0));

  // Insert a file reference. With an active @token it replaces the token;
  // from the picker it inserts at the caret (with a separating space when
  // the caret is in the middle of a word).
  const insertFileReference = useCallback(
    (file: LibraryFile): void => {
      const token = `@${file.name} `;
      let next: string;
      let caretTarget: number;
      if (mention) {
        const before = input.slice(0, mention.startIndex);
        const after = input.slice(mention.startIndex + 1 + mention.query.length);
        next = before + token + after;
        caretTarget = (before + token).length;
        setMention(null);
      } else {
        const el = textareaRef.current;
        const caret = el ? el.selectionStart ?? input.length : input.length;
        const needsSpace = caret > 0 && !/\s$/.test(input.slice(0, caret));
        const insertion = (needsSpace ? ' ' : '') + token;
        next = input.slice(0, caret) + insertion + input.slice(caret);
        caretTarget = caret + insertion.length;
        setPickerOpen(false);
      }
      setInput(next);
      setMentionIndex(0);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(caretTarget, caretTarget);
        }
      });
    },
    [input, mention]
  );

  const removeDocument = (id: string): void => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const removeImage = (id: string): void => {
    setImages((prev) => {
      const removed = prev.find((img) => img.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter((img) => img.id !== id);
    });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) {return;}
    setIsAttaching(true);
    try {
      const accepted: ImageAttachment[] = [];
      for (const file of files) {
        if (images.length + accepted.length >= ATTACHMENT_LIMITS.MAX_ATTACHMENTS) {break;}
        if (!isAllowedImage(file)) {continue;}
        accepted.push(await createImageAttachment(file));
      }
      if (accepted.length > 0) {
        // Cap the total: existing images plus the new ones must not exceed
        // the attachment limit. Revoke the preview URLs of any attachment
        // dropped by the cap so they do not leak.
        setImages((prev) => {
          const combined = [...prev, ...accepted];
          const kept = combined.slice(0, ATTACHMENT_LIMITS.MAX_ATTACHMENTS);
          for (const dropped of combined.slice(kept.length)) {
            URL.revokeObjectURL(dropped.previewUrl);
          }
          return kept;
        });
      }
    } finally {
      setIsAttaching(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) {return;}
    setIsAttaching(true);
    try {
      const accepted: DocumentAttachment[] = [];
      for (const file of files) {
        if (documents.length + accepted.length >= ATTACHMENT_LIMITS.MAX_ATTACHMENTS) {break;}
        if (!isAllowedDocument(file)) {continue;}
        accepted.push(await createDocumentAttachment(file));
      }
      if (accepted.length > 0) {
        // Cap the total: existing documents plus the new ones must not
        // exceed the attachment limit.
        setDocuments((prev) => [...prev, ...accepted].slice(0, ATTACHMENT_LIMITS.MAX_ATTACHMENTS));
      }
    } finally {
      setIsAttaching(false);
    }
  };

  const startListening = async (): Promise<void> => {
    try {
      // Check if SpeechRecognition is available
      if (!SpeechRecognition) {
        alert(t('chat.speechRecognitionNotSupported'));
        return;
      }

      // Check for microphone permission
      if (!navigator.mediaDevices?.getUserMedia) {
        alert(t('chat.micPermissionRequired'));
        return;
      }

      // Request microphone permission (the stream is only needed for the
      // permission prompt and must be released immediately afterwards)
      try {
        const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        permissionStream.getTracks().forEach((track) => track.stop());
      } catch (permissionError) {
        error('Microphone permission denied:', permissionError);
        alert(t('chat.micPermissionDenied'));
        return;
      }

      // Clean up any existing recognition instance
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (cleanupError) {
          log('Error cleaning up recognition:', cleanupError);
        }
      }

      const recognition = new SpeechRecognition();
      if (!recognition) {
        throw new Error('Failed to create SpeechRecognition instance');
      }
      recognition.continuous = true; // Changed to true for better user experience
      recognition.interimResults = true; // Show interim results
      recognition.maxAlternatives = 1;

      // Set language based on current i18n language
      const currentLang = i18n.language === 'de' ? 'de-DE' : 'en-US';
      recognition.lang = currentLang;

      recognition.onstart = (): void => {
        setIsListening(true);
        log('Speech recognition started');
      };

      recognition.onresult = (event: SpeechRecognitionEvent): void => {
        // Only append finalized segments. Interim results are re-delivered on
        // every event with growing content, so appending them would duplicate
        // words and phrases in the input.
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }

        const cleanedTranscript = finalTranscript.trim().replace(/\s+/g, ' ');

        if (cleanedTranscript) {
          setInput((prev) => prev + (prev ? ' ' : '') + cleanedTranscript);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent): void => {
        const errorMsg = event.error instanceof Error ? event.error.message : String(event.error);
        error('Speech recognition error:', event.error);
        setIsListening(false);
        alert(`${t('chat.micError')}: ${errorMsg}`);
      };

      recognition.onend = (): void => {
        setIsListening(false);
        log('Speech recognition ended');
      };

      recognitionRef.current = recognition;
      recognition.start();

    } catch (err) {
      error('Failed to start speech recognition:', err);
      setIsListening(false);
      alert(`${t('chat.micError')  }: ${  err instanceof Error ? err.message : String(err)}`);
    }
  };

  const stopListening = (): void => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  // Stop the microphone when the component unmounts (tab switch): without
  // this the recognition keeps running and fires setState on a dead component.
  // Attached images are released too - their object URLs would otherwise
  // keep the blobs alive until the page is reloaded.
  useEffect((): (() => void) => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      imagesRef.current.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
  }, []);

  const handleSend = (): void => {
    // Sending while a generation is running would abort it mid-stream and
    // interleave the two responses - block instead.
    if (input.trim() && !isLoading && isModelLoaded && !isGenerating) {
      if (images.length > 0 && onSendMessageWithImages) {
        onSendMessageWithImages(input, images);
      } else if (documents.length > 0 && onSendMessageWithDocuments) {
        onSendMessageWithDocuments(input, documents);
      } else {
        onSendMessage(input);
      }
      setInput('');
      setDocuments([]);
      setMention(null);
      setMentionIndex(0);
      // Also close the library picker and re-enable the @autocomplete for
      // the (empty) next message.
      setPickerOpen(false);
      dismissedMentionRef.current = null;
      images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      setImages([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    // Suggestion popup (both @mentions and the 📚 picker): arrows move,
    // Enter/Tab pick, Escape closes - Enter must NOT send while it is open.
    if (suggestionsVisible && activeSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % activeSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + activeSuggestions.length) % activeSuggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertFileReference(activeSuggestions[mentionIndex] ?? activeSuggestions[0]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (mention) {
          dismissedMentionRef.current = mention.startIndex;
          setMention(null);
        } else {
          setPickerOpen(false);
        }
        return;
      }
    }
    if (e.key === 'Escape' && pickerOpen) {
      e.preventDefault();
      setPickerOpen(false);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Ctrl/Cmd+Enter also sends, works even with shift held
    if (e.key === 'Enter' && e.shiftKey && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const rawInput = e.target.value;
    // Use lightweight sanitization for real-time input to preserve all spaces
    // Only removes HTML tags to prevent XSS
    const sanitizedInput = sanitizeInputLight(rawInput);
    setInput(sanitizedInput);
    // "@" mention detection: the caret must sit right after the @token.
    // If sanitization changed the text, the caret position may no longer be
    // accurate - fall back to "closed" in that rare case.
    const caret = sanitizedInput === rawInput ? e.target.selectionStart : sanitizedInput.length;
    const nextMention = detectMention(sanitizedInput, caret ?? sanitizedInput.length);
    if (nextMention && dismissedMentionRef.current !== nextMention.startIndex) {
      setMention(nextMention);
      setMentionIndex(0);
    } else {
      setMention(null);
      if (!nextMention) {
        // A new token can open the popup again
        dismissedMentionRef.current = null;
      }
    }
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        150
      )  }px`;
    }
  }, []);

  // Memoize disabled states to prevent unnecessary re-renders
  const isSendDisabled = useMemo(() => {
    return isLoading || !isModelLoaded || isGenerating || !input.trim();
  }, [isLoading, isModelLoaded, isGenerating, input]);

  const isVoiceDisabled = useMemo(() => {
    return isLoading || !isModelLoaded;
  }, [isLoading, isModelLoaded]);

  return (
    <div className="px-4 pt-3 safe-bottom bg-transparent">
      {!isModelLoaded && (
        <div className="mb-3 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl text-sm text-amber-800 dark:text-amber-400">
          <div className="flex items-center gap-2">
            <span className="text-lg">{isLoading ? '⏳' : '👆'}</span>
            <span className="font-medium">
              {isLoading
                ? t('chat.modelLoading')
                : hasModelSelected
                  ? t('chat.modelNotLoadedHint')
                  : t('chat.selectModelHint')}
            </span>
          </div>
        </div>
      )}

      {documents.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 rounded-xl text-sm text-indigo-800 dark:text-indigo-300"
            >
              <span>📄 {doc.name}</span>
              <span className="text-xs text-indigo-400">{formatBytes(doc.size)}</span>
              <button
                onClick={() => removeDocument(doc.id)}
                className="text-indigo-400 hover:text-red-500 transition-colors"
                aria-label={t('chat.removeDocument')}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-3">
          {images.map((img) => (
            <div
              key={img.id}
              className="relative group w-24 h-24 rounded-2xl overflow-hidden border-2 border-violet-200 dark:border-violet-900 shadow-sm"
            >
              <img
                src={img.previewUrl}
                alt={img.name}
                onClick={() => setPreviewImage(img)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setPreviewImage(img);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={t('chat.imagePreview')}
                className="w-full h-full object-cover cursor-zoom-in transition-transform duration-200 group-hover:scale-105"
              />
              <button
                onClick={() => removeImage(img.id)}
                className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-full bg-black/60 text-white text-xs opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-red-600"
                aria-label={t('chat.removeImage')}
                title={`${img.name} (${formatBytes(img.size)})`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {isAttaching && (
        <div className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">📎 {t('chat.attaching')}</div>
      )}

      {/* Unified composer: textarea + actions inside one capsule */}
      <div className="relative max-w-3xl mx-auto w-full" data-tour="message-input">
        {/* Suggestion popup: "@" mention autocomplete + 📚 library picker */}
        {suggestionsVisible && (
          <div
            className="absolute bottom-full left-0 right-0 mb-2 z-20 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden"
            role="listbox"
            aria-label={t('chat.mentionAriaLabel')}
          >
            {mentionableFiles.length === 0 ? (
              <p className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                📚 {t('chat.mentionNoFiles')}
              </p>
            ) : (
              <ul className="max-h-52 overflow-y-auto py-1">
                {activeSuggestions.map((file, index) => (
                  <li key={file.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === mentionIndex}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        insertFileReference(file);
                      }}
                      onMouseEnter={() => setMentionIndex(index)}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-left text-sm transition-colors ${
                        index === mentionIndex
                          ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-200'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <span>📄</span>
                      <span className="flex-1 truncate font-medium">{file.name}</span>
                      <span className="text-xs text-zinc-500">{formatBytes(file.size)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div
          className={`rounded-3xl border shadow-lg shadow-zinc-900/5 dark:shadow-black/20 bg-white dark:bg-zinc-900 transition-all duration-200 ${
            isLoading || !isModelLoaded
              ? 'border-zinc-200 dark:border-zinc-800 opacity-80'
              : 'border-zinc-500 focus-within:border-indigo-400 dark:focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10'
          }`}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={isModelLoaded ? t('chat.placeholder') : t('chat.selectModel')}
            aria-label={t('chat.messageInput')}
            disabled={isLoading || !isModelLoaded}
            onBlur={() => {
              setMention(null);
              setPickerOpen(false);
            }}
            className="w-full px-5 pt-4 pb-2 bg-transparent border-0 resize-none focus:outline-none focus:ring-0 disabled:cursor-not-allowed text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 text-base sm:text-sm leading-relaxed"
            rows={1}
            style={{ minHeight: '28px', maxHeight: '150px' }}
          />

          <div className="flex items-center gap-1.5 px-3 pb-3 pt-1">
            {/* Image Attach Button (only for multimodal models) */}
            {supportsImageInput && (
              <>
                <input
                  ref={imageInputRef}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(e) => void handleImageSelect(e)}
                  className="hidden"
                />
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isVoiceDisabled || isAttaching || images.length >= ATTACHMENT_LIMITS.MAX_ATTACHMENTS}
                  className={`w-9 h-9 rounded-xl text-sm transition-all bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 ${isVoiceDisabled || isAttaching ? 'opacity-40 cursor-not-allowed' : ''}`}
                  title={t('chat.attachImage')}
                  aria-label={t('chat.attachImage')}
                >
                  🖼️
                </button>
              </>
            )}
            {/* Document Attach Button */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={DOC_ACCEPT_ATTRIBUTE}
              onChange={(e) => void handleFileSelect(e)}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isVoiceDisabled || isAttaching || documents.length >= ATTACHMENT_LIMITS.MAX_ATTACHMENTS}
              className={`w-9 h-9 rounded-xl text-sm transition-all bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 ${isVoiceDisabled || isAttaching ? 'opacity-40 cursor-not-allowed' : ''}`}
              title={t('chat.attachDocument')}
              aria-label={t('chat.attachDocument')}
            >
              📎
            </button>
            {/* Library Mention Button (only with files in the library) */}
            {libraryFiles.length > 0 && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setMention(null);
                  setPickerOpen((v) => {
                    if (!v) {
                      setMentionIndex(0);
                    }
                    return !v;
                  });
                  requestAnimationFrame(() => textareaRef.current?.focus());
                }}
                disabled={isVoiceDisabled}
                className={`w-9 h-9 rounded-xl text-sm transition-all ${
                  pickerOpen
                    ? 'bg-indigo-100 dark:bg-indigo-950/60'
                    : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                } ${isVoiceDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                title={t('chat.libraryButton')}
                aria-label={t('chat.libraryButton')}
              >
                📚
              </button>
            )}
            {/* Voice Input Button */}
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={isVoiceDisabled}
              className={`w-9 h-9 rounded-xl text-sm transition-all ${
                isListening
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              } ${isVoiceDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              title={t('chat.voiceInputTooltip')}
              aria-label={t('chat.voiceInputTooltip')}
            >
              {isListening ? '🛑' : '🎙️'}
            </button>

            <div className="flex-1"></div>

            {/* Stop Generation Button */}
            {isGenerating && onStopGeneration && (
              <button
                onClick={onStopGeneration}
                className="h-9 px-4 rounded-xl text-sm font-medium transition-all bg-red-600 text-white hover:bg-red-700 active:scale-95"
                aria-label={t('chat.stop')}
                title={t('chat.stop')}
              >
                ⏹ {t('chat.stop')}
              </button>
            )}
            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={isSendDisabled}
              className={`h-9 px-4 rounded-xl text-sm font-medium transition-all ${
                isSendDisabled
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
                  : 'bg-indigo-700 text-white hover:bg-indigo-600 hover:shadow-lg hover:shadow-indigo-500/25 active:scale-95'
              }`}
              aria-label={t('chat.send')}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin text-xs">🌀</span>
                  {t('chat.sending')}
                </span>
              ) : (
                '➤'
              )}
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-zinc-600 dark:text-zinc-400 mt-2">
          {t('chat.privacyNote')}
        </p>
      </div>

      {/* Fullscreen Image Preview Modal */}
      {previewImage && (
        <div
          ref={previewTrapRef}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-label={t('chat.imagePreview')}
        >
          {/* Backdrop as a real button: keyboard and screen reader users get
              a proper close target (Escape works too via the focus trap). */}
          <button
            type="button"
            onClick={() => setPreviewImage(null)}
            aria-label={t('common.close')}
            className="absolute inset-0 w-full h-full bg-black/80 cursor-default"
          />
          <div className="relative max-w-4xl max-h-full flex flex-col items-center">
            <img
              src={previewImage.previewUrl}
              alt={previewImage.name}
              className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-2xl"
            />
            <div className="mt-3 flex items-center gap-3 text-white">
              <span className="text-sm">{previewImage.name}</span>
              <span className="text-xs text-gray-300">{formatBytes(previewImage.size)}</span>
            </div>
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 w-9 h-9 flex items-center justify-center rounded-full bg-white text-gray-800 shadow-lg hover:bg-red-500 hover:text-white transition-colors"
              aria-label={t('common.close')}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
