// Frontend/src/services/elevenlabs.js - Dedicated ElevenLabs AI Voice Assistant Service

export const ELEVENLABS_VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (Calm & Clear)', gender: 'Female', description: 'Best for blind student instructions and exam questions' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (Soft & Friendly)', gender: 'Female', description: 'Warm natural reading tone' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni (Smooth & Well-spoken)', gender: 'Male', description: 'Clear enunciated male voice' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Deep & Professional)', gender: 'Male', description: 'Deep authoritative voice' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi (Energetic & Direct)', gender: 'Female', description: 'Clear distinct voice' }
];

let currentAudio = null;
let speechSessionId = 0;
let activeFetchController = null;
const audioCache = new Map(); // Cache audio URLs for instant playback and zero credit waste

export const getElevenLabsConfig = () => {
  return {
    apiKey: localStorage.getItem('elevenlabs_api_key') || '',
    voiceId: localStorage.getItem('elevenlabs_voice_id') || '21m00Tcm4TlvDq8ikWAM',
    stability: Number(localStorage.getItem('elevenlabs_stability')) || 0.65,
    similarityBoost: Number(localStorage.getItem('elevenlabs_similarity')) || 0.85,
    enabled: localStorage.getItem('elevenlabs_enabled') !== 'false'
  };
};

export const saveElevenLabsConfig = (config) => {
  if (config.apiKey !== undefined) localStorage.setItem('elevenlabs_api_key', config.apiKey.trim());
  if (config.voiceId !== undefined) localStorage.setItem('elevenlabs_voice_id', config.voiceId);
  if (config.stability !== undefined) localStorage.setItem('elevenlabs_stability', config.stability);
  if (config.similarityBoost !== undefined) localStorage.setItem('elevenlabs_similarity', config.similarityBoost);
  if (config.enabled !== undefined) localStorage.setItem('elevenlabs_enabled', config.enabled ? 'true' : 'false');
  // Clear cache if voice settings or key changed
  audioCache.clear();
};

export const isElevenLabsPlaying = () => {
  return !!currentAudio && !currentAudio.paused && !currentAudio.ended;
};

export const cancelElevenLabsSpeech = () => {
  speechSessionId++;
  if (activeFetchController) {
    try {
      activeFetchController.abort();
    } catch (e) {}
    activeFetchController = null;
  }
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.onended = null;
      currentAudio.onerror = null;
      currentAudio.currentTime = 0;
      currentAudio.src = '';
    } catch (e) {}
    currentAudio = null;
  }
};

/**
 * Clean text for high-fidelity ElevenLabs speech enunciation
 */
export const cleanTextForElevenLabs = (raw) => {
  return String(raw || '')
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, ' ')
    .replace(/[🚨🛡️👤📸🟢🔴⚠️✓●○🎙️💾🎯📖💡🔊🔇⚡]/g, ' ')
    .replace(/[*#`~[\]()]/g, ' ')
    .replace(/@/g, ' at ')
    .replace(/\bvs\b/gi, ' versus ')
    .replace(/\b(etc\.)\b/gi, ' et cetera ')
    .replace(/\b(e\.g\.)\b/gi, ' for example ')
    .replace(/\b(i\.e\.)\b/gi, ' that is ')
    .replace(/[\/\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

let hasServerElevenLabsKey = null;

export const checkServerElevenLabsKey = async () => {
  if (hasServerElevenLabsKey !== null) return hasServerElevenLabsKey;
  try {
    const res = await fetch('http://localhost:5000/api/tts/status');
    if (res.ok) {
      const data = await res.json();
      hasServerElevenLabsKey = !!data.hasServerKey;
      return hasServerElevenLabsKey;
    }
  } catch (e) {}
  hasServerElevenLabsKey = false;
  return false;
};

/**
 * Speak text exclusively using ElevenLabs AI Voice
 */
export const speakWithElevenLabs = async (text, options = {}) => {
  // STRICT RULE: If voice assistant is globally disabled, do not speak
  try {
    if (typeof window !== 'undefined' && (localStorage.getItem('voice_assistant_disabled') === 'true' || localStorage.getItem('student_voice_assistant_enabled') === 'false') && !options.force) {
      cancelElevenLabsSpeech();
      if (options.onEnd) options.onEnd();
      return false;
    }
  } catch (e) {}

  // 1. Immediately cancel any currently active audio utterance
  cancelElevenLabsSpeech();
  const mySessionId = ++speechSessionId;
  const controller = new AbortController();
  activeFetchController = controller;

  const config = getElevenLabsConfig();
  if (!config.enabled) {
    if (options.onEnd) options.onEnd();
    return false;
  }

  const cleanedText = cleanTextForElevenLabs(text);
  if (!cleanedText) {
    if (options.onEnd) options.onEnd();
    return false;
  }

  const targetVoiceId = options.voiceId || config.voiceId || '21m00Tcm4TlvDq8ikWAM';
  const effectiveKey = (options.apiKey || config.apiKey || '').trim();

  // If no client key and server has no key, exit fast so fallback engine speaks immediately
  if (!effectiveKey) {
    const serverHasKey = await checkServerElevenLabsKey();
    if (mySessionId !== speechSessionId) return false;
    if (!serverHasKey) {
      if (options.onEnd) options.onEnd();
      return false;
    }
  }

  const cacheKey = `${targetVoiceId}:::${cleanedText}`;

  try {
    let audioBlobUrl = null;

    // Check fast cache first
    if (audioCache.has(cacheKey)) {
      audioBlobUrl = audioCache.get(cacheKey);
    } else {
      // 1. Try Backend ElevenLabs Proxy Route
      try {
        const response = await fetch('http://localhost:5000/api/tts/speak', {
          method: 'POST',
          signal: controller.signal,
          headers: { 
            'Content-Type': 'application/json',
            ...(effectiveKey ? { 'xi-api-key': effectiveKey } : {})
          },
          body: JSON.stringify({
            text: cleanedText,
            voiceId: targetVoiceId,
            apiKey: effectiveKey,
            stability: options.stability || config.stability,
            similarityBoost: options.similarityBoost || config.similarityBoost
          })
        });

        if (mySessionId !== speechSessionId) return false;

        if (response.ok) {
          const blob = await response.blob();
          if (mySessionId !== speechSessionId) return false;
          audioBlobUrl = URL.createObjectURL(blob);
          if (cleanedText.length < 300) {
            audioCache.set(cacheKey, audioBlobUrl);
          }
        } else {
          const errJson = await response.json().catch(() => ({}));
          if (errJson.code === 'MISSING_API_KEY') {
            window.dispatchEvent(new CustomEvent('elevenlabs_missing_key'));
          }
        }
      } catch (backendError) {
        if (backendError.name === 'AbortError' || mySessionId !== speechSessionId) return false;
        console.warn('Backend ElevenLabs proxy unavailable, trying direct ElevenLabs API call...');
      }

      // 2. Direct ElevenLabs API Call if direct key available
      if (!audioBlobUrl && effectiveKey && mySessionId === speechSessionId) {
        try {
          const directRes = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}`,
            {
              method: 'POST',
              signal: controller.signal,
              headers: {
                'xi-api-key': effectiveKey,
                'Content-Type': 'application/json',
                'Accept': 'audio/mpeg'
              },
              body: JSON.stringify({
                text: cleanedText,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                  stability: options.stability || config.stability,
                  similarity_boost: options.similarityBoost || config.similarityBoost,
                  style: 0.0,
                  use_speaker_boost: true
                }
              })
            }
          );

          if (mySessionId !== speechSessionId) return false;

          if (directRes.ok) {
            const blob = await directRes.blob();
            if (mySessionId !== speechSessionId) return false;
            audioBlobUrl = URL.createObjectURL(blob);
            if (cleanedText.length < 300) {
              audioCache.set(cacheKey, audioBlobUrl);
            }
          } else {
            console.warn('Direct ElevenLabs API returned status:', directRes.status);
          }
        } catch (directErr) {
          if (directErr.name === 'AbortError' || mySessionId !== speechSessionId) return false;
          console.warn('Direct ElevenLabs API fetch error:', directErr);
        }
      }
    }

    if (mySessionId !== speechSessionId) return false;

    // 3. Play crystal-clear ElevenLabs audio (compatible with HDMI / external sound devices)
    if (audioBlobUrl) {
      const audio = new Audio(audioBlobUrl);
      audio.playbackRate = options.rate !== undefined ? Math.min(1.5, Math.max(0.65, options.rate)) : 0.85;
      currentAudio = audio;

      return new Promise((resolve) => {
        let isDone = false;
        const finish = (success) => {
          if (isDone) return;
          isDone = true;
          if (currentAudio === audio) {
            currentAudio = null;
          }
          if (options.onEnd && mySessionId === speechSessionId) options.onEnd();
          resolve(success);
        };

        audio.onended = () => finish(true);
        audio.onerror = (e) => {
          console.error('ElevenLabs Audio playback error:', e);
          finish(false);
        };

        if (mySessionId !== speechSessionId) {
          finish(false);
          return;
        }

        audio.play().catch((playErr) => {
          console.warn('ElevenLabs Audio play() blocked or interrupted:', playErr);
          finish(false);
        });
      });
    } else {
      // Key missing or API quota exhausted
      console.warn('ElevenLabs speech could not be generated. Please verify API key.');
      if (options.onEnd) options.onEnd();
      return false;
    }
  } catch (err) {
    if (err.name === 'AbortError' || mySessionId !== speechSessionId) return false;
    console.error('ElevenLabs Voice Assistant Error:', err);
    if (options.onEnd) options.onEnd();
    return false;
  }
};
