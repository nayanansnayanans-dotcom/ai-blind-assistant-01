import React, { useState, useEffect, useRef } from "react";
import { speakIn } from "./speech";
import "../styles/VoiceAssistant.css";

const VoiceAssistant = ({ currentPage, goToLogin, goToRegister, setActiveField, setAssistantInput }) => {
  const [isListening, setIsListening] = useState(false);
  const [mode, setMode] = useState("voice"); // 'voice' | 'typing'
  const [typedText, setTypedText] = useState("");
  const [message, setMessage] = useState("Tap anywhere to activate voice, or switch to typing mode.");

  const recognitionRef = useRef(null);

  // Helper to get current active language code from localStorage or default to en-US
  const getCurrentLang = () => {
    return localStorage.getItem("vision_assist_lang") || "en-US";
  };

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      // Dynamic Language Assignment based on header selection
      recognition.lang = getCurrentLang();

      recognition.onstart = () => {
        setIsListening(true);
        setMessage("Listening... Speak your command or input.");
      };

      recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        setMessage(`Heard: "${text}"`);
        handleInputProcessing(text);
      };

      recognition.onerror = () => {
        setIsListening(false);
        setMessage("Could not understand. Try speaking again.");
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [currentPage]);

  const speakFeedback = (text) => {
    speakIn(text, getCurrentLang());
  };

  const handleInputProcessing = (input) => {
    if (!input.trim()) return;
    const cleanInput = input.trim().toLowerCase();

    // Navigation Commands
    if (cleanInput.includes("go to login") || cleanInput.includes("open login")) {
      goToLogin();
      speakFeedback("Navigating to login");
      return;
    }
    if (cleanInput.includes("go to register") || cleanInput.includes("open register")) {
      goToRegister();
      speakFeedback("Navigating to registration");
      return;
    }

    // Submit Command
    if (cleanInput === "submit" || cleanInput === "login" || cleanInput === "register") {
      document.querySelector('button[type="submit"]')?.click();
      return;
    }

    // Field Switching Commands
    if (cleanInput.includes("select username") || cleanInput === "username") {
      setActiveField(currentPage === "login" ? "username" : "reg-username");
      speakFeedback("Username field selected");
      return;
    }
    if (cleanInput.includes("select password") || cleanInput === "password") {
      setActiveField(currentPage === "login" ? "password" : "reg-password");
      speakFeedback("Password field selected");
      return;
    }

    // Send Value to Active Form Field
    setAssistantInput(input);
  };

  const startVoice = () => {
    if (mode !== "voice" || isListening) return;
    try {
      if (recognitionRef.current) {
        // Re-update language right before starting recognition
        recognitionRef.current.lang = getCurrentLang();
        recognitionRef.current.start();
      }
    } catch (e) {
      // Recognition already running
    }
  };

  const handleTypeSubmit = (e) => {
    e.preventDefault();
    if (!typedText) return;
    setMessage(`Typed: "${typedText}"`);
    handleInputProcessing(typedText);
    setTypedText("");
  };

  return (
    <>
      {mode === "voice" && (
        <div className="screen-touch-overlay" onClick={startVoice} aria-hidden="true" />
      )}

      <div className="voice-assistant">
        <div className="mode-toggle">
          <button
            type="button"
            className={`mode-btn ${mode === "voice" ? "active" : ""}`}
            onClick={() => {
              setMode("voice");
              setMessage("Voice mode active. Tap screen to speak.");
              speakFeedback("Switched to voice mode");
            }}
          >
            🎙️ Voice
          </button>
          <button
            type="button"
            className={`mode-btn ${mode === "typing" ? "active" : ""}`}
            onClick={() => {
              setMode("typing");
              setMessage("Typing mode active.");
              speakFeedback("Switched to typing mode");
            }}
          >
            ⌨️ Typing
          </button>
        </div>

        {mode === "voice" ? (
          <div className="voice-interface">
            <div className="voice-status">
              <span className={`status-dot ${isListening ? "listening" : ""}`}></span>
              <span>{isListening ? "Listening..." : "Voice Ready"}</span>
            </div>
            <button type="button" className="voice-button" onClick={startVoice}>
              🎙️
            </button>
          </div>
        ) : (
          <form onSubmit={handleTypeSubmit} className="typing-interface">
            <input
              type="text"
              className="typing-input"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder="Type value or command..."
            />
            <button type="submit" className="typing-send-btn">
              Send
            </button>
          </form>
        )}

        <div className="voice-message">{message}</div>
      </div>
    </>
  );
};

export default VoiceAssistant;