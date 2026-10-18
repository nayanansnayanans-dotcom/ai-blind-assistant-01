import React, { useState, useEffect } from 'react';
import { CheckCircle, Mail, KeyRound, Send, RefreshCw, ShieldCheck, ArrowRight } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import ProjectLogo from './ProjectLogo.jsx';
import { adminSendLoginOtpApi, adminLoginOtpApi } from '../services/api';

export default function AdminLoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [previewOtp, setPreviewOtp] = useState('');
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  useEffect(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    window.isVoiceAssistantActive = false;
    try {
      localStorage.removeItem('auth_session');
      localStorage.removeItem('user');
      localStorage.removeItem('user_name');
      localStorage.removeItem('token');
      localStorage.removeItem('role');
    } catch (e) {}
    setEmail('');
    setOtp('');
    setIsOtpSent(false);
    setErrorMessage('');
    setInfoMessage('');
    setShowSuccessPopup(false);
  }, []);

  // Countdown timer for Resend OTP button
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;

  // Step 1: Send OTP to Admin Email
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Please enter your administrator email address.');
      return;
    }

    if (!GMAIL_REGEX.test(cleanEmail)) {
      setErrorMessage('Invalid Gmail address. Email must end with @gmail.com with no trailing characters.');
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = await adminSendLoginOtpApi(cleanEmail);
      setIsSendingOtp(false);
      if (res && res.success) {
        setIsOtpSent(true);
        setCountdown(60);
        setInfoMessage(res.message || `A 6-digit login OTP code has been generated for ${cleanEmail}.`);
        const code = res.previewOtp || res.otp || '';
        if (code) {
          setPreviewOtp(code);
          setOtp(code);
        }
      } else {
        setErrorMessage(res?.message || 'Failed to send admin login OTP. Please verify your email.');
      }
    } catch (err) {
      setIsSendingOtp(false);
      setErrorMessage('Network error while requesting admin OTP. Please try again.');
    }
  };

  // Step 2: Verify OTP and Login
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !GMAIL_REGEX.test(cleanEmail)) {
      setErrorMessage('Please enter a valid Gmail address.');
      return;
    }

    if (!isOtpSent) {
      return handleSendOtp();
    }

    const cleanOtp = (otp || '').trim();
    if (!cleanOtp) {
      setErrorMessage('Please enter the 6-digit OTP code received in your email.');
      return;
    }

    if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setErrorMessage('Invalid OTP format. Please enter exactly 6 numeric digits.');
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await adminLoginOtpApi(cleanEmail, cleanOtp);
      setIsLoggingIn(false);
      if (res && res.success) {
        localStorage.setItem('auth_session', JSON.stringify({
          email: cleanEmail,
          role: 'admin',
          name: res.user?.username || 'System Admin',
          token: res.user?.token || ''
        }));
        setShowSuccessPopup(true);
      } else {
        setErrorMessage(res?.message || 'Invalid or expired OTP code. Please enter the correct code or request a new one.');
      }
    } catch (err) {
      setIsLoggingIn(false);
      setErrorMessage('Admin login failed. Please check your network connection.');
    }
  };

  const handleModalClose = () => {
    setShowSuccessPopup(false);
    navigate('/admin-dashboard');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fef9c3 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '24px',
        boxSizing: 'border-box'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          background: '#ffffff',
          border: '1px solid #fde68a',
          padding: '36px 32px',
          borderRadius: '24px',
          boxShadow: '0 20px 40px -15px rgba(217, 119, 6, 0.18)',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '22px' }}>
          <ProjectLogo size="large" />
          <h1 style={{ fontSize: '22px', color: '#b45309', margin: '12px 0 2px 0', fontWeight: '900', textAlign: 'center' }}>
            🛡️ System Administrator Login
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0, fontWeight: '600', textAlign: 'center' }}>
            Direct Email OTP Authentication
          </p>
        </div>

        {errorMessage && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              fontSize: '13px',
              padding: '12px 14px',
              borderRadius: '12px',
              marginBottom: '16px',
              fontWeight: '700',
              border: '1px solid #fecaca',
              lineHeight: '1.4'
            }}
          >
            ⚠️ {errorMessage}
          </div>
        )}

        {infoMessage && (
          <div
            style={{
              backgroundColor: '#ecfdf5',
              color: '#047857',
              fontSize: '13px',
              padding: '12px 14px',
              borderRadius: '12px',
              marginBottom: '16px',
              fontWeight: '700',
              border: '1px solid #a7f3d0',
              lineHeight: '1.4'
            }}
          >
            <div>✅ {infoMessage}</div>
            {previewOtp && (
              <div style={{
                marginTop: '10px',
                backgroundColor: '#ffffff',
                border: '2px dashed #059669',
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px'
              }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#047857', fontWeight: '800', display: 'block' }}>
                    🔑 YOUR 6-DIGIT ADMIN LOGIN CODE:
                  </span>
                  <span style={{ fontSize: '22px', fontWeight: '900', letterSpacing: '4px', color: '#065f46' }}>
                    {previewOtp}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOtp(previewOtp);
                    setInfoMessage('Code filled! Click "Verify OTP & Log In" to enter Admin Dashboard.');
                  }}
                  style={{
                    backgroundColor: '#059669',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  Auto-Filled ✓
                </button>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Step 1: Admin Email */}
          <div>
            <label style={{ fontSize: '12px', color: '#b45309', fontWeight: '800', display: 'block', marginBottom: '6px' }}>
              Administrator Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} color="#d97706" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="email"
                name="admin_email"
                placeholder="admin@gmail.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                disabled={isOtpSent && countdown > 0}
                style={inputStyle}
                required
              />
            </div>
          </div>

          {/* If OTP not sent yet, show Get OTP button */}
          {!isOtpSent && (
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={isSendingOtp}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                backgroundColor: isSendingOtp ? '#f59e0b' : '#d97706',
                color: '#ffffff',
                fontWeight: '800',
                fontSize: '15px',
                border: 'none',
                cursor: isSendingOtp ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(217, 119, 6, 0.35)',
                transition: 'background-color 0.2s'
              }}
            >
              {isSendingOtp ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Sending 6-Digit OTP...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Get Login OTP Code
                </>
              )}
            </button>
          )}

          {/* Step 2: 6-Digit OTP Code (Shows once OTP is requested) */}
          {isOtpSent && (
            <>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', color: '#b45309', fontWeight: '800', display: 'block' }}>
                    Enter 6-Digit Login OTP
                  </label>
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={countdown > 0 || isSendingOtp}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: countdown > 0 ? '#94a3b8' : '#d97706',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: countdown > 0 ? 'default' : 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <RefreshCw size={12} />
                    {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <KeyRound size={18} color="#d97706" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    name="admin_otp"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                    placeholder="Enter 6-digit OTP (e.g. 123456)"
                    value={otp}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtp(val);
                      if (errorMessage) setErrorMessage('');
                    }}
                    style={{
                      ...inputStyle,
                      letterSpacing: otp ? '4px' : 'normal',
                      fontWeight: '800',
                      fontSize: '16px'
                    }}
                    autoFocus
                    required
                  />
                </div>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={isLoggingIn}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  backgroundColor: isLoggingIn ? '#b45309' : '#d97706',
                  color: '#ffffff',
                  fontWeight: '800',
                  fontSize: '15px',
                  border: 'none',
                  cursor: isLoggingIn ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(217, 119, 6, 0.35)',
                  transition: 'background-color 0.2s'
                }}
              >
                {isLoggingIn ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    Verifying OTP & Logging In...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    Login as Admin
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsOtpSent(false);
                  setOtp('');
                  setErrorMessage('');
                  setInfoMessage('');
                  setCountdown(0);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textAlign: 'center',
                  marginTop: '-4px'
                }}
              >
                Change Admin Email Address
              </button>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
            <Link to="/home" style={{ fontSize: '13px', color: '#475569', textDecoration: 'none', fontWeight: '700' }}>
              ← Return to Home Page
            </Link>
          </div>
        </form>
      </div>

      {showSuccessPopup && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(217, 119, 6, 0.25)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
          }}
        >
          <div
            style={{
              background: '#ffffff',
              border: '2px solid #d97706',
              padding: '32px',
              borderRadius: '24px',
              textAlign: 'center',
              maxWidth: '380px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
            }}
          >
            <CheckCircle size={48} color="#22c55e" style={{ marginBottom: '16px' }} />
            <h2 style={{ fontSize: '20px', color: '#0f172a', marginBottom: '8px', fontWeight: '800' }}>
              Admin Authenticated!
            </h2>
            <p style={{ fontSize: '14px', color: '#475569', marginBottom: '20px' }}>
              Welcome back to VisionAssist Administrator Control Center.
            </p>
            <button
              type="button"
              onClick={handleModalClose}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                backgroundColor: '#d97706',
                color: '#fff',
                border: 'none',
                fontWeight: '800',
                fontSize: '15px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(217, 119, 6, 0.3)'
              }}
            >
              Enter Admin Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '14px 14px 14px 44px',
  borderRadius: '12px',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
  backgroundColor: '#ffffff',
  color: '#0f172a',
  border: '1.5px solid #fde68a',
  transition: 'border-color 0.2s, box-shadow 0.2s'
};
