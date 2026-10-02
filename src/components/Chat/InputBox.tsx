import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { error, log } from '../../services/logging';
import { sanitizeInputLight } from '../../services/security';

interface InputBoxProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isModelLoaded: boolean;
  isGenerating?: boolean;
  onStopGeneration?: () => void;
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

export const InputBox: React.FC<InputBoxProps> = ({
  onSendMessage,
  isLoading,
  isModelLoaded,
  isGenerating = false,
  onStopGeneration,
}) => {
  const { t, i18n } = useTranslation();
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

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

      // Request microphone permission
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
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
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        
        // Clean up transcript - remove duplicate words and normalize spaces
        const cleanedTranscript = transcript
          .trim()
          .replace(/\s+/g, ' ') // Normalize multiple spaces
          .replace(/(\b\w+\b)\s+\1\b/gi, '$1'); // Remove duplicate words
        
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

  const handleSend = (): void => {
    if (input.trim() && !isLoading && isModelLoaded) {
      onSendMessage(input);
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
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
    return isLoading || !isModelLoaded || !input.trim();
  }, [isLoading, isModelLoaded, input]);

  const isVoiceDisabled = useMemo(() => {
    return isLoading || !isModelLoaded;
  }, [isLoading, isModelLoaded]);

  return (
    <div className="border-t border-gray-100 p-4 bg-gradient-to-br from-gray-50 to-white">
      {!isModelLoaded && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <span className="font-medium">{t('chat.modelLoading')}</span>
          </div>
        </div>
      )}

      <div className="flex gap-3 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={isModelLoaded ? t('chat.placeholder') : t('chat.selectModel')}
            disabled={isLoading || !isModelLoaded}
            className="w-full px-5 py-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
            rows={1}
            style={{ minHeight: '50px', maxHeight: '150px' }}
          />
        </div>

        {/* Voice Input Button - Modern Design */}
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={isVoiceDisabled}
          className={`px-4 py-3 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md ${
            isListening
              ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse'
              : 'bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:from-gray-700 hover:to-gray-800'
          } ${isVoiceDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={t('chat.voiceInputTooltip')}
          aria-label={t('chat.voiceInputTooltip')}
        >
          {isListening ? '🛑' : '🎙️'}
        </button>

        {/* Stop Generation Button */}
        {isGenerating && onStopGeneration && (
          <button
            onClick={onStopGeneration}
            className="px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 transform hover:scale-105 active:scale-95"
            aria-label={t('chat.stop')}
            title={t('chat.stop')}
          >
            ⏹
          </button>
        )}
        {/* Send Button - Modern Design */}
        <button
          onClick={handleSend}
          disabled={isSendDisabled}
          className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md ${
            isSendDisabled
              ? 'bg-blue-300 text-white cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 transform hover:scale-105 active:scale-95'
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
  );
};
