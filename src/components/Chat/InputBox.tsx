import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { error, log } from '../../services/logging';
import { sanitizeInput } from '../../services/security';

interface InputBoxProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isModelLoaded: boolean;
}

const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export const InputBox: React.FC<InputBoxProps> = ({
  onSendMessage,
  isLoading,
  isModelLoaded,
}) => {
  const { t, i18n } = useTranslation();
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  const startListening = async () => {
    try {
      // Check if SpeechRecognition is available
      if (!SpeechRecognition) {
        alert(t('chat.speechRecognitionNotSupported'));
        return;
      }

      // Check for microphone permission
      if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
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
      recognition.continuous = true; // Changed to true for better user experience
      recognition.interimResults = true; // Show interim results
      recognition.maxAlternatives = 1;

      // Set language based on current i18n language
      const currentLang = i18n.language === 'de' ? 'de-DE' : 'en-US';
      recognition.lang = currentLang;

      recognition.onstart = () => {
        setIsListening(true);
        log('Speech recognition started');
      };

      recognition.onresult = (event: any) => {
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

      recognition.onerror = (event: any) => {
        error('Speech recognition error:', event.error instanceof Error ? event.error : new Error(String(event.error)));
        setIsListening(false);
        alert(`${t('chat.micError')}: ${event.error}`);
      };

      recognition.onend = () => {
        setIsListening(false);
        log('Speech recognition ended');
      };

      recognitionRef.current = recognition;
      recognition.start();

    } catch (err) {
      error('Failed to start speech recognition:', err);
      setIsListening(false);
      alert(t('chat.micError') + ': ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const handleSend = () => {
    if (input.trim() && !isLoading && isModelLoaded) {
      onSendMessage(input);
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const rawInput = e.target.value;
    // Sanitize input to prevent XSS
    const sanitizedInput = sanitizeInput(rawInput);
    setInput(sanitizedInput);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(
        textareaRef.current.scrollHeight,
        120
      ) + 'px';
    }
  }, []);

  return (
    <div className="border-t border-gray-200 p-4 bg-white">
      {!isModelLoaded && (
        <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
          ⚠️ {t('chat.modelLoading')}
        </div>
      )}

      <div className="flex gap-3">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={isModelLoaded ? t('chat.placeholder') : t('chat.selectModel')}
          disabled={isLoading || !isModelLoaded}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          rows={1}
          style={{ minHeight: '40px', maxHeight: '120px' }}
        />

        {/* Voice Input Button */}
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={isLoading || !isModelLoaded}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            isListening
              ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse'
              : 'bg-gray-600 text-white hover:bg-gray-700'
          }`}
          title={t('chat.voiceInputTooltip')}
        >
          {isListening ? '⏹️' : '🎤'}
        </button>

        <button
          onClick={handleSend}
          disabled={isLoading || !isModelLoaded || !input.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium"
        >
          {isLoading ? '...' : t('chat.send')}
        </button>
      </div>
    </div>
  );
};
