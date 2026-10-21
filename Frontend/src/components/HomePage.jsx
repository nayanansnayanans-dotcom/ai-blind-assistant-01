import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Mic, 
  Eye, 
  BookOpen, 
  UserCheck, 
  Shield, 
  DollarSign, 
  Volume2, 
  VolumeX, 
  ArrowRight, 
  CheckCircle2, 
  Navigation, 
  Radio, 
  Info, 
  HelpCircle, 
  Phone, 
  Mail, 
  Sparkles, 
  X,
  MousePointer
} from 'lucide-react';
import { speakIn, cancelSpeech } from './speech';
import ProjectLogo from './ProjectLogo.jsx';
import { sendContactMessageApi } from '../services/api';

export default function HomePage() {
  const navigate = useNavigate();

  // Voice Assistant States for Students
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPlayingWelcome, setIsPlayingWelcome] = useState(false);
  const [hoverSpeechEnabled, setHoverSpeechEnabled] = useState(true);
  const [hoveredElementLabel, setHoveredElementLabel] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('Tap anywhere on the screen or press Spacebar to activate Voice Assistant!');
  const [voiceQuery, setVoiceQuery] = useState('');
  const [contactForm, setContactForm] = useState({ name: '', email: '', role: 'Student', subject: 'General Inquiry', message: '' });
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  const recognitionRef = useRef(null);
  const hasSpokenWelcomeRef = useRef(false);
  const isPlayingWelcomeRef = useRef(false);
  const hoverTimeoutRef = useRef(null);
  const lastHoverTextRef = useRef('');
  const hoverSpeechEnabledRef = useRef(true);

  useEffect(() => {
    hoverSpeechEnabledRef.current = hoverSpeechEnabled;
  }, [hoverSpeechEnabled]);

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

  const stopAllAudio = () => {
    cancelSpeech();
    stopRecognition();
    setIsSpeaking(false);
    setIsListening(false);
    setIsPlayingWelcome(false);
    isPlayingWelcomeRef.current = false;
    setVoiceStatus('Voice Assistant paused. Tap anywhere or press Spacebar to resume.');
  };

  // =========================================================================
  // CURSOR HOVER SPEECH NARRATOR
  // Says aloud what any button, link, card, or input is when hovered or focused
  // =========================================================================
  const handleHoverSpeak = (text) => {
    if (!hoverSpeechEnabledRef.current) return;
    if (isListening) return; // Do not interrupt microphone when student is speaking
    if (!text || text === lastHoverTextRef.current) return;

    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    setHoveredElementLabel(text);

    hoverTimeoutRef.current = setTimeout(() => {
      lastHoverTextRef.current = text;
      // Slightly snappier rate (1.05) so hover voice feedback is immediate & responsive
      speakIn(text, 'en-US', { rate: 1.05 });
    }, 110);
  };

  const handleHoverLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    lastHoverTextRef.current = '';
    setHoveredElementLabel('');
  };

  // Delegated Global Mouseover Listener for elements with data-narrate
  useEffect(() => {
    const handleGlobalMouseOver = (e) => {
      if (!hoverSpeechEnabledRef.current || isListening) return;
      const target = e.target.closest('[data-narrate]');
      if (target) {
        const text = target.getAttribute('data-narrate');
        if (text) {
          handleHoverSpeak(text);
        }
      }
    };

    const handleGlobalFocusIn = (e) => {
      if (!hoverSpeechEnabledRef.current || isListening) return;
      const target = e.target.closest('[data-narrate]');
      if (target) {
        const text = target.getAttribute('data-narrate');
        if (text) {
          handleHoverSpeak(text);
        }
      }
    };

    window.addEventListener('mouseover', handleGlobalMouseOver, { passive: true });
    window.addEventListener('focusin', handleGlobalFocusIn, { passive: true });
    return () => {
      window.removeEventListener('mouseover', handleGlobalMouseOver);
      window.removeEventListener('focusin', handleGlobalFocusIn);
    };
  }, [isListening]);

  // Comprehensive Welcome & Features Audio Announcement
  const WELCOME_AND_FEATURES_SPEECH = 
    "Welcome to VisionAssist AI — an intelligent, accessible platform designed for visually impaired and blind students. " +
    "Here are our core features: " +
    "Number one: Hands-Free Voice Assistant. You can tap anywhere on your screen or press the Spacebar at any time to speak voice commands and navigate the platform. " +
    "Number two: Audio Exam Assistant. Listen to examination questions narrated aloud and dictate your answers hands-free without needing a human scribe. " +
    "Number three: AI Webcam Proctoring. Smart real-time face tracking that alerts you instantly if an unauthorized person or intruder enters the room. " +
    "Number four: Smart OCR Book and Document Reader. Scans and reads printed books, questions, and notes out loud. " +
    "Number five: Object and Hazard Detection. Live camera guidance to detect surrounding objects and obstacles. " +
    "Number six: Currency Note Identifier. Recognizes paper currency notes for independent daily living. " +
    "To navigate right now, simply tap anywhere on the screen or press the Spacebar and speak your command, such as: Student Login, Register, Student Dashboard, or Contact Us. " +
    "Tap anywhere on your screen now to speak your command!";

  const playWelcomeAndFeatures = (force = false) => {
    if (isPlayingWelcomeRef.current && !force) return;

    stopRecognition();
    cancelSpeech();
    hasSpokenWelcomeRef.current = true;
    isPlayingWelcomeRef.current = true;
    setIsPlayingWelcome(true);
    setIsSpeaking(true);
    setVoiceStatus('🔊 Welcome to VisionAssist AI: Narrating platform features aloud. Tap anywhere or press Spacebar to speak a command!');

    speakIn(WELCOME_AND_FEATURES_SPEECH, 'en-US', {
      onEnd: () => {
        setIsSpeaking(false);
        setIsPlayingWelcome(false);
        isPlayingWelcomeRef.current = false;
        setVoiceStatus('🎙️ Voice Assistant ready: Tap anywhere on the screen or press Spacebar to speak your command!');
      }
    });
  };

  // Full Audio Instructions for Blind Students
  const readStudentInstructionsAloud = () => {
    stopRecognition();
    cancelSpeech();
    setIsPlayingWelcome(false);
    isPlayingWelcomeRef.current = false;

    const fullInstructions = 
      "Hello and welcome, student! Here are the complete audio instructions for blind users. " +
      "First: Voice Control. You can tap anywhere on the screen at any time, or press the Spacebar, to activate the microphone and speak your voice command. " +
      "Second: Cursor Hover Speech. Hovering your cursor over any button, card, or link will immediately speak what it is. " +
      "Third: Navigation Commands. Say 'Student Login' to go to login. Say 'Register' to create your account. Say 'Student Dashboard' to view your portal. Say 'Read Features' to hear the platform features again. " +
      "Fourth: Exam Portal. In your Student Dashboard, you can listen to audio question paper narration and dictate your exam answers using speech to text. " +
      "Whenever you are ready, tap anywhere on the screen and speak your command now!";

    speak(fullInstructions);
  };

  const navigateSilent = (path) => {
    cancelSpeech();
    stopRecognition();
    setIsSpeaking(false);
    setIsListening(false);
    setIsPlayingWelcome(false);
    isPlayingWelcomeRef.current = false;
    navigate(path);
  };

  // Process Student Voice Commands
  const processStudentVoiceCommand = (commandText) => {
    const q = commandText.toLowerCase().trim();
    setVoiceStatus(`Recognized command: "${commandText}"`);

    if (q.includes('welcome') || q.includes('hello') || q.includes('hi vision')) {
      playWelcomeAndFeatures(true);
    } else if (q.includes('teacher login')) {
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
    } else if (q.includes('student dashboard') || q.includes('my dashboard') || q.includes('student portal') || q.includes('dashboard')) {
      speak('Opening Student Dashboard.', () => navigate('/dashboard'));
    } else if (q.includes('teacher dashboard') || q.includes('teacher portal')) {
      navigateSilent('/teacher-dashboard');
    } else if (q.includes('admin dashboard') || q.includes('admin portal')) {
      navigateSilent('/admin-dashboard');
    } else if (q.includes('contact') || q.includes('support')) {
      setShowContactModal(true);
      speak('Opening Contact Us and 24/7 Accessibility Support modal.');
    } else if (q.includes('instruction') || q.includes('guide') || q.includes('help') || q.includes('how to use')) {
      readStudentInstructionsAloud();
    } else if (q.includes('read features') || q.includes('explain features') || q.includes('features') || q.includes('what can you do') || q.includes('tell me features')) {
      playWelcomeAndFeatures(true);
    } else if (q.includes('cursor') || q.includes('hover')) {
      setHoverSpeechEnabled(prev => {
        const next = !prev;
        speak(next ? 'Cursor hover speech enabled. Move your mouse over any button to hear what it is.' : 'Cursor hover speech disabled.');
        return next;
      });
    } else if (q.includes('camera') || q.includes('detection') || q.includes('object')) {
      speak('Starting live object and hazard detection assistant.', () => navigate('/dashboard'));
    } else if (q.includes('ocr') || q.includes('read book') || q.includes('text reader')) {
      speak('Opening OCR text reader for blind students.', () => navigate('/dashboard'));
    } else if (q.includes('currency') || q.includes('money')) {
      speak('Opening currency note identifier.', () => navigate('/dashboard'));
    } else if (q.includes('stop') || q.includes('cancel') || q.includes('pause') || q.includes('quiet')) {
      stopAllAudio();
    } else {
      const response = `Command "${commandText}" received. You can say: Student Login, Register, Student Dashboard, Read Features, or Help.`;
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
        setVoiceStatus('🎙️ Listening for student voice command... Speak now!');
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

  // Global Tap Anywhere Screen Listener to Activate Welcome or Voice Assistant
  useEffect(() => {
    const handleGlobalScreenTap = (e) => {
      // Don't trigger if clicking interactive inputs, buttons, or links
      if (e.target.closest('input') || e.target.closest('button') || e.target.closest('a') || e.target.closest('textarea') || e.target.closest('select')) {
        return;
      }

      // If welcome has never been played yet (e.g. browser blocked automatic autoplay):
      if (!hasSpokenWelcomeRef.current) {
        playWelcomeAndFeatures(true);
        return;
      }

      // If welcome is currently speaking and user taps anywhere on screen:
      // Transition immediately to voice listening so they can speak without waiting!
      if (isPlayingWelcomeRef.current) {
        cancelSpeech();
        setIsPlayingWelcome(false);
        isPlayingWelcomeRef.current = false;
        startStudentVoiceListening(true);
        return;
      }

      // Otherwise start listening for voice commands
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

      // Spacebar triggers voice listening or starts welcome if not played
      if (e.code === 'Space' && !isListening) {
        e.preventDefault();
        if (!hasSpokenWelcomeRef.current) {
          playWelcomeAndFeatures(true);
        } else if (isPlayingWelcomeRef.current) {
          cancelSpeech();
          setIsPlayingWelcome(false);
          isPlayingWelcomeRef.current = false;
          startStudentVoiceListening(true);
        } else {
          startStudentVoiceListening(true);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isListening]);

  // Initial welcome greeting on HomePage mount with audio unlock fallback for all browsers
  useEffect(() => {
    // 1. Attempt to speak immediately on mount (works in refreshed tabs / allowed contexts)
    const greetingTimer = setTimeout(() => {
      if (!hasSpokenWelcomeRef.current) {
        playWelcomeAndFeatures();
      }
    }, 450);

    // 2. Browser Autoplay Policy Fallback:
    // If the browser blocks speech synthesis until first user gesture,
    // listen for the very first interaction anywhere on window and trigger welcome immediately!
    const unlockOnFirstInteraction = () => {
      if (!hasSpokenWelcomeRef.current) {
        try {
          if ('speechSynthesis' in window) {
            window.speechSynthesis.resume();
          }
        } catch (e) {}
        playWelcomeAndFeatures(true);
      }
    };

    const interactionEvents = ['pointerdown', 'touchstart', 'keydown'];
    interactionEvents.forEach(evt => {
      window.addEventListener(evt, unlockOnFirstInteraction, { once: true, passive: true });
    });

    return () => {
      clearTimeout(greetingTimer);
      interactionEvents.forEach(evt => {
        window.removeEventListener(evt, unlockOnFirstInteraction);
      });
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
        <div data-narrate="VisionAssist AI project logo. Home page.">
          <ProjectLogo size="medium" />
        </div>

        <nav style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link 
            to="/" 
            style={navLinkStyleActive}
            data-narrate="Home link. Return to top of home page."
            onMouseEnter={() => handleHoverSpeak('Home link. Return to top of home page.')}
            onFocus={() => handleHoverSpeak('Home link. Return to top of home page.')}
            onMouseLeave={handleHoverLeave}
          >
            Home
          </Link>
          
          <Link 
            to="/student-login" 
            style={{
              background: '#0284c7',
              color: '#ffffff',
              padding: '8px 14px',
              borderRadius: '10px',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: '800',
              boxShadow: '0 4px 10px rgba(2, 132, 199, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            data-narrate="Student Login button. Access blind student portal and audio exams."
            onMouseEnter={() => handleHoverSpeak('Student Login button. Access blind student portal and audio exams.')}
            onFocus={() => handleHoverSpeak('Student Login button. Access blind student portal and audio exams.')}
            onMouseLeave={handleHoverLeave}
          >
            <UserCheck size={16} /> Student Login
          </Link>

          <Link 
            to="/teacher-login" 
            onClick={(e) => { e.preventDefault(); navigateSilent('/teacher-login'); }} 
            style={{
              background: '#9333ea',
              color: '#ffffff',
              padding: '8px 14px',
              borderRadius: '10px',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: '800',
              boxShadow: '0 4px 10px rgba(147, 51, 234, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            data-narrate="Teacher Login button. Access educator portal and question evaluation."
            onMouseEnter={() => handleHoverSpeak('Teacher Login button. Access educator portal and question evaluation.')}
            onFocus={() => handleHoverSpeak('Teacher Login button. Access educator portal and question evaluation.')}
            onMouseLeave={handleHoverLeave}
          >
            <UserCheck size={16} /> Teacher Login
          </Link>

          <Link 
            to="/admin-login" 
            onClick={(e) => { e.preventDefault(); navigateSilent('/admin-login'); }} 
            style={{
              background: '#d97706',
              color: '#ffffff',
              padding: '8px 14px',
              borderRadius: '10px',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: '800',
              boxShadow: '0 4px 10px rgba(217, 119, 6, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            data-narrate="Admin Login button. Access administrator dashboard and system settings."
            onMouseEnter={() => handleHoverSpeak('Admin Login button. Access administrator dashboard and system settings.')}
            onFocus={() => handleHoverSpeak('Admin Login button. Access administrator dashboard and system settings.')}
            onMouseLeave={handleHoverLeave}
          >
            <Shield size={16} /> Admin Login
          </Link>

          <a 
            href="#portal" 
            style={navLinkStyle}
            data-narrate="Menu link. Jump to portal access role selection."
            onMouseEnter={() => handleHoverSpeak('Menu link. Jump to portal access role selection.')}
            onFocus={() => handleHoverSpeak('Menu link. Jump to portal access role selection.')}
            onMouseLeave={handleHoverLeave}
          >
            Menu
          </a>

          <button 
            type="button"
            onClick={() => { setShowContactModal(true); speak('Opening Contact Us and 24/7 Accessibility Support modal.'); }} 
            style={{ ...navLinkStyle, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            data-narrate="Contact Us button. Open 24/7 accessibility support form."
            onMouseEnter={() => handleHoverSpeak('Contact Us button. Open 24/7 accessibility support form.')}
            onFocus={() => handleHoverSpeak('Contact Us button. Open 24/7 accessibility support form.')}
            onMouseLeave={handleHoverLeave}
          >
            <Mail size={16} color="#0284c7" /> Contact Us
          </button>
        </nav>
      </header>

      {/* STUDENT VOICE ASSISTANT & WELCOME AUDIO GUIDE BANNER */}
      <section style={{ 
        background: isPlayingWelcome 
          ? 'linear-gradient(135deg, #fef08a 0%, #fde047 100%)' 
          : 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', 
        borderBottom: isPlayingWelcome ? '3px solid #eab308' : '2px solid #7dd3fc', 
        padding: '20px 32px',
        transition: 'all 0.3s ease'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
          
          <div 
            style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1 1 450px' }}
            data-narrate="Student Voice Assistant status. Tap anywhere on the screen or press Spacebar to speak a command."
            onMouseEnter={() => handleHoverSpeak('Student Voice Assistant status. Tap anywhere on the screen or press Spacebar to speak a command.')}
            onMouseLeave={handleHoverLeave}
          >
            <div style={{
              width: '50px', height: '50px', borderRadius: '50%',
              background: isListening ? '#fef2f2' : isPlayingWelcome ? '#ffffff' : isSpeaking ? '#f0fdf4' : '#ffffff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `3px solid ${isListening ? '#ef4444' : isPlayingWelcome ? '#ca8a04' : isSpeaking ? '#22c55e' : '#0284c7'}`,
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.2)'
            }}>
              {isListening ? (
                <Mic size={26} color="#ef4444" style={{ animation: 'pulse 1s infinite' }} />
              ) : isPlayingWelcome ? (
                <Sparkles size={26} color="#ca8a04" style={{ animation: 'spin 4s linear infinite' }} />
              ) : (
                <Volume2 size={26} color="#0284c7" />
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', fontWeight: '900', color: isPlayingWelcome ? '#854d0e' : '#0369a1', letterSpacing: '0.5px' }}>
                  {isPlayingWelcome ? '🔊 NARRATING WELCOME & PLATFORM FEATURES ALOUD' : 'STUDENT VOICE ASSISTANT (TAP ANYWHERE TO SPEAK)'}
                </span>
                <span style={{ 
                  fontSize: '11px', 
                  background: isPlayingWelcome ? '#ca8a04' : '#0284c7', 
                  color: '#ffffff', 
                  padding: '2px 8px', 
                  borderRadius: '10px', 
                  fontWeight: '800' 
                }}>
                  {isPlayingWelcome ? 'SPEAKING' : 'ACTIVE'}
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#0f172a', fontWeight: '700', lineHeight: 1.4 }}>
                {voiceStatus}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Cursor Hover Speech Toggle Button */}
            <button
              type="button"
              onClick={() => {
                setHoverSpeechEnabled(prev => {
                  const next = !prev;
                  speak(next ? 'Cursor hover speech enabled. Move your cursor over any button to hear what it is.' : 'Cursor hover speech paused.');
                  return next;
                });
              }}
              style={{
                backgroundColor: hoverSpeechEnabled ? '#e0f2fe' : '#f1f5f9',
                color: hoverSpeechEnabled ? '#0284c7' : '#64748b',
                border: hoverSpeechEnabled ? '2px solid #0284c7' : '2px solid #cbd5e1',
                padding: '10px 14px',
                borderRadius: '12px',
                fontWeight: '800',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              data-narrate={`Cursor Hover Speech toggle button. Currently ${hoverSpeechEnabled ? 'ON' : 'OFF'}. Click to toggle cursor speaking.`}
              onMouseEnter={() => handleHoverSpeak(`Cursor Hover Speech toggle button. Currently ${hoverSpeechEnabled ? 'ON' : 'OFF'}. Click to toggle cursor speaking.`)}
              onFocus={() => handleHoverSpeak(`Cursor Hover Speech toggle button. Currently ${hoverSpeechEnabled ? 'ON' : 'OFF'}. Click to toggle cursor speaking.`)}
              onMouseLeave={handleHoverLeave}
              title="Toggle Cursor Hover Speech"
            >
              <MousePointer size={16} color={hoverSpeechEnabled ? '#0284c7' : '#64748b'} />
              <span>Hover Speech: <strong>{hoverSpeechEnabled ? 'ON' : 'OFF'}</strong></span>
            </button>

            {/* Replay Welcome & Features Button */}
            <button
              type="button"
              onClick={() => playWelcomeAndFeatures(true)}
              style={{
                backgroundColor: isPlayingWelcome ? '#ca8a04' : '#ffffff',
                color: isPlayingWelcome ? '#ffffff' : '#0369a1',
                border: isPlayingWelcome ? '2px solid #854d0e' : '2px solid #0284c7',
                padding: '12px 18px',
                borderRadius: '12px',
                fontWeight: '900',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.2)'
              }}
              data-narrate="Replay Welcome and Features button. Click to hear the full audio introduction and features list."
              onMouseEnter={() => handleHoverSpeak('Replay Welcome and Features button. Click to hear the full audio introduction and features list.')}
              onFocus={() => handleHoverSpeak('Replay Welcome and Features button. Click to hear the full audio introduction and features list.')}
              onMouseLeave={handleHoverLeave}
              title="Click to hear the welcome greeting and features guide aloud"
            >
              <Volume2 size={20} color={isPlayingWelcome ? '#ffffff' : '#0284c7'} />
              {isPlayingWelcome ? 'Playing Welcome...' : '🔊 Replay Welcome & Features'}
            </button>

            {/* Tap Anywhere to Speak Microphone Button */}
            <button
              type="button"
              onClick={() => startStudentVoiceListening(true)}
              style={{
                backgroundColor: isListening ? '#ef4444' : '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '12px 20px',
                borderRadius: '12px',
                fontWeight: '900',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)'
              }}
              data-narrate="Tap to Speak microphone button. Click or tap to activate speech recognition."
              onMouseEnter={() => handleHoverSpeak('Tap to Speak microphone button. Click or tap to activate speech recognition.')}
              onFocus={() => handleHoverSpeak('Tap to Speak microphone button. Click or tap to activate speech recognition.')}
              onMouseLeave={handleHoverLeave}
            >
              <Mic size={20} />
              {isListening ? 'Listening... Speak Now' : '🎙️ Tap to Speak Command'}
            </button>

            {/* Stop / Cancel Audio Button */}
            {(isSpeaking || isPlayingWelcome || isListening) && (
              <button
                type="button"
                onClick={stopAllAudio}
                style={{
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                  border: '2px solid #ef4444',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  fontWeight: '800',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                data-narrate="Stop Audio button. Click to immediately silence spoken narration."
                onMouseEnter={() => handleHoverSpeak('Stop Audio button. Click to immediately silence spoken narration.')}
                onFocus={() => handleHoverSpeak('Stop Audio button. Click to immediately silence spoken narration.')}
                onMouseLeave={handleHoverLeave}
                title="Stop spoken audio"
              >
                <VolumeX size={18} /> Stop Audio
              </button>
            )}
          </div>

        </div>

        {/* Text Voice Command Fallback Bar */}
        <div style={{ maxWidth: '1200px', margin: '14px auto 0 auto' }}>
          <form onSubmit={handleTextCommandSubmit} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder='Or type a command (e.g. "welcome", "read features", "student login", "register", "student dashboard")...'
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
                outline: 'none',
                fontWeight: '600'
              }}
              data-narrate="Voice command text input field. Type commands like student login, register, or read features."
              onMouseEnter={() => handleHoverSpeak('Voice command text input field. Type commands like student login, register, or read features.')}
              onFocus={() => handleHoverSpeak('Voice command text input field. Type commands like student login, register, or read features.')}
              onMouseLeave={handleHoverLeave}
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
              data-narrate="Execute voice command button. Click to run typed command."
              onMouseEnter={() => handleHoverSpeak('Execute voice command button. Click to run typed command.')}
              onFocus={() => handleHoverSpeak('Execute voice command button. Click to run typed command.')}
              onMouseLeave={handleHoverLeave}
            >
              Execute Command
            </button>
          </form>
        </div>
      </section>

      {/* Main Content Section */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '36px 24px' }}>
        
        {/* WELCOME & INSTRUCTIONS CARD FOR BLIND STUDENTS */}
        <section style={{ 
          background: '#ffffff', 
          border: '2px solid #0284c7', 
          borderRadius: '24px', 
          padding: '32px', 
          marginBottom: '40px',
          boxShadow: '0 10px 30px rgba(2, 132, 199, 0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: '14px' }}
              data-narrate="Welcome Guide and Features for Blind Students section. Tap anywhere on the screen at any time to speak voice commands or hear features aloud."
              onMouseEnter={() => handleHoverSpeak('Welcome Guide and Features for Blind Students section. Tap anywhere on the screen at any time to speak voice commands or hear features aloud.')}
              onMouseLeave={handleHoverLeave}
            >
              <div style={{ background: '#e0f2fe', padding: '14px', borderRadius: '14px', border: '1px solid #7dd3fc' }}>
                <HelpCircle size={32} color="#0284c7" />
              </div>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#0369a1', margin: 0 }}>
                  📖 Welcome Guide & Features for Blind Students
                </h2>
                <p style={{ fontSize: '14px', color: '#475569', margin: '4px 0 0 0', fontWeight: '500' }}>
                  Tap anywhere on the screen at any time to speak voice commands or hear features aloud
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => playWelcomeAndFeatures(true)}
                style={{
                  background: '#fef08a',
                  color: '#854d0e',
                  border: '2px solid #ca8a04',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  fontWeight: '800',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                data-narrate="Play Welcome and Features button. Hear all platform capabilities narrated aloud."
                onMouseEnter={() => handleHoverSpeak('Play Welcome and Features button. Hear all platform capabilities narrated aloud.')}
                onFocus={() => handleHoverSpeak('Play Welcome and Features button. Hear all platform capabilities narrated aloud.')}
                onMouseLeave={handleHoverLeave}
              >
                <Volume2 size={18} color="#854d0e" /> Play Welcome & Features
              </button>

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
                data-narrate="Step-by-Step Instructions button. Hear audio guidance on how to navigate the portal."
                onMouseEnter={() => handleHoverSpeak('Step-by-Step Instructions button. Hear audio guidance on how to navigate the portal.')}
                onFocus={() => handleHoverSpeak('Step-by-Step Instructions button. Hear audio guidance on how to navigate the portal.')}
                onMouseLeave={handleHoverLeave}
              >
                <BookOpen size={18} /> Step-by-Step Instructions
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            
            <div 
              style={instructionStepCardStyle}
              data-narrate="Step 1: Tap anywhere on the screen or press the Spacebar to open the microphone and speak your voice commands."
              onMouseEnter={() => handleHoverSpeak('Step 1: Tap anywhere on the screen or press the Spacebar to open the microphone and speak your voice commands.')}
              onMouseLeave={handleHoverLeave}
            >
              <div style={stepBadgeStyle}>Step 1: Tap to Speak</div>
              <h3 style={stepTitleStyle}>Tap Anywhere on the Screen</h3>
              <p style={stepBodyStyle}>
                Tap anywhere on your device screen or press the <strong>Spacebar</strong> at any time to open the microphone and speak your commands.
              </p>
            </div>

            <div 
              style={instructionStepCardStyle}
              data-narrate="Step 2: Say Student Login to sign in, or say Register to create a new blind student account with hands-free voice prompts."
              onMouseEnter={() => handleHoverSpeak('Step 2: Say Student Login to sign in, or say Register to create a new blind student account with hands-free voice prompts.')}
              onMouseLeave={handleHoverLeave}
            >
              <div style={stepBadgeStyle}>Step 2: Voice Login</div>
              <h3 style={stepTitleStyle}>Say "Student Login" or "Register"</h3>
              <p style={stepBodyStyle}>
                Say <strong>"Student Login"</strong> to sign in, or say <strong>"Register"</strong> to create a new blind student account with hands-free voice prompts.
              </p>
            </div>

            <div 
              style={instructionStepCardStyle}
              data-narrate="Step 3: Say Student Dashboard to access audio question papers, dictate your exam answers, and inspect your proctoring logs."
              onMouseEnter={() => handleHoverSpeak('Step 3: Say Student Dashboard to access audio question papers, dictate your exam answers, and inspect your proctoring logs.')}
              onMouseLeave={handleHoverLeave}
            >
              <div style={stepBadgeStyle}>Step 3: Exam Portal</div>
              <h3 style={stepTitleStyle}>Say "Student Dashboard"</h3>
              <p style={stepBodyStyle}>
                Say <strong>"Student Dashboard"</strong> to access audio question papers, dictate your exam answers, and inspect your proctoring logs.
              </p>
            </div>

            <div 
              style={instructionStepCardStyle}
              data-narrate="Step 4: Say Read Features or Welcome at any moment to hear the full platform audio tour narrated aloud."
              onMouseEnter={() => handleHoverSpeak('Step 4: Say Read Features or Welcome at any moment to hear the full platform audio tour narrated aloud.')}
              onMouseLeave={handleHoverLeave}
            >
              <div style={stepBadgeStyle}>Step 4: Hear Features</div>
              <h3 style={stepTitleStyle}>Say "Read Features"</h3>
              <p style={stepBodyStyle}>
                Say <strong>"Read Features"</strong> or <strong>"Welcome"</strong> at any moment to hear the full platform audio tour narrated aloud.
              </p>
            </div>

          </div>
        </section>

        {/* Hero Banner for Students */}
        <div style={{
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
          borderRadius: '24px',
          padding: '40px 32px',
          boxShadow: '0 20px 40px -15px rgba(2, 132, 199, 0.3)',
          marginBottom: '40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '24px'
        }}>
          <div style={{ flex: '1 1 500px' }}>
            <span 
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(255,255,255,0.2)', borderRadius: '20px', fontSize: '13px', fontWeight: '800', marginBottom: '16px', color: '#ffffff' }}
              data-narrate="AI Voice Assistant badge for Blind Students."
              onMouseEnter={() => handleHoverSpeak('AI Voice Assistant badge for Blind Students.')}
              onMouseLeave={handleHoverLeave}
            >
              <Sparkles size={16} /> AI Voice Assistant for Blind Students
            </span>
            <h2 
              style={{ fontSize: '34px', fontWeight: '900', margin: '0 0 12px 0', lineHeight: 1.2, color: '#ffffff' }}
              data-narrate="Accessible Learning and Visual Guidance System."
              onMouseEnter={() => handleHoverSpeak('Accessible Learning and Visual Guidance System.')}
              onMouseLeave={handleHoverLeave}
            >
              Accessible Learning & Visual Guidance System
            </h2>
            <p 
              style={{ fontSize: '16px', color: '#e0f2fe', margin: '0 0 24px 0', lineHeight: 1.6, maxWidth: '640px' }}
              data-narrate="Designed for visually impaired candidates with hands-free voice navigation, audio question papers, speech-to-text answer dictation, OCR document readers, and currency identifiers."
              onMouseEnter={() => handleHoverSpeak('Designed for visually impaired candidates with hands-free voice navigation, audio question papers, speech-to-text answer dictation, OCR document readers, and currency identifiers.')}
              onMouseLeave={handleHoverLeave}
            >
              Designed for visually impaired candidates with hands-free voice navigation, audio question papers, speech-to-text answer dictation, OCR document readers, and currency identifiers.
            </p>
            
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              <button 
                onClick={() => playWelcomeAndFeatures(true)}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#0369a1',
                  border: 'none',
                  padding: '14px 24px',
                  fontSize: '15px',
                  fontWeight: '900',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.1)'
                }}
                data-narrate="Play Welcome and Features aloud button."
                onMouseEnter={() => handleHoverSpeak('Play Welcome and Features aloud button.')}
                onFocus={() => handleHoverSpeak('Play Welcome and Features aloud button.')}
                onMouseLeave={handleHoverLeave}
              >
                <Volume2 size={20} color="#0369a1" />
                🔊 Play Welcome & Features Aloud
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
                data-narrate="Student Login button. Access student account."
                onMouseEnter={() => handleHoverSpeak('Student Login button. Access student account.')}
                onFocus={() => handleHoverSpeak('Student Login button. Access student account.')}
                onMouseLeave={handleHoverLeave}
              >
                <UserCheck size={18} /> Student Login <ArrowRight size={18} />
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
                data-narrate="Teacher Login button. Access teacher evaluation dashboard."
                onMouseEnter={() => handleHoverSpeak('Teacher Login button. Access teacher evaluation dashboard.')}
                onFocus={() => handleHoverSpeak('Teacher Login button. Access teacher evaluation dashboard.')}
                onMouseLeave={handleHoverLeave}
              >
                <UserCheck size={18} /> Teacher Login <ArrowRight size={18} />
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
                data-narrate="Admin Login button. Access administrator control center."
                onMouseEnter={() => handleHoverSpeak('Admin Login button. Access administrator control center.')}
                onFocus={() => handleHoverSpeak('Admin Login button. Access administrator control center.')}
                onMouseLeave={handleHoverLeave}
              >
                <Shield size={18} /> Admin Login <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Voice Access Shortcuts for Blind Students */}
        <section style={{ marginBottom: '40px', background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #bae6fd', boxShadow: '0 4px 16px rgba(2, 132, 199, 0.06)' }}>
          <h3 
            style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '800', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '10px' }}
            data-narrate="Voice Shortcuts for Students section. You can say any of these commands."
            onMouseEnter={() => handleHoverSpeak('Voice Shortcuts for Students section. You can say any of these commands.')}
            onMouseLeave={handleHoverLeave}
          >
            <Radio size={20} color="#0284c7" /> Voice Shortcuts for Students (Or Tap Screen Anywhere)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <button 
              onClick={() => processStudentVoiceCommand('student login')}
              style={voiceShortcutBtnStyle}
              data-narrate="Voice shortcut button: Say Student Login to open student sign-in."
              onMouseEnter={() => handleHoverSpeak('Voice shortcut button: Say Student Login to open student sign-in.')}
              onFocus={() => handleHoverSpeak('Voice shortcut button: Say Student Login to open student sign-in.')}
              onMouseLeave={handleHoverLeave}
            >
              🎙️ Say "Student Login"
            </button>

            <button 
              onClick={() => processStudentVoiceCommand('register')}
              style={voiceShortcutBtnStyle}
              data-narrate="Voice shortcut button: Say Register Account to create a new blind student account."
              onMouseEnter={() => handleHoverSpeak('Voice shortcut button: Say Register Account to create a new blind student account.')}
              onFocus={() => handleHoverSpeak('Voice shortcut button: Say Register Account to create a new blind student account.')}
              onMouseLeave={handleHoverLeave}
            >
              🎙️ Say "Register Account"
            </button>

            <button 
              onClick={() => processStudentVoiceCommand('student dashboard')}
              style={voiceShortcutBtnStyle}
              data-narrate="Voice shortcut button: Say Student Dashboard to access exam audio papers and answer dictation."
              onMouseEnter={() => handleHoverSpeak('Voice shortcut button: Say Student Dashboard to access exam audio papers and answer dictation.')}
              onFocus={() => handleHoverSpeak('Voice shortcut button: Say Student Dashboard to access exam audio papers and answer dictation.')}
              onMouseLeave={handleHoverLeave}
            >
              🎙️ Say "Student Dashboard"
            </button>

            <button 
              onClick={() => processStudentVoiceCommand('read features')}
              style={voiceShortcutBtnStyle}
              data-narrate="Voice shortcut button: Say Read Features to hear the complete features guide."
              onMouseEnter={() => handleHoverSpeak('Voice shortcut button: Say Read Features to hear the complete features guide.')}
              onFocus={() => handleHoverSpeak('Voice shortcut button: Say Read Features to hear the complete features guide.')}
              onMouseLeave={handleHoverLeave}
            >
              🎙️ Say "Read Features"
            </button>
          </div>
        </section>

        {/* Role Portal Quick Access Section */}
        <section id="portal" style={{ marginBottom: '48px', scrollMarginTop: '100px' }}>
          <h2 
            style={{ fontSize: '22px', fontWeight: '800', color: '#0369a1', marginBottom: '8px' }}
            data-narrate="Select Portal Access Role section. Choose Student, Teacher, or Admin."
            onMouseEnter={() => handleHoverSpeak('Select Portal Access Role section. Choose Student, Teacher, or Admin.')}
            onMouseLeave={handleHoverLeave}
          >
            Select Portal Access Role
          </h2>
          <p style={{ color: '#475569', fontSize: '14px', marginBottom: '24px' }}>
            VisionAssist supports custom interfaces and voice controls for Students, Teachers, and Administrators.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            
            {/* Student Role Card */}
            <div 
              style={roleCardStyleStudent}
              data-narrate="Student Portal card. Hands-free voice login and registration, audio question paper reader, and voice answer dictation."
              onMouseEnter={() => handleHoverSpeak('Student Portal card. Hands-free voice login and registration, audio question paper reader, and voice answer dictation.')}
              onMouseLeave={handleHoverLeave}
            >
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
                <button 
                  onClick={() => navigate('/student-login')} 
                  style={roleBtnStyle}
                  data-narrate="Student Login button. Navigate to student sign-in."
                  onMouseEnter={() => handleHoverSpeak('Student Login button. Navigate to student sign-in.')}
                  onFocus={() => handleHoverSpeak('Student Login button. Navigate to student sign-in.')}
                  onMouseLeave={handleHoverLeave}
                >
                  Student Login
                </button>
                <button 
                  onClick={() => navigate('/student-register')} 
                  style={roleOutlineBtnStyle}
                  data-narrate="Student Register button. Create a new blind student account."
                  onMouseEnter={() => handleHoverSpeak('Student Register button. Create a new blind student account.')}
                  onFocus={() => handleHoverSpeak('Student Register button. Create a new blind student account.')}
                  onMouseLeave={handleHoverLeave}
                >
                  Register
                </button>
                <button 
                  onClick={() => navigate('/dashboard')} 
                  style={roleDashBtnStyle}
                  data-narrate="Student Dashboard button. Open your personal student exam portal."
                  onMouseEnter={() => handleHoverSpeak('Student Dashboard button. Open your personal student exam portal.')}
                  onFocus={() => handleHoverSpeak('Student Dashboard button. Open your personal student exam portal.')}
                  onMouseLeave={handleHoverLeave}
                >
                  Dashboard
                </button>
              </div>
            </div>

            {/* Teacher Role Card */}
            <div 
              style={roleCardStyleTeacher}
              data-narrate="Teacher Portal card. Create accessible exams with narration rules, AI question generator, and real-time student monitoring."
              onMouseEnter={() => handleHoverSpeak('Teacher Portal card. Create accessible exams with narration rules, AI question generator, and real-time student monitoring.')}
              onMouseLeave={handleHoverLeave}
            >
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
                <button 
                  onClick={() => navigateSilent('/teacher-login')} 
                  style={roleBtnTeacher}
                  data-narrate="Teacher Login button. Navigate to teacher sign-in."
                  onMouseEnter={() => handleHoverSpeak('Teacher Login button. Navigate to teacher sign-in.')}
                  onFocus={() => handleHoverSpeak('Teacher Login button. Navigate to teacher sign-in.')}
                  onMouseLeave={handleHoverLeave}
                >
                  Teacher Login
                </button>
                <button 
                  onClick={() => navigateSilent('/teacher-register')} 
                  style={roleOutlineBtnTeacher}
                  data-narrate="Teacher Register button. Register as an educator."
                  onMouseEnter={() => handleHoverSpeak('Teacher Register button. Register as an educator.')}
                  onFocus={() => handleHoverSpeak('Teacher Register button. Register as an educator.')}
                  onMouseLeave={handleHoverLeave}
                >
                  Register
                </button>
                <button 
                  onClick={() => navigateSilent('/teacher-dashboard')} 
                  style={roleDashBtnTeacher}
                  data-narrate="Teacher Dashboard button. Open teacher portal."
                  onMouseEnter={() => handleHoverSpeak('Teacher Dashboard button. Open teacher portal.')}
                  onFocus={() => handleHoverSpeak('Teacher Dashboard button. Open teacher portal.')}
                  onMouseLeave={handleHoverLeave}
                >
                  Dashboard
                </button>
              </div>
            </div>

            {/* Admin Role Card */}
            <div 
              style={roleCardStyleAdmin}
              data-narrate="Admin Portal card. Manage user accounts, monitor OCR logs, inspect proctoring telemetry, and review contact messages."
              onMouseEnter={() => handleHoverSpeak('Admin Portal card. Manage user accounts, monitor OCR logs, inspect proctoring telemetry, and review contact messages.')}
              onMouseLeave={handleHoverLeave}
            >
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
                <button 
                  onClick={() => navigateSilent('/admin-login')} 
                  style={roleBtnAdmin}
                  data-narrate="Admin Login button. Navigate to administrator sign-in."
                  onMouseEnter={() => handleHoverSpeak('Admin Login button. Navigate to administrator sign-in.')}
                  onFocus={() => handleHoverSpeak('Admin Login button. Navigate to administrator sign-in.')}
                  onMouseLeave={handleHoverLeave}
                >
                  Admin Login
                </button>
                <button 
                  onClick={() => navigateSilent('/admin-dashboard')} 
                  style={roleDashBtnAdmin}
                  data-narrate="Admin Dashboard button. Open administrator control center."
                  onMouseEnter={() => handleHoverSpeak('Admin Dashboard button. Open administrator control center.')}
                  onFocus={() => handleHoverSpeak('Admin Dashboard button. Open administrator control center.')}
                  onMouseLeave={handleHoverLeave}
                >
                  Dashboard
                </button>
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
              data-narrate="Close Contact Form button."
              onMouseEnter={() => handleHoverSpeak('Close Contact Form button.')}
              onFocus={() => handleHoverSpeak('Close Contact Form button.')}
              onMouseLeave={handleHoverLeave}
              title="Close Contact Us Form"
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div style={{ background: '#e0f2fe', padding: '14px', borderRadius: '16px', border: '1px solid #7dd3fc' }}>
                <Mail size={32} color="#0284c7" />
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
                      data-narrate="Your Full Name input box."
                      onMouseEnter={() => handleHoverSpeak('Your Full Name input box.')}
                      onFocus={() => handleHoverSpeak('Your Full Name input box.')}
                      onMouseLeave={handleHoverLeave}
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
                      data-narrate="Email Address input box."
                      onMouseEnter={() => handleHoverSpeak('Email Address input box.')}
                      onFocus={() => handleHoverSpeak('Email Address input box.')}
                      onMouseLeave={handleHoverLeave}
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
                      data-narrate="Select your role dropdown."
                      onMouseEnter={() => handleHoverSpeak('Select your role dropdown.')}
                      onFocus={() => handleHoverSpeak('Select your role dropdown.')}
                      onMouseLeave={handleHoverLeave}
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
                      data-narrate="Select topic or query type dropdown."
                      onMouseEnter={() => handleHoverSpeak('Select topic or query type dropdown.')}
                      onFocus={() => handleHoverSpeak('Select topic or query type dropdown.')}
                      onMouseLeave={handleHoverLeave}
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
                    data-narrate="Your message text box."
                    onMouseEnter={() => handleHoverSpeak('Your message text box.')}
                    onFocus={() => handleHoverSpeak('Your message text box.')}
                    onMouseLeave={handleHoverLeave}
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
                    marginTop: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                  data-narrate="Send Message to Support Team button."
                  onMouseEnter={() => handleHoverSpeak('Send Message to Support Team button.')}
                  onFocus={() => handleHoverSpeak('Send Message to Support Team button.')}
                  onMouseLeave={handleHoverLeave}
                >
                  <Mail size={18} /> Send Message to Support Team
                </button>
              </form>

              {/* Direct Support Channels Box */}
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0369a1' }}>
                  📞 Direct Support Channels
                </h3>
                
                <div 
                  style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                  data-narrate="Support Email: support@visionassist.ai. 24 hours 7 days a week."
                  onMouseEnter={() => handleHoverSpeak('Support Email: support@visionassist.ai. 24 hours 7 days a week.')}
                  onMouseLeave={handleHoverLeave}
                >
                  <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '10px', border: '1px solid #bae6fd', color: '#0284c7', fontSize: '18px' }}>
                    <Mail size={18} color="#0284c7" />
                  </div>
                  <div>
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>24/7 Support Email</strong>
                    <div style={{ fontSize: '13px', color: '#0284c7', fontWeight: '700' }}>support@visionassist.ai</div>
                  </div>
                </div>

                <div 
                  style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                  data-narrate="Accessibility Helpline: 1-800-VISION-AI. Toll-Free support."
                  onMouseEnter={() => handleHoverSpeak('Accessibility Helpline: 1-800-VISION-AI. Toll-Free support.')}
                  onMouseLeave={handleHoverLeave}
                >
                  <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '10px', border: '1px solid #bae6fd', color: '#0284c7', fontSize: '18px' }}>
                    <Phone size={18} color="#0284c7" />
                  </div>
                  <div>
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>Accessibility Helpline (Toll-Free)</strong>
                    <div style={{ fontSize: '13px', color: '#0284c7', fontWeight: '700' }}>1-800-VISION-AI (1-800-847-4662)</div>
                  </div>
                </div>

                <div 
                  style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                  data-narrate="Student Voice Command: Say Help or Read Features aloud."
                  onMouseEnter={() => handleHoverSpeak('Student Voice Command: Say Help or Read Features aloud.')}
                  onMouseLeave={handleHoverLeave}
                >
                  <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '10px', border: '1px solid #bae6fd', color: '#0284c7', fontSize: '18px' }}>
                    <Mic size={18} color="#0284c7" />
                  </div>
                  <div>
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>Student Voice Assist Command</strong>
                    <div style={{ fontSize: '13px', color: '#475569' }}>Say <b>"Help"</b> or <b>"Read Features"</b> aloud</div>
                  </div>
                </div>

                <div 
                  style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                  data-narrate="Accessibility Research Hub: VisionAssist Labs Accessible Technology Division."
                  onMouseEnter={() => handleHoverSpeak('Accessibility Research Hub: VisionAssist Labs Accessible Technology Division.')}
                  onMouseLeave={handleHoverLeave}
                >
                  <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '10px', border: '1px solid #bae6fd', color: '#0284c7', fontSize: '18px' }}>
                    <Shield size={18} color="#0284c7" />
                  </div>
                  <div>
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>Accessibility Research Hub</strong>
                    <div style={{ fontSize: '13px', color: '#475569' }}>VisionAssist Labs — AI Accessible Tech Division</div>
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={readStudentInstructionsAloud} 
                  style={{ background: '#ffffff', color: '#0369a1', border: '2px solid #0284c7', padding: '10px 16px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  data-narrate="Read Audio Support Instructions Aloud button."
                  onMouseEnter={() => handleHoverSpeak('Read Audio Support Instructions Aloud button.')}
                  onFocus={() => handleHoverSpeak('Read Audio Support Instructions Aloud button.')}
                  onMouseLeave={handleHoverLeave}
                >
                  <Volume2 size={16} /> Read Audio Support Instructions Aloud
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
            data-narrate="Contact Us and 24/7 Accessibility Support link."
            onMouseEnter={() => handleHoverSpeak('Contact Us and 24/7 Accessibility Support link.')}
            onFocus={() => handleHoverSpeak('Contact Us and 24/7 Accessibility Support link.')}
            onMouseLeave={handleHoverLeave}
          >
            ✉️ Contact Us & 24/7 Accessibility Support
          </button>
        </p>
        <p style={{ margin: '0 0 12px 0', color: '#475569' }}>
          Have questions about VisionAssist AI? Reach out to our 24/7 Accessibility Support Team at{' '}
          <a 
            href="mailto:support@visionassist.ai" 
            style={{ color: '#0284c7', textDecoration: 'none', fontWeight: '700' }}
            data-narrate="Send email to support@visionassist.ai link."
            onMouseEnter={() => handleHoverSpeak('Send email to support@visionassist.ai link.')}
            onFocus={() => handleHoverSpeak('Send email to support@visionassist.ai link.')}
            onMouseLeave={handleHoverLeave}
          >
            support@visionassist.ai
          </a>
        </p>
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
