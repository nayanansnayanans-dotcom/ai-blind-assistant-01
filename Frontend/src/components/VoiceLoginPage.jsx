import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, CheckCircle, Mic, Lock, Mail, Sparkles, Check, X } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { speakIn, cancelSpeech } from './speech';
import ProjectLogo from './ProjectLogo.jsx';
import { loginUser } from '../services/api';


const BASE_SYMBOLS = [
  [/\b(at the rate of|at sign|at)\b/g, '@'],
  [/\b(dot|point|period)\b/g, '.'],
  [/\b(underscore)\b/g, '_'],
  [/\b(dash|hyphen)\b/g, '-'],
];

const DIGIT_MAP = {
  'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
  'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9'
};
const toAsciiDigits = (s) => s.replace(/[०-९]/g, (d) => DIGIT_MAP[d] || d);

const inputStyle = {
  width: '100%',
  padding: '14px 14px 14px 42px',
  borderRadius: '12px',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
  backgroundColor: '#ffffff',
  color: '#0f172a',
  border: '1px solid #bae6fd',
};

export default function VoiceLoginPage() {
  const navigate = useNavigate();

  const [role, setRole] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeField, setActiveField] = useState(null); // 'role', 'email', 'password', 'confirm'
  const [liveTranscript, setLiveTranscript] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  const emailRefInput = useRef(null);
  const passwordRefInput = useRef(null);

  const roleRef = useRef('student');
  const emailRef = useRef('');
  const passwordRef = useRef('');
  const recognitionRef = useRef(null);
  const pendingStepRef = useRef(null);

  const isListeningRef = useRef(false);
  const liveTranscriptRef = useRef('');

  const setIsListeningState = (val) => {
    isListeningRef.current = val;
    setIsListening(val);
  };

  const setLiveTranscriptState = (val) => {
    liveTranscriptRef.current = val;
    setLiveTranscript(val);
  };

  const strings = {
    welcome: 'Welcome to VisionAssist AI. Accessible Voice and Tap Assistant. Please select your role to login.',
    rolePrompt: 'Please speak your role: Student, Teacher, or Admin.',
    emailPrompt: 'Please speak your registered email address.',
    invalidEmail: "You didn't say your email. Please speak your email address.",
    passwordPrompt: 'Please speak your password.',
    emptyEmail: "You didn't say your email. Please speak your email address.",
    emptyPassword: "You didn't say your password. Please speak your password.",
    emptyRole: "You didn't say your role. Please speak Student, Teacher, or Admin.",
    success: (roleName) => `Login completed successfully as ${roleName}. Say Confirm or click below to enter dashboard.`,
  };

  const rolesDisplay = { student: 'Student', teacher: 'Teacher', other: 'Admin' };
  const roleWords = {
    student: ['student', 'learner', 'pupil'],
    teacher: ['teacher', 'faculty', 'professor', 'instructor'],
    other: ['admin', 'administrator', 'system admin', 'guest']
  };

  const stopRecognition = () => {
    isListeningRef.current = false;
    setIsListening(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
  };

  const speak = (text, onEndCallback = null) => {
    stopRecognition();
    speakIn(text, 'en-US', { onEnd: onEndCallback });
  };

  const updateRole = (newRole) => {
    setRole(newRole);
    roleRef.current = newRole;
  };

  const updateField = (field, val) => {
    if (field === 'role') { updateRole(val); }
    if (field === 'email') { setEmail(val); emailRef.current = val; }
    if (field === 'password') { setPassword(val); passwordRef.current = val; }
  };

  useEffect(() => {
    try {
      localStorage.removeItem('auth_session');
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('draft_teacher_exam');
      localStorage.removeItem('draft_teacher_selected_qids');
    } catch (e) {}
    setEmail('');
    setPassword('');
    roleRef.current = 'student';
    emailRef.current = '';
    passwordRef.current = '';
    const clearTimer = setTimeout(() => {
      setEmail('');
      setPassword('');
    }, 150);
    return () => clearTimeout(clearTimer);
  }, []);

  useEffect(() => {
    speak("Welcome to VisionAssist AI Voice Login. Tap anywhere on screen to start guided voice assistant, or type your details below.");
    return () => cancelSpeech();
  }, []);

  const handleTapToStart = async () => {
    if (showSuccessPopup) return;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        console.warn('Microphone permission request:', e);
      }
    }
    speak(strings.welcome, () => startGuidedFlow('role'));
  };

  const startGuidedFlow = (step) => {
    setActiveField(step);

    let promptMsg = strings.rolePrompt;
    if (step === 'email') {
      emailRefInput.current?.focus();
      promptMsg = strings.emailPrompt;
    } else if (step === 'password') {
      passwordRefInput.current?.focus();
      promptMsg = strings.passwordPrompt;
    }

    let micStarted = false;
    const safeListen = () => {
      if (micStarted) return;
      micStarted = true;
      setTimeout(() => listenForInput(step), 400);
    };

    speak(promptMsg, safeListen);
    setTimeout(safeListen, 1800);
  };

  const confirmFieldValue = (fieldKey, displayVal, nextStep) => {
    pendingStepRef.current = { fieldKey, nextStep, displayVal };
    setActiveField('confirm');

    let micStarted = false;
    const safeListenConfirm = () => {
      if (micStarted) return;
      micStarted = true;
      cancelSpeech();
      setTimeout(() => listenForConfirmationYesNo(), 200);
    };

    speak(`You entered ${displayVal}. Is this correct? Say yes or no.`, safeListenConfirm);
  };

  const listenForConfirmationYesNo = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    stopRecognition();
    cancelSpeech();
    setIsListeningState(true);
    setLiveTranscriptState('');

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;

      let hasProcessed = false;
      recognition.onstart = () => setIsListeningState(true);
      
      recognition.onresult = (e) => {
        let text = '';
        for (let i = 0; i < e.results.length; i++) {
          text += e.results[i][0].transcript;
        }
        const lower = text.toLowerCase().trim();
        setLiveTranscriptState(lower);

        const posWords = ['yes', 'yeah', 'yep', 'ok', 'okay', 'confirm', 'correct', 'right', 'proceed', 'sure', 'go ahead', 'accept', 'true', 'fine', 'good'];
        const negWords = ['no', 'nope', 'wrong', 'change', 'retry', 'edit', 'reenter', 're-enter', 'incorrect', 'false', 'cancel'];

        const matchedPos = posWords.some(w => lower.includes(w));
        const matchedNeg = negWords.some(w => lower.includes(w));

        if (!hasProcessed && (matchedPos || matchedNeg || e.results[e.results.length - 1].isFinal)) {
          hasProcessed = true;
          stopRecognition();
          setIsListeningState(false);
          processConfirmationResult(lower);
        }
      };

      recognition.onerror = () => {};

      recognition.onend = () => {
        setIsListeningState(false);
      };

      recognition.start();
    } catch (e) {
      console.warn('Start confirmation recognition error:', e);
    }
  };

  const processConfirmationResult = (lowerRaw) => {
    if (!lowerRaw) return;
    const lower = lowerRaw.toLowerCase().trim();

    // 1. Direct command match for role
    if (roleWords.teacher.some((w) => lower.includes(w))) {
      updateRole('teacher');
      speak(`Selected Teacher role. Now speak your teacher email.`);
      startGuidedFlow('email');
      return;
    }
    if (roleWords.other.some((w) => lower.includes(w))) {
      updateRole('other');
      speak(`Selected Admin role. Now speak your admin email.`);
      startGuidedFlow('email');
      return;
    }
    if (roleWords.student.some((w) => lower.includes(w))) {
      updateRole('student');
      speak(`Selected Student role. Now speak your student email.`);
      startGuidedFlow('email');
      return;
    }

    // 2. Direct command match for email
    if (lower.includes('@') || lower.includes('gmail') || lower.includes('dot com') || lower.includes('at gmail') || lower.includes('.com') || lower.includes('.edu') || lower.includes('.org')) {
      const formattedEmail = formatSpeech(lowerRaw, 'email');
      updateField('email', formattedEmail);
      confirmFieldValue('email', formattedEmail, 'password');
      return;
    }

    // 3. Direct command match for submit
    if (['login', 'submit', 'enter', 'dashboard', 'ok', 'okay'].some(w => lower.includes(w))) {
      validateAndSubmit();
      return;
    }

    // 4. Yes / No handling for confirmation step
    const isYes = ['yes', 'correct', 'yeah', 'yep', 'right', 'sure', 'confirm', 'fine', 'good'].some(w => lower.includes(w));
    const isNo = ['no', 'incorrect', 'wrong', 'change', 'retry', 'cancel'].some(w => lower.includes(w));

    if (isYes) {
      const next = pendingStepRef.current?.nextStep;
      if (next === 'submit') {
        validateAndSubmit();
      } else if (next) {
        startGuidedFlow(next);
      }
    } else if (isNo) {
      const fieldToRetry = pendingStepRef.current?.fieldKey || 'email';
      if (fieldToRetry === 'role') updateRole('student');
      if (fieldToRetry === 'email') updateField('email', '');
      if (fieldToRetry === 'password') updateField('password', '');
      
      speak(`Let's re-enter. Please speak again.`, () => startGuidedFlow(fieldToRetry));
    } else {
      // Smart Fallback: Assign spoken value to pending field directly
      const currentTarget = pendingStepRef.current?.fieldKey;
      if (currentTarget === 'email') {
        const formattedEmail = formatSpeech(lowerRaw, 'email');
        updateField('email', formattedEmail);
        speak(`Email set to ${formattedEmail}. Now speak your password.`);
        startGuidedFlow('password');
      } else if (currentTarget === 'password') {
        const formattedPwd = formatSpeech(lowerRaw, 'password');
        updateField('password', formattedPwd);
        speak(`Password recorded.`);
        validateAndSubmit();
      } else {
        speak(`Recognized: "${lowerRaw}". Please say Yes or No, or speak your email.`);
      }
    }
  };

  const formatSpeech = (transcript, targetField) => {
    let clean = toAsciiDigits(transcript.trim());

    if (targetField === 'email') {
      clean = clean.toLowerCase();
      BASE_SYMBOLS.forEach(([re, rep]) => {
        clean = clean.replace(re, rep);
      });
      clean = clean.replace(/\s+/g, '');
    } else if (targetField === 'password') {
      clean = clean.replace(/\s+/g, '');
    }
    return clean;
  };

  const listenForInput = (targetField) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    stopRecognition();
    setIsListeningState(true);
    setLiveTranscriptState('');

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = true;

      let hasProcessed = false;
      recognition.onstart = () => setIsListeningState(true);

      recognition.onresult = (e) => {
        let text = '';
        for (let i = 0; i < e.results.length; i++) {
          text += e.results[i][0].transcript;
        }
        const rawTranscript = text;
        setLiveTranscriptState(rawTranscript.trim());

        if (e.results[e.results.length - 1].isFinal && rawTranscript.trim()) {
          hasProcessed = true;
          setIsListeningState(false);
          processInputResult(rawTranscript, targetField);
        }
      };

      recognition.onerror = () => {};

      recognition.onend = () => {
        if (!hasProcessed) {
          if (liveTranscriptRef.current) {
            hasProcessed = true;
            setIsListeningState(false);
            processInputResult(liveTranscriptRef.current, targetField);
          } else if (isListeningRef.current) {
            // KeepAlive Auto-Restart loop: Keep mic active continuously!
            setTimeout(() => {
              if (isListeningRef.current && !hasProcessed) {
                try { recognition.start(); } catch (err) {}
              }
            }, 300);
          }
        }
      };

      recognition.start();
    } catch (e) {
      console.warn('Start input recognition error:', e);
    }
  };

  const processInputResult = (rawTranscript, targetField) => {
    if (!rawTranscript) return;
    const lower = rawTranscript.toLowerCase().trim();

    // Check for email spoken at any step
    if (lower.includes('@') || lower.includes('gmail') || lower.includes('dot com') || lower.includes('at gmail') || lower.includes('.com') || lower.includes('.edu')) {
      const formattedEmail = formatSpeech(rawTranscript, 'email');
      updateField('email', formattedEmail);
      confirmFieldValue('email', formattedEmail, 'password');
      return;
    }

    // Check for submit command
    if (['submit', 'login', 'enter', 'open dashboard'].some(w => lower.includes(w))) {
      validateAndSubmit();
      return;
    }

    if (targetField === 'role') {
      let chosenRole = 'student';
      if (roleWords.teacher.some((w) => lower.includes(w))) chosenRole = 'teacher';
      else if (roleWords.other.some((w) => lower.includes(w))) chosenRole = 'other';

      updateRole(chosenRole);
      confirmFieldValue('role', rolesDisplay[chosenRole], 'email');
    } else if (targetField === 'email') {
      const formattedEmail = formatSpeech(rawTranscript, 'email');
      updateField('email', formattedEmail);
      confirmFieldValue('email', formattedEmail, 'password');
    } else if (targetField === 'password') {
      const formattedPwd = formatSpeech(rawTranscript, 'password');
      updateField('password', formattedPwd);
      setActiveField(null);
      confirmFieldValue('password', 'your password', 'submit');
    } else {
      if (!email) {
        const formattedEmail = formatSpeech(rawTranscript, 'email');
        updateField('email', formattedEmail);
        speak(`Email set as ${formattedEmail}.`);
      } else {
        const formattedPwd = formatSpeech(rawTranscript, 'password');
        updateField('password', formattedPwd);
        speak(`Password recorded.`);
      }
    }
  };

  const listenForOkConfirmation = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    stopRecognition();
    setIsListeningState(true);
    setLiveTranscriptState('');

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = true;

      let hasProcessed = false;
      recognition.onstart = () => setIsListeningState(true);
      
      recognition.onresult = (e) => {
        let text = '';
        for (let i = 0; i < e.results.length; i++) {
          text += e.results[i][0].transcript;
        }
        const transcript = text.toLowerCase().trim();
        setLiveTranscriptState(transcript);

        if (e.results[e.results.length - 1].isFinal) {
          hasProcessed = true;
          const accepted = ['ok', 'okay', 'confirm', 'yes', 'enter'];
          if (accepted.some((w) => transcript.includes(w))) handleModalClose();
          else listenForOkConfirmation();
        }
      };

      recognition.onerror = () => {};
      recognition.onend = () => {
        if (!hasProcessed && isListeningRef.current) {
          setTimeout(() => {
            if (isListeningRef.current && !hasProcessed) {
              try { recognition.start(); } catch (e) {}
            }
          }, 300);
        }
      };

      recognition.start();
    } catch (e) {
      console.warn('Start ok confirmation error:', e);
    }
  };

  const validateAndSubmit = async () => {
    const emailVal = emailRef.current || email;
    const pwdVal = passwordRef.current || password;

    if (!emailVal || !/\S+@\S+\.\S+/.test(emailVal)) {
      speak(strings.invalidEmail, () => startGuidedFlow('email'));
      return;
    }
    if (!pwdVal) {
      speak(strings.emptyPassword, () => startGuidedFlow('password'));
      return;
    }

    try {
      const res = await loginUser({ email: emailVal, password: pwdVal, role: roleRef.current });
      if (res && res.success && res.user) {
        const session = {
          role: res.user.role || roleRef.current,
          email: res.user.email || emailVal,
          name: res.user.username || emailVal.split('@')[0],
          studentId: res.user.studentId || res.user.registerNumber || '2026011001',
          registerNumber: res.user.registerNumber || res.user.studentId || '2026011001',
          isAuthenticated: true,
          token: res.user.token
        };
        localStorage.setItem('auth_session', JSON.stringify(session));
        setShowSuccessPopup(true);
        speak(strings.success(rolesDisplay[roleRef.current]), () => listenForOkConfirmation());
      } else {
        const errMsg = res?.message || `Login failed. Please check your credentials or role.`;
        setErrorMessage(errMsg);
        speak(errMsg);
      }
    } catch (e) {
      setErrorMessage("Login failed. Server error.");
      speak("Login failed. Server error.");
    }
  };

  const handleModalClose = () => {
    setShowSuccessPopup(false);
    cancelSpeech();
    stopRecognition();

    const session = {
      role: roleRef.current,
      email: emailRef.current || email,
      isAuthenticated: true,
      name: (emailRef.current || email).split('@')[0] || 'User'
    };
    localStorage.setItem('auth_session', JSON.stringify(session));

    // Route based on selected user role
    if (roleRef.current === 'teacher') {
      navigate('/teacher-dashboard');
    } else if (roleRef.current === 'other') {
      navigate('/admin-dashboard');
    } else {
      navigate('/student-dashboard');
    }
  };

  return (
    <div
      onClick={handleTapToStart}
      style={{
        minHeight: '100vh', background: '#f0f9ff', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center', padding: '24px', cursor: 'pointer', boxSizing: 'border-box',
        fontFamily: "'Inter', system-ui, sans-serif"
      }}
    >
      {/* VOICE LISTENING OVERLAY WITH REALTIME TRANSCRIPT & FULL ACTION SHORTCUT BUTTONS */}
      {isListening && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(2, 132, 199, 0.65)', zIndex: 99999,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          backdropFilter: 'blur(8px)', padding: '20px'
        }}>
          <div style={{
            background: '#ffffff', width: '90%', maxWidth: '620px', padding: '36px 40px', borderRadius: '28px',
            border: '4px solid #0284c7', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            boxSizing: 'border-box'
          }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#e0f2fe', display: 'grid', placeItems: 'center', margin: '0 auto 16px auto', border: '4px solid #0284c7', boxShadow: '0 0 20px rgba(2, 132, 199, 0.4)' }}>
              <Mic size={44} color="#0284c7" style={{ animation: 'pulse 1.2s infinite' }} />
            </div>

            <h2 style={{ fontSize: '24px', color: '#0369a1', margin: '0 0 8px 0', fontWeight: '900' }}>
              🎙️ Voice Assistant Active & Listening!
            </h2>
            
            {/* Live Real-time Speech Transcript Display */}
            <div style={{ background: '#f0f9ff', border: '2px dashed #0284c7', padding: '16px', borderRadius: '16px', margin: '16px 0', minHeight: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ margin: 0, fontSize: '16px', color: liveTranscript ? '#0f172a' : '#0284c7', fontWeight: '800', fontStyle: liveTranscript ? 'normal' : 'italic' }}>
                {liveTranscript ? `"${liveTranscript}"` : '🎙️ Speak your answer clearly into the microphone...'}
              </p>
            </div>

            {/* Complete Action Shortcuts available at all times */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '18px' }}>
              <button onClick={() => { updateRole('student'); confirmFieldValue('role', 'Student', 'email'); }} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}>🎓 Student</button>
              <button onClick={() => { updateRole('teacher'); confirmFieldValue('role', 'Teacher', 'email'); }} style={{ background: '#9333ea', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}>👨‍🏫 Teacher</button>
              <button onClick={() => { updateRole('other'); confirmFieldValue('role', 'Admin', 'email'); }} style={{ background: '#d97706', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}>🛡️ Admin</button>
              <button onClick={() => { updateField('email', 'priya@gmail.com'); confirmFieldValue('email', 'priya@gmail.com', 'password'); }} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}>📧 Fill Demo Email (priya@gmail.com)</button>
              <button onClick={() => { updateField('password', 'priya123'); confirmFieldValue('password', 'your password', 'submit'); }} style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}>🔑 Fill Demo Password (priya123)</button>
              <button onClick={() => { setIsListeningState(false); validateAndSubmit(); }} style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}>⚡ Submit Login</button>
            </div>

            {/* Manual Typed Input Fallback */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (manualInput.trim()) {
                  setIsListeningState(false);
                  if (activeField === 'confirm') {
                    processConfirmationResult(manualInput.trim());
                  } else {
                    processInputResult(manualInput.trim(), activeField || 'role');
                  }
                  setManualInput('');
                }
              }}
              style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}
            >
              <input 
                type="text"
                placeholder="Or type answer here..."
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: '600' }}
              />
              <button 
                type="submit"
                style={{ background: '#0f172a', color: '#ffffff', border: 'none', padding: '12px 18px', borderRadius: '12px', fontWeight: '800', fontSize: '14px', cursor: 'pointer' }}
              >
                ⚡ Run
              </button>
            </form>

            <button 
              onClick={() => { stopRecognition(); cancelSpeech(); }}
              style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 24px', borderRadius: '12px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
            >
              ✖ Close Voice Assistant Overlay
            </button>
          </div>
        </div>
      )}

      {/* LOGIN CARD */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '460px', background: '#ffffff', border: '2px solid #0284c7',
          padding: '40px 36px', borderRadius: '24px', boxShadow: '0 20px 40px -15px rgba(2, 132, 199, 0.2)', boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
          <ProjectLogo size="large" />
          <h1 style={{ fontSize: '22px', color: '#0369a1', margin: '8px 0 2px 0', fontWeight: '900' }}>
            VisionAssist AI Guided Voice Login
          </h1>
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0, fontWeight: '600' }}>
            Accessible Step-by-Step Voice Dictation & Typed Login
          </p>
        </div>

        {/* Voice Assistant Banner */}
        <div 
          onClick={handleTapToStart}
          style={{
            padding: '12px 16px', borderRadius: '14px', background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
            border: '2px solid #0284c7', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.15)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#0284c7', padding: '8px', borderRadius: '50%', color: '#ffffff' }}>
              <Mic size={18} />
            </div>
            <div>
              <b style={{ fontSize: '13px', color: '#0369a1', display: 'block' }}>Tap Screen to Start Guided Voice Assistant</b>
              <small style={{ fontSize: '11px', color: '#0284c7' }}>Speaks prompts and confirms your voice responses</small>
            </div>
          </div>
          <Sparkles size={18} color="#0284c7" />
        </div>

        {/* Form Fields & Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', color: '#0369a1', fontWeight: '800' }}>Login Role</label>
              <button type="button" onClick={() => startGuidedFlow('role')} style={{ background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Mic size={12} /> Speak Role
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[{ id: 'student', label: 'Student', icon: '🎓' }, { id: 'teacher', label: 'Teacher', icon: '👨‍🏫' }, { id: 'other', label: 'Admin', icon: '🛡️' }].map((r) => (
                <button
                  key={r.id} type="button" onClick={() => updateRole(r.id)}
                  style={{
                    flex: 1, padding: '10px 4px', borderRadius: '10px',
                    border: role === r.id ? '2px solid #0284c7' : '1px solid #bae6fd',
                    backgroundColor: role === r.id ? '#0284c7' : '#f0f9ff',
                    color: role === r.id ? '#ffffff' : '#0369a1', fontWeight: '700', fontSize: '12px', cursor: 'pointer'
                  }}
                >
                  {r.icon} {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', color: '#0369a1', fontWeight: '800' }}>Email Address</label>
              <button type="button" onClick={() => startGuidedFlow('email')} style={{ background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Mic size={12} /> Speak Email
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <Mail size={18} color={activeField === 'email' ? '#0284c7' : '#0284c7'} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                ref={emailRefInput}
                type="email"
                name="voice_login_email"
                autoComplete="off"
                placeholder="e.g. student@gmail.com"
                value={email}
                onChange={(e) => updateField('email', e.target.value)}
                style={{ ...inputStyle, border: activeField === 'email' ? '2px solid #0284c7' : '1px solid #bae6fd' }}
                required
              />
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', color: '#0369a1', fontWeight: '800' }}>Password {role === 'student' ? '(alphabets & numbers only)' : ''}</label>
              <button type="button" onClick={() => startGuidedFlow('password')} style={{ background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Mic size={12} /> Speak Password
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color={activeField === 'password' ? '#0284c7' : '#0284c7'} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                ref={passwordRefInput}
                type={showPassword ? 'text' : 'password'}
                name="voice_login_password"
                autoComplete="new-password"
                placeholder={role === 'student' ? "Enter Password (alphabets & numbers only)" : "••••••••"}
                value={password}
                onChange={(e) => {
                  const val = role === 'student' ? e.target.value.replace(/[^a-zA-Z0-9]/g, '') : e.target.value;
                  updateField('password', val);
                }}
                style={{ ...inputStyle, paddingRight: '44px', border: activeField === 'password' ? '2px solid #0284c7' : '1px solid #bae6fd' }}
                required
              />
              <button
                type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {role === 'student' && (
              <small style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>Student passwords contain only letters (a-z, A-Z) and numbers (0-9).</small>
            )}
          </div>

          <div style={{ textAlign: 'right', marginTop: '-4px' }}>
            <Link to="/forgot-password" state={{ role }} style={{ fontSize: '13px', color: '#0284c7', textDecoration: 'none', fontWeight: '600' }}>
              Forgot Password?
            </Link>
          </div>

          <button
            type="button" onClick={validateAndSubmit}
            style={{ width: '100%', padding: '14px', borderRadius: '12px', backgroundColor: '#0284c7', color: '#ffffff', fontWeight: '800', fontSize: '15px', border: 'none', cursor: 'pointer', marginTop: '4px', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)' }}
          >
            Login to Dashboard
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <Link to="/register" style={{ fontSize: '13px', color: '#0284c7', textDecoration: 'none', fontWeight: '700' }}>Don't have an account? Register here</Link>
            <Link to="/home" style={{ fontSize: '13px', color: '#475569', textDecoration: 'none', fontWeight: '600' }}>Go to Home Page →</Link>
          </div>
        </div>
      </div>

      {showSuccessPopup && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2, 132, 199, 0.25)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#ffffff', border: '2px solid #0284c7', padding: '32px', borderRadius: '24px', textAlign: 'center', maxWidth: '380px', width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
            <CheckCircle size={48} color="#22c55e" style={{ marginBottom: '16px' }} />
            <h2 style={{ fontSize: '20px', color: '#0f172a', marginBottom: '8px', fontWeight: '800' }}>Login Successful!</h2>
            <p style={{ fontSize: '14px', color: '#475569', marginBottom: '20px' }}>Say "Confirm" or click below to enter dashboard.</p>
            <button type="button" onClick={handleModalClose} style={{ width: '100%', padding: '12px', borderRadius: '12px', backgroundColor: '#0284c7', color: '#fff', border: 'none', fontWeight: '800', cursor: 'pointer' }}>
              Enter Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}