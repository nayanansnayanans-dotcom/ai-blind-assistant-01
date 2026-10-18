import { useState, useRef, useEffect } from "react";
import { speakIn, cancelSpeech } from "../components/speech";

export const cleanCapturedVoice = (rawText) => {
  if (!rawText) return "";
  let text = String(rawText).trim();

  // Normalize spoken special characters for email, password, and text fields
  text = text
    .replace(/\b(at the rate|at sign)\b/gi, "@")
    .replace(/\b(dot com)\b/gi, ".com")
    .replace(/\b(dot in)\b/gi, ".in")
    .replace(/\b(dot org)\b/gi, ".org")
    .replace(/\b(underscore)\b/gi, "_")
    .replace(/\b(dash|hyphen)\b/gi, "-")
    .replace(/\b(space)\b/gi, " ");

  // Filter out verbal hesitation words
  text = text.replace(/\b(um+|uh+|err+|ah+)\b/gi, "").trim();

  // Capitalize cleanly
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const useVoiceAssistant = () => {
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [activeHoverField, setActiveHoverField] = useState(null);
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    return () => stopVoice();
  }, []);

  const speakText = (text, callback) => {
    speakIn(text, "en-US", { onEnd: callback });
  };

  const stopVoice = () => {
    isListeningRef.current = false;
    setIsVoiceActive(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
    }
    cancelSpeech();
  };

  const startVoice = (onSpeechCaptured) => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in Google Chrome.");
      return;
    }

    if (recognitionRef.current && isListeningRef.current) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false; // Capture discrete, clear utterances neatly
    recognition.interimResults = false; // Wait for full final sentence clarity
    recognition.maxAlternatives = 3; // Check best alternatives
    recognition.lang = localStorage.getItem("vision_assist_lang") || "en-US";

    recognition.onstart = () => {
      isListeningRef.current = true;
      setIsVoiceActive(true);
      speakText("Voice assistant active and listening carefully. Speak clearly now.");
    };

    recognition.onresult = (event) => {
      // Pick highest confidence alternative
      const alternatives = Array.from(event.results[event.results.length - 1]);
      const bestMatch = alternatives.reduce((prev, curr) => 
        (curr.confidence > (prev.confidence || 0)) ? curr : prev
      , alternatives[0]);

      const rawTranscript = bestMatch ? bestMatch.transcript : "";
      const cleanedTranscript = cleanCapturedVoice(rawTranscript);

      if (cleanedTranscript && onSpeechCaptured) {
        speakText(`Captured: ${cleanedTranscript}`);
        onSpeechCaptured(cleanedTranscript);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech") {
        speakText("No voice heard. Please tap screen and try speaking again.");
      } else {
        console.error("Voice recognition error:", event.error);
      }
      isListeningRef.current = false;
      setIsVoiceActive(false);
    };

    recognition.onend = () => {
      if (isListeningRef.current) {
        try { recognition.start(); } catch (e) {}
      } else {
        setIsVoiceActive(false);
      }
    };

    recognitionRef.current = recognition;
    try { 
      recognition.start(); 
    } catch (e) {
      console.error("Failed to start voice:", e);
    }
  };

  const handleScreenClick = (onSpeechCaptured) => {
    if (!isVoiceActive) {
      startVoice(onSpeechCaptured);
    } else {
      speakText("Voice assistant active. Please speak your command clearly.");
    }
  };

  const handleMouseEnter = (text) => {
    setActiveHoverField(text);
    speakText(text);
  };

  const handleMouseLeave = () => {
    setActiveHoverField(null);
  };

  return {
    isVoiceActive,
    activeHoverField,
    startVoice,
    stopVoice,
    speakText,
    handleScreenClick,
    handleMouseEnter,
    handleMouseLeave,
  };
};