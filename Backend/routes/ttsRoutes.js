// Backend/routes/ttsRoutes.js - ElevenLabs Dedicated AI Voice Assistant Service
const express = require('express');
const router = express.Router();
const axios = require('axios');

// Supported Official ElevenLabs Voices
const ELEVENLABS_VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (Calm & Clear)', gender: 'Female', description: 'Best for blind student instructions' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (Soft & Friendly)', gender: 'Female', description: 'Warm natural reading tone' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni (Smooth & Well-spoken)', gender: 'Male', description: 'Clear enunciated male voice' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Deep & Professional)', gender: 'Male', description: 'Deep clear narration' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi (Energetic & Direct)', gender: 'Female', description: 'Clear distinct voice' }
];

// Check ElevenLabs Configuration Status
router.get('/status', (req, res) => {
  const serverKey = process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY || '';
  res.json({
    service: 'ElevenLabs AI Voice Assistant',
    hasServerKey: !!serverKey.trim(),
    defaultVoice: '21m00Tcm4TlvDq8ikWAM',
    voices: ELEVENLABS_VOICES
  });
});

// Dedicated ElevenLabs Text-to-Speech Endpoint
router.post('/speak', async (req, res) => {
  try {
    const { text, voiceId, apiKey, stability, similarityBoost, modelId } = req.body;
    const key = (apiKey && apiKey.trim()) || req.headers['xi-api-key'] || process.env.ELEVENLABS_API_KEY || process.env.VITE_ELEVENLABS_API_KEY;

    if (!key) {
      return res.status(400).json({ 
        error: 'No ElevenLabs API key provided. Please configure your ElevenLabs API key in ElevenLabs Voice Settings.',
        code: 'MISSING_API_KEY'
      });
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Valid text string is required for ElevenLabs TTS' });
    }

    const selectedVoice = voiceId || '21m00Tcm4TlvDq8ikWAM'; // Default: Rachel
    const selectedModel = modelId || 'eleven_multilingual_v2'; // High quality multilingual model

    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`,
      {
        text: text.trim(),
        model_id: selectedModel,
        voice_settings: {
          stability: stability !== undefined ? Number(stability) : 0.65,
          similarity_boost: similarityBoost !== undefined ? Number(similarityBoost) : 0.85,
          style: 0.0,
          use_speaker_boost: true
        }
      },
      {
        headers: {
          'xi-api-key': key.trim(),
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        responseType: 'arraybuffer',
        timeout: 15000
      }
    );

    res.set({
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=3600'
    });
    res.send(response.data);
  } catch (error) {
    const errMsg = error.response?.data ? Buffer.from(error.response.data).toString() : error.message;
    console.error('ElevenLabs TTS Error:', errMsg);
    res.status(error.response?.status || 500).json({ 
      error: 'ElevenLabs text-to-speech synthesis failed', 
      details: errMsg 
    });
  }
});

module.exports = router;