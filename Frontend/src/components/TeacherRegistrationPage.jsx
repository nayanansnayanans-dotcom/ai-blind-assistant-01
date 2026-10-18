import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, CheckCircle, Lock, Mail, User, Phone, Briefcase } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import ProjectLogo from './ProjectLogo.jsx';
import { registerUser } from '../services/api';
import { COMPREHENSIVE_SUBJECTS_AND_LANGUAGES } from './TeacherDashboard.jsx';

export default function TeacherRegistrationPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('Computer Science');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    window.isVoiceAssistantActive = false;
    setUsername('');
    setEmail('');
    setPhone('');
    setSubject('Computer Science');
    setPassword('');
    const clearTimer = setTimeout(() => {
      setUsername('');
      setEmail('');
      setPhone('');
      setSubject('Computer Science');
      setPassword('');
    }, 150);
    return () => clearTimeout(clearTimer);
  }, []);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');

    if (!username || !email || !phone || !password) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    const cleanPhone = phone.trim().replace(/\D/g, '');
    const PHONE_REGEX = /^[6-9]\d{9}$/;
    if (!PHONE_REGEX.test(cleanPhone)) {
      setErrorMessage('Invalid phone number. Number must start with 6, 7, 8, or 9 and contain exactly 10 digits.');
      return;
    }

    const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    if (!GMAIL_REGEX.test(email.trim())) {
      setErrorMessage('Invalid Gmail address. Email must end with @gmail.com with no trailing characters.');
      return;
    }

    try {
      const chosenSubject = subject || 'Computer Science';
      const res = await registerUser({ username, email, phone, password, subject: chosenSubject, role: 'teacher' });
      if (res && res.success) {
        localStorage.setItem('auth_session', JSON.stringify({ email, role: 'teacher', name: username, subject: chosenSubject }));
        localStorage.setItem('teacher_selected_subject', chosenSubject);
        localStorage.removeItem('draft_teacher_exam');
        localStorage.removeItem('draft_teacher_selected_qids');
        setShowSuccessPopup(true);
      } else {
        setErrorMessage(res.message || 'Teacher registration failed.');
      }
    } catch (err) {
      setErrorMessage('Registration failed. Please try again.');
    }
  };

  const handleModalClose = () => {
    setShowSuccessPopup(false);
    navigate('/teacher-login');
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
          width: '100%', maxWidth: '480px', background: '#ffffff', border: '1px solid #e9d5ff',
          padding: '36px 32px', borderRadius: '24px', boxShadow: '0 20px 40px -15px rgba(147, 51, 234, 0.15)', boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
          <ProjectLogo size="large" />
          <h1 style={{ fontSize: '22px', color: '#7e22ce', margin: '8px 0 2px 0', fontWeight: '900' }}>
            👨‍🏫 Teacher Account Registration
          </h1>
          <p style={{ fontSize: '12px', color: '#64748b', margin: 0, fontWeight: '600' }}>
            Faculty & Educator Portal Access Setup
          </p>
        </div>

        {errorMessage && (
          <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '14px', textAlign: 'center', fontWeight: '700' }}>
            ⚠️ {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Hidden inputs to absorb browser autofill */}
          <input type="text" style={{ display: 'none' }} tabIndex="-1" autoComplete="off" />
          <input type="password" style={{ display: 'none' }} tabIndex="-1" autoComplete="new-password" />

          <div>
            <label style={{ fontSize: '12px', color: '#7e22ce', fontWeight: '800', display: 'block', marginBottom: '6px' }}>Full Name</label>
            <div style={{ position: 'relative' }}>
              <User size={18} color="#9333ea" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input type="text" name="teacher_reg_username" autoComplete="off" placeholder="e.g. Prof. Robert Davis" value={username} onChange={e => setUsername(e.target.value)} style={inputStyle} required />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: '#7e22ce', fontWeight: '800', display: 'block', marginBottom: '6px' }}>Teacher Gmail / Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} color="#9333ea" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input type="email" name="teacher_reg_email" autoComplete="off" placeholder="teacher@gmail.com" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} required />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', color: '#7e22ce', fontWeight: '800', display: 'block', marginBottom: '6px' }}>Phone Number</label>
              <div style={{ position: 'relative' }}>
                <Phone size={18} color="#9333ea" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="tel" name="teacher_reg_phone" autoComplete="off" placeholder="+91 9876543210" value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} required />
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', color: '#7e22ce', fontWeight: '800', display: 'block', marginBottom: '6px' }}>Teaching Subject</label>
              <div style={{ position: 'relative' }}>
                <Briefcase size={18} color="#9333ea" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1 }} />
                <select
                  name="teacher_reg_subject"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: '40px', cursor: 'pointer' }}
                  required
                >
                  {COMPREHENSIVE_SUBJECTS_AND_LANGUAGES.map(cat => (
                    <optgroup key={cat.category} label={cat.category}>
                      {cat.items.map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: '#7e22ce', fontWeight: '800', display: 'block', marginBottom: '6px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="#9333ea" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input type={showPassword ? 'text' : 'password'} name="teacher_reg_password" autoComplete="new-password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} style={{ ...inputStyle, paddingRight: '44px' }} required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" style={{ width: '100%', padding: '14px', borderRadius: '12px', backgroundColor: '#9333ea', color: '#ffffff', fontWeight: '700', fontSize: '15px', border: 'none', cursor: 'pointer', marginTop: '6px', boxShadow: '0 4px 14px rgba(147, 51, 234, 0.35)' }}>
            Register as Teacher
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
            <Link to="/teacher-login" style={{ fontSize: '13px', color: '#9333ea', textDecoration: 'none', fontWeight: '600' }}>
              Already registered? Teacher Login
            </Link>
          </div>
        </form>
      </div>

      {showSuccessPopup && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(147, 51, 234, 0.25)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#ffffff', border: '2px solid #9333ea', padding: '32px', borderRadius: '24px', textAlign: 'center', maxWidth: '380px', width: '100%', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
            <CheckCircle size={48} color="#22c55e" style={{ marginBottom: '16px' }} />
            <h2 style={{ fontSize: '20px', color: '#0f172a', marginBottom: '8px', fontWeight: '800' }}>Teacher Registration Complete!</h2>
            <p style={{ fontSize: '14px', color: '#475569', marginBottom: '20px' }}>Click below to proceed to Teacher Login.</p>
            <button type="button" onClick={handleModalClose} style={{ width: '100%', padding: '12px', borderRadius: '12px', backgroundColor: '#9333ea', color: '#fff', border: 'none', fontWeight: '700', cursor: 'pointer' }}>
              Go to Teacher Login
            </button>
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
  border: '1px solid #e9d5ff',
};
