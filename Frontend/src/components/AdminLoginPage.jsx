import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, Mail, Lock, KeyRound, Send, RefreshCw, 
  ShieldCheck, ArrowRight, Eye, EyeOff, ArrowLeft 
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import ProjectLogo from './ProjectLogo.jsx';
import { loginUser, sendOtpApi, verifyOtpApi, adminSendLoginOtpApi, adminLoginOtpApi } from '../services/api';

export default function AdminLoginPage() {
  const navigate = useNavigate();

  // Mode: 'password_login' | 'otp_login' | 'forgot_email' | 'forgot_otp'
  const [viewMode, setViewMode] = useState('password_login');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP Fields
  const [otp, setOtp] = useState('');
  const [previewOtp, setPreviewOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Forgot Password Fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
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
    setPassword('');
    setOtp('');
    setErrorMessage('');
    setSuccessMessage('');
  }, []);

  // Countdown timer for OTP Resend
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;

  // 1. PASSWORD LOGIN HANDLER
  const handlePasswordLogin = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Please enter your administrator email address.');
      return;
    }

    if (!GMAIL_REGEX.test(cleanEmail)) {
      setErrorMessage('Invalid Gmail address. Email must end with @gmail.com.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your administrator password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await loginUser({
        email: cleanEmail,
        password: password,
        role: 'admin'
      });
      setIsLoading(false);

      if (res && res.success) {
        localStorage.setItem('auth_session', JSON.stringify({
          email: cleanEmail,
          role: 'admin',
          name: res.user?.username || cleanEmail.split('@')[0] || 'Administrator',
          token: res.user?.token || 'admin_token'
        }));
        setShowSuccessPopup(true);
      } else {
        setErrorMessage(res?.message || 'Incorrect administrator password or email. Please check your credentials.');
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage('Login failed. Please check your network connection.');
    }
  };

  // 2. FORGOT PASSWORD: STEP 1 - SEND OTP
  const handleSendForgotOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Please enter your administrator email address to receive an OTP code.');
      return;
    }

    if (!GMAIL_REGEX.test(cleanEmail)) {
      setErrorMessage('Invalid Gmail address. Email must end with @gmail.com.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await sendOtpApi(cleanEmail, 'admin');
      setIsLoading(false);
      if (res && res.success) {
        const code = res.previewOtp || res.otp || '';
        if (code) {
          setPreviewOtp(code);
          setOtp(code);
        }
        setCountdown(60);
        setSuccessMessage(res.message || `A 6-digit recovery OTP code has been sent to ${cleanEmail}.`);
        setViewMode('forgot_otp'); // Move to "next OTP" step!
      } else {
        setErrorMessage(res?.message || 'Failed to send recovery OTP. Please verify your email.');
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage('Network error while requesting recovery OTP. Please try again.');
    }
  };

  // 3. FORGOT PASSWORD: STEP 2 (NEXT OTP) - VERIFY OTP & RESET PASSWORD
  const handleResetPasswordWithOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanOtp = (otp || '').trim();

    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setErrorMessage('Please enter the 6-digit numeric OTP code.');
      return;
    }

    if (!newPassword) {
      setErrorMessage('Please enter your new administrator password.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and Confirm Password do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await verifyOtpApi(cleanEmail, cleanOtp, newPassword);
      setIsLoading(false);

      if (res && res.success) {
        setSuccessMessage('🎉 Password reset successfully! You can now log in with your new password.');
        setPassword(newPassword);
        setOtp('');
        setNewPassword('');
        setConfirmPassword('');
        setViewMode('password_login');
      } else {
        setErrorMessage(res?.message || 'Invalid or expired OTP code. Please enter the correct code.');
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage('Failed to reset password. Please check your network connection.');
    }
  };

  // 4. DIRECT OTP LOGIN: SEND OTP
  const handleSendDirectLoginOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !GMAIL_REGEX.test(cleanEmail)) {
      setErrorMessage('Please enter a valid administrator Gmail address.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await adminSendLoginOtpApi(cleanEmail);
      setIsLoading(false);
      if (res && res.success) {
        setIsOtpSent(true);
        setCountdown(60);
        setSuccessMessage(res.message || `Login OTP code sent to ${cleanEmail}.`);
        const code = res.previewOtp || res.otp || '';
        if (code) {
          setPreviewOtp(code);
          setOtp(code);
        }
      } else {
        setErrorMessage(res?.message || 'Failed to send admin login OTP.');
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage('Network error while requesting admin OTP.');
    }
  };

  // 5. DIRECT OTP LOGIN: VERIFY OTP
  const handleVerifyDirectLoginOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanOtp = (otp || '').trim();

    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setErrorMessage('Please enter the 6-digit OTP code.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await adminLoginOtpApi(cleanEmail, cleanOtp);
      setIsLoading(false);
      if (res && res.success) {
        localStorage.setItem('auth_session', JSON.stringify({
          email: cleanEmail,
          role: 'admin',
          name: res.user?.username || 'System Admin',
          token: res.user?.token || ''
        }));
        setShowSuccessPopup(true);
      } else {
        setErrorMessage(res?.message || 'Invalid or expired OTP code.');
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage('Admin login failed. Please check network connection.');
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
        {/* Header with Project Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '22px' }}>
          <ProjectLogo size="large" />
          <h1 style={{ fontSize: '22px', color: '#b45309', margin: '12px 0 2px 0', fontWeight: '900', textAlign: 'center' }}>
            {viewMode === 'password_login' && '🛡️ Administrator Login'}
            {viewMode === 'otp_login' && '🔑 Admin OTP Quick Login'}
            {viewMode === 'forgot_email' && '🔑 Reset Admin Password'}
            {viewMode === 'forgot_otp' && '🛡️ Enter OTP & New Password'}
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0, fontWeight: '600', textAlign: 'center' }}>
            {viewMode === 'password_login' && 'Sign in with your Email and Admin Password'}
            {viewMode === 'otp_login' && 'Log in using a 6-Digit One-Time Email Code'}
            {viewMode === 'forgot_email' && 'Step 1: Enter your email to receive recovery OTP'}
            {viewMode === 'forgot_otp' && 'Step 2: Verify OTP and choose your new password'}
          </p>
        </div>

        {/* Error Alert Banner */}
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

        {/* Success Alert Banner with Code Preview */}
        {successMessage && (
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
            <div>✅ {successMessage}</div>
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
                    🔑 YOUR 6-DIGIT VERIFICATION OTP:
                  </span>
                  <span style={{ fontSize: '22px', fontWeight: '900', letterSpacing: '4px', color: '#065f46' }}>
                    {previewOtp}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOtp(previewOtp);
                    setSuccessMessage('Code auto-filled! Complete the form and submit.');
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
                  Auto-Fill ✓
                </button>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 1: STANDARD ADMIN PASSWORD LOGIN */}
        {/* ======================================================== */}
        {viewMode === 'password_login' && (
          <form onSubmit={handlePasswordLogin} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Email Field */}
            <div>
              <label style={labelStyle}>Administrator Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} color="#d97706" style={iconStyle} />
                <input
                  type="email"
                  name="admin_email"
                  placeholder="admin@gmail.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  style={inputStyle}
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={labelStyle}>Administrator Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('forgot_email');
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#d97706',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  Forgot Password?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={18} color="#d97706" style={iconStyle} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="admin_password"
                  placeholder="Enter your administrator password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  style={{ ...inputStyle, paddingRight: '44px' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={eyeButtonStyle}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={18} color="#64748b" /> : <Eye size={18} color="#64748b" />}
                </button>
              </div>
            </div>

            {/* Login Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              style={primaryButtonStyle}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Authenticating Administrator...
                </>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  Login as Administrator
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            {/* Switch to OTP Login Option */}
            <div style={{ textAlign: 'center', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => {
                  setViewMode('otp_login');
                  setIsOtpSent(false);
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                style={{
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  color: '#b45309',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  width: '100%',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <KeyRound size={16} />
                Or Log In using Email OTP Code
              </button>
            </div>
          </form>
        )}

        {/* ======================================================== */}
        {/* VIEW 2: FORGOT PASSWORD - STEP 1 (ENTER EMAIL) */}
        {/* ======================================================== */}
        {viewMode === 'forgot_email' && (
          <form onSubmit={handleSendForgotOtp} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.5', margin: '0 0 4px 0' }}>
              Enter your registered administrator email address. We will send a secure 6-digit recovery OTP code to reset your password.
            </p>

            <div>
              <label style={labelStyle}>Administrator Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} color="#d97706" style={iconStyle} />
                <input
                  type="email"
                  name="admin_reset_email"
                  placeholder="admin@gmail.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  style={inputStyle}
                  required
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={primaryButtonStyle}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Sending Recovery OTP...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Send Recovery OTP (Next Step)
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setViewMode('password_login');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              style={textButtonStyle}
            >
              <ArrowLeft size={14} /> Back to Admin Login
            </button>
          </form>
        )}

        {/* ======================================================== */}
        {/* VIEW 3: FORGOT PASSWORD - STEP 2 (NEXT OTP & NEW PASSWORD) */}
        {/* ======================================================== */}
        {viewMode === 'forgot_otp' && (
          <form onSubmit={handleResetPasswordWithOtp} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Email Confirmation Pill */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fffbeb', border: '1px solid #fde68a', padding: '8px 12px', borderRadius: '10px' }}>
              <span style={{ fontSize: '12px', color: '#92400e', fontWeight: '700' }}>
                Resetting for: <strong>{email}</strong>
              </span>
              <button
                type="button"
                onClick={() => setViewMode('forgot_email')}
                style={{ background: 'none', border: 'none', color: '#d97706', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}
              >
                Change
              </button>
            </div>

            {/* 6-Digit OTP Code */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={labelStyle}>Enter 6-Digit OTP Code</label>
                <button
                  type="button"
                  onClick={handleSendForgotOtp}
                  disabled={countdown > 0 || isLoading}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: countdown > 0 ? '#94a3b8' : '#d97706',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: countdown > 0 ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: 0
                  }}
                >
                  <RefreshCw size={12} />
                  {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <KeyRound size={18} color="#d97706" style={iconStyle} />
                <input
                  type="text"
                  name="recovery_otp"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit code"
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
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* New Password */}
            <div>
              <label style={labelStyle}>New Administrator Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} color="#d97706" style={iconStyle} />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  name="new_admin_password"
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  style={{ ...inputStyle, paddingRight: '44px' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={eyeButtonStyle}
                >
                  {showNewPassword ? <EyeOff size={18} color="#64748b" /> : <Eye size={18} color="#64748b" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label style={labelStyle}>Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} color="#d97706" style={iconStyle} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirm_admin_password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  style={{ ...inputStyle, paddingRight: '44px' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={eyeButtonStyle}
                >
                  {showConfirmPassword ? <EyeOff size={18} color="#64748b" /> : <Eye size={18} color="#64748b" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={primaryButtonStyle}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Resetting Password...
                </>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  Reset Password & Return to Login
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setViewMode('password_login');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              style={textButtonStyle}
            >
              <ArrowLeft size={14} /> Cancel & Back to Login
            </button>
          </form>
        )}

        {/* ======================================================== */}
        {/* VIEW 4: DIRECT OTP LOGIN (ALTERNATIVE) */}
        {/* ======================================================== */}
        {viewMode === 'otp_login' && (
          <form onSubmit={isOtpSent ? handleVerifyDirectLoginOtp : handleSendDirectLoginOtp} autoComplete="off" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Administrator Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} color="#d97706" style={iconStyle} />
                <input
                  type="email"
                  name="admin_otp_email"
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

            {!isOtpSent && (
              <button
                type="button"
                onClick={handleSendDirectLoginOtp}
                disabled={isLoading}
                style={primaryButtonStyle}
              >
                {isLoading ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    Sending Login OTP...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Get Login OTP Code
                  </>
                )}
              </button>
            )}

            {isOtpSent && (
              <>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={labelStyle}>Enter 6-Digit Login OTP</label>
                    <button
                      type="button"
                      onClick={handleSendDirectLoginOtp}
                      disabled={countdown > 0 || isLoading}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: countdown > 0 ? '#94a3b8' : '#d97706',
                        fontWeight: '700',
                        fontSize: '12px',
                        cursor: countdown > 0 ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: 0
                      }}
                    >
                      <RefreshCw size={12} />
                      {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <KeyRound size={18} color="#d97706" style={iconStyle} />
                    <input
                      type="text"
                      name="admin_direct_otp"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Enter 6-digit OTP code"
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
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  style={primaryButtonStyle}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      Verifying OTP...
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      Verify OTP & Log In
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setViewMode('password_login');
                setIsOtpSent(false);
                setErrorMessage('');
                setSuccessMessage('');
              }}
              style={textButtonStyle}
            >
              <ArrowLeft size={14} /> Back to Password Login
            </button>
          </form>
        )}

        {/* Back to Home Page Link */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #fef3c7' }}>
          <Link to="/home" style={{ fontSize: '13px', color: '#64748b', textDecoration: 'none', fontWeight: '700' }}>
            ← Return to Home Page
          </Link>
        </div>
      </div>

      {/* Success Modal Popup */}
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

const labelStyle = {
  fontSize: '12px',
  color: '#b45309',
  fontWeight: '800',
  display: 'block',
  marginBottom: '6px'
};

const inputStyle = {
  width: '100%',
  padding: '13px 14px 13px 44px',
  borderRadius: '12px',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
  backgroundColor: '#ffffff',
  color: '#0f172a',
  border: '1.5px solid #fde68a',
  transition: 'border-color 0.2s, box-shadow 0.2s'
};

const iconStyle = {
  position: 'absolute',
  left: '14px',
  top: '50%',
  transform: 'translateY(-50%)',
  pointerEvents: 'none'
};

const eyeButtonStyle = {
  position: 'absolute',
  right: '12px',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px',
  display: 'flex',
  alignItems: 'center'
};

const primaryButtonStyle = {
  width: '100%',
  padding: '14px',
  borderRadius: '12px',
  backgroundColor: '#d97706',
  color: '#ffffff',
  fontWeight: '800',
  fontSize: '15px',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  boxShadow: '0 4px 14px rgba(217, 119, 6, 0.35)',
  transition: 'background-color 0.2s'
};

const textButtonStyle = {
  background: 'none',
  border: 'none',
  color: '#64748b',
  fontSize: '13px',
  fontWeight: '700',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  padding: '4px'
};
