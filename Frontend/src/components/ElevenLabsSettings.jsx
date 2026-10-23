import React, { useState, useEffect, useRef } from 'react';
import { getElevenLabsConfig, saveElevenLabsConfig, ELEVENLABS_VOICES, speakWithElevenLabs } from '../services/elevenlabs';
import { speakBrowserSpeech, speakHover, resetHoverSpeech } from './speech';

export default function ElevenLabsSettings({ isOpen, onClose }) {
  const [apiKey, setApiKey] = useState('');
  const [voiceId, setVoiceId] = useState('21m00Tcm4TlvDq8ikWAM');
  const [enabled, setEnabled] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: 'success' });
  const [isVoiceDropdownOpen, setIsVoiceDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const config = getElevenLabsConfig();
      setApiKey(config.apiKey);
      setVoiceId(config.voiceId);
      setEnabled(config.enabled);
      setStatusMessage({ text: '', type: 'success' });
      setIsVoiceDropdownOpen(false);
    }
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsVoiceDropdownOpen(false);
      }
    };
    if (isVoiceDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isVoiceDropdownOpen]);

  if (!isOpen) return null;

  const selectedVoiceObj = ELEVENLABS_VOICES.find(v => v.id === voiceId) || ELEVENLABS_VOICES[0];

  const handleVoiceChange = (newVoiceId) => {
    setVoiceId(newVoiceId);
    saveElevenLabsConfig({ apiKey: apiKey.trim(), voiceId: newVoiceId, enabled: true });
    const selectedVoiceObj = ELEVENLABS_VOICES.find(v => v.id === newVoiceId) || ELEVENLABS_VOICES[0];
    const charName = selectedVoiceObj.name.split(' ')[0];
    const previewText = `Voice switched to ${charName}. I am ready to assist you.`;
    if (apiKey.trim()) {
      speakWithElevenLabs(previewText, { voiceId: newVoiceId, apiKey: apiKey.trim() }).then(ok => {
        if (!ok) speakBrowserSpeech(previewText, 'en-US', { voiceId: newVoiceId });
      });
    } else {
      speakBrowserSpeech(previewText, 'en-US', { voiceId: newVoiceId });
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    saveElevenLabsConfig({ apiKey: apiKey.trim(), voiceId, enabled });
    const selectedVoiceObj = ELEVENLABS_VOICES.find(v => v.id === voiceId) || ELEVENLABS_VOICES[0];
    const charName = selectedVoiceObj.name.split(' ')[0];
    setStatusMessage({ text: `${charName} Voice Settings saved successfully!`, type: 'success' });
    const saveConfirm = `${charName} voice assistant settings saved successfully!`;
    if (apiKey.trim()) {
      speakWithElevenLabs(saveConfirm, { voiceId, apiKey: apiKey.trim() }).then(succ => {
        if (!succ) speakBrowserSpeech(saveConfirm, 'en-US', { voiceId });
      });
    } else {
      speakBrowserSpeech(saveConfirm, 'en-US', { voiceId });
    }
    setTimeout(() => setStatusMessage({ text: '', type: 'success' }), 4000);
  };

  const handleTestVoice = async () => {
    setIsTesting(true);
    saveElevenLabsConfig({ apiKey: apiKey.trim(), voiceId, enabled: true });
    
    const selectedVoiceObj = ELEVENLABS_VOICES.find(v => v.id === voiceId) || ELEVENLABS_VOICES[0];
    const charName = selectedVoiceObj.name.split(' ')[0];
    const sampleText = `Hello! I am ${charName}, your dedicated AI voice assistant. I am ready to assist you.`;
    
    let success = false;
    if (apiKey.trim()) {
      success = await speakWithElevenLabs(sampleText, { voiceId, apiKey: apiKey.trim() });
    }
    
    if (!success) {
      speakBrowserSpeech(sampleText, 'en-US', { voiceId });
      setStatusMessage({ 
        text: `Playing ${charName} (${selectedVoiceObj.gender}) voice sample successfully!`, 
        type: 'success' 
      });
    } else {
      setStatusMessage({ 
        text: `Playing ${charName} (${selectedVoiceObj.gender}) ElevenLabs AI voice sample successfully!`, 
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
          <h2 
            onMouseEnter={() => speakHover("ElevenLabs AI Voice Assistant Settings. Configure realistic human-like speech characters.")}
            style={{ margin: 0, color: '#0369a1', fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '900', cursor: 'default' }}
          >
            ⚡ ElevenLabs Voice Assistant
          </h2>
          <button 
            type="button" 
            onClick={onClose}
            onMouseEnter={() => speakHover("Close ElevenLabs voice settings window")}
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
          <div 
            onMouseEnter={() => speakHover(enabled ? "Activate Dedicated ElevenLabs AI Voice checkbox. Currently active. Provides ultra-realistic, clear, human-like voice for blind assistant navigation." : "Activate Dedicated ElevenLabs AI Voice checkbox. Currently inactive. Click to enable ultra-realistic AI voice.")}
            style={{ background: '#f0f9ff', padding: '14px 16px', borderRadius: '12px', border: '1px solid #bae6fd', cursor: 'pointer' }}
          >
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
            <label 
              onMouseEnter={() => speakHover("ElevenLabs API Key label. Enter your private secret key from elevenlabs.io.")}
              style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#0369a1', fontSize: '0.9rem', cursor: 'default' }}
            >
              ElevenLabs API Key
            </label>
            <input 
              type="password"
              placeholder="Paste your key: sk_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onMouseEnter={() => speakHover("ElevenLabs API Key password input field. Stored securely on your local device.")}
              onFocus={() => speakHover("ElevenLabs API Key input field. Type or paste your secret key.")}
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
            <span 
              onMouseEnter={() => speakHover("Your API key from elevenlabs.io. Stored securely on your device.")}
              style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px', display: 'block', cursor: 'default' }}
            >
              Your API key from <a href="https://elevenlabs.io" target="_blank" rel="noreferrer" onMouseEnter={() => speakHover("Visit elevenlabs.io in a new tab to create or view your API key.")} style={{ color: '#0284c7', fontWeight: 'bold' }}>elevenlabs.io</a>. Stored securely on your device.
            </span>
          </div>

          {/* Interactive Custom Voice Selector with Live Hover-to-Speech */}
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <label 
              onMouseEnter={() => speakHover("Select ElevenLabs Voice Character label. Choose between Rachel, Bella, Antoni, Adam, and Domi.")}
              style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', color: '#0369a1', fontSize: '0.9rem', cursor: 'default' }}
            >
              Select ElevenLabs Voice Character
            </label>
            <button
              type="button"
              onClick={() => setIsVoiceDropdownOpen(prev => !prev)}
              onMouseEnter={() => speakHover(`Select ElevenLabs Voice Character dropdown. Currently selected: ${selectedVoiceObj.name}, ${selectedVoiceObj.gender} voice. ${selectedVoiceObj.description}. Click to open voice list.`)}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                border: isVoiceDropdownOpen ? '2px solid #0284c7' : '1.5px solid #bae6fd',
                fontSize: '0.95rem',
                backgroundColor: '#ffffff',
                color: '#0369a1',
                fontWeight: '700',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <span>🎙️ {selectedVoiceObj.name} ({selectedVoiceObj.gender}) - {selectedVoiceObj.description}</span>
              <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px' }}>{isVoiceDropdownOpen ? '▲' : '▼'}</span>
            </button>

            {isVoiceDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '6px',
                background: '#ffffff',
                borderRadius: '14px',
                border: '2px solid #38bdf8',
                boxShadow: '0 16px 36px rgba(2, 132, 199, 0.28)',
                zIndex: 1000,
                maxHeight: '260px',
                overflowY: 'auto'
              }}>
                {ELEVENLABS_VOICES.map((v) => {
                  const isSelected = v.id === voiceId;
                  const voiceSpeechText = `${v.name}, ${v.gender} voice. ${v.description}`;
                  return (
                    <div
                      key={v.id}
                      role="option"
                      aria-selected={isSelected}
                      tabIndex={0}
                      onClick={() => {
                        handleVoiceChange(v.id);
                        setIsVoiceDropdownOpen(false);
                      }}
                      onMouseEnter={() => speakHover(voiceSpeechText)}
                      onFocus={() => speakHover(voiceSpeechText)}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #f0f9ff',
                        cursor: 'pointer',
                        background: isSelected ? '#0284c7' : '#ffffff',
                        color: isSelected ? '#ffffff' : '#0f172a',
                        fontWeight: isSelected ? '800' : '600',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <div>
                        <span style={{ marginRight: '8px' }}>🎙️</span>
                        <b>{v.name}</b> ({v.gender}) — <span style={{ color: isSelected ? '#e0f2fe' : '#64748b', fontSize: '0.85rem' }}>{v.description}</span>
                      </div>
                      {isSelected && <span style={{ color: '#ffffff', fontWeight: '900', fontSize: '14px' }}>✓ Active</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {statusMessage.text && (
            <div 
              onMouseEnter={() => speakHover(`Status message: ${statusMessage.text}`)}
              style={{ 
                background: statusMessage.type === 'error' ? '#fef2f2' : '#dcfce7', 
                color: statusMessage.type === 'error' ? '#991b1b' : '#166534', 
                border: statusMessage.type === 'error' ? '1px solid #fecaca' : '1px solid #bbf7d0',
                padding: '10px 14px', 
                borderRadius: '10px', 
                fontSize: '0.9rem', 
                textAlign: 'center',
                fontWeight: '700'
              }}
            >
              {statusMessage.type === 'error' ? '⚠️' : '✅'} {statusMessage.text}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={handleTestVoice}
              disabled={isTesting}
              onMouseEnter={() => speakHover(`Test Voice button. Click to play a sample audio greeting using ${selectedVoiceObj.name} voice.`)}
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
              onMouseEnter={() => speakHover("Save Settings button. Click to save your ElevenLabs configuration.")}
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
