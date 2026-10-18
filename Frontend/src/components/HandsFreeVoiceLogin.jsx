import React, { useState, useEffect, useRef } from "react";
import { speakIn, cancelSpeech } from "./speech";

const HandsFreeVoiceLogin = ({ onLoginSuccess, goToRegister, onForgotPassword }) => {
  const [role, setRole] = useState("user");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isStarted, setIsStarted] = useState(false);
  const [statusText, setStatusText] = useState("Click anywhere once to activate Voice Mode");

  useEffect(() => {
    setUsername("");
    setPassword("");
    const clearTimer = setTimeout(() => {
      setUsername("");
      setPassword("");
    }, 150);
    return () => clearTimeout(clearTimer);
  }, []);

  const recognitionRef = useRef(null);

  const speak = (text) => {
    cancelSpeech();
    speakIn(text);
  };

  const initVoice = () => {
    if (isStarted) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsStarted(true);
      setStatusText("🎙️ Voice Assistant Active. Speak commands or hover over fields.");
      speak("Voice assistant activated.");
    };

    recognition.onresult = (event) => {
      const lastIndex = event.results.length - 1;
      const transcript = event.results[lastIndex][0].transcript.toLowerCase().trim();

      if (transcript.includes("register") || transcript.includes("create account")) {
        speak("Navigating to registration page.");
        if (goToRegister) goToRegister();
        return;
      }

      if (transcript.startsWith("username") || transcript.startsWith("email")) {
        const val = transcript.replace(/^(username|email)\s*(is|to)?\s*/i, "").replace(/\s+/g, "");
        if (val) {
          setUsername(val);
          speak(`Username set to ${val}`);
        }
        return;
      }

      if (transcript.startsWith("password")) {
        const val = transcript.replace(/^password\s*(is|to)?\s*/i, "").replace(/\s+/g, "");
        if (val) {
          setPassword(val);
          speak("Password recorded");
        }
        return;
      }

      if (transcript.includes("login") || transcript.includes("submit")) {
        speak("Logging in");
        if (onLoginSuccess) onLoginSuccess({ username, role });
        return;
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    speak("Submitting login");
    if (onLoginSuccess) {
      onLoginSuccess({ username, role });
    }
  };

  return (
    <div style={styles.fullScreenContainer} onClick={initVoice}>
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        <h1 style={styles.title}>Login</h1>

        <div style={styles.roleContainer}>
          {["user", "admin", "others"].map((roleOption) => (
            <button
              key={roleOption}
              type="button"
              onClick={() => {
                setRole(roleOption);
                speak(`Role switched to ${roleOption}`);
              }}
              style={{
                ...styles.roleTab,
                ...(role === roleOption ? styles.activeRoleTab : {}),
              }}
            >
              {roleOption.charAt(0).toUpperCase() + roleOption.slice(1)}
            </button>
          ))}
        </div>

        <div
          style={{
            ...styles.statusBanner,
            backgroundColor: isStarted ? "#1d4ed8" : "#991b1b",
            borderColor: isStarted ? "#60a5fa" : "#f87171",
          }}
        >
          {statusText}
        </div>

        <form onSubmit={handleLoginSubmit} autoComplete="off" style={styles.form}>
          {/* Hidden inputs to absorb browser autofill */}
          <input type="text" style={{ display: 'none' }} tabIndex="-1" autoComplete="off" />
          <input type="password" style={{ display: 'none' }} tabIndex="-1" autoComplete="new-password" />

          <div style={styles.inputGroup}>
            <label style={styles.label}>Username or Email</label>
            <input
              type="text"
              name="handsfree_username"
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter or say 'Username [name]'"
              style={styles.input}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              name="handsfree_password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter or say 'Password [pass]'"
              style={styles.input}
            />
          </div>

          <button type="submit" style={styles.button}>
            Login as {role.toUpperCase()}
          </button>
        </form>

        <div style={styles.footer}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onForgotPassword) onForgotPassword();
            }}
            style={styles.forgotBtn}
          >
            Forgot Password?
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              speak("Navigating to register page.");
              if (goToRegister) goToRegister();
            }}
            style={styles.linkBtn}
          >
            Don't have an account? Register Here
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  fullScreenContainer: {
    minHeight: "100vh",
    width: "100vw",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#05070d",
    fontFamily: "system-ui, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: "420px",
    padding: "36px 32px",
    backgroundColor: "#0a0d18",
    borderRadius: "16px",
    border: "1px solid #141a2e",
    textAlign: "center",
  },
  title: { color: "#8b9bb4", fontSize: "32px", marginBottom: "16px" },
  roleContainer: {
    display: "flex",
    backgroundColor: "#060810",
    padding: "4px",
    borderRadius: "10px",
    marginBottom: "16px",
  },
  roleTab: {
    flex: 1,
    padding: "10px 0",
    backgroundColor: "transparent",
    color: "#64748b",
    border: "none",
    borderRadius: "8px",
    fontWeight: "600",
    cursor: "pointer",
  },
  activeRoleTab: { backgroundColor: "#1d4ed8", color: "#ffffff" },
  statusBanner: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: "10px",
    color: "#ffffff",
    border: "1px solid",
    marginBottom: "20px",
    fontSize: "13px",
  },
  form: { display: "flex", flexDirection: "column", gap: "18px" },
  inputGroup: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "6px" },
  label: { color: "#5b6b82", fontSize: "13px" },
  input: {
    width: "100%",
    padding: "12px 16px",
    backgroundColor: "#060810",
    border: "2px solid #1d4ed8",
    borderRadius: "10px",
    color: "#e2e8f0",
    outline: "none",
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    padding: "14px",
    marginTop: "10px",
    backgroundColor: "#6b4321",
    color: "#ffffff",
    border: "none",
    borderRadius: "10px",
    fontWeight: "700",
    cursor: "pointer",
  },
  footer: {
    marginTop: "24px",
    borderTop: "1px solid #141a2a",
    paddingTop: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  forgotBtn: { background: "none", border: "none", color: "#60a5fa", cursor: "pointer" },
  linkBtn: { background: "none", border: "none", color: "#7c4d25", cursor: "pointer" },
};

export default HandsFreeVoiceLogin;