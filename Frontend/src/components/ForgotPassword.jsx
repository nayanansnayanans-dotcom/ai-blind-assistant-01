import React, { useState, useRef, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { Eye, EyeOff, CheckCircle, Mic, Lock, Mail, Key, ShieldCheck, ArrowLeft, Sparkles } from "lucide-react";
import { speakIn, cancelSpeech, isTTSActive, formatSpokenEmail } from "./speech";
import ProjectLogo from "./ProjectLogo.jsx";
import { sendOtpApi, verifyOtpApi, resetPasswordDirectApi } from "../services/api";

const DIGIT_MAP = {
  'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
  'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9'
};

export default function ForgotPassword() {
  const navigate = useNavigate();
  const location = useLocation();

  const initialRole = location.state?.role || "student";
  const initialEmail = "";

  const [role, setRole] = useState(initialRole);
  const isStudent = role === "student";

  const roleColor = role === "teacher" ? "#9333ea" : role === "admin" ? "#d97706" : "#0284c7";
  const roleColorDark = role === "teacher" ? "#7e22ce" : role === "admin" ? "#b45309" : "#0369a1";
  const roleBgLight = role === "teacher" ? "#f3e8ff" : role === "admin" ? "#fef3c7" : "#e0f2fe";
  const roleBorderLight = role === "teacher" ? "#e9d5ff" : role === "admin" ? "#fde68a" : "#bae6fd";

  // State
  const [step, setStep] = useState(1); // For teacher/admin: 1 = Send OTP, 2 = Verify OTP & Reset
  const [email, setEmail] = useState("");
  const [enteredOtp, setEnteredOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setEmail("");
    setNewPassword("");
    setConfirmPassword("");
    setEnteredOtp("");
    const clearTimer = setTimeout(() => {
      setEmail("");
      setNewPassword("");
      setConfirmPassword("");
      setEnteredOtp("");
    }, 150);
    return () => clearTimeout(clearTimer);
  }, []);
  const [isListening, setIsListening] = useState(false);
  const [activeVoiceField, setActiveVoiceField] = useState("email");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [manualCommandInput, setManualCommandInput] = useState("");
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailInputRef = useRef(null);
  const otpInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const isManuallyClosedRef = useRef(false);

  const pendingEmailRef = useRef(initialEmail);
  const pendingOtpRef = useRef("");
  const pendingPasswordRef = useRef("");
  const pendingConfirmPassRef = useRef("");
  const hasProcessedRef = useRef(false);

  const formatSpokenOtp = (rawText) => {
    if (!rawText) return "";
    let s = rawText.toLowerCase().trim();
    Object.entries(DIGIT_MAP).forEach(([word, digit]) => {
      s = s.replace(new RegExp(`\\b${word}\\b`, 'g'), digit);
    });
    return s.replace(/\D/g, "");
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
    if (!isStudent) return; // Voice assistant only for blind students
    stopRecognition();
    cancelSpeech();
    speakIn(text, "en-US", { 
      rate: 1.05, 
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
    // Only speak intro for student role
    if (isStudent) {
      if (initialEmail) {
        speak(`Student Password Recovery for ${initialEmail}. Tap screen or press Spacebar to start voice guide.`);
      } else {
        speak("Welcome to Student Password Recovery. Tap anywhere on screen or press Spacebar to set your new password.");
      }
    }

    const handleKeyDown = (e) => {
      if (!isStudent) return;
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.code === "Space" || (e.altKey && e.code === "KeyS")) {
        e.preventDefault();
        isManuallyClosedRef.current = false;
        triggerVoiceReset("email");
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.isVoiceAssistantActive = false;
      cancelSpeech();
      stopRecognition();
    };
  }, [isStudent]);

  // Main voice assistant trigger for blind students
  const triggerVoiceReset = async (targetField = "email") => {
    if (!isStudent) return;
    isManuallyClosedRef.current = false;
    stopRecognition();
    cancelSpeech();
    setErrorMessage("");
    hasProcessedRef.current = false;
    setIsListening(true);
    setActiveVoiceField(targetField);
    setLiveTranscript("");

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        console.warn("Microphone permission request:", e);
      }
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      speak("Speech recognition is not supported in this browser. Please type your details.");
      setIsListening(false);
      return;
    }

    let promptMsg = "";
    if (targetField === "email") {
      promptMsg = "Step 1: Please speak your registered student email address now.";
    } else if (targetField === "confirm_email") {
      promptMsg = `You entered email address ${pendingEmailRef.current || email}. Is this correct? Say CONFIRM or NO.`;
    } else if (targetField === "password") {
      promptMsg = isStudent
        ? "Step 2: Please speak your new password now. Your password must contain only alphabets and numbers."
        : "Step 2: Please speak your new password now.";
    } else if (targetField === "confirm_password") {
      promptMsg = `You entered new password ${pendingPasswordRef.current || newPassword}. Please speak your password once again to confirm.`;
    } else if (targetField === "final_confirm") {
      promptMsg = `Password confirmed! Say CONFIRM to save your new password, or NO to retry.`;
    } else if (targetField === "otp") {
      promptMsg = `Please speak the 6-digit OTP code sent to your email.`;
    } else if (targetField === "confirm_otp") {
      promptMsg = `You entered OTP code ${pendingOtpRef.current || enteredOtp}. Is this correct? Say CONFIRM or NO.`;
    } else if (targetField === "confirm_go_to_login") {
      promptMsg = "Password updated successfully! Would you like to proceed to the Student Login page now? Please say YES, LOGIN, or CONFIRM to go further, or say NO to stay on this screen.";
    }

    let micStarted = false;
    const startMic = () => {
      if (isManuallyClosedRef.current) return;
      if (micStarted) return;
      micStarted = true;

      try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = "en-US";
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
          if (!isManuallyClosedRef.current) {
            setIsListening(true);
          }
        };

        recognition.onresult = (e) => {
          if (isManuallyClosedRef.current) return;
          if (isTTSActive()) return;
          if (hasProcessedRef.current) return;

          let text = "";
          for (let i = 0; i < e.results.length; i++) {
            text += e.results[i][0].transcript;
          }
          const rawText = text.trim();
          setLiveTranscript(rawText);

          const lower = rawText.toLowerCase();
          const posWords = ["yes", "yeah", "yep", "ok", "okay", "confirm", "correct", "right", "proceed", "sure", "good", "save"];
          const negWords = ["no", "nope", "wrong", "change", "retry", "edit", "incorrect"];

          // Navigation commands
          if (lower.includes("back") || lower.includes("login") || lower.includes("cancel")) {
            hasProcessedRef.current = true;
            stopRecognition();
            processVoiceResult(rawText, targetField);
            return;
          }

          if ((targetField.startsWith("confirm_") || targetField === "final_confirm") && 
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
          console.warn("SpeechRecognition error:", e);
          if (e.error !== "no-speech") {
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

    const posWords = ["yes", "yeah", "yep", "ok", "okay", "confirm", "correct", "right", "sure", "good", "proceed", "save"];
    const negWords = ["no", "nope", "wrong", "change", "retry", "edit", "incorrect"];

    // --- GLOBAL CLOSE VOICE OVERLAY TRIGGER ---
    const closeKeywords = ["close", "exit", "cancel", "dismiss", "close overlay", "close assistant", "stop"];
    if (closeKeywords.some(w => cleanText === w || cleanText.startsWith(w + " ") || cleanText.endsWith(" " + w))) {
      handleCloseVoiceOverlay();
      speak("Voice Assistant closed.");
      return;
    }

    // Navigation triggers
    if (cleanText.includes("back to login") || cleanText.includes("go back") || cleanText.includes("cancel")) {
      speak("Returning to Student Login.", () => {
        setTimeout(() => navigate("/student-login"), 400);
      });
      return;
    }

    // --- STEP 1: EMAIL CAPTURE ---
    if (fieldKey === "email") {
      const formattedEmail = formatSpokenEmail(rawText);
      setEmail(formattedEmail);
      pendingEmailRef.current = formattedEmail;
      triggerVoiceReset("confirm_email");
      return;
    }

    // --- STEP 1 CONFIRMATION ---
    if (fieldKey === "confirm_email") {
      if (posWords.some(w => cleanText.includes(w))) {
        triggerVoiceReset("password");
      } else if (negWords.some(w => cleanText.includes(w))) {
        setEmail("");
        pendingEmailRef.current = "";
        triggerVoiceReset("email");
      } else {
        const newEmail = formatSpokenEmail(rawText);
        setEmail(newEmail);
        pendingEmailRef.current = newEmail;
        triggerVoiceReset("confirm_email");
      }
      return;
    }

    // --- STEP 2: NEW PASSWORD CAPTURE ---
    if (fieldKey === "password") {
      const cleanPass = rawText
        .replace(/^my new password is\s+/i, '')
        .replace(/^new password is\s+/i, '')
        .replace(/^set password is\s+/i, '')
        .replace(/^password is\s+/i, '')
        .replace(/\s+/g, '');

      if (!cleanPass || cleanPass.length < 4) {
        speak("Password too short. Please speak a new password with at least 6 characters.", () => {
          setTimeout(() => triggerVoiceReset("password"), 300);
        });
        return;
      }

      if (isStudent && !/^[a-zA-Z0-9]+$/.test(cleanPass)) {
        speak("Student password must contain only alphabets and numbers, with no spaces or special characters. Please speak your password again.", () => {
          setTimeout(() => triggerVoiceReset("password"), 300);
        });
        return;
      }

      setNewPassword(cleanPass);
      pendingPasswordRef.current = cleanPass;
      triggerVoiceReset("confirm_password");
      return;
    }

    // --- STEP 3: CONFIRM PASSWORD CAPTURE ---
    if (fieldKey === "confirm_password") {
      const cleanPass2 = rawText
        .replace(/^confirm password is\s+/i, '')
        .replace(/^password is\s+/i, '')
        .replace(/\s+/g, '');

      if (isStudent && cleanPass2 && !/^[a-zA-Z0-9]+$/.test(cleanPass2)) {
        speak("Confirm Password must contain only alphabets and numbers. Please speak your confirmation password again.", () => {
          setTimeout(() => triggerVoiceReset("confirm_password"), 300);
        });
        return;
      }

      setConfirmPassword(cleanPass2 || pendingPasswordRef.current);
      pendingConfirmPassRef.current = cleanPass2 || pendingPasswordRef.current;
      triggerVoiceReset("final_confirm");
      return;
    }

    // --- FINAL CONFIRMATION ---
    if (fieldKey === "final_confirm") {
      if (posWords.some(w => cleanText.includes(w))) {
        speak("Passwords confirmed! Updating your account password now.", () => {
          handleStudentDirectReset(null, pendingEmailRef.current || email, pendingPasswordRef.current || newPassword, pendingConfirmPassRef.current || confirmPassword);
        });
      } else if (negWords.some(w => cleanText.includes(w))) {
        setNewPassword("");
        setConfirmPassword("");
        pendingPasswordRef.current = "";
        pendingConfirmPassRef.current = "";
        triggerVoiceReset("password");
      } else {
        triggerVoiceReset("password");
      }
      return;
    }

    // --- CONFIRMATION TO GO FURTHER AFTER PASSWORD RESET ---
    if (fieldKey === "confirm_go_to_login") {
      const loginWords = ["yes", "yeah", "yep", "ok", "okay", "confirm", "correct", "right", "proceed", "sure", "good", "login", "go", "continue", "open", "further"];
      const stayWords = ["no", "nope", "wrong", "change", "retry", "edit", "incorrect", "stay", "cancel", "wait", "stop"];

      if (loginWords.some(w => cleanText.includes(w))) {
        speak("Opening Student Login page now.", () => {
          setTimeout(() => {
            setShowSuccessPopup(false);
            navigate("/student-login");
          }, 350);
        });
      } else if (stayWords.some(w => cleanText.includes(w))) {
        speak("Staying on this screen. Tap Proceed to Login or say YES whenever you are ready to proceed.", () => {
          setIsListening(false);
        });
      } else {
        speak("Please say YES or LOGIN to go to the login page, or say NO to stay.", () => {
          setTimeout(() => triggerVoiceReset("confirm_go_to_login"), 400);
        });
      }
      return;
    }
  };

  // Student Direct Reset Handler (No Gmail OTP required!)
  const handleStudentDirectReset = async (e, emailVal = null, passVal = null, confirmVal = null) => {
    if (e) e.preventDefault();
    setErrorMessage("");
    setInfoMessage("");

    const targetEmail = (emailVal || email || "").trim();
    const targetPass = (passVal || newPassword || "").trim();
    const targetConfirm = (confirmVal || confirmPassword || "").trim();

    const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
    if (!targetEmail || !GMAIL_REGEX.test(targetEmail)) {
      const msg = "Invalid Gmail address. Email must end with @gmail.com with no trailing characters.";
      setErrorMessage(msg);
      speak(msg, () => setTimeout(() => triggerVoiceReset("email"), 400));
      return;
    }

    if (!targetPass || targetPass.length < 6) {
      const msg = "New password must be at least 6 characters long.";
      setErrorMessage(msg);
      speak(msg, () => setTimeout(() => triggerVoiceReset("password"), 400));
      return;
    }

    if (!/^[a-zA-Z0-9]+$/.test(targetPass)) {
      const msg = "Student password must contain only alphabets and numbers (no special characters).";
      setErrorMessage(msg);
      speak(msg, () => setTimeout(() => triggerVoiceReset("password"), 400));
      return;
    }

    if (targetPass !== targetConfirm) {
      const msg = "Set Password and Confirm Password do not match. Please re-enter.";
      setErrorMessage(msg);
      speak(msg, () => setTimeout(() => triggerVoiceReset("password"), 400));
      return;
    }

    setIsSubmitting(true);
    setIsListening(false);

    try {
      const res = await resetPasswordDirectApi(targetEmail, targetPass, "student");
      setIsSubmitting(false);

      if (res && res.success) {
        setShowSuccessPopup(true);
        setTimeout(() => {
          triggerVoiceReset("confirm_go_to_login");
        }, 300);
      } else {
        const errStr = res.message || "Failed to update password.";
        setErrorMessage(errStr);
        speak(errStr);
      }
    } catch (err) {
      setIsSubmitting(false);
      setErrorMessage("Password reset error. Please try again.");
      speak("Password reset error. Please try again.");
    }
  };

  // Teacher / Admin OTP Handler: Stage 1 Send OTP
  const handleFacultySendOtp = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage("");
    setInfoMessage("");
    setEnteredOtp("");

    const cleanEmail = (email || "").trim().toLowerCase();
    const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      setErrorMessage("Please enter a valid email address (e.g. yourname@gmail.com).");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await sendOtpApi(cleanEmail, role);
      setIsSubmitting(false);

      if (res && res.success) {
        setEnteredOtp("");
        setStep(2);
        setInfoMessage(`📩 A 6-digit OTP verification code has been sent directly to ${cleanEmail}. Please check your Inbox (and Spam folder) and enter the code below.`);
      } else {
        setErrorMessage(res?.message || "Could not send OTP code to your email. Please try again.");
      }
    } catch (err) {
      setIsSubmitting(false);
      setErrorMessage("Failed to send OTP email. Please ensure your backend is running and internet is active.");
    }
  };

  // Teacher / Admin OTP Handler: Stage 2 Verify OTP & Reset
  const handleFacultyVerifyAndReset = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage("");

    const cleanOtp = (enteredOtp || "").trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setErrorMessage("Please enter the 6-digit OTP code sent to your email.");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setErrorMessage("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please re-enter.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await verifyOtpApi(email.trim().toLowerCase(), cleanOtp, newPassword);
      setIsSubmitting(false);

      if (res && res.success) {
        setShowSuccessPopup(true);
      } else {
        setErrorMessage(res?.message || "Invalid OTP code. Please enter the correct 6-digit code received in your email.");
      }
    } catch (err) {
      setIsSubmitting(false);
      setErrorMessage("OTP verification failed. Please try again.");
    }
  };

  const handleTapScreenAnywhere = (e) => {
    if (!isStudent) return; // Only blind student portal responds to tap screen voice
    if (isListening) return;
    if (isManuallyClosedRef.current) return;
    if (e.target.closest("button") || e.target.closest("input") || e.target.closest("a") || e.target.closest("form")) {
      return;
    }
    triggerVoiceReset("email");
  };

  const handleModalClose = () => {
    setShowSuccessPopup(false);
    cancelSpeech();
    if (role === "teacher") navigate("/teacher-login");
    else if (role === "admin") navigate("/admin-login");
    else navigate("/student-login");
  };

  // Role Header Label
  const getRoleEmailLabel = () => {
    if (role === "teacher") return "👨‍🏫 TEACHER REGISTERED EMAIL ADDRESS";
    if (role === "admin") return "🛡️ ADMIN REGISTERED EMAIL ADDRESS";
    return "🎓 STUDENT REGISTERED EMAIL ADDRESS";
  };

  return (
    <div
      onClick={handleTapScreenAnywhere}
      style={{
        minHeight: "100vh", background: "#f0f9ff", display: "flex", flexDirection: "column",
        justifyContent: "center", alignItems: "center", padding: "24px", boxSizing: "border-box",
        fontFamily: "'Inter', system-ui, sans-serif"
      }}
    >
      {/* VOICE LISTENING OVERLAY FOR BLIND STUDENTS */}
      {isListening && isStudent && (
        <div 
          onClick={handleCloseVoiceOverlay}
          style={{
            position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
            background: "rgba(2, 132, 199, 0.65)", zIndex: 99999,
            display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
            backdropFilter: "blur(8px)", padding: "20px"
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
            background: "#ffffff", width: "90%", maxWidth: "560px", padding: "36px 40px", borderRadius: "28px",
            border: "4px solid #0284c7", textAlign: "center", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
            boxSizing: "border-box"
          }}>
            <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "#e0f2fe", display: "grid", placeItems: "center", margin: "0 auto 16px auto", border: "4px solid #0284c7", boxShadow: "0 0 20px rgba(2, 132, 199, 0.4)" }}>
              <Mic size={44} color="#0284c7" style={{ animation: "pulse 1.2s infinite" }} />
            </div>

            <h2 style={{ fontSize: "24px", color: "#0369a1", margin: "0 0 12px 0", fontWeight: "900" }}>
              🎙️ Voice Assistant Active & Listening!
            </h2>

            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#e0f2fe", color: "#0369a1", padding: "6px 14px", borderRadius: "16px", fontSize: "13px", fontWeight: "800", marginBottom: "14px" }}>
              {activeVoiceField === "email" ? "🗣️ Step 1: Speak Your Student Email Address" :
               activeVoiceField === "confirm_email" ? `🗣️ Email: ${pendingEmailRef.current || email} — Say CONFIRM or NO` :
               activeVoiceField === "password" ? "🗣️ Step 2: Speak Your New Password" :
               activeVoiceField === "confirm_password" ? "🗣️ Step 3: Speak Confirm Password" :
               activeVoiceField === "final_confirm" ? "🗣️ Confirm All Details — Say CONFIRM to Save" :
               activeVoiceField === "confirm_go_to_login" ? "🎉 Password Updated: Say YES or LOGIN to Proceed, or NO to Stay" :
               "🎙️ Listening for Voice Input"}
            </div>
            
            {/* Live Real-time Speech Transcript Display */}
            <div style={{ background: "#f0f9ff", border: "2px dashed #0284c7", padding: "20px 16px", borderRadius: "20px", margin: "12px 0 20px 0", minHeight: "80px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ margin: 0, fontSize: "17px", color: liveTranscript ? "#0f172a" : "#0369a1", fontWeight: "800", textAlign: "center", lineHeight: 1.5, wordBreak: "break-word" }}>
                {liveTranscript ? `"${liveTranscript}"` : (
                  activeVoiceField === "confirm_go_to_login" ? "🗣️ Say YES, LOGIN, or CONFIRM to proceed to the Student Login page, or say NO to stay." :
                  "🎙️ Listening... Speak your response clearly."
                )}
              </p>
            </div>

            {/* Quick Action Shortcuts */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", marginBottom: "18px" }}>
              {activeVoiceField === "confirm_go_to_login" ? (
                <>
                  <button 
                    type="button"
                    onClick={() => { setIsListening(false); cancelSpeech(); navigate("/student-login"); }}
                    style={{ background: "#16a34a", color: "#fff", border: "none", padding: "12px 24px", borderRadius: "12px", fontSize: "14px", fontWeight: "800", cursor: "pointer", boxShadow: "0 4px 12px rgba(22, 163, 74, 0.3)" }}
                  >
                    🚀 Proceed to Student Login (Say YES)
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setIsListening(false); cancelSpeech(); speak("Staying on reset screen."); }}
                    style={{ background: "#64748b", color: "#fff", border: "none", padding: "12px 20px", borderRadius: "12px", fontSize: "14px", fontWeight: "800", cursor: "pointer" }}
                  >
                    ✖ Stay on Screen (Say NO)
                  </button>
                </>
              ) : (
                <>
                  <button 
                    type="button"
                    onClick={() => {
                      setEmail("nayanansnayanans@gmail.com");
                      setNewPassword("nayana123");
                      setConfirmPassword("nayana123");
                      speak("Filled student email and new password.");
                    }}
                    style={{ background: "#0284c7", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "10px", fontSize: "12px", fontWeight: "800", cursor: "pointer" }}
                  >
                    ⚡ Fill Demo (nayanansnayanans@gmail.com)
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleStudentDirectReset(null, email || "nayanansnayanans@gmail.com", newPassword || "nayana123", confirmPassword || "nayana123")}
                    style={{ background: "#16a34a", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "10px", fontSize: "12px", fontWeight: "800", cursor: "pointer" }}
                  >
                    🔒 Set & Save Password
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
                  setManualCommandInput("");
                }
              }}
              style={{ display: "flex", gap: "8px", marginBottom: "16px" }}
            >
              <input 
                type="text"
                placeholder="Or type voice response here..."
                value={manualCommandInput}
                onChange={(e) => setManualCommandInput(e.target.value)}
                style={{ flex: 1, padding: "12px 16px", borderRadius: "12px", border: "1px solid #cbd5e1", fontSize: "14px", fontWeight: "600" }}
              />
              <button 
                type="submit"
                style={{ background: "#0284c7", color: "#ffffff", border: "none", padding: "12px 20px", borderRadius: "12px", fontWeight: "800", cursor: "pointer" }}
              >
                Send
              </button>
            </form>

            <button 
              type="button"
              onClick={handleCloseVoiceOverlay}
              style={{ background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", padding: "10px 24px", borderRadius: "12px", fontSize: "13px", fontWeight: "800", cursor: "pointer" }}
            >
              ✕ Close Voice Overlay
            </button>
          </div>
        </div>
      )}

      {/* CARD */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: "480px", background: "#ffffff", border: `2px solid ${roleColor}`,
          padding: "36px 32px", borderRadius: "24px", boxShadow: `0 20px 40px -15px ${roleColor}33`, boxSizing: "border-box"
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "20px" }}>
          <ProjectLogo size="large" />
          <p style={{ fontSize: "13px", color: roleColorDark, margin: "6px 0 0 0", fontWeight: "700" }}>
            {isStudent ? "Student Accessible Password Reset" : `${role === "teacher" ? "Teacher" : "Admin"} Password Recovery`}
          </p>
        </div>

        {/* Voice Indicator Banner (Visible for Blind Student Portal) */}
        {isStudent && (
          <div 
            onClick={() => {
              isManuallyClosedRef.current = false;
              triggerVoiceReset("email");
            }}
            style={{
              padding: "12px 16px", borderRadius: "14px", background: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)",
              border: "2px solid #0284c7", marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between",
              cursor: "pointer", boxShadow: "0 4px 12px rgba(2, 132, 199, 0.15)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ background: "#0284c7", padding: "8px", borderRadius: "50%", color: "#ffffff" }}>
                <Mic size={18} />
              </div>
              <div>
                <b style={{ fontSize: "13px", color: "#0369a1", display: "block" }}>Tap Screen Anywhere to Activate Voice</b>
                <small style={{ fontSize: "11px", color: "#0284c7" }}>Step-by-step voice guidance to set your password</small>
              </div>
            </div>
            <Sparkles size={18} color="#0284c7" />
          </div>
        )}

        {/* Error / Info Banners */}
        {errorMessage && (
          <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", color: "#dc2626", padding: "10px 14px", borderRadius: "10px", fontSize: "13px", marginBottom: "16px", fontWeight: "700", textAlign: "center" }}>
            ⚠️ {errorMessage}
          </div>
        )}

        {infoMessage && (
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", color: "#166534", padding: "10px 14px", borderRadius: "10px", fontSize: "13px", marginBottom: "16px", fontWeight: "700", textAlign: "center" }}>
            {infoMessage}
          </div>
        )}

        {/* Account Role Badge */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ fontSize: "12px", color: roleColorDark, fontWeight: "800", display: "block", marginBottom: "6px" }}>
            ACCOUNT ROLE
          </label>
          <div style={{
            padding: "12px 16px", borderRadius: "12px", background: roleBgLight,
            border: `2px solid ${roleColor}`, color: roleColorDark, fontWeight: "900", fontSize: "14px",
            display: "flex", alignItems: "center", justifyContent: "space-between"
          }}>
            <span>
              {role === "student" ? "🎓 Student Portal Account" :
               role === "teacher" ? "👨‍🏫 Teacher Portal Account" :
               "🛡️ Admin Portal Account"}
            </span>
            <span style={{ fontSize: "11px", background: roleColor, color: "#ffffff", padding: "3px 8px", borderRadius: "8px", fontWeight: "700" }}>
              CONFIRMED
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* STUDENT PORTAL FORGOT PASSWORD: DIRECT SET PASSWORD & CONFIRM PASSWORD    */}
        {/* ========================================================================= */}
        {isStudent ? (
          <form onSubmit={handleStudentDirectReset} autoComplete="off" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Hidden inputs to absorb browser autofill */}
            <input type="text" style={{ display: 'none' }} tabIndex="-1" autoComplete="off" />
            <input type="password" style={{ display: 'none' }} tabIndex="-1" autoComplete="new-password" />

            {/* 1. Student Registered Email Address */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ fontSize: "12px", color: "#0369a1", fontWeight: "800" }}>
                  STUDENT REGISTERED EMAIL ADDRESS
                </label>
                <button 
                  type="button" 
                  onClick={() => {
                    isManuallyClosedRef.current = false;
                    triggerVoiceReset("email");
                  }}
                  style={{ background: "#e0f2fe", color: "#0284c7", border: "1px solid #bae6fd", padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <Mic size={12} /> Speak Email
                </button>
              </div>
              <div style={{ position: "relative" }}>
                <Mail size={18} color="#0284c7" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
                <input
                  ref={emailInputRef}
                  type="email"
                  name="forgot_student_email"
                  autoComplete="off"
                  placeholder="e.g. nayanansnayanans@gmail.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMessage("");
                  }}
                  style={inputStyle}
                  required
                />
              </div>
            </div>

            {/* Password Rule Notice */}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 12px', fontSize: '12px', color: '#1e40af', fontWeight: '600', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <span style={{ fontSize: '15px', lineHeight: '1.2' }}>ℹ️</span>
              <div style={{ lineHeight: '1.4' }}>
                <strong style={{ color: '#1d4ed8' }}>Password Rule:</strong> Must contain <strong>only alphabets (A-Z, a-z) and numbers (0-9)</strong>. No special characters or symbols are allowed.
              </div>
            </div>

            {/* 2. Set Password */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ fontSize: "12px", color: "#0369a1", fontWeight: "800" }}>
                  SET PASSWORD (alphabets & numbers only)
                </label>
                <button 
                  type="button" 
                  onClick={() => {
                    isManuallyClosedRef.current = false;
                    triggerVoiceReset("password");
                  }}
                  style={{ background: "#e0f2fe", color: "#0284c7", border: "1px solid #bae6fd", padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <Mic size={12} /> Speak Password
                </button>
              </div>
              <div style={{ position: "relative" }}>
                <Lock size={18} color="#0284c7" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
                <input
                  ref={passwordInputRef}
                  type={showPassword ? "text" : "password"}
                  name="forgot_student_new_password"
                  autoComplete="new-password"
                  placeholder="Enter new password (alphabets & numbers only, min 6 chars)"
                  value={newPassword}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
                    setNewPassword(val);
                    setErrorMessage("");
                  }}
                  style={{ ...inputStyle, paddingRight: "44px" }}
                  required
                />
                <button
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <small style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block" }}>Only letters (a-z, A-Z) and numbers (0-9) are allowed.</small>
            </div>

            {/* 3. Confirm Password */}
            <div>
              <label style={{ fontSize: "12px", color: "#0369a1", fontWeight: "800", display: "block", marginBottom: "6px" }}>
                CONFIRM PASSWORD
              </label>
              <div style={{ position: "relative" }}>
                <Lock size={18} color="#0284c7" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type={showPassword ? "text" : "password"}
                  name="forgot_student_confirm_password"
                  autoComplete="new-password"
                  placeholder="Re-enter password to confirm (alphabets & numbers only)"
                  value={confirmPassword}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
                    setConfirmPassword(val);
                    setErrorMessage("");
                  }}
                  style={{ ...inputStyle, paddingRight: "44px" }}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: "100%", padding: "14px", borderRadius: "12px",
                backgroundColor: isSubmitting ? "#94a3b8" : "#0284c7", color: "#ffffff", fontWeight: "800",
                fontSize: "15px", border: "none", cursor: isSubmitting ? "not-allowed" : "pointer", marginTop: "6px",
                boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
              }}
            >
              <ShieldCheck size={18} /> {isSubmitting ? "Saving Password..." : "Set & Confirm Password"}
            </button>
          </form>
        ) : (
          /* ========================================================================= */
          /* TEACHER & ADMIN PORTAL: VERIFICATION VIA FACULTY EMAIL ADDRESS            */
          /* ========================================================================= */
          step === 1 ? (
            <form onSubmit={handleFacultySendOtp} autoComplete="off" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Hidden inputs to absorb browser autofill */}
              <input type="text" style={{ display: 'none' }} tabIndex="-1" autoComplete="off" />
              <input type="password" style={{ display: 'none' }} tabIndex="-1" autoComplete="new-password" />

              <div>
                <label style={{ fontSize: "12px", color: "#0369a1", fontWeight: "800", display: "block", marginBottom: "6px" }}>
                  {getRoleEmailLabel()}
                </label>
                <div style={{ position: "relative" }}>
                  <Mail size={18} color="#0284c7" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    ref={emailInputRef}
                    type="email"
                    name="forgot_faculty_email"
                    autoComplete="off"
                    placeholder="Enter your registered email (e.g. name@gmail.com)"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrorMessage("");
                    }}
                    style={inputStyle}
                    required
                  />
                </div>
                <span style={{ fontSize: "12px", color: "#64748b", marginTop: "6px", display: "block" }}>
                  💡 Enter your real email address. A real 6-digit verification code will be emailed directly to your inbox.
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  width: "100%", padding: "14px", borderRadius: "12px",
                  backgroundColor: isSubmitting ? "#94a3b8" : roleColor, color: "#ffffff", fontWeight: "800",
                  fontSize: "15px", border: "none", cursor: isSubmitting ? "not-allowed" : "pointer", marginTop: "6px",
                  boxShadow: `0 4px 12px ${roleColor}4d`,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
                }}
              >
                <ShieldCheck size={18} /> {isSubmitting ? "Sending Real OTP..." : "Send OTP Code"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleFacultyVerifyAndReset} autoComplete="off" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Hidden inputs to absorb browser autofill */}
              <input type="text" style={{ display: 'none' }} tabIndex="-1" autoComplete="off" />
              <input type="password" style={{ display: 'none' }} tabIndex="-1" autoComplete="new-password" />

              <div style={{ background: roleBgLight, padding: "14px", borderRadius: "12px", border: `1px solid ${roleBorderLight}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: "13px", color: roleColorDark, fontWeight: "800", display: "block" }}>
                    📩 OTP Sent to: <span style={{ textDecoration: "underline" }}>{email}</span>
                  </span>
                  <small style={{ fontSize: "11px", color: "#64748b" }}>Check your Inbox and Spam folder for the 6-digit code.</small>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{ background: roleBgLight, border: `1px solid ${roleBorderLight}`, color: roleColor, fontSize: "11px", fontWeight: "800", cursor: "pointer", padding: "4px 8px", borderRadius: "6px" }}
                >
                  Change Email
                </button>
              </div>

              {/* OTP Field */}
              <div>
                <label style={{ fontSize: "12px", color: "#0369a1", fontWeight: "800", display: "block", marginBottom: "6px" }}>
                  ENTER 6-DIGIT OTP CODE FROM EMAIL
                </label>
                <div style={{ position: "relative" }}>
                  <Key size={18} color="#0284c7" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    ref={otpInputRef}
                    type="text"
                    name="forgot_faculty_otp"
                    inputMode="numeric"
                    autoComplete="off"
                    autoFocus
                    maxLength="6"
                    placeholder="Enter 6-digit code from email"
                    value={enteredOtp}
                    onChange={(e) => {
                      const cleanDigits = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setEnteredOtp(cleanDigits);
                      setErrorMessage("");
                    }}
                    style={{ ...inputStyle, letterSpacing: "4px", fontSize: "16px", fontWeight: "bold" }}
                    required
                  />
                </div>
                <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block" }}>
                  Please open your email inbox and enter the 6-digit verification code.
                </span>
              </div>

              {/* New Password */}
              <div>
                <label style={{ fontSize: "12px", color: "#0369a1", fontWeight: "800", display: "block", marginBottom: "6px" }}>
                  New Password
                </label>
                <div style={{ position: "relative" }}>
                  <Lock size={18} color="#0284c7" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    ref={passwordInputRef}
                    type={showPassword ? "text" : "password"}
                    name="forgot_faculty_new_password"
                    autoComplete="new-password"
                    placeholder="New Password (min 6 chars)"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setErrorMessage("");
                    }}
                    style={{ ...inputStyle, paddingRight: "44px" }}
                    required
                  />
                  <button
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label style={{ fontSize: "12px", color: "#0369a1", fontWeight: "800", display: "block", marginBottom: "6px" }}>
                  Confirm New Password
                </label>
                <div style={{ position: "relative" }}>
                  <Lock size={18} color="#0284c7" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="forgot_faculty_confirm_password"
                    autoComplete="new-password"
                    placeholder="Confirm New Password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setErrorMessage("");
                    }}
                    style={{ ...inputStyle, paddingRight: "44px" }}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  width: "100%", padding: "14px", borderRadius: "12px",
                  backgroundColor: isSubmitting ? "#94a3b8" : roleColor, color: "#ffffff", fontWeight: "800",
                  fontSize: "15px", border: "none", cursor: isSubmitting ? "not-allowed" : "pointer", marginTop: "6px",
                  boxShadow: `0 4px 12px ${roleColor}4d`
                }}
              >
                {isSubmitting ? "Verifying OTP..." : "Verify OTP & Reset Password"}
              </button>
            </form>
          )
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "16px", flexWrap: "wrap", gap: "8px" }}>
          <Link 
            to={role === "teacher" ? "/teacher-login" : role === "admin" ? "/admin-login" : "/student-login"} 
            style={{ fontSize: "13px", color: roleColor, textDecoration: "none", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "4px" }}
          >
            <ArrowLeft size={14} /> Back to {role === "teacher" ? "Teacher Login" : role === "admin" ? "Admin Login" : "Student Login"}
          </Link>
          <Link to="/home" style={{ fontSize: "13px", color: "#475569", textDecoration: "none", fontWeight: "600" }}>
            Go to Home Page →
          </Link>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessPopup && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: `${roleColor}40`, display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#ffffff", border: `2px solid ${roleColor}`, padding: "32px", borderRadius: "24px", textAlign: "center", maxWidth: "400px", width: "90%", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
            <CheckCircle size={52} color="#22c55e" style={{ marginBottom: "14px" }} />
            <h2 style={{ fontSize: "22px", color: "#0f172a", marginBottom: "8px", fontWeight: "900" }}>Password Updated!</h2>
            <p style={{ fontSize: "14px", color: "#334155", marginBottom: "16px" }}>Your account password has been updated successfully.</p>
            
            {isStudent && (
              <div style={{ background: "#f0f9ff", border: "2px dashed #0284c7", padding: "12px 16px", borderRadius: "14px", marginBottom: "20px" }}>
                <p style={{ fontSize: "13px", color: "#0369a1", fontWeight: "800", margin: 0 }}>
                  🎙️ Voice Confirmation Active:<br/>
                  Say <strong>"YES"</strong> or <strong>"LOGIN"</strong> to proceed,<br/>
                  or say <strong>"NO"</strong> to stay.
                </p>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button 
                type="button" 
                onClick={handleModalClose} 
                style={{ width: "100%", padding: "14px", borderRadius: "12px", backgroundColor: roleColor, color: "#fff", border: "none", fontWeight: "800", fontSize: "15px", cursor: "pointer", boxShadow: `0 4px 12px ${roleColor}4d` }}
              >
                🚀 Proceed to Login (Say YES)
              </button>
              <button 
                type="button" 
                onClick={() => { setShowSuccessPopup(false); cancelSpeech(); stopRecognition(); }} 
                style={{ width: "100%", padding: "10px", borderRadius: "10px", backgroundColor: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
              >
                ✖ Stay on This Screen (Say NO)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "14px 14px 14px 42px",
  borderRadius: "12px",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
  backgroundColor: "#ffffff",
  color: "#0f172a",
  border: "1px solid #bae6fd",
};