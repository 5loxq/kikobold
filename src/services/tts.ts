// Text-to-speech via the Web Speech API - everything runs locally in the
// browser, no cloud service involved. Used by the auto-speak setting and
// the per-message read-aloud button.

let activeUtterance: SpeechSynthesisUtterance | null = null;

/** Read a text aloud. Cancels anything that is currently being spoken. */
export const ttsSpeak = (
  text: string,
  lang: string,
  rate = 1,
  onEnd?: () => void
): void => {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = rate;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;
  // Chrome fires onend (not onerror) for the utterance killed by the
  // cancel() above. Only run the callback if this utterance is still the
  // active one, so a replaced speech does not clear the new one's state.
  utterance.onend = (): void => {
    if (activeUtterance === utterance) {
      activeUtterance = null;
      onEnd?.();
    }
  };
  utterance.onerror = (): void => {
    if (activeUtterance === utterance) {
      activeUtterance = null;
      onEnd?.();
    }
  };
  activeUtterance = utterance;
  window.speechSynthesis.speak(utterance);
};

/** Stop the current speech (no-op when nothing is spoken). */
export const ttsStop = (): void => {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return;
  }
  window.speechSynthesis.cancel();
  activeUtterance = null;
};

/** Whether the given utterance is still the active one. */
export const ttsIsActive = (): boolean => activeUtterance !== null;
