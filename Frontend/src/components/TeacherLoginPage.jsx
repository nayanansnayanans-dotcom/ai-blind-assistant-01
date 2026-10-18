import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, CheckCircle, Lock, Mail } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import ProjectLogo from './ProjectLogo.jsx';
import { loginUser } from '../services/api';

export default function TeacherLoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    window.isVoiceAssistantActive = false;
    try {
      localStorage.removeItem('auth_session');
      localStorage.removeItem('user');
      localStorage.removeItem('user_name');
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('draft_teacher_exam');
      localStorage.removeItem('draft_teacher_selected_qids');
    } catch (e) {}
    setEmail('');
    setPassword('');
    setErrorMessage('');
    setShowSuccessPopup(false);
    const clearTimer = setTimeout(() => {
      setEmail('');
      setPassword('');
    }, 150);
    return () => clearTimeout(clearTimer);
  }, []);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');

    const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    if (!email || !GMAIL_REGEX.test(email.trim())) {
      setErrorMessage('Invalid Gmail address. Email must end with @gmail.com with no trailing characters.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    try {
      const res = await loginUser({ email, password, role: 'teacher' });
      if (res && res.success) {
        const teacherName = res.user?.username || res.user?.name || email.split('@')[0];
        try {
          localStorage.removeItem('user_name');
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          localStorage.removeItem('role');
          localStorage.removeItem('draft_teacher_exam');
          localStorage.removeItem('draft_teacher_selected_qids');
        } catch (e) {}
        const teacherSubject = res.user?.subject || localStorage.getItem('teacher_selected_subject') || 'Computer Science';
        localStorage.setItem('auth_session', JSON.stringify({ email: email.toLowerCase().trim(), role: 'teacher', name: teacherName, subject: teacherSubject }));
        localStorage.setItem('teacher_selected_subject', teacherSubject);
        try {
          const cleanEmail = email.toLowerCase().trim();
          const loggedMap = JSON.parse(localStorage.getItem('logged_in_users') || '{}');
          loggedMap[cleanEmail] = {
            email: cleanEmail,
            role: 'teacher',
            name: teacherName,
            loginTime: new Date().toISOString(),
            status: 'online'
          };
          localStorage.setItem('logged_in_users', JSON.stringify(loggedMap));
        } catch (e) {}
        setShowSuccessPopup(true);
      } else {
        setErrorMessage(res.message || 'Teacher login failed. Check email or portal role.');
      }
    } catch (err) {
      setErrorMessage('Teacher login failed. Please check your credentials.');
    }
  };

  const handleModalClose = () => {
    setShowSuccessPopup(false);
    navigate('/teacher-dashboard');
  };

  return (
    <div
      style={{
        minHeight: '100vh', background: '#faf5ff', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center', padding: '24px', boxSizing: 'border-box'
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: '460px', background: '#ffffff', border: '1px solid #e9d5ff',
          padding: '36px 32px', borderRadius: '24px', boxShadow: '0 20px 40px -15px rgba(147, 51, 234, 0.15)', boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
          <ProjectLogo size="large" />
          <h1 style={{ fontSize: '22px', color: '#7e22ce', margin: '8px 0 2px 0', fontWeight: '900' }}>
            👨‍🏫 Teacher Portal Login
          </h1>
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0, fontWeight: '600' }}>
            Exam Creation & Evaluation Suite
          </p>
        </div>

        {errorMessage && (
          <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '14px', textAlign: 'center', fontWeight: '700' }}>
            ⚠️ {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Hidden inputs to absorb browser autofill */}
          <input type="text" style={{ display: 'none' }} tabIndex="-1" autoComplete="off" />
          <input type="password" style={{ display: 'none' }} tabIndex="-1" autoComplete="new-password" />
          <div>
            <label style={{ fontSize: '12px', color: '#7e22ce', fontWeight: '800', display: 'block', marginBottom: '6px' }}>
              Teacher Gmail / Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} color="#9333ea" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="email"
                name="teacher_user_email"
                autoComplete="off"
                placeholder="e.g. teacher@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: '#7e22ce', fontWeight: '800', display: 'block', marginBottom: '6px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="#9333ea" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                name="teacher_user_password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
          </div>

          <div style={{ textAlign: 'right', marginTop: '-4px' }}>
            <Link to="/forgot-password" state={{ role: 'teacher' }} style={{ fontSize: '13px', color: '#9333ea', textDecoration: 'none', fontWeight: '600' }}>
              Forgot Password? (Email OTP)
            </Link>
          </div>

          <button
            type="submit"
            style={{
              width: '100%', padding: '14px', borderRadius: '12px',
              backgroundColor: '#9333ea', color: '#ffffff', fontWeight: '700',
              fontSize: '15px', border: 'none', cursor: 'pointer', marginTop: '4px',
              boxShadow: '0 4px 14px rgba(147, 51, 234, 0.35)'
            }}
          >
            Login as Teacher
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <Link to="/teacher-register" style={{ fontSize: '13px', color: '#9333ea', textDecoration: 'none', fontWeight: '600' }}>
              Teacher Registration →
            </Link>
            <Link to="/home" style={{ fontSize: '13px', color: '#475569', textDecoration: 'none', fontWeight: '600' }}>
              Go to Home Page
            </Link>
          </div>
        </form>
      </div>

      {showSuccessPopup && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(147, 51, 234, 0.25)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#ffffff', border: '2px solid #9333ea', padding: '32px', borderRadius: '24px', textAlign: 'center', maxWidth: '380px', width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
            <CheckCircle size={48} color="#22c55e" style={{ marginBottom: '16px' }} />
            <h2 style={{ fontSize: '20px', color: '#0f172a', marginBottom: '8px', fontWeight: '800' }}>Teacher Login Successful!</h2>
            <p style={{ fontSize: '14px', color: '#475569', marginBottom: '20px' }}>Welcome back. Click below to open Teacher Dashboard.</p>
            <button type="button" onClick={handleModalClose} style={{ width: '100%', padding: '12px', borderRadius: '12px', backgroundColor: '#9333ea', color: '#fff', border: 'none', fontWeight: '700', cursor: 'pointer' }}>
              Enter Teacher Dashboard
            </button>
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
  border: '1px solid #e9d5ff',
};
