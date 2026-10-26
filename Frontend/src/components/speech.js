// Frontend/src/components/speech.js - Unified High-Clarity Voice Assistant Service (Zero Google TTS, Zero Dual-Voice)
import { 
  speakWithElevenLabs, 
  cancelElevenLabsSpeech, 
  isElevenLabsPlaying,
  getElevenLabsConfig,
  saveElevenLabsConfig,
  cleanTextForElevenLabs,
  ELEVENLABS_VOICES
} from '../services/elevenlabs';

export { 
  ELEVENLABS_VOICES, 
  getElevenLabsConfig, 
  saveElevenLabsConfig, 
  cleanTextForElevenLabs,
  speakWithElevenLabs 
};

// Acoustic Character Voice Profiles for instant, distinct browser speech synthesis
export const VOICE_PROFILES = {
  // Adam: Deep & Professional Male
  'pNInz6obpgDQGcFmaJgB': {
    name: 'Adam',
    gender: 'Male',
    basePitch: 0.74,
    baseRate: 0.88,
    preferredVoices: ['David', 'Mark', 'Guy', 'George', 'James', 'Richard', 'Sean', 'Male', 'Natural']
  },
  // Antoni: Smooth & Well-spoken Male
  'ErXwobaYiN019PkySvjV': {
    name: 'Antoni',
    gender: 'Male',
    basePitch: 0.94,
    baseRate: 0.90,
    preferredVoices: ['David', 'Mark', 'Guy', 'George', 'James', 'Richard', 'Sean', 'Male']
  },
  // Bella: Soft & Friendly Female
  'EXAVITQu4vr4xnSDxMaL': {
    name: 'Bella',
    gender: 'Female',
    basePitch: 1.16,
    baseRate: 0.86,
    preferredVoices: ['Zira', 'Samantha', 'Jenny', 'Aria', 'Female']
  },
  // Domi: Energetic & Direct Female
  'AZnzlk1XvdvUeBnXmlld': {
    name: 'Domi',
    gender: 'Female',
    basePitch: 1.26,
    baseRate: 1.02,
    preferredVoices: ['Aria', 'Jenny', 'Zira', 'Samantha', 'Female']
  },
  // Rachel: Calm & Clear Female (Default)
  '21m00Tcm4TlvDq8ikWAM': {
    name: 'Rachel',
    gender: 'Female',
    basePitch: 1.0,
    baseRate: 0.88,
    preferredVoices: ['Jenny', 'Zira', 'Samantha', 'Aria', 'Female']
  }
};

let activeUtterance = null;
let synthesisSafetyTimer = null;
let speechStartTimer = null;
let keepAliveTimer = null;
let currentSpeechToken = 0;
let cachedNonGoogleVoices = [];

// Global Voice Assistant Mute / Disable State
let isVoiceGloballyDisabled = false;

try {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('voice_assistant_disabled') || localStorage.getItem('student_voice_assistant_enabled');
    if (stored === 'true' && localStorage.getItem('voice_assistant_disabled') === 'true') {
      isVoiceGloballyDisabled = true;
    } else if (localStorage.getItem('student_voice_assistant_enabled') === 'false') {
      isVoiceGloballyDisabled = true;
    }
  }
} catch (e) {}

export function isVoiceDisabled() {
  if (typeof window !== 'undefined') {
    if (window.isVoiceGloballyDisabled !== undefined) {
      return Boolean(window.isVoiceGloballyDisabled);
    }
    try {
      if (localStorage.getItem('voice_assistant_disabled') === 'true') return true;
      if (localStorage.getItem('student_voice_assistant_enabled') === 'false') return true;
    } catch (e) {}
  }
  return isVoiceGloballyDisabled;
}

export function setVoiceDisabled(disabled) {
  isVoiceGloballyDisabled = Boolean(disabled);
  if (typeof window !== 'undefined') {
    window.isVoiceGloballyDisabled = isVoiceGloballyDisabled;
    try {
      localStorage.setItem('voice_assistant_disabled', String(isVoiceGloballyDisabled));
      localStorage.setItem('student_voice_assistant_enabled', String(!isVoiceGloballyDisabled));
    } catch (e) {}
    if (isVoiceGloballyDisabled) {
      cancelSpeech();
    }
    window.dispatchEvent(new Event('voice_state_changed'));
  }
}

// Pre-warm and strictly filter out Google TTS voices
function refreshNonGoogleVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  try {
    const all = window.speechSynthesis.getVoices() || [];
    cachedNonGoogleVoices = all.filter(v => {
      const n = (v.name || '').toLowerCase();
      const u = (v.voiceURI || '').toLowerCase();
      return !n.includes('google') && !u.includes('google');
    });
  } catch (e) {
    cachedNonGoogleVoices = [];
  }
  return cachedNonGoogleVoices;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  refreshNonGoogleVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    refreshNonGoogleVoices();
  };
}

// Audio Unlocker & HDMI / External Display Audio Connection Listener
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.resume();
      }
    } catch (e) {}
  };
  ['click', 'keydown', 'touchstart', 'pointerdown', 'focus'].forEach(evt => {
    window.addEventListener(evt, unlockAudio, { passive: true });
  });

  // When HDMI cable / external monitor / TV speaker is connected or changed:
  if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === 'function') {
    navigator.mediaDevices.addEventListener('devicechange', () => {
      try {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          window.speechSynthesis.resume();
        }
        refreshNonGoogleVoices();
      } catch (e) {}
    });
  }
}

let isSystemNarrating = false;
let isBrowserSpeaking = false;

export function isTTSActive() {
  const elevenPlaying = isElevenLabsPlaying();
  return elevenPlaying || isSystemNarrating;
}

export function cancelSpeech() {
  currentSpeechToken++;
  isSystemNarrating = false;
  isBrowserSpeaking = false;
  cancelElevenLabsSpeech();
  if (synthesisSafetyTimer) {
    clearTimeout(synthesisSafetyTimer);
    synthesisSafetyTimer = null;
  }
  if (speechStartTimer) {
    clearTimeout(speechStartTimer);
    speechStartTimer = null;
  }
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
      window.speechSynthesis.resume();
    } catch (e) {}
  }
  activeUtterance = null;
}

/**
 * Fallback High-Quality Browser Speech Engine
 * STRICT RULE: Google Text-to-Speech voices are completely filtered out and never used.
 * Selects clean Microsoft Natural / Apple / System voices (Jenny, Zira, Samantha) matching Rachel's tone.
 * Operates reliably when connected to HDMI displays and external sound systems.
 */
export function speakBrowserSpeech(text, lang = 'en-US', options = {}) {
  if (isVoiceDisabled() && !options.force) {
    cancelSpeech();
    if (options.onEnd) options.onEnd();
    return false;
  }

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (options.onEnd) options.onEnd();
    return false;
  }

  // If called directly without a token, cancel previous speech and get token
  let token = options.token;
  if (token === undefined) {
    cancelSpeech();
    token = currentSpeechToken;
  }

  const cleanedText = cleanTextForElevenLabs(text);
  if (!cleanedText) {
    if (options.onEnd) options.onEnd();
    return false;
  }

  try {
    window.speechSynthesis.resume();
  } catch (e) {}

  const activeVoiceId = options.voiceId || localStorage.getItem('elevenlabs_voice_id') || '21m00Tcm4TlvDq8ikWAM';
  const profile = VOICE_PROFILES[activeVoiceId] || VOICE_PROFILES['21m00Tcm4TlvDq8ikWAM'];

  const utterance = new SpeechSynthesisUtterance(cleanedText);
  utterance.lang = lang || 'en-US';

  const customRate = options.rate !== undefined ? options.rate : profile.baseRate;
  utterance.rate = Math.min(1.3, Math.max(0.65, customRate));

  const customPitch = options.pitch !== undefined ? options.pitch : profile.basePitch;
  utterance.pitch = Math.min(2.0, Math.max(0.5, customPitch));
  utterance.volume = 1.0;

  // STRICTLY EXCLUDE GOOGLE TTS VOICES and select matching gender voice
  let availableVoices = cachedNonGoogleVoices.length > 0 ? cachedNonGoogleVoices : refreshNonGoogleVoices();

  if (availableVoices.length > 0) {
    let chosenVoice = null;
    const isMale = profile.gender === 'Male';

    // 1. Try to find a voice that matches profile.preferredVoices
    if (profile.preferredVoices && profile.preferredVoices.length > 0) {
      for (const nameKeyword of profile.preferredVoices) {
        chosenVoice = availableVoices.find(v => 
          v.name.toLowerCase().includes(nameKeyword.toLowerCase()) && 
          (v.lang.startsWith('en') || v.lang.includes('US'))
        );
        if (chosenVoice) break;
      }
    }

    // 2. If not found by keyword, find by gender indicator
    if (!chosenVoice) {
      if (isMale) {
        chosenVoice = availableVoices.find(v => {
          const lower = v.name.toLowerCase();
          return (lower.includes('david') || lower.includes('mark') || lower.includes('guy') || lower.includes('male') || lower.includes('george')) && v.lang.startsWith('en');
        });
      } else {
        chosenVoice = availableVoices.find(v => {
          const lower = v.name.toLowerCase();
          return (lower.includes('jenny') || lower.includes('zira') || lower.includes('samantha') || lower.includes('aria') || lower.includes('female')) && v.lang.startsWith('en');
        });
      }
    }

    // 3. Fallback to any natural English voice
    if (!chosenVoice) {
      chosenVoice = 
        availableVoices.find(v => (v.name.includes('Natural') || v.name.includes('Online')) && (v.lang.startsWith('en') || v.lang.includes('US'))) ||
        availableVoices.find(v => (v.name.includes('Jenny') || v.name.includes('Zira') || v.name.includes('Samantha') || v.name.includes('Aria')) && v.lang.startsWith('en')) ||
        availableVoices.find(v => (v.name.includes('David') || v.name.includes('Mark')) && v.lang.startsWith('en')) ||
        availableVoices.find(v => v.lang.startsWith('en') || v.lang.includes('en-US')) ||
        availableVoices[0];
    }

    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }
  }

  activeUtterance = utterance;

  let hasEnded = false;
  const finish = (success) => {
    if (hasEnded) return;
    hasEnded = true;
    isBrowserSpeaking = false;
    if (synthesisSafetyTimer) {
      clearTimeout(synthesisSafetyTimer);
      synthesisSafetyTimer = null;
    }
    if (keepAliveTimer) {
      clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }
    if (activeUtterance === utterance) {
      activeUtterance = null;
    }
    if (success && options.onEnd && token === currentSpeechToken) {
      options.onEnd();
    }
  };

  utterance.onstart = () => {
    isBrowserSpeaking = true;
  };
  utterance.onend = () => finish(true);
  utterance.onerror = (e) => {
    if (e.error !== 'interrupted' && e.error !== 'canceled') {
      console.warn('Browser Speech error:', e);
      finish(true);
    } else {
      finish(false);
    }
  };

  // Safety timer to prevent Chrome hanging if onend never fires
  const maxDuration = Math.max(3000, cleanedText.length * 90 + 2000);
  synthesisSafetyTimer = setTimeout(() => {
    if (!hasEnded) finish(true);
  }, maxDuration);

  // Chrome speech keep-alive for longer sentences over HDMI audio
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  keepAliveTimer = setInterval(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
      try {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      } catch (e) {}
    }
  }, 5000);

  const performSpeak = () => {
    if (token !== currentSpeechToken) return;
    try {
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
      window.speechSynthesis.resume();
    } catch (err) {
      console.warn('speechSynthesis.speak error:', err);
      finish(false);
    }
  };

  // If Chrome synthesis is already speaking, cancel cleanly and give IPC 40ms to flush before speaking
  if (typeof window !== 'undefined' && 'speechSynthesis' in window && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
    } catch (e) {}
    if (speechStartTimer) clearTimeout(speechStartTimer);
    speechStartTimer = setTimeout(performSpeak, 50);
  } else {
    performSpeak();
  }

  return true;
}

/**
 * Universal Portal Voice Assistant Speech Function:
 * 1. Checks if ElevenLabs API key is configured. If yes, synthesizes with ElevenLabs AI Voice.
 * 2. If no ElevenLabs key is configured (or if request fails), immediately & seamlessly
 *    falls back to the clean non-Google system voice.
 * 3. Never silent, zero delay, single-channel audio mutex (no dual voices, no overlapping).
 * 4. 100% resilient when connected to HDMI displays and external sound systems.
 */
export async function speakIn(text, lang = 'en-US', options = {}) {
  // STRICT RULE: If voice assistant is disabled, NEVER speak anything!
  if (isVoiceDisabled() && !options.force) {
    cancelSpeech();
    if (options.onEnd) options.onEnd();
    return false;
  }

  cancelSpeech();
  const myToken = currentSpeechToken;
  isSystemNarrating = true;

  const wrappedOnEnd = () => {
    if (myToken === currentSpeechToken) {
      isSystemNarrating = false;
    }
    if (options.onEnd) options.onEnd();
  };

  if (!text) {
    isSystemNarrating = false;
    if (options.onEnd) options.onEnd();
    return false;
  }

  // 1. Try ElevenLabs first if key is present or server has key
  const config = getElevenLabsConfig();
  const hasKey = !!(options.apiKey || config.apiKey || '').trim();
  
  if (config.enabled && hasKey) {
    try {
      const success = await speakWithElevenLabs(text, { ...options, onEnd: wrappedOnEnd });
      if (myToken !== currentSpeechToken) return false;
      if (success) {
        return true;
      }
    } catch (elevenErr) {
      if (myToken !== currentSpeechToken) return false;
      console.warn('ElevenLabs unavailable, using high-clarity voice:', elevenErr);
    }
  }

  if (myToken !== currentSpeechToken) return false;

  // 2. Clear, natural non-Google speech engine
  return speakBrowserSpeech(text, lang, { ...options, onEnd: wrappedOnEnd, token: myToken });
}



let globalHoverTimer = null;
let lastGlobalHoverText = '';

/**
 * High-responsiveness Hover-to-Speech / Cursor Screen Reader
 * Immediately cancels previous speech and speaks the newly hovered element cleanly.
 */
export function speakHover(text, delay = 80) {
  if (typeof window === 'undefined' || !text || isVoiceDisabled()) return;
  // If system narration (e.g. reading exam question or results) is in progress, DO NOT interrupt!
  if (isSystemNarrating || isElevenLabsPlaying()) return;

  const clean = cleanTextForElevenLabs(text);
  if (!clean || clean === lastGlobalHoverText) return;

  if (globalHoverTimer) {
    clearTimeout(globalHoverTimer);
  }

  globalHoverTimer = setTimeout(() => {
    if (isSystemNarrating || isElevenLabsPlaying()) return;
    lastGlobalHoverText = clean;
    speakBrowserSpeech(clean, 'en-US', { rate: 1.05 });
  }, delay);
}

export function resetHoverSpeech() {
  if (globalHoverTimer) {
    clearTimeout(globalHoverTimer);
    globalHoverTimer = null;
  }
  lastGlobalHoverText = '';
}

// Backward-compatible aliases
export function speakBuiltinTTS(text, options = {}) {
  return speakIn(text, 'en-US', options);
}

export function getBuiltinVoices() {
  return ELEVENLABS_VOICES.map(v => ({
    name: v.name,
    lang: 'en-US',
    voiceURI: v.id,
    gender: v.gender,
    description: v.description
  }));
}

export function formatSpokenName(nameStr) {
  if (!nameStr) return 'Student';
  let clean = String(nameStr).trim();
  if (clean.includes('@')) {
    clean = clean.split('@')[0];
  }
  
  // Strip trailing numbers which originate from email addresses / usernames (e.g. sowmyans123 -> sowmyans, rahul123 -> rahul)
  clean = clean.replace(/\d+$/g, '');

  // Replace common delimiters with spaces
  clean = clean.replace(/[._-]+/g, ' ');

  // Decompose common South Indian initial suffixes attached to names
  // e.g. sowmyans -> sowmya N S, nayanans -> nayana N S, januns -> jaanu N S, lakshmik -> lakshmi K
  if (/^[a-zA-Z]+ns$/i.test(clean) && clean.length > 4) {
    clean = clean.slice(0, -2) + ' N S';
  } else if (/^[a-zA-Z]+k$/i.test(clean) && clean.length > 5) {
    clean = clean.slice(0, -1) + ' K';
  }

  const parts = clean.split(' ').filter(Boolean).map(w => {
    if (w.length <= 2 && /^[a-zA-Z]+$/.test(w)) return w.toUpperCase();
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });
  return parts.join(' ').trim() || 'Student';
}

export function formatSpokenEmail(rawText) {
  if (!rawText) return '';
  let s = String(rawText).toLowerCase().trim();
  s = s.replace(/@/g, ' at ')
       .replace(/\./g, ' dot ')
       .replace(/_/g, ' underscore ')
       .replace(/-/g, ' hyphen ');
  return s.trim();
}

/**
 * High-Precision Spoken Email Converter:
 * Transforms spoken natural phrases like "janu ns 1234 at gmail dot com"
 * into a clean, valid RFC-compliant email address: "januns1234@gmail.com".
 */
export function parseSpokenEmail(rawText) {
  if (!rawText) return '';
  let s = String(rawText).toLowerCase().trim();

  // Spoken number words mapping
  const wordMap = {
    'zero': '0', 'oh': '0',
    'one': '1', 'won': '1',
    'two': '2', 'to': '2', 'too': '2',
    'three': '3',
    'four': '4', 'for': '4', 'fore': '4',
    'five': '5',
    'six': '6',
    'seven': '7',
    'eight': '8', 'ate': '8',
    'nine': '9'
  };

  // Replace spoken phrases for symbols
  s = s.replace(/\bat the rate of\b/g, '@')
       .replace(/\bat the rate\b/g, '@')
       .replace(/\bat\b/g, '@')
       .replace(/\bdot\b/g, '.')
       .replace(/\bpoint\b/g, '.')
       .replace(/\bperiod\b/g, '.')
       .replace(/\bunderscore\b/g, '_')
       .replace(/\bhyphen\b/g, '-')
       .replace(/\bdash\b/g, '-')
       .replace(/\bminus\b/g, '-');

  // Convert number words
  Object.keys(wordMap).forEach(w => {
    const reg = new RegExp(`\\b${w}\\b`, 'g');
    s = s.replace(reg, wordMap[w]);
  });

  // If there's an '@', split local and domain
  if (s.includes('@')) {
    const parts = s.split('@');
    const local = parts[0].replace(/\s+/g, '').replace(/[^a-z0-9._%+-]/g, '');
    let domain = parts.slice(1).join('').replace(/\s+/g, '').replace(/[^a-z0-9.-]/g, '');
    if (!domain.includes('.')) {
      if (domain === 'gmail' || domain === 'googlemail') domain = 'gmail.com';
      else domain = `${domain}.com`;
    }
    return `${local}@${domain}`;
  }

  // If spoken like "januns1234 gmail com"
  if (s.includes('gmail')) {
    const parts = s.split('gmail');
    const local = parts[0].replace(/\s+/g, '').replace(/[^a-z0-9._%+-]/g, '');
    return `${local}@gmail.com`;
  }

  // If user spoke only the username part, e.g. "januns1234"
  const clean = s.replace(/\s+/g, '').replace(/[^a-z0-9._%+-]/g, '');
  if (clean && !clean.includes('@')) {
    return `${clean}@gmail.com`;
  }
  return clean;
}