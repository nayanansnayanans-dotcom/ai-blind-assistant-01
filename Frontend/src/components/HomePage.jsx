import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mic, Eye, BookOpen, UserCheck, Shield, DollarSign, Volume2, ArrowRight, CheckCircle2, Navigation, Radio, Info, HelpCircle } from 'lucide-react';
import { speakIn, cancelSpeech } from './speech';
import ProjectLogo from './ProjectLogo.jsx';
import { sendContactMessageApi } from '../services/api';

export default function HomePage() {
  const navigate = useNavigate();

  // Voice Assistant States for Students
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('Tap anywhere on the screen to activate Voice Assistant listening!');
  const [voiceQuery, setVoiceQuery] = useState('');
  const [contactForm, setContactForm] = useState({ name: '', email: '', role: 'Student', subject: 'General Inquiry', message: '' });
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#contact') {
        setShowContactModal(true);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    if (!contactForm.name.trim() || !contactForm.email.trim() || !contactForm.message.trim()) {
      return alert('Please fill in your name, email, and message.');
    }

    try {
      await sendContactMessageApi({
        name: contactForm.name.trim(),
        email: contactForm.email.trim(),
        role: contactForm.role || 'Student',
        subject: contactForm.subject || 'General Inquiry',
        message: contactForm.message.trim()
      });
    } catch (err) {
      console.warn('Contact message submission fallback error:', err);
    }

    setContactSubmitted(true);
    speak('Thank you for contacting VisionAssist AI support. Your message has been delivered to the administrator dashboard.');
    setTimeout(() => {
      setContactForm({ name: '', email: '', role: 'Student', subject: 'General Inquiry', message: '' });
      setContactSubmitted(false);
    }, 4500);
  };

  const stopRecognition = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
  };

  const speak = (textToSpeak, onEndCallback = null) => {
    stopRecognition();
    setIsSpeaking(true);
    speakIn(textToSpeak, 'en-US', {
      onEnd: () => {
        setIsSpeaking(false);
        if (onEndCallback) onEndCallback();
      }
    });
  };

  // Full Audio Instructions for Blind Students
  const readStudentInstructionsAloud = () => {
    const fullInstructions = 
      "Hello and welcome, student! Here are the complete audio instructions for blind users. " +
      "First: Voice Control. You can tap anywhere on the screen at any time to activate the microphone and speak your voice command. " +
      "Second: Navigation Commands. Say 'Student Login' to go to login. Say 'Register' to create your account. Say 'Student Dashboard' to view your portal. " +
      "Third: Exam Portal. In your Student Dashboard, you can listen to audio question paper narration and dictate your exam answers using speech to text. " +
      "Whenever you are ready, tap anywhere on the screen and speak your command now!";

    speak(fullInstructions);
  };

  const navigateSilent = (path) => {
    cancelSpeech();
    stopRecognition();
    setIsSpeaking(false);
    setIsListening(false);
    navigate(path);
  };

  // Process Student Voice Commands
  const processStudentVoiceCommand = (commandText) => {
    const q = commandText.toLowerCase().trim();
    setVoiceStatus(`Recognized command: "${commandText}"`);

    if (q.includes('teacher login')) {
      navigateSilent('/teacher-login');
    } else if (q.includes('teacher register') || q.includes('teacher sign up')) {
      navigateSilent('/teacher-register');
    } else if (q.includes('admin login')) {
      navigateSilent('/admin-login');
    } else if (q.includes('admin register') || q.includes('admin sign up')) {
      speak('Admin registration is disabled. Navigating to Admin Login portal.', () => navigateSilent('/admin-login'));
    } else if (q.includes('student login') || q.includes('login') || q.includes('sign in')) {
      speak('Navigating to Student Login page.', () => navigate('/student-login'));
    } else if (q.includes('student register') || q.includes('register') || q.includes('sign up') || q.includes('create account')) {
      speak('Navigating to Student Registration page.', () => navigate('/student-register'));
    } else if (q.includes('student dashboard') || q.includes('my dashboard') || q.includes('student portal')) {
      speak('Opening Student Dashboard.', () => navigate('/dashboard'));
    } else if (q.includes('teacher dashboard') || q.includes('teacher portal')) {
      navigateSilent('/teacher-dashboard');
    } else if (q.includes('admin dashboard') || q.includes('admin portal')) {
      navigateSilent('/admin-dashboard');
    } else if (q.includes('contact') || q.includes('support')) {
      setShowContactModal(true);
      speak('Opening Contact Us and 24/7 Accessibility Support modal.');
    } else if (q.includes('instruction') || q.includes('guide') || q.includes('help')) {
      readStudentInstructionsAloud();
    } else if (q.includes('read features') || q.includes('explain features') || q.includes('features') || q.includes('what can you do')) {
      const featureSummary = 
        "VisionAssist AI provides six core features for blind students. " +
        "First: Voice Navigation and Speech Assistant. " +
        "Second: Object and Hazard Detection. " +
        "Third: OCR Text and Book Reader. " +
        "Fourth: Currency Note Identifier. " +
        "Fifth: Audio Guided Student Exam Portal. " +
        "Sixth: Teacher and Admin Portals. " +
        "Say 'login' or 'student dashboard' to continue.";
      speak(featureSummary);
    } else if (q.includes('camera') || q.includes('detection') || q.includes('object')) {
      speak('Starting live object and hazard detection assistant.');
    } else if (q.includes('ocr') || q.includes('read book') || q.includes('text reader')) {
      speak('Opening OCR text reader for blind students.', () => navigate('/dashboard'));
    } else if (q.includes('currency') || q.includes('money')) {
      speak('Opening currency note identifier.', () => navigate('/dashboard'));
    } else if (q.includes('stop') || q.includes('cancel')) {
      cancelSpeech();
      setIsSpeaking(false);
      setIsListening(false);
      setVoiceStatus('Voice Assistant stopped.');
    } else {
      const response = `Command "${commandText}" received. You can say: Login, Register, Student Dashboard, or Read Instructions.`;
      speak(response);
    }
  };

  // Start Speech Recognition for Student Voice Commands
  const startStudentVoiceListening = (withPrompt = true) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      speak('Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge or type your voice command.');
      return;
    }

    const listenNow = () => {
      stopRecognition();
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceStatus('🎤 Listening for student voice command... Speak now!');
      };

      recognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        setVoiceQuery(transcript);
        setIsListening(false);
        processStudentVoiceCommand(transcript);
      };

      recognition.onerror = () => {
        setIsListening(false);
        setVoiceStatus('Could not capture voice clearly. Tap anywhere on screen to try again.');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      try {
        recognition.start();
      } catch (e) {
        setIsListening(false);
      }
    };

    if (withPrompt) {
      speak("Voice Assistant listening. Speak your command now, or say Student Login, Register, or Student Dashboard.", () => {
        listenNow();
      });
    } else {
      stopRecognition();
      cancelSpeech();
      listenNow();
    }
  };

  // Global Tap Anywhere Screen Listener to Activate Voice Assistant
  useEffect(() => {
    const handleGlobalScreenTap = (e) => {
      if (e.target.closest('input') || e.target.closest('button') || e.target.closest('a') || e.target.closest('textarea') || e.target.closest('select')) {
        return;
      }
      startStudentVoiceListening(true);
    };

    window.addEventListener('click', handleGlobalScreenTap);
    return () => window.removeEventListener('click', handleGlobalScreenTap);
  }, []);

  // Keyboard Spacebar listener to activate Voice Assistant hands-free
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select' || document.activeElement?.isContentEditable) {
        return;
      }
      if (e.code === 'Space' && !isListening) {
        e.preventDefault();
        startStudentVoiceListening(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isListening]);

  // Initial welcome greeting on HomePage mount (protected for React 18 StrictMode)
  useEffect(() => {
    const greetingTimer = setTimeout(() => {
      speak("Welcome to VisionAssist AI portal for blind students. Tap anywhere on the screen or press Spacebar to activate voice assistant.");
    }, 450);

    return () => {
      clearTimeout(greetingTimer);
    };
  }, []);

  const handleTextCommandSubmit = (e) => {
    e.preventDefault();
    if (!voiceQuery.trim()) return;
    processStudentVoiceCommand(voiceQuery);
  };

  return (
    <div style={{ backgroundColor: '#f0f9ff', color: '#0f172a', minHeight: '100vh', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", boxSizing: 'border-box' }}>
      
      {/* Listening Visual Overlay Modal when active */}
      {isListening && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(2, 132, 199, 0.25)',
          zIndex: 9999, display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(8px)'
        }}>
          <div style={{
            background: '#ffffff', border: '3px solid #0284c7',
            borderRadius: '24px', padding: '40px 60px', textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(2, 132, 199, 0.3)', maxWidth: '500px', width: '90%'
          }}>
            <Mic size={64} color="#ef4444" style={{ animation: 'pulse 1.2s infinite', marginBottom: '20px' }} />
            <h2 style={{ fontSize: '28px', color: '#0369a1', margin: '0 0 10px 0', fontWeight: '900' }}>
              Listening For Your Voice...
            </h2>
            <p style={{ fontSize: '18px', color: '#334155', margin: 0, fontWeight: '600' }}>
              Speak your command now (e.g. "Student Login", "Register", "Student Dashboard", "Read Features")
            </p>
          </div>
        </div>
      )}

      {/* Top Accessible Navigation Bar */}
      <header style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        padding: '16px 32px', background: '#ffffff', borderBottom: '1px solid #bae6fd',
        boxShadow: '0 2px 10px rgba(2, 132, 199, 0.05)',
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <ProjectLogo size="medium" />

        <nav style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to="/" style={navLinkStyleActive}>Home</Link>
          <Link to="/student-login" style={{
            background: '#0284c7',
            color: '#ffffff',
            padding: '8px 14px',
            borderRadius: '10px',
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: '800',
            boxShadow: '0 4px 10px rgba(2, 132, 199, 0.2)'
          }}>🎓 Student Login</Link>
          <Link to="/teacher-login" onClick={(e) => { e.preventDefault(); navigateSilent('/teacher-login'); }} style={{
            background: '#9333ea',
            color: '#ffffff',
            padding: '8px 14px',
            borderRadius: '10px',
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: '800',
            boxShadow: '0 4px 10px rgba(147, 51, 234, 0.2)'
          }}>👨‍🏫 Teacher Login</Link>
          <Link to="/admin-login" onClick={(e) => { e.preventDefault(); navigateSilent('/admin-login'); }} style={{
            background: '#d97706',
            color: '#ffffff',
            padding: '8px 14px',
            borderRadius: '10px',
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: '800',
            boxShadow: '0 4px 10px rgba(217, 119, 6, 0.2)'
          }}>🛡️ Admin Login</Link>
          <a href="#portal" style={navLinkStyle}>Menu</a>
          <button 
            type="button"
            onClick={() => { setShowContactModal(true); speak('Opening Contact Us and 24/7 Accessibility Support modal.'); }} 
            style={{ ...navLinkStyle, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Contact Us
          </button>
        </nav>
      </header>

      {/* STUDENT VOICE ASSISTANT COMMAND & INSTRUCTION BANNER */}
      <section style={{ 
        background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', 
        borderBottom: '2px solid #7dd3fc', 
        padding: '18px 32px'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1 1 400px' }}>
            <div style={{
              width: '46px', height: '46px', borderRadius: '50%',
              background: isListening ? '#fef2f2' : isSpeaking ? '#f0fdf4' : '#ffffff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `2px solid ${isListening ? '#ef4444' : isSpeaking ? '#22c55e' : '#0284c7'}`,
              boxShadow: '0 4px 10px rgba(2, 132, 199, 0.15)'
            }}>
              {isListening ? <Mic size={24} color="#ef4444" style={{ animation: 'pulse 1s infinite' }} /> : <Volume2 size={24} color="#0284c7" />}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#0369a1', letterSpacing: '0.5px' }}>
                  STUDENT VOICE ASSISTANT (TAP ANYWHERE TO SPEAK)
                </span>
                <span style={{ fontSize: '10px', background: '#0284c7', color: '#ffffff', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>
                  ACTIVE
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '14px', color: '#0f172a', fontWeight: '600' }}>
                {voiceStatus}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={readStudentInstructionsAloud}
              style={{
                backgroundColor: '#ffffff',
                color: '#0369a1',
                border: '2px solid #0284c7',
                padding: '12px 20px',
                borderRadius: '12px',
                fontWeight: '900',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.2)'
              }}
            >
              <Volume2 size={20} color="#0284c7" />
              📢 Read Instructions Aloud 🔊
            </button>

            <button
              type="button"
              onClick={startStudentVoiceListening}
              style={{
                backgroundColor: isListening ? '#ef4444' : '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '12px',
                fontWeight: '800',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
              }}
            >
              <Mic size={18} />
              {isListening ? 'Listening… Speak Now' : 'Tap Anywhere to Speak 🎙️'}
            </button>
          </div>

        </div>

        {/* Text Voice Command Fallback Bar */}
        <div style={{ maxWidth: '1200px', margin: '12px auto 0 auto' }}>
          <form onSubmit={handleTextCommandSubmit} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder='Or type student voice command (e.g. "student login", "register", "student dashboard", "read features")...'
              value={voiceQuery}
              onChange={(e) => setVoiceQuery(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#ffffff',
                border: '1px solid #7dd3fc',
                color: '#0f172a',
                fontSize: '13px',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              style={{
                background: '#0284c7',
                color: '#fff',
                border: 'none',
                padding: '10px 18px',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Execute Command
            </button>
          </form>
        </div>
      </section>

      {/* Main Content Section */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '36px 24px' }}>
        
        {/* INSTRUCTIONS CARD FOR BLIND STUDENTS */}
        <section style={{ 
          background: '#ffffff', 
          border: '2px solid #0284c7', 
          borderRadius: '24px', 
          padding: '32px', 
          marginBottom: '40px',
          boxShadow: '0 10px 30px rgba(2, 132, 199, 0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: '#e0f2fe', padding: '12px', borderRadius: '12px', border: '1px solid #7dd3fc' }}>
                <HelpCircle size={28} color="#0284c7" />
              </div>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#0369a1', margin: 0 }}>
                  📢 Complete Instructions for Blind Students
                </h2>
                <p style={{ fontSize: '13px', color: '#475569', margin: '2px 0 0 0' }}>
                  Step-by-step audio guide & voice navigation instructions
                </p>
              </div>
            </div>

            <button
              onClick={readStudentInstructionsAloud}
              style={{
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '10px 18px',
                borderRadius: '10px',
                fontWeight: '800',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Volume2 size={18} /> Play Full Audio Guide 🔊
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            
            <div style={instructionStepCardStyle}>
              <div style={stepBadgeStyle}>Step 1</div>
              <h3 style={stepTitleStyle}>Tap Anywhere to Speak</h3>
              <p style={stepBodyStyle}>
                Tap anywhere on your device screen at any time to open the microphone and speak your voice commands.
              </p>
            </div>

            <div style={instructionStepCardStyle}>
              <div style={stepBadgeStyle}>Step 2</div>
              <h3 style={stepTitleStyle}>Voice Login & Register</h3>
              <p style={stepBodyStyle}>
                Say <strong>"Student Login"</strong> to sign in, or say <strong>"Register"</strong> to create a new blind student account with hands-free voice prompts.
              </p>
            </div>

            <div style={instructionStepCardStyle}>
              <div style={stepBadgeStyle}>Step 3</div>
              <h3 style={stepTitleStyle}>Student Portal Dashboard</h3>
              <p style={stepBodyStyle}>
                Say <strong>"Student Dashboard"</strong> to access your profile, exam paper audio narration, voice answer dictation, and results.
              </p>
            </div>

          </div>
        </section>

        {/* Banner for Students */}
        <div style={{
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
          borderRadius: '24px',
          padding: '40px 32px',
          boxShadow: '0 20px 40px -15px rgba(2, 132, 199, 0.3)',
          marginBottom: '40px',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '24px'
        }}>
          <div style={{ flex: '1 1 500px' }}>
            <span style={{ display: 'inline-block', padding: '6px 14px', background: 'rgba(255,255,255,0.2)', borderRadius: '20px', fontSize: '13px', fontWeight: '700', marginBottom: '16px', color: '#ffffff' }}>
              🎓 AI Voice Assistant for Blind Students
            </span>
            <h2 style={{ fontSize: '34px', fontWeight: '900', margin: '0 0 12px 0', lineHeight: 1.2, color: '#ffffff' }}>
              Accessible Learning & Visual Guidance System
            </h2>
            <p style={{ fontSize: '16px', color: '#e0f2fe', margin: '0 0 24px 0', lineHeight: 1.6, maxWidth: '640px' }}>
              Designed for visually impaired candidates with hands-free voice login, audio question papers, speech-to-text answer dictation, OCR document readers, and currency identifiers.
            </p>
            
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              <button 
                onClick={() => processStudentVoiceCommand('read features')}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#0369a1',
                  border: 'none',
                  padding: '14px 24px',
                  fontSize: '15px',
                  fontWeight: '800',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.1)'
                }}
              >
                <Volume2 size={20} color="#0369a1" />
                Read All Features Aloud 🔊
              </button>

              <button 
                onClick={() => navigate('/student-login')}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#0284c7',
                  border: 'none',
                  padding: '14px 20px',
                  fontSize: '14px',
                  fontWeight: '900',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.15)'
                }}
              >
                🎓 Student Login <ArrowRight size={18} />
              </button>

              <button 
                onClick={() => navigateSilent('/teacher-login')}
                style={{
                  backgroundColor: '#9333ea',
                  color: '#ffffff',
                  border: 'none',
                  padding: '14px 20px',
                  fontSize: '14px',
                  fontWeight: '800',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(147, 51, 234, 0.35)'
                }}
              >
                👨‍🏫 Teacher Login <ArrowRight size={18} />
              </button>

              <button 
                onClick={() => navigateSilent('/admin-login')}
                style={{
                  backgroundColor: '#d97706',
                  color: '#ffffff',
                  border: 'none',
                  padding: '14px 20px',
                  fontSize: '14px',
                  fontWeight: '800',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(217, 119, 6, 0.35)'
                }}
              >
                🛡️ Admin Login <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Voice Access Shortcuts for Blind Students */}
        <section style={{ marginBottom: '40px', background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #bae6fd', boxShadow: '0 4px 16px rgba(2, 132, 199, 0.06)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '800', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Radio size={20} color="#0284c7" /> Voice Shortcuts for Students (Or Tap Screen Anywhere)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <button 
              onClick={() => processStudentVoiceCommand('student login')}
              style={voiceShortcutBtnStyle}
            >
              🎙️ Say "Student Login"
            </button>

            <button 
              onClick={() => processStudentVoiceCommand('register')}
              style={voiceShortcutBtnStyle}
            >
              🎙️ Say "Register Account"
            </button>

            <button 
              onClick={() => processStudentVoiceCommand('student dashboard')}
              style={voiceShortcutBtnStyle}
            >
              🎙️ Say "Student Dashboard"
            </button>

            <button 
              onClick={() => processStudentVoiceCommand('read features')}
              style={voiceShortcutBtnStyle}
            >
              🎙️ Say "Read Features"
            </button>
          </div>
        </section>

        {/* Role Portal Quick Access Section */}
        <section id="portal" style={{ marginBottom: '48px', scrollMarginTop: '100px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#0369a1', marginBottom: '8px' }}>
            Select Portal Access Role
          </h2>
          <p style={{ color: '#475569', fontSize: '14px', marginBottom: '24px' }}>
            VisionAssist supports custom interfaces and voice controls for Students, Teachers, and Administrators.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            
            {/* Student Role Card */}
            <div style={roleCardStyleStudent}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                <div style={{ background: '#e0f2fe', padding: '14px', borderRadius: '14px', border: '1px solid #7dd3fc' }}>
                  <Mic size={28} color="#0284c7" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0369a1' }}>Student Portal</h3>
                  <span style={{ fontSize: '12px', color: '#15803d', fontWeight: '700' }}>✓ Full Voice Assistance Active</span>
                </div>
              </div>
              <p style={{ color: '#475569', fontSize: '13px', lineHeight: 1.5, marginBottom: '20px' }}>
                Hands-free voice login & registration, screen reader narration, audio question paper reader, and voice answer dictation.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => navigate('/student-login')} style={roleBtnStyle}>Student Login</button>
                <button onClick={() => navigate('/student-register')} style={roleOutlineBtnStyle}>Register</button>
                <button onClick={() => navigate('/dashboard')} style={roleDashBtnStyle}>Dashboard</button>
              </div>
            </div>

            {/* Teacher Role Card */}
            <div style={roleCardStyleTeacher}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                <div style={{ background: '#f3e8ff', padding: '14px', borderRadius: '14px', border: '1px solid #d8b4fe' }}>
                  <UserCheck size={28} color="#9333ea" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#7e22ce' }}>Teacher Portal</h3>
                  <span style={{ fontSize: '12px', color: '#6b21a8', fontWeight: '600' }}>Exam Creation & Evaluation</span>
                </div>
              </div>
              <p style={{ color: '#475569', fontSize: '13px', lineHeight: 1.5, marginBottom: '20px' }}>
                Create accessible exams with TTS narration rules, AI draft question generator, real-time student monitoring, and voice response verification.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => navigateSilent('/teacher-login')} style={roleBtnTeacher}>Teacher Login</button>
                <button onClick={() => navigateSilent('/teacher-register')} style={roleOutlineBtnTeacher}>Register</button>
                <button onClick={() => navigateSilent('/teacher-dashboard')} style={roleDashBtnTeacher}>Dashboard</button>
              </div>
            </div>

            {/* Admin Role Card */}
            <div style={roleCardStyleAdmin}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                <div style={{ background: '#fef3c7', padding: '14px', borderRadius: '14px', border: '1px solid #fde68a' }}>
                  <Shield size={28} color="#d97706" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#b45309' }}>Admin Portal</h3>
                  <span style={{ fontSize: '12px', color: '#92400e', fontWeight: '600' }}>System Health & User Control</span>
                </div>
              </div>
              <p style={{ color: '#475569', fontSize: '13px', lineHeight: 1.5, marginBottom: '20px' }}>
                Manage user accounts (Students, Teachers, Admins), monitor OCR logs, inspect currency recognition telemetry, and run system health checks.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => navigateSilent('/admin-login')} style={roleBtnAdmin}>Admin Login</button>
                <button onClick={() => navigateSilent('/admin-dashboard')} style={roleDashBtnAdmin}>Dashboard</button>
              </div>
            </div>

          </div>
        </section>

      {/* Contact Us Modal Overlay (Hidden by default, shown ONLY when clicking Contact Us) */}
      {showContactModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            backdropFilter: 'blur(6px)',
            boxSizing: 'border-box'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowContactModal(false);
              if (window.location.hash === '#contact') {
                window.history.replaceState(null, '', window.location.pathname);
              }
            }
          }}
        >
          <div style={{
            background: '#ffffff',
            border: '3px solid #0284c7',
            borderRadius: '24px',
            padding: '32px',
            boxShadow: '0 25px 50px -12px rgba(2, 132, 199, 0.35)',
            maxWidth: '1000px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            position: 'relative'
          }}>
            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                setShowContactModal(false);
                if (window.location.hash === '#contact') {
                  window.history.replaceState(null, '', window.location.pathname);
                }
              }}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: '#f1f5f9',
                color: '#0f172a',
                border: '1px solid #cbd5e1',
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                fontSize: '18px',
                fontWeight: '900',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
              title="Close Contact Us Form"
            >
              ✕
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div style={{ background: '#e0f2fe', padding: '14px', borderRadius: '16px', border: '1px solid #7dd3fc' }}>
                <span style={{ fontSize: '28px' }}>📞</span>
              </div>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#0369a1', margin: 0 }}>
                  Contact Us & 24/7 Accessibility Support
                </h2>
                <p style={{ color: '#475569', fontSize: '13px', margin: '4px 0 0 0' }}>
                  Have questions, need technical assistance, or want to report an issue? Reach out to our team 24/7.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginTop: '20px' }}>
              {/* Contact Form */}
              <form onSubmit={handleContactSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {contactSubmitted && (
                  <div style={{ background: '#f0fdf4', border: '2px solid #22c55e', color: '#15803d', padding: '12px 16px', borderRadius: '10px', fontSize: '14px', fontWeight: '800' }}>
                    ✓ Message received! Delivered to the Administrator Dashboard. Our team will review and respond shortly.
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: '700', color: '#0369a1' }}>
                    Your Full Name *
                    <input 
                      type="text" 
                      required 
                      value={contactForm.name} 
                      onChange={e => setContactForm({ ...contactForm, name: e.target.value })} 
                      placeholder="e.g. Nayana N S" 
                      style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #bae6fd', fontSize: '14px', outline: 'none' }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: '700', color: '#0369a1' }}>
                    Email Address *
                    <input 
                      type="email" 
                      required 
                      value={contactForm.email} 
                      onChange={e => setContactForm({ ...contactForm, email: e.target.value })} 
                      placeholder="e.g. nayana@example.com" 
                      style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #bae6fd', fontSize: '14px', outline: 'none' }}
                    />
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: '700', color: '#0369a1' }}>
                    Your Role
                    <select 
                      value={contactForm.role} 
                      onChange={e => setContactForm({ ...contactForm, role: e.target.value })} 
                      style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #bae6fd', fontSize: '14px', outline: 'none', background: '#fff' }}
                    >
                      <option value="Student">Blind Student</option>
                      <option value="Teacher">Teacher / Educator</option>
                      <option value="Admin">Administrator</option>
                      <option value="Parent">Parent / Guardian</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: '700', color: '#0369a1' }}>
                    Topic / Query Type
                    <select 
                      value={contactForm.subject} 
                      onChange={e => setContactForm({ ...contactForm, subject: e.target.value })} 
                      style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #bae6fd', fontSize: '14px', outline: 'none', background: '#fff' }}
                    >
                      <option value="General Inquiry">General Inquiry</option>
                      <option value="Exam Portal Support">Exam Portal Support</option>
                      <option value="Voice Assistant Issue">Voice Assistant Issue</option>
                      <option value="Technical Bug">Technical Bug Report</option>
                      <option value="Accessibility Feature Request">Accessibility Request</option>
                    </select>
                  </label>
                </div>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', fontWeight: '700', color: '#0369a1' }}>
                  Your Message / Description *
                  <textarea 
                    rows={4} 
                    required 
                    value={contactForm.message} 
                    onChange={e => setContactForm({ ...contactForm, message: e.target.value })} 
                    placeholder="Type your message or question here..." 
                    style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #bae6fd', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }}
                  />
                </label>

                <button 
                  type="submit" 
                  style={{ 
                    background: '#0284c7', 
                    color: '#ffffff', 
                    border: 'none', 
                    padding: '12px 24px', 
                    borderRadius: '10px', 
                    fontWeight: '800', 
                    fontSize: '15px', 
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
                    marginTop: '6px'
                  }}
                >
                  ✉️ Send Message to Support Team
                </button>
              </form>

              {/* Direct Support Channels Box */}
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0369a1' }}>
                  💬 Direct Support Channels
                </h3>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '10px', border: '1px solid #bae6fd', color: '#0284c7', fontSize: '18px' }}>📧</div>
                  <div>
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>24/7 Support Email</strong>
                    <div style={{ fontSize: '13px', color: '#0284c7', fontWeight: '700' }}>support@visionassist.ai</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '10px', border: '1px solid #bae6fd', color: '#0284c7', fontSize: '18px' }}>📞</div>
                  <div>
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>Accessibility Helpline (Toll-Free)</strong>
                    <div style={{ fontSize: '13px', color: '#0284c7', fontWeight: '700' }}>1-800-VISION-AI (1-800-847-4662)</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '10px', border: '1px solid #bae6fd', color: '#0284c7', fontSize: '18px' }}>🎙️</div>
                  <div>
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>Student Voice Assist Command</strong>
                    <div style={{ fontSize: '13px', color: '#475569' }}>Say <b>"Help"</b> or <b>"Read Instructions"</b> aloud</div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '10px', border: '1px solid #bae6fd', color: '#0284c7', fontSize: '18px' }}>📍</div>
                  <div>
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>Accessibility Research Hub</strong>
                    <div style={{ fontSize: '13px', color: '#475569' }}>VisionAssist Labs · AI Accessible Tech Division</div>
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={readStudentInstructionsAloud} 
                  style={{ background: '#ffffff', color: '#0369a1', border: '2px solid #0284c7', padding: '10px 16px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', marginTop: 'auto' }}
                >
                  🔊 Read Audio Support Instructions Aloud
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #bae6fd', padding: '32px 24px', textAlign: 'center', color: '#64748b', fontSize: '13px', background: '#ffffff' }}>
        <p style={{ margin: '0 0 6px 0' }}>
          <button 
            type="button" 
            onClick={() => { setShowContactModal(true); speak('Opening Contact Us modal'); }} 
            style={{ background: 'none', border: 'none', color: '#0369a1', cursor: 'pointer', fontWeight: '800', fontSize: '15px' }}
          >
            📞 Contact Us & 24/7 Accessibility Support
          </button>
        </p>
        <p style={{ margin: '0 0 12px 0', color: '#475569' }}>Have questions about VisionAssist AI? Reach out to our 24/7 Accessibility Support Team at <a href="mailto:support@visionassist.ai" style={{ color: '#0284c7', textDecoration: 'none', fontWeight: '700' }}>support@visionassist.ai</a></p>
        <div>VisionAssist AI — Accessible AI Blind Assistant Project © 2026. Designed for Blind & Visually Impaired Students, Teachers & Admins.</div>
      </footer>
    </div>
  );
}

const navLinkStyle = {
  color: '#475569',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: '600',
  padding: '6px 12px'
};

const navLinkStyleActive = {
  color: '#0284c7',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: '800',
  padding: '6px 12px'
};

const navBtnStyleStudent = {
  background: '#e0f2fe',
  color: '#0369a1',
  border: '1px solid #7dd3fc',
  borderRadius: '8px',
  padding: '6px 12px',
  textDecoration: 'none',
  fontSize: '13px',
  fontWeight: '700'
};

const navBtnStyleTeacher = {
  background: '#f3e8ff',
  color: '#7e22ce',
  border: '1px solid #d8b4fe',
  borderRadius: '8px',
  padding: '6px 12px',
  textDecoration: 'none',
  fontSize: '13px',
  fontWeight: '700'
};

const navBtnStyleAdmin = {
  background: '#fef3c7',
  color: '#b45309',
  border: '1px solid #fde68a',
  borderRadius: '8px',
  padding: '6px 12px',
  textDecoration: 'none',
  fontSize: '13px',
  fontWeight: '700'
};

const instructionStepCardStyle = {
  background: '#f0f9ff',
  border: '1px solid #bae6fd',
  borderRadius: '16px',
  padding: '20px',
  position: 'relative'
};

const stepBadgeStyle = {
  display: 'inline-block',
  background: '#0284c7',
  color: '#ffffff',
  fontSize: '11px',
  fontWeight: '800',
  padding: '4px 10px',
  borderRadius: '20px',
  marginBottom: '10px'
};

const stepTitleStyle = {
  fontSize: '16px',
  fontWeight: '800',
  color: '#0369a1',
  margin: '0 0 6px 0'
};

const stepBodyStyle = {
  fontSize: '13px',
  color: '#334155',
  margin: 0,
  lineHeight: 1.5
};

const roleCardStyle = {
  background: '#ffffff',
  border: '1px solid #bae6fd',
  borderRadius: '20px',
  padding: '28px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  boxShadow: '0 4px 16px rgba(2, 132, 199, 0.05)'
};

const roleCardStyleStudent = {
  background: '#ffffff',
  border: '2px solid #0284c7',
  borderRadius: '20px',
  padding: '28px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  boxShadow: '0 8px 24px -6px rgba(2, 132, 199, 0.2)'
};

const roleBtnStyle = {
  flex: 1,
  padding: '10px',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: '#0284c7',
  color: '#ffffff',
  fontWeight: '700',
  fontSize: '13px',
  cursor: 'pointer'
};

const roleCardStyleTeacher = {
  background: '#ffffff',
  border: '2px solid #d8b4fe',
  borderRadius: '20px',
  padding: '28px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  boxShadow: '0 8px 24px -6px rgba(147, 51, 234, 0.15)'
};

const roleCardStyleAdmin = {
  background: '#ffffff',
  border: '2px solid #fde68a',
  borderRadius: '20px',
  padding: '28px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  boxShadow: '0 8px 24px -6px rgba(217, 119, 6, 0.15)'
};

const roleBtnTeacher = {
  flex: 1,
  padding: '10px',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: '#9333ea',
  color: '#ffffff',
  fontWeight: '700',
  fontSize: '13px',
  cursor: 'pointer'
};

const roleBtnAdmin = {
  flex: 1,
  padding: '10px',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: '#d97706',
  color: '#ffffff',
  fontWeight: '700',
  fontSize: '13px',
  cursor: 'pointer'
};

const roleOutlineBtnStyle = {
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid #bae6fd',
  backgroundColor: '#f0f9ff',
  color: '#0369a1',
  fontWeight: '600',
  fontSize: '13px',
  cursor: 'pointer'
};

const roleOutlineBtnTeacher = {
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid #e9d5ff',
  backgroundColor: '#faf5ff',
  color: '#7e22ce',
  fontWeight: '600',
  fontSize: '13px',
  cursor: 'pointer'
};

const roleOutlineBtnAdmin = {
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid #fde68a',
  backgroundColor: '#fffbeb',
  color: '#b45309',
  fontWeight: '600',
  fontSize: '13px',
  cursor: 'pointer'
};

const roleDashBtnStyle = {
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid #bae6fd',
  backgroundColor: '#e0f2fe',
  color: '#0284c7',
  fontWeight: '700',
  fontSize: '13px',
  cursor: 'pointer'
};

const roleDashBtnTeacher = {
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid #d8b4fe',
  backgroundColor: '#f3e8ff',
  color: '#9333ea',
  fontWeight: '700',
  fontSize: '13px',
  cursor: 'pointer'
};

const roleDashBtnAdmin = {
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid #fcd34d',
  backgroundColor: '#fef3c7',
  color: '#d97706',
  fontWeight: '700',
  fontSize: '13px',
  cursor: 'pointer'
};

const voiceShortcutBtnStyle = {
  background: '#f0f9ff',
  border: '1px solid #bae6fd',
  color: '#0369a1',
  padding: '12px',
  borderRadius: '10px',
  fontWeight: '700',
  fontSize: '13px',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'all 0.2s ease'
};

const featureCardStyle = {
  background: '#ffffff',
  padding: '24px',
  borderRadius: '16px',
  border: '1px solid #bae6fd',
  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.05)',
  cursor: 'pointer'
};

const cardTitleStyle = {
  color: '#0f172a',
  marginBottom: '8px',
  marginTop: 0,
  fontSize: '16px',
  fontWeight: '700'
};

const cardBodyStyle = {
  color: '#475569',
  fontSize: '13px',
  margin: 0,
  lineHeight: 1.5
};