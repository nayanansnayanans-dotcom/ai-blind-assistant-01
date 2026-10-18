import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, BookOpen, Sparkles, Volume2, LogOut, CheckCircle, PhoneCall, ScanText } from 'lucide-react';
import { speakIn, cancelSpeech } from './speech';

// Replace with your backend API base URL
const API_BASE_URL = 'http://localhost:5000/api';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('Voice assistant ready. Tap microphone or select an option.');
  const [currentRole, setCurrentRole] = useState('login');

  // Dynamic Database & Subject List states fetched from MongoDB
  const [subjectsList, setSubjectsList] = useState([]);
  const [examDatabase, setExamDatabase] = useState([]);

  // Fetch initial subjects and questions from MongoDB on load
  useEffect(() => {
    fetch(`${API_BASE_URL}/subjects`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setSubjectsList(data);
        } else {
          // Fallback defaults if DB is empty
          setSubjectsList(['Computer Science', 'General Studies', 'Mathematics']);
        }
      })
      .catch(err => console.error('Error fetching subjects:', err));

    fetch(`${API_BASE_URL}/questions`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setExamDatabase(data);
        }
      })
      .catch(err => console.error('Error fetching questions:', err));
  }, []);

  const recognitionRef = useRef(null);

  const stopRecognition = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
  };

  const speak = (text, onEndCallback = null) => {
    stopRecognition();
    speakIn(text, 'en-US', { onEnd: onEndCallback });
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    stopRecognition();
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceStatus('Listening for your command...');
    };
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      handleVoiceCommand(transcript);
    };
    recognition.onerror = () => {
      setIsListening(false);
      setVoiceStatus('Voice recognition error. Tap to try again.');
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (e) {
      setIsListening(false);
    }
  };

  const handleVoiceCommand = (transcript) => {
    const lower = transcript.toLowerCase().trim();
    setVoiceStatus(`You said: "${lower}"`);

    if (currentRole === 'login') {
      if (lower.includes('student')) {
        setCurrentRole('student');
        speak('Student dashboard activated.');
      } else if (lower.includes('teacher')) {
        setCurrentRole('teacher');
        speak('Teacher dashboard activated.');
      } else if (lower.includes('admin')) {
        setCurrentRole('admin');
        speak('Admin dashboard activated.');
      }
      return;
    }

    if (lower.includes('logout') || lower.includes('sign out') || lower.includes('back to login')) {
      setCurrentRole('login');
      speak('Logged out to selection screen.');
      return;
    }
  };

  useEffect(() => {
    return () => { cancelSpeech(); stopRecognition(); };
  }, []);

  useEffect(() => {
    const welcomeMessage = "Welcome to AI Blind Assistant Portal. Please select Student Mode, Teacher Mode, or Admin Mode.";
    const timer = setTimeout(() => { speak(welcomeMessage); }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#070b19', color: '#f8fafc', padding: '20px', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box', position: 'relative' }}>
      
      {/* GLOBAL VOICE ASSISTANT BAR */}
      <div style={{ maxWidth: '800px', margin: '0 auto 20px auto', background: '#111827', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: isListening ? 'rgba(239,68,68,0.2)' : 'rgba(56,189,248,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${isListening ? '#ef4444' : '#38bdf8'}` }}>
            {isListening ? <Mic size={18} color="#ef4444" /> : <Volume2 size={18} color="#38bdf8" />}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: isListening ? '#ef4444' : '#38bdf8' }}>
              {isListening ? 'Voice Assistant Listening...' : 'Voice Assistant Ready'}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{voiceStatus}</div>
          </div>
        </div>
        <button onClick={startListening} style={{ background: isListening ? '#ef4444' : '#38bdf8', color: '#070b19', border: 'none', padding: '8px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Mic size={14} /> {isListening ? 'Listening...' : 'Activate Voice'}
        </button>
      </div>

      {/* 1. LOGIN / ROLE SELECTION SCREEN */}
      {currentRole === 'login' && (
        <div style={{ maxWidth: '650px', margin: '40px auto', textAlign: 'center', background: '#0f172a', padding: '40px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
          <div style={{ ...iconCircleStyle, width: '70px', height: '70px', background: 'rgba(56,189,248,0.15)', border: '2px solid #38bdf8', margin: '0 auto 20px auto' }}>
            <BookOpen size={32} color="#38bdf8" />
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '10px', color: '#f8fafc' }}>AI Blind Assistant Portal</h1>
          <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '35px' }}>Please select your role to launch your dedicated dashboard:</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '30px' }}>
            <button
              onClick={() => { setCurrentRole('student'); speak('Student dashboard activated.'); }}
              style={{ background: 'linear-gradient(135deg, rgba(56,189,248,0.2), rgba(56,189,248,0.05))', border: '2px solid #38bdf8', borderRadius: '16px', padding: '20px 12px', color: '#fff', cursor: 'pointer', textAlign: 'center' }}
            >
              <BookOpen size={28} color="#38bdf8" style={{ marginBottom: '10px' }} />
              <h3 style={{ fontSize: '15px', margin: '0 0 4px 0', color: '#38bdf8' }}>Student</h3>
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>Exam Assistance & OCR</p>
            </button>

            <button
              onClick={() => { setCurrentRole('teacher'); speak('Teacher dashboard activated.'); }}
              style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(168,85,247,0.05))', border: '2px solid #a855f7', borderRadius: '16px', padding: '20px 12px', color: '#fff', cursor: 'pointer', textAlign: 'center' }}
            >
              <Sparkles size={28} color="#a855f7" style={{ marginBottom: '10px' }} />
              <h3 style={{ fontSize: '15px', margin: '0 0 4px 0', color: '#c084fc' }}>Teacher</h3>
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>Exam Assistance Only</p>
            </button>

            <button
              onClick={() => { setCurrentRole('admin'); speak('Admin dashboard activated.'); }}
              style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))', border: '2px solid #10b981', borderRadius: '16px', padding: '20px 12px', color: '#fff', cursor: 'pointer', textAlign: 'center' }}
            >
              <PhoneCall size={28} color="#10b981" style={{ marginBottom: '10px' }} />
              <h3 style={{ fontSize: '15px', margin: '0 0 4px 0', color: '#34d399' }}>Admin</h3>
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>Voice Calling & OCR</p>
            </button>
          </div>
        </div>
      )}

      {/* 2. STUDENT DASHBOARD */}
      {currentRole === 'student' && (
        <StudentDashboard 
          onLogout={() => { setCurrentRole('login'); speak('Logged out to selection screen.'); }}
          subjectsList={subjectsList}
          examDatabase={examDatabase}
          speak={speak}
        />
      )}

      {/* 3. TEACHER DASHBOARD */}
      {currentRole === 'teacher' && (
        <TeacherDashboard 
          onLogout={() => { setCurrentRole('login'); speak('Logged out to selection screen.'); }}
          subjectsList={subjectsList}
          setSubjectsList={setSubjectsList}
          setExamDatabase={setExamDatabase}
          speak={speak}
        />
      )}

      {/* 4. ADMIN DASHBOARD */}
      {currentRole === 'admin' && (
        <AdminDashboard 
          onLogout={() => { setCurrentRole('login'); speak('Logged out to selection screen.'); }}
          speak={speak}
        />
      )}
    </div>
  );
}

/* =========================================================================
   STUDENT DASHBOARD COMPONENT
   ========================================================================= */
function StudentDashboard({ onLogout, subjectsList, examDatabase, speak }) {
  const [selectedSubject, setSelectedSubject] = useState(subjectsList[0] || 'Computer Science');
  const [activeTab, setActiveTab] = useState('exam'); 
  const [practiceAnswer, setPracticeAnswer] = useState('');
  const [practiceResult, setPracticeResult] = useState('');

  const [ocrFile, setOcrFile] = useState(null);
  const [ocrResultText, setOcrResultText] = useState('');
  const [isScanningOcr, setIsScanningOcr] = useState(false);

  const handleRunOcr = (e) => {
    e.preventDefault();
    if (!ocrFile) {
      alert('Please upload an image or document.');
      return;
    }
    setIsScanningOcr(true);
    speak('Scanning document with OCR reader.');
    setTimeout(() => {
      setOcrResultText('Extracted Text: [Heading: Final Semester Guidelines] Students are required to complete all assessments and submit projects prior to the deadline.');
      setIsScanningOcr(false);
      speak('Document successfully scanned and text extracted.');
    }, 1500);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111827', padding: '16px 20px', borderRadius: '14px', border: '1px solid rgba(56,189,248,0.3)', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 2px 0', color: '#38bdf8' }}>Student Dashboard</h1>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Exam Practice & OCR Document Reader</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={() => setActiveTab('exam')} style={{ background: activeTab === 'exam' ? '#38bdf8' : '#1f2937', color: activeTab === 'exam' ? '#070b19' : '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Exam Assistance</button>
          <button onClick={() => setActiveTab('ocr')} style={{ background: activeTab === 'ocr' ? '#38bdf8' : '#1f2937', color: activeTab === 'ocr' ? '#070b19' : '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>OCR Reader</button>
          <button onClick={onLogout} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>

      {activeTab === 'exam' ? (
        <div style={{ background: '#111827', padding: '20px', borderRadius: '14px', border: '1px solid rgba(56,189,248,0.3)' }}>
          <h3 style={{ fontSize: '15px', color: '#38bdf8', marginTop: 0 }}>Student Exam Practice Mode</h3>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Select Subject:</label>
            <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} style={inputStyle}>
              {subjectsList.map((sub, idx) => (<option key={idx} value={sub}>{sub}</option>))}
            </select>
          </div>

          <div style={{ background: '#0a0f1d', padding: '16px', borderRadius: '10px', border: '1px solid rgba(56,189,248,0.2)', marginBottom: '14px' }}>
            {examDatabase.filter(q => q.subject === selectedSubject).length > 0 ? (
              <div>
                <p style={{ fontSize: '13px', color: '#f8fafc', fontWeight: '600', marginBottom: '8px' }}>
                  Q: {examDatabase.filter(q => q.subject === selectedSubject)[0].question}
                </p>
                <textarea 
                  value={practiceAnswer} 
                  onChange={(e) => setPracticeAnswer(e.target.value)} 
                  placeholder="Type your answer here..." 
                  style={{ ...inputStyle, height: '60px', marginBottom: '8px' }} 
                />
                <button 
                  onClick={() => {
                    const matchedQ = examDatabase.filter(q => q.subject === selectedSubject)[0];
                    setPracticeResult('Answer submitted successfully! Model answer: ' + matchedQ.answer);
                    speak('Answer submitted. Check feedback.');
                  }} 
                  style={{ background: '#38bdf8', color: '#070b19', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Submit Answer
                </button>
                {practiceResult && <p style={{ fontSize: '12px', color: '#34d399', marginTop: '8px' }}>{practiceResult}</p>}
              </div>
            ) : (
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>No questions available for this subject yet in MongoDB.</p>
            )}
          </div>
        </div>
      ) : (
        <div style={{ background: '#111827', padding: '20px', borderRadius: '14px', border: '1px solid rgba(56,189,248,0.3)' }}>
          <h3 style={{ fontSize: '15px', color: '#38bdf8', marginTop: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ScanText size={18} /> OCR Document Reader
          </h3>
          <form onSubmit={handleRunOcr}>
            <input type="file" accept="image/*,.pdf" onChange={(e) => setOcrFile(e.target.files[0])} style={{ ...inputStyle, marginBottom: '12px', padding: '10px' }} />
            <button type="submit" disabled={isScanningOcr} style={{ background: '#38bdf8', color: '#070b19', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', width: '100%' }}>
              {isScanningOcr ? 'Scanning Document...' : 'Run OCR Extraction'}
            </button>
          </form>
          {ocrResultText && (
            <div style={{ background: '#0a0f1d', padding: '12px', borderRadius: '8px', border: '1px solid #38bdf8', marginTop: '14px' }}>
              <p style={{ fontSize: '12px', color: '#f8fafc', margin: 0 }}>{ocrResultText}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   TEACHER DASHBOARD COMPONENT (Saves to MongoDB)
   ========================================================================= */
function TeacherDashboard({ onLogout, subjectsList, setSubjectsList, setExamDatabase, speak }) {
  const [selectedSubjectForTeacher, setSelectedSubjectForTeacher] = useState(subjectsList[0] || 'Computer Science');
  const [newSubjectInput, setNewSubjectInput] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    if (!questionText.trim() || !answerText.trim()) {
      alert('Please fill in both question and answer.');
      return;
    }

    const newEntry = {
      subject: selectedSubjectForTeacher,
      type: 'Short Answer',
      keywords: questionText.toLowerCase().split(/\s+/),
      question: questionText,
      answer: answerText,
      options: []
    };

    try {
      const res = await fetch(`${API_BASE_URL}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntry)
      });

      if (res.ok) {
        const savedQuestion = await res.json();
        setExamDatabase(prev => [savedQuestion, ...prev]);
        setSuccessMessage('Exam question successfully saved to MongoDB!');
        speak('Exam question successfully saved.');
        setQuestionText('');
        setAnswerText('');
      } else {
        alert('Failed to save question to database.');
      }
    } catch (err) {
      console.error('Error saving question:', err);
      alert('Network error while saving question.');
    }
  };

  const handleAddNewSubject = async (e) => {
    e.preventDefault();
    const trimmed = newSubjectInput.trim();
    if (trimmed && !subjectsList.includes(trimmed)) {
      try {
        const res = await fetch(`${API_BASE_URL}/subjects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed })
        });

        if (res.ok) {
          setSubjectsList(prev => [...prev, trimmed]);
          setSelectedSubjectForTeacher(trimmed);
          setNewSubjectInput('');
          speak('New subject added.');
        }
      } catch (err) {
        console.error('Error adding subject:', err);
      }
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111827', padding: '16px 20px', borderRadius: '14px', border: '1px solid rgba(168,85,247,0.3)', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 2px 0', color: '#c084fc' }}>Teacher Dashboard</h1>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Dedicated Exam Assistance & Question Builder</p>
        </div>
        <button onClick={onLogout} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <LogOut size={14} /> Logout
        </button>
      </div>

      <div style={{ background: '#111827', padding: '16px 20px', borderRadius: '14px', border: '1px solid rgba(168,85,247,0.3)', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '14px', color: '#c084fc', marginBottom: '10px', marginTop: 0 }}>Subject Management</h3>
        <form onSubmit={handleAddNewSubject} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <input type="text" value={newSubjectInput} onChange={(e) => setNewSubjectInput(e.target.value)} placeholder="Add subject..." style={{ ...inputStyle, flex: 1 }} />
          <button type="submit" style={{ background: '#a855f7', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Add</button>
        </form>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {subjectsList.map((sub, idx) => (
            <span key={idx} style={{ background: '#0a0f1d', border: '1px solid #a855f7', color: '#f8fafc', padding: '4px 8px', borderRadius: '6px', fontSize: '11px' }}>{sub}</span>
          ))}
        </div>
      </div>

      <div style={{ background: '#111827', padding: '20px', borderRadius: '14px', border: '1px solid rgba(168,85,247,0.3)' }}>
        <h3 style={{ fontSize: '15px', color: '#c084fc', marginTop: 0 }}>Exam Assistance Question Builder</h3>
        {successMessage && (
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#34d399', padding: '8px', borderRadius: '6px', fontSize: '12px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle size={14} /> {successMessage}
          </div>
        )}
        <form onSubmit={handleAddQuestion}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Target Subject:</label>
            <select value={selectedSubjectForTeacher} onChange={(e) => setSelectedSubjectForTeacher(e.target.value)} style={inputStyle}>
              {subjectsList.map((sub, idx) => (<option key={idx} value={sub}>{sub}</option>))}
            </select>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Question Text:</label>
            <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="Enter exam question..." style={{ ...inputStyle, height: '60px' }} />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Model Answer:</label>
            <textarea value={answerText} onChange={(e) => setAnswerText(e.target.value)} placeholder="Enter model answer..." style={{ ...inputStyle, height: '60px' }} />
          </div>
          <button type="submit" style={{ background: '#a855f7', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', width: '100%' }}>Save Exam Question</button>
        </form>
      </div>
    </div>
  );
}

/* =========================================================================
   ADMIN DASHBOARD COMPONENT
   ========================================================================= */
function AdminDashboard({ onLogout, speak }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [callStatus, setCallStatus] = useState('Ready for emergency or family calling.');
  const [isCalling, setIsCalling] = useState(false);

  const [ocrFile, setOcrFile] = useState(null);
  const [ocrText, setOcrText] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const handleMakeCall = (e) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      alert('Please enter a phone number or select a contact.');
      return;
    }
    setIsCalling(true);
    setCallStatus(`Calling ${phoneNumber}...`);
    speak(`Placing voice call to ${phoneNumber}`);
    setTimeout(() => {
      setCallStatus(`Connected with ${phoneNumber}`);
    }, 2000);
  };

  const handleEndCall = () => {
    setIsCalling(false);
    setCallStatus('Call ended.');
    speak('Call ended.');
  };

  const handleAdminOcr = (e) => {
    e.preventDefault();
    if (!ocrFile) {
      alert('Please select a file.');
      return;
    }
    setIsScanning(true);
    speak('Processing document via admin OCR scanner.');
    setTimeout(() => {
      setOcrText('Admin OCR Scan Result: Verified administrative notification document. All systems operational.');
      setIsScanning(false);
      speak('Document successfully processed.');
    }, 1500);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111827', padding: '16px 20px', borderRadius: '14px', border: '1px solid rgba(16,185,129,0.3)', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 2px 0', color: '#10b981' }}>Admin Dashboard</h1>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Voice Calling & OCR Management Tools</p>
        </div>
        <button onClick={onLogout} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <LogOut size={14} /> Logout
        </button>
      </div>

      <div style={{ background: '#111827', padding: '20px', borderRadius: '14px', border: '1px solid rgba(16,185,129,0.3)', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '15px', color: '#10b981', marginTop: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <PhoneCall size={18} /> Voice Calling Hub
        </h3>
        <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '14px' }}>{callStatus}</p>
        <form onSubmit={handleMakeCall}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
            <input type="text" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Enter phone number or contact..." style={{ ...inputStyle, flex: 1 }} />
            {!isCalling ? (
              <button type="submit" style={{ background: '#10b981', color: '#070b19', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Call</button>
            ) : (
              <button type="button" onClick={handleEndCall} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>End Call</button>
            )}
          </div>
        </form>
      </div>

      <div style={{ background: '#111827', padding: '20px', borderRadius: '14px', border: '1px solid rgba(16,185,129,0.3)' }}>
        <h3 style={{ fontSize: '15px', color: '#10b981', marginTop: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ScanText size={18} /> OCR Document Reader
        </h3>
        <form onSubmit={handleAdminOcr}>
          <input type="file" accept="image/*,.pdf" onChange={(e) => setOcrFile(e.target.files[0])} style={{ ...inputStyle, marginBottom: '12px', padding: '10px' }} />
          <button type="submit" disabled={isScanning} style={{ background: '#10b981', color: '#070b19', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', width: '100%' }}>
            {isScanning ? 'Scanning...' : 'Run Admin OCR'}
          </button>
        </form>
        {ocrText && (
          <div style={{ background: '#0a0f1d', padding: '12px', borderRadius: '8px', border: '1px solid #10b981', marginTop: '14px' }}>
            <p style={{ fontSize: '12px', color: '#f8fafc', margin: 0 }}>{ocrText}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Inline Style Objects
const iconCircleStyle = {
  width: '50px', height: '50px', borderRadius: '50%', background: '#0a0f1d',
  display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 12px auto'
};

const inputStyle = {
  width: '100%', padding: '8px', background: '#0a0f1d', border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '6px', color: '#fff', fontSize: '13px', boxSizing: 'border-box'
};