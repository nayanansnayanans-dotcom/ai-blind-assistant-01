import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, CheckCircle, Mic, Lock, Mail, User, Phone, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { speakIn, cancelSpeech, isTTSActive, formatSpokenEmail, parseSpokenEmail, isVoiceDisabled, setVoiceDisabled } from './speech';
import ProjectLogo from './ProjectLogo.jsx';
import { registerUser, sendRegistrationOtpApi, verifyRegistrationOtpApi } from '../services/api';

export default function StudentRegistrationPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Voice Assistant Master State
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(() => !isVoiceDisabled());

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registrationMethod, setRegistrationMethod] = useState('otp'); // 'otp' or 'password'

  // Email OTP Authentication States
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpMessage, setOtpMessage] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeVoiceField, setActiveVoiceField] = useState('all');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [manualCommandInput, setManualCommandInput] = useState('');
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const isManuallyClosedRef = useRef(false);

  const pendingFirstNameRef = useRef('');
  const pendingLastNameRef = useRef('');
  const pendingPhoneRef = useRef('');
  const pendingEmailRef = useRef('');
  const pendingPasswordRef = useRef('');
  const pendingConfirmPasswordRef = useRef('');
  const hasProcessedRef = useRef(false);

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

  const speak = (text, onEndCallback = null, force = false) => {
    if (isVoiceDisabled() && !force) return;
    stopRecognition();
    cancelSpeech();
    speakIn(text, 'en-US', { 
      rate: 0.88, 
      force,
      onEnd: () => {
        if (!isManuallyClosedRef.current && onEndCallback) {
          onEndCallback();
        }
      }
    });
  };

  useEffect(() => {
    const handleVoiceSync = () => {
      setIsVoiceEnabled(!isVoiceDisabled());
    };
    window.addEventListener('voice_state_changed', handleVoiceSync);
    window.addEventListener('storage', handleVoiceSync);
    return () => {
      window.removeEventListener('voice_state_changed', handleVoiceSync);
      window.removeEventListener('storage', handleVoiceSync);
    };
  }, []);

  const toggleVoiceAssistant = (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const nextVal = !isVoiceEnabled;
    setIsVoiceEnabled(nextVal);
    setVoiceDisabled(!nextVal);
    if (!nextVal) {
      isManuallyClosedRef.current = true;
      stopRecognition();
      cancelSpeech();
      setIsListening(false);
      window.isVoiceAssistantActive = false;
    } else {
      isManuallyClosedRef.current = false;
      speak("Voice Assistant enabled.", null, true);
    }
  };

  useEffect(() => {
    window.isVoiceAssistantActive = isListening;
    return () => { window.isVoiceAssistantActive = false; };
  }, [isListening]);

  useEffect(() => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
    const clearTimer = setTimeout(() => {
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setConfirmPassword('');
    }, 150);
    return () => clearTimeout(clearTimer);
  }, []);

  useEffect(() => {
    const greetingTimer = setTimeout(() => {
      if (!isVoiceDisabled()) {
        speak("Student Registration Portal. Tap anywhere on screen or press Spacebar to activate voice assistant.");
      }
    }, 450);

    const triggerAction = () => {
      if (isVoiceDisabled()) return;
      isManuallyClosedRef.current = false;
      triggerVoiceRegistration('firstName');
    };

    const handleKeyDown = (e) => {
      if (isVoiceDisabled()) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space' || (e.altKey && e.code === 'KeyS')) {
        e.preventDefault();
        triggerAction();
      }
    };

    const handleGlobalClick = (e) => {
      if (isVoiceDisabled()) return;
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

  const triggerVoiceRegistration = async (targetField = 'firstName') => {
    if (isVoiceDisabled()) return;
    isManuallyClosedRef.current = false;
    stopRecognition();
    cancelSpeech();
    hasProcessedRef.current = false;
    setIsListening(true);
    setActiveVoiceField(targetField);
    setLiveTranscript('');

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      speak("Speech recognition is not supported in this browser. Please type your registration details.");
      setIsListening(false);
      return;
    }

    let promptMsg = "";
    if (targetField === 'firstName' || targetField === 'all') {
      promptMsg = "Step 1: Please speak your First Name now.";
    } else if (targetField === 'confirm_firstName') {
      promptMsg = `You entered First Name ${pendingFirstNameRef.current || firstName}. Is this correct? Say CONFIRM or NO.`;
    } else if (targetField === 'lastName') {
      promptMsg = "Step 2: Please speak your Last Name now.";
    } else if (targetField === 'confirm_lastName') {
      promptMsg = `You entered Last Name ${pendingLastNameRef.current || lastName}. Is this correct? Say CONFIRM or NO.`;
    } else if (targetField === 'phone') {
      promptMsg = "Step 3: Please speak your Phone Number now.";
    } else if (targetField === 'confirm_phone') {
      promptMsg = `You entered Phone Number ${pendingPhoneRef.current || phone}. Is this correct? Say CONFIRM or NO.`;
    } else if (targetField === 'email') {
      promptMsg = "Step 4: Please speak your Email Address now.";
    } else if (targetField === 'confirm_email') {
      promptMsg = `You entered Email Address ${formatSpokenEmail(pendingEmailRef.current || email)}. Is this correct? Say CONFIRM or NO.`;
    } else if (targetField === 'password') {
      promptMsg = "Step 5: Please speak your New Password now. Your password must contain only alphabets and numbers.";
    } else if (targetField === 'confirm_password_entry') {
      promptMsg = `You entered Password ${pendingPasswordRef.current || password}. Is this correct? Say CONFIRM or NO.`;
    } else if (targetField === 'confirmPassword') {
      promptMsg = "Step 6: Please speak Confirm Password now. It must match your password and contain only alphabets and numbers.";
    } else if (targetField === 'confirm_confirmPassword') {
      promptMsg = `You entered Confirm Password ${pendingConfirmPasswordRef.current || confirmPassword}. Is this correct? Say CONFIRM or NO.`;
    } else if (targetField === 'role') {
      promptMsg = "Please speak your role for registration: Student, Teacher, or Admin.";
    } else if (targetField === 'confirm_role') {
      promptMsg = `You selected ${pendingRoleRef.current || 'Student'} registration. Is this correct? Say CONFIRM or NO.`;
    } else if (targetField === 'confirm_go_to_login') {
      promptMsg = "Student registration successful! Would you like to proceed to the Student Login page now? Please say YES, LOGIN, or CONFIRM to go further, or say NO to stay on this screen.";
    }

    // Session guard: stale prompts / fallback timers from earlier steps must never start the mic
    const mySession = (window.__regVoiceSession = (window.__regVoiceSession || 0) + 1);
    const isStale = () => mySession !== window.__regVoiceSession || isManuallyClosedRef.current;
    const hasWord = (text, words) => words.some(w => new RegExp(`\\b${w}\\b`, 'i').test(text));
    const posWordsLive = ['yes', 'yeah', 'yep', 'ok', 'okay', 'confirm', 'confirmed', 'correct', 'right', 'proceed', 'sure', 'good'];
    const negWordsLive = ['no', 'nope', 'wrong', 'change', 'retry', 'edit', 'incorrect'];

    let micStarted = false;
    let finalText = '';
    let restartCount = 0;

    const startMic = () => {
      if (isStale()) return;
      try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = 'en-IN';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          if (isStale()) { try { recognition.abort(); } catch (e) {} return; }
          setIsListening(true);
        };

        recognition.onresult = (e) => {
          if (isStale() || hasProcessedRef.current) return;
          if (isTTSActive()) return; // ignore our own voice echo

          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const t = e.results[i][0].transcript;
            if (e.results[i].isFinal) finalText += ' ' + t;
            else interim += ' ' + t;
          }
          const rawText = (finalText + ' ' + interim).replace(/\s+/g, ' ').trim();
          if (!rawText) return;
          setLiveTranscript(rawText);

          if (targetField.startsWith('confirm_') && (hasWord(rawText, posWordsLive) || hasWord(rawText, negWordsLive))) {
            hasProcessedRef.current = true;
            stopRecognition();
            processVoiceResult(rawText, targetField);
            return;
          }

          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (hasProcessedRef.current || isStale()) return;
            hasProcessedRef.current = true;
            stopRecognition();
            processVoiceResult(rawText, targetField);
          }, 1800);
        };

        recognition.onerror = (e) => {
          console.warn('SpeechRecognition error:', e.error);
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            isManuallyClosedRef.current = true;
            speak("Microphone access is blocked. Please allow microphone permission in the browser and tap the screen again.");
          }
        };

        // Chrome stops listening after a few seconds of silence — restart so the user is always heard
        recognition.onend = () => {
          if (recognitionRef.current === recognition) recognitionRef.current = null;
          if (!isStale() && !hasProcessedRef.current && restartCount < 6) {
            restartCount++;
            setTimeout(startMic, 250);
            return;
          }
          if (!hasProcessedRef.current && !isStale()) {
            speak("I did not hear anything. Tap anywhere on the screen to try again.");
          }
          setIsListening(false);
        };

        recognition.start();
      } catch (err) {
        console.warn("Recognition start failed:", err);
        setIsListening(false);
      }
    };

    const startMicOnce = () => {
      if (micStarted || isStale()) return;
      micStarted = true;
      setTimeout(startMic, 350);
    };

    speak(promptMsg, startMicOnce);

    const fallbackDelay = Math.max(5000, promptMsg.length * 90);
    setTimeout(() => {
      if (!micStarted && !isStale() && !isTTSActive()) startMicOnce();
    }, fallbackDelay);
  };

  const processVoiceResult = (rawText, fieldKey) => {
    if (!rawText) return;
    const cleanText = rawText.toLowerCase().trim();

    const posWords = ['yes', 'yeah', 'yep', 'ok', 'okay', 'confirm', 'correct', 'right', 'sure', 'good'];
    const negWords = ['no', 'nope', 'wrong', 'change', 'retry', 'edit', 'incorrect'];

    // --- GLOBAL CLOSE VOICE OVERLAY TRIGGER ---
    const closeKeywords = ['close', 'exit', 'cancel', 'dismiss', 'close overlay', 'close assistant', 'stop'];
    if (closeKeywords.some(w => cleanText === w || cleanText.startsWith(w + ' ') || cleanText.endsWith(' ' + w))) {
      handleCloseVoiceOverlay();
      speak("Voice Assistant closed.");
      return;
    }

    // --- STEP 1: FIRST NAME ---
    if (fieldKey === 'firstName') {
      const val = rawText.charAt(0).toUpperCase() + rawText.slice(1);
      setFirstName(val);
      pendingFirstNameRef.current = val;
      triggerVoiceRegistration('confirm_firstName');
      return;
    }
    if (fieldKey === 'confirm_firstName') {
      if (posWords.some(w => cleanText.includes(w))) {
        triggerVoiceRegistration('lastName');
      } else {
        setFirstName('');
        pendingFirstNameRef.current = '';
        triggerVoiceRegistration('firstName');
      }
      return;
    }

    // --- STEP 2: LAST NAME ---
    if (fieldKey === 'lastName') {
      const val = rawText.charAt(0).toUpperCase() + rawText.slice(1);
      setLastName(val);
      pendingLastNameRef.current = val;
      triggerVoiceRegistration('confirm_lastName');
      return;
    }
    if (fieldKey === 'confirm_lastName') {
      if (posWords.some(w => cleanText.includes(w))) {
        triggerVoiceRegistration('phone');
      } else {
        setLastName('');
        pendingLastNameRef.current = '';
        triggerVoiceRegistration('lastName');
      }
      return;
    }

    // --- STEP 3: PHONE NUMBER ---
    if (fieldKey === 'phone') {
      const digits = cleanText.replace(/\D/g, '') || cleanText;
      setPhone(digits);
      pendingPhoneRef.current = digits;
      triggerVoiceRegistration('confirm_phone');
      return;
    }
    if (fieldKey === 'confirm_phone') {
      const phoneToCheck = (pendingPhoneRef.current || phone || '').replace(/\D/g, '');
      const PHONE_REGEX = /^[6-9]\d{9}$/;

      if (posWords.some(w => cleanText.includes(w))) {
        if (!PHONE_REGEX.test(phoneToCheck)) {
          speak("Invalid phone number. Phone number must start with 6 to 9 and contain exactly 10 digits. Please speak your phone number again.", () => {
            setTimeout(() => triggerVoiceRegistration('phone'), 300);
          });
          return;
        }
        triggerVoiceRegistration('email');
      } else {
        setPhone('');
        pendingPhoneRef.current = '';
        triggerVoiceRegistration('phone');
      }
      return;
    }

    // --- STEP 4: EMAIL ADDRESS ---
    if (fieldKey === 'email') {
      const parsedEmail = parseSpokenEmail(rawText);
      setEmail(parsedEmail);
      pendingEmailRef.current = parsedEmail;
      triggerVoiceRegistration('confirm_email');
      return;
    }
    if (fieldKey === 'confirm_email') {
      const emailToCheck = parseSpokenEmail(pendingEmailRef.current || email || '');
      const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;

      if (posWords.some(w => cleanText.includes(w))) {
        if (!GMAIL_REGEX.test(emailToCheck)) {
          speak("Invalid Gmail address. Email must end with @gmail.com with no trailing characters. Please speak your Gmail address again.", () => {
            setTimeout(() => triggerVoiceRegistration('email'), 300);
          });
          return;
        }
        setEmail(emailToCheck);
        pendingEmailRef.current = emailToCheck;
        setIsEmailVerified(false);
        setOtpSent(false);
        setOtpInput('');
        handleGetRegistrationOtp(emailToCheck);
        triggerVoiceRegistration('otp');
      } else {
        setEmail('');
        pendingEmailRef.current = '';
        triggerVoiceRegistration('email');
      }
      return;
    }

    // --- STEP 5: EMAIL OTP VERIFICATION ---
    if (fieldKey === 'otp') {
      const digits = rawText.replace(/\D/g, '');
      if (digits.length >= 4) {
        setOtpInput(digits);
        setIsVerifyingOtp(true);
        verifyRegistrationOtpApi(email.toLowerCase().trim(), digits).then(async (res) => {
          setIsVerifyingOtp(false);
          if (res && res.success) {
            setIsEmailVerified(true);
            setOtpMessage('✅ Email verified successfully!');
            if (registrationMethod === 'otp' || !password) {
              await completeStudentRegistration(phone.trim().replace(/\D/g, ''), null);
            } else {
              speak("Email verified successfully! Now speak your new password.", () => {
                setTimeout(() => triggerVoiceRegistration('password'), 400);
              });
            }
          } else {
            const err = res?.message || "Invalid OTP code.";
            setErrorMessage(err);
            speak(`${err} Please enter or speak your 6-digit OTP code again.`, () => {
              setTimeout(() => triggerVoiceRegistration('otp'), 400);
            });
          }
        }).catch(() => {
          setIsVerifyingOtp(false);
          speak("Verification error. Please enter your 6-digit OTP code.", () => {
            setTimeout(() => triggerVoiceRegistration('otp'), 400);
          });
        });
      } else {
        speak("Please speak the 6-digit OTP code sent to your email, or enter it manually.", () => {
          setTimeout(() => triggerVoiceRegistration('otp'), 400);
        });
      }
      return;
    }

    // --- STEP 5: NEW PASSWORD ---
    if (fieldKey === 'password') {
      const cleanPass = rawText.replace(/\s+/g, '');
      if (!/^[a-zA-Z0-9]+$/.test(cleanPass)) {
        speak("Password must contain only alphabets and numbers, with no spaces or special characters. Please speak your password again.", () => {
          setTimeout(() => triggerVoiceRegistration('password'), 400);
        });
        return;
      }
      setPassword(cleanPass);
      pendingPasswordRef.current = cleanPass;
      triggerVoiceRegistration('confirm_password_entry');
      return;
    }
    if (fieldKey === 'confirm_password_entry') {
      if (posWords.some(w => cleanText.includes(w))) {
        triggerVoiceRegistration('confirmPassword');
      } else {
        setPassword('');
        pendingPasswordRef.current = '';
        triggerVoiceRegistration('password');
      }
      return;
    }

    // --- STEP 6: CONFIRM PASSWORD ---
    if (fieldKey === 'confirmPassword') {
      const cleanPass = rawText.replace(/\s+/g, '');
      if (!/^[a-zA-Z0-9]+$/.test(cleanPass)) {
        speak("Confirm Password must contain only alphabets and numbers. Please speak your confirm password again.", () => {
          setTimeout(() => triggerVoiceRegistration('confirmPassword'), 400);
        });
        return;
      }
      setConfirmPassword(cleanPass);
      pendingConfirmPasswordRef.current = cleanPass;
      triggerVoiceRegistration('confirm_confirmPassword');
      return;
    }
    if (fieldKey === 'confirm_confirmPassword') {
      if (posWords.some(w => cleanText.includes(w))) {
        speak("All registration details confirmed! Submitting student registration now.", () => {
          setTimeout(() => handleSubmit(), 200);
        });
      } else {
        setConfirmPassword('');
        pendingConfirmPasswordRef.current = '';
        triggerVoiceRegistration('confirmPassword');
      }
      return;
    }

    // --- CONFIRMATION TO GO FURTHER AFTER REGISTRATION COMPLETION ---
    if (fieldKey === 'confirm_go_to_login') {
      const loginWords = ['yes', 'yeah', 'yep', 'ok', 'okay', 'confirm', 'correct', 'right', 'proceed', 'sure', 'good', 'login', 'go', 'continue', 'open', 'further'];
      const stayWords = ['no', 'nope', 'wrong', 'change', 'retry', 'edit', 'incorrect', 'stay', 'cancel', 'wait', 'stop'];

      if (loginWords.some(w => cleanText.includes(w))) {
        speak("Opening Student Login page now.", () => {
          setTimeout(() => {
            setShowSuccessPopup(false);
            navigate('/student-login');
          }, 350);
        });
      } else if (stayWords.some(w => cleanText.includes(w))) {
        speak("Staying on the registration screen. You can tap Proceed to Login or say YES whenever you are ready to proceed.", () => {
          setIsListening(false);
        });
      } else {
        speak("Please say YES or LOGIN to go to the login page, or say NO to stay.", () => {
          setTimeout(() => triggerVoiceRegistration('confirm_go_to_login'), 400);
        });
      }
      return;
    }
  };

  const handleTapScreenAnywhere = (e) => {
    if (isVoiceDisabled()) return;
    if (isListening) return;
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('a') || e.target.closest('form')) {
      return;
    }
    triggerVoiceRegistration('firstName');
  };

  const handleGetRegistrationOtp = async (targetEmail = null) => {
    setErrorMessage('');
    setOtpMessage('');
    const emailToUse = (targetEmail || email || '').toLowerCase().trim();
    const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    if (!emailToUse || !GMAIL_REGEX.test(emailToUse)) {
      const msg = 'Please enter a valid Gmail address ending with @gmail.com to receive an OTP.';
      setErrorMessage(msg);
      speak(msg);
      return;
    }

    setIsSendingOtp(true);
    speak('Sending 6-digit verification code to your email. Please wait.');
    try {
      const res = await sendRegistrationOtpApi(emailToUse);
      setIsSendingOtp(false);
      if (res && res.success) {
        setOtpSent(true);
        setOtpMessage(`📧 6-digit OTP sent to ${emailToUse}. Check your inbox.`);
        speak(`OTP code sent to your email address ${formatSpokenEmail(emailToUse)}. Please enter the 6-digit code and tap Verify OTP.`);
      } else {
        const msg = res?.message || 'Failed to send OTP to email.';
        setErrorMessage(msg);
        speak(msg);
      }
    } catch (err) {
      setIsSendingOtp(false);
      setErrorMessage('Server error while sending OTP.');
      speak('Server error while sending OTP.');
    }
  };

  const completeStudentRegistration = async (cleanPhone, passwordToUse = null) => {
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const cleanEmail = email.toLowerCase().trim();
    const phoneToUse = cleanPhone || phone.trim().replace(/\D/g, '') || "9876543210";

    try {
      const regPayload = {
        username: fullName,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: cleanEmail,
        phone: phoneToUse,
        role: 'student',
        isOtpVerified: true,
        registrationMethod: registrationMethod
      };
      if (passwordToUse) {
        regPayload.password = passwordToUse;
      }

      const res = await registerUser(regPayload);
      if (res && res.success) {
        try {
          // Ensure newly registered student starts with zero exams and zero certificates
          const prevCompleted = JSON.parse(localStorage.getItem('student_completed_results') || '[]');
          localStorage.setItem('student_completed_results', JSON.stringify(prevCompleted.filter(r => (r.studentEmail || r.email || '').toLowerCase().trim() !== cleanEmail.toLowerCase())));
          const prevShared = JSON.parse(localStorage.getItem('shared_student_results') || '[]');
          localStorage.setItem('shared_student_results', JSON.stringify(prevShared.filter(r => (r.studentEmail || r.email || '').toLowerCase().trim() !== cleanEmail.toLowerCase())));
        } catch (e) {}
        const savedPic = res.user?.profilePic || localStorage.getItem('student_profile_pic') || null;
        localStorage.setItem('auth_session', JSON.stringify({ 
          email: res.user?.email || cleanEmail, 
          role: 'student', 
          name: fullName,
          profilePic: savedPic,
          phone: phoneToUse,
          studentId: res.user?.studentId || res.user?.registerNumber || '',
          registerNumber: res.user?.registerNumber || res.user?.studentId || ''
        }));

        setShowSuccessPopup(true);
        speak("Student registration successful! Navigating to Student Login page.", () => {
          setTimeout(() => {
            setShowSuccessPopup(false);
            cancelSpeech();
            navigate('/student-login', { state: { email: cleanEmail, method: registrationMethod === 'otp' ? 'otp' : 'password' } });
          }, 1200);
        });

        // Fast fallback timer to ensure navigation to login page
        setTimeout(() => {
          setShowSuccessPopup(false);
          cancelSpeech();
          navigate('/student-login', { state: { email: cleanEmail, method: registrationMethod === 'otp' ? 'otp' : 'password' } });
        }, 2200);
      } else {
        const msg = res?.message || 'Student registration failed.';
        setErrorMessage(msg);
        speak(msg);
      }
    } catch (err) {
      setErrorMessage('Registration failed.');
      speak('Registration failed.');
    }
  };

  const handleVerifyRegistrationOtp = async () => {
    setErrorMessage('');
    const cleanOtp = otpInput.trim().replace(/\D/g, '');
    if (!cleanOtp || cleanOtp.length !== 6) {
      const msg = 'Please enter the 6-digit OTP code received in your email.';
      setErrorMessage(msg);
      speak(msg);
      return;
    }

    if (!firstName.trim()) {
      const msg = 'Please enter your First Name before verifying.';
      setErrorMessage(msg);
      speak(msg);
      return;
    }
    if (!lastName.trim()) {
      const msg = 'Please enter your Last Name before verifying.';
      setErrorMessage(msg);
      speak(msg);
      return;
    }
    const cleanPhone = phone.trim().replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      const msg = 'Please enter a valid 10-digit phone number starting with 6, 7, 8, or 9.';
      setErrorMessage(msg);
      speak(msg);
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const res = await verifyRegistrationOtpApi(email.toLowerCase().trim(), cleanOtp);
      setIsVerifyingOtp(false);
      if (res && res.success) {
        setIsEmailVerified(true);
        setOtpMessage('✅ Email verified successfully!');

        // If in OTP registration mode or no password entered, register immediately and go to login page!
        if (registrationMethod === 'otp' || !password) {
          await completeStudentRegistration(cleanPhone, password || null);
        } else {
          speak('Email verified successfully! You can now submit your registration.');
        }
      } else {
        const msg = res?.message || 'Invalid or expired OTP code.';
        setErrorMessage(msg);
        speak(msg);
      }
    } catch (err) {
      setIsVerifyingOtp(false);
      setErrorMessage('Verification failed. Server error.');
      speak('Verification failed.');
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');

    if (!firstName.trim()) {
      setErrorMessage('First Name is required.');
      speak("Please speak your First Name.", () => {
        setTimeout(() => triggerVoiceRegistration('firstName'), 400);
      });
      return;
    }
    if (!lastName.trim()) {
      setErrorMessage('Last Name is required.');
      speak("Please speak your Last Name.", () => {
        setTimeout(() => triggerVoiceRegistration('lastName'), 400);
      });
      return;
    }
    const cleanPhone = phone.trim().replace(/\D/g, '');
    const PHONE_REGEX = /^[6-9]\d{9}$/;
    if (!PHONE_REGEX.test(cleanPhone)) {
      setErrorMessage('Invalid phone number. Number must start with 6, 7, 8, or 9 and contain exactly 10 digits.');
      speak("Invalid phone number. Number must start with 6 to 9 and contain exactly 10 digits.", () => {
        setTimeout(() => triggerVoiceRegistration('phone'), 400);
      });
      return;
    }

    const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    if (!email || !GMAIL_REGEX.test(email.trim())) {
      setErrorMessage('Invalid Gmail address. Email must end with @gmail.com with no trailing characters.');
      speak("Invalid Gmail address. Email must end with @gmail.com with no trailing characters.", () => {
        setTimeout(() => triggerVoiceRegistration('email'), 400);
      });
      return;
    }

    // OTP REGISTRATION FLOW
    if (registrationMethod === 'otp') {
      if (isEmailVerified) {
        await completeStudentRegistration(cleanPhone, null);
        return;
      }
      if (otpInput.trim().length === 6) {
        await handleVerifyRegistrationOtp();
        return;
      }
      if (!otpSent) {
        await handleGetRegistrationOtp();
        return;
      }
      setErrorMessage('Please enter the 6-digit OTP code sent to your email.');
      speak('Please enter the 6-digit OTP code sent to your email.');
      return;
    }

    // PASSWORD REGISTRATION FLOW
    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      speak("Password must be at least 6 characters long.", () => {
        setTimeout(() => triggerVoiceRegistration('password'), 400);
      });
      return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(password)) {
      setErrorMessage('Password must contain only alphabets and numbers (no special characters).');
      speak("Password must contain only alphabets and numbers. Special characters are not allowed.", () => {
        setTimeout(() => triggerVoiceRegistration('password'), 400);
      });
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      speak("Passwords do not match. Please re-enter passwords.", () => {
        setTimeout(() => triggerVoiceRegistration('confirmPassword'), 400);
      });
      return;
    }

    await completeStudentRegistration(cleanPhone, password);
  };

  const handleModalClose = () => {
    setShowSuccessPopup(false);
    cancelSpeech();
    navigate('/student-login', { state: { email: email.toLowerCase().trim() } });
  };

  return (
    <div
      onClick={handleTapScreenAnywhere}
      style={{
        minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center', padding: '24px 16px', boxSizing: 'border-box',
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
            background: '#ffffff', width: '90%', maxWidth: '580px', padding: '36px 40px', borderRadius: '28px',
            border: '4px solid #0284c7', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            boxSizing: 'border-box'
          }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#e0f2fe', display: 'grid', placeItems: 'center', margin: '0 auto 16px auto', border: '4px solid #0284c7' }}>
              <Mic size={44} color="#0284c7" style={{ animation: 'pulse 1.2s infinite' }} />
            </div>

            <h2 style={{ fontSize: '24px', color: '#0284c7', margin: '0 0 12px 0', fontWeight: '900' }}>
              🎙️ Voice Assistant Active & Listening!
            </h2>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#e0f2fe', color: '#0284c7', padding: '6px 14px', borderRadius: '16px', fontSize: '13px', fontWeight: '800', marginBottom: '14px' }}>
              {activeVoiceField === 'role' ? '🗣️ Step 1: Speak Role (Student, Teacher, Admin)' :
               activeVoiceField === 'confirm_role' ? `🗣️ Selected ${pendingRoleRef.current || 'Student'} role — Say CONFIRM or NO` :
               activeVoiceField === 'firstName' ? '🗣️ Step 2: Speak First Name' :
               activeVoiceField === 'confirm_firstName' ? `🗣️ First Name: ${pendingFirstNameRef.current || firstName} — Say CONFIRM or NO` :
               activeVoiceField === 'lastName' ? '🗣️ Step 3: Speak Last Name' :
               activeVoiceField === 'confirm_lastName' ? `🗣️ Last Name: ${pendingLastNameRef.current || lastName} — Say CONFIRM or NO` :
               activeVoiceField === 'phone' ? '🗣️ Step 4: Speak Phone Number' :
               activeVoiceField === 'confirm_phone' ? `🗣️ Phone: ${pendingPhoneRef.current || phone} — Say CONFIRM or NO` :
               activeVoiceField === 'email' ? '🗣️ Step 5: Speak Email Address' :
               activeVoiceField === 'confirm_email' ? `🗣️ Email: ${pendingEmailRef.current || email} — Say CONFIRM or NO` :
               activeVoiceField === 'otp' ? `🗣️ Step 6: Speak or Enter 6-Digit Email OTP (${otpInput || 'Waiting'})` :
               activeVoiceField === 'password' ? '🗣️ Step 7: Speak New Password' :
               activeVoiceField === 'confirm_password_entry' ? `🗣️ Password: ${pendingPasswordRef.current || password} — Say CONFIRM or NO` :
               activeVoiceField === 'confirmPassword' ? '🗣️ Step 8: Speak Confirm Password' :
               activeVoiceField === 'confirm_confirmPassword' ? `🗣️ Confirm Password: ${pendingConfirmPasswordRef.current || confirmPassword} — Say CONFIRM or NO` :
               activeVoiceField === 'confirm_go_to_login' ? `🎉 Registration Complete: Say YES or LOGIN to Proceed, or NO to Stay` :
               '🎙️ Listening for Voice Input'}
            </div>
            
            {/* Live Real-time Speech Transcript Display */}
            <div style={{ background: '#f0f9ff', border: '2px dashed #0284c7', padding: '20px 16px', borderRadius: '20px', margin: '12px 0 20px 0', minHeight: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ margin: 0, fontSize: '17px', color: liveTranscript ? '#0f172a' : '#0284c7', fontWeight: '800', textAlign: 'center', lineHeight: 1.5, wordBreak: 'break-word' }}>
                {liveTranscript ? `"${liveTranscript}"` : (
                  activeVoiceField === 'confirm_go_to_login' ? '🗣️ Say YES, LOGIN, or CONFIRM to proceed to the Student Login page, or say NO to stay.' :
                  '🎙️ Listening... Speak your response clearly.'
                )}
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '18px' }}>
              {activeVoiceField === 'confirm_go_to_login' ? (
                <>
                  <button 
                    type="button"
                    onClick={() => { setIsListening(false); cancelSpeech(); navigate('/student-login'); }}
                    style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)' }}
                  >
                    🚀 Proceed to Student Login (Say YES)
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setIsListening(false); cancelSpeech(); speak("Staying on registration screen."); }}
                    style={{ background: '#64748b', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: '800', cursor: 'pointer' }}
                  >
                    ✖ Stay on Registration Screen (Say NO)
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => { setFirstName('Priya'); setLastName('Sharma'); setEmail('priya@gmail.com'); setPhone('9876543210'); setPassword('Priya123'); setConfirmPassword('Priya123'); speak("Filled demo registration details."); }}
                    style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                  >
                    👤 Fill Demo Details
                  </button>
                  <button 
                    onClick={() => { setIsListening(false); handleSubmit(); }}
                    style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                  >
                    ⚡ Submit Registration
                  </button>
                </>
              )}
            </div>

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

      {/* REGISTRATION CARD */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '520px', background: '#ffffff', border: '2px solid #0284c7',
          padding: '36px 32px', borderRadius: '24px', boxShadow: '0 20px 40px -15px rgba(0,0,0,0.08)', boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '16px' }}>
          <ProjectLogo size="large" />
          <h1 style={{ fontSize: '22px', color: '#0369a1', margin: '8px 0 2px 0', fontWeight: '900' }}>
            🎓 Student Account Registration
          </h1>
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0, fontWeight: '600' }}>
            Full Voice Dictation & Typed Control for Blind Accessibility
          </p>
        </div>

        {/* Master Voice Assistant Enable / Disable Toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <button
            type="button"
            onClick={toggleVoiceAssistant}
            style={{
              background: isVoiceEnabled ? '#ecfdf5' : '#fef2f2',
              color: isVoiceEnabled ? '#047857' : '#b91c1c',
              border: isVoiceEnabled ? '2px solid #a7f3d0' : '2px solid #fecaca',
              padding: '10px 20px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: isVoiceEnabled ? '0 2px 8px rgba(16, 185, 129, 0.15)' : '0 2px 8px rgba(239, 68, 68, 0.15)',
              transition: 'all 0.2s ease'
            }}
            title={isVoiceEnabled ? 'Click to Disable Voice Assistant' : 'Click to Enable Voice Assistant'}
          >
            {isVoiceEnabled ? <Volume2 size={16} color="#059669" /> : <VolumeX size={16} color="#b91c1c" />}
            <span>{isVoiceEnabled ? '🟢 Voice: Enabled' : '🔴 Voice: Disabled'}</span>
          </button>
        </div>

        {/* Voice Assistant Banner */}
        <div 
          onClick={() => {
            if (!isVoiceEnabled) {
              toggleVoiceAssistant();
              return;
            }
            triggerVoiceRegistration('all');
          }}
          style={{
            padding: '12px 16px', borderRadius: '14px', 
            background: isVoiceEnabled ? '#f0f9ff' : '#fef2f2',
            border: isVoiceEnabled ? '1px solid #0284c7' : '1px solid #fca5a5', 
            marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: isVoiceEnabled ? '#0284c7' : '#ef4444', padding: '8px', borderRadius: '50%', color: '#ffffff' }}>
              {isVoiceEnabled ? <Mic size={18} /> : <VolumeX size={18} />}
            </div>
            <div>
              <b style={{ fontSize: '13px', color: isVoiceEnabled ? '#0284c7' : '#b91c1c', display: 'block' }}>
                {isVoiceEnabled ? 'Tap Screen Anywhere to Activate Voice' : 'Voice Assistant Disabled — Tap to Enable'}
              </b>
              <small style={{ fontSize: '11px', color: isVoiceEnabled ? '#64748b' : '#ef4444' }}>
                {isVoiceEnabled ? 'Step-by-step guided registration & voice confirmation' : 'Click here or toggle above to re-enable voice'}
              </small>
            </div>
          </div>
          {isVoiceEnabled && <Sparkles size={18} color="#0284c7" />}
        </div>

        {errorMessage && (
          <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '14px', textAlign: 'center', fontWeight: '700', background: '#fef2f2', padding: '10px', borderRadius: '10px', border: '1px solid #fca5a5' }}>
            ⚠️ {errorMessage}
          </div>
        )}

        {/* REGISTRATION METHOD TOGGLE: OTP VS PASSWORD */}
        <div style={{ display: 'flex', background: '#e0f2fe', padding: '4px', borderRadius: '14px', marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => {
              setRegistrationMethod('otp');
              setErrorMessage('');
              cancelSpeech();
              speak("Switched to Register via Email OTP.");
            }}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '10px',
              border: 'none',
              fontWeight: '800',
              fontSize: '13px',
              cursor: 'pointer',
              backgroundColor: registrationMethod === 'otp' ? '#0284c7' : 'transparent',
              color: registrationMethod === 'otp' ? '#ffffff' : '#0369a1',
              boxShadow: registrationMethod === 'otp' ? '0 2px 8px rgba(2, 132, 199, 0.3)' : 'none',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Mail size={15} /> Register via Email OTP
          </button>
          <button
            type="button"
            onClick={() => {
              setRegistrationMethod('password');
              setErrorMessage('');
              cancelSpeech();
              speak("Switched to Register with Password.");
            }}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '10px',
              border: 'none',
              fontWeight: '800',
              fontSize: '13px',
              cursor: 'pointer',
              backgroundColor: registrationMethod === 'password' ? '#0284c7' : 'transparent',
              color: registrationMethod === 'password' ? '#ffffff' : '#0369a1',
              boxShadow: registrationMethod === 'password' ? '0 2px 8px rgba(2, 132, 199, 0.3)' : 'none',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Lock size={15} /> Register with Password
          </button>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Hidden inputs to absorb browser autofill */}
          <input type="text" style={{ display: 'none' }} tabIndex="-1" autoComplete="off" />
          <input type="password" style={{ display: 'none' }} tabIndex="-1" autoComplete="new-password" />
          
          {/* FIRST NAME & LAST NAME */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', color: '#0369a1', fontWeight: '800' }}>First Name</label>
                <button 
                  type="button" 
                  onClick={() => triggerVoiceRegistration('firstName')}
                  style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #0284c7', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: '800', cursor: 'pointer' }}
                >
                  <Mic size={10} /> Speak
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <User size={18} color="#0284c7" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="text" name="student_reg_first_name" autoComplete="off" placeholder="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} style={{ ...inputStyle, border: '1px solid #0284c7' }} required />
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', color: '#0369a1', fontWeight: '800' }}>Last Name</label>
                <button 
                  type="button" 
                  onClick={() => triggerVoiceRegistration('lastName')}
                  style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #0284c7', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: '800', cursor: 'pointer' }}
                >
                  <Mic size={10} /> Speak
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <User size={18} color="#0284c7" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="text" name="student_reg_last_name" autoComplete="off" placeholder="Last Name" value={lastName} onChange={e => setLastName(e.target.value)} style={{ ...inputStyle, border: '1px solid #0284c7' }} required />
              </div>
            </div>
          </div>

          {/* PHONE NUMBER */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', color: '#0369a1', fontWeight: '800' }}>Phone Number</label>
              <button 
                type="button" 
                onClick={() => triggerVoiceRegistration('phone')}
                style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #0284c7', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Mic size={12} /> Speak Phone
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <Phone size={18} color="#0284c7" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input type="tel" name="student_reg_phone" autoComplete="off" placeholder="+91 9876543210" value={phone} onChange={e => setPhone(e.target.value)} style={{ ...inputStyle, border: '1px solid #0284c7' }} required />
            </div>
          </div>

          {/* EMAIL ADDRESS & OTP AUTHENTICATION */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', color: '#0369a1', fontWeight: '800' }}>
                Email Address {isEmailVerified ? <span style={{ color: '#16a34a', fontWeight: '900' }}>✓ (Verified)</span> : <span style={{ color: '#ef4444', fontWeight: '700' }}>* (Verification Required)</span>}
              </label>
              <button 
                type="button" 
                onClick={() => triggerVoiceRegistration('email')}
                style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #0284c7', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Mic size={12} /> Speak Email
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Mail size={18} color="#0284c7" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="email" 
                  name="student_reg_email" 
                  autoComplete="off" 
                  placeholder="user@gmail.com" 
                  value={email} 
                  onChange={e => {
                    setEmail(e.target.value);
                    setIsEmailVerified(false);
                    setOtpSent(false);
                    setOtpInput('');
                    setOtpMessage('');
                  }} 
                  style={{ ...inputStyle, border: isEmailVerified ? '2px solid #22c55e' : '1px solid #0284c7' }} 
                  required 
                />
              </div>

              {!isEmailVerified && (
                <button
                  type="button"
                  onClick={() => handleGetRegistrationOtp()}
                  disabled={isSendingOtp}
                  style={{
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '0 16px',
                    fontWeight: '800',
                    fontSize: '13px',
                    cursor: isSendingOtp ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)'
                  }}
                >
                  {isSendingOtp ? 'Sending...' : (otpSent ? 'Resend OTP' : 'Get OTP')}
                </button>
              )}
            </div>

            {/* OTP Status Feedback */}
            {otpMessage && (
              <div style={{ fontSize: '12px', color: isEmailVerified ? '#16a34a' : '#0369a1', fontWeight: '700', marginTop: '6px' }}>
                {otpMessage}
              </div>
            )}

            {/* OTP Input & Verification Section */}
            {otpSent && !isEmailVerified && (
              <div style={{ marginTop: '10px', background: '#f0f9ff', padding: '12px', borderRadius: '12px', border: '1px dashed #0284c7' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', color: '#0369a1', fontWeight: '800' }}>
                    Enter 6-Digit Email OTP
                  </label>
                  <button 
                    type="button" 
                    onClick={() => triggerVoiceRegistration('otp')}
                    style={{ background: '#ffffff', color: '#0284c7', border: '1px solid #0284c7', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: '800', cursor: 'pointer' }}
                  >
                    <Mic size={10} /> Speak OTP
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="e.g. 123456"
                    value={otpInput}
                    onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '10px',
                      fontSize: '16px',
                      fontWeight: '800',
                      letterSpacing: '4px',
                      textAlign: 'center',
                      border: '2px solid #0284c7',
                      outline: 'none',
                      backgroundColor: '#ffffff'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyRegistrationOtp}
                    disabled={isVerifyingOtp}
                    style={{
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '0 16px',
                      fontWeight: '800',
                      fontSize: '13px',
                      cursor: isVerifyingOtp ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isVerifyingOtp ? 'Verifying...' : (registrationMethod === 'otp' ? 'Verify OTP & Register 🚀' : 'Verify OTP')}
                  </button>
                </div>
              </div>
            )}

            {isEmailVerified && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', color: '#16a34a', fontSize: '12px', fontWeight: '800' }}>
                <CheckCircle size={16} /> Student Email Verified via OTP
              </div>
            )}
          </div>

          {/* NEW PASSWORD & CONFIRM PASSWORD - SHOWN ONLY IN PASSWORD REGISTRATION MODE */}
          {registrationMethod === 'password' && (
            <>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 12px', fontSize: '12px', color: '#1e40af', fontWeight: '600', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ fontSize: '15px', lineHeight: '1.2' }}>ℹ️</span>
                <div style={{ lineHeight: '1.4' }}>
                  <strong style={{ color: '#1d4ed8' }}>Password Rule:</strong> Must contain <strong>only alphabets (A-Z, a-z) and numbers (0-9)</strong>. No special characters or symbols are allowed.
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', color: '#0369a1', fontWeight: '800' }}>New Password (alphabets & numbers only)</label>
                  <button 
                    type="button" 
                    onClick={() => triggerVoiceRegistration('password')}
                    style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #0284c7', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Mic size={12} /> Speak Password
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} color="#0284c7" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    name="student_reg_password" 
                    autoComplete="new-password" 
                    placeholder="New Password (alphabets & numbers only, min 6 chars)" 
                    value={password} 
                    onChange={e => {
                      const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
                      setPassword(val);
                    }} 
                    style={{ ...inputStyle, paddingRight: '44px', border: '1px solid #0284c7' }} 
                    required={registrationMethod === 'password'} 
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <small style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>Only letters (A-Z, a-z) and numbers (0-9) are accepted.</small>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', color: '#0369a1', fontWeight: '800' }}>Confirm Password</label>
                  <button 
                    type="button" 
                    onClick={() => triggerVoiceRegistration('confirmPassword')}
                    style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #0284c7', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Mic size={12} /> Speak Confirm Password
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} color="#0284c7" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    name="student_reg_confirm_password" 
                    autoComplete="new-password" 
                    placeholder="Confirm Password (alphabets & numbers only)" 
                    value={confirmPassword} 
                    onChange={e => {
                      const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
                      setConfirmPassword(val);
                    }} 
                    style={{ ...inputStyle, paddingRight: '44px', border: '1px solid #0284c7' }} 
                    required={registrationMethod === 'password'} 
                  />
                </div>
              </div>
            </>
          )}

          <button type="submit" style={{ width: '100%', padding: '14px', borderRadius: '12px', backgroundColor: '#0284c7', color: '#ffffff', fontWeight: '800', fontSize: '15px', border: 'none', cursor: 'pointer', marginTop: '6px', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)' }}>
            {registrationMethod === 'otp'
              ? (isEmailVerified 
                  ? 'Registration Verified! Proceeding to Login →' 
                  : (otpSent ? 'Verify OTP & Complete Registration 🚀' : '📩 Get OTP & Register as Student'))
              : 'Register Account with Password 🚀'}
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
            <Link to="/student-login" style={{ fontSize: '13px', color: '#0284c7', textDecoration: 'none', fontWeight: '700' }}>
              Already registered? Go to Login →
            </Link>
          </div>
        </form>
      </div>

      {showSuccessPopup && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2, 132, 199, 0.35)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#ffffff', border: '2px solid #0284c7', padding: '32px', borderRadius: '24px', textAlign: 'center', maxWidth: '400px', width: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <CheckCircle size={52} color="#22c55e" style={{ marginBottom: '14px' }} />
            <h2 style={{ fontSize: '22px', color: '#0f172a', marginBottom: '8px', fontWeight: '900' }}>Registration Complete!</h2>
            <p style={{ fontSize: '14px', color: '#334155', marginBottom: '16px' }}>Your Student account has been created successfully.</p>
            
            <div style={{ background: '#f0f9ff', border: '2px dashed #0284c7', padding: '12px 16px', borderRadius: '14px', marginBottom: '20px' }}>
              <p style={{ fontSize: '13px', color: '#0369a1', fontWeight: '800', margin: 0 }}>
                🎙️ Voice Confirmation Active:<br/>
                Say <strong>"YES"</strong> or <strong>"LOGIN"</strong> to proceed,<br/>
                or say <strong>"NO"</strong> to stay.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                type="button" 
                onClick={handleModalClose} 
                style={{ width: '100%', padding: '14px', borderRadius: '12px', backgroundColor: '#0284c7', color: '#fff', border: 'none', fontWeight: '800', fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)' }}
              >
                🚀 Proceed to Student Login (Say YES)
              </button>
              <button 
                type="button" 
                onClick={() => { setShowSuccessPopup(false); cancelSpeech(); stopRecognition(); }} 
                style={{ width: '100%', padding: '10px', borderRadius: '10px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
              >
                ✖ Stay on Registration Screen (Say NO)
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
  padding: '12px 12px 12px 42px',
  borderRadius: '12px',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
  backgroundColor: '#ffffff',
  color: '#0f172a',
};
