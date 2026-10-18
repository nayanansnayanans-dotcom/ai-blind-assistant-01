import React, { useState, useEffect } from 'react';
import { getElevenLabsConfig, saveElevenLabsConfig, ELEVENLABS_VOICES, speakWithElevenLabs } from '../services/elevenlabs';

export default function ElevenLabsSettings({ isOpen, onClose }) {
  const [apiKey, setApiKey] = useState('');
  const [voiceId, setVoiceId] = useState('21m00Tcm4TlvDq8ikWAM');
  const [enabled, setEnabled] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: 'success' });

  useEffect(() => {
    if (isOpen) {
      const config = getElevenLabsConfig();
      setApiKey(config.apiKey);
      setVoiceId(config.voiceId);
      setEnabled(config.enabled);
      setStatusMessage({ text: '', type: 'success' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    saveElevenLabsConfig({ apiKey: apiKey.trim(), voiceId, enabled });
    setStatusMessage({ text: 'ElevenLabs Voice Settings saved successfully!', type: 'success' });
    speakWithElevenLabs('ElevenLabs settings saved successfully!');
    setTimeout(() => setStatusMessage({ text: '', type: 'success' }), 4000);
  };

  const handleTestVoice = async () => {
    setIsTesting(true);
    saveElevenLabsConfig({ apiKey: apiKey.trim(), voiceId, enabled: true });
    
    const sampleText = "Hello! I am Rachel, your dedicated ElevenLabs AI voice assistant. I am ready to assist you.";
    const success = await speakWithElevenLabs(sampleText, { voiceId, apiKey: apiKey.trim() });
    
    if (!success) {
      setStatusMessage({ 
        text: 'ElevenLabs API call failed. Please check your ElevenLabs API Key from elevenlabs.io.', 
        type: 'error' 
      });
    } else {
      setStatusMessage({ 
        text: 'Playing ElevenLabs AI voice sample successfully!', 
        type: 'success' 
      });
    }
    setIsTesting(false);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      display: 'grid',
      placeItems: 'center',
      zIndex: 99999,
      backdropFilter: 'blur(6px)',
      padding: '20px'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        maxWidth: '520px',
        width: '100%',
        padding: '30px',
        boxShadow: '0 25px 50px -12px rgba(2, 132, 199, 0.35)',
        border: '2px solid #38bdf8',
        color: '#0f172a'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#0369a1', fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '900' }}>
            ⚡ ElevenLabs Voice Assistant
          </h2>
          <button 
            type="button" 
            onClick={onClose}
            style={{
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              fontSize: '1.2rem',
              cursor: 'pointer',
              color: '#0369a1',
              fontWeight: 'bold'
            }}
          >×</button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'grid', gap: '16px' }}>
          <div style={{ background: '#f0f9ff', padding: '14px 16px', borderRadius: '12px', border: '1px solid #bae6fd' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', color: '#0369a1', cursor: 'pointer' }}>
              <input 
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#0284c7' }}
              />
              Activate Dedicated ElevenLabs AI Voice
            </label>
            <p style={{ margin: '4px 0 0 28px', fontSize: '0.85rem', color: '#475569' }}>
              Provides ultra-realistic, clear, human-like voice for all blind assistant navigation, questions, and audio feedback.
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#0369a1', fontSize: '0.9rem' }}>
              ElevenLabs API Key
            </label>
            <input 
              type="password"
              placeholder="Paste your key: sk_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1.5px solid #bae6fd',
                fontSize: '0.95rem',
                boxSizing: 'border-box',
                outlineColor: '#0284c7'
              }}
            />
            <span style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
              Your API key from <a href="https://elevenlabs.io" target="_blank" rel="noreferrer" style={{ color: '#0284c7', fontWeight: 'bold' }}>elevenlabs.io</a>. Stored securely on your device.
            </span>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#0369a1', fontSize: '0.9rem' }}>
              Select ElevenLabs Voice Character
            </label>
            <select
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1.5px solid #bae6fd',
                fontSize: '0.95rem',
                backgroundColor: '#ffffff',
                color: '#0369a1',
                fontWeight: '700',
                boxSizing: 'border-box'
              }}
            >
              {ELEVENLABS_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  🎙️ {v.name} ({v.gender}) - {v.description}
                </option>
              ))}
            </select>
          </div>

          {statusMessage.text && (
            <div style={{ 
              background: statusMessage.type === 'error' ? '#fef2f2' : '#dcfce7', 
              color: statusMessage.type === 'error' ? '#991b1b' : '#166534', 
              border: statusMessage.type === 'error' ? '1px solid #fecaca' : '1px solid #bbf7d0',
              padding: '10px 14px', 
              borderRadius: '10px', 
              fontSize: '0.9rem', 
              textAlign: 'center',
              fontWeight: '700'
            }}>
              {statusMessage.type === 'error' ? '⚠️' : '✅'} {statusMessage.text}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={handleTestVoice}
              disabled={isTesting}
              style={{
                flex: 1,
                padding: '12px',
                background: '#e0f2fe',
                color: '#0369a1',
                border: '1.5px solid #bae6fd',
                borderRadius: '10px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              {isTesting ? '🔊 Playing ElevenLabs...' : '🎧 Test Voice'}
            </button>

            <button
              type="submit"
              style={{
                flex: 1,
                padding: '12px',
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
