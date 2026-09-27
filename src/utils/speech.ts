// Web Speech API wrapper for Text-To-Speech and Speech-To-Text

export function speakText(
  text: string,
  onStart?: () => void,
  onEnd?: () => void
): { cancel: () => void } {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onStart?.();
    setTimeout(() => {
      onEnd?.();
    }, 1500);
    return { cancel: () => {} };
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR';
  utterance.rate = 1.05;
  utterance.pitch = 1.15; // Slightly robotic/friendly pitch for Cosmos

  // Try to find a Portuguese voice
  const voices = window.speechSynthesis.getVoices();
  const ptVoice = voices.find((v) => v.lang.startsWith('pt') || v.lang.startsWith('PT'));
  if (ptVoice) {
    utterance.voice = ptVoice;
  }

  if (onStart) {
    utterance.onstart = () => onStart();
  }

  if (onEnd) {
    utterance.onend = () => onEnd();
    utterance.onerror = () => onEnd();
  }

  window.speechSynthesis.speak(utterance);

  return {
    cancel: () => {
      window.speechSynthesis.cancel();
      onEnd?.();
    },
  };
}

export interface SpeechRecognitionResultWrapper {
  transcript: string;
  isFinal: boolean;
}

export function startSpeechRecognition(
  onResult: (text: string) => void,
  onError: (err: string) => void,
  onEnd: () => void
): { stop: () => void } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;
  const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

  if (!SpeechRecognitionClass) {
    onError('Reconhecimento de voz não suportado neste navegador (requer Chrome/Edge).');
    onEnd();
    return { stop: () => {} };
  }

  try {
    const recognition = new SpeechRecognitionClass();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      if (event.results && event.results.length > 0) {
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      onError(event.error || 'Erro no microfone');
    };

    recognition.onend = () => {
      onEnd();
    };

    recognition.start();

    return {
      stop: () => {
        try {
          recognition.stop();
        } catch {}
      },
    };
  } catch (e) {
    onError(e instanceof Error ? e.message : 'Falha ao iniciar microfone');
    onEnd();
    return { stop: () => {} };
  }
}
