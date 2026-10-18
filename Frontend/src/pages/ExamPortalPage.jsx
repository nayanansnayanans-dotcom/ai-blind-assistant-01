import React, { useState, useEffect } from 'react';
import { speakIn } from '../components/speech';

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const ExamPortal = ({ examId = 'math' }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(5400); // 1 hr 30 mins
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnlineStatus = () => {
      setIsOffline(!navigator.onLine);
    };
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);

  const saveAnswerLocally = (qIndex, answerText) => {
    const updatedAnswers = { ...answers, [qIndex]: answerText };
    setAnswers(updatedAnswers);
  };

  return (
    <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ background: isOffline ? '#fef2f2' : '#f0fdf4', color: isOffline ? '#dc2626' : '#166534', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontWeight: 'bold' }}>
        {isOffline ? "⚠️ Offline Mode - Answers saved locally" : "🟢 Online (Synced with Server)"}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, color: '#0369a1' }}>Exam Portal</h2>
        <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#0284c7' }}>
          Time Remaining: {formatTime(timeLeft)}
        </div>
      </div>

      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <h3 style={{ margin: '0 0 12px 0', color: '#0f172a' }}>Question {currentQuestion + 1}</h3>
        <p style={{ fontSize: '16px', color: '#334155' }}>What is the primary function of an operating system kernel?</p>

        <div style={{ display: 'flex', gap: '12px', margin: '20px 0' }}>
          <button onClick={() => speakIn("What is the primary function of an operating system kernel?")} style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '10px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
            🔊 Read Question
          </button>
        </div>

        <textarea
          rows={5}
          value={answers[currentQuestion] || ''}
          onChange={(e) => saveAnswerLocally(currentQuestion, e.target.value)}
          placeholder="Type or dictate your answer here..."
          style={{ width: '100%', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
        />
      </div>
    </div>
  );
};

export default ExamPortal;