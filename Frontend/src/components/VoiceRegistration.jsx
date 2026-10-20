import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, CheckCircle, Mic, Lock, Mail, User, Phone, Key } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { speakIn, cancelSpeech } from './speech';
import ProjectLogo from './ProjectLogo.jsx';

const BASE_SYMBOLS = [
  [/\b(at the rate of|at sign|at)\b/g, '@'],
  [/\b(dot|point|period)\b/g, '.'],
  [/\b(underscore)\b/g, '_'],
  [/\b(dash|hyphen)\b/g, '-'],
];

const inputStyle = {
  width: '100%',
  padding: '12px 12px 12px 40px',
  borderRadius: '12px',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
  backgroundColor: '#ffffff',
  color: '#0f172a',
  border: '1px solid #bae6fd',
};

export default function VoiceRegistrationPage() {
  const navigate = useNavigate();

  const [role, setRole] = useState('student');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adminSecretKey, setAdminSecretKey] = useState('');

  useEffect(() => {
    setFirstName('');
    setLastName('');
    setPhone('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setAdminSecretKey('');
    const clearTimer = setTimeout(() => {
      setFirstName('');
      setLastName('');
      setPhone('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setAdminSecretKey('');
    }, 150);
    return () => clearTimeout(clearTimer);
  }, []);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [activeField, setActiveField] = useState(null);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const firstNameRefInput = useRef(null);
  const lastNameRefInput = useRef(null);
  const phoneRefInput = useRef(null);
  const emailRefInput = useRef(null);
  const passwordRefInput = useRef(null);
  const confirmPasswordRefInput = useRef(null);

  const roleRef = useRef('student');
  const firstNameRef = useRef('');
  const lastNameRef = useRef('');
  const phoneRef = useRef('');
  const emailRef = useRef('');
  const passwordRef = useRef('');
  const confirmPasswordRef = useRef('');

  const recognitionRef = useRef(null);
  const pendingStepRef = useRef(null);

  const strings = {
    welcome: 'Welcome to VisionAssist Registration. Accessible voice guide ready. Let us create your account.',
    rolePrompt: 'Please speak your role: Student, Teacher, or Admin.',
    firstNamePrompt: 'Role set. Please speak your first name.',
    lastNamePrompt: 'First name saved. Please speak your last name.',
    phonePrompt: 'Last name saved. Please speak your phone number.',
    emailPrompt: 'Phone number saved. Please speak your email address.',
    passwordPrompt: 'Email saved. Please speak your password.',
    confirmPasswordPrompt: 'Password saved. Please confirm your password.',
    emptyRole: "You didn't say your role. Please speak Student, Teacher, or Admin.",
    emptyFirstName: "You didn't say your full name. Please speak your first name.",
    emptyPhone: "You didn't say your phone number. Please speak your phone number.",
    invalidPhone: 'Invalid phone number. Phone number must start with 6, 7, 8, or 9.',
    emptyEmail: "You didn't say your email. Please speak your email address.",
    emptyPassword: "You didn't say your password. Please speak your password.",
    invalidPassword: 'Password must be at least 8 characters long.',
    passwordMismatch: 'Passwords do not match. Please re-enter your password.',
    success: (roleName) => `Registration successful as ${roleName}. Say Confirm to proceed to login.`,
  };

  const rolesDisplay = { student: 'Student', teacher: 'Teacher', admin: 'Admin' };
  const roleWords = {
    student: ['student', 'learner', 'pupil'],
    teacher: ['teacher', 'faculty', 'professor'],
    admin: ['admin', 'administrator', 'system admin']
  };

  const stopRecognition = () => {
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
    if (field === 'firstName') { setFirstName(val); firstNameRef.current = val; }
    if (field === 'lastName') { setLastName(val); lastNameRef.current = val; }
    if (field === 'phone') { setPhone(val); phoneRef.current = val; }
    if (field === 'email') { setEmail(val); emailRef.current = val; }
    if (field === 'password') { setPassword(val); passwordRef.current = val; }
    if (field === 'confirmPassword') { setConfirmPassword(val); confirmPasswordRef.current = val; }
  };

  const handleTapToStart = () => {
    if (showSuccessPopup) return;
    speak(strings.welcome, () => startGuidedFlow('role'));
  };

  const startGuidedFlow = (step) => {
    setActiveField(step);

    if (step === 'role') {
      speak(strings.rolePrompt, () => listenForInput('role'));
    } else if (step === 'firstName') {
      firstNameRefInput.current?.focus();
      speak(strings.firstNamePrompt, () => listenForInput('firstName'));
    } else if (step === 'lastName') {
      lastNameRefInput.current?.focus();
      speak(strings.lastNamePrompt, () => listenForInput('lastName'));
    } else if (step === 'phone') {
      phoneRefInput.current?.focus();
      speak(strings.phonePrompt, () => listenForInput('phone'));
    } else if (step === 'email') {
      emailRefInput.current?.focus();
      speak(strings.emailPrompt, () => listenForInput('email'));
    } else if (step === 'password') {
      passwordRefInput.current?.focus();
      speak(strings.passwordPrompt, () => listenForInput('password'));
    } else if (step === 'confirmPassword') {
      confirmPasswordRefInput.current?.focus();
      speak(strings.confirmPasswordPrompt, () => listenForInput('confirmPassword'));
    }
  };

  const confirmFieldValue = (fieldKey, displayVal, nextStep) => {
    pendingStepRef.current = { fieldKey, nextStep };
    speak(`You entered ${displayVal}. Is this correct? Say yes or no.`, () => {
      setTimeout(() => listenForConfirmationYesNo(), 200);
    });
  };

  const listenForConfirmationYesNo = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    stopRecognition();
    cancelSpeech();
    setIsListening(true);
    setLiveTranscript('');

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    let hasProcessed = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      const lower = text.toLowerCase().trim();
      setLiveTranscript(lower);

      const posWords = ['yes', 'yeah', 'yep', 'ok', 'okay', 'confirm', 'correct', 'right', 'proceed', 'sure', 'go ahead', 'accept', 'true', 'fine', 'good'];
      const negWords = ['no', 'nope', 'wrong', 'change', 'retry', 'edit', 'reenter', 're-enter', 'incorrect', 'false', 'cancel'];

      const isYes = posWords.some(w => lower.includes(w));
      const isNo = negWords.some(w => lower.includes(w));

      if (!hasProcessed && (isYes || isNo || e.results[e.results.length - 1].isFinal)) {
        hasProcessed = true;
        stopRecognition();
        setIsListening(false);

        if (isYes) {
          const next = pendingStepRef.current?.nextStep;
          if (next === 'submit') {
            validateAndSubmit();
          } else if (next) {
            startGuidedFlow(next);
          }
        } else if (isNo) {
          const fieldToRetry = pendingStepRef.current?.fieldKey;
          if (fieldToRetry) {
            updateField(fieldToRetry, '');
            speak(`Let's re-enter. Please speak again.`, () => startGuidedFlow(fieldToRetry));
          }
        } else {
          speak(`Please say yes or no to confirm.`, () => listenForConfirmationYesNo());
        }
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    try { recognition.start(); } catch (e) {}
  };

  const formatSpeech = (transcript, targetField) => {
    let clean = transcript.trim();

    if (targetField === 'email') {
      clean = clean.toLowerCase();
      BASE_SYMBOLS.forEach(([re, rep]) => {
        clean = clean.replace(re, rep);
      });
      clean = clean.replace(/\s+/g, '');
    } else if (targetField === 'phone') {
      clean = clean.replace(/\D/g, '');
    } else if (targetField === 'password' || targetField === 'confirmPassword') {
      clean = clean.replace(/\s+/g, '');
    }
    return clean;
  };

  const listenForInput = (targetField) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    stopRecognition();

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (e) => {
      const rawTranscript = e.results[0][0].transcript;
      const lower = rawTranscript.toLowerCase().trim();

      if (targetField === 'role') {
        let chosenRole = 'student';
        if (roleWords.teacher.some(w => lower.includes(w))) chosenRole = 'teacher';
        else if (roleWords.admin.some(w => lower.includes(w))) chosenRole = 'admin';

        updateRole(chosenRole);
        confirmFieldValue('role', rolesDisplay[chosenRole], 'firstName');
      } else if (targetField === 'firstName') {
        const val = rawTranscript.trim();
        updateField('firstName', val);
        confirmFieldValue('firstName', val, 'lastName');
      } else if (targetField === 'lastName') {
        const val = rawTranscript.trim();
        updateField('lastName', val);
        confirmFieldValue('lastName', val, 'phone');
      } else if (targetField === 'phone') {
        const formattedPhone = formatSpeech(rawTranscript, 'phone');
        updateField('phone', formattedPhone);
        if (/^[1-5]/.test(formattedPhone)) {
          setErrorMessage('Invalid phone number. Must start with 6, 7, 8, or 9.');
          speak(strings.invalidPhone, () => startGuidedFlow('phone'));
          return;
        }
        confirmFieldValue('phone', formattedPhone, 'email');
      } else if (targetField === 'email') {
        const formattedEmail = formatSpeech(rawTranscript, 'email');
        updateField('email', formattedEmail);
        confirmFieldValue('email', formattedEmail, 'password');
      } else if (targetField === 'password') {
        const formattedPwd = formatSpeech(rawTranscript, 'password');
        updateField('password', formattedPwd);

        if (formattedPwd.length < 8) {
          setErrorMessage('Password must be at least 8 characters long.');
          speak(strings.invalidPassword, () => startGuidedFlow('password'));
          return;
        }
        if (roleRef.current === 'student' && !/^[a-zA-Z0-9]+$/.test(formattedPwd)) {
          setErrorMessage('Student password must contain only alphabets and numbers.');
          speak("Student password must contain only alphabets and numbers, with no special characters. Please speak your password again.", () => startGuidedFlow('password'));
          return;
        }
        confirmFieldValue('password', 'your password', 'confirmPassword');
      } else if (targetField === 'confirmPassword') {
        const formattedConf = formatSpeech(rawTranscript, 'confirmPassword');
        updateField('confirmPassword', formattedConf);
        if (roleRef.current === 'student' && !/^[a-zA-Z0-9]+$/.test(formattedConf)) {
          setErrorMessage('Student password must contain only alphabets and numbers.');
          speak("Confirm Password must contain only alphabets and numbers. Please speak your confirmation password again.", () => startGuidedFlow('confirmPassword'));
          return;
        }
        setActiveField(null);
        confirmFieldValue('confirmPassword', 'your confirmation password', 'submit');
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    try { recognition.start(); } catch (e) {}
  };

  const listenForOkConfirmation = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    stopRecognition();

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript.toLowerCase().trim();
      const accepted = ['ok', 'okay', 'confirm', 'yes'];
      if (accepted.some((w) => transcript.includes(w))) handleModalClose();
      else listenForOkConfirmation();
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    try { recognition.start(); } catch (e) {}
  };

  const validateAndSubmit = async () => {
    setErrorMessage('');

    const fName = firstNameRef.current || firstName;
    const lName = lastNameRef.current || lastName;
    const pNo = phoneRef.current || phone;
    const emailVal = emailRef.current || email;
    const pwdVal = passwordRef.current || password;
    const confVal = confirmPasswordRef.current || confirmPassword;

    if (!fName) {
      setErrorMessage('First name is required.');
      speak(strings.emptyFirstName, () => startGuidedFlow('firstName'));
      return;
    }
    if (!pNo) {
      setErrorMessage('Phone number is required.');
      speak(strings.emptyPhone, () => startGuidedFlow('phone'));
      return;
    }
    if (/^[1-5]/.test(pNo)) {
      setErrorMessage('Invalid phone number. Must start with 6, 7, 8, or 9.');
      speak(strings.invalidPhone, () => startGuidedFlow('phone'));
      return;
    }
    if (!emailVal || !/\S+@\S+\.\S+/.test(emailVal)) {
      setErrorMessage('Valid email address is required.');
      speak(strings.emptyEmail, () => startGuidedFlow('email'));
      return;
    }
    if (!pwdVal || pwdVal.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      speak(strings.invalidPassword, () => startGuidedFlow('password'));
      return;
    }
    if (roleRef.current === 'student' && !/^[a-zA-Z0-9]+$/.test(pwdVal)) {
      setErrorMessage('Student password must contain only alphabets and numbers (no special characters).');
      speak("Student password must contain only alphabets and numbers.", () => startGuidedFlow('password'));
      return;
    }
    if (pwdVal !== confVal) {
      setErrorMessage('Passwords do not match.');
      speak(strings.passwordMismatch, () => startGuidedFlow('confirmPassword'));
      return;
    }

    try {
      const res = await registerUser({
        username: `${fName} ${lName}`.trim(),
        email: emailVal,
        phone: pNo,
        password: pwdVal,
        role: roleRef.current,
        adminSecretKey
      });

      if (res && res.success) {
        setShowSuccessPopup(true);
        speak(strings.success(rolesDisplay[roleRef.current]), () => listenForOkConfirmation());
      } else {
        const msg = res?.message || 'Registration failed. This email may already be registered under another role.';
        setErrorMessage(msg);
        speak(msg);
      }
    } catch (e) {
      setErrorMessage('Registration failed. Server error.');
      speak('Registration failed. Server error.');
    }
  };

  const handleModalClose = () => {
    setShowSuccessPopup(false);
    cancelSpeech();
    stopRecognition();
    navigate('/login');
  };

  return (
    <div
      onClick={handleTapToStart}
      style={{
        minHeight: '100vh',
        background: '#f0f9ff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        cursor: 'pointer',
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '480px',
          background: '#ffffff',
          border: '1px solid #bae6fd',
          padding: '32px 28px',
          borderRadius: '24px',
          boxShadow: '0 20px 40px -15px rgba(2, 132, 199, 0.12)',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
          <ProjectLogo size="large" />
          <p style={{ fontSize: '13px', color: '#475569', margin: '6px 0 0 0', fontWeight: '600' }}>
            Accessible Registration (Student, Teacher, Admin)
          </p>
        </div>

        {/* Voice Banner */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '12px',
            background: '#e0f2fe',
            border: '1px solid #7dd3fc',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <Mic size={18} color={isListening ? '#ef4444' : '#0284c7'} />
          <span style={{ fontSize: '12px', color: '#0369a1', fontWeight: '600' }}>
            {isListening ? 'Listening… speak now' : 'Tap anywhere to start voice registration.'}
          </span>
        </div>

        {errorMessage && (
          <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '12px', textAlign: 'center', fontWeight: '600' }}>
            {errorMessage}
          </div>
        )}

        {/* Role Selection Tabs */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', color: '#475569', fontWeight: '700', display: 'block', marginBottom: '6px' }}>
            Register Role
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { id: 'student', label: 'Student', icon: '🎓' },
              { id: 'teacher', label: 'Teacher', icon: '👨‍🏫' },
              { id: 'admin', label: 'Admin', icon: '🛡️' },
            ].map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  updateRole(r.id);
                  confirmFieldValue('role', rolesDisplay[r.id], 'firstName');
                }}
                style={{
                  flex: 1,
                  padding: '10px 4px',
                  borderRadius: '10px',
                  border: role === r.id ? '2px solid #0284c7' : '1px solid #bae6fd',
                  backgroundColor: role === r.id ? '#0284c7' : '#f0f9ff',
                  color: role === r.id ? '#ffffff' : '#0369a1',
                  fontWeight: '700',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                {r.icon} {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Form Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* First Name & Last Name */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <User size={16} color={activeField === 'firstName' ? '#0284c7' : '#64748b'} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                ref={firstNameRefInput}
                type="text"
                name="voice_reg_first_name"
                autoComplete="off"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => updateField('firstName', e.target.value)}
                style={{
                  ...inputStyle,
                  border: activeField === 'firstName' ? '2px solid #0284c7' : '1px solid #bae6fd',
                }}
              />
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <User size={16} color={activeField === 'lastName' ? '#0284c7' : '#64748b'} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                ref={lastNameRefInput}
                type="text"
                name="voice_reg_last_name"
                autoComplete="off"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => updateField('lastName', e.target.value)}
                style={{
                  ...inputStyle,
                  border: activeField === 'lastName' ? '2px solid #0284c7' : '1px solid #bae6fd',
                }}
              />
            </div>
          </div>

          {/* Phone Number */}
          <div style={{ position: 'relative' }}>
            <Phone size={16} color={activeField === 'phone' ? '#0284c7' : '#64748b'} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              ref={phoneRefInput}
              type="tel"
              name="voice_reg_phone"
              autoComplete="off"
              placeholder="Phone Number (e.g. 9876543210)"
              value={phone}
              onChange={(e) => updateField('phone', e.target.value)}
              style={{
                ...inputStyle,
                border: activeField === 'phone' ? '2px solid #0284c7' : '1px solid #bae6fd',
              }}
            />
          </div>

          {/* Email Address */}
          <div style={{ position: 'relative' }}>
            <Mail size={16} color={activeField === 'email' ? '#0284c7' : '#64748b'} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              ref={emailRefInput}
              type="email"
              name="voice_reg_email"
              autoComplete="off"
              placeholder="Email Address"
              value={email}
              onChange={(e) => updateField('email', e.target.value)}
              style={{
                ...inputStyle,
                border: activeField === 'email' ? '2px solid #0284c7' : '1px solid #bae6fd',
              }}
            />
          </div>

          {/* Student Password Rule Badge */}
          {role === 'student' && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '8px 12px', fontSize: '11px', color: '#1e40af', fontWeight: '600' }}>
              ℹ️ <strong>Student Password Rule:</strong> Must contain <strong>only alphabets (A-Z, a-z) and numbers (0-9)</strong>. No special characters allowed.
            </div>
          )}

          {/* Set Password */}
          <div style={{ position: 'relative' }}>
            <Lock size={16} color={activeField === 'password' ? '#0284c7' : '#64748b'} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              ref={passwordRefInput}
              type={showPassword ? 'text' : 'password'}
              name="voice_reg_password"
              autoComplete="new-password"
              placeholder={role === 'student' ? "Set Password (alphabets & numbers only, min 8 chars)" : "Set Password (min 8 characters)"}
              value={password}
              onChange={(e) => {
                const val = role === 'student' ? e.target.value.replace(/[^a-zA-Z0-9]/g, '') : e.target.value;
                updateField('password', val);
              }}
              style={{
                ...inputStyle,
                paddingRight: '40px',
                border: activeField === 'password' ? '2px solid #0284c7' : '1px solid #bae6fd',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: '#64748b',
              }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Confirm Password */}
          <div style={{ position: 'relative' }}>
            <Lock size={16} color={activeField === 'confirmPassword' ? '#0284c7' : '#64748b'} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              ref={confirmPasswordRefInput}
              type={showConfirmPassword ? 'text' : 'password'}
              name="voice_reg_confirm_password"
              autoComplete="new-password"
              placeholder={role === 'student' ? "Confirm Password (alphabets & numbers only)" : "Confirm Password"}
              value={confirmPassword}
              onChange={(e) => {
                const val = role === 'student' ? e.target.value.replace(/[^a-zA-Z0-9]/g, '') : e.target.value;
                updateField('confirmPassword', val);
              }}
              style={{
                ...inputStyle,
                paddingRight: '40px',
                border: activeField === 'confirmPassword' ? '2px solid #0284c7' : '1px solid #bae6fd',
              }}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              style={{
                position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: '#64748b',
              }}
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Admin Secret Key (Only for Admin Role) */}
          {role === 'admin' && (
            <div style={{ position: 'relative' }}>
              <Key size={16} color="#d97706" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="password"
                name="voice_reg_admin_secret_key"
                autoComplete="new-password"
                placeholder="Admin Secret Key (e.g. ADMIN123)"
                value={adminSecretKey}
                onChange={(e) => setAdminSecretKey(e.target.value)}
                style={{
                  ...inputStyle,
                  border: '1px solid #fde68a',
                }}
              />
            </div>
          )}

          {/* Submit Button */}
          <button
            type="button"
            onClick={validateAndSubmit}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '15px',
              border: 'none',
              cursor: 'pointer',
              marginTop: '6px',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
            }}
          >
            Register Account
          </button>

          <div style={{ textAlign: 'center', marginTop: '8px' }}>
            <Link to="/login" style={{ fontSize: '12px', color: '#0284c7', textDecoration: 'none', fontWeight: '600' }}>
              Already have an account? Login here
            </Link>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessPopup && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(2, 132, 199, 0.25)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
          <div style={{ background: '#ffffff', border: '2px solid #0284c7', padding: '32px', borderRadius: '24px', textAlign: 'center', maxWidth: '380px', width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
            <CheckCircle size={48} color="#22c55e" style={{ marginBottom: '16px' }} />
            <h2 style={{ fontSize: '20px', color: '#0f172a', marginBottom: '8px', fontWeight: '800' }}>Registration Successful!</h2>
            <p style={{ fontSize: '14px', color: '#475569', marginBottom: '20px' }}>Say "Confirm" or click below to proceed to login.</p>
            <button
              type="button"
              onClick={handleModalClose}
              style={{ width: '100%', padding: '12px', borderRadius: '12px', backgroundColor: '#0284c7', color: '#fff', border: 'none', fontWeight: '700', cursor: 'pointer' }}
            >
              Go to Login
            </button>
          </div>
        </div>
      )}
    </div>
  );
}