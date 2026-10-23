import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle, Mic, Lock, Mail, UserCheck, Shield, GraduationCap, ArrowRight, Sparkles } from 'lucide-react';
import { speakIn, cancelSpeech, formatSpokenName, isTTSActive, formatSpokenEmail } from './speech';
import ProjectLogo from './ProjectLogo.jsx';
import { loginUser, studentSendLoginOtpApi, studentLoginOtpApi } from '../services/api';

export default function RoleSelectionLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const initialRole = location.state?.role || 'student';
  const [selectedRole, setSelectedRole] = useState(initialRole); // 'student', 'teacher', 'admin'
  const [loginMethod, setLoginMethod] = useState('password'); // 'password' or 'otp' (student only)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [adminSecretKey, setAdminSecretKey] = useState('');
  const [showAdminSecretKey, setShowAdminSecretKey] = useState(false);
  const [loginOtpInput, setLoginOtpInput] = useState('');
  const [loginOtpSent, setLoginOtpSent] = useState(false);
  const [isSendingLoginOtp, setIsSendingLoginOtp] = useState(false);
  const [isVerifyingLoginOtp, setIsVerifyingLoginOtp] = useState(false);
  const [otpSuccessMessage, setOtpSuccessMessage] = useState('');

  const [isListening, setIsListening] = useState(false);
  const [activeVoiceField, setActiveVoiceField] = useState('role');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [manualCommandInput, setManualCommandInput] = useState('');
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const emailRefInput = useRef(null);
  const passwordRefInput = useRef(null);
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const isManuallyClosedRef = useRef(false);

  const pendingRoleRef = useRef('Student');
  const pendingEmailRef = useRef('');
  const pendingPasswordRef = useRef('');
  const pendingMethodRef = useRef('password');
  const loginMethodRef = useRef('password');
  const hasProcessedRef = useRef(false);

  const parseSpokenOtp = (text) => {
    if (!text) return '';
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
    const tokens = text.toLowerCase().split(/[\s-]+/);
    let result = '';
    for (const token of tokens) {
      if (wordMap[token] !== undefined) {
        result += wordMap[token];
      } else {
        const nums = token.replace(/\D/g, '');
        result += nums;
      }
    }
    return result;
  };

  const changeLoginMethod = (method) => {
    const clean = (method === 'otp' || method === 'email_otp') ? 'otp' : 'password';
    setLoginMethod(clean);
    loginMethodRef.current = clean;
    pendingMethodRef.current = clean;
  };

  const stopRecognition = () => {
    setIsListening(false);
    window.isVoiceAssistantActive = false;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
  };

  const handleCloseVoiceOverlay = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    isManuallyClosedRef.current = true;
    stopRecognition();
    cancelSpeech();
    setIsListening(false);
    window.isVoiceAssistantActive = false;
  };

  const speak = (text, onEndCallback = null) => {
    stopRecognition();
    cancelSpeech();
    speakIn(text, 'en-US', { 
      rate: 1.15, 
      onEnd: () => {
        if (!isManuallyClosedRef.current && onEndCallback) {
          onEndCallback();
        }
      }
    });
  };

  useEffect(() => {
    window.isVoiceAssistantActive = isListening;
    return () => { window.isVoiceAssistantActive = false; };
  }, [isListening]);

  useEffect(() => {
    const passedEmail = location.state?.email || '';
    if (passedEmail) {
      setEmail(passedEmail);
    } else {
      try {
        localStorage.removeItem('auth_session');
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('role');
      } catch (e) {}
      setEmail('');
    }
    setPassword('');
    setAdminSecretKey('');
    setLoginOtpInput('');
    setLoginOtpSent(false);
    setErrorMessage('');
    setOtpSuccessMessage('');
    setShowSuccessPopup(false);
    const clearTimer = setTimeout(() => {
      if (passedEmail) {
        setEmail(passedEmail);
      } else {
        setEmail('');
      }
      setPassword('');
      setAdminSecretKey('');
    }, 150);
    return () => clearTimeout(clearTimer);
  }, [location.state]);

  useEffect(() => {
    if (initialRole === 'teacher') {
      cancelSpeech();
      stopRecognition();
      navigate('/teacher-login', { replace: true });
      return;
    }
    if (initialRole === 'admin') {
      cancelSpeech();
      stopRecognition();
      navigate('/admin-login', { replace: true });
      return;
    }
    speak("Student Login Portal. Tap anywhere on the screen or press Spacebar to activate voice assistant.");

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space' || (e.altKey && e.code === 'KeyS')) {
        e.preventDefault();
        isManuallyClosedRef.current = false;
        triggerVoiceLogin('role');
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.isVoiceAssistantActive = false;
      cancelSpeech();
      stopRecognition();
    };
  }, [initialRole, navigate]);

  useEffect(() => {
    loginMethodRef.current = loginMethod;
    pendingMethodRef.current = loginMethod;
  }, [loginMethod]);

  const triggerVoiceLogin = async (targetField = 'role', skipPrompt = false) => {
    isManuallyClosedRef.current = false;
    stopRecognition();
    cancelSpeech();
    hasProcessedRef.current = false;
    setIsListening(true);
    setActiveVoiceField(targetField);
    setLiveTranscript('');

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        console.warn('Microphone permission request:', e);
      }
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      speak("Speech recognition is not supported in this browser. Please type your credentials.");
      setIsListening(false);
      return;
    }

    const activeMethod = loginMethodRef.current || pendingMethodRef.current || loginMethod;
    let promptMsg = "";
    if (targetField === 'role' || targetField === 'all') {
      promptMsg = "Step 1: Role Selection. Please speak your role: Student, Teacher, or Admin.";
    } else if (targetField === 'confirm_role') {
      promptMsg = `You selected ${pendingRoleRef.current} role. Is this correct? Say CONFIRM or NO.`;
    } else if (targetField === 'login_method') {
      promptMsg = "Would you like to login via Password or login via OTP? Please say PASSWORD or say OTP.";
    } else if (targetField === 'email') {
      promptMsg = (selectedRole === 'student' && activeMethod === 'otp')
        ? "Step 2: Please speak your student Gmail address to receive an OTP and log in."
        : `Step 2: Please speak your ${selectedRole} email address now.`;
    } else if (targetField === 'confirm_email') {
      promptMsg = (selectedRole === 'student' && activeMethod === 'otp')
        ? `You entered email address ${pendingEmailRef.current || email}. Say CONFIRM to receive login OTP and verify OTP, or say NO to re-enter.`
        : `You entered email address ${pendingEmailRef.current || email}. Is this correct? Say CONFIRM or NO.`;
    } else if (targetField === 'otp') {
      promptMsg = "Step 3: Verify OTP. A 6-digit login OTP code has been sent to your email. Please speak your 6-digit OTP code to verify OTP and log in.";
    } else if (targetField === 'password') {
      promptMsg = `Step 3: Please enter your password or say FORGOT PASSWORD if you have forgotten your password.`;
    } else if (targetField === 'confirm_password') {
      promptMsg = `You entered password ${pendingPasswordRef.current || password}. Say CONFIRM to login, say NO to re-enter, or say FORGOT PASSWORD to reset your password.`;
    }

    let micStarted = false;
    const startMic = () => {
      if (micStarted) return;
      micStarted = true;

      try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (e) => {
          if (isTTSActive()) return;
          if (hasProcessedRef.current) return;

          let text = '';
          for (let i = 0; i < e.results.length; i++) {
            text += e.results[i][0].transcript;
          }
          const rawText = text.trim();
          setLiveTranscript(rawText);

          const lower = rawText.toLowerCase();
          const posWords = ['yes', 'yeah', 'yep', 'ok', 'okay', 'confirm', 'correct', 'right', 'proceed', 'sure', 'good'];
          const negWords = ['no', 'nope', 'wrong', 'change', 'retry', 'edit', 'incorrect'];

          if (lower.includes('forgot') || lower.includes('forget') || lower.includes('reset')) {
            hasProcessedRef.current = true;
            stopRecognition();
            processVoiceResult(rawText, targetField);
            return;
          }

          if (targetField === 'login_method' && (lower.includes('password') || lower.includes('otp') || lower.includes('pass') || lower.includes('code'))) {
            hasProcessedRef.current = true;
            stopRecognition();
            processVoiceResult(rawText, targetField);
            return;
          }

          if (targetField.startsWith('confirm_') && 
              (posWords.some(w => lower.includes(w)) || negWords.some(w => lower.includes(w)))) {
            hasProcessedRef.current = true;
            stopRecognition();
            processVoiceResult(rawText, targetField);
            return;
          }

          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (hasProcessedRef.current) return;
            hasProcessedRef.current = true;
            stopRecognition();
            processVoiceResult(rawText, targetField);
          }, 2000);
        };

        recognition.onerror = (e) => {
          console.warn('SpeechRecognition error:', e);
          if (e.error !== 'no-speech') {
            stopRecognition();
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.start();
      } catch (err) {
        console.warn("Recognition start failed:", err);
        setIsListening(false);
      }
    };

    if (skipPrompt) {
      setTimeout(startMic, 150);
      return;
    }

    speak(promptMsg, () => {
      if (!isManuallyClosedRef.current) {
        setTimeout(startMic, 200);
      }
    });

    const fallbackDelay = Math.max(5000, promptMsg.length * 80);
    setTimeout(() => {
      if (!isManuallyClosedRef.current && !micStarted) startMic();
    }, fallbackDelay);
  };

  const processVoiceResult = (rawText, fieldKey) => {
    if (!rawText) return;
    const cleanText = rawText.toLowerCase().trim();

    const forgotKeywords = [
      'forgot password', 'forget password', 'forgot my password', 'forget my password',
      'reset password', 'reset my password', 'lost password', 'recover password',
      'i forgot', 'i forgot password', 'forgot', 'forget'
    ];

    if (forgotKeywords.some(w => cleanText.includes(w))) {
      speak("Opening Password Recovery page now.", () => {
        setTimeout(() => navigate('/forgot-password', { state: { role: selectedRole, email } }), 400);
      });
      return;
    }

    const posWords = ['yes', 'yeah', 'yep', 'ok', 'okay', 'confirm', 'correct', 'right', 'sure', 'good'];
    const negWords = ['no', 'nope', 'wrong', 'change', 'retry', 'edit', 'incorrect'];

    // --- STEP 1: ROLE CAPTURE ---
    if (fieldKey === 'role' || fieldKey === 'all') {
      if (cleanText.includes('teacher') || cleanText.includes('faculty')) {
        cancelSpeech();
        stopRecognition();
        setIsListening(false);
        navigate('/teacher-login');
        return;
      }
      if (cleanText.includes('admin') || cleanText.includes('administrator')) {
        cancelSpeech();
        stopRecognition();
        setIsListening(false);
        navigate('/admin-login');
        return;
      }

      setSelectedRole('student');
      pendingRoleRef.current = 'Student';

      speak(`Student role confirmed! Would you like to login via Password or login via OTP? Say PASSWORD or OTP.`, () => {
        setTimeout(() => triggerVoiceLogin('login_method'), 150);
      });
      return;
    }

    // --- STEP 1 CONFIRMATION ---
    if (fieldKey === 'confirm_role') {
      if (posWords.some(w => cleanText.includes(w))) {
        if (pendingRoleRef.current === 'Student') {
          speak(`Student confirmed! Would you like to login via Password or login via OTP? Say PASSWORD or OTP.`, () => {
            setTimeout(() => triggerVoiceLogin('login_method'), 150);
          });
        } else {
          speak(`${pendingRoleRef.current} confirmed! Step 2: Speak your email address.`, () => {
            setTimeout(() => triggerVoiceLogin('email'), 150);
          });
        }
      } else {
        speak(`Let's re-select role. Speak Student, Teacher, or Admin.`, () => {
          setTimeout(() => triggerVoiceLogin('role'), 150);
        });
      }
      return;
    }

    // --- STEP: LOGIN METHOD SELECTION (STUDENT PASSWORD VS OTP) ---
    if (fieldKey === 'login_method' || fieldKey === 'method') {
      const lower = cleanText.toLowerCase();
      if (lower.includes('otp') || lower.includes('email otp') || lower.includes('code') || lower.includes('mail')) {
        changeLoginMethod('otp');
        speak("Email OTP login selected. Step 2: Please speak your student Gmail address.", () => {
          setTimeout(() => triggerVoiceLogin('email'), 300);
        });
        return;
      }
      if (lower.includes('password') || lower.includes('pass') || lower.includes('pwd')) {
        changeLoginMethod('password');
        speak("Password login selected. Step 2: Please speak your student Gmail address.", () => {
          setTimeout(() => triggerVoiceLogin('email'), 300);
        });
        return;
      }

      speak("Would you like to login via Password or login via OTP? Please say PASSWORD or say OTP.", () => {
        setTimeout(() => triggerVoiceLogin('login_method'), 300);
      });
      return;
    }

    // --- STEP 2: EMAIL CAPTURE ---
    if (fieldKey === 'email') {
      const formattedEmail = formatSpokenEmail(rawText);
      setEmail(formattedEmail);
      pendingEmailRef.current = formattedEmail;
      speak(`Entered email ${formattedEmail}. Confirm? Say YES or NO.`, () => {
        setTimeout(() => triggerVoiceLogin('confirm_email'), 150);
      });
      return;
    }

    // --- STEP 2 CONFIRMATION ---
    if (fieldKey === 'confirm_email') {
      if (posWords.some(w => cleanText.includes(w))) {
        const isOtp = (loginMethodRef.current === 'otp' || pendingMethodRef.current === 'otp' || loginMethod === 'otp');
        if (selectedRole === 'student' && isOtp) {
          const targetEmail = pendingEmailRef.current || email;
          speak(`Email confirmed. Sending 6-digit login OTP code to ${formatSpokenEmail(targetEmail)}. Step 3: Verify OTP. Please wait.`, () => {
            handleGetStudentLoginOtp(targetEmail, true);
          });
          return;
        }
        speak(`Email confirmed. Step 3: Speak your password.`, () => {
          setTimeout(() => triggerVoiceLogin('password'), 150);
        });
        return;
      } else if (negWords.some(w => cleanText.includes(w))) {
        setEmail('');
        pendingEmailRef.current = '';
        speak(`Re-enter email. Speak your email address now.`, () => {
          setTimeout(() => triggerVoiceLogin('email'), 150);
        });
      } else {
        const newEmail = formatSpokenEmail(rawText);
        setEmail(newEmail);
        pendingEmailRef.current = newEmail;
        speak(`Entered email ${newEmail}. Confirm? Say YES or NO.`, () => {
          setTimeout(() => triggerVoiceLogin('confirm_email'), 150);
        });
      }
      return;
    }

    // --- STEP: STUDENT OTP CAPTURE ---
    if (fieldKey === 'otp') {
      const digits = parseSpokenOtp(rawText);
      if (digits.length >= 4) {
        setLoginOtpInput(digits);
        setIsVerifyingLoginOtp(true);
        speak(`Verifying OTP ${digits.split('').join(' ')}. Please wait.`);
        const targetEmail = (pendingEmailRef.current || email).toLowerCase().trim();
        studentLoginOtpApi(targetEmail, digits).then(res => {
          setIsVerifyingLoginOtp(false);
          if (res && res.success) {
            const cleanName = formatSpokenName(res.user?.username || res.user?.name || targetEmail);
            localStorage.setItem('auth_session', JSON.stringify({
              email: res.user?.email || targetEmail,
              role: 'student',
              name: cleanName
            }));
            speak("Student OTP verified successfully! Opening dashboard.", () => {
              navigate('/student-dashboard');
            });
            setTimeout(() => navigate('/student-dashboard'), 1000);
          } else {
            const msg = res?.message || "Invalid OTP code.";
            setErrorMessage(msg);
            speak(`${msg} Step 3: Verify OTP. Please speak your 6-digit OTP code again.`, () => {
              setTimeout(() => triggerVoiceLogin('otp'), 400);
            });
          }
        }).catch(() => {
          setIsVerifyingLoginOtp(false);
          speak("Verification error. Step 3: Verify OTP. Please speak your 6-digit OTP code again.", () => {
            setTimeout(() => triggerVoiceLogin('otp'), 400);
          });
        });
      } else {
        speak("Step 3: Verify OTP. Please speak your 6-digit login OTP code sent to your email.", () => {
          setTimeout(() => triggerVoiceLogin('otp'), 400);
        });
      }
      return;
    }

    // --- STEP 3: PASSWORD CAPTURE ---
    if (fieldKey === 'password') {
      const cleanPass = rawText.replace(/\s+/g, '');
      setPassword(cleanPass);
      pendingPasswordRef.current = cleanPass;
      speak(`Entered password ${cleanPass}. Confirm? Say YES or NO.`, () => {
        setTimeout(() => triggerVoiceLogin('confirm_password'), 150);
      });
      return;
    }

    // --- STEP 3 CONFIRMATION ---
    if (fieldKey === 'confirm_password') {
      if (posWords.some(w => cleanText.includes(w))) {
        speak("Password confirmed! Submitting login.", () => {
          setTimeout(() => {
            handleSubmit();
          }, 200);
        });
      } else if (negWords.some(w => cleanText.includes(w))) {
        setPassword('');
        pendingPasswordRef.current = '';
        speak(`Re-enter password. Speak your password now.`, () => {
          setTimeout(() => triggerVoiceLogin('password'), 150);
        });
      } else {
        const newPass = rawText.replace(/\s+/g, '');
        setPassword(newPass);
        pendingPasswordRef.current = newPass;
        speak(`Entered password ${newPass}. Confirm? Say YES or NO.`, () => {
          setTimeout(() => triggerVoiceLogin('confirm_password'), 150);
        });
      }
      return;
    }
  };

  const handleTapScreenAnywhere = (e) => {
    if (isListening) return;
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a') || e.target.closest('form')) {
      return;
    }
    triggerVoiceLogin('role');
  };

  const handleRoleSelect = (roleKey) => {
    cancelSpeech();
    stopRecognition();
    if (roleKey === 'teacher') {
      navigate('/teacher-login');
      return;
    }
    if (roleKey === 'admin') {
      navigate('/admin-login');
      return;
    }
    setSelectedRole('student');
    speak('Student login mode selected.');
  };

  const handleGetStudentLoginOtp = async (targetEmail = null, triggerVoiceAfterSend = true) => {
    setErrorMessage('');
    setOtpSuccessMessage('');
    const emailToUse = (targetEmail || pendingEmailRef.current || email || '').toLowerCase().trim();
    const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    if (!emailToUse || !GMAIL_REGEX.test(emailToUse)) {
      const msg = 'Please enter a valid student Gmail address to receive an OTP.';
      setErrorMessage(msg);
      speak(msg);
      return;
    }

    setIsSendingLoginOtp(true);
    speak('Sending 6-digit login OTP code to your student email. Please wait.');
    try {
      const res = await studentSendLoginOtpApi(emailToUse);
      setIsSendingLoginOtp(false);
      if (res && res.success) {
        setLoginOtpSent(true);
        setErrorMessage('');
        setOtpSuccessMessage(`📧 6-digit login code sent to ${emailToUse}.`);
        speak(`Login OTP code sent to your email address ${formatSpokenEmail(emailToUse)}. Step 3: Verify OTP. Please speak your 6-digit OTP code to verify OTP and log in.`, () => {
          setTimeout(() => triggerVoiceLogin('otp', true), 350);
        });
      } else {
        const msg = res?.message || 'Failed to send login OTP.';
        setErrorMessage(msg);
        speak(msg);
      }
    } catch (err) {
      setIsSendingLoginOtp(false);
      setErrorMessage('Server error while sending login OTP.');
      speak('Server error while sending login OTP.');
    }
  };

  const handleStudentOtpLogin = async () => {
    setErrorMessage('');
    const emailToUse = email.toLowerCase().trim();
    const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    if (!emailToUse || !GMAIL_REGEX.test(emailToUse)) {
      const msg = 'Please enter your student Gmail address.';
      setErrorMessage(msg);
      speak(msg);
      return;
    }

    const cleanOtp = loginOtpInput.trim().replace(/\D/g, '');
    if (!cleanOtp || cleanOtp.length !== 6) {
      const msg = 'Please enter the 6-digit OTP code received in your email.';
      setErrorMessage(msg);
      speak(msg);
      return;
    }

    setIsVerifyingLoginOtp(true);
    try {
      const res = await studentLoginOtpApi(emailToUse, cleanOtp);
      setIsVerifyingLoginOtp(false);
      if (res && res.success) {
        const cleanName = formatSpokenName(res.user?.username || res.user?.name || emailToUse);
        const savedPic = res.user?.profilePic || localStorage.getItem('student_profile_pic') || localStorage.getItem('last_active_student_profile_pic') || null;
        if (savedPic) {
          localStorage.setItem('student_profile_pic', savedPic);
          localStorage.setItem('last_active_student_profile_pic', savedPic);
        }
        localStorage.setItem('auth_session', JSON.stringify({ 
          email: res.user?.email || emailToUse, 
          role: 'student', 
          name: cleanName,
          phone: res.user?.phone || '',
          course: res.user?.course || '',
          profilePic: savedPic
        }));
        
        speak("OTP verification successful! Welcome to VisionAssist AI. Redirecting to your Student Dashboard now.", () => {
          navigate('/student-dashboard');
        });
        setTimeout(() => {
          navigate('/student-dashboard');
        }, 1000);
      } else {
        const msg = res?.message || 'Invalid or expired OTP code.';
        setErrorMessage(msg);
        speak(msg);
      }
    } catch (err) {
      setIsVerifyingLoginOtp(false);
      setErrorMessage('Login failed. Server error.');
      speak('Login failed.');
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');

    if (selectedRole === 'student' && loginMethod === 'otp') {
      return handleStudentOtpLogin();
    }

    const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    if (!email || !GMAIL_REGEX.test(email.trim())) {
      setErrorMessage('Invalid Gmail address. Email must end with @gmail.com with no trailing characters.');
      speak("Invalid Gmail address. Email must end with @gmail.com with no trailing characters.", () => {
        setTimeout(() => triggerVoiceLogin('email'), 400);
      });
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      speak("Please enter your password.", () => {
        setTimeout(() => triggerVoiceLogin('password'), 400);
      });
      return;
    }

    if (selectedRole === 'admin' && !adminSecretKey) {
      setErrorMessage('Please enter Admin Private Key.');
      speak("Please enter Admin Private Key.");
      return;
    }

    try {
      const res = await loginUser({
        email,
        password,
        role: selectedRole,
        adminSecretKey: selectedRole === 'admin' ? adminSecretKey : undefined
      });
      if (res && res.success) {
        const cleanName = formatSpokenName(res.user?.username || email);
        localStorage.setItem('auth_session', JSON.stringify({
          email: res.user?.email || email,
          role: selectedRole,
          name: cleanName
        }));

        setShowSuccessPopup(true);
        speak(`${selectedRole.toUpperCase()} login successful! Opening dashboard.`, () => {
          setTimeout(() => handleModalClose(), 1200);
        });
      } else {
        const msg = res?.message || `${selectedRole.toUpperCase()} login failed. Check email or role.`;
        setErrorMessage(msg);
        speak(msg);
      }
    } catch (err) {
      setErrorMessage(`${selectedRole.toUpperCase()} login failed.`);
      speak(`${selectedRole.toUpperCase()} login failed.`);
    }
  };

  const handleModalClose = () => {
    setShowSuccessPopup(false);
    cancelSpeech();

    if (selectedRole === 'teacher') navigate('/teacher-dashboard');
    else if (selectedRole === 'admin') navigate('/admin-dashboard');
    else navigate('/student-dashboard');
  };

  const getRoleColor = () => {
    if (selectedRole === 'teacher') return '#9333ea';
    if (selectedRole === 'admin') return '#d97706';
    return '#0284c7';
  };

  return (
    <div
      onClick={handleTapScreenAnywhere}
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        boxSizing: 'border-box',
        fontFamily: "'Inter', system-ui, sans-serif"
      }}
    >
      {/* VOICE LISTENING OVERLAY FOR BLIND ACCESSIBILITY */}
      {isListening && (
        <div 
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(2, 132, 199, 0.65)', zIndex: 99999,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          backdropFilter: 'blur(8px)', padding: '20px'
        }}>
          <div style={{
            background: '#ffffff', width: '90%', maxWidth: '560px', padding: '36px 40px', borderRadius: '28px',
            border: `4px solid ${getRoleColor()}`, textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            boxSizing: 'border-box'
          }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#e0f2fe', display: 'grid', placeItems: 'center', margin: '0 auto 16px auto', border: `4px solid ${getRoleColor()}` }}>
              <Mic size={44} color={getRoleColor()} style={{ animation: 'pulse 1.2s infinite' }} />
            </div>

            <h2 style={{ fontSize: '24px', color: getRoleColor(), margin: '0 0 12px 0', fontWeight: '900' }}>
              🎙️ Voice Assistant Active & Listening!
            </h2>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#e0f2fe', color: getRoleColor(), padding: '6px 14px', borderRadius: '16px', fontSize: '13px', fontWeight: '800', marginBottom: '14px' }}>
              {activeVoiceField === 'role' ? '🗣️ Step 1: Speak Role (Student, Teacher, Admin)' :
               activeVoiceField === 'confirm_role' ? `🗣️ Selected ${pendingRoleRef.current} role — Say CONFIRM or NO` :
               activeVoiceField === 'login_method' ? '🗣️ Step 1: Choose Login Method — Say "Password" or "OTP"' :
               activeVoiceField === 'email' ? `🗣️ Step 2: Speak ${selectedRole} Email Address` :
               activeVoiceField === 'confirm_email' ? `🗣️ Entered email: ${pendingEmailRef.current || email} — Say CONFIRM or NO` :
               activeVoiceField === 'otp' ? `🗣️ Step 3: Verify OTP — Speak 6-Digit Code (${loginOtpInput || 'Waiting'})` :
               activeVoiceField === 'password' ? '🗣️ Step 3: Speak Password' :
               activeVoiceField === 'confirm_password' ? `🗣️ Entered password: ${pendingPasswordRef.current || password} — Say CONFIRM or NO` :
               '🎙️ Listening for Voice Input'}
            </div>
            
            {/* Live Real-time Speech Transcript Display */}
            <div style={{ background: '#f0f9ff', border: `2px dashed ${getRoleColor()}`, padding: '20px 16px', borderRadius: '20px', margin: '12px 0 20px 0', minHeight: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ margin: 0, fontSize: '17px', color: liveTranscript ? '#0f172a' : getRoleColor(), fontWeight: '800', textAlign: 'center', lineHeight: 1.5, wordBreak: 'break-word' }}>
                {liveTranscript ? `"${liveTranscript}"` : (
                  activeVoiceField === 'otp' ? '🗣️ Step 3: Verify OTP. Please speak the 6-digit OTP code sent to your email.' :
                  '🎙️ Listening... Speak your response clearly.'
                )}
              </p>
            </div>

            {/* Quick Action Shortcuts */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '18px' }}>
              {activeVoiceField === 'otp' ? (
                <>
                  <button 
                    type="button"
                    onClick={() => { setIsListening(false); handleStudentOtpLogin(); }}
                    style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <CheckCircle size={16} /> ✉️ Verify OTP & Login
                  </button>
                  <button 
                    type="button"
                    onClick={() => { handleGetStudentLoginOtp(null, true); }}
                    style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    🔄 Resend OTP Code
                  </button>
                </>
              ) : (
                <>
                  <button 
                    type="button"
                    onClick={() => { setEmail('priya@gmail.com'); setPassword('priya123'); speak("Filled demo email and password."); }}
                    style={{ background: getRoleColor(), color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                  >
                    📧 Fill Demo Account (priya@gmail.com)
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setIsListening(false); handleSubmit(); }}
                    style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                  >
                    ⚡ Submit Login
                  </button>
                </>
              )}
            </div>

            {/* Manual Text Command Fallback */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (manualCommandInput.trim()) {
                  setIsListening(false);
                  processVoiceResult(manualCommandInput.trim(), activeVoiceField);
                  setManualCommandInput('');
                }
              }}
              style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}
            >
              <input 
                type="text"
                placeholder="Or type voice response here..."
                value={manualCommandInput}
                onChange={(e) => setManualCommandInput(e.target.value)}
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
              type="button"
              onClick={handleCloseVoiceOverlay}
              style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 24px', borderRadius: '12px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
            >
              ✖ Close Voice Overlay
            </button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <ProjectLogo size="large" />
        <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', margin: '10px 0 4px 0' }}>
          Platform Access & Role Selection
        </h1>
        <p style={{ fontSize: '13px', color: '#64748b', margin: 0, fontWeight: '600' }}>
          Select your role or dictate login details hands-free via voice
        </p>
      </div>

      {/* ROLE SELECTION PILLS MATCHING DESIGN SCREENSHOT */}
      <div 
        style={{ 
          display: 'flex', 
          gap: '12px', 
          width: '100%', 
          maxWidth: '500px', 
          marginBottom: '20px',
          justifyContent: 'center'
        }}
      >
        {/* STUDENT PILL */}
        <button
          type="button"
          onClick={() => handleRoleSelect('student')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 16px',
            borderRadius: '24px',
            border: selectedRole === 'student' ? '2px solid #0284c7' : '1px solid #cbd5e1',
            background: selectedRole === 'student' ? '#0284c7' : '#ffffff',
            color: selectedRole === 'student' ? '#ffffff' : '#0284c7',
            fontWeight: '800',
            fontSize: '15px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: selectedRole === 'student' ? '0 4px 14px rgba(2, 132, 199, 0.35)' : 'none'
          }}
        >
          <GraduationCap size={20} color={selectedRole === 'student' ? '#ffffff' : '#0284c7'} />
          Student
        </button>

        {/* TEACHER PILL */}
        <button
          type="button"
          onClick={() => handleRoleSelect('teacher')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 16px',
            borderRadius: '24px',
            border: selectedRole === 'teacher' ? '2px solid #9333ea' : '1px solid #cbd5e1',
            background: selectedRole === 'teacher' ? '#9333ea' : '#ffffff',
            color: selectedRole === 'teacher' ? '#ffffff' : '#9333ea',
            fontWeight: '800',
            fontSize: '15px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: selectedRole === 'teacher' ? '0 4px 14px rgba(147, 51, 234, 0.35)' : 'none'
          }}
        >
          <UserCheck size={20} color={selectedRole === 'teacher' ? '#ffffff' : '#9333ea'} />
          Teacher
        </button>

        {/* ADMIN PILL */}
        <button
          type="button"
          onClick={() => handleRoleSelect('admin')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 16px',
            borderRadius: '24px',
            border: selectedRole === 'admin' ? '2px solid #d97706' : '1px solid #cbd5e1',
            background: selectedRole === 'admin' ? '#d97706' : '#ffffff',
            color: selectedRole === 'admin' ? '#ffffff' : '#d97706',
            fontWeight: '800',
            fontSize: '15px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: selectedRole === 'admin' ? '0 4px 14px rgba(217, 119, 6, 0.35)' : 'none'
          }}
        >
          <Shield size={20} color={selectedRole === 'admin' ? '#ffffff' : '#d97706'} />
          Admin
        </button>
      </div>

      {/* DYNAMIC LOGIN FORM FOR SELECTED ROLE */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '480px',
          background: '#ffffff',
          border: `2px solid ${getRoleColor()}`,
          padding: '32px',
          borderRadius: '24px',
          boxShadow: '0 20px 40px -15px rgba(0,0,0,0.08)',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: getRoleColor() }}>
            Logging in as {selectedRole === 'student' ? '🎓 Student' : selectedRole === 'teacher' ? '👨‍🏫 Teacher' : '🛡️ Administrator'}
          </h2>
        </div>

        {/* Voice Assistant Banner */}
        <div 
          onClick={() => triggerVoiceLogin('role')}
          style={{
            padding: '12px 16px', borderRadius: '14px', background: '#f0f9ff',
            border: `1px solid ${getRoleColor()}`, marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: getRoleColor(), padding: '8px', borderRadius: '50%', color: '#ffffff' }}>
              <Mic size={18} />
            </div>
            <div>
              <b style={{ fontSize: '13px', color: getRoleColor(), display: 'block' }}>Tap Screen Anywhere to Activate Voice</b>
              <small style={{ fontSize: '11px', color: '#64748b' }}>Step-by-step role select, login & voice confirmation</small>
            </div>
          </div>
          <Sparkles size={18} color={getRoleColor()} />
        </div>

        {errorMessage && (
          <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '14px', textAlign: 'center', fontWeight: '700', background: '#fef2f2', padding: '10px', borderRadius: '10px', border: '1px solid #fca5a5' }}>
            ⚠️ {errorMessage}
          </div>
        )}

        {/* FOR STUDENT ROLE ONLY: PASSWORD VS OTP TOGGLE */}
        {selectedRole === 'student' && (
          <div style={{ display: 'flex', background: '#e0f2fe', padding: '4px', borderRadius: '14px', marginBottom: '16px' }}>
            <button
              type="button"
              onClick={() => { setLoginMethod('password'); setErrorMessage(''); cancelSpeech(); speak("Switched to Password Login."); }}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '10px',
                border: 'none',
                fontWeight: '800',
                fontSize: '13px',
                cursor: 'pointer',
                backgroundColor: loginMethod === 'password' ? '#0284c7' : 'transparent',
                color: loginMethod === 'password' ? '#ffffff' : '#0369a1',
                boxShadow: loginMethod === 'password' ? '0 2px 8px rgba(2, 132, 199, 0.3)' : 'none',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Lock size={15} /> Password Login
            </button>
            <button
              type="button"
              onClick={() => { setLoginMethod('otp'); setErrorMessage(''); cancelSpeech(); speak("Switched to Email OTP Login. Enter your email and click Get OTP."); }}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '10px',
                border: 'none',
                fontWeight: '800',
                fontSize: '13px',
                cursor: 'pointer',
                backgroundColor: loginMethod === 'otp' ? '#0284c7' : 'transparent',
                color: loginMethod === 'otp' ? '#ffffff' : '#0369a1',
                boxShadow: loginMethod === 'otp' ? '0 2px 8px rgba(2, 132, 199, 0.3)' : 'none',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Mail size={15} /> Email OTP Login
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Hidden inputs to absorb browser autofill */}
          <input type="text" style={{ display: 'none' }} tabIndex="-1" autoComplete="off" />
          <input type="password" style={{ display: 'none' }} tabIndex="-1" autoComplete="new-password" />
          {/* EMAIL FIELD */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', color: getRoleColor(), fontWeight: '800' }}>
                {selectedRole.toUpperCase()} EMAIL ADDRESS
              </label>
              <button 
                type="button" 
                onClick={() => triggerVoiceLogin('email')}
                style={{ background: '#f0f9ff', color: getRoleColor(), border: `1px solid ${getRoleColor()}`, padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Mic size={12} /> Speak Email
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Mail size={18} color={getRoleColor()} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  ref={emailRefInput}
                  type="email"
                  name="role_select_email"
                  autoComplete="off"
                  placeholder={selectedRole === 'student' ? 'student@gmail.com' : selectedRole === 'teacher' ? 'teacher@institution.edu' : 'admin@system.org'}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMessage('');
                    setLoginOtpSent(false);
                    setLoginOtpInput('');
                    setOtpSuccessMessage('');
                  }}
                  style={{ width: '100%', padding: '14px 14px 14px 42px', borderRadius: '12px', fontSize: '14px', border: `1px solid ${getRoleColor()}`, boxSizing: 'border-box', fontWeight: '600' }}
                  required
                />
              </div>

              {selectedRole === 'student' && loginMethod === 'otp' && (
                <button
                  type="button"
                  onClick={() => handleGetStudentLoginOtp()}
                  disabled={isSendingLoginOtp}
                  style={{
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '0 16px',
                    fontWeight: '800',
                    fontSize: '13px',
                    cursor: isSendingLoginOtp ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)'
                  }}
                >
                  {isSendingLoginOtp ? 'Sending...' : (loginOtpSent ? 'Resend OTP' : 'Get OTP')}
                </button>
              )}
            </div>

            {/* OTP Status Feedback Message */}
            {otpSuccessMessage && selectedRole === 'student' && loginMethod === 'otp' && (
              <div style={{ fontSize: '12px', color: '#0284c7', fontWeight: '700', marginTop: '6px' }}>
                {otpSuccessMessage}
              </div>
            )}
          </div>

          {/* STANDARD PASSWORD BLOCK */}
          {!(selectedRole === 'student' && loginMethod === 'otp') && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', color: getRoleColor(), fontWeight: '800' }}>
                  PASSWORD
                </label>
                <button 
                  type="button" 
                  onClick={() => triggerVoiceLogin('password')}
                  style={{ background: '#f0f9ff', color: getRoleColor(), border: `1px solid ${getRoleColor()}`, padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Mic size={12} /> Speak Password
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={18} color={getRoleColor()} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  ref={passwordRefInput}
                  type={showPassword ? 'text' : 'password'}
                  name="role_select_password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', padding: '14px 42px 14px 42px', borderRadius: '12px', fontSize: '14px', border: `1px solid ${getRoleColor()}`, boxSizing: 'border-box', fontWeight: '600' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {showPassword ? <EyeOff size={18} color="#94a3b8" /> : <Eye size={18} color="#94a3b8" />}
                </button>
              </div>
            </div>
          )}

          {/* ADMIN PRIVATE KEY FIELD - STRICTLY ADMIN ONLY, NEVER VISIBLE FOR STUDENT OR TEACHER */}
          {selectedRole === 'admin' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', color: getRoleColor(), fontWeight: '800' }}>
                  🔑 ADMIN PRIVATE KEY
                </label>
                <span style={{ fontSize: '11px', color: getRoleColor(), fontWeight: '700', background: '#fef3c7', padding: '2px 8px', borderRadius: '6px' }}>
                  Admin Only
                </span>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={18} color={getRoleColor()} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showAdminSecretKey ? 'text' : 'password'}
                  name="role_admin_private_key"
                  autoComplete="new-password"
                  placeholder="Enter Admin Private Key"
                  value={adminSecretKey}
                  onChange={(e) => setAdminSecretKey(e.target.value)}
                  style={{ width: '100%', padding: '14px 42px 14px 42px', borderRadius: '12px', fontSize: '14px', border: `1px solid ${getRoleColor()}`, boxSizing: 'border-box', fontWeight: '600' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowAdminSecretKey(!showAdminSecretKey)}
                  style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {showAdminSecretKey ? <EyeOff size={18} color="#94a3b8" /> : <Eye size={18} color="#94a3b8" />}
                </button>
              </div>
            </div>
          )}

          {!(selectedRole === 'student' && loginMethod === 'otp') && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <Link to="/forgot-password" state={{ role: selectedRole }} style={{ fontSize: '12px', color: getRoleColor(), fontWeight: '700', textDecoration: 'none' }}>
                Forgot Password?
              </Link>
              {selectedRole !== 'admin' && (
                <Link 
                  to="/register" 
                  state={{ role: selectedRole }}
                  style={{ fontSize: '12px', color: getRoleColor(), fontWeight: '700', textDecoration: 'none' }}
                >
                  Register New Account →
                </Link>
              )}
            </div>
          )}

          {!(selectedRole === 'student' && loginMethod === 'otp') && (
            <button
              type="submit"
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              border: 'none',
              background: getRoleColor(),
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: '900',
              cursor: 'pointer',
              marginTop: '10px',
              boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
              display: 'flex',
              justify: 'center',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            Login as {selectedRole === 'student' ? 'Student' : selectedRole === 'teacher' ? 'Teacher' : 'Administrator'} <ArrowRight size={18} />
          </button>
        )}

        {/* STUDENT OTP FLOW */}
        {selectedRole === 'student' && loginMethod === 'otp' && (
          <>
            {loginOtpSent ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', color: '#0369a1', fontWeight: '800' }}>
                    Enter 6-Digit Login OTP
                  </label>
                  <button 
                    type="button" 
                    onClick={() => triggerVoiceLogin('otp')}
                    style={{ background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Mic size={12} /> Speak OTP
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} color="#0284c7" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="e.g. 123456"
                    value={loginOtpInput}
                    onChange={(e) => {
                      setLoginOtpInput(e.target.value.replace(/\D/g, ''));
                      setErrorMessage('');
                    }}
                    style={{ width: '100%', padding: '14px 14px 14px 42px', borderRadius: '12px', fontSize: '16px', border: '2px solid #0284c7', boxSizing: 'border-box', fontWeight: '800', letterSpacing: '4px', textAlign: 'center' }}
                    required
                  />
                </div>

                <button
                  type="button"
                  onClick={handleStudentOtpLogin}
                  disabled={isVerifyingLoginOtp}
                  style={{
                    width: '100%', padding: '14px', borderRadius: '12px',
                    backgroundColor: '#16a34a', color: '#ffffff', fontWeight: '800',
                    fontSize: '15px', border: 'none', cursor: isVerifyingLoginOtp ? 'not-allowed' : 'pointer', marginTop: '14px',
                    boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)'
                  }}
                >
                  {isVerifyingLoginOtp ? 'Verifying OTP & Logging In...' : 'Verify OTP & Enter Student Dashboard 🚀'}
                </button>
              </div>
            ) : (
              <div style={{ background: '#f0f9ff', padding: '14px', borderRadius: '12px', border: '1px dashed #0284c7', textAlign: 'center' }}>
                <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#0369a1', fontWeight: '700' }}>
                  Tap <strong>"Get OTP"</strong> above to receive a 6-digit login verification code directly in your Gmail inbox.
                </p>
                <button
                  type="button"
                  onClick={() => handleGetStudentLoginOtp()}
                  disabled={isSendingLoginOtp}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '10px',
                    backgroundColor: '#0284c7', color: '#ffffff', fontWeight: '800',
                    fontSize: '14px', border: 'none', cursor: isSendingLoginOtp ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isSendingLoginOtp ? 'Sending OTP Code...' : '📩 Send 6-Digit Login OTP'}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '10px' }}>
              <Link 
                to="/register" 
                state={{ role: 'student' }}
                style={{ fontSize: '12px', color: '#0284c7', fontWeight: '700', textDecoration: 'none' }}
              >
                Register New Student Account →
              </Link>
            </div>
          </>
        )}
        </form>
      </div>

      {/* SUCCESS MODAL */}
      {showSuccessPopup && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ background: '#ffffff', padding: '36px', borderRadius: '24px', textAlign: 'center', maxWidth: '360px', width: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <CheckCircle size={56} color="#16a34a" style={{ marginBottom: '16px' }} />
            <h3 style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a', margin: '0 0 8px 0' }}>Login Successful!</h3>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 20px 0' }}>
              Welcome back! Redirecting to {selectedRole} dashboard.
            </p>
            <button
              onClick={handleModalClose}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: getRoleColor(), color: '#fff', fontWeight: '900', cursor: 'pointer', fontSize: '15px' }}
            >
              OK, Open Dashboard
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
