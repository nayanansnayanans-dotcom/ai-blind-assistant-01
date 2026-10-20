import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, CheckCircle, Mic, Lock, Mail, ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { speakIn, cancelSpeech, formatSpokenName, isTTSActive, formatSpokenEmail, parseSpokenEmail } from './speech';
import ProjectLogo from './ProjectLogo.jsx';
import { loginUser, studentSendLoginOtpApi, studentLoginOtpApi } from '../services/api';

export default function StudentLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [loginMethod, setLoginMethod] = useState('password'); // 'password' or 'otp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginOtpInput, setLoginOtpInput] = useState('');
  const [loginOtpSent, setLoginOtpSent] = useState(false);
  const [isSendingLoginOtp, setIsSendingLoginOtp] = useState(false);
  const [isVerifyingLoginOtp, setIsVerifyingLoginOtp] = useState(false);
  const [otpSuccessMessage, setOtpSuccessMessage] = useState('');

  const [isListening, setIsListening] = useState(false);
  const [activeVoiceField, setActiveVoiceField] = useState('email');
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
      rate: 0.88, 
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
    loginMethodRef.current = loginMethod;
    pendingMethodRef.current = loginMethod;
  }, [loginMethod]);

  useEffect(() => {
    const passedEmail = location.state?.email || '';
    const passedMethod = location.state?.method || '';
    if (passedEmail) {
      setEmail(passedEmail);
      pendingEmailRef.current = passedEmail;
    } else {
      try {
        localStorage.removeItem('auth_session');
        localStorage.removeItem('user');
        localStorage.removeItem('user_name');
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('custom_student_profile');
        localStorage.removeItem('student_profile_pic');
        localStorage.removeItem('registered_user');
      } catch (e) {}
      setEmail('');
      pendingEmailRef.current = '';
    }
    setPassword('');
    pendingPasswordRef.current = '';
    setLoginOtpInput('');
    setLoginOtpSent(false);
    setIsSendingLoginOtp(false);
    setIsVerifyingLoginOtp(false);
    setErrorMessage('');
    setOtpSuccessMessage('');
    setShowSuccessPopup(false);
    setActiveVoiceField('login_method');
    if (passedMethod === 'otp') {
      changeLoginMethod('otp');
    } else {
      changeLoginMethod('password');
    }
    const clearTimer = setTimeout(() => {
      if (passedEmail) {
        setEmail(passedEmail);
        pendingEmailRef.current = passedEmail;
      } else {
        setEmail('');
        pendingEmailRef.current = '';
      }
      if (passedMethod === 'otp') {
        changeLoginMethod('otp');
      } else {
        changeLoginMethod('password');
      }
      setPassword('');
      pendingPasswordRef.current = '';
    }, 150);
    return () => clearTimeout(clearTimer);
  }, [location.state]);

  useEffect(() => {
    const greetingTimer = setTimeout(() => {
      speak("Welcome to Student Portal Login. Would you like to login via Password or login via OTP? Tap anywhere on the screen or press Spacebar to activate voice assistant.");
    }, 450);

    const triggerAction = () => {
      isManuallyClosedRef.current = false;
      const curMethod = loginMethodRef.current || pendingMethodRef.current || loginMethod;
      if (loginOtpSent || (curMethod === 'otp' && (email || pendingEmailRef.current) && activeVoiceField === 'otp')) {
        triggerVoiceLogin('otp');
      } else if (curMethod === 'otp' && (email || pendingEmailRef.current)) {
        handleGetStudentLoginOtp(email || pendingEmailRef.current, true);
      } else {
        triggerVoiceLogin('login_method');
      }
    };

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space' || (e.altKey && e.code === 'KeyS')) {
        e.preventDefault();
        triggerAction();
      }
    };

    const handleGlobalClick = (e) => {
      if (e.target.closest('input') || e.target.closest('button') || e.target.closest('a') || e.target.closest('textarea') || e.target.closest('select')) {
        return;
      }
      triggerAction();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleGlobalClick);

    return () => {
      clearTimeout(greetingTimer);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleGlobalClick);
      window.isVoiceAssistantActive = false;
    };
  }, []);

  const triggerVoiceLogin = async (targetField = 'login_method', skipPrompt = false) => {
    isManuallyClosedRef.current = false;
    stopRecognition();
    cancelSpeech();
    setErrorMessage('');
    hasProcessedRef.current = false;
    setIsListening(true);
    setActiveVoiceField(targetField);
    setLiveTranscript('');

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      speak("Speech recognition is not supported in this browser. Please type your login details.");
      setIsListening(false);
      return;
    }

    const activeMethod = loginMethodRef.current || pendingMethodRef.current || loginMethod;
    let promptMsg = "";
    if (targetField === 'login_method' || targetField === 'all') {
      promptMsg = "Step 1: Login Method. Would you like to login via Password or login via OTP? Please say PASSWORD or say OTP.";
    } else if (targetField === 'email') {
      promptMsg = activeMethod === 'otp'
        ? "Please speak your student Gmail address to receive an OTP and log in."
        : "Please speak your student Gmail address to login via Password.";
    } else if (targetField === 'confirm_email') {
      const spokenEmail = formatSpokenEmail(pendingEmailRef.current || email);
      promptMsg = activeMethod === 'otp'
        ? `You entered Gmail address ${spokenEmail}. Say CONFIRM to receive login OTP, or say NO to re-enter.`
        : `You entered Gmail address ${spokenEmail}. Is this correct? Say CONFIRM or NO.`;
    } else if (targetField === 'otp') {
      promptMsg = "Step 3: Verify OTP. A 6-digit login OTP code has been sent to your email. Please speak your 6-digit OTP code to verify OTP and log in.";
    } else if (targetField === 'password') {
      promptMsg = "Step 3: Please enter your password using only alphabets and numbers, or say FORGOT PASSWORD if you have forgotten your password.";
    } else if (targetField === 'confirm_password') {
      promptMsg = `You entered password ${pendingPasswordRef.current || password}. Is this correct? Say CONFIRM to login, say NO to re-enter, or say FORGOT PASSWORD to reset your password.`;
    } else if (targetField === 'redirect_register') {
      promptMsg = `No account found for ${email}. Would you like to go to the Student Registration page to register your account now? Say YES or REGISTER to open registration, or say NO to try logging in again.`;
    } else if (targetField === 'confirm_go_to_dashboard') {
      promptMsg = "Student login successful! Would you like to enter your Student Dashboard now? Please say YES, ENTER, or CONFIRM to go further, or say NO to stay on this screen.";
    }

    let micStarted = false;
    const startMic = () => {
      if (isManuallyClosedRef.current) return;
      if (micStarted) return;
      micStarted = true;

      try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
          if (!isManuallyClosedRef.current) {
            setIsListening(true);
          }
        };

        recognition.onresult = (e) => {
          if (isManuallyClosedRef.current) return;
          if (isTTSActive()) return; // Ignore speaker output echo while TTS plays
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

          // Immediate triggers for forgot password or confirmation words
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
            if (isManuallyClosedRef.current) return;
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
          if (isManuallyClosedRef.current) {
            setIsListening(false);
          }
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
        setTimeout(startMic, 300);
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

    const posWords = ['yes', 'yeah', 'yep', 'ok', 'okay', 'confirm', 'correct', 'right', 'sure', 'good', 'proceed'];
    const negWords = ['no', 'nope', 'wrong', 'change', 'retry', 'edit', 'incorrect'];

    // --- GLOBAL CLOSE VOICE OVERLAY TRIGGER ---
    const closeKeywords = ['close', 'exit', 'cancel', 'dismiss', 'close overlay', 'close assistant', 'stop'];
    if (closeKeywords.some(w => cleanText === w || cleanText.startsWith(w + ' ') || cleanText.endsWith(' ' + w))) {
      handleCloseVoiceOverlay();
      speak("Voice Assistant closed.");
      return;
    }

    // --- GLOBAL FORGOT PASSWORD VOICE TRIGGER ---
    const forgotKeywords = [
      'forgot password', 'forget password', 'forgot my password', 'forget my password',
      'forgot the password', 'forget the password', 'reset password', 'reset my password',
      'lost password', 'lost my password', 'recover password', 'i forgot', 'i forgot password',
      'forgot', 'forget', 'password reset'
    ];

    if (forgotKeywords.some(w => cleanText.includes(w))) {
      speak("Opening Student Password Recovery page now. Please enter your registered email to reset your password.", () => {
        setTimeout(() => navigate('/forgot-password', { state: { role: 'student', email: email || pendingEmailRef.current } }), 400);
      });
      return;
    }

    // --- GLOBAL METHOD SWITCH SHORTCUTS ---
    if (cleanText.includes('login via otp') || cleanText === 'otp' || cleanText.includes('switch to otp') || cleanText.includes('use otp') || cleanText.includes('email otp')) {
      changeLoginMethod('otp');
      speak("Email OTP login selected. Please speak your student Gmail address.", () => {
        setTimeout(() => triggerVoiceLogin('email', true), 300);
      });
      return;
    }
    if (cleanText.includes('login via password') || cleanText.includes('switch to password') || cleanText.includes('use password')) {
      changeLoginMethod('password');
      speak("Password login selected. Please speak your student Gmail address.", () => {
        setTimeout(() => triggerVoiceLogin('email', true), 300);
      });
      return;
    }

    // --- STEP 1: LOGIN METHOD CAPTURE (PASSWORD OR OTP) ---
    if (fieldKey === 'login_method' || fieldKey === 'method') {
      const lower = cleanText.toLowerCase();
      if (lower.includes('otp') || lower.includes('email otp') || lower.includes('code') || lower.includes('mail')) {
        changeLoginMethod('otp');
        speak("Email OTP login selected. Please speak your student Gmail address.", () => {
          setTimeout(() => triggerVoiceLogin('email', true), 300);
        });
        return;
      }
      if (lower.includes('password') || lower.includes('pass') || lower.includes('pwd')) {
        changeLoginMethod('password');
        speak("Password login selected. Please speak your student Gmail address.", () => {
          setTimeout(() => triggerVoiceLogin('email', true), 300);
        });
        return;
      }

      speak("Would you like to login via Password or login via OTP? Please say PASSWORD or say OTP.", () => {
        setTimeout(() => triggerVoiceLogin('login_method'), 300);
      });
      return;
    }

    // --- STEP 2: EMAIL CAPTURE ---
    if (fieldKey === 'email' || fieldKey === 'role' || fieldKey === 'all') {
      const parsedEmail = parseSpokenEmail(rawText);
      setEmail(parsedEmail);
      pendingEmailRef.current = parsedEmail;
      triggerVoiceLogin('confirm_email');
      return;
    }

    // --- STEP 2 CONFIRMATION ---
    if (fieldKey === 'confirm_email') {
      const rawCurrent = (pendingEmailRef.current || email || '').trim();
      const emailToCheck = parseSpokenEmail(rawCurrent);
      const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;

      if (posWords.some(w => cleanText.includes(w))) {
        if (!GMAIL_REGEX.test(emailToCheck)) {
          speak("Invalid Gmail address. Email must end with @gmail.com. Please speak your Gmail address again.", () => {
            setTimeout(() => triggerVoiceLogin('email', false), 300);
          });
          return;
        }

        setEmail(emailToCheck);
        pendingEmailRef.current = emailToCheck;

        const isOtp = loginMethodRef.current === 'otp' || pendingMethodRef.current === 'otp' || loginMethod === 'otp';
        if (isOtp) {
          speak(`Email confirmed. Sending 6-digit login OTP code to ${formatSpokenEmail(emailToCheck)}. Step 3: Verify OTP. Please wait.`, () => {
            handleGetStudentLoginOtp(emailToCheck, true);
          });
          return;
        }

        speak("Email confirmed. Step 3: Please enter or speak your password, or say FORGOT PASSWORD.", () => {
          setTimeout(() => triggerVoiceLogin('password'), 300);
        });
        return;
      } else if (negWords.some(w => cleanText.includes(w))) {
        setEmail('');
        pendingEmailRef.current = '';
        speak("Please speak your student Gmail address again.", () => {
          setTimeout(() => triggerVoiceLogin('email'), 300);
        });
        return;
      } else {
        const newEmail = parseSpokenEmail(rawText);
        setEmail(newEmail);
        pendingEmailRef.current = newEmail;
        triggerVoiceLogin('confirm_email');
        return;
      }
    }

    // --- STEP: OTP CAPTURE & DIRECT LOGIN ---
    if (fieldKey === 'otp') {
      if (cleanText.includes('resend') || cleanText.includes('send again') || cleanText.includes('another code')) {
        speak("Resending 6-digit login OTP code to your email. Please wait.");
        handleGetStudentLoginOtp(pendingEmailRef.current || email, true);
        return;
      }
      if (cleanText.includes('password') || cleanText.includes('switch to password')) {
        changeLoginMethod('password');
        speak("Switched to Password login. Step 3: Please speak your password.", () => {
          setTimeout(() => triggerVoiceLogin('password'), 300);
        });
        return;
      }

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
            try {
              localStorage.removeItem('custom_student_profile');
              localStorage.removeItem('student_profile_pic');
              localStorage.removeItem('user_name');
              localStorage.removeItem('registered_user');
            } catch (e) {}
            localStorage.setItem('auth_session', JSON.stringify({ 
              email: res.user?.email || targetEmail, 
              role: 'student', 
              name: cleanName,
              phone: res.user?.phone || '',
              studentId: res.user?.studentId || res.user?.registerNumber || '',
              registerNumber: res.user?.registerNumber || res.user?.studentId || '',
              course: res.user?.course || ''
            }));
            try {
              const cleanE = (res.user?.email || targetEmail).toLowerCase().trim();
              const loggedMap = JSON.parse(localStorage.getItem('logged_in_users') || '{}');
              loggedMap[cleanE] = {
                email: cleanE,
                role: 'student',
                name: cleanName,
                studentId: res.user?.studentId || res.user?.registerNumber || '',
                loginTime: new Date().toISOString(),
                status: 'online'
              };
              localStorage.setItem('logged_in_users', JSON.stringify(loggedMap));
            } catch (e) {}
            speak("OTP verified successfully! Welcome to VisionAssist AI. Opening your Student Dashboard now.", () => {
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
        return;
      } else {
        speak("Step 3: Verify OTP. Please speak the 6-digit login OTP code sent to your email.", () => {
          setTimeout(() => triggerVoiceLogin('otp'), 400);
        });
        return;
      }
    }

    // --- STEP 3: PASSWORD CAPTURE ---
    if (fieldKey === 'password') {
      if (cleanText.includes('otp') || cleanText.includes('one time password') || cleanText === 'login with otp' || cleanText === 'use otp' || cleanText.includes('verify otp')) {
        changeLoginMethod('otp');
        speak("Switched to Email OTP Login. Sending login OTP to your email. Step 3: Verify OTP.", () => {
          handleGetStudentLoginOtp(pendingEmailRef.current || email, true);
        });
        return;
      }

      if (cleanText === 'enter password' || cleanText === 'enter your password' || cleanText === 'enter my password' || cleanText === 'type password' || cleanText === 'password') {
        speak("Please speak the characters of your password now.", () => {
          setTimeout(() => triggerVoiceLogin('password'), 300);
        });
        return;
      }

      const cleanPass = rawText
        .replace(/^my password is\s+/i, '')
        .replace(/^the password is\s+/i, '')
        .replace(/^password is\s+/i, '')
        .replace(/\s+/g, '');

      if (!cleanPass) {
        speak("No password captured. Please speak your password or say FORGOT PASSWORD.", () => {
          setTimeout(() => triggerVoiceLogin('password'), 300);
        });
        return;
      }

      setPassword(cleanPass);
      pendingPasswordRef.current = cleanPass;
      triggerVoiceLogin('confirm_password');
      return;
    }

    // --- STEP 3 CONFIRMATION ---
    if (fieldKey === 'confirm_password') {
      if (posWords.some(w => cleanText.includes(w))) {
        speak("Password confirmed! Submitting student login now.", () => {
          setTimeout(() => {
            handleSubmit();
          }, 200);
        });
      } else if (negWords.some(w => cleanText.includes(w))) {
        setPassword('');
        pendingPasswordRef.current = '';
        triggerVoiceLogin('password');
      } else {
        const newPass = rawText
          .replace(/^my password is\s+/i, '')
          .replace(/^the password is\s+/i, '')
          .replace(/^password is\s+/i, '')
          .replace(/\s+/g, '');
        setPassword(newPass);
        pendingPasswordRef.current = newPass;
        triggerVoiceLogin('confirm_password');
      }
      return;
    }

    // --- UNREGISTERED EMAIL REDIRECT TO REGISTRATION ---
    if (fieldKey === 'redirect_register') {
      const regWords = ['yes', 'yeah', 'yep', 'ok', 'okay', 'confirm', 'correct', 'right', 'proceed', 'sure', 'good', 'register', 'registration', 'open', 'go'];
      const cancelWords = ['no', 'nope', 'wrong', 'change', 'retry', 'edit', 'incorrect', 'stay', 'login', 'cancel'];

      if (regWords.some(w => cleanText.includes(w))) {
        speak("Opening Student Registration page.", () => {
          setTimeout(() => navigate('/register'), 400);
        });
      } else if (cancelWords.some(w => cleanText.includes(w))) {
        speak("Staying on login page. Please speak or enter your registered email address.", () => {
          setTimeout(() => triggerVoiceLogin('email'), 400);
        });
      } else {
        speak("Say YES or REGISTER to open registration, or say NO to try logging in again.", () => {
          setTimeout(() => triggerVoiceLogin('redirect_register'), 400);
        });
      }
      return;
    }

    // --- CONFIRMATION TO GO FURTHER AFTER SUCCESSFUL LOGIN ---
    if (fieldKey === 'confirm_go_to_dashboard') {
      const enterWords = ['yes', 'yeah', 'yep', 'ok', 'okay', 'confirm', 'correct', 'right', 'proceed', 'sure', 'good', 'enter', 'dashboard', 'go', 'continue', 'open', 'further'];
      const stayWords = ['no', 'nope', 'wrong', 'change', 'retry', 'edit', 'incorrect', 'stay', 'cancel', 'wait', 'stop'];

      if (enterWords.some(w => cleanText.includes(w))) {
        speak("Opening your Student Dashboard now.", () => {
          setTimeout(() => {
            setShowSuccessPopup(false);
            navigate('/student-dashboard');
          }, 350);
        });
      } else if (stayWords.some(w => cleanText.includes(w))) {
        speak("Staying on the login screen. You can tap Enter Student Dashboard or say YES whenever you are ready to proceed.", () => {
          setIsListening(false);
        });
      } else {
        speak("Please say YES, ENTER, or CONFIRM to go to your dashboard, or say NO to stay.", () => {
          setTimeout(() => triggerVoiceLogin('confirm_go_to_dashboard'), 400);
        });
      }
      return;
    }
  };

  const handleTapScreenAnywhere = (e) => {
    if (isListening) return;
    if (isManuallyClosedRef.current) return;
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a') || e.target.closest('form')) {
      return;
    }
    const curMethod = loginMethodRef.current || pendingMethodRef.current || loginMethod;
    if (loginOtpSent || (curMethod === 'otp' && (email || pendingEmailRef.current) && activeVoiceField === 'otp')) {
      triggerVoiceLogin('otp');
    } else if (curMethod === 'otp' && (email || pendingEmailRef.current)) {
      handleGetStudentLoginOtp(email || pendingEmailRef.current, true);
    } else {
      triggerVoiceLogin('login_method');
    }
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
        try {
          localStorage.removeItem('custom_student_profile');
          localStorage.removeItem('student_profile_pic');
          localStorage.removeItem('user_name');
          localStorage.removeItem('registered_user');
        } catch (e) {}
        localStorage.setItem('auth_session', JSON.stringify({ 
          email: res.user?.email || emailToUse, 
          role: 'student', 
          name: cleanName,
          phone: res.user?.phone || '',
          studentId: res.user?.studentId || res.user?.registerNumber || '',
          registerNumber: res.user?.registerNumber || res.user?.studentId || '',
          course: res.user?.course || ''
        }));
        try {
          const cleanE = (res.user?.email || emailToUse).toLowerCase().trim();
          const loggedMap = JSON.parse(localStorage.getItem('logged_in_users') || '{}');
          loggedMap[cleanE] = {
            email: cleanE,
            role: 'student',
            name: cleanName,
            studentId: res.user?.studentId || res.user?.registerNumber || '',
            loginTime: new Date().toISOString(),
            status: 'online'
          };
          localStorage.setItem('logged_in_users', JSON.stringify(loggedMap));
        } catch (e) {}
        
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

    if (loginMethod === 'otp') {
      return handleStudentOtpLogin();
    }

    const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    if (!email || !GMAIL_REGEX.test(email.trim())) {
      setErrorMessage('Invalid Gmail address. Email must end with @gmail.com with no trailing characters.');
      speak("Invalid Gmail address. Please speak a valid Gmail address ending with @gmail.com.", () => {
        setTimeout(() => triggerVoiceLogin('email'), 400);
      });
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      speak("Please enter your password or say FORGOT PASSWORD.", () => {
        setTimeout(() => triggerVoiceLogin('password'), 400);
      });
      return;
    }

    try {
      const allProfiles = JSON.parse(localStorage.getItem('student_profiles_by_email') || '{}');
      const cleanEmail = email.toLowerCase().trim();
      const savedProf = allProfiles[cleanEmail] || {};
      const res = await loginUser({ 
        email, 
        password, 
        role: 'student',
        username: savedProf.name || localStorage.getItem('user_name') || ''
      });
      if (res && res.success) {
        const cleanName = formatSpokenName(res.user?.username || res.user?.name || email);
        try {
          localStorage.removeItem('custom_student_profile');
          localStorage.removeItem('student_profile_pic');
          localStorage.removeItem('user_name');
          localStorage.removeItem('registered_user');
        } catch (e) {}
        localStorage.setItem('auth_session', JSON.stringify({ 
          email: res.user?.email || email, 
          role: 'student', 
          name: cleanName,
          phone: res.user?.phone || '',
          studentId: res.user?.studentId || res.user?.registerNumber || '',
          registerNumber: res.user?.registerNumber || res.user?.studentId || '',
          course: res.user?.course || ''
        }));
        try {
          const cleanE = (res.user?.email || email).toLowerCase().trim();
          const loggedMap = JSON.parse(localStorage.getItem('logged_in_users') || '{}');
          loggedMap[cleanE] = {
            email: cleanE,
            role: 'student',
            name: cleanName,
            studentId: res.user?.studentId || res.user?.registerNumber || '',
            loginTime: new Date().toISOString(),
            status: 'online'
          };
          localStorage.setItem('logged_in_users', JSON.stringify(loggedMap));
        } catch (e) {}
        setShowSuccessPopup(true);
        // Ask voice confirmation before entering dashboard
        setTimeout(() => {
          triggerVoiceLogin('confirm_go_to_dashboard');
        }, 300);
      } else {
        const msg = res.message || 'Student login failed. Incorrect role or password.';
        setErrorMessage(msg);
        const lowerMsg = msg.toLowerCase();
        if (lowerMsg.includes('access denied')) {
          speak(msg);
        } else if (lowerMsg.includes('no account found') || lowerMsg.includes('not found')) {
          speak(`No account found for ${email}. Would you like to go to the Student Registration page to register your account now? Say YES or REGISTER to open registration, or say NO to try logging in again.`, () => {
            setTimeout(() => triggerVoiceLogin('redirect_register'), 400);
          });
        } else if (lowerMsg.includes('password') || lowerMsg.includes('invalid') || lowerMsg.includes('incorrect') || lowerMsg.includes('failed') || lowerMsg.includes('credentials')) {
          speak(`Incorrect password entered for ${email}. Please enter your password or say FORGOT PASSWORD if you have forgotten your password.`, () => {
            setTimeout(() => triggerVoiceLogin('password'), 400);
          });
        } else {
          speak(msg);
        }
      }
    } catch (err) {
      setErrorMessage('Student login failed.');
      speak('Student login failed.');
    }
  };

  const handleModalClose = () => {
    setShowSuccessPopup(false);
    cancelSpeech();
    navigate('/student-dashboard');
  };

  return (
    <div
      onClick={handleTapScreenAnywhere}
      style={{
        minHeight: '100vh', background: '#f0f9ff', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center', padding: '24px', boxSizing: 'border-box',
        fontFamily: "'Inter', system-ui, sans-serif"
      }}
    >
      {/* VOICE LISTENING OVERLAY FOR BLIND ACCESSIBILITY */}
      {isListening && (
        <div 
          onClick={handleCloseVoiceOverlay}
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(2, 132, 199, 0.65)', zIndex: 99999,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          backdropFilter: 'blur(8px)', padding: '20px'
        }}>
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
            background: '#ffffff', width: '90%', maxWidth: '560px', padding: '36px 40px', borderRadius: '28px',
            border: '4px solid #0284c7', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            boxSizing: 'border-box'
          }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#e0f2fe', display: 'grid', placeItems: 'center', margin: '0 auto 16px auto', border: '4px solid #0284c7', boxShadow: '0 0 20px rgba(2, 132, 199, 0.4)' }}>
              <Mic size={44} color="#0284c7" style={{ animation: 'pulse 1.2s infinite' }} />
            </div>

            <h2 style={{ fontSize: '24px', color: '#0369a1', margin: '0 0 12px 0', fontWeight: '900' }}>
              🎙️ Voice Assistant Active & Listening!
            </h2>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: activeVoiceField === 'redirect_register' ? '#fef2f2' : '#e0f2fe', color: activeVoiceField === 'redirect_register' ? '#dc2626' : '#0369a1', padding: '6px 14px', borderRadius: '16px', fontSize: '13px', fontWeight: '800', marginBottom: '14px' }}>
              {activeVoiceField === 'login_method' ? '🗣️ Step 1: Choose Login Method — Say "Password" or "OTP"' :
               activeVoiceField === 'email' ? `🗣️ Step 2: Speak Student Gmail Address (${(loginMethodRef.current || loginMethod) === 'otp' ? 'Email OTP' : 'Password'} Mode)` :
               activeVoiceField === 'confirm_email' ? `🗣️ Entered Gmail: ${pendingEmailRef.current || email} — Say CONFIRM or NO` :
               activeVoiceField === 'otp' ? `🗣️ Step 3: Verify OTP — Speak 6-Digit Code (${loginOtpInput || 'Listening...'})` :
               activeVoiceField === 'password' ? '🗣️ Step 3: Speak Password or Say "Forgot Password"' :
               activeVoiceField === 'confirm_password' ? `🗣️ Entered password: ${pendingPasswordRef.current || password} — Say CONFIRM, RETRY, or FORGOT PASSWORD` :
               activeVoiceField === 'redirect_register' ? `⚠️ Unregistered Gmail: Say YES or REGISTER to Open Student Registration, or NO to Try Again` :
               activeVoiceField === 'confirm_go_to_dashboard' ? `🎉 Login Successful: Say YES or ENTER to Go to Dashboard, or NO to Stay` :
               '🎙️ Listening for Voice Input'}
            </div>
            
            {/* Live Real-time Speech Transcript Display */}
            <div style={{ background: '#f0f9ff', border: '2px dashed #0284c7', padding: '20px 16px', borderRadius: '20px', margin: '12px 0 20px 0', minHeight: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ margin: 0, fontSize: '17px', color: liveTranscript ? '#0f172a' : '#0369a1', fontWeight: '800', textAlign: 'center', lineHeight: 1.5, wordBreak: 'break-word' }}>
                {liveTranscript ? `"${liveTranscript}"` : (
                  activeVoiceField === 'login_method' ? '🗣️ Would you like to login via Password or login via OTP? Say "PASSWORD" or "OTP".' :
                  activeVoiceField === 'otp' ? '🗣️ Step 3: Verify OTP. Please speak your 6-digit OTP code sent to your email.' :
                  activeVoiceField === 'confirm_go_to_dashboard' ? '🗣️ Say YES, ENTER, or CONFIRM to proceed to your Student Dashboard, or say NO to stay.' :
                  activeVoiceField === 'redirect_register' ? '🗣️ Say YES or REGISTER to open registration page, or NO to cancel.' : 
                  activeVoiceField === 'password' ? '🎙️ Listening... Speak your password, or say "Forgot Password" to reset.' :
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
                  <button 
                    type="button"
                    onClick={() => {
                      changeLoginMethod('password');
                      speak("Switched to Password login.", () => triggerVoiceLogin('password'));
                    }}
                    style={{ background: '#64748b', color: '#fff', border: 'none', padding: '10px 14px', borderRadius: '12px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    🔒 Switch to Password
                  </button>
                </>
              ) : activeVoiceField === 'login_method' ? (
                <>
                  <button 
                    type="button"
                    onClick={() => {
                      changeLoginMethod('password');
                      speak("Password login selected. Step 2: Please speak your student Gmail address.", () => {
                        setTimeout(() => triggerVoiceLogin('email'), 300);
                      });
                    }}
                    style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Lock size={16} /> 🔒 Login via Password
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      changeLoginMethod('otp');
                      speak("Email OTP login selected. Step 2: Please speak your student Gmail address to receive an OTP.", () => {
                        setTimeout(() => triggerVoiceLogin('email'), 300);
                      });
                    }}
                    style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '12px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Mail size={16} /> ✉️ Login via OTP
                  </button>
                </>
              ) : activeVoiceField === 'confirm_go_to_dashboard' ? (
                <>
                  <button 
                    type="button"
                    onClick={() => { setIsListening(false); cancelSpeech(); navigate('/student-dashboard'); }}
                    style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)' }}
                  >
                    🚀 Enter Student Dashboard (Say YES)
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setIsListening(false); cancelSpeech(); speak("Staying on login screen."); }}
                    style={{ background: '#64748b', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: '800', cursor: 'pointer' }}
                  >
                    ✖ Stay on Login Screen (Say NO)
                  </button>
                </>
              ) : activeVoiceField === 'redirect_register' ? (
                <>
                  <button 
                    onClick={() => { setIsListening(false); navigate('/register'); }}
                    style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}
                  >
                    📝 Open Student Registration
                  </button>
                  <button 
                    onClick={() => { triggerVoiceLogin('email'); }}
                    style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}
                  >
                    🔄 Try Different Email
                  </button>
                </>
              ) : (
                <>
                  <button 
                    type="button"
                    onClick={() => { setEmail('priya@gmail.com'); setPassword('priya123'); speak("Filled demo email and password."); }}
                    style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                  >
                    📧 Fill Demo Student (priya@gmail.com)
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setIsListening(false); navigate('/forgot-password', { state: { role: 'student', email } }); }}
                    style={{ background: '#d97706', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                  >
                    🔑 Forgot Password?
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

      {/* LOGIN CARD */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '460px', background: '#ffffff', border: '2px solid #0284c7',
          padding: '36px 32px', borderRadius: '24px', boxShadow: '0 20px 40px -15px rgba(2, 132, 199, 0.2)', boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
          <ProjectLogo size="large" />
          <h1 style={{ fontSize: '22px', color: '#0369a1', margin: '8px 0 2px 0', fontWeight: '900' }}>
            🎓 Student Portal Login
          </h1>
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0, fontWeight: '600' }}>
            Voice Dictation & Typed Control for Blind Accessibility
          </p>
        </div>

        {/* Voice Assistant Banner */}
        <div 
          onClick={() => {
            isManuallyClosedRef.current = false;
            const curMethod = loginMethodRef.current || pendingMethodRef.current || loginMethod;
            if (loginOtpSent || (curMethod === 'otp' && (email || pendingEmailRef.current) && activeVoiceField === 'otp')) {
              triggerVoiceLogin('otp');
            } else if (curMethod === 'otp' && (email || pendingEmailRef.current)) {
              handleGetStudentLoginOtp(email || pendingEmailRef.current, true);
            } else {
              triggerVoiceLogin('login_method');
            }
          }}
          style={{
            padding: '12px 16px', borderRadius: '14px', background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
            border: '2px solid #0284c7', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.15)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#0284c7', padding: '8px', borderRadius: '50%', color: '#ffffff' }}>
              <Mic size={18} />
            </div>
            <div>
              <b style={{ fontSize: '13px', color: '#0369a1', display: 'block' }}>Tap Screen Anywhere to Activate Voice</b>
              <small style={{ fontSize: '11px', color: '#0284c7' }}>Step-by-step student login & voice confirmation</small>
            </div>
          </div>
          <Sparkles size={18} color="#0284c7" />
        </div>

        {errorMessage && (
          <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '14px', textAlign: 'center', fontWeight: '700' }}>
            ⚠️ {errorMessage}
          </div>
        )}

        {/* LOGIN METHOD SELECTION: PASSWORD VS OTP */}
        <div style={{ display: 'flex', background: '#e0f2fe', padding: '4px', borderRadius: '14px', marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => { changeLoginMethod('password'); setErrorMessage(''); cancelSpeech(); speak("Switched to Password Login."); }}
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
            onClick={() => { changeLoginMethod('otp'); setErrorMessage(''); cancelSpeech(); speak("Switched to Email OTP Login. Enter your email and click Get OTP."); }}
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

        <form onSubmit={handleSubmit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Hidden inputs to absorb browser autofill */}
          <input type="text" style={{ display: 'none' }} tabIndex="-1" autoComplete="off" />
          <input type="password" style={{ display: 'none' }} tabIndex="-1" autoComplete="new-password" />

          {/* EMAIL FIELD */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', color: '#0369a1', fontWeight: '800' }}>
                Student Gmail / Email Address
              </label>
              <button 
                type="button" 
                onClick={() => triggerVoiceLogin('email')}
                style={{ background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Mic size={12} /> Speak Email
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Mail size={18} color="#0284c7" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  ref={emailRefInput}
                  type="email"
                  name="student_user_email"
                  autoComplete="off"
                  placeholder="e.g. priya@gmail.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMessage('');
                    setLoginOtpSent(false);
                    setLoginOtpInput('');
                    setOtpSuccessMessage('');
                  }}
                  style={inputStyle}
                  required
                />
              </div>

              {loginMethod === 'otp' && (
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
            {otpSuccessMessage && loginMethod === 'otp' && (
              <div style={{ fontSize: '12px', color: '#0284c7', fontWeight: '700', marginTop: '6px' }}>
                {otpSuccessMessage}
              </div>
            )}
          </div>

          {/* PASSWORD FLOW (When loginMethod === 'password') */}
          {loginMethod === 'password' && (
            <>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', color: '#0369a1', fontWeight: '800' }}>
                    Password
                  </label>
                  <button 
                    type="button" 
                    onClick={() => triggerVoiceLogin('password')}
                    style={{ background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Mic size={12} /> Speak Password
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} color="#0284c7" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    ref={passwordRefInput}
                    type={showPassword ? 'text' : 'password'}
                    name="student_user_password"
                    autoComplete="new-password"
                    placeholder="Enter Password (alphabets & numbers only)"
                    value={password}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
                      setPassword(val);
                      setErrorMessage('');
                    }}
                    style={{ ...inputStyle, paddingRight: '44px' }}
                    required
                  />
                  <button
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <small style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>Student passwords contain only letters (a-z, A-Z) and numbers (0-9).</small>
              </div>

              <div style={{ textAlign: 'right', marginTop: '-4px' }}>
                <Link to="/forgot-password" state={{ role: 'student' }} style={{ fontSize: '13px', color: '#0284c7', textDecoration: 'none', fontWeight: '600' }}>
                  Forgot Password?
                </Link>
              </div>

              <button
                type="submit"
                style={{
                  width: '100%', padding: '14px', borderRadius: '12px',
                  backgroundColor: '#0284c7', color: '#ffffff', fontWeight: '800',
                  fontSize: '15px', border: 'none', cursor: 'pointer', marginTop: '4px',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
                }}
              >
                Login as Student
              </button>
            </>
          )}

          {/* OTP FLOW (When loginMethod === 'otp') */}
          {loginMethod === 'otp' && (
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
                      style={{ ...inputStyle, letterSpacing: '4px', fontWeight: '800', fontSize: '16px' }}
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
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <Link to="/student-register" style={{ fontSize: '13px', color: '#0284c7', textDecoration: 'none', fontWeight: '700' }}>
              Student Registration →
            </Link>
            <Link to="/home" style={{ fontSize: '13px', color: '#475569', textDecoration: 'none', fontWeight: '600' }}>
              Go to Home Page
            </Link>
          </div>
        </form>
      </div>

      {showSuccessPopup && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2, 132, 199, 0.35)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#ffffff', border: '2px solid #0284c7', padding: '32px', borderRadius: '24px', textAlign: 'center', maxWidth: '400px', width: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <CheckCircle size={52} color="#22c55e" style={{ marginBottom: '14px' }} />
            <h2 style={{ fontSize: '22px', color: '#0f172a', marginBottom: '8px', fontWeight: '900' }}>Student Login Successful!</h2>
            <p style={{ fontSize: '14px', color: '#334155', marginBottom: '16px' }}>Would you like to enter your Student Dashboard now?</p>
            
            <div style={{ background: '#f0f9ff', border: '2px dashed #0284c7', padding: '12px 16px', borderRadius: '14px', marginBottom: '20px' }}>
              <p style={{ fontSize: '13px', color: '#0369a1', fontWeight: '800', margin: 0 }}>
                🎙️ Voice Confirmation Active:<br/>
                Say <strong>"YES"</strong> or <strong>"ENTER"</strong> to proceed,<br/>
                or say <strong>"NO"</strong> to stay.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                type="button" 
                onClick={handleModalClose} 
                style={{ width: '100%', padding: '14px', borderRadius: '12px', backgroundColor: '#0284c7', color: '#fff', border: 'none', fontWeight: '800', fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)' }}
              >
                🚀 Enter Student Dashboard (Say YES)
              </button>
              <button 
                type="button" 
                onClick={() => { setShowSuccessPopup(false); cancelSpeech(); stopRecognition(); }} 
                style={{ width: '100%', padding: '10px', borderRadius: '10px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
              >
                ✖ Stay on Login Screen (Say NO)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
