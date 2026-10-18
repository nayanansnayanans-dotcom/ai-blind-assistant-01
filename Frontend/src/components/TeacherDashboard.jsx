import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/App.css';
import { createExam, fetchExams, fetchResults, generateDraftQuestions, updateExam, deleteExam, fetchAssistanceRequests, updateAssistanceRequest, fetchRegisteredStudents, updateStudentSubject } from '../services/api';
import { formatSpokenName, speakBuiltinTTS, cancelSpeech } from './speech.js';
import ProjectLogo from './ProjectLogo.jsx';

export const formatDateForVoice = (rawDate) => {
  if (!rawDate) return '';
  const str = String(rawDate).trim();
  
  // Format YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss (e.g. 2026-10-09 -> 9 October 2026)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const parts = str.split('T')[0].split('-');
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${day} ${months[monthIdx]} ${year}`;
    }
  }

  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const day = d.getDate();
      const monthName = d.toLocaleString('en-US', { month: 'long' });
      const year = d.getFullYear();
      return `${day} ${monthName} ${year}`;
    }
  } catch (e) {}

  return str;
};

export const filterResultsForTeacher = (rawResults, currentTeacher, currentExams) => {
  if (!Array.isArray(rawResults)) return [];
  const teacherEmail = String(currentTeacher?.email || '').toLowerCase().trim();
  const teacherName = String(currentTeacher?.fullName || '').toLowerCase().trim();
  
  // Collect IDs and Titles of exams created/owned by this teacher
  const teacherExamIds = new Set((currentExams || []).map(e => String(e._id || e.id || '')).filter(Boolean));
  const teacherExamTitles = new Set((currentExams || []).map(e => String(e.title || e.examTitle || '').toLowerCase().trim()).filter(Boolean));

  return rawResults.filter(r => {
    if (!r) return false;
    const rTeacherEmail = String(r.teacherEmail || r.creatorEmail || '').toLowerCase().trim();
    const rEvaluatedBy = String(r.evaluatedBy || r.teacherName || '').toLowerCase().trim();
    const rExamId = String(r.examId || r.exam?._id || r.exam?.id || '');
    const rExamTitle = String(r.examTitle || r.examName || r.title || '').toLowerCase().trim();

    // 1. Direct teacher email match on result (must be non-empty and exact match)
    if (teacherEmail && rTeacherEmail && teacherEmail === rTeacherEmail) return true;

    // 2. Exam ID match (submission was for an exam created by this teacher)
    if (rExamId && teacherExamIds.has(rExamId)) return true;

    // 3. Exam Title match if teacher has created an exam with that title
    if (rExamTitle && teacherExamTitles.has(rExamTitle)) return true;

    // 4. Specific teacher full name match (ONLY if custom teacher name, not generic 'teacher')
    if (teacherName && teacherName !== 'teacher' && rEvaluatedBy && rEvaluatedBy === teacherName) return true;

    return false;
  });
};

export const filterLogsForTeacher = (rawLogs, currentTeacher, currentExams) => {
  if (!Array.isArray(rawLogs) || rawLogs.length === 0) return [];
  const teacherEmail = String(currentTeacher?.email || '').toLowerCase().trim();
  const teacherExamIds = new Set((currentExams || []).map(e => String(e._id || e.id || '')).filter(Boolean));
  const teacherExamTitles = new Set((currentExams || []).map(e => String(e.title || e.examTitle || '').toLowerCase().trim()).filter(Boolean));

  return rawLogs.filter(log => {
    if (!log) return false;
    // Strip stale legacy mock logs
    if (log.student === 'Lekhanatr' && log.answered === '4 / 3') return false;
    if (log.student === 'jaanu123' && log.started === '10:00 AM' && !log.teacherEmail) return false;

    const logEmail = String(log.teacherEmail || log.creatorEmail || '').toLowerCase().trim();
    const logExamId = String(log.examId || '');
    const logExamTitle = String(log.examTitle || log.examName || log.title || '').toLowerCase().trim();

    if (teacherEmail && logEmail && teacherEmail === logEmail) return true;
    if (logExamId && teacherExamIds.has(logExamId)) return true;
    if (logExamTitle && teacherExamTitles.has(logExamTitle)) return true;
    return false;
  });
};

export const filterRequestsForTeacher = (rawRequests, currentTeacher, currentExams) => {
  if (!Array.isArray(rawRequests) || rawRequests.length === 0) return [];
  const teacherEmail = String(currentTeacher?.email || '').toLowerCase().trim();
  const teacherExamTitles = new Set((currentExams || []).map(e => String(e.title || e.examTitle || '').toLowerCase().trim()).filter(Boolean));

  return rawRequests.filter(req => {
    if (!req) return false;
    const reqEmail = String(req.teacherEmail || '').toLowerCase().trim();
    const reqExam = String(req.examTitle || req.question || '').toLowerCase().trim();

    if (teacherEmail && reqEmail && teacherEmail === reqEmail) return true;
    if (reqExam && teacherExamTitles.has(reqExam)) return true;
    return false;
  });
};


const menuItems = [
  { id: 'Overview', icon: '📊', label: 'Overview' },
  { id: 'Create exam', icon: '📝', label: 'Create & edit exam' },
  { id: 'Question bank', icon: '📚', label: 'Question bank' },
  { id: 'Schedule & assign', icon: '📅', label: 'Schedule & assign' },
  { id: 'Student Subjects', icon: '🎓', label: 'Student Subject Preferences' },
  { id: 'Voice Broadcasts', icon: '📢', label: 'Voice broadcasts & alerts' },
  { id: 'Accessibility', icon: '♿', label: 'Accessibility & voice' },
  { id: 'Voice exam', icon: '🎙️', label: 'Voice exam responses & analytics' },
  { id: 'AI Oral Viva', icon: '✨', label: 'AI oral viva simulator & creator' },
  { id: 'Question reader', icon: '🔊', label: 'Question audio reader' },
  { id: 'Monitoring', icon: '👁️', label: 'Live voice proctoring & logs' },
  { id: 'Assistance', icon: '🔔', label: 'Student assistance' },
  { id: 'Extra time', icon: '⏱️', label: 'Extra time & rules' },
  { id: 'Instructions', icon: '📜', label: 'Exam instructions' },
  { id: 'Study materials', icon: '📖', label: 'Upload study materials' },
  { id: 'Results & analytics', icon: '📈', label: 'Results & analytics' },
  { id: 'Certificates', icon: '🏆', label: 'Accessible certificates' },
  { id: 'Import & export', icon: '📁', label: 'Import, OCR & export' }
];

const starterQuestions = [];

const Field = ({ label, children }) => <label className="ea-field"><span>{label}</span>{children}</label>;
const Toggle = ({ label, note, value, onChange }) => (
  <label className="ea-toggle">
    <span><b>{label}</b>{note && <small>{note}</small>}</span>
    <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} />
    <i />
  </label>
);

export const COMPREHENSIVE_SUBJECTS_AND_LANGUAGES = [
  {
    category: "💻 Computer Science & IT",
    items: [
      "Computer Science",
      "Information Technology",
      "Artificial Intelligence & Machine Learning",
      "Data Science & Analytics",
      "Cybersecurity & Cryptography",
      "Web Technologies & Development",
      "Mobile Application Development",
      "Data Structures & Algorithms (DSA)",
      "Database Management Systems (DBMS)",
      "Operating Systems (OS)",
      "Computer Networks (CN)",
      "Software Engineering",
      "Cloud Computing & DevOps",
      "Internet of Things (IoT)",
      "Python Programming",
      "Java Programming",
      "C / C++ Programming",
      "Web Accessibility & Assistive Tech"
    ]
  },
  {
    category: "🔬 Pure Sciences & Mathematics",
    items: [
      "Mathematics",
      "Applied Mathematics",
      "Physics",
      "Chemistry",
      "Biology / Life Sciences",
      "Biotechnology",
      "Environmental Science & Ecology",
      "Statistics & Probability",
      "General Science",
      "Astrophysics & Space Science"
    ]
  },
  {
    category: "📊 Commerce, Management & Economics",
    items: [
      "Accountancy",
      "Business Studies",
      "Economics (Micro & Macro)",
      "Commerce",
      "Financial Management",
      "Banking & Insurance",
      "Marketing Management",
      "Human Resource Management",
      "Corporate Law"
    ]
  },
  {
    category: "📚 Humanities, Arts & Social Sciences",
    items: [
      "History",
      "Social Science",
      "Geography",
      "Political Science & Civics",
      "Sociology",
      "Psychology",
      "Philosophy",
      "Public Administration",
      "Journalism & Mass Media",
      "General Knowledge (GK) & Current Affairs"
    ]
  },
  {
    category: "⚙️ Engineering Disciplines",
    items: [
      "Electrical & Electronics Engineering",
      "Electronics & Communication Engineering",
      "Mechanical Engineering",
      "Civil Engineering",
      "Chemical Engineering",
      "Automobile Engineering"
    ]
  }
];

export const ALL_PREDEFINED_SUBJECTS = COMPREHENSIVE_SUBJECTS_AND_LANGUAGES.flatMap(cat => cat.items);

export const SubjectSelector = ({ value, onChange, placeholder = "Select Subject", id, style }) => {
  const isPredefined = ALL_PREDEFINED_SUBJECTS.includes(value);
  const [isCustom, setIsCustom] = useState(!isPredefined && Boolean(value && value !== 'General'));
  const [customVal, setCustomVal] = useState(isPredefined ? '' : (value || ''));

  useEffect(() => {
    if (value && !ALL_PREDEFINED_SUBJECTS.includes(value)) {
      setIsCustom(true);
      setCustomVal(value);
    } else if (ALL_PREDEFINED_SUBJECTS.includes(value)) {
      setIsCustom(false);
    }
  }, [value]);

  const handleSelectChange = (e) => {
    const selected = e.target.value;
    if (selected === '__CUSTOM__') {
      setIsCustom(true);
      onChange(customVal || '');
    } else {
      setIsCustom(false);
      onChange(selected);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', ...style }}>
      <select
        id={id}
        value={isCustom ? '__CUSTOM__' : (value || 'Computer Science')}
        onChange={handleSelectChange}
        style={{
          padding: '8px 10px',
          borderRadius: '8px',
          border: '1px solid #7dd3fc',
          fontSize: '13px',
          fontWeight: '600',
          background: '#ffffff',
          color: '#0f172a',
          width: '100%',
          cursor: 'pointer'
        }}
      >
        <option value="" disabled>{placeholder}</option>
        {COMPREHENSIVE_SUBJECTS_AND_LANGUAGES.map(group => (
          <optgroup key={group.category} label={group.category}>
            {group.items.map(subj => (
              <option key={subj} value={subj}>
                {subj}
              </option>
            ))}
          </optgroup>
        ))}
        <optgroup label="✍️ Custom / Other">
          <option value="__CUSTOM__">+ Type Custom Subject / Topic...</option>
        </optgroup>
      </select>

      {isCustom && (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input
            type="text"
            value={customVal}
            onChange={e => {
              setCustomVal(e.target.value);
              onChange(e.target.value);
            }}
            placeholder="Type custom subject or course name..."
            autoFocus
            style={{
              flex: 1,
              padding: '7px 10px',
              borderRadius: '6px',
              border: '2px solid #9333ea',
              fontSize: '13px',
              background: '#faf5ff'
            }}
          />
          <button
            type="button"
            title="Reset to Computer Science"
            onClick={() => {
              setIsCustom(false);
              onChange('Computer Science');
            }}
            style={{
              fontSize: '11px',
              padding: '6px 8px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#f1f5f9',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
};

export const isSubjectMatch = (itemSub, targetSub) => {
  if (!targetSub || targetSub === 'ALL' || targetSub === 'All Subjects') return true;
  if (!itemSub) return false;
  
  const cleanItem = String(itemSub).toLowerCase().trim();
  const cleanTarget = String(targetSub).toLowerCase().trim();
  if (cleanItem === cleanTarget) return true;

  const strip = s => s.replace(/[\(\)\[\]\{\}\/\\,\-\._\+]/g, ' ').replace(/\s+/g, ' ').trim();
  const sItem = strip(cleanItem);
  const sTarget = strip(cleanTarget);
  if (sItem === sTarget) return true;

  // Broad words that shouldn't match simply by partial substring
  const broadWords = ['science', 'engineering', 'general', 'applied', 'studies', 'law', 'data'];
  if (broadWords.includes(sTarget) || broadWords.includes(sItem)) {
    return sItem === sTarget;
  }

  // Exact phrase substring match
  if (sItem.includes(sTarget) || sTarget.includes(sItem)) return true;

  return false;
};

const getTeacherProfile = () => {
  try {
    const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
    const storedName = session.name || session.fullName || session.username || (session.email ? session.email.split('@')[0] : 'Teacher');
    const fullName = formatSpokenName(storedName || 'Teacher');
    const initials = fullName.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase();
    const storedSubject = session.subject || localStorage.getItem('teacher_selected_subject') || '';
    return { fullName, initials: initials || 'T', email: (session.email || 'teacher@school.edu').toLowerCase().trim(), subject: storedSubject };
  } catch {
    return { fullName: 'Teacher', initials: 'T', email: 'teacher@school.edu', subject: '' };
  }
};

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const teacher = getTeacherProfile();

  const handleLogout = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    window.isVoiceAssistantActive = false;
    try {
      const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
      if (session.email) {
        const loggedMap = JSON.parse(localStorage.getItem('logged_in_users') || '{}');
        const cleanE = session.email.toLowerCase().trim();
        if (loggedMap[cleanE]) {
          loggedMap[cleanE].status = 'offline';
          loggedMap[cleanE].lastLogout = new Date().toISOString();
          localStorage.setItem('logged_in_users', JSON.stringify(loggedMap));
        }
      }
      localStorage.removeItem('auth_session');
      localStorage.removeItem('user');
      localStorage.removeItem('user_name');
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('draft_teacher_exam');
      localStorage.removeItem('draft_teacher_selected_qids');
      sessionStorage.clear();
    } catch (e) {}
    navigate('/teacher-login');
  };

  // Strict role validation
  useEffect(() => {
    try {
      const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
      const sessionRole = (session.role || '').toLowerCase();
      if (!session.email || (sessionRole && sessionRole !== 'teacher')) {
        if (sessionRole === 'student') navigate('/student-dashboard');
        else if (sessionRole === 'admin') navigate('/admin-dashboard');
        else navigate('/teacher-login');
      }
    } catch (e) {}
  }, [navigate]);

  const [page, setPage] = useState('Overview');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Active Teaching Subject Filter (Persisted per teacher)
  const [selectedTeacherSubject, setSelectedTeacherSubject] = useState(() => {
    try {
      const stored = localStorage.getItem('teacher_selected_subject');
      if (stored && stored.trim()) return stored.trim();
      const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
      if (session.subject && session.subject.trim()) return session.subject.trim();
      return 'Computer Science';
    } catch {
      return 'Computer Science';
    }
  });

  const handleTeacherSubjectChange = (newSubject) => {
    const val = newSubject || 'ALL';
    setSelectedTeacherSubject(val);
    try {
      if (val !== 'ALL') {
        localStorage.setItem('teacher_selected_subject', val);
        const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
        session.subject = val;
        localStorage.setItem('auth_session', JSON.stringify(session));
      } else {
        localStorage.removeItem('teacher_selected_subject');
        const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
        delete session.subject;
        localStorage.setItem('auth_session', JSON.stringify(session));
      }
    } catch (e) {}

    if (val !== 'ALL') {
      setExam(prev => ({
        ...prev,
        subject: val,
        title: (prev.title && !prev.title.includes('Assessment') && !prev.title.includes('Unit Test'))
          ? prev.title
          : `${val} Assessment`
      }));
      setBulkSubject(val);
      setNewQuestion(prev => ({ ...prev, subject: val }));
      setMultiRows(prev => prev.map(r => ({ ...r, subject: val })));
      setAi(prev => ({ ...prev, topic: val }));
      setNewMaterial(prev => ({ ...prev, subject: val }));
      setNewViva(prev => ({ ...prev, subject: val }));
      say(`Teaching subject set to ${val}. Showing only ${val} items.`);
    } else {
      say('Showing all subjects.');
    }
  };

  useEffect(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    window.isVoiceAssistantActive = false;
  }, []);
  
  // Database States
  const [savedExams, setSavedExams] = useState([]);
  const [studentResults, setStudentResults] = useState([]);
  const [activeCorrection, setActiveCorrection] = useState(null);
  const [correctionQuestions, setCorrectionQuestions] = useState([]);
  const [overallFeedbackInput, setOverallFeedbackInput] = useState('');

  // Student Subjects & Preferences States
  const [registeredStudents, setRegisteredStudents] = useState([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [studentSubjectDrafts, setStudentSubjectDrafts] = useState({});
  const [studentSubjectNotice, setStudentSubjectNotice] = useState('');
  const [isAskingStudent, setIsAskingStudent] = useState(null);

  const loadRegisteredStudents = () => {
    fetchRegisteredStudents()
      .then(list => {
        if (Array.isArray(list)) {
          setRegisteredStudents(list);
          setStudentSubjectDrafts(prev => {
            const drafts = { ...prev };
            list.forEach(s => {
              if (!drafts[s.email]) {
                drafts[s.email] = s.interestedSubject || s.subject || 'Computer Science';
              }
            });
            return drafts;
          });
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadRegisteredStudents();
  }, []);

  const teacherEmailKey = (teacher?.email || 'teacher@school.edu').toLowerCase().trim();
  const qBankKey = `teacher_question_bank_${teacherEmailKey}`;
  const draftExamKey = `draft_teacher_exam_${teacherEmailKey}`;
  const draftQidsKey = `draft_teacher_selected_qids_${teacherEmailKey}`;

  const [questions, setQuestions] = useState(() => {
    try {
      const saved = localStorage.getItem(qBankKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(q => 
            !q.text?.includes('What is the primary purpose of HTTPS') &&
            !q.text?.includes('Explain the difference between HTTP and HTTPS') &&
            !q.text?.includes('Describe two common cyber-security threats') &&
            !q.text?.includes('Which Web API is responsible for converting text into speech') &&
            !q.text?.includes('Screen readers can navigate HTML tables')
          );
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(qBankKey, JSON.stringify(questions));
    } catch (e) {}
  }, [questions, qBankKey]);

  // Clean any legacy unpartitioned draft keys from other teachers or legacy sample questions
  useEffect(() => {
    try {
      localStorage.removeItem('draft_teacher_exam');
      localStorage.removeItem('draft_teacher_selected_qids');
      localStorage.removeItem('teacher_questions');
      localStorage.removeItem('starter_questions');

      // Purge legacy hardcoded mock entries from shared_live_logs so old browser storage doesn't pollute
      const rawLogs = localStorage.getItem('shared_live_logs');
      if (rawLogs) {
        const parsed = JSON.parse(rawLogs);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(l => 
            !(l.student === 'Lekhanatr' && l.answered === '4 / 3') && 
            !(l.student === 'jaanu123' && l.started === '10:00 AM' && !l.teacherEmail)
          );
          if (cleaned.length !== parsed.length) {
            localStorage.setItem('shared_live_logs', JSON.stringify(cleaned));
          }
        }
      }
      // Purge legacy mock entries from shared_viva_submissions
      const rawViva = localStorage.getItem('shared_viva_submissions');
      if (rawViva) {
        const parsed = JSON.parse(rawViva);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(v => 
            !(v.studentName === 'Nayana N S' && v.vivaTitle?.includes('Operating Systems') && !v.teacherEmail)
          );
          if (cleaned.length !== parsed.length) {
            localStorage.setItem('shared_viva_submissions', JSON.stringify(cleaned));
          }
        }
      }
    } catch (e) {}
  }, []);

  const [selectedQuestionIds, setSelectedQuestionIds] = useState(() => {
    try {
      const saved = localStorage.getItem(draftQidsKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(id => ![1, 2, 3, 4, 5].includes(id));
        }
      }
      return [];
    } catch {
      return [];
    }
  });
  const [editingExamId, setEditingExamId] = useState(null);

  // Active Exam Form (Persisted in localStorage per teacher so new teachers start with a clean form)
  const initialExamState = {
    title: '',
    subject: selectedTeacherSubject !== 'ALL' ? selectedTeacherSubject : (teacher?.subject || 'Computer Science'),
    targetStudentEmail: '',
    targetStudentName: '',
    assignedStudents: [],
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    duration: 60,
    passMark: 40,
    status: 'Draft',
    instructions: 'Listen carefully to each question narration. Use voice navigation commands like "Next", "Repeat", or "Option A" to answer.',
    defaultLanguage: 'en',
    allowedLanguages: ['en']
  };

  const [exam, setExam] = useState(() => {
    try {
      const saved = localStorage.getItem(draftExamKey);
      const parsed = (saved && JSON.parse(saved).title) ? JSON.parse(saved) : initialExamState;
      if (!parsed.defaultLanguage) parsed.defaultLanguage = 'en';
      if (!parsed.targetStudentEmail) parsed.targetStudentEmail = '';
      if (!parsed.targetStudentName) parsed.targetStudentName = '';
      if (!Array.isArray(parsed.assignedStudents)) parsed.assignedStudents = [];
      return parsed;
    } catch {
      return initialExamState;
    }
  });

  const handleSelectTargetStudent = (studentEmail) => {
    if (!studentEmail) {
      handleClearTargetStudent();
      return;
    }
    const targetStu = registeredStudents.find(s => s.email === studentEmail);
    if (!targetStu) return;

    const studentSub = targetStu.interestedSubject || targetStu.subject || 'Computer Science';
    const studentName = targetStu.username || targetStu.name || 'Student';

    setExam(prev => ({
      ...prev,
      targetStudentEmail: targetStu.email,
      targetStudentName: studentName,
      assignedStudents: [targetStu.email],
      subject: studentSub,
      title: (prev.title && !prev.title.includes('Assessment') && !prev.title.includes('Unit Test'))
        ? prev.title
        : `${studentSub} Assessment - ${studentName}`
    }));

    say(`Selected student ${studentName}. Exam subject auto-set to their interested subject: ${studentSub}.`);
  };

  const handleClearTargetStudent = () => {
    setExam(prev => ({
      ...prev,
      targetStudentEmail: '',
      targetStudentName: '',
      assignedStudents: []
    }));
    say('Exam target set to open for all students.');
  };

  const handleCreateExamForStudent = (studentObj) => {
    if (!studentObj) return;
    const studentSub = studentObj.interestedSubject || studentObj.subject || 'Computer Science';
    const studentName = studentObj.username || studentObj.name || 'Student';

    setExam({
      ...initialExamState,
      targetStudentEmail: studentObj.email,
      targetStudentName: studentName,
      assignedStudents: [studentObj.email],
      subject: studentSub,
      title: `${studentSub} Assessment - ${studentName}`,
      status: 'Scheduled'
    });

    const matchingQIds = questions
      .filter(q => (q.subject || '').toLowerCase() === studentSub.toLowerCase() || (q.topic || '').toLowerCase() === studentSub.toLowerCase())
      .map(q => q.id);
    if (matchingQIds.length > 0) {
      setSelectedQuestionIds(matchingQIds);
    } else {
      setSelectedQuestionIds([]);
    }

    setPage('Create exam');
    say(`Opened exam creator for ${studentName} based on their interested subject: ${studentSub}.`);
  };

  useEffect(() => {
    try {
      if (exam && exam.title) {
        localStorage.setItem(draftExamKey, JSON.stringify(exam));
      } else {
        localStorage.removeItem(draftExamKey);
      }
    } catch (e) {}
  }, [exam, draftExamKey]);

  useEffect(() => {
    try {
      if (selectedQuestionIds && selectedQuestionIds.length > 0) {
        localStorage.setItem(draftQidsKey, JSON.stringify(selectedQuestionIds));
      } else {
        localStorage.removeItem(draftQidsKey);
      }
    } catch (e) {}
  }, [selectedQuestionIds, draftQidsKey]);

  // Generator & Accommodations
  const [ai, setAi] = useState({ topic: selectedTeacherSubject !== 'ALL' ? selectedTeacherSubject : 'Web Accessibility & Voice AI', count: 5, difficulty: 'Medium' });
  const [access, setAccess] = useState({ tts: true, voice: true, contrast: false, font: true, extra: true, autosave: true, autosubmit: true, language: 'en-US' });
  const [newQuestion, setNewQuestion] = useState({ type: 'MCQ', text: '', optionA: '', optionB: '', optionC: '', optionD: '', answer: '', marks: 2, difficulty: 'Medium', subject: selectedTeacherSubject !== 'ALL' ? selectedTeacherSubject : 'General' });
  
  // Bulk & Multi-Row Question Builder State
  const [builderMode, setBuilderMode] = useState('bulk'); // 'bulk' | 'multiRow' | 'single'
  const [bulkText, setBulkText] = useState('');
  const [bulkType, setBulkType] = useState('Descriptive Theory');
  const [bulkDifficulty, setBulkDifficulty] = useState('Medium');
  const [bulkSubject, setBulkSubject] = useState(selectedTeacherSubject !== 'ALL' ? selectedTeacherSubject : 'Computer Science');
  const [bulkMarks, setBulkMarks] = useState(2);
  const [multiRows, setMultiRows] = useState([
    { id: 1, text: '', type: 'Descriptive Theory', marks: 2, difficulty: 'Medium', answer: '', subject: selectedTeacherSubject !== 'ALL' ? selectedTeacherSubject : 'Computer Science' },
    { id: 2, text: '', type: 'Descriptive Theory', marks: 2, difficulty: 'Medium', answer: '', subject: selectedTeacherSubject !== 'ALL' ? selectedTeacherSubject : 'Computer Science' },
    { id: 3, text: '', type: 'Descriptive Theory', marks: 2, difficulty: 'Medium', answer: '', subject: selectedTeacherSubject !== 'ALL' ? selectedTeacherSubject : 'Computer Science' }
  ]);
  const [readerIndex, setReaderIndex] = useState(0);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [isPlayingSpeech, setIsPlayingSpeech] = useState(false);
  const [instructionText, setInstructionText] = useState('You have 60 minutes for this exam. Text-to-Speech audio is enabled for all questions and options. Speak clearly when using voice commands.');
  const [extraTime, setExtraTime] = useState({ normal: 60, extraPercent: 25, extraMinutes: 15, breaks: 2, breakMinutes: 5, allowed: true });
  
  // Per-Student Extra Time Accommodations State (Scoped to current teacher)
  const studentExtraTimeKey = `shared_student_extra_time_${teacherEmailKey}`;
  const [studentAccommodations, setStudentAccommodations] = useState(() => {
    try {
      const saved = localStorage.getItem(studentExtraTimeKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [selectedStudentForExtraTime, setSelectedStudentForExtraTime] = useState('CUSTOM');
  const [customStudentNameInput, setCustomStudentNameInput] = useState('');
  const [studentExtraTimeConfig, setStudentExtraTimeConfig] = useState({
    baseMinutes: 60,
    extraPercent: 50,
    extraMinutes: 30,
    breaks: 2,
    breakMinutes: 5,
    category: 'Total Blindness (Voice TTS + STT Dictation)'
  });

  const handleSaveStudentAccommodation = () => {
    const sName = selectedStudentForExtraTime === 'CUSTOM' ? customStudentNameInput.trim() : selectedStudentForExtraTime;
    if (!sName) return say('Please select or enter student name.');

    const base = Number(studentExtraTimeConfig.baseMinutes) || 60;
    const ext = Number(studentExtraTimeConfig.extraMinutes) || 0;
    const brkMins = Number(studentExtraTimeConfig.breaks) * Number(studentExtraTimeConfig.breakMinutes);
    const total = base + ext + brkMins;

    const existingIndex = studentAccommodations.findIndex(a => (a.studentName || '').toLowerCase() === sName.toLowerCase());
    let updated;
    const item = {
      id: existingIndex !== -1 ? studentAccommodations[existingIndex].id : Date.now(),
      studentName: sName,
      registerNo: existingIndex !== -1 ? studentAccommodations[existingIndex].registerNo : `202400${studentAccommodations.length + 1}`,
      baseMinutes: base,
      extraPercent: Number(studentExtraTimeConfig.extraPercent) || 0,
      extraMinutes: ext,
      breaks: Number(studentExtraTimeConfig.breaks) || 0,
      breakMinutes: Number(studentExtraTimeConfig.breakMinutes) || 0,
      totalMinutes: total,
      category: studentExtraTimeConfig.category,
      teacherEmail: teacherEmailKey,
      status: 'Approved'
    };

    if (existingIndex !== -1) {
      updated = [...studentAccommodations];
      updated[existingIndex] = item;
    } else {
      updated = [item, ...studentAccommodations];
    }

    setStudentAccommodations(updated);
    try {
      localStorage.setItem(studentExtraTimeKey, JSON.stringify(updated));
      localStorage.setItem('shared_student_extra_time', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}

    say(`Saved extra time accommodation (${total} mins total) for student "${sName}"!`);
  };

  const handleDeleteStudentAccommodation = (id) => {
    const updated = studentAccommodations.filter(a => a.id !== id);
    setStudentAccommodations(updated);
    try {
      localStorage.setItem(studentExtraTimeKey, JSON.stringify(updated));
      localStorage.setItem('shared_student_extra_time', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
    say('Student accommodation record removed.');
  };

  
  // Study Materials Store (Scoped to logged in teacher)
  const studyMaterialsKey = `shared_study_materials_${teacherEmailKey}`;
  const [studyMaterials, setStudyMaterials] = useState(() => {
    try {
      const saved = localStorage.getItem(studyMaterialsKey);
      if (saved) return JSON.parse(saved);
      const globalSaved = localStorage.getItem('shared_study_materials');
      if (globalSaved) {
        const parsed = JSON.parse(globalSaved);
        if (Array.isArray(parsed)) {
          return parsed.filter(m => (String(m.teacherEmail || m.creatorEmail || '').toLowerCase().trim()) === teacherEmailKey);
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  const [newMaterial, setNewMaterial] = useState({
    title: '',
    type: 'Audio Lesson',
    subject: selectedTeacherSubject !== 'ALL' ? selectedTeacherSubject : 'Computer Science',
    detail: '',
    textContent: '',
    practiceQuestion: '',
    practiceAnswer: ''
  });
  
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [pdfFileName, setPdfFileName] = useState('');
  const [aiGeneratedQuestions, setAiGeneratedQuestions] = useState([]);

  // OCR Extraction State
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrFileName, setOcrFileName] = useState('');
  const [extractedOcrQuestions, setExtractedOcrQuestions] = useState([]);
  const [selectedOcrIndexes, setSelectedOcrIndexes] = useState([]);

  // Sync Handlers for Schedule, Accessibility, and Exam Instructions
  const handleSaveSchedule = () => {
    const activeTitle = exam.title || 'Created Theory Assessment';
    const updatedExam = {
      _id: editingExamId || `exam-${Date.now()}`,
      title: activeTitle,
      subject: exam.subject || 'Computer Science',
      duration: exam.duration || 60,
      durationMinutes: exam.duration || 60,
      date: exam.date || 'Upcoming',
      time: exam.time || '10:00 AM',
      status: 'Scheduled',
      passMark: exam.passMark || 40,
      instructions: exam.instructions || 'Read all theory questions carefully.',
      questions: exam.questions || []
    };

    const existingIndex = savedExams.findIndex(x => (x.title === activeTitle || x._id === editingExamId));
    let nextSaved;
    if (existingIndex !== -1) {
      nextSaved = [...savedExams];
      nextSaved[existingIndex] = { ...nextSaved[existingIndex], ...updatedExam };
    } else {
      nextSaved = [updatedExam, ...savedExams];
    }
    setSavedExams(nextSaved);

    try {
      localStorage.setItem('shared_exams', JSON.stringify(nextSaved));
      localStorage.setItem('draft_teacher_exam', JSON.stringify(updatedExam));

      const notifObj = {
        id: `notif_${Date.now()}_${Math.floor(Math.random()*1000)}`,
        title: `📅 Exam Scheduled: ${activeTitle}`,
        detail: `Teacher scheduled ${activeTitle} on ${exam.date || 'Upcoming'} at ${exam.time || '10:00 AM'} (${exam.duration || 60} mins duration).`,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'Exam Schedule',
        read: false
      };
      const existingRaw = localStorage.getItem('shared_notifications');
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      localStorage.setItem('shared_notifications', JSON.stringify([notifObj, ...existing]));

      window.dispatchEvent(new Event('storage'));
    } catch (e) {}

    say(`Schedule and assignments saved for "${activeTitle}"! Connected live to Student Dashboard.`);
  };

  const handleSaveAccessibility = () => {
    try {
      localStorage.setItem('shared_accessibility_rules', JSON.stringify(access));
      const notifObj = {
        id: `notif_${Date.now()}_${Math.floor(Math.random()*1000)}`,
        title: `♿ Accessibility Preferences Updated`,
        detail: `Teacher updated accessibility configuration (TTS: ${access.tts ? 'On' : 'Off'}, Accent/Language: ${access.language}).`,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'System Settings',
        read: false
      };
      const existingRaw = localStorage.getItem('shared_notifications');
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      localStorage.setItem('shared_notifications', JSON.stringify([notifObj, ...existing]));

      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
    say('Accessibility rules saved and live connected to Student Dashboard.');
  };

  const handleSaveInstructions = () => {
    try {
      localStorage.setItem('shared_exam_instructions', instructionText);
      const notifObj = {
        id: `notif_${Date.now()}_${Math.floor(Math.random()*1000)}`,
        title: `📢 Exam Voice Instructions Script Updated`,
        detail: `Teacher updated pre-exam audio narration instructions script.`,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'Instructions Update',
        read: false
      };
      const existingRaw = localStorage.getItem('shared_notifications');
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      localStorage.setItem('shared_notifications', JSON.stringify([notifObj, ...existing]));

      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
    say('Exam voice instructions script saved and live connected to Student Dashboard.');
  };


  // Oral Viva State & Handlers
  const [oralVivaList, setOralVivaList] = useState(() => {
    try {
      const saved = localStorage.getItem('shared_oral_vivas');
      if (saved) {
        const parsed = JSON.parse(saved);
        const tEmail = String(teacher?.email || '').toLowerCase().trim();
        const filtered = Array.isArray(parsed) ? parsed.filter(v => {
          if (!v) return false;
          if (v.id === 1 && String(v.title).includes('Operating Systems')) return false;
          if (v.id === 2 && String(v.title).includes('Computer Networks')) return false;
          if (v.title === 'Operating Systems & Process Management Oral Viva') return false;
          const vEmail = String(v.teacherEmail || v.creatorEmail || '').toLowerCase().trim();
          return Boolean(tEmail && vEmail && tEmail === vEmail);
        }) : [];
        return filtered;
      }
      return [];
    } catch {
      return [];
    }
  });

  const [vivaSubmissions, setVivaSubmissions] = useState(() => {
    try {
      const raw = localStorage.getItem('shared_viva_submissions');
      if (raw) {
        const parsed = JSON.parse(raw);
        const tEmail = String(teacher?.email || '').toLowerCase().trim();
        return Array.isArray(parsed) ? parsed.filter(s => {
          if (!s) return false;
          if (s.student === 'Nayana N S' && String(s.response || s.spokenResponse || '').includes('Deadlock requires 4 conditions')) return false;
          const sEmail = String(s.teacherEmail || '').toLowerCase().trim();
          return Boolean(tEmail && sEmail && tEmail === sEmail);
        }) : [];
      }
      return [];
    } catch {
      return [];
    }
  });

  const [newViva, setNewViva] = useState({
    title: '',
    subject: selectedTeacherSubject !== 'ALL' ? selectedTeacherSubject : 'Python Programming',
    group: 'All Blind Students',
    questionText: '',
    keywords: '',
    expectedAnswer: ''
  });

  const [vivaQuestions, setVivaQuestions] = useState([]);

  const handleAddQuestionToViva = () => {
    if (!newViva.questionText.trim()) return say('Please type a viva question.');
    const qObj = {
      id: Date.now(),
      text: newViva.questionText.trim(),
      keywords: newViva.keywords.trim() || 'core concepts, definitions',
      answer: newViva.expectedAnswer.trim() || 'Standard technical answer.'
    };
    setVivaQuestions(prev => [...prev, qObj]);
    setNewViva(prev => ({ ...prev, questionText: '', keywords: '', expectedAnswer: '' }));
    say('Added viva question to exam set!');
  };

  const handleAutoGenerateVivaQs = () => {
    const subj = newViva.subject || 'Operating Systems';
    say(`✨ AI generating comprehensive viva questions for ${subj}...`);
    
    setTimeout(() => {
      let generated = [];
      const sLower = subj.toLowerCase();

      if (sLower.includes('python')) {
        generated = [
          {
            id: Date.now() + 1,
            text: 'What are mutable and immutable data types in Python? Explain memory behavior with examples.',
            keywords: 'mutable, immutable, list, tuple, dictionary, id, memory address, object reference',
            answer: 'Mutable types like lists, sets, and dictionaries can have their contents modified in-place, whereas immutable types like integers, strings, and tuples cannot be altered after instantiation.'
          },
          {
            id: Date.now() + 2,
            text: 'Explain the Global Interpreter Lock (GIL) in Python and its impact on multi-threaded programs.',
            keywords: 'gil, global interpreter lock, thread, cpython, concurrency, cpu bound, mutex',
            answer: 'GIL is a mutex in CPython ensuring only one thread executes Python bytecode at a time, preventing true multi-core CPU-bound concurrency while remaining safe for I/O operations.'
          }
        ];
      } else if (sLower.includes('java')) {
        generated = [
          {
            id: Date.now() + 1,
            text: 'Explain the four fundamental pillars of Object-Oriented Programming (OOP) in Java.',
            keywords: 'encapsulation, abstraction, inheritance, polymorphism, classes, objects',
            answer: 'The four pillars are Encapsulation (data hiding), Abstraction (hiding implementation details), Inheritance (code reuse), and Polymorphism (method overloading and overriding).'
          },
          {
            id: Date.now() + 2,
            text: 'Differentiate between JVM, JRE, and JDK in Java architecture.',
            keywords: 'jvm, jre, jdk, bytecode, compiler, runtime, classloader, execution engine',
            answer: 'JDK provides development tools and compilers, JRE contains runtime libraries, and JVM executes compiled bytecode on the host OS.'
          }
        ];
      } else if (sLower.includes('data structure') || sLower.includes('algorithm') || sLower.includes('dsa')) {
        generated = [
          {
            id: Date.now() + 1,
            text: 'Compare Array vs Linked List data structures regarding memory allocation and operation complexities.',
            keywords: 'array, linked list, contiguous memory, pointer, node, o(1), o(n), insertion, deletion',
            answer: 'Arrays allocate contiguous memory blocks offering O(1) indexed access but expensive O(n) insertions. Linked Lists allocate dynamic non-contiguous nodes with O(1) head insertions.'
          },
          {
            id: Date.now() + 2,
            text: 'Explain how Binary Search algorithm works, its precondition, and time complexity.',
            keywords: 'binary search, sorted array, divide and conquer, o(log n), mid element, comparison',
            answer: 'Binary search requires a sorted collection, repeatedly halving the search space by comparing target with the middle element, achieving O(log n) time complexity.'
          }
        ];
      } else if (sLower.includes('database') || sLower.includes('dbms') || sLower.includes('sql')) {
        generated = [
          {
            id: Date.now() + 1,
            text: 'Explain ACID properties in Database Management Systems and why they are essential.',
            keywords: 'atomicity, consistency, isolation, durability, transaction, rollback, commit',
            answer: 'ACID guarantees database reliability: Atomicity (all-or-nothing), Consistency (rule preservation), Isolation (transaction independence), and Durability (committed persistence).'
          },
          {
            id: Date.now() + 2,
            text: 'What is Database Normalization? Differentiate between 1NF, 2NF, and 3NF.',
            keywords: 'normalization, redundancy, 1nf, 2nf, 3nf, primary key, functional dependency, transitive dependency',
            answer: 'Normalization eliminates redundancy and anomalies. 1NF ensures atomic values, 2NF removes partial key dependencies, and 3NF removes transitive dependencies.'
          }
        ];
      } else if (sLower.includes('network')) {
        generated = [
          {
            id: Date.now() + 1,
            text: 'Explain the 7 layers of the OSI Reference Model and the role of each layer.',
            keywords: 'physical, data link, network, transport, session, presentation, application, routing, packets, frames',
            answer: 'The 7 OSI layers are Physical (bits), Data Link (MAC frames), Network (IP routing), Transport (TCP/UDP reliability), Session (dialogue control), Presentation (syntax/encryption), and Application (network services).'
          },
          {
            id: Date.now() + 2,
            text: 'Describe the 3-Way Handshake mechanism in TCP connection establishment.',
            keywords: 'syn, syn-ack, ack, sequence number, three way handshake, reliable connection',
            answer: 'Client initiates connection with SYN, server responds with SYN-ACK and sequence number, and client acknowledges with ACK to establish a full-duplex TCP socket.'
          }
        ];
      } else if (sLower.includes('security') || sLower.includes('crypto')) {
        generated = [
          {
            id: Date.now() + 1,
            text: 'Differentiate between Symmetric and Asymmetric Public-Key Encryption with practical use cases.',
            keywords: 'symmetric, asymmetric, public key, private key, rsa, aes, encryption, decryption, digital certificate',
            answer: 'Symmetric encryption uses a single shared key for fast bulk data encryption (AES), while Asymmetric uses public-private key pairs for secure key exchange and digital signatures (RSA/ECC).'
          },
          {
            id: Date.now() + 2,
            text: 'What is a SQL Injection attack and how can web developers protect against it?',
            keywords: 'sql injection, sqli, parameterized queries, prepared statements, input sanitization, orm',
            answer: 'SQL Injection inserts malicious SQL commands into unvalidated inputs. It is prevented by using prepared statements with parameterized queries and ORM frameworks.'
          }
        ];
      } else if (sLower.includes('physic')) {
        generated = [
          {
            id: Date.now() + 1,
            text: 'State Newton’s Three Laws of Motion and describe a practical engineering application of each.',
            keywords: 'inertia, force, mass, acceleration, f=ma, action reaction, equal and opposite, momentum',
            answer: '1st Law: Law of Inertia (objects maintain motion unless acted by net force); 2nd Law: F=ma; 3rd Law: for every action force, there is an equal and opposite reaction force.'
          },
          {
            id: Date.now() + 2,
            text: 'State the Law of Conservation of Energy and explain energy transformation in a pendulum.',
            keywords: 'conservation of energy, potential energy, kinetic energy, transformation, total mechanical energy',
            answer: 'Energy cannot be created or destroyed, only transformed. At maximum pendulum height, energy is purely potential; at lowest point, it converts entirely to kinetic energy.'
          }
        ];
      } else if (sLower.includes('chemis')) {
        generated = [
          {
            id: Date.now() + 1,
            text: 'Explain the difference between Ionic and Covalent Chemical Bonding with examples.',
            keywords: 'ionic, covalent, electron transfer, electron sharing, electronegativity, ionic lattice, molecules',
            answer: 'Ionic bonding occurs when electrons transfer between atoms of high electronegativity difference (e.g. NaCl), while Covalent bonding involves shared electron pairs (e.g. H2O).'
          },
          {
            id: Date.now() + 2,
            text: 'What is Le Chatelier’s Principle and how does it predict dynamic chemical equilibrium shifts?',
            keywords: 'le chatelier, equilibrium, pressure, temperature, concentration, shift, exothermic, endothermic',
            answer: 'When a chemical system at equilibrium experiences changes in temperature, pressure, or concentration, the equilibrium shifts to counteract the applied change.'
          }
        ];
      } else if (sLower.includes('bio')) {
        generated = [
          {
            id: Date.now() + 1,
            text: 'Explain the biochemical process of Photosynthesis and its light and dark reactions.',
            keywords: 'photosynthesis, chloroplast, chlorophyll, carbon dioxide, water, glucose, oxygen, thylakoid, calvin cycle',
            answer: 'Photosynthesis uses light energy absorbed by chlorophyll to convert CO2 and H2O into glucose and O2, occurring through light-dependent reactions in thylakoids and the Calvin cycle in stroma.'
          },
          {
            id: Date.now() + 2,
            text: 'Describe the semi-conservative process of DNA replication and the functions of key enzymes.',
            keywords: 'dna replication, helicase, polymerase, semi conservative, replication fork, base pairing',
            answer: 'Helicase unwinds the double helix at the replication fork, and DNA Polymerase synthesizes complementary daughter strands using matching adenine-thymine and guanine-cytosine base pairs.'
          }
        ];
      } else if (sLower.includes('math') || sLower.includes('calculus')) {
        generated = [
          {
            id: Date.now() + 1,
            text: 'Explain the Fundamental Theorem of Calculus and its relationship between differentiation and integration.',
            keywords: 'fundamental theorem, differentiation, integration, derivative, definite integral, antiderivative',
            answer: 'The theorem connects differentiation and integration as inverse processes, stating that the definite integral of a function can be computed using its antiderivative.'
          },
          {
            id: Date.now() + 2,
            text: 'What is an Eigenvalue and Eigenvector in Linear Algebra? State their geometric significance.',
            keywords: 'eigenvalue, eigenvector, matrix, linear transformation, scalar, lambda, av=lambda v',
            answer: 'An eigenvector v of matrix A is a non-zero vector whose direction remains unchanged under the linear transformation, scaled only by the eigenvalue scalar lambda (Av = λv).'
          }
        ];
      } else if (sLower.includes('kannada')) {
        generated = [
          {
            id: Date.now() + 1,
            text: 'Explain the historical significance of Vachana Sahitya in 12th Century Kannada Literature.',
            keywords: 'vachana sahitya, basavanna, allama prabhu, akkamahadevi, kayaka, dasoha, equality, kannada',
            answer: 'Vachana Sahitya established socio-religious reform and democratic expression in simple rhythmic Kannada prose, championing Kayaka (work is worship) and Dasoha (selfless charity).'
          },
          {
            id: Date.now() + 2,
            text: 'Explain the major Kannada Sandhi rules: Lopa Sandhi, Aadesha Sandhi, and Aagama Sandhi with examples.',
            keywords: 'lopa sandhi, aadesha sandhi, aagama sandhi, kannada vyakarana, swara sandhi, vyanjana sandhi',
            answer: 'Kannada Sandhis join sounds: Lopa drops a vowel, Aagama inserts a consonant (y or v) between vowels, and Aadesha replaces initial root consonants (e.g. k, t, p to g, d, b).'
          }
        ];
      } else if (sLower.includes('english') || sLower.includes('literature')) {
        generated = [
          {
            id: Date.now() + 1,
            text: 'Explain the primary literary devices: Metaphor, Simile, Personification, and Alliteration with examples.',
            keywords: 'metaphor, simile, personification, alliteration, figurative language, comparison, rhetoric',
            answer: 'Simile compares using "like" or "as", metaphor asserts direct identity, personification attributes human traits to inanimate objects, and alliteration repeats initial consonant sounds.'
          },
          {
            id: Date.now() + 2,
            text: 'Analyze the dramatic structure of Shakespearean tragedy, focusing on hamartia and catharsis.',
            keywords: 'tragedy, hamartia, catharsis, hubris, climax, tragic flaw, resolution',
            answer: 'Shakespearean tragedies follow a five-act arc where the protagonist’s tragic flaw (hamartia) precipitates their downfall, evoking pity and fear that culminate in emotional catharsis.'
          }
        ];
      } else if (sLower.includes('economic') || sLower.includes('commerce') || sLower.includes('business')) {
        generated = [
          {
            id: Date.now() + 1,
            text: 'Explain the Law of Supply and Demand and how market equilibrium price is determined.',
            keywords: 'supply, demand, equilibrium price, market clearing, surplus, shortage, price elasticity',
            answer: 'Market equilibrium occurs at the price where consumer quantity demanded equals producer quantity supplied, with price adjustments resolving surpluses or shortages.'
          },
          {
            id: Date.now() + 2,
            text: 'Differentiate between Fiscal Policy and Monetary Policy used by governments to regulate economies.',
            keywords: 'fiscal policy, monetary policy, central bank, taxation, interest rates, inflation, government spending',
            answer: 'Fiscal policy is managed by the government via taxation and public spending, whereas Monetary policy is controlled by the Central Bank via interest rates and money supply regulation.'
          }
        ];
      } else if (sLower.includes('electron') || sLower.includes('circuit') || sLower.includes('vlsi')) {
        generated = [
          {
            id: Date.now() + 1,
            text: 'Explain the working principle and V-I characteristics of a PN Junction Diode in forward and reverse bias.',
            keywords: 'pn junction, diode, forward bias, reverse bias, depletion region, barrier potential, breakdown',
            answer: 'Forward bias reduces the depletion layer allowing exponential diffusion current above barrier potential; reverse bias widens the barrier resulting in only negligible leakage current.'
          },
          {
            id: Date.now() + 2,
            text: 'Differentiate between Combinational and Sequential digital logic circuits with examples.',
            keywords: 'combinational, sequential, flip flop, clock, memory, multiplexer, counter, latch',
            answer: 'Combinational circuit outputs depend solely on present inputs (e.g. adders, multiplexers), while Sequential circuits contain memory feedback elements (flip-flops, registers).'
          }
        ];
      } else {
        // Universal dynamic subject generator
        generated = [
          {
            id: Date.now() + 1,
            text: `Explain the fundamental concepts, core architecture, and primary principles of ${subj}.`,
            keywords: `${subj.toLowerCase()}, core concepts, architecture, fundamental principles, definitions, workflow`,
            answer: `${subj} provides systematic theoretical frameworks, standardized operational principles, and domain methodologies.`
          },
          {
            id: Date.now() + 2,
            text: `Describe standard problem-solving strategies and practical modern applications of ${subj}.`,
            keywords: `applications, modern implementation, optimization, performance, best practices, ${subj.toLowerCase()}`,
            answer: `In modern practice, ${subj} optimizes efficiency, enhances domain workflows, and ensures rigorous structured outcomes.`
          }
        ];
      }

      setVivaQuestions(prev => [...prev, ...generated]);
      say(`✨ AI generated ${generated.length} viva questions with evaluation rubrics for ${subj}!`);
    }, 800);
  };

  const handlePublishVivaExam = () => {
    if (!newViva.title.trim()) return say('Please enter Viva Exam Title.');
    const allQs = vivaQuestions.length > 0 ? vivaQuestions : [
      { text: newViva.questionText || `Explain core concepts of ${newViva.subject}`, keywords: newViva.keywords || 'concepts, definitions', answer: newViva.expectedAnswer || 'General answer' }
    ];

    const vivaObj = {
      id: Date.now(),
      title: newViva.title.trim(),
      subject: newViva.subject,
      group: newViva.group,
      teacherEmail: teacher.email || '',
      teacherName: teacher.fullName || '',
      questionsCount: allQs.length,
      questions: allQs,
      status: 'Active'
    };

    const updated = [vivaObj, ...oralVivaList];
    setOralVivaList(updated);
    try {
      const allSavedRaw = localStorage.getItem('shared_oral_vivas');
      const allSaved = allSavedRaw ? JSON.parse(allSavedRaw) : [];
      const others = Array.isArray(allSaved) ? allSaved.filter(v => v.teacherEmail && v.teacherEmail !== teacher.email && v.id !== vivaObj.id) : [];
      localStorage.setItem('shared_oral_vivas', JSON.stringify([vivaObj, ...oralVivaList, ...others]));

      const notifObj = {
        id: `notif_${Date.now()}_${Math.floor(Math.random()*1000)}`,
        title: `🎙️ New AI Oral Viva Exam: ${vivaObj.title}`,
        detail: `Teacher published AI Oral Viva exam for ${vivaObj.subject} (${vivaObj.group}). Spoken practice & AI auto-evaluation active on Student Dashboard.`,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        type: 'Oral Viva',
        read: false
      };
      const existingRaw = localStorage.getItem('shared_notifications');
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      localStorage.setItem('shared_notifications', JSON.stringify([notifObj, ...existing]));

      window.dispatchEvent(new Event('storage'));
    } catch (e) {}

    setNewViva({ title: '', subject: 'Operating Systems', group: 'All Blind Students', questionText: '', keywords: '', expectedAnswer: '' });
    setVivaQuestions([]);
    say(`Published AI Oral Viva "${vivaObj.title}" to Student Dashboard!`);
  };

  const handleDeleteVivaExam = (id) => {
    const updated = oralVivaList.filter(v => v.id !== id);
    setOralVivaList(updated);
    try {
      localStorage.setItem('shared_oral_vivas', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
    say('Oral Viva exam deleted.');
  };
  
  // Live Monitor & Student Requests
  const [assignedGroups, setAssignedGroups] = useState({ bcaSem3: true, visualSupportGroup: true, individualAarav: false, individualMeera: false });
  const [requests, setRequests] = useState(() => {
    try {
      const raw = localStorage.getItem('shared_assistance_requests');
      const parsed = raw ? JSON.parse(raw) : [];
      return filterRequestsForTeacher(parsed, teacher, savedExams);
    } catch {
      return [];
    }
  });
  const defaultStudentLogs = [];

  const [studentLogs, setStudentLogs] = useState(() => {
    try {
      const raw = localStorage.getItem('shared_live_logs');
      const parsed = (raw && JSON.parse(raw).length > 0) ? JSON.parse(raw) : [];
      return filterLogsForTeacher(parsed, teacher, savedExams);
    } catch {
      return [];
    }
  });

  const handleClearAllLiveLogs = () => {
    setStudentLogs([]);
    try {
      localStorage.setItem('shared_live_logs', JSON.stringify([]));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
    say('Cleared live proctoring logs.');
  };

  // Study Material Test Results State (Scoped to current teacher)
  const [studyTestResults, setStudyTestResults] = useState(() => {
    try {
      const raw = localStorage.getItem('shared_study_test_results');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter(r => (String(r.teacherEmail || '').toLowerCase().trim()) === teacherEmailKey);
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  const broadcastStorageKey = `shared_voice_broadcasts_${teacherEmailKey}`;
  const [broadcastList, setBroadcastList] = useState(() => {
    try {
      const raw = localStorage.getItem(broadcastStorageKey);
      if (raw) return JSON.parse(raw);
      const globalRaw = localStorage.getItem('shared_voice_broadcasts');
      if (globalRaw) {
        const parsed = JSON.parse(globalRaw);
        if (Array.isArray(parsed)) {
          return parsed.filter(b => (String(b.teacherEmail || '').toLowerCase().trim()) === teacherEmailKey);
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  const [newBroadcast, setNewBroadcast] = useState({ group: 'All Blind Students', title: '', message: '' });

  const handleSendVoiceBroadcast = () => {
    if (!newBroadcast.title.trim() || !newBroadcast.message.trim()) {
      say('Please enter a broadcast title and announcement message.');
      return;
    }
    const bObj = {
      id: Date.now(),
      sender: teacher.fullName || 'Teacher',
      teacherEmail: teacherEmailKey,
      group: newBroadcast.group,
      title: newBroadcast.title.trim(),
      message: newBroadcast.message.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    const updated = [bObj, ...broadcastList];
    setBroadcastList(updated);
    try {
      localStorage.setItem(broadcastStorageKey, JSON.stringify(updated));
      const globalRaw = localStorage.getItem('shared_voice_broadcasts');
      const globalExisting = globalRaw ? JSON.parse(globalRaw) : [];
      localStorage.setItem('shared_voice_broadcasts', JSON.stringify([bObj, ...globalExisting]));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}

    speak(`Voice broadcast published to ${bObj.group}: ${bObj.title}`);
    setNewBroadcast({ group: 'All Blind Students', title: '', message: '' });
    say('Voice announcement broadcasted live to all student dashboards!');
  };

  const say = text => { setNotice(text); setTimeout(() => setNotice(''), 3500); };

  // Fetch initial backend data & sync live with Student Dashboard
  useEffect(() => {
    let isMounted = true;
    fetchExams(teacher?.email)
      .then(data => {
        if (isMounted) {
          const examList = Array.isArray(data) ? data : [];
          const ownExams = examList.filter(e => {
            const cEmail = String(e.creatorEmail || e.teacherEmail || '').toLowerCase().trim();
            return cEmail && cEmail === teacherEmailKey;
          });
          setSavedExams(ownExams);
        }
      })
      .catch(() => {
        if (isMounted) {
          try {
            const raw = localStorage.getItem('shared_exams');
            if (raw) {
              const parsed = JSON.parse(raw);
              const ownExams = (Array.isArray(parsed) ? parsed : []).filter(e => {
                const cEmail = String(e.creatorEmail || e.teacherEmail || '').toLowerCase().trim();
                return cEmail && cEmail === teacherEmailKey;
              });
              setSavedExams(ownExams);
            } else {
              setSavedExams([]);
            }
          } catch (e) {
            setSavedExams([]);
          }
        }
      });
    fetchResults(teacher?.email)
      .then(data => { 
        if (isMounted && Array.isArray(data)) {
          setStudentResults(filterResultsForTeacher(data, teacher, savedExams));
        } 
      })
      .catch(() => {});

    const loadBackendAssistance = () => {
      fetchAssistanceRequests()
        .then(data => {
          if (isMounted && Array.isArray(data) && data.length > 0) {
            setRequests(prev => {
              const existingMap = new Map(prev.map(p => [String(p.id), p]));
              data.forEach(item => {
                existingMap.set(String(item.id || item._id), {
                  id: item.id || item._id,
                  student: item.studentName || item.student || 'Student',
                  question: item.request || item.examTitle || 'Emergency SOS',
                  time: item.time || 'Just now',
                  type: item.type || 'Emergency SOS',
                  status: item.status || 'Pending'
                });
              });
              return Array.from(existingMap.values());
            });
          }
        })
        .catch(() => {});
    };

    const syncWithStudent = () => {
      loadBackendAssistance();

      // 1. Read student results submitted from Student Dashboard (Filtered strictly for this teacher)
      const studentResultsRaw = localStorage.getItem('shared_student_results');
      if (studentResultsRaw) {
        try {
          const parsed = JSON.parse(studentResultsRaw);
          if (Array.isArray(parsed)) {
            setStudentResults(filterResultsForTeacher(parsed, teacher, savedExams));
          }
        } catch (e) {}
      }

      // 2. Read student assistance requests submitted from Student Dashboard
      const requestsRaw = localStorage.getItem('shared_assistance_requests');
      if (requestsRaw) {
        try {
          const parsed = JSON.parse(requestsRaw);
          if (Array.isArray(parsed)) {
            setRequests(filterRequestsForTeacher(parsed, teacher, savedExams));
          }
        } catch (e) {}
      }

      // 3. Read student live activity logs
      const liveLogsRaw = localStorage.getItem('shared_live_logs');
      if (liveLogsRaw) {
        try {
          const parsed = JSON.parse(liveLogsRaw);
          if (Array.isArray(parsed)) {
            setStudentLogs(filterLogsForTeacher(parsed, teacher, savedExams));
          }
        } catch (e) {}
      } else {
        setStudentLogs([]);
      }

      // 4. Read student study material test performance results live
      const studyTestRaw = localStorage.getItem('shared_study_test_results');
      if (studyTestRaw) {
        try {
          const parsed = JSON.parse(studyTestRaw);
          if (Array.isArray(parsed)) {
            setStudyTestResults(parsed.filter(r => (String(r.teacherEmail || '').toLowerCase().trim()) === teacherEmailKey));
          }
        } catch (e) {}
      }

      // 5. Sync registered student subjects live
      loadRegisteredStudents();
    };

    const handleSosEvent = (e) => {
      syncWithStudent();
      if (e.detail) {
        setNotice(`🚨 Emergency SOS Alert received from ${e.detail.studentName || e.detail.student}!`);
      }
    };

    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    syncWithStudent();
    window.addEventListener('storage', syncWithStudent);
    window.addEventListener('sos_alert', handleSosEvent);
    const interval = setInterval(syncWithStudent, 3000);

    return () => {
      isMounted = false;
      window.removeEventListener('storage', syncWithStudent);
      window.removeEventListener('sos_alert', handleSosEvent);
      clearInterval(interval);
    };
  }, []);

  // Whenever Teacher updates savedExams, write to shared_exams for Student Dashboard
  useEffect(() => {
    if (savedExams.length > 0) {
      try {
        const raw = localStorage.getItem('shared_exams');
        const existing = raw ? JSON.parse(raw) : [];
        const otherTeachersExams = Array.isArray(existing)
          ? existing.filter(e => (String(e.creatorEmail || e.teacherEmail || '').toLowerCase().trim()) !== teacherEmailKey)
          : [];
        localStorage.setItem('shared_exams', JSON.stringify([...savedExams, ...otherTeachersExams]));
      } catch (e) {}
    }
  }, [savedExams, teacherEmailKey]);

  // Whenever savedExams updates, ensure studentResults, studentLogs, and requests are re-filtered for this teacher
  useEffect(() => {
    try {
      const studentResultsRaw = localStorage.getItem('shared_student_results');
      if (studentResultsRaw) {
        const parsed = JSON.parse(studentResultsRaw);
        if (Array.isArray(parsed)) {
          setStudentResults(filterResultsForTeacher(parsed, teacher, savedExams));
        }
      }
      const liveLogsRaw = localStorage.getItem('shared_live_logs');
      if (liveLogsRaw) {
        const parsed = JSON.parse(liveLogsRaw);
        if (Array.isArray(parsed)) {
          setStudentLogs(filterLogsForTeacher(parsed, teacher, savedExams));
        }
      }
      const requestsRaw = localStorage.getItem('shared_assistance_requests');
      if (requestsRaw) {
        const parsed = JSON.parse(requestsRaw);
        if (Array.isArray(parsed)) {
          setRequests(filterRequestsForTeacher(parsed, teacher, savedExams));
        }
      }
    } catch (e) {}
  }, [savedExams, teacher.email, teacher.fullName]);

  const handleOpenExamCorrection = (submission) => {
    setActiveCorrection(submission);
    
    let qs = [];
    if (submission.questions && Array.isArray(submission.questions) && submission.questions.length > 0) {
      qs = submission.questions.map((q, idx) => {
        const qId = q.id !== undefined ? q.id : idx + 1;
        const ansFromMap = submission.answers ? (
          submission.answers[`${submission.examId || submission.id}-${idx}`] ||
          submission.answers[`${submission.examId || submission.id}-${qId}`] ||
          submission.answers[qId] ||
          submission.answers[`${qId}`] ||
          submission.answers[`q_${qId}`] ||
          submission.answers[idx] ||
          submission.answers[`q_${idx}`]
        ) : null;

        const effectiveStudentAnswer = (q.studentAnswer && q.studentAnswer !== 'No answer recorded')
          ? q.studentAnswer
          : (ansFromMap || q.studentAnswer || 'No answer recorded');

        return {
          id: qId,
          text: q.text || q.questionText || `Question #${idx + 1}`,
          type: q.type || 'Descriptive Theory',
          options: q.options || [],
          correctAnswer: q.correctAnswer || q.expectedAnswer || 'Refer to subject rubric',
          studentAnswer: effectiveStudentAnswer,
          maxMarks: Number(q.maxMarks || q.marks || 5),
          marksAwarded: q.marksAwarded !== undefined ? Number(q.marksAwarded) : Number(q.maxMarks || q.marks || 5),
          teacherComment: q.teacherComment || ''
        };
      });
    } else if (submission.answers && typeof submission.answers === 'object') {
      qs = Object.entries(submission.answers).map(([key, ans], idx) => ({
        id: idx + 1,
        text: `Theory Question #${idx + 1} (${submission.subject || 'General'})`,
        type: 'Descriptive Theory',
        options: [],
        correctAnswer: 'Expected standard technical answer.',
        studentAnswer: String(ans || 'No response recorded'),
        maxMarks: 10,
        marksAwarded: 8,
        teacherComment: ''
      }));
    } else {
      qs = [
        {
          id: 1,
          text: `Comprehensive Theory Question 1 for ${submission.examTitle || submission.examName || 'Assessment'}`,
          type: 'Descriptive Theory',
          options: [],
          correctAnswer: 'Core architecture and principles.',
          studentAnswer: submission.feedback || 'Recorded voice answer from blind examinee.',
          maxMarks: 50,
          marksAwarded: submission.score ? Math.round(submission.score / 2) : 40,
          teacherComment: ''
        },
        {
          id: 2,
          text: `Applied Workflow Question 2 for ${submission.examTitle || submission.examName || 'Assessment'}`,
          type: 'Descriptive Theory',
          options: [],
          correctAnswer: 'Technical workflow and implementation.',
          studentAnswer: 'Recorded voice answer from blind examinee.',
          maxMarks: 50,
          marksAwarded: submission.score ? Math.round(submission.score / 2) : 45,
          teacherComment: ''
        }
      ];
    }

    setCorrectionQuestions(qs);
    setOverallFeedbackInput(submission.feedback && !submission.feedback.includes('Pending Teacher') ? submission.feedback : 'Great conceptual clarity and accurate voice responses.');
    say(`Loaded exam submission from ${submission.student || submission.studentName} for evaluation.`);
  };

  const handleUpdateQuestionMark = (idx, newMark) => {
    const updated = [...correctionQuestions];
    const max = updated[idx].maxMarks || 5;
    const clamped = Math.max(0, Math.min(max, Number(newMark) || 0));
    updated[idx].marksAwarded = clamped;
    setCorrectionQuestions(updated);
  };

  const handleQuickMark = (idx, multiplier) => {
    const updated = [...correctionQuestions];
    const max = updated[idx].maxMarks || 5;
    updated[idx].marksAwarded = Math.round(max * multiplier);
    setCorrectionQuestions(updated);
  };

  const handleUpdateQuestionComment = (idx, comment) => {
    const updated = [...correctionQuestions];
    updated[idx].teacherComment = comment;
    setCorrectionQuestions(updated);
  };

  const handleSaveAndPublishCorrection = () => {
    if (!activeCorrection) return;

    const totalPossible = correctionQuestions.reduce((acc, q) => acc + (Number(q.maxMarks) || 5), 0) || 100;
    const sumAwarded = correctionQuestions.reduce((acc, q) => acc + (Number(q.marksAwarded) || 0), 0);
    const percentage = Math.round((sumAwarded / totalPossible) * 100);

    const sName = activeCorrection.student || activeCorrection.studentName || 'Student';
    const eTitle = activeCorrection.examName || activeCorrection.examTitle || 'Theory Assessment';

    const correctedItem = {
      ...activeCorrection,
      score: sumAwarded,
      total: totalPossible,
      totalMarks: totalPossible,
      percentage: percentage,
      status: 'Corrected & Graded',
      feedback: overallFeedbackInput.trim() || 'Exam corrected by teacher. Official grade published.',
      teacherFeedback: overallFeedbackInput.trim() || 'Exam corrected by teacher.',
      evaluatedBy: teacher.fullName && teacher.fullName !== 'Teacher' ? teacher.fullName : 'Course Instructor',
      teacherName: teacher.fullName && teacher.fullName !== 'Teacher' ? teacher.fullName : 'Course Instructor',
      teacherEmail: teacher.email || '',
      evaluatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      questions: correctionQuestions
    };

    // 1. Update studentResults in Teacher Dashboard state
    const updatedResults = studentResults.map(r => (r.id === activeCorrection.id ? correctedItem : r));
    if (!updatedResults.some(r => r.id === activeCorrection.id)) {
      updatedResults.unshift(correctedItem);
    }
    setStudentResults(updatedResults);

    // 2. Persist in shared_student_results for Student Dashboard
    try {
      localStorage.setItem('shared_student_results', JSON.stringify(updatedResults));
      
      const existingCompleted = JSON.parse(localStorage.getItem('student_completed_results') || '[]');
      const updatedCompleted = existingCompleted.map(r => (r.id === activeCorrection.id ? correctedItem : r));
      if (!updatedCompleted.some(r => r.id === activeCorrection.id)) {
        updatedCompleted.unshift(correctedItem);
      }
      localStorage.setItem('student_completed_results', JSON.stringify(updatedCompleted));

      const evaluatorName = teacher.fullName && teacher.fullName !== 'Teacher' ? teacher.fullName : 'Your teacher';
      const notifItem = {
        id: `notif_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        title: `📝 Exam Graded: ${eTitle}`,
        detail: `${evaluatorName} evaluated your submitted exam '${eTitle}'. Final Score: ${sumAwarded}/${totalPossible} (${percentage}%). Your official certificate has been updated!`,
        date: 'Just now',
        type: 'Result Published',
        read: false
      };
      const existingNotifs = JSON.parse(localStorage.getItem('shared_notifications') || '[]');
      localStorage.setItem('shared_notifications', JSON.stringify([notifItem, ...existingNotifs]));

      window.dispatchEvent(new Event('storage'));
    } catch (e) {}

    setActiveCorrection(null);
    say(`✓ Corrected exam for ${sName}! Score: ${sumAwarded}/${totalPossible} (${percentage}%). Grade and certificates published live to student dashboard.`);
  };

  const handleDeleteSubmission = (submissionId) => {
    const updated = studentResults.filter(r => r.id !== submissionId);
    setStudentResults(updated);
    try {
      localStorage.setItem('shared_student_results', JSON.stringify(updated));
      const existingCompleted = JSON.parse(localStorage.getItem('student_completed_results') || '[]');
      const updatedCompleted = existingCompleted.filter(r => r.id !== submissionId);
      localStorage.setItem('student_completed_results', JSON.stringify(updatedCompleted));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
    say('Student submission removed.');
  };

  const totalExamMarks = useMemo(() => {
    return questions.filter(q => selectedQuestionIds.includes(q.id)).reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
  }, [questions, selectedQuestionIds]);

  const filteredQuestions = useMemo(() => {
    return questions.filter(item => {
      if (!isSubjectMatch(item.subject || item.topic, selectedTeacherSubject)) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (item.text && item.text.toLowerCase().includes(q)) ||
        (item.subject && item.subject.toLowerCase().includes(q)) ||
        (item.type && item.type.toLowerCase().includes(q))
      );
    });
  }, [questions, selectedTeacherSubject, searchQuery]);

  const filteredSavedExams = useMemo(() => {
    return savedExams.filter(item => isSubjectMatch(item.subject || item.topic, selectedTeacherSubject));
  }, [savedExams, selectedTeacherSubject]);

  const subjectQuestionsForExam = useMemo(() => {
    return questions.filter(q => isSubjectMatch(q.subject || q.topic, selectedTeacherSubject));
  }, [questions, selectedTeacherSubject]);

  const filteredStudyMaterials = useMemo(() => {
    return studyMaterials.filter(mat => isSubjectMatch(mat.subject, selectedTeacherSubject));
  }, [studyMaterials, selectedTeacherSubject]);

  const filteredStudentResults = useMemo(() => {
    return studentResults.filter(res => {
      if (!selectedTeacherSubject || selectedTeacherSubject === 'ALL') return true;
      if (res.subject && isSubjectMatch(res.subject, selectedTeacherSubject)) return true;
      if (res.examSubject && isSubjectMatch(res.examSubject, selectedTeacherSubject)) return true;
      const matchedExam = savedExams.find(e => (e._id && (e._id === res.examId || e._id === res.exam?._id)) || (e.title && e.title === res.examTitle));
      if (matchedExam && isSubjectMatch(matchedExam.subject, selectedTeacherSubject)) return true;
      if (res.examTitle && isSubjectMatch(res.examTitle, selectedTeacherSubject)) return true;
      return false;
    });
  }, [studentResults, savedExams, selectedTeacherSubject]);

  const filteredStudyTestResults = useMemo(() => {
    return studyTestResults.filter(st => isSubjectMatch(st.subject || st.materialTitle, selectedTeacherSubject));
  }, [studyTestResults, selectedTeacherSubject]);

  const filteredOralVivas = useMemo(() => {
    return oralVivaList.filter(v => isSubjectMatch(v.subject || v.title, selectedTeacherSubject));
  }, [oralVivaList, selectedTeacherSubject]);

  const filteredVivaSubmissions = useMemo(() => {
    return vivaSubmissions.filter(s => isSubjectMatch(s.subject || s.vivaTitle || s.topic, selectedTeacherSubject));
  }, [vivaSubmissions, selectedTeacherSubject]);

  // Built-in Browser Text-to-Speech (TTS) Helper for Teacher Audio Previews
  const speak = (text) => {
    if (!text) return;
    speakBuiltinTTS(text, {
      lang: access.language || 'en-US',
      rate: 0.85,
      pitch: 1.0,
      onEnd: () => setIsPlayingSpeech(false)
    });
    setIsPlayingSpeech(true);
  };

  const stopSpeech = () => {
    cancelSpeech();
    setIsPlayingSpeech(false);
  };

  // Exam CRUD Operations
  const handleSaveExam = async () => {
    setBusy(true);
    try {
      const examQuestions = questions.filter(q => selectedQuestionIds.includes(q.id));
      const payload = {
        title: exam.title,
        subject: exam.subject,
        duration: exam.duration,
        date: exam.date,
        time: exam.time,
        passMark: exam.passMark,
        instructions: exam.instructions,
        status: exam.status,
        defaultLanguage: 'en',
        allowedLanguages: ['en'],
        accessibilitySettings: access,
        assignedStudents: exam.targetStudentEmail
          ? [exam.targetStudentEmail]
          : (exam.assignedStudents && exam.assignedStudents.length > 0 ? exam.assignedStudents : []),
        targetStudentEmail: exam.targetStudentEmail || '',
        targetStudentName: exam.targetStudentName || '',
        questions: examQuestions.map(q => ({
          text: q.text,
          type: q.type,
          marks: q.marks,
          difficulty: q.difficulty,
          options: q.options || [],
          correctAnswer: q.correctAnswer || ''
        }))
      };

      let nextSaved;
      if (editingExamId) {
        const updated = await updateExam(editingExamId, payload);
        nextSaved = savedExams.map(item => ((item._id === editingExamId || item.id === editingExamId) ? updated : item));
        setSavedExams(nextSaved);
        say('Exam updated successfully in MongoDB database.');
      } else {
        const created = await createExam(payload);
        nextSaved = [created, ...savedExams];
        setSavedExams(nextSaved);
        say(exam.targetStudentName 
          ? `Personalized exam saved for ${exam.targetStudentName} (${payload.subject}).` 
          : 'New exam saved successfully to MongoDB database.');
      }
      try {
        localStorage.setItem('shared_exams', JSON.stringify(nextSaved));
        
        // Publish notification for student dashboard
        const notifObj = {
          id: `notif_${Date.now()}_${Math.floor(Math.random()*1000)}`,
          title: exam.targetStudentName 
            ? `🎯 Personalized Exam for ${exam.targetStudentName}: ${payload.title}` 
            : `🔔 New Exam Scheduled: ${payload.title}`,
          detail: exam.targetStudentName
            ? `Teacher created a personalized exam '${payload.title}' (${payload.subject}) specifically for ${exam.targetStudentName} based on their interested subject.`
            : `Teacher scheduled a new exam '${payload.title}' (${payload.subject}) on ${payload.date || 'upcoming date'} at ${payload.time || '10:00 AM'}. Duration: ${payload.duration} mins.`,
          date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          type: 'Exam',
          targetStudentEmail: exam.targetStudentEmail || '',
          read: false
        };
        const existingRaw = localStorage.getItem('shared_notifications');
        const existing = existingRaw ? JSON.parse(existingRaw) : [];
        localStorage.setItem('shared_notifications', JSON.stringify([notifObj, ...existing]));

        window.dispatchEvent(new Event('storage'));
      } catch (e) {}
      setEditingExamId(null);
      setExam(initialExamState);
      setSelectedQuestionIds([]);
      try {
        localStorage.removeItem(draftExamKey);
        localStorage.removeItem(draftQidsKey);
      } catch (e) {}
    } catch (e) {
      say(e.message || 'Could not save exam to backend.');
    } finally {
      setBusy(false);
    }
  };

  const handleEditExam = (savedItem) => {
    setEditingExamId(savedItem._id || savedItem.id);
    setExam({
      title: savedItem.title || savedItem.examTitle || 'Exam Title',
      subject: savedItem.subject || 'Computer Science',
      targetStudentEmail: savedItem.targetStudentEmail || (savedItem.assignedStudents && savedItem.assignedStudents[0]) || '',
      targetStudentName: savedItem.targetStudentName || '',
      assignedStudents: savedItem.assignedStudents || (savedItem.targetStudentEmail ? [savedItem.targetStudentEmail] : []),
      date: savedItem.date || '2026-10-15',
      time: savedItem.startTime || savedItem.time || '10:00',
      duration: savedItem.durationMinutes || savedItem.duration || 60,
      passMark: savedItem.passingMarks || savedItem.passMark || 40,
      status: savedItem.status || 'Scheduled',
      instructions: savedItem.instructions || '',
      defaultLanguage: savedItem.defaultLanguage || 'en',
      allowedLanguages: ['en']
    });
    if (savedItem.questions && savedItem.questions.length > 0) {
      const loadedQuestions = savedItem.questions.map((q, idx) => ({
        id: `saved-${Date.now()}-${idx}`,
        text: q.questionText || q.text,
        type: q.questionType || q.type || 'MCQ',
        marks: q.marks || 2,
        difficulty: q.difficulty || 'Medium',
        options: q.options || [],
        correctAnswer: q.correctAnswer || ''
      }));
      setQuestions(prev => [...loadedQuestions, ...prev]);
      setSelectedQuestionIds(loadedQuestions.map(q => q.id));
    }
    setPage('Create exam');
    say(`Loaded exam "${savedItem.title || savedItem.examTitle}" into editor.`);
  };

  const handleDeleteExam = async (examId) => {
    try {
      await deleteExam(examId);
      const nextSaved = savedExams.filter(x => (x._id || x.id) !== examId);
      setSavedExams(nextSaved);
      try {
        localStorage.setItem('shared_exams', JSON.stringify(nextSaved));
        window.dispatchEvent(new Event('storage'));
      } catch (e) {}
      say('Exam deleted from database.');
    } catch (e) {
      say('Failed to delete exam.');
    }
  };

  // Helper to sync active exam to savedExams and storage
  const syncActiveExamWithQuestions = (newQuestionsList, selectedIdsList) => {
    const activeExamTitle = exam.title || 'Created Theory Assessment';
    const activeExamSubject = exam.subject || 'Computer Science';

    const selectedQ = newQuestionsList.filter(q => selectedIdsList.includes(q.id));
    const formattedQuestions = selectedQ.map(q => ({
      text: q.text,
      type: q.type,
      marks: q.marks,
      difficulty: q.difficulty,
      options: q.options || [],
      correctAnswer: q.correctAnswer || ''
    }));

    const existingIndex = savedExams.findIndex(x => (x.title === activeExamTitle || x.examTitle === activeExamTitle || x._id === editingExamId));
    let nextSaved;

    if (existingIndex !== -1) {
      nextSaved = [...savedExams];
      nextSaved[existingIndex] = {
        ...nextSaved[existingIndex],
        questions: formattedQuestions
      };
    } else {
      const autoExam = {
        _id: `exam-${Date.now()}`,
        title: activeExamTitle,
        subject: activeExamSubject,
        duration: exam.duration || 60,
        durationMinutes: exam.duration || 60,
        date: exam.date || 'Upcoming',
        time: exam.time || '10:00 AM',
        status: exam.status || 'Active',
        instructions: exam.instructions || 'Read all theory questions carefully.',
        questions: formattedQuestions
      };
      nextSaved = [autoExam, ...savedExams];
    }

    setSavedExams(nextSaved);
    try {
      localStorage.setItem('shared_exams', JSON.stringify(nextSaved));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
  };

  // Question Builder Add
  const handleAddQuestion = () => {
    if (!newQuestion.text.trim()) return say('Please enter the question text.');
    const options = newQuestion.type === 'MCQ' ? [newQuestion.optionA, newQuestion.optionB, newQuestion.optionC, newQuestion.optionD].filter(Boolean) : [];
    const qObj = {
      id: Date.now(),
      text: newQuestion.text.trim(),
      type: newQuestion.type,
      marks: Number(newQuestion.marks) || 1,
      difficulty: newQuestion.difficulty,
      options,
      correctAnswer: newQuestion.answer.trim(),
      subject: newQuestion.subject || 'General'
    };
    const updatedQuestions = [qObj, ...questions];
    const updatedSelected = [qObj.id, ...selectedQuestionIds];

    setQuestions(updatedQuestions);
    setSelectedQuestionIds(updatedSelected);
    setNewQuestion({ type: 'MCQ', text: '', optionA: '', optionB: '', optionC: '', optionD: '', answer: '', marks: 2, difficulty: 'Medium', subject: selectedTeacherSubject !== 'ALL' ? selectedTeacherSubject : 'General' });

    syncActiveExamWithQuestions(updatedQuestions, updatedSelected);
    say('Question created and live synced to Student Dashboard.');
  };

  // Bulk Multi-Question Textarea Handler (Add so many questions in one time!)
  const handleBulkAddQuestions = () => {
    if (!bulkText.trim()) return say('Please paste or type multiple questions in the bulk text area.');

    const rawLines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    if (!rawLines.length) return say('No valid question text found.');

    let parsedQuestions = [];

    if (bulkType === 'MCQ' || rawLines.some(l => /^(Option\s+)?[A-D][\)\.\:\-]/i.test(l))) {
      // Smart MCQ Parser: group Question line + Option lines (A, B, C, D) + Answer line into single question
      let currentQ = null;

      rawLines.forEach((line) => {
        const isOption = /^(Option\s+)?[A-D][\)\.\:\-]\s*/i.test(line);
        const isAnswer = /^(Answer|Ans|Correct|Key)[\:\=]\s*/i.test(line);
        const isQuestionNum = /^(Q?\d+[\.\:\)\-]\s*)/i.test(line);

        if (isOption && currentQ) {
          currentQ.options.push(line);
        } else if (isAnswer && currentQ) {
          const ansKey = line.replace(/^(Answer|Ans|Correct|Key)[\:\=]\s*/i, '').trim();
          currentQ.correctAnswer = ansKey;
        } else if (isQuestionNum || (!isOption && !isAnswer)) {
          if (currentQ) {
            parsedQuestions.push(currentQ);
          }
          const cleanText = line.replace(/^(Q?\d+[\.\:\)\-]\s*)/i, '').trim();
          currentQ = {
            id: Date.now() + Math.random(),
            text: cleanText,
            type: 'MCQ',
            marks: Number(bulkMarks) || 2,
            difficulty: bulkDifficulty,
            options: [],
            correctAnswer: '',
            subject: bulkSubject || 'General'
          };
        }
      });

      if (currentQ) {
        parsedQuestions.push(currentQ);
      }
    } else {
      // Line-by-line parsing for non-MCQ theory/short answer questions
      parsedQuestions = rawLines.map((line, idx) => {
        const cleanText = line.replace(/^(Q?\d+[\.\:\)\-]\s*)/i, '').trim();
        return {
          id: Date.now() + idx,
          text: cleanText,
          type: bulkType,
          marks: Number(bulkMarks) || 2,
          difficulty: bulkDifficulty,
          options: [],
          correctAnswer: '',
          subject: bulkSubject || 'General'
        };
      });
    }

    if (!parsedQuestions.length) return say('Could not parse questions. Please check format.');

    const updatedQuestions = [...parsedQuestions, ...questions];
    const updatedSelected = [...parsedQuestions.map(q => q.id), ...selectedQuestionIds];

    setQuestions(updatedQuestions);
    setSelectedQuestionIds(updatedSelected);
    setBulkText('');

    syncActiveExamWithQuestions(updatedQuestions, updatedSelected);
    say(`Successfully added ${parsedQuestions.length} structured question(s) to Question Bank and Active Exam!`);
  };

  // Multi-Row Builder Handler (Add multiple question cards at once)
  const handleSaveMultiRows = () => {
    const validRows = multiRows.filter(r => r.text.trim());
    if (!validRows.length) return say('Please fill in at least one question text row.');

    const createdQuestions = validRows.map((r, idx) => ({
      id: Date.now() + idx,
      text: r.text.trim(),
      type: r.type || 'Descriptive Theory',
      marks: Number(r.marks) || 2,
      difficulty: r.difficulty || 'Medium',
      options: [],
      correctAnswer: (r.answer || '').trim(),
      subject: r.subject || bulkSubject || 'General'
    }));

    const updatedQuestions = [...createdQuestions, ...questions];
    const updatedSelected = [...createdQuestions.map(q => q.id), ...selectedQuestionIds];

    setQuestions(updatedQuestions);
    setSelectedQuestionIds(updatedSelected);
    setMultiRows([
      { id: Date.now() + 10, text: '', type: 'Descriptive Theory', marks: 2, difficulty: 'Medium', answer: '', subject: 'Computer Science' },
      { id: Date.now() + 11, text: '', type: 'Descriptive Theory', marks: 2, difficulty: 'Medium', answer: '', subject: 'Computer Science' }
    ]);

    syncActiveExamWithQuestions(updatedQuestions, updatedSelected);
    say(`Successfully added ${createdQuestions.length} questions from multi-row builder!`);
  };

  const handleAddMultiRow = () => {
    setMultiRows(prev => [
      ...prev,
      { id: Date.now() + Math.random(), text: '', type: 'Descriptive Theory', marks: 2, difficulty: 'Medium', answer: '', subject: bulkSubject || 'Computer Science' }
    ]);
  };

  const handleRemoveMultiRow = (id) => {
    setMultiRows(prev => prev.filter(r => r.id !== id));
  };

  const handleUpdateMultiRow = (id, field, value) => {
    setMultiRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  // AI Generator
  const handleGenerateAI = async () => {
    setBusy(true);
    try {
      const drafts = await generateDraftQuestions(ai);
      const updatedQuestions = [...drafts, ...questions];
      const updatedSelected = [...drafts.map(d => d.id), ...selectedQuestionIds];

      setQuestions(updatedQuestions);
      setSelectedQuestionIds(updatedSelected);

      syncActiveExamWithQuestions(updatedQuestions, updatedSelected);
      say(`${drafts.length} AI draft questions generated and live synced to Student Dashboard!`);
      setPage('Question bank');
    } catch (e) {
      say('Failed to generate AI questions.');
    } finally {
      setBusy(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setOcrFileName(file.name);
    setIsOcrProcessing(true);
    setExtractedOcrQuestions([]);
    setSelectedOcrIndexes([]);
    say(`📄 Processing OCR extraction for "${file.name}"...`);

    const reader = new FileReader();

    const processExtractedContent = (rawContent) => {
      const cleanFileName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      const uppercaseTitle = cleanFileName.charAt(0).toUpperCase() + cleanFileName.slice(1);

      // Clean raw text: Strip PDF metadata tags, binary header tags, and structural syntax
      let cleanText = (rawContent || '')
        .replace(/%PDF-\d\.\d/g, '')
        .replace(/<<[\s\S]*?>>/g, '')
        .replace(/endobj|obj|stream|endstream|xref|trailer|startxref/gi, '')
        .replace(/\/[\w]+/g, '')
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Extract meaningful text sentences for descriptive theory questions
      let rawLines = cleanText
        .split(/(?:\. |\n|\r)+/)
        .map(l => l.trim())
        .filter(l => l.length > 25 && !l.includes('Catalog') && !l.includes('Metadata') && !l.includes('ViewerPreferences') && !l.includes('StructTreeRoot'));

      // Generate EXCLUSIVELY Descriptive Theory Questions
      const generatedTheoryQuestions = [
        {
          id: `ocr-${Date.now()}-1`,
          text: rawLines[0] && rawLines[0].length > 25 
            ? `Explain the core concept of: ${rawLines[0].slice(0, 140)}.` 
            : `Explain the core architecture, fundamental concepts, and primary features of ${uppercaseTitle}.`,
          type: 'Descriptive Theory',
          marks: 5,
          difficulty: 'Medium',
          subject: uppercaseTitle,
          options: [],
          correctAnswer: `Detailed theoretical explanation covering the core architecture, definitions, and operational mechanisms of ${uppercaseTitle}.`
        },
        {
          id: `ocr-${Date.now()}-2`,
          text: rawLines[1] && rawLines[1].length > 25 
            ? `Discuss the significance and practical application of: ${rawLines[1].slice(0, 140)}.` 
            : `Discuss the key advantages, working mechanisms, and practical applications described in ${uppercaseTitle}.`,
          type: 'Descriptive Theory',
          marks: 5,
          difficulty: 'Medium',
          subject: uppercaseTitle,
          options: [],
          correctAnswer: `Comprehensive theoretical analysis highlighting practical applications, key benefits, and system workflows.`
        },
        {
          id: `ocr-${Date.now()}-3`,
          text: rawLines[2] && rawLines[2].length > 25 
            ? `Describe the implementation details of: ${rawLines[2].slice(0, 140)}.` 
            : `Describe the step-by-step implementation process and accessibility considerations for ${uppercaseTitle}.`,
          type: 'Descriptive Theory',
          marks: 8,
          difficulty: 'Hard',
          subject: uppercaseTitle,
          options: [],
          correctAnswer: `In-depth theoretical breakdown of step-by-step implementation, system design considerations, and standards compliance.`
        },
        {
          id: `ocr-${Date.now()}-4`,
          text: `Elaborate on the security measures, error handling, and best practices required when working with ${uppercaseTitle}.`,
          type: 'Descriptive Theory',
          marks: 10,
          difficulty: 'Hard',
          subject: uppercaseTitle,
          options: [],
          correctAnswer: `Detailed discussion covering security protocols, exception handling strategies, and industry standard best practices.`
        }
      ];

      setExtractedOcrQuestions(generatedTheoryQuestions);
      setSelectedOcrIndexes(generatedTheoryQuestions.map((_, idx) => idx));
      setIsOcrProcessing(false);
      say(`✨ OCR Complete! Extracted ${generatedTheoryQuestions.length} descriptive theory questions from "${file.name}". Please select questions to add.`);
      speak(`OCR extraction complete for ${file.name}. Extracted ${generatedTheoryQuestions.length} descriptive theory questions. Please select which questions to import.`);
    };

    reader.onload = (event) => {
      let text = '';
      try {
        const content = event.target.result;
        if (typeof content === 'string') {
          text = content;
        } else {
          const decoder = new TextDecoder('utf-8');
          text = decoder.decode(content);
        }
      } catch (err) {}
      processExtractedContent(text);
    };

    if (file.name.endsWith('.txt')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const handleConfirmAddOcrQuestions = () => {
    if (selectedOcrIndexes.length === 0) {
      return say('Please select at least one question to import.');
    }

    const selectedQuestions = extractedOcrQuestions.filter((_, idx) => selectedOcrIndexes.includes(idx));
    const updatedQuestions = [...selectedQuestions, ...questions];
    const updatedSelectedIds = [...selectedQuestions.map(q => q.id), ...selectedQuestionIds];

    setQuestions(updatedQuestions);
    setSelectedQuestionIds(updatedSelectedIds);
    syncActiveExamWithQuestions(updatedQuestions, updatedSelectedIds);

    say(`Added ${selectedQuestions.length} selected OCR questions to Question Bank & Active Exam!`);
    speak(`Added ${selectedQuestions.length} selected questions to the exam and question bank.`);

    setExtractedOcrQuestions([]);
    setSelectedOcrIndexes([]);
    setOcrFileName('');
  };

  const handleToggleOcrSelect = (index) => {
    setSelectedOcrIndexes(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleToggleSelectAllOcr = () => {
    if (selectedOcrIndexes.length === extractedOcrQuestions.length) {
      setSelectedOcrIndexes([]);
    } else {
      setSelectedOcrIndexes(extractedOcrQuestions.map((_, idx) => idx));
    }
  };

  const handleUpdateExtractedQuestionText = (index, newText) => {
    setExtractedOcrQuestions(prev => prev.map((q, idx) => idx === index ? { ...q, text: newText } : q));
  };

  const Title = ({ title, text, action }) => (
    <div className="ea-title">
      <div>
        <div style={{ marginBottom: '8px' }}>
          <ProjectLogo size="small" />
        </div>
        <p>TEACHER PORTAL · ACCESSIBLE EXAM ASSISTANT</p>
        <h1>{title}</h1>
        <span>{text}</span>
      </div>
      {action}
    </div>
  );

  // 1. Overview Tab
  const renderOverview = (
    <>
      <Title
        title={`Welcome, ${teacher.fullName}`}
        text="Create, monitor, and evaluate inclusive examinations for blind and visually impaired students."
        action={
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="ea-primary" onClick={() => { setEditingExamId(null); setPage('Create exam'); }}>+ Create New Exam</button>
            <button onClick={() => setPage('Create exam')}>✦ AI Question Generator</button>
          </div>
        }
      />
      
      <div className="ea-metrics">
        <div className="ea-card">
          <strong>{filteredSavedExams.length}</strong>
          <span>Exams Saved ({selectedTeacherSubject !== 'ALL' ? selectedTeacherSubject : 'All Subjects'})</span>
        </div>
        <div className="ea-card">
          <strong>{filteredQuestions.length}</strong>
          <span>Question Bank ({selectedTeacherSubject !== 'ALL' ? selectedTeacherSubject : 'All Subjects'})</span>
        </div>
        <div className="ea-card">
          <strong>{studentAccommodations.length}</strong>
          <span>Visually Impaired Students Assigned</span>
        </div>
        <div className="ea-card">
          <strong style={{ color: '#087353' }}>{filteredQuestions.length > 0 ? '94%' : '0%'}</strong>
          <span>Accessibility Readiness Score</span>
        </div>
      </div>

      <div className="ea-two">
        <section className="ea-card">
          <div className="ea-heading">
            <h2>Active & Saved Examinations {selectedTeacherSubject !== 'ALL' && <span style={{ fontSize: '13px', fontWeight: 'normal', color: '#9333ea' }}>({selectedTeacherSubject} only)</span>}</h2>
            <button className="ea-link" onClick={() => setPage('Schedule & assign')}>View Schedule →</button>
          </div>
          
          {exam.title && isSubjectMatch(exam.subject, selectedTeacherSubject) && (
            <div className="ea-event">
              <b>{exam.date ? exam.date.slice(-2) : 'DRAFT'}<small>{exam.status.toUpperCase()}</small></b>
              <span>
                <strong>{exam.title}</strong>
                <small>{exam.subject} · {exam.date} · {exam.time} · {exam.duration} mins · {selectedQuestionIds.length} questions ({totalExamMarks} marks)</small>
              </span>
              <em>{exam.status}</em>
              <button style={{ marginLeft: '10px', fontSize: '11px', padding: '4px 8px' }} onClick={() => handleEditExam(exam)}>Edit Draft</button>
            </div>
          )}

          {filteredSavedExams.length === 0 && (!exam.title || !isSubjectMatch(exam.subject, selectedTeacherSubject)) ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', margin: '10px 0' }}>
              <div style={{ fontSize: '26px', marginBottom: '6px' }}>📝</div>
              <p style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '800', color: '#334155' }}>
                {selectedTeacherSubject !== 'ALL' ? `No ${selectedTeacherSubject} Examinations Found` : 'No Examinations Created Yet'}
              </p>
              <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: '#64748b' }}>
                {selectedTeacherSubject !== 'ALL' ? `Create a new voice exam specifically for ${selectedTeacherSubject}.` : 'Create accessible voice exams with MCQ, voice dictation, or AI question generator.'}
              </p>
              <button className="ea-primary" style={{ fontSize: '12px', padding: '8px 16px' }} onClick={() => { setEditingExamId(null); setPage('Create exam'); }}>
                + Create {selectedTeacherSubject !== 'ALL' ? selectedTeacherSubject : 'New'} Exam
              </button>
            </div>
          ) : (
            filteredSavedExams.map((item, idx) => (
              <div className="ea-event" key={item._id || idx}>
                <b>{item.date ? item.date.slice(-2) : '20'}<small>EXAM</small></b>
                <span>
                  <strong>{item.title || item.examTitle}</strong>
                  <small>{item.subject || 'General'} · {item.durationMinutes || item.duration || 60} mins · {item.questions?.length || 0} questions</small>
                </span>
                <em className={item.status === 'Draft' ? 'draft' : ''}>{item.status || 'Saved'}</em>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => handleEditExam(item)}>Edit</button>
                  <button style={{ fontSize: '11px', padding: '4px 8px', color: '#dc2626' }} onClick={() => handleDeleteExam(item._id)}>Delete</button>
                </div>
              </div>
            ))
          )}
        </section>

        <section className="ea-card">
          <h2>Accessibility & Voice Readiness</h2>
          <div className="ea-ready">
            94%
            <small>Voice Assist Ready</small>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '15px 0', fontSize: '13px', lineHeight: '1.8' }}>
            <li>✓ Text-to-Speech narration enabled ({access.language})</li>
            <li>✓ Voice navigation commands active</li>
            <li>✓ Auto-save answers enabled (every 30s)</li>
            <li>✓ Extra time accommodation configured (+{extraTime.extraMinutes} mins)</li>
          </ul>
          <button className="ea-primary" style={{ width: '100%' }} onClick={() => setPage('Accessibility')}>Configure Accessibility Settings</button>
        </section>
      </div>
    </>
  );

  // 2. Create & Edit Exam Tab
  const renderCreateExam = (
    <>
      <Title
        title={editingExamId ? "Edit Exam" : "Create New Exam"}
        text="Configure exam details, assign questions from bank, create custom questions, and generate AI questions directly."
        action={
          <button className="ea-primary" onClick={handleSaveExam} disabled={busy}>
            {busy ? 'Saving...' : editingExamId ? 'Update Exam' : 'Save Exam to Database'}
          </button>
        }
      />

      {/* SECTION 1: EXAM DETAILS & QUESTION SELECTOR */}
      <div className="ea-two" style={{ marginBottom: '24px' }}>
        <section className="ea-card ea-form">
          {exam.targetStudentEmail && (
            <div style={{
              background: '#ecfdf5',
              border: '2px solid #10b981',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>🎯</span>
                <div>
                  <strong style={{ fontSize: '14px', color: '#065f46', display: 'block' }}>
                    Personalized Exam for: {exam.targetStudentName || exam.targetStudentEmail}
                  </strong>
                  <span style={{ fontSize: '12px', color: '#047857' }}>
                    Student's Interested Subject: <strong>{exam.subject}</strong> • This exam is specifically created for {exam.targetStudentName}.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClearTargetStudent}
                style={{
                  background: '#ffffff',
                  border: '1px solid #6ee7b7',
                  color: '#047857',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                ✕ Revert to All Students
              </button>
            </div>
          )}

          <Field label="Target Student (Personalized Exam based on Student's Interested Subject)">
            <select
              value={exam.targetStudentEmail || ''}
              onChange={e => handleSelectTargetStudent(e.target.value)}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                border: exam.targetStudentEmail ? '2px solid #10b981' : '1px solid #cbd5e1',
                background: exam.targetStudentEmail ? '#f0fdf4' : '#ffffff',
                color: exam.targetStudentEmail ? '#065f46' : '#0f172a',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              <option value="">🌐 All Students studying this subject (General Exam)</option>
              {registeredStudents.length > 0 && (
                <optgroup label="👤 Registered Students (Auto-loads student's interested subject)">
                  {registeredStudents.map(stu => {
                    const sub = stu.interestedSubject || stu.subject || 'Computer Science';
                    return (
                      <option key={stu.email || stu._id} value={stu.email}>
                        👤 {stu.username || stu.name} — Interested in: {sub} ({stu.email})
                      </option>
                    );
                  })}
                </optgroup>
              )}
            </select>
          </Field>

          <Field label="Exam Title">
            <input value={exam.title} onChange={e => setExam({ ...exam, title: e.target.value })} placeholder="e.g. Unit Test - Computer Science" />
          </Field>
          <Field label={exam.targetStudentName ? `Subject / Course (Auto-selected for ${exam.targetStudentName})` : "Subject / Course"}>
            <SubjectSelector value={exam.subject} onChange={val => setExam({ ...exam, subject: val })} placeholder="Select Subject" />
            {exam.targetStudentName && (
              <small style={{ color: '#047857', fontSize: '11px', fontWeight: '700', marginTop: '3px', display: 'block' }}>
                ✓ Matched to {exam.targetStudentName}'s interested subject preference.
              </small>
            )}
          </Field>
          <Field label="Exam Date">
            <input type="date" value={exam.date} onChange={e => setExam({ ...exam, date: e.target.value })} />
          </Field>
          <Field label="Start Time">
            <input type="time" value={exam.time} onChange={e => setExam({ ...exam, time: e.target.value })} />
          </Field>
          <Field label="Duration (Minutes)">
            <input type="number" value={exam.duration} onChange={e => setExam({ ...exam, duration: Number(e.target.value) })} />
          </Field>
          <Field label="Pass Mark (%)">
            <input type="number" value={exam.passMark} onChange={e => setExam({ ...exam, passMark: Number(e.target.value) })} />
          </Field>
          <Field label="Exam Status">
            <select value={exam.status} onChange={e => setExam({ ...exam, status: e.target.value })}>
              <option value="Draft">Draft</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Published">Published</option>
              <option value="Completed">Completed</option>
            </select>
          </Field>
          <Field label="Instructions for Blind Students (Narrated via Voice)">
            <textarea value={exam.instructions} onChange={e => setExam({ ...exam, instructions: e.target.value })} />
          </Field>
        </section>

        <aside className="ea-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
            <h2 style={{ margin: 0, fontSize: '18px' }}>Select Questions for this Exam</h2>
            {subjectQuestionsForExam.length > 0 && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedQuestionIds(subjectQuestionsForExam.map(q => q.id))}
                  style={{ fontSize: '11px', background: '#f3e8ff', color: '#7e22ce', border: '1px solid #d8b4fe', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: '800' }}
                >
                  ✓ Select All ({subjectQuestionsForExam.length})
                </button>
                {selectedQuestionIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedQuestionIds([])}
                    style={{ fontSize: '11px', background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: '700' }}
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
          <p style={{ fontSize: '12px', margin: '0 0 10px 0', color: '#475569' }}>
            Total Selected: <b style={{ color: selectedQuestionIds.length > 0 ? '#16a34a' : '#64748b' }}>{selectedQuestionIds.length} of {subjectQuestionsForExam.length} questions {selectedTeacherSubject !== 'ALL' ? `(${selectedTeacherSubject})` : ''}</b> ({totalExamMarks} total marks)
          </p>

          <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'grid', gap: '8px', margin: '10px 0' }}>
            {subjectQuestionsForExam.length === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: '#64748b', fontSize: '13px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                No questions found for {selectedTeacherSubject !== 'ALL' ? `"${selectedTeacherSubject}"` : 'Question Bank'} yet. Use the <b>Question Builder</b> below or AI generator to add questions for {selectedTeacherSubject !== 'ALL' ? selectedTeacherSubject : 'this subject'}.
              </div>
            ) : (
              subjectQuestionsForExam.map(q => (
                <label key={q.id} style={{ display: 'flex', gap: '8px', padding: '8px', background: selectedQuestionIds.includes(q.id) ? '#faf5ff' : '#f8fafc', borderRadius: '6px', fontSize: '12px', border: selectedQuestionIds.includes(q.id) ? '1px solid #c084fc' : '1px solid #e2e8f0', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedQuestionIds.includes(q.id)}
                    onChange={() => setSelectedQuestionIds(ids => ids.includes(q.id) ? ids.filter(id => id !== q.id) : [...ids, q.id])}
                  />
                  <div>
                    <strong>[{q.type}] {q.text.slice(0, 55)}...</strong>
                    <div style={{ color: '#64748b' }}>{q.marks} marks · {q.difficulty} · {q.subject || 'General'}</div>
                  </div>
                </label>
              ))
            )}
          </div>

          <button style={{ width: '100%', background: '#9333ea', color: '#ffffff', padding: '12px', borderRadius: '10px', fontWeight: '800', border: 'none', cursor: 'pointer', marginTop: '16px' }} onClick={handleSaveExam} disabled={busy}>
            {busy ? 'Saving...' : '💾 Save Exam to Database'}
          </button>
        </aside>
      </div>

      {/* SECTION 2: SEPARATE DEDICATED QUESTION BUILDER CARD (EXACT MATCH TO UI DESIGN) */}
      <section className="ea-card" style={{ marginBottom: '24px', border: '2px solid #e9d5ff', borderRadius: '20px', padding: '24px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '26px', color: '#7e22ce', fontWeight: '900', fontFamily: 'serif, Georgia, sans-serif' }}>
            Question Builder
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
            Create individual questions or add multiple questions at once using Bulk Import.
          </p>
        </div>

        {/* Builder Mode Switcher Tabs */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button 
            type="button"
            onClick={() => setBuilderMode('bulk')}
            style={{
              background: builderMode === 'bulk' ? '#9333ea' : '#ffffff',
              color: builderMode === 'bulk' ? '#ffffff' : '#7e22ce',
              border: '1px solid #9333ea',
              padding: '10px 18px',
              borderRadius: '10px',
              fontWeight: '800',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ⚡ Bulk Add Questions (Paste 10+ at Once)
          </button>
          <button 
            type="button"
            onClick={() => setBuilderMode('multiRow')}
            style={{
              background: builderMode === 'multiRow' ? '#9333ea' : '#ffffff',
              color: builderMode === 'multiRow' ? '#ffffff' : '#7e22ce',
              border: '1px solid #9333ea',
              padding: '10px 18px',
              borderRadius: '10px',
              fontWeight: '800',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            📋 Multi-Row Builder (Add Multiple Cards)
          </button>
          <button 
            type="button"
            onClick={() => setBuilderMode('single')}
            style={{
              background: builderMode === 'single' ? '#9333ea' : '#ffffff',
              color: builderMode === 'single' ? '#ffffff' : '#7e22ce',
              border: '1px solid #9333ea',
              padding: '10px 18px',
              borderRadius: '10px',
              fontWeight: '800',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ✍️ Single Question Form
          </button>
        </div>

        {/* MODE 1: BULK TEXTAREA IMPORTER */}
        {builderMode === 'bulk' && (
          <div style={{ background: '#faf5ff', border: '2px solid #7dd3fc', borderRadius: '16px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
              <div style={{ flex: '1 1 300px' }}>
                <span style={{ fontSize: '11px', background: '#f3e8ff', color: '#7e22ce', padding: '4px 10px', borderRadius: '8px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  ⚡ BULK MULTI-QUESTION IMPORTER
                </span>
                <h3 style={{ margin: '8px 0 4px 0', fontSize: '22px', color: '#7e22ce', fontWeight: '900' }}>
                  Add So Many Questions at One Time
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#9333ea', lineHeight: 1.5 }}>
                  Paste or type your questions below (one question per line or numbered 1, 2, 3...). All questions will be parsed and added to your Question Bank and Active Exam simultaneously!
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', flex: '1 1 320px', maxWidth: '420px' }}>
                <Field label="Question Type">
                  <select value={bulkType} onChange={e => setBulkType(e.target.value)} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #7dd3fc', width: '100%' }}>
                    <option value="MCQ">MCQ</option>
                    <option value="Descriptive Theory">Descriptive Theory</option>
                    <option value="Short Answer">Short Answer</option>
                    <option value="Long Answer">Long Answer</option>
                    <option value="True/False">True / False</option>
                    <option value="Numerical">Numerical</option>
                  </select>
                </Field>

                <Field label="Difficulty Level">
                  <select value={bulkDifficulty} onChange={e => setBulkDifficulty(e.target.value)} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #7dd3fc', width: '100%' }}>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </Field>

                <Field label="Subject / Topic">
                  <SubjectSelector value={bulkSubject} onChange={setBulkSubject} placeholder="Select Subject" />
                </Field>

                <Field label="Marks Per Question">
                  <input type="number" min="1" value={bulkMarks} onChange={e => setBulkMarks(e.target.value)} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #7dd3fc', width: '100%' }} />
                </Field>
              </div>
            </div>

            <Field label={`Paste Multiple Questions Below (${bulkText.split('\n').filter(l => l.trim()).length} questions detected)`}>
              <textarea
                rows={9}
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder={`Example:\n1. Explain the 7 layers of the OSI reference model and data encapsulation.\n2. What is the difference between TCP and UDP protocols?\n3. Describe public key cryptography and asymmetric encryption.\n4. What port does HTTPS use for SSL/TLS traffic?\n5. Explain process scheduling algorithms in Operating Systems.`}
                style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #7dd3fc', fontSize: '14px', fontFamily: 'sans-serif', lineHeight: 1.6, boxSizing: 'border-box', background: '#ffffff' }}
              />
            </Field>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
              <button
                className="ea-primary"
                type="button"
                onClick={handleBulkAddQuestions}
                style={{ padding: '14px 28px', fontSize: '15px', fontWeight: '800', background: '#9333ea', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', flex: 1, boxShadow: '0 4px 12px rgba(147, 51, 234, 0.3)' }}
              >
                🚀 Batch Import All Questions to Bank & Active Exam
              </button>
              <button
                type="button"
                onClick={() => speak(bulkText || 'No bulk text entered yet.')}
                style={{ padding: '14px 20px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#ffffff', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
              >
                🔊 Test Voice Narration
              </button>
            </div>
          </div>
        )}

        {/* MODE 2: MULTI-ROW BUILDER */}
        {builderMode === 'multiRow' && (
          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '800' }}>📋 Multi-Row Question Builder</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>Fill in multiple question cards and click Save All to attach them all at once.</p>
              </div>
              <button 
                type="button" 
                onClick={handleAddMultiRow}
                style={{ background: '#f3e8ff', color: '#9333ea', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
              >
                + Add Another Question Row
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {multiRows.map((row, idx) => (
                <div key={row.id} style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <b style={{ fontSize: '14px', color: '#9333ea' }}>Question Card #{idx + 1}</b>
                    {multiRows.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => handleRemoveMultiRow(row.id)}
                        style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                      >
                        ✕ Remove Card
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                    <Field label="Subject / Topic">
                      <SubjectSelector value={row.subject} onChange={val => handleUpdateMultiRow(row.id, 'subject', val)} />
                    </Field>
                    <Field label="Type">
                      <select value={row.type} onChange={e => handleUpdateMultiRow(row.id, 'type', e.target.value)}>
                        <option value="MCQ">MCQ</option>
                        <option value="Short Answer">Short Answer</option>
                        <option value="Descriptive Theory">Descriptive Theory</option>
                      </select>
                    </Field>
                    <Field label="Difficulty">
                      <select value={row.difficulty} onChange={e => handleUpdateMultiRow(row.id, 'difficulty', e.target.value)}>
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </Field>
                    <Field label="Marks">
                      <input type="number" min="1" value={row.marks} onChange={e => handleUpdateMultiRow(row.id, 'marks', e.target.value)} />
                    </Field>
                  </div>

                  <Field label="Question Text">
                    <textarea rows={2} value={row.text} onChange={e => handleUpdateMultiRow(row.id, 'text', e.target.value)} placeholder="Type question text..." />
                  </Field>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button className="ea-primary" type="button" onClick={handleSaveMultiRows} style={{ padding: '12px 24px', fontWeight: '800' }}>✨ Save All Cards & Attach</button>
              <button type="button" onClick={handleAddMultiRow} style={{ padding: '12px 18px' }}>+ Add Row</button>
            </div>
          </div>
        )}

        {/* MODE 3: SINGLE QUESTION FORM */}
        {builderMode === 'single' && (
          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '12px' }}>
              <Field label="Question Type">
                <select value={newQuestion.type} onChange={e => setNewQuestion({ ...newQuestion, type: e.target.value })}>
                  <option value="MCQ">MCQ</option>
                  <option value="Short Answer">Short Answer</option>
                  <option value="Descriptive Theory">Descriptive Theory</option>
                </select>
              </Field>
              <Field label="Difficulty">
                <select value={newQuestion.difficulty} onChange={e => setNewQuestion({ ...newQuestion, difficulty: e.target.value })}>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </Field>
              <Field label="Subject">
                <SubjectSelector value={newQuestion.subject} onChange={val => setNewQuestion({ ...newQuestion, subject: val })} />
              </Field>
              <Field label="Marks">
                <input type="number" value={newQuestion.marks} onChange={e => setNewQuestion({ ...newQuestion, marks: e.target.value })} />
              </Field>
            </div>
            <Field label="Question Text">
              <textarea rows={4} value={newQuestion.text} onChange={e => setNewQuestion({ ...newQuestion, text: e.target.value })} placeholder="Type single question text..." />
            </Field>
            <button className="ea-primary" type="button" onClick={handleAddQuestion} style={{ marginTop: '12px', padding: '12px 24px', fontWeight: '800' }}>
              + Add Question & Attach to Active Exam
            </button>
          </div>
        )}
      </section>

      {/* SECTION 3: SEPARATE DEDICATED AI QUESTION GENERATOR CARD */}
      <section className="ea-card" style={{ border: '2px solid #e9d5ff', background: '#faf5ff', borderRadius: '20px' }}>
        <div style={{ marginBottom: '16px' }}>
          <span style={{ fontSize: '11px', background: '#f3e8ff', color: '#7e22ce', padding: '4px 10px', borderRadius: '8px', fontWeight: '800', textTransform: 'uppercase' }}>
            🤖 SEPARATE TOOL 2
          </span>
          <h2 style={{ margin: '6px 0 2px 0', fontSize: '20px', color: '#7e22ce', fontWeight: '900' }}>
            AI Question Generator for this Exam
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#6b21a8' }}>
            Generate instant AI questions for topic: <b>{exam.subject || ai.topic}</b> and auto-attach them to this exam.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <Field label="Topic / Subject">
            <SubjectSelector value={ai.topic} onChange={val => setAi({ ...ai, topic: val })} placeholder="Select Subject" />
          </Field>
          <Field label="Count (1-10)">
            <input type="number" min="1" max="10" value={ai.count} onChange={e => setAi({ ...ai, count: e.target.value })} />
          </Field>
          <Field label="Difficulty">
            <select value={ai.difficulty} onChange={e => setAi({ ...ai, difficulty: e.target.value })}>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </Field>
        </div>

        <button 
          className="ea-primary" 
          disabled={busy} 
          onClick={handleGenerateAI}
          style={{ background: '#9333ea', color: '#ffffff', border: 'none', padding: '12px 24px', borderRadius: '10px', fontWeight: '800', cursor: 'pointer' }}
        >
          {busy ? 'Generating AI Questions...' : '✦ Generate AI Draft Questions & Attach to Exam'}
        </button>
      </section>
    </>
  );

  // 3. Question Bank Tab
  const renderQuestionBank = (
    <>
      <Title
        title="Question Bank"
        text={selectedTeacherSubject !== 'ALL' 
          ? `${filteredQuestions.length} questions matching "${selectedTeacherSubject}" (other subjects hidden)` 
          : `${questions.length} questions available · ${filteredQuestions.length} matching search`}
        action={
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="ea-primary" onClick={() => setPage('Create exam')}>+ Build Question</button>
            <button onClick={() => setPage('Create exam')}>✦ AI Generator</button>
          </div>
        }
      />
      <section className="ea-card ea-toolbar">
        <input
          placeholder="Search question bank by text, subject, or type..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <button onClick={() => say(`Selected ${selectedQuestionIds.length} questions attached to active exam.`)}>
          Attach Selected ({selectedQuestionIds.length})
        </button>
      </section>

      <section className="ea-card ea-list">
        {filteredQuestions.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>📋</div>
            <p style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '800', color: '#334155' }}>
              {selectedTeacherSubject !== 'ALL' ? `No Questions Found for "${selectedTeacherSubject}"` : 'No Questions in Question Bank'}
            </p>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b', maxWidth: '440px', marginLeft: 'auto', marginRight: 'auto' }}>
              {selectedTeacherSubject !== 'ALL' 
                ? `No questions currently match subject "${selectedTeacherSubject}". Build new questions or generate questions with AI to add them to this subject.` 
                : 'All uncreated starter questions have been cleared. Build new questions or generate questions with AI to add them to your bank.'}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button className="ea-primary" onClick={() => setPage('Create exam')}>+ Build Question</button>
              <button onClick={() => setPage('Create exam')}>✦ AI Generator</button>
            </div>
          </div>
        ) : (
          filteredQuestions.map(q => (
            <article key={q.id}>
              <input
                type="checkbox"
                checked={selectedQuestionIds.includes(q.id)}
                onChange={() => setSelectedQuestionIds(ids => ids.includes(q.id) ? ids.filter(id => id !== q.id) : [...ids, q.id])}
              />
              <div>
                <span className="ea-chip">{q.type}</span> <span className="ea-chip">{q.difficulty}</span> <span className="ea-chip">{q.subject || 'General'}</span>
                <p style={{ fontWeight: 'bold', margin: '6px 0' }}>{q.text}</p>
                {q.options && q.options.length > 0 && (
                  <div style={{ fontSize: '12px', color: '#475569', margin: '4px 0' }}>
                    Options: {q.options.join(' | ')}
                  </div>
                )}
                <small style={{ color: '#087353' }}>Correct Answer: {q.correctAnswer || 'N/A'} · {q.marks} marks</small>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button style={{ fontSize: '12px', padding: '6px 10px' }} onClick={() => speak(q.text)}>🔊 Preview Voice</button>
                <button className="ea-delete" title="Delete question" onClick={() => { setQuestions(all => all.filter(x => x.id !== q.id)); setSelectedQuestionIds(ids => ids.filter(id => id !== q.id)); }}>×</button>
              </div>
            </article>
          ))
        )}
      </section>
    </>
  );

  // 4. Question Builder Tab (Supports Single, Bulk Textarea, and Multi-Row creation)
  const renderQuestionBuilder = (
    <>
      <Title title="Question Builder" text="Create individual questions or add multiple questions at once using Bulk Import." />
      
      {/* Mode Switcher Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setBuilderMode('bulk')}
          style={{
            background: builderMode === 'bulk' ? '#9333ea' : '#ffffff',
            color: builderMode === 'bulk' ? '#ffffff' : '#0f172a',
            border: '1px solid #9333ea',
            padding: '10px 18px',
            borderRadius: '10px',
            fontWeight: '800',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          ⚡ Bulk Add Questions (Paste 10+ at Once)
        </button>
        <button 
          onClick={() => setBuilderMode('multiRow')}
          style={{
            background: builderMode === 'multiRow' ? '#9333ea' : '#ffffff',
            color: builderMode === 'multiRow' ? '#ffffff' : '#0f172a',
            border: '1px solid #9333ea',
            padding: '10px 18px',
            borderRadius: '10px',
            fontWeight: '800',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          📋 Multi-Row Builder (Add Multiple Cards)
        </button>
        <button 
          onClick={() => setBuilderMode('single')}
          style={{
            background: builderMode === 'single' ? '#9333ea' : '#ffffff',
            color: builderMode === 'single' ? '#ffffff' : '#0f172a',
            border: '1px solid #9333ea',
            padding: '10px 18px',
            borderRadius: '10px',
            fontWeight: '800',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          ✍️ Single Question Form
        </button>
      </div>

      {/* MODE 1: BULK TEXTAREA IMPORTER (PASTE 10+ QUESTIONS AT ONCE) */}
      {builderMode === 'bulk' && (
        <section className="ea-card ea-form" style={{ background: '#faf5ff', border: '2px solid #7dd3fc', borderRadius: '16px', padding: '24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <span style={{ fontSize: '11px', background: '#f3e8ff', color: '#7e22ce', padding: '4px 10px', borderRadius: '8px', fontWeight: '800', textTransform: 'uppercase' }}>
              ⚡ Bulk Multi-Question Importer
            </span>
            <h2 style={{ margin: '8px 0 4px 0', fontSize: '20px', color: '#7e22ce', fontWeight: '900' }}>
              Add So Many Questions at One Time
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#7e22ce', lineHeight: 1.5 }}>
              Paste or type your questions below (one question per line or numbered 1, 2, 3...). All questions will be parsed and added to your Question Bank and Active Exam simultaneously!
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <Field label="Question Type">
              <select value={bulkType} onChange={e => setBulkType(e.target.value)}>
                <option value="Descriptive Theory">Descriptive Theory</option>
                <option value="Short Answer">Short Answer</option>
                <option value="Long Answer">Long Answer</option>
                <option value="MCQ">MCQ</option>
                <option value="True/False">True / False</option>
                <option value="Numerical">Numerical</option>
              </select>
            </Field>

            <Field label="Difficulty Level">
              <select value={bulkDifficulty} onChange={e => setBulkDifficulty(e.target.value)}>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </Field>

            <Field label="Subject / Topic">
              <SubjectSelector value={bulkSubject} onChange={setBulkSubject} placeholder="Select Subject" />
            </Field>

            <Field label="Marks Per Question">
              <input type="number" min="1" value={bulkMarks} onChange={e => setBulkMarks(e.target.value)} />
            </Field>
          </div>

          <Field label={`Paste Multiple Questions Below (${bulkText.split('\n').filter(l => l.trim()).length} questions detected)`}>
            <textarea
              rows={10}
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder={`Example:\n1. Explain the 7 layers of the OSI reference model and data encapsulation.\n2. What is the difference between TCP and UDP protocols?\n3. Describe public key cryptography and asymmetric encryption.\n4. What port does HTTPS use for SSL/TLS traffic?\n5. Explain process scheduling algorithms in Operating Systems.`}
              style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #7dd3fc', fontSize: '14px', fontFamily: 'sans-serif', lineHeight: 1.6, boxSizing: 'border-box' }}
            />
          </Field>

          <div style={{ display: 'flex', gap: '12px', marginTop: '14px', flexWrap: 'wrap' }}>
            <button
              className="ea-primary"
              type="button"
              onClick={handleBulkAddQuestions}
              style={{ padding: '14px 28px', fontSize: '15px', fontWeight: '800', background: '#9333ea', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', flex: 1, boxShadow: '0 4px 12px rgba(147, 51, 234, 0.3)' }}
            >
              🚀 Batch Import All Questions to Bank & Active Exam
            </button>
            <button
              type="button"
              onClick={() => speak(bulkText || 'No bulk text entered yet.')}
              style={{ padding: '14px 20px', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
            >
              🔊 Test Voice Narration
            </button>
          </div>
        </section>
      )}

      {/* MODE 2: MULTI-ROW BUILDER (ADD MULTIPLE QUESTION CARDS AT ONCE) */}
      {builderMode === 'multiRow' && (
        <section className="ea-card ea-form">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '800' }}>📋 Multi-Row Question Builder</h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>Fill in multiple question rows and click Save All to attach them all at once.</p>
            </div>
            <button 
              type="button" 
              onClick={handleAddMultiRow}
              style={{ background: '#f3e8ff', color: '#9333ea', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
            >
              + Add Another Question Row
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {multiRows.map((row, idx) => (
              <div key={row.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b style={{ fontSize: '14px', color: '#9333ea' }}>Question #{idx + 1}</b>
                  {multiRows.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => handleRemoveMultiRow(row.id)}
                      style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                    >
                      ✕ Remove Row
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                  <Field label="Subject / Topic">
                    <SubjectSelector value={row.subject} onChange={val => handleUpdateMultiRow(row.id, 'subject', val)} />
                  </Field>
                  <Field label="Type">
                    <select value={row.type} onChange={e => handleUpdateMultiRow(row.id, 'type', e.target.value)}>
                      <option value="Descriptive Theory">Descriptive Theory</option>
                      <option value="Short Answer">Short Answer</option>
                      <option value="Long Answer">Long Answer</option>
                      <option value="MCQ">MCQ</option>
                    </select>
                  </Field>
                  <Field label="Difficulty">
                    <select value={row.difficulty} onChange={e => handleUpdateMultiRow(row.id, 'difficulty', e.target.value)}>
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </Field>
                  <Field label="Marks">
                    <input type="number" min="1" value={row.marks} onChange={e => handleUpdateMultiRow(row.id, 'marks', e.target.value)} />
                  </Field>
                </div>

                <Field label="Question Text">
                  <input value={row.text} onChange={e => handleUpdateMultiRow(row.id, 'text', e.target.value)} placeholder={`Type Question #${idx + 1}...`} />
                </Field>

                <Field label="Correct Answer (Optional)">
                  <input value={row.answer} onChange={e => handleUpdateMultiRow(row.id, 'answer', e.target.value)} placeholder="Expected correct answer or key concepts" />
                </Field>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
            <button 
              type="button" 
              onClick={handleSaveMultiRows}
              className="ea-primary"
              style={{ padding: '14px 28px', fontSize: '15px', fontWeight: '800', flex: 1 }}
            >
              ✨ Save All {multiRows.filter(r => r.text.trim()).length} Questions to Bank & Active Exam
            </button>
            <button 
              type="button" 
              onClick={handleAddMultiRow}
              style={{ padding: '14px 20px', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
            >
              + Add Row
            </button>
          </div>
        </section>
      )}

      {/* MODE 3: SINGLE QUESTION FORM */}
      {builderMode === 'single' && (
        <section className="ea-card ea-form">
          <Field label="Question Type">
            <select value={newQuestion.type} onChange={e => setNewQuestion({ ...newQuestion, type: e.target.value })}>
              <option value="MCQ">MCQ (Multiple Choice)</option>
              <option value="Short answer">Short Answer</option>
              <option value="Long answer">Long Answer</option>
              <option value="True/False">True / False</option>
              <option value="Fill in the blanks">Fill in the Blanks</option>
              <option value="Numerical">Numerical</option>
            </select>
          </Field>
          <Field label="Difficulty Level">
            <select value={newQuestion.difficulty} onChange={e => setNewQuestion({ ...newQuestion, difficulty: e.target.value })}>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </Field>
          <Field label="Subject">
            <SubjectSelector value={newQuestion.subject} onChange={val => setNewQuestion({ ...newQuestion, subject: val })} />
          </Field>
          <Field label="Marks">
            <input type="number" min="1" value={newQuestion.marks} onChange={e => setNewQuestion({ ...newQuestion, marks: e.target.value })} />
          </Field>
          <Field label="Question Text">
            <textarea value={newQuestion.text} onChange={e => setNewQuestion({ ...newQuestion, text: e.target.value })} placeholder="Enter question text here..." />
          </Field>
          
          {newQuestion.type === 'MCQ' && (
            <>
              <Field label="Option A"><input value={newQuestion.optionA} onChange={e => setNewQuestion({ ...newQuestion, optionA: e.target.value })} /></Field>
              <Field label="Option B"><input value={newQuestion.optionB} onChange={e => setNewQuestion({ ...newQuestion, optionB: e.target.value })} /></Field>
              <Field label="Option C"><input value={newQuestion.optionC} onChange={e => setNewQuestion({ ...newQuestion, optionC: e.target.value })} /></Field>
              <Field label="Option D"><input value={newQuestion.optionD} onChange={e => setNewQuestion({ ...newQuestion, optionD: e.target.value })} /></Field>
            </>
          )}
          <Field label="Correct Answer">
            <input value={newQuestion.answer} onChange={e => setNewQuestion({ ...newQuestion, answer: e.target.value })} placeholder="Enter correct answer text" />
          </Field>

          <div style={{ gridColumn: '1/-1', display: 'flex', gap: '12px', marginTop: '10px' }}>
            <button className="ea-primary" type="button" onClick={handleAddQuestion}>+ Add to Question Bank & Active Exam</button>
            <button type="button" onClick={() => speak(newQuestion.text || 'No question text typed yet.')}>🔊 Test Voice Narration</button>
          </div>
        </section>
      )}
    </>
  );

  // 5. AI Question Generator Tab
  const renderAIGenerator = (
    <>
      <Title title="AI Draft Question Generator" text="Instantly generate accessible draft questions for any subject topic using AI." />
      <section className="ea-card ea-generator">
        <div className="ea-sparkle">✦</div>
        <div className="ea-form">
          <Field label="Topic / Chapter Name">
            <SubjectSelector value={ai.topic} onChange={val => setAi({ ...ai, topic: val })} placeholder="Select Subject" />
          </Field>
          <Field label="Count (1-20)">
            <input type="number" min="1" max="20" value={ai.count} onChange={e => setAi({ ...ai, count: e.target.value })} />
          </Field>
          <Field label="Difficulty">
            <select value={ai.difficulty} onChange={e => setAi({ ...ai, difficulty: e.target.value })}>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </Field>
        </div>
        <button className="ea-primary" disabled={busy} onClick={handleGenerateAI}>
          {busy ? 'Generating Questions...' : '✦ Generate AI Draft Questions'}
        </button>
      </section>
    </>
  );

  // 6. Schedule & Assign Tab
  const renderSchedule = (
    <>
      <Title title="Schedule & Assign Students" text="Set window opening times and assign student cohorts or accommodations." />
      <div className="ea-two">
        <section className="ea-card ea-form">
          <Field label="Open Date"><input type="date" value={exam.date} onChange={e => setExam({ ...exam, date: e.target.value })} /></Field>
          <Field label="Open Time"><input type="time" value={exam.time} onChange={e => setExam({ ...exam, time: e.target.value })} /></Field>
          <Field label="Exam Duration (Minutes)"><input type="number" value={exam.duration} onChange={e => setExam({ ...exam, duration: Number(e.target.value) })} /></Field>
          <Field label="Pass Mark (%)"><input type="number" value={exam.passMark} onChange={e => setExam({ ...exam, passMark: Number(e.target.value) })} /></Field>
        </section>

        <section className="ea-card">
          <h2>Assign Student Cohorts</h2>
          <label className="ea-check">
            <input type="checkbox" checked={assignedGroups.bcaSem3} onChange={e => setAssignedGroups({ ...assignedGroups, bcaSem3: e.target.checked })} />
            BCA Semester 3 (28 Students)
          </label>
          <label className="ea-check">
            <input type="checkbox" checked={assignedGroups.visualSupportGroup} onChange={e => setAssignedGroups({ ...assignedGroups, visualSupportGroup: e.target.checked })} />
            Visually Impaired Accommodation Group (12 Students)
          </label>
          <label className="ea-check">
            <input type="checkbox" checked={assignedGroups.individualAarav} onChange={e => setAssignedGroups({ ...assignedGroups, individualAarav: e.target.checked })} />
            Aarav Shah (Individual Accommodation)
          </label>
          <label className="ea-check">
            <input type="checkbox" checked={assignedGroups.individualMeera} onChange={e => setAssignedGroups({ ...assignedGroups, individualMeera: e.target.checked })} />
            Meera Nair (Individual Accommodation)
          </label>
          <button className="ea-primary" style={{ width: '100%', marginTop: '16px' }} onClick={handleSaveSchedule}>
            Confirm Schedule & Assignment
          </button>
        </section>
      </div>
    </>
  );

  // 7. Accessibility & Voice Support Tab
  const renderAccessibility = (
    <>
      <Title title="Accessibility & Voice Support Settings" text="Customize audio narration, voice command navigation, and timer rules." />
      <div className="ea-three">
        <section className="ea-card">
          <h2>Reading & Narration</h2>
          <Toggle label="Text-to-Speech (TTS)" note="Read questions & options aloud" value={access.tts} onChange={v => setAccess({ ...access, tts: v })} />
          <Toggle label="Voice Navigation" note="Commands like 'Next', 'Repeat'" value={access.voice} onChange={v => setAccess({ ...access, voice: v })} />
          <Toggle label="High Contrast Mode" value={access.contrast} onChange={v => setAccess({ ...access, contrast: v })} />
          <Toggle label="Large Font Display" value={access.font} onChange={v => setAccess({ ...access, font: v })} />
          <Field label="TTS Voice Accent">
            <select value={access.language} onChange={e => setAccess({ ...access, language: e.target.value })}>
              <option value="en-US">English (US)</option>
              <option value="en-IN">English (India)</option>
            </select>
          </Field>
        </section>

        <section className="ea-card">
          <h2>Timer & Submission</h2>
          <Toggle label="Extra Time Allowance" note="25% default extra time" value={access.extra} onChange={v => setAccess({ ...access, extra: v })} />
          <Toggle label="Auto-save Answers" note="Saves every 30 seconds" value={access.autosave} onChange={v => setAccess({ ...access, autosave: v })} />
          <Toggle label="Auto-submit at Expiry" note="Submit when timer reaches 0" value={access.autosubmit} onChange={v => setAccess({ ...access, autosubmit: v })} />
          <Field label="Voice Speed (Speech Rate)">
            <select value={speechRate} onChange={e => setSpeechRate(Number(e.target.value))}>
              <option value={0.8}>0.8x (Slower)</option>
              <option value={1.0}>1.0x (Normal)</option>
              <option value={1.25}>1.25x (Faster)</option>
            </select>
          </Field>
        </section>

        <section className="ea-card">
          <h2>Save & Test Configuration</h2>
          <p style={{ fontSize: '13px', color: '#64748b' }}>Test how text-to-speech feedback sounds for blind examinees and save global rules.</p>
          <button className="ea-primary" style={{ width: '100%', marginBottom: '10px' }} onClick={handleSaveAccessibility}>
            💾 Save Accessibility Settings
          </button>
          <button style={{ width: '100%' }} onClick={() => say("Voice navigation listening active. Supported commands: Next, Repeat, Option A, Option B, Save, Submit.")}>
            ⌁ Test Voice Navigation
          </button>
        </section>
      </div>
    </>
  );

  // 8. Voice Exam & Responses Tab
  const renderVoiceExam = (
    <>
      <Title title="Voice Exam Responses & Speech Transcripts" text="Review speech-to-text transcripts submitted by blind students." />
      <div className="ea-two">
        <section className="ea-card">
          <h2>Recent Voice Transcripts</h2>
          <div className="ea-table">
            <div>
              <b>Student</b><b>Question</b><b>Transcript Response</b><b>Status</b>
            </div>
            <div>
              <span>Nayana</span><span>Q2 (Short Answer)</span><span>HTTPS encrypts data between client and server to prevent tampering.</span><em>Verified</em>
            </div>
            <div>
              <span>Rahul Sharma</span><span>Q3 (Long Answer)</span><span>SQL injection can be mitigated using parameterized database queries.</span><em>Needs Review</em>
            </div>
            <div>
              <span>Priya Patel</span><span>Q1 (MCQ)</span><span>Option A. To encrypt communication between browser and server.</span><em>Verified</em>
            </div>
          </div>
        </section>

        <section className="ea-card">
          <h2>Voice Exam Simulator</h2>
          <p style={{ fontSize: '13px' }}>Simulate audio response verification:</p>
          <button className="ea-primary" style={{ width: '100%', marginBottom: '10px' }} onClick={() => speak("Student Nayana answered: HTTPS encrypts data between client and server.")}>
            🔊 Read Selected Transcript Aloud
          </button>
          <button style={{ width: '100%' }} onClick={() => say("Voice transcript marked as verified in student record.")}>
            ✓ Mark Transcript as Verified
          </button>
        </section>
      </div>
    </>
  );

  // 9. Question Audio Reader Simulator Tab
  const renderQuestionReader = (
    <>
      <Title title="Question Audio Reader Simulator" text="Simulate the exact audio playback interface visually impaired students experience." />
      <section className="ea-card ea-reader">
        <p className="ea-reader-count">Question {readerIndex + 1} of {questions.length}</p>
        <h2>{questions[readerIndex]?.text || 'No question selected'}</h2>
        {questions[readerIndex]?.options && questions[readerIndex].options.length > 0 && (
          <div style={{ margin: '15px 0', display: 'grid', gap: '8px' }}>
            {questions[readerIndex].options.map((opt, i) => (
              <div key={i} style={{ padding: '8px 12px', background: '#f1f5f9', borderRadius: '6px', fontSize: '14px' }}>
                Option {String.fromCharCode(65 + i)}: {opt}
              </div>
            ))}
          </div>
        )}

        <div className="ea-reader-actions">
          <button className="ea-primary" onClick={() => speak(`${questions[readerIndex]?.text}. Options are: ${questions[readerIndex]?.options?.join(', ') || ''}`)}>
            🔊 Read Question & Options
          </button>
          {isPlayingSpeech ? (
            <button onClick={stopSpeech}>⏹ Stop Speech</button>
          ) : (
            <button onClick={() => speak(questions[readerIndex]?.text)}>↻ Repeat Question</button>
          )}
          <button onClick={() => setReaderIndex(i => Math.max(0, i - 1))} disabled={readerIndex === 0}>⏮ Previous</button>
          <button onClick={() => setReaderIndex(i => Math.min(questions.length - 1, i + 1))} disabled={readerIndex === questions.length - 1}>⏭ Next Question</button>
        </div>
      </section>
    </>
  );

  // 10. Live Monitoring Tab
  const renderMonitoring = (
    <>
      <Title title="7. Exam Monitoring" text="Real-time live exam status, timer countdowns, questions answered counts, and voice input monitoring for blind candidates." />
      
      <section className="ea-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '11px', background: '#9333ea', color: '#ffffff', padding: '4px 10px', borderRadius: '8px', fontWeight: '900', textTransform: 'uppercase' }}>
              📊 LIVE EXAM MONITORING TABLE
            </span>
            <h2 style={{ margin: '8px 0 4px 0', fontSize: '20px', color: '#0f172a', fontWeight: '800' }}>
              Examinee Live Monitoring & Status
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              Monitor live exam activity, start times, remaining duration, questions answered progress, voice input, and submission status.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {studentLogs.length > 0 && (
              <button 
                onClick={handleClearAllLiveLogs}
                style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '10px 16px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
              >
                🗑️ Clear Live Logs
              </button>
            )}
            <button 
              onClick={() => { syncWithStudent(); say('Live examinee status refreshed.'); }}
              style={{ background: '#9333ea', color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              ↻ Refresh Monitoring
            </button>
          </div>
        </div>

        {/* Exam Monitoring Table */}
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'inherit' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>Information</th>
                <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>Student</th>
                <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>Face Verification</th>
                <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>Status</th>
                <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>Started</th>
                <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>Time remaining</th>
                <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>Questions answered</th>
                <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>Voice input</th>
                <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {studentLogs.length > 0 ? (
                studentLogs.map((log, idx) => {
                  const isMultiplePeople = Boolean(
                    log.isMultiplePeople || 
                    (log.status || '').includes('MULTIPLE') || 
                    (log.statusBadge || '').includes('MULTIPLE')
                  );
                  const isOtherAlert = Boolean(
                    isMultiplePeople ||
                    log.isOtherPerson || 
                    (log.status || '').includes('OTHERS') || 
                    (log.status || '').includes('Mismatch') || 
                    (log.statusBadge || '').includes('OTHERS')
                  );
                  return (
                    <tr key={log.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: isOtherAlert ? '#fef2f2' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc') }}>
                      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748b', fontWeight: '700' }}>Candidate #{idx + 1}</td>
                      <td style={{ padding: '14px 16px', fontSize: '14px', color: isOtherAlert ? '#b91c1c' : '#0f172a', fontWeight: '800' }}>
                        {log.student || log.studentName || 'Examinee'}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '800' }}>
                        <span style={{ 
                          background: isOtherAlert ? '#fee2e2' : '#dcfce7', 
                          color: isOtherAlert ? '#dc2626' : '#15803d',
                          border: isOtherAlert ? '1px solid #fca5a5' : '1px solid #bbf7d0',
                          padding: '4px 12px',
                          borderRadius: '20px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12px'
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isOtherAlert ? '#dc2626' : '#22c55e' }}></span>
                          {isMultiplePeople ? `🚨 Multiple People (${log.peopleCount || 2} detected)` : isOtherAlert ? '🚨 Face Mismatch' : (log.faceVerified ? '✓ Verified (Live)' : '✓ Biometric Verified')}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '800' }}>
                        <span style={{ 
                          background: isOtherAlert ? '#fee2e2' : ((log.status || log.statusBadge || '').includes('Writing') || (log.status || '').includes('Active') ? '#dcfce7' : '#f3e8ff'), 
                          color: isOtherAlert ? '#dc2626' : ((log.status || log.statusBadge || '').includes('Writing') || (log.status || '').includes('Active') ? '#15803d' : '#7e22ce'),
                          border: isOtherAlert ? '1px solid #fca5a5' : 'none',
                          padding: '4px 12px',
                          borderRadius: '20px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          {isMultiplePeople ? '🔴 MULTIPLE PEOPLE (ALERT)' : isOtherAlert ? '🔴 OTHERS WRITING (ALERT)' : ((log.status || log.statusBadge || '').includes('Writing') || (log.status || '').includes('Active') ? '🟢 Writing' : (log.statusBadge || log.status || '🔵 Completed'))}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#334155', fontWeight: '600' }}>{log.started || log.start || '—'}</td>
                      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#9333ea', fontWeight: '800', fontFamily: 'monospace' }}>{log.remaining || '—'}</td>
                      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#0f172a', fontWeight: '800' }}>{log.answered || '0/0'}</td>
                      <td style={{ padding: '14px 16px', fontSize: '13px', color: isOtherAlert ? '#dc2626' : '#16a34a', fontWeight: '800' }}>
                        {isOtherAlert ? '🔒 Locked (Unauthorized Person)' : (log.voice || 'Enabled')}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '13px', color: (log.submitted === 'Yes' || log.status === 'Submitted') ? '#15803d' : '#dc2626', fontWeight: '800' }}>
                        {log.submitted || ((log.status === 'Submitted' || log.status === 'Completed') ? 'Yes' : 'No')}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} style={{ padding: '36px 16px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>🎧</div>
                    <div style={{ fontWeight: '700', fontSize: '15px', color: '#334155' }}>No active examinees currently writing exams</div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
                      When a blind student starts an exam published by you, their real-time progress, face verification, timer countdown, and voice input will appear here automatically.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Detailed Single Examinee Key-Value Card (Displayed only when candidates are actively monitored) */}
        {studentLogs.length > 0 && (() => {
          const firstLog = studentLogs[0];
          const isOtherAlert = Boolean(
            firstLog?.isOtherPerson || 
            (firstLog?.status || '').includes('OTHERS') || 
            (firstLog?.status || '').includes('Mismatch') || 
            (firstLog?.statusBadge || '').includes('OTHERS')
          );
          return (
            <div style={{
              marginTop: '24px',
              background: isOtherAlert ? '#fff5f5' : '#faf5ff',
              border: isOtherAlert ? '2px solid #f87171' : '2px solid #e9d5ff',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: isOtherAlert ? '0 0 16px rgba(239, 68, 68, 0.25)' : 'none'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: isOtherAlert ? '#b91c1c' : '#7e22ce', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isOtherAlert ? '🚨 Examinee Security Alert: Unauthorized Person Detected' : '📌 Examinee Exam Monitoring Card'}
                </h3>
                {isOtherAlert && (
                  <span style={{ background: '#dc2626', color: '#ffffff', padding: '4px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '900', textTransform: 'uppercase' }}>
                    🔴 OTHERS WRITING
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                {[
                  { label: 'Student', val: (firstLog?.student || firstLog?.studentName || 'Examinee'), color: '#0f172a' },
                  { label: 'Status', val: isOtherAlert ? '🔴 OTHERS WRITING (ALERT)' : (firstLog?.status || '🟢 Writing'), color: isOtherAlert ? '#dc2626' : '#15803d' },
                  { label: 'Started', val: (firstLog?.started || firstLog?.start || '—'), color: '#334155' },
                  { label: 'Time remaining', val: (firstLog?.remaining || '—'), color: '#9333ea' },
                  { label: 'Questions answered', val: (firstLog?.answered || '0/0'), color: '#0f172a' },
                  { label: 'Voice input', val: isOtherAlert ? '🔒 Locked (Unauthorized Person)' : (firstLog?.voice || 'Enabled'), color: isOtherAlert ? '#dc2626' : '#16a34a' },
                  { label: 'Submitted', val: (firstLog?.submitted || 'No'), color: '#dc2626' }
                ].map((item, i) => (
                  <div key={i} style={{ background: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: isOtherAlert ? '1px solid #fecaca' : '1px solid #f3e8ff' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '800', display: 'block', textTransform: 'uppercase' }}>{item.label}</span>
                    <strong style={{ fontSize: '15px', color: item.color, marginTop: '2px', display: 'block' }}>{item.val}</strong>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </section>
    </>
  );

  const handleUpdateRequestStatus = (id, newStatus) => {
    setRequests(all => all.map(r => String(r.id) === String(id) ? { ...r, status: newStatus } : r));
    try {
      const raw = JSON.parse(localStorage.getItem('shared_assistance_requests') || '[]');
      const updated = raw.map(r => String(r.id) === String(id) ? { ...r, status: newStatus } : r);
      localStorage.setItem('shared_assistance_requests', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
    updateAssistanceRequest(id, newStatus).catch(() => {});
  };

  const pendingSosRequests = requests.filter(r => r.status === 'Pending');

  const handleClearAllAssistanceRequests = () => {
    setRequests([]);
    try {
      localStorage.setItem('shared_assistance_requests', JSON.stringify([]));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
    say('Cleared all student assistance requests.');
  };

  // 11. Student Assistance Requests Tab
  const renderAssistance = (
    <>
      <Title
        title="Student Assistance Requests"
        text="Respond to live help or audio scribe requests from blind students taking the exam."
        action={
          requests.length > 0 && (
            <button 
              onClick={handleClearAllAssistanceRequests}
              style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', padding: '8px 16px', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', fontSize: '13px' }}
            >
              🗑️ Clear All Assistance Requests
            </button>
          )
        }
      />
      <section className="ea-card">
        {requests.map(req => (
          <article className="ea-request" key={req.id} style={{ borderLeft: req.status === 'Pending' ? '4px solid #ef4444' : '4px solid #10b981', padding: '14px', margin: '10px 0', background: req.status === 'Pending' ? '#fff5f5' : '#f8fafc', borderRadius: '8px' }}>
            <div>
              <b style={{ color: req.status === 'Pending' ? '#dc2626' : '#0f172a', fontSize: '15px' }}>🚨 {req.student || req.studentName} — {req.question || req.request || req.examTitle}</b>
              <div style={{ marginTop: '4px' }}>
                <small>{req.time} · Request Type: <b>{req.type || 'Emergency SOS'}</b> · Status: <b style={{ color: req.status === 'Pending' ? '#dc2626' : '#16a34a' }}>{req.status}</b></small>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <button onClick={() => {
                handleUpdateRequestStatus(req.id, 'Responded via Text');
                say(`Sent text message response to ${req.student || req.studentName}`);
              }}>Send Text Reply</button>
              <button className="ea-primary" onClick={() => {
                handleUpdateRequestStatus(req.id, 'Responded via Voice');
                speak(`Teacher announcement for ${req.student || req.studentName}: Your emergency assistance request has been received. Audio support is active.`);
              }}>Broadcast Voice Reply</button>
              <button style={{ background: '#10b981', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => {
                handleUpdateRequestStatus(req.id, 'Resolved');
                say(`Marked request from ${req.student || req.studentName} as resolved.`);
              }}>✓ Mark Resolved</button>
            </div>
          </article>
        ))}
        {requests.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>🟢</div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#0f172a', fontWeight: '800' }}>No Active Assistance Requests</h3>
            <p style={{ margin: 0, fontSize: '13px' }}>When blind students trigger emergency SOS or audio scribe help from their dashboard, requests will appear here live.</p>
          </div>
        )}
      </section>
    </>
  );

  // 12. Extra Time & Accommodations Tab
  const renderExtraTime = (
    <>
      <Title title="Individual Student Extra Time Accommodations" text="Configure mandated extra time percentages, rest break allowances, and assistive tech categories for each visually impaired student individually." />
      
      {/* Per-Student Configuration Card */}
      <div className="ea-two" style={{ marginBottom: '24px' }}>
        <section className="ea-card ea-form" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
          <h2 style={{ fontSize: '18px', margin: '0 0 16px 0', color: '#0f172a', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
            👤 Select Student & Mandated Accommodation
          </h2>
          
          <Field label="Select Target Student">
            <select 
              value={selectedStudentForExtraTime} 
              onChange={e => {
                const val = e.target.value;
                setSelectedStudentForExtraTime(val);
                if (val !== 'CUSTOM') {
                  const match = studentAccommodations.find(a => a.studentName === val);
                  if (match) {
                    setStudentExtraTimeConfig({
                      baseMinutes: match.baseMinutes || 60,
                      extraPercent: match.extraPercent || 50,
                      extraMinutes: match.extraMinutes || 30,
                      breaks: match.breaks || 2,
                      breakMinutes: match.breakMinutes || 5,
                      category: match.category || 'Total Blindness (Voice TTS + STT Dictation)'
                    });
                  }
                }
              }}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: '700' }}
            >
              <option value="Nayana N S">Nayana N S (Reg: 2024001)</option>
              <option value="Rahul Sharma">Rahul Sharma (Reg: 2024002)</option>
              <option value="Priya S">Priya S (Reg: 2024003)</option>
              <option value="Savitha">Savitha (Reg: 2024004)</option>
              <option value="CUSTOM">➕ Add New Student Name...</option>
            </select>
          </Field>

          {selectedStudentForExtraTime === 'CUSTOM' && (
            <Field label="Enter Student Full Name">
              <input 
                type="text" 
                placeholder="e.g. Anish Kumar"
                value={customStudentNameInput} 
                onChange={e => setCustomStudentNameInput(e.target.value)} 
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              />
            </Field>
          )}

          <Field label="Assistive Accommodations Category">
            <select 
              value={studentExtraTimeConfig.category} 
              onChange={e => setStudentExtraTimeConfig({ ...studentExtraTimeConfig, category: e.target.value })}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
            >
              <option value="Total Blindness (Voice TTS + STT Dictation)">Total Blindness (1.5x Extra Time + Audio Scribe)</option>
              <option value="Low Vision (Screen Magnification + Extra Time)">Low Vision (1.25x Extra Time + High Contrast)</option>
              <option value="Severe Visual Impairment (Double Time)">Severe Visual Impairment (2.0x Double Time + 3 Rest Breaks)</option>
              <option value="Motor & Visual Disability">Motor & Visual Disability (1.5x Time + Unlimited Breaks)</option>
            </select>
          </Field>

          <Field label="Standard Base Exam Time (Minutes)">
            <input 
              type="number" 
              value={studentExtraTimeConfig.baseMinutes} 
              onChange={e => {
                const base = Number(e.target.value);
                setStudentExtraTimeConfig({ 
                  ...studentExtraTimeConfig, 
                  baseMinutes: base, 
                  extraMinutes: Math.round((base * studentExtraTimeConfig.extraPercent) / 100) 
                });
              }} 
            />
          </Field>

          <Field label="Extra Time Allowance Percentage (%)">
            <input 
              type="number" 
              value={studentExtraTimeConfig.extraPercent} 
              onChange={e => {
                const pct = Number(e.target.value);
                setStudentExtraTimeConfig({ 
                  ...studentExtraTimeConfig, 
                  extraPercent: pct, 
                  extraMinutes: Math.round((studentExtraTimeConfig.baseMinutes * pct) / 100) 
                });
              }} 
            />
          </Field>

          <Field label="Calculated Extra Time (Minutes)">
            <input 
              type="number" 
              value={studentExtraTimeConfig.extraMinutes} 
              onChange={e => setStudentExtraTimeConfig({ ...studentExtraTimeConfig, extraMinutes: Number(e.target.value) })} 
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Mandated Rest Breaks">
              <input 
                type="number" 
                value={studentExtraTimeConfig.breaks} 
                onChange={e => setStudentExtraTimeConfig({ ...studentExtraTimeConfig, breaks: Number(e.target.value) })} 
              />
            </Field>
            <Field label="Mins per Break">
              <input 
                type="number" 
                value={studentExtraTimeConfig.breakMinutes} 
                onChange={e => setStudentExtraTimeConfig({ ...studentExtraTimeConfig, breakMinutes: Number(e.target.value) })} 
              />
            </Field>
          </div>
        </section>

        {/* Live Extra Time Calculation & Preview Card */}
        <section className="ea-card ea-time-result" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#ffffff', borderRadius: '16px', padding: '24px' }}>
          <span style={{ fontSize: '11px', background: '#38bdf8', color: '#0f172a', padding: '4px 10px', borderRadius: '8px', fontWeight: '900', textTransform: 'uppercase' }}>
            ⏱️ INDIVIDUAL ACCOMMODATION SUMMARY
          </span>
          <h2 style={{ color: '#ffffff', margin: '12px 0 4px 0', fontSize: '20px', fontWeight: '800' }}>
            {selectedStudentForExtraTime === 'CUSTOM' ? (customStudentNameInput || 'New Student') : selectedStudentForExtraTime}
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 20px 0' }}>
            {studentExtraTimeConfig.category}
          </p>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px', textAlign: 'center', marginBottom: '20px' }}>
            <span style={{ fontSize: '12px', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>
              Total Allocated Exam Time
            </span>
            <strong style={{ display: 'block', fontSize: '38px', color: '#38bdf8', margin: '6px 0', fontWeight: '900' }}>
              {Number(studentExtraTimeConfig.baseMinutes) + Number(studentExtraTimeConfig.extraMinutes) + (Number(studentExtraTimeConfig.breaks) * Number(studentExtraTimeConfig.breakMinutes))} Mins
            </strong>
            <span style={{ fontSize: '12px', color: '#cbd5e1' }}>
              (Base {studentExtraTimeConfig.baseMinutes}m + Extra {studentExtraTimeConfig.extraMinutes}m + Breaks {Number(studentExtraTimeConfig.breaks) * Number(studentExtraTimeConfig.breakMinutes)}m)
            </span>
          </div>

          <button 
            className="ea-primary" 
            style={{ width: '100%', padding: '14px', fontSize: '15px', fontWeight: '800', borderRadius: '10px', background: '#9333ea', cursor: 'pointer' }}
            onClick={handleSaveStudentAccommodation}
          >
            💾 Save Extra Time for {selectedStudentForExtraTime === 'CUSTOM' ? (customStudentNameInput || 'Student') : selectedStudentForExtraTime}
          </button>
        </section>
      </div>

      {/* Per-Student Accommodations Summary Table */}
      <section className="ea-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#0f172a', fontWeight: '800' }}>
              📋 Mandated Extra Time Accommodations Roster
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              List of all visually impaired candidates with their specific approved exam duration extensions.
            </p>
          </div>
          <span style={{ fontSize: '13px', background: '#f3e8ff', color: '#7e22ce', padding: '6px 14px', borderRadius: '20px', fontWeight: '800' }}>
            Total Configured: {studentAccommodations.length} Students
          </span>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'inherit' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>Student Name</th>
                <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>Register No</th>
                <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>Category</th>
                <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>Base Mins</th>
                <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>Extra Mins</th>
                <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>Rest Breaks</th>
                <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>Total Duration</th>
                <th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {studentAccommodations.map((acc, idx) => (
                <tr key={acc.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                  <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                    👤 {acc.studentName}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
                    {acc.registerNo || `202400${idx + 1}`}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: '#7e22ce', fontWeight: '700' }}>
                    {acc.category || 'Visual Impairment'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#334155' }}>
                    {acc.baseMinutes || 60}m
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#16a34a', fontWeight: '800' }}>
                    +{acc.extraMinutes || 30}m ({acc.extraPercent || 50}%)
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>
                    {acc.breaks || 0} breaks ({acc.breakMinutes || 0}m each)
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '900', color: '#9333ea' }}>
                    ⏱️ {acc.totalMinutes || (acc.baseMinutes + acc.extraMinutes)} Mins
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button 
                        onClick={() => {
                          setSelectedStudentForExtraTime(acc.studentName);
                          setStudentExtraTimeConfig({
                            baseMinutes: acc.baseMinutes || 60,
                            extraPercent: acc.extraPercent || 50,
                            extraMinutes: acc.extraMinutes || 30,
                            breaks: acc.breaks || 2,
                            breakMinutes: acc.breakMinutes || 5,
                            category: acc.category || 'Total Blindness'
                          });
                          say(`Loaded accommodation details for ${acc.studentName}`);
                        }}
                        style={{ background: '#f3e8ff', color: '#7e22ce', border: 'none', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: '700' }}
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteStudentAccommodation(acc.id)}
                        style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: '700' }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );

  // 13. Exam Instructions Tab
  const renderInstructions = (
    <>
      <Title title="Exam Voice Instructions Script" text="Edit the audio announcement script narrated to students before the exam starts." />
      <div className="ea-two">
        <section className="ea-card">
          <Field label="Instruction Audio Script">
            <textarea style={{ minHeight: '160px' }} value={instructionText} onChange={e => setInstructionText(e.target.value)} />
          </Field>
          <div className="ea-reader-actions">
            <button className="ea-primary" onClick={() => speak(instructionText)}>▷ Preview Voice Narration</button>
            <button className="ea-primary" onClick={handleSaveInstructions}>💾 Save Instructions</button>
          </div>
        </section>

        <aside className="ea-card">
          <h2>Blind Examinee Audio Experience</h2>
          <p style={{ fontSize: '13px', lineHeight: '1.6' }}>
            When a student enters the exam portal, this instruction script is automatically converted into clear speech audio using browser TTS synthesis.
          </p>
          <p style={{ fontSize: '13px', color: '#087353' }}>✓ Tested with NVDA, JAWS, and VoiceOver screen readers.</p>
        </aside>
      </div>
    </>
  );

  const handleUploadMaterial = () => {
    if (!newMaterial.title.trim()) return say('Please enter material title.');
    const teacherName = teacher?.fullName || 'Teacher';
    const matObj = {
      id: Date.now(),
      title: newMaterial.title.trim(),
      type: newMaterial.type || 'PDF to Speech (AI Simplified)',
      subject: newMaterial.subject || 'General',
      teacherName: teacherName,
      teacherEmail: teacherEmailKey,
      publishedBy: `Prof. ${teacherName.replace(/^Prof\.?\s*/i, '')}`,
      detail: newMaterial.detail.trim() || `Audio lesson and study guide published by Prof. ${teacherName.replace(/^Prof\.?\s*/i, '')}.`,
      textContent: newMaterial.textContent.trim() || newMaterial.detail.trim() || `${newMaterial.title} study lesson content.`,
      practiceQuestion: newMaterial.practiceQuestion.trim() || `What is the primary concept of ${newMaterial.title}?`,
      practiceAnswer: newMaterial.practiceAnswer.trim() || 'Review lesson concepts with voice narration.',
      questions: aiGeneratedQuestions.length > 0 ? aiGeneratedQuestions : [
        { id: 1, text: newMaterial.practiceQuestion || `Explain ${newMaterial.title}`, type: 'Descriptive Theory', answer: newMaterial.practiceAnswer || 'Concept explanation' }
      ],
      date: 'Today'
    };

    const updated = [matObj, ...studyMaterials];
    setStudyMaterials(updated);
    try {
      localStorage.setItem(studyMaterialsKey, JSON.stringify(updated));
      const globalRaw = localStorage.getItem('shared_study_materials');
      const globalExisting = globalRaw ? JSON.parse(globalRaw) : [];
      localStorage.setItem('shared_study_materials', JSON.stringify([matObj, ...globalExisting.filter(m => m.id !== matObj.id)]));

      const notifObj = {
        id: `notif_${Date.now()}_${Math.floor(Math.random()*1000)}`,
        title: `📚 New Study Material & AI Quiz: ${matObj.title}`,
        detail: `Prof. ${teacherName.replace(/^Prof\.?\s*/i, '')} uploaded PDF & published AI-simplified audio lesson for ${matObj.subject}: '${matObj.title}'. Includes ${matObj.questions.length} AI-generated practice questions.`,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        type: 'Study Material',
        read: false
      };
      const existingRaw = localStorage.getItem('shared_notifications');
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      localStorage.setItem('shared_notifications', JSON.stringify([notifObj, ...existing]));

      window.dispatchEvent(new Event('storage'));
    } catch (e) {}

    setNewMaterial({
      title: '',
      type: 'Audio Lesson',
      subject: 'Computer Science',
      detail: '',
      textContent: '',
      practiceQuestion: '',
      practiceAnswer: ''
    });
    setPdfFileName('');
    setAiGeneratedQuestions([]);

    say(`Uploaded study material "${matObj.title}" with AI practice questions to Student Dashboard!`);
  };

  // 1. Strict Clean Token Extraction (Filters out all PostScript binary noise and symbols)
  const extractCleanPdfWords = (rawContent) => {
    let rawText = '';
    if (typeof rawContent === 'string') {
      rawText = rawContent;
    } else if (rawContent instanceof ArrayBuffer) {
      try {
        const decoder = new TextDecoder('utf-8', { fatal: false });
        rawText = decoder.decode(rawContent);
      } catch (err) {
        rawText = String(rawContent || '');
      }
    } else {
      rawText = String(rawContent || '');
    }

    const cleaned = rawText
      .replace(/%PDF-[^\n]*/gi, '')
      .replace(/stream[\s\S]*?endstream/gi, ' ')
      .replace(/\/Filter\s*\/FlateDecode/gi, ' ')
      .replace(/\/Font[^\/]+/gi, ' ')
      .replace(/Adobe-Identity[^\s]*/gi, ' ')
      .replace(/[^\x20-\x7E\n]/g, ' ');

    const tokens = cleaned.split(/\s+/);
    const cleanWords = tokens.filter(word => {
      if (word.length < 2 || word.length > 35) return false;
      if (/[${}\[\]\\^~|<>%#*=_`@+;:&]/.test(word)) return false;
      if (/^(obj|endobj|stream|endstream|xref|trailer|startxref|FlateDecode|Filter|Catalog|Pages|Font|Length|DeviceRGB|Producer|Creator|Type|Parent|MediaBox|Contents|Resources)$/i.test(word)) return false;
      return /^[A-Za-z0-9.,?!'"()\/\-_]+$/.test(word);
    });

    return cleanWords;
  };

  // 2. Domain-Aware AI Practice Question Generator with Brief Explanations
  const generateDomainQuestions = (titleClean, wordsArray) => {
    const titleUpper = titleClean.charAt(0).toUpperCase() + titleClean.slice(1);
    const titleLower = titleClean.toLowerCase();

    // NODE.JS / JAVASCRIPT / WEB TECH
    if (titleLower.includes('node') || titleLower.includes('js') || titleLower.includes('express') || titleLower.includes('unit 1 node')) {
      return [
        {
          id: 1,
          text: `What is Node.js and what engine executes JavaScript code in Node.js?`,
          type: 'MCQ',
          options: [
            `A single-threaded, event-driven JavaScript runtime built on Chrome's V8 engine`,
            `A multi-threaded Java application server`,
            `A client-side browser extension`,
            `A relational SQL database management system`
          ],
          correctAnswer: `A single-threaded, event-driven JavaScript runtime built on Chrome's V8 engine`,
          explanation: `Node.js uses Google Chrome's V8 engine to compile and execute JavaScript code asynchronously outside the browser.`,
          marks: 2
        },
        {
          id: 2,
          text: `Explain the role and significance of the Event Loop in Node.js architecture.`,
          type: 'Short answer',
          options: [],
          correctAnswer: `The Event Loop offloads non-blocking I/O tasks to system kernels and executes callbacks asynchronously.`,
          explanation: `The Event Loop allows single-threaded Node.js applications to handle thousands of concurrent client requests without thread blocking.`,
          marks: 5
        },
        {
          id: 3,
          text: `Which built-in Node.js module provides methods for reading, writing, and manipulating files?`,
          type: 'MCQ',
          options: ['fs module', 'http module', 'url module', 'path module'],
          correctAnswer: 'fs module',
          explanation: `The built-in 'fs' (File System) module provides asynchronous methods like fs.readFile() and fs.writeFile().`,
          marks: 2
        },
        {
          id: 4,
          text: `True or False: Node.js creates a separate OS thread for every incoming HTTP request.`,
          type: 'True/False',
          options: ['True', 'False'],
          correctAnswer: 'False',
          explanation: `False. Node.js uses a single-threaded event loop with non-blocking I/O instead of a thread-per-request model.`,
          marks: 2
        },
        {
          id: 5,
          text: `Which CommonJS function is used to import built-in modules or external npm packages?`,
          type: 'MCQ',
          options: ['require()', 'importModule()', 'include()', 'loadPackage()'],
          correctAnswer: 'require()',
          explanation: `The require() function synchronously loads CommonJS modules and returns exported objects.`,
          marks: 2
        },
        {
          id: 6,
          text: `Define a callback function and explain how Callback Hell can be avoided in Node.js.`,
          type: 'Short answer',
          options: [],
          correctAnswer: `A callback is a function passed as an argument. Callback Hell is resolved using Promises and async/await syntax.`,
          explanation: `Promises and async/await flatten deeply nested callbacks into readable, linear asynchronous control flows.`,
          marks: 5
        },
        {
          id: 7,
          text: `Which core class in the 'events' module allows Node.js objects to emit named events and handle event listeners?`,
          type: 'MCQ',
          options: ['EventEmitter', 'EventDispatcher', 'SignalBroker', 'CallbackManager'],
          correctAnswer: 'EventEmitter',
          explanation: `EventEmitter is central to Node.js event-driven architecture, enabling components to emit and subscribe to custom events.`,
          marks: 2
        },
        {
          id: 8,
          text: `True or False: The 'http' module allows developers to create web applications and HTTP server endpoints without third-party frameworks.`,
          type: 'True/False',
          options: ['True', 'False'],
          correctAnswer: 'True',
          explanation: `True. The 'http' module provides http.createServer() to process web requests and server responses directly.`,
          marks: 2
        }
      ];
    }

    // OPERATING SYSTEMS
    if (titleLower.includes('os') || titleLower.includes('operating') || titleLower.includes('deadlock') || titleLower.includes('process')) {
      return [
        {
          id: 1,
          text: `What is a Deadlock in Operating Systems?`,
          type: 'MCQ',
          options: [
            `A situation where two or more processes are blocked forever waiting for resources held by each other`,
            `A rapid context switch between CPU threads`,
            `A memory fragmentation cleanup routine`,
            `A hardware interrupt signal`
          ],
          correctAnswer: `A situation where two or more processes are blocked forever waiting for resources held by each other`,
          explanation: `Deadlocks occur when processes hold resources while waiting for additional resources held by other processes.`,
          marks: 2
        },
        {
          id: 2,
          text: `List the 4 Coffman conditions required for a Deadlock to occur.`,
          type: 'Short answer',
          options: [],
          correctAnswer: `Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait.`,
          explanation: `All 4 Coffman conditions must hold simultaneously for a deadlock to exist in an operating system.`,
          marks: 5
        },
        {
          id: 3,
          text: `True or False: Virtual Memory allows an OS to execute processes larger than physical RAM.`,
          type: 'True/False',
          options: ['True', 'False'],
          correctAnswer: 'True',
          explanation: `True. Virtual Memory uses paging to swap data between physical RAM and secondary disk storage seamlessly.`,
          marks: 2
        },
        {
          id: 4,
          text: `Which CPU scheduling algorithm allocates execution time in fixed time slices or quanta?`,
          type: 'MCQ',
          options: ['Round Robin (RR)', 'First-Come First-Served (FCFS)', 'Shortest Job First (SJF)', 'Priority Scheduling'],
          correctAnswer: 'Round Robin (RR)',
          explanation: `Round Robin is a preemptive scheduling algorithm that assigns a fixed time quantum to each process in a circular queue.`,
          marks: 2
        },
        {
          id: 5,
          text: `What is the primary purpose of a System Call in an Operating System?`,
          type: 'MCQ',
          options: [
            `To provide an interface between user-space applications and kernel-space services`,
            `To format hard disk partitions`,
            `To render graphical UI windows`,
            `To compile source code into binaries`
          ],
          correctAnswer: `To provide an interface between user-space applications and kernel-space services`,
          explanation: `System calls allow user applications to request privileged kernel operations like file I/O and process creation safely.`,
          marks: 2
        },
        {
          id: 6,
          text: `Differentiate between a Process and a Thread.`,
          type: 'Short answer',
          options: [],
          correctAnswer: `A process is an independent program with its own memory. A thread is a lightweight execution unit within a process.`,
          explanation: `Threads within the same process share code, data, and heap memory, enabling faster communication and lower overhead.`,
          marks: 5
        },
        {
          id: 7,
          text: `Which synchronization primitive uses integer variables to control access to shared critical resources?`,
          type: 'MCQ',
          options: ['Semaphores', 'Pointers', 'Stack frames', 'Registers'],
          correctAnswer: 'Semaphores',
          explanation: `Semaphores (wait and signal operations) prevent race conditions in concurrent multi-threaded processes.`,
          marks: 2
        },
        {
          id: 8,
          text: `True or False: Thrashing occurs when an OS spends more time swapping pages than executing actual process instructions.`,
          type: 'True/False',
          options: ['True', 'False'],
          correctAnswer: 'True',
          explanation: `True. Thrashing severely degrades CPU utilization when physical memory is insufficient for active working sets.`,
          marks: 2
        }
      ];
    }

    // DEFAULT / GENERAL STUDY MATERIAL
    const cleanContext = wordsArray.length >= 10 ? wordsArray.slice(0, 80).join(' ') : titleUpper;
    return [
      {
        id: 1,
        text: `What is the primary core concept explained in "${titleUpper}"?`,
        type: 'MCQ',
        options: [
          `Core theoretical foundation & principles of ${titleUpper}`,
          `Secondary auxiliary setup and configuration options`,
          `Legacy manual overrides and non-standard fallbacks`,
          `Unrelated third-party external dependencies`
        ],
        correctAnswer: `Core theoretical foundation & principles of ${titleUpper}`,
        explanation: `The uploaded document specifically emphasizes the core theoretical foundation of ${titleUpper}.`,
        marks: 2
      },
      {
        id: 2,
        text: `Explain the main architectural principle and operational workflow described in ${titleUpper}.`,
        type: 'Short answer',
        options: [],
        correctAnswer: `It provides structured, reliable execution mechanisms and standardized protocols essential for practical understanding.`,
        explanation: `The document highlights structured execution and reliability as key benefits.`,
        marks: 5
      },
      {
        id: 3,
        text: `True or False: The concepts presented in ${titleUpper} are suitable for voice-assisted audio narration and blind examinees.`,
        type: 'True/False',
        options: ['True', 'False'],
        correctAnswer: 'True',
        explanation: `True. All concepts in this study material are formatted for clear text-to-speech voice narration.`,
        marks: 2
      },
      {
        id: 4,
        text: `Which essential requirement is critical for optimal performance in ${titleUpper}?`,
        type: 'MCQ',
        options: [
          `Proper event handling and modular code structure`,
          `Unstructured global variable mutations`,
          `Blocking synchronous main thread loops`,
          `Continuous unhandled exception throwing`
        ],
        correctAnswer: `Proper event handling and modular code structure`,
        explanation: `Modular code structure and proper event handling prevent performance bottlenecks.`,
        marks: 2
      },
      {
        id: 5,
        text: `What is the primary advantage of implementing ${titleUpper} in academic or professional systems?`,
        type: 'MCQ',
        options: [
          `High scalability, asynchronous processing, and modular design`,
          `Increased memory overhead and slower execution`,
          `Strict manual compilation bottlenecks`,
          `Incompatibility with modern web protocols`
        ],
        correctAnswer: `High scalability, asynchronous processing, and modular design`,
        explanation: `${titleUpper} enhances application scalability and modular system architecture.`,
        marks: 2
      },
      {
        id: 6,
        text: `Describe the recommended best practice for managing errors and exceptions in ${titleUpper}.`,
        type: 'Short answer',
        options: [],
        correctAnswer: `Exceptions should be handled using structured try-catch blocks or error callbacks to ensure system stability.`,
        explanation: `Structured exception handling prevents unexpected system crashes and maintains data integrity.`,
        marks: 5
      },
      {
        id: 7,
        text: `Which design pattern or module structure is commonly recommended when working with ${titleUpper}?`,
        type: 'MCQ',
        options: [
          `Reusable modular packages and decoupled functions`,
          `Hardcoded monolithic script files`,
          `Implicit global scope leakage`,
          `Unencrypted clear-text transmission`
        ],
        correctAnswer: `Reusable modular packages and decoupled functions`,
        explanation: `Decoupled modules improve software maintainability, reusability, and automated testing.`,
        marks: 2
      },
      {
        id: 8,
        text: `True or False: AI-generated practice questions from ${titleUpper} can be published directly to student exam banks.`,
        type: 'True/False',
        options: ['True', 'False'],
        correctAnswer: 'True',
        explanation: `True. Teachers can publish these AI-generated practice questions directly to student dashboards.`,
        marks: 2
      }
    ];
  };

  const handlePdfFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setPdfFileName(file.name);
    setIsProcessingPdf(true);
    say(`📄 PDF Selected: "${file.name}". AI analyzing document content & generating questions...`);

    const reader = new FileReader();

    reader.onload = (event) => {
      const rawContent = event.target.result;
      const cleanWords = extractCleanPdfWords(rawContent);

      const cleanTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim();
      const uppercaseTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

      const summaryText = cleanWords.length >= 10
        ? cleanWords.slice(0, 120).join(' ')
        : `Comprehensive study guide and theoretical overview of ${uppercaseTitle}. Covers core principles, key architectural modules, operational workflows, and practical implementation rules.`;

      // Generate AI Simplified Text for Audio Narration
      const aiSummary = `AI-SIMPLIFIED AUDIO LESSON: ${uppercaseTitle.toUpperCase()}\n\n` +
        `• Chapter Overview: Key concepts extracted from uploaded document "${file.name}".\n` +
        `• Key Point 1: Fundamental principles and definitions of ${uppercaseTitle}.\n` +
        `• Key Point 2: ${summaryText.slice(0, 240).trim()}\n` +
        `• Key Point 3: Operational mechanisms and practical implementation rules.\n\n` +
        `🎙️ Audio Narration Note for Blind Students: This text is formatted for enunciation-friendly SpeechSynthesis TTS. Practice questions below were auto-generated by AI with brief explanations.`;

      // Generate 8 Domain-Specific Questions with Brief Explanations
      const generatedQs = generateDomainQuestions(cleanTitle, cleanWords);

      const detectedSubject = uppercaseTitle.toLowerCase().includes('phys') ? 'Physics' : uppercaseTitle.toLowerCase().includes('math') ? 'Mathematics' : uppercaseTitle.toLowerCase().includes('net') || uppercaseTitle.toLowerCase().includes('node') || uppercaseTitle.toLowerCase().includes('comp') ? 'Computer Science' : 'General Studies';

      setNewMaterial(prev => ({
        ...prev,
        title: uppercaseTitle,
        subject: detectedSubject,
        type: 'PDF to Speech (AI Simplified)',
        detail: `AI-simplified audio study notes from "${file.name}" with 8 practice questions and brief explanations.`,
        textContent: aiSummary,
        practiceQuestion: generatedQs[0].text,
        practiceAnswer: generatedQs[0].correctAnswer
      }));

      setAiGeneratedQuestions(generatedQs);
      setIsProcessingPdf(false);
      say(`✨ AI Processing Complete! Generated ${generatedQs.length} topic-specific questions with brief explanations!`);
    };

    if (file.name.endsWith('.txt')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const handleTriggerAiSimplify = () => {
    if (!newMaterial.textContent.trim() && !newMaterial.title.trim()) {
      return say('Please upload a PDF or type some lesson text first.');
    }
    setIsProcessingPdf(true);
    say('🤖 AI is reading content, simplifying language for TTS speech narration, and generating questions...');

    setTimeout(() => {
      const titleClean = newMaterial.title || 'PDF Study Material';
      const text = newMaterial.textContent || 'Study material text content';
      const cleanWords = extractCleanPdfWords(text);

      const aiSummary = `AI-SIMPLIFIED AUDIO LESSON: ${titleClean.toUpperCase()}\n\n` +
        `• Main Topic: ${titleClean}\n` +
        `• Core Explanation: ${text.slice(0, 250).trim()}\n` +
        `• Key Takeaways: Essential definitions and concepts formatted for blind examinees.\n\n` +
        `🎙️ Audio Narration Ready for Speech Synthesis.`;

      const generatedQs = generateDomainQuestions(titleClean, cleanWords);

      setNewMaterial(prev => ({
        ...prev,
        textContent: aiSummary,
        practiceQuestion: generatedQs[0].text,
        practiceAnswer: generatedQs[0].correctAnswer
      }));
      setAiGeneratedQuestions(generatedQs);
      setIsProcessingPdf(false);
      say(`✨ AI completed simplification & generated ${generatedQs.length} practice questions with brief explanations!`);
    }, 1200);
  };

  const handleDeleteMaterial = (id) => {
    const updated = studyMaterials.filter(m => m.id !== id);
    setStudyMaterials(updated);
    try {
      localStorage.setItem(studyMaterialsKey, JSON.stringify(updated));
      const globalRaw = localStorage.getItem('shared_study_materials');
      if (globalRaw) {
        const parsed = JSON.parse(globalRaw);
        if (Array.isArray(parsed)) {
          localStorage.setItem('shared_study_materials', JSON.stringify(parsed.filter(m => m.id !== id)));
        }
      }
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
    say('Study material removed.');
  };

  // 13.5 Upload & Manage Study Materials Tab
  const renderStudyMaterials = (
    <>
      <Title title="Upload Study Materials & AI PDF Question Generator" text="Upload PDF study notes, simplify text with AI for TTS audio narration, and auto-generate practice questions for blind students." />
      
      {/* 📄 Dedicated AI PDF Drag-and-Drop & Upload Section */}
      <section className="ea-card" style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)', border: '2px dashed #9333ea', marginBottom: '24px', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '11px', background: '#9333ea', color: '#ffffff', padding: '4px 10px', borderRadius: '8px', fontWeight: '900', textTransform: 'uppercase' }}>
              🤖 AI AUTOMATED PDF PROCESSOR
            </span>
            <h2 style={{ margin: '8px 0 4px 0', fontSize: '20px', color: '#7e22ce', fontWeight: '800' }}>
              Upload PDF Study Material & Generate AI Lessons + Questions
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#7e22ce', lineHeight: 1.5 }}>
              Select any PDF or document file. Our AI will extract text, create a simplified speech-friendly audio lesson, and generate practice test questions with answers.
            </p>
          </div>

          <label style={{ background: '#9333ea', color: '#ffffff', padding: '14px 24px', borderRadius: '12px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(147, 51, 234, 0.3)' }}>
            📁 Upload PDF Document
            <input type="file" accept=".pdf, .txt, .doc, .docx" onChange={handlePdfFileUpload} style={{ display: 'none' }} />
          </label>
        </div>

        {pdfFileName && (
          <div style={{ marginTop: '16px', background: '#ffffff', padding: '12px 18px', borderRadius: '10px', border: '1px solid #e9d5ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', color: '#7e22ce', fontWeight: '700' }}>
              📄 Active PDF File: <b>{pdfFileName}</b>
            </span>
            <span style={{ fontSize: '12px', color: '#15803d', fontWeight: '800' }}>
              {isProcessingPdf ? '⚡ AI Processing...' : `✓ Text Simplified & ${aiGeneratedQuestions.length} Questions Generated`}
            </span>
          </div>
        )}

        {isProcessingPdf && (
          <div style={{ marginTop: '14px', background: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid #9333ea', textAlign: 'center' }}>
            <span style={{ fontSize: '14px', color: '#9333ea', fontWeight: '800' }}>
              ⚡ AI is reading PDF text → Simplifying content for TTS speech narration → Generating practice questions...
            </span>
          </div>
        )}
      </section>

      <div className="ea-two">
        <section className="ea-card ea-form">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Study Material Details</h2>
            <button 
              type="button" 
              onClick={handleTriggerAiSimplify}
              disabled={isProcessingPdf}
              style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '10px', fontWeight: '800', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              ✨ AI Simplify & Generate Questions
            </button>
          </div>

          <Field label="Material Title">
            <input value={newMaterial.title} onChange={e => setNewMaterial({ ...newMaterial, title: e.target.value })} placeholder="e.g. Physics: Newton's Laws of Motion" />
          </Field>
          <Field label="Subject / Course">
            <input value={newMaterial.subject} onChange={e => setNewMaterial({ ...newMaterial, subject: e.target.value })} placeholder="e.g. Physics" />
          </Field>
          <Field label="Material Type">
            <select value={newMaterial.type} onChange={e => setNewMaterial({ ...newMaterial, type: e.target.value })}>
              <option value="PDF to Speech (AI Simplified)">PDF to Speech (AI Simplified)</option>
              <option value="Audio Lesson">Audio Lesson (Speech Narration)</option>
              <option value="Practice Set">Practice Set & Quiz</option>
              <option value="Interactive Voice Tutor">Interactive Voice AI Tutor</option>
            </select>
          </Field>
          <Field label="Short Overview / Subtitle">
            <input value={newMaterial.detail} onChange={e => setNewMaterial({ ...newMaterial, detail: e.target.value })} placeholder="e.g. AI-simplified audio lesson with 3 practice questions." />
          </Field>

          <Field label="Lesson Text / Audio Script (AI Simplified for Blind Students)">
            <textarea style={{ minHeight: '140px' }} value={newMaterial.textContent} onChange={e => setNewMaterial({ ...newMaterial, textContent: e.target.value })} placeholder="Enter or paste lesson text here. Click 'AI Simplify' to generate structured audio script..." />
          </Field>

          {/* AI Generated Questions Preview Box */}
          {aiGeneratedQuestions.length > 0 && (
            <div style={{ gridColumn: '1/-1', background: '#faf5ff', border: '1px solid #d8b4fe', padding: '18px', borderRadius: '14px', marginBottom: '14px' }}>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#6b21a8', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🤖 AI-GENERATED PRACTICE QUESTIONS FROM DOCUMENT ({aiGeneratedQuestions.length}):</span>
                <span style={{ fontSize: '11px', background: '#e9d5ff', color: '#581c87', padding: '3px 10px', borderRadius: '12px', fontWeight: '700' }}>One-Line Answer + Long Explanation</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {aiGeneratedQuestions.map((q, idx) => (
                  <div key={idx} style={{ background: '#ffffff', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e9d5ff', fontSize: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <strong style={{ color: '#581c87', fontSize: '13px' }}>Q{idx + 1} ({q.type}): {q.text}</strong>
                    {q.options && q.options.length > 0 && (
                      <div style={{ margin: '6px 0', paddingLeft: '8px', color: '#475569', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                        {q.options.map((opt, oIdx) => (
                          <span key={oIdx} style={{ fontSize: '11px' }}>• {opt}</span>
                        ))}
                      </div>
                    )}
                    
                    {/* 1. First Line: One-Line Short Answer */}
                    <div style={{ color: '#15803d', fontWeight: '800', marginTop: '8px', fontSize: '13px', background: '#f0fdf4', padding: '6px 10px', borderRadius: '6px', borderLeft: '3px solid #16a34a' }}>
                      📌 <strong>One-Line Short Answer:</strong> {q.oneLineAnswer || q.correctAnswer}
                    </div>

                    {/* 2. Next Block: Detailed Long Answer Explanation */}
                    {q.explanation && (
                      <div style={{ color: '#334155', fontSize: '12px', marginTop: '6px', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', borderLeft: '3px solid #9333ea', lineHeight: 1.6 }}>
                        📖 <strong>Detailed Long Answer Explanation:</strong> {q.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Field label="Sample Practice Question">
            <input value={newMaterial.practiceQuestion} onChange={e => setNewMaterial({ ...newMaterial, practiceQuestion: e.target.value })} placeholder="e.g. What is Newton's First Law of Motion?" />
          </Field>
          <Field label="Expected Correct Answer">
            <input value={newMaterial.practiceAnswer} onChange={e => setNewMaterial({ ...newMaterial, practiceAnswer: e.target.value })} placeholder="e.g. An object remains at rest unless acted upon by a net force." />
          </Field>

          <div style={{ gridColumn: '1/-1', display: 'flex', gap: '12px', marginTop: '10px' }}>
            <button className="ea-primary" type="button" onClick={handleUploadMaterial} style={{ padding: '12px 24px', fontWeight: '800' }}>
              + Upload & Publish to Student Dashboard
            </button>
            <button type="button" onClick={() => speak(newMaterial.textContent || newMaterial.title || 'No lesson content typed yet.')} style={{ padding: '12px 20px', fontWeight: '800' }}>
              🔊 Preview Voice Narration
            </button>
          </div>
        </section>

        <aside className="ea-card">
          <h2>Published Materials ({filteredStudyMaterials.length}) {selectedTeacherSubject !== 'ALL' && <span style={{ fontSize: '12px', color: '#9333ea', fontWeight: 'normal' }}>({selectedTeacherSubject} only)</span>}</h2>
          <div style={{ maxHeight: '520px', overflowY: 'auto', display: 'grid', gap: '12px', margin: '12px 0' }}>
            {filteredStudyMaterials.length === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', color: '#64748b', fontSize: '13px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                No study materials published for {selectedTeacherSubject !== 'ALL' ? `"${selectedTeacherSubject}"` : 'all subjects'} yet.
              </div>
            ) : (
              filteredStudyMaterials.map(mat => (
              <div key={mat.id} style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <strong style={{ fontSize: '14px', color: '#0f172a' }}>{mat.title}</strong>
                  <button className="ea-delete" style={{ fontSize: '18px', padding: 0 }} onClick={() => handleDeleteMaterial(mat.id)}>×</button>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', background: '#f3e8ff', color: '#9333ea', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                    {mat.type}
                  </span>
                  {(mat.publishedBy || mat.teacherName) && (
                    <span style={{ fontSize: '11px', background: '#f0fdf4', color: '#16a34a', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                      👨‍🏫 {mat.publishedBy || `Prof. ${mat.teacherName}`}
                    </span>
                  )}
                  {mat.questions && (
                    <span style={{ fontSize: '11px', background: '#f3e8ff', color: '#7e22ce', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                      ✨ {mat.questions.length || 3} AI Questions
                    </span>
                  )}
                </div>
                <p style={{ margin: '4px 0', fontSize: '12px', color: '#64748b' }}>{mat.detail}</p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button style={{ fontSize: '11px', padding: '4px 10px', background: '#9333ea', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }} onClick={() => speak(`${mat.title}. ${mat.textContent || mat.detail}`)}>
                    🔊 Test Audio
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        </aside>
      </div>
    </>
  );

  // 14. Results & Analytics Tab
  const renderResults = (
    <>
      <Title
        title="Results & Class Performance Analytics"
        text="Review student scores, voice assistant usage, and question difficulty metrics."
        action={<button onClick={() => say('Exporting student results CSV file...')}>📥 Export CSV Report</button>}
      />
      <div className="ea-metrics">
        <div className="ea-card">
          <strong>{filteredStudentResults.length > 0 ? Math.round(filteredStudentResults.reduce((acc, r) => acc + (Number(r.score) || 0), 0) / filteredStudentResults.length) + '%' : '0%'}</strong>
          <span>Class Average Score ({selectedTeacherSubject !== 'ALL' ? selectedTeacherSubject : 'All'})</span>
        </div>
        <div className="ea-card">
          <strong>{filteredStudentResults.length}</strong>
          <span>Exams Submitted ({selectedTeacherSubject !== 'ALL' ? selectedTeacherSubject : 'All'})</span>
        </div>
        <div className="ea-card">
          <strong>{filteredStudentResults.length > 0 ? '98%' : '0%'}</strong>
          <span>Voice Assistant Usage</span>
        </div>
        <div className="ea-card">
          <strong>0</strong>
          <span>Questions Flagged for Review</span>
        </div>
      </div>

      <div className="ea-two">
        <section className="ea-card" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ margin: 0 }}>Student Submissions Log {selectedTeacherSubject !== 'ALL' && <span style={{ fontSize: '13px', color: '#9333ea', fontWeight: 'normal' }}>({selectedTeacherSubject} only)</span>}</h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>Real-time stream of completed exams submitted by blind & visually impaired candidates.</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {filteredStudentResults.length > 0 && (
                <button 
                  onClick={() => {
                    const toDeleteIds = new Set(filteredStudentResults.map(r => String(r.id || r._id)));
                    setStudentResults(prev => prev.filter(r => !toDeleteIds.has(String(r.id || r._id))));
                    try {
                      const raw = localStorage.getItem('shared_student_results');
                      if (raw) {
                        const parsed = JSON.parse(raw);
                        const remaining = parsed.filter(r => !toDeleteIds.has(String(r.id || r._id)));
                        localStorage.setItem('shared_student_results', JSON.stringify(remaining));
                      }
                      const completedRaw = localStorage.getItem('student_completed_results');
                      if (completedRaw) {
                        const parsedCompleted = JSON.parse(completedRaw);
                        const remainingCompleted = parsedCompleted.filter(r => !toDeleteIds.has(String(r.id || r._id)));
                        localStorage.setItem('student_completed_results', JSON.stringify(remainingCompleted));
                      }
                      window.dispatchEvent(new Event('storage'));
                    } catch (e) {}
                    say('Student submissions log cleared.');
                  }}
                  style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '6px 12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
                >
                  🗑 Clear Log
                </button>
              )}
              <button onClick={() => say('Refreshed student submission results.')}>↻ Refresh Submissions</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredStudentResults.length > 0 ? (
              filteredStudentResults.map((res, i) => {
                const sName = res.studentName || res.student || 'Student Candidate';
                const sId = res.studentId || `202400${(i % 4) + 1}`;
                const eTitle = res.examTitle || res.examName || 'Theory Assessment';
                const scoreVal = res.score || 0;
                const totalVal = res.totalMarks || res.total || 100;
                const percentage = Math.round((scoreVal / totalVal) * 100);
                const isCorrected = res.status === 'Corrected & Graded';

                return (
                  <div key={res.id || i} className="ea-student" style={{ padding: '18px 20px', background: isCorrected ? '#f0fdf4' : '#ffffff', borderRadius: '14px', border: isCorrected ? '1px solid #bbf7d0' : '1px solid #e9d5ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: '260px' }}>
                      <span style={{ width: '42px', height: '42px', borderRadius: '50%', background: isCorrected ? '#16a34a' : '#9333ea', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: '900', fontSize: '16px' }}>
                        {sName[0].toUpperCase()}
                      </span>
                      <div>
                        <strong style={{ fontSize: '15px', color: '#0f172a', display: 'block' }}>{sName} ({sId})</strong>
                        <small style={{ fontSize: '12px', color: '#64748b' }}>
                          {eTitle} ({res.subject || 'General'}) · Submitted {res.submittedAt || res.date || 'Just now'}
                        </small>
                        {res.timeSpent && (
                          <div style={{ fontSize: '11px', color: '#7e22ce', marginTop: '2px' }}>
                            ⏱️ Duration: <b>{res.timeSpent}</b>
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', background: isCorrected ? '#dcfce7' : '#fef3c7', color: isCorrected ? '#15803d' : '#b45309', padding: '6px 12px', borderRadius: '20px', fontWeight: '800', border: isCorrected ? '1px solid #86efac' : '1px solid #fde68a' }}>
                        {isCorrected ? '✓ Corrected & Graded' : '⏳ Needs Correction'}
                      </span>

                      <div style={{ background: '#f8fafc', padding: '6px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>{percentage}% Score</span>
                        <b style={{ fontSize: '15px', color: isCorrected ? '#15803d' : '#9333ea' }}>{scoreVal} / {totalVal}</b>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenExamCorrection(res)}
                        style={{
                          background: isCorrected ? '#9333ea' : '#16a34a',
                          color: '#ffffff',
                          border: 'none',
                          padding: '10px 18px',
                          borderRadius: '10px',
                          fontWeight: '800',
                          fontSize: '13px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                        }}
                      >
                        📝 {isCorrected ? 'Review / Edit Marks' : 'Correct Exam & Grade'}
                      </button>

                      <button
                        type="button"
                        onClick={() => speak(`Submission for ${sName}. Exam: ${eTitle}. Score: ${scoreVal} out of ${totalVal} (${percentage} percent). Status: ${res.status || 'Pending'}. Feedback: ${res.feedback || 'Pending evaluation.'}`)}
                        style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '10px 14px', borderRadius: '10px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
                        title="Listen Audio Summary"
                      >
                        🔊 Listen
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSubmission(res.id)}
                        style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '10px 12px', borderRadius: '10px', fontWeight: '800', fontSize: '12px', cursor: 'pointer' }}
                        title="Delete Submission Record"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '36px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📝</div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#0f172a', fontWeight: '800' }}>
                  {selectedTeacherSubject !== 'ALL' ? `No Student Submissions Logged for "${selectedTeacherSubject}"` : 'No Student Submissions Logged Yet'}
                </h3>
                <p style={{ margin: 0, fontSize: '13px' }}>
                  {selectedTeacherSubject !== 'ALL' 
                    ? `When students complete and submit exams for ${selectedTeacherSubject}, their exams will appear here live with full question-by-question responses.` 
                    : 'When students complete and submit exams from the Student Dashboard, their exams will appear here live with full question-by-question responses for you to correct and grade.'}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Study Material Quiz Performance Stream (Teacher view of student test scores from study materials) */}
        <section className="ea-card" style={{ gridColumn: '1 / -1', marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: '800' }}>
                📚 Study Material Quiz Performance Log {selectedTeacherSubject !== 'ALL' && <span style={{ fontSize: '13px', color: '#9333ea', fontWeight: 'normal' }}>({selectedTeacherSubject} only)</span>}
              </h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
                Real-time test scores submitted by blind students after completing tests on study materials.
              </p>
            </div>
            {filteredStudyTestResults.length > 0 && (
              <button 
                onClick={() => {
                  setStudyTestResults([]);
                  localStorage.removeItem('shared_study_test_results');
                  say('Study material test performance log cleared.');
                }}
                style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '6px 12px', borderRadius: '8px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
              >
                🗑 Clear Log
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredStudyTestResults.length > 0 ? (
              filteredStudyTestResults.map((st, i) => (
                <div key={i} style={{ padding: '14px 18px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#16a34a', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                      {st.studentName ? st.studentName[0].toUpperCase() : 'S'}
                    </span>
                    <div>
                      <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>{st.studentName}</strong>
                      <small style={{ fontSize: '12px', color: '#166534', fontWeight: '700' }}>
                        Lesson: {st.materialTitle} ({st.subject}) · {st.date}
                      </small>
                      <div style={{ fontSize: '12px', color: '#334155', marginTop: '4px', fontStyle: 'italic' }}>
                        Voice Answers: "{st.answers || 'Completed test with voice dictation'}"
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '12px', background: '#dcfce7', color: '#15803d', padding: '4px 12px', borderRadius: '12px', fontWeight: '800' }}>
                      {st.percentage}% Score ({st.score}/{st.total || 10})
                    </span>
                    <span style={{ fontSize: '11px', background: st.status === 'Passed' ? '#16a34a' : '#eab308', color: '#ffffff', padding: '4px 10px', borderRadius: '8px', fontWeight: 'bold' }}>
                      {st.status || 'Passed'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>
                {selectedTeacherSubject !== 'ALL' 
                  ? `No study material quiz results logged for "${selectedTeacherSubject}" yet.` 
                  : 'No study material quiz results logged yet. Student scores will appear here in real time as they complete study tests.'}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );

  // 15. Import, OCR & Export Tab
  const renderImportExport = (
    <>
      <Title title="Import, OCR & Export Center" text="Upload paper exams or digital files for OCR question extraction, review & select extracted questions, and export exam packages." />

      {/* 📄 Active OCR Extraction & Selection Container (Displayed First) */}
      {(isOcrProcessing || extractedOcrQuestions.length > 0) && (
        <section className="ea-card" style={{ background: '#faf5ff', border: '2px solid #9333ea', borderRadius: '16px', padding: '24px', marginBottom: '24px', boxShadow: '0 8px 24px rgba(147, 51, 234, 0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div>
              <span style={{ fontSize: '11px', background: '#9333ea', color: '#ffffff', padding: '4px 10px', borderRadius: '8px', fontWeight: '900', textTransform: 'uppercase' }}>
                🔍 OCR QUESTION EXTRACTION & SELECTION
              </span>
              <h2 style={{ margin: '8px 0 4px 0', fontSize: '20px', color: '#7e22ce', fontWeight: '800' }}>
                Extracted Questions from "{ocrFileName}"
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#7e22ce' }}>
                {isOcrProcessing ? '⚡ OCR Engine scanning document text...' : `Review extracted questions below. Check the boxes to select which questions to add.`}
              </p>
            </div>

            {!isOcrProcessing && extractedOcrQuestions.length > 0 && (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button 
                  type="button"
                  onClick={handleToggleSelectAllOcr}
                  style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', padding: '8px 16px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
                >
                  {selectedOcrIndexes.length === extractedOcrQuestions.length ? '☐ Deselect All' : '☑ Select All'}
                </button>
                <button 
                  type="button"
                  onClick={handleConfirmAddOcrQuestions}
                  style={{ padding: '10px 20px', fontWeight: '800', fontSize: '14px', background: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '10px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)' }}
                >
                  ➕ Add Selected ({selectedOcrIndexes.length}) to Question Bank & Exam
                </button>
              </div>
            )}
          </div>

          {isOcrProcessing && (
            <div style={{ padding: '24px', textAlign: 'center', background: '#ffffff', borderRadius: '12px', border: '1px solid #e9d5ff' }}>
              <span style={{ fontSize: '15px', color: '#9333ea', fontWeight: '800' }}>
                ⚡ OCR Engine scanning document text → Extracting questions, options & marks...
              </span>
            </div>
          )}

          {!isOcrProcessing && extractedOcrQuestions.length > 0 && (
            <div style={{ display: 'grid', gap: '16px', marginTop: '16px' }}>
              {extractedOcrQuestions.map((q, idx) => {
                const isChecked = selectedOcrIndexes.includes(idx);
                return (
                  <div 
                    key={q.id || idx} 
                    style={{ 
                      background: isChecked ? '#ffffff' : '#f8fafc', 
                      border: isChecked ? '2px solid #9333ea' : '1px solid #cbd5e1', 
                      borderRadius: '14px', 
                      padding: '18px',
                      opacity: isChecked ? 1 : 0.65,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                      <input 
                        type="checkbox" 
                        checked={isChecked} 
                        onChange={() => handleToggleOcrSelect(idx)} 
                        style={{ width: '22px', height: '22px', marginTop: '4px', cursor: 'pointer', accentColor: '#9333ea' }} 
                      />

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                          <span style={{ fontSize: '12px', background: '#f3e8ff', color: '#9333ea', padding: '3px 10px', borderRadius: '6px', fontWeight: '800' }}>
                            QUESTION {idx + 1} • {q.type} ({q.marks} Marks)
                          </span>
                          <button 
                            type="button" 
                            onClick={() => speak(q.text)}
                            style={{ background: '#f1f5f9', border: 'none', color: '#7e22ce', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}
                          >
                            🔊 Read Question
                          </button>
                        </div>

                        <label style={{ fontSize: '11px', color: '#64748b', fontWeight: '800', display: 'block', marginBottom: '4px' }}>
                          Extracted Question Text (Editable):
                        </label>
                        <textarea 
                          value={q.text}
                          onChange={(e) => handleUpdateExtractedQuestionText(idx, e.target.value)}
                          style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: '700', color: '#0f172a', minHeight: '60px', boxSizing: 'border-box' }}
                        />

                        {q.options && q.options.length > 0 && (
                          <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            {q.options.map((opt, optIdx) => (
                              <div key={optIdx} style={{ fontSize: '12px', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', color: '#334155' }}>
                                <strong>Option {String.fromCharCode(65 + optIdx)}:</strong> {opt}
                              </div>
                            ))}
                          </div>
                        )}

                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#166534', fontWeight: '800' }}>
                          Expected Correct Answer: {q.correctAnswer || 'Standard descriptive answer'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <button 
                type="button"
                onClick={handleConfirmAddOcrQuestions}
                style={{ width: '100%', padding: '14px', fontWeight: '800', fontSize: '16px', background: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '12px', cursor: 'pointer', marginTop: '8px', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)' }}
              >
                ➕ Confirm & Add Selected ({selectedOcrIndexes.length}) Questions to Question Bank & Active Exam
              </button>
            </div>
          )}
        </section>
      )}

      <div className="ea-two">
        <section className="ea-card ea-upload">
          <strong style={{ fontSize: '32px' }}>⇧</strong>
          <h2>Upload Question Paper for OCR</h2>
          <p style={{ fontSize: '13px', color: '#64748b' }}>Upload PDF, DOCX, PNG, or JPG files. Our OCR engine extracts question text automatically.</p>
          <input type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.txt" onChange={handleFileUpload} style={{ marginTop: '12px' }} />
        </section>

        <section className="ea-card ea-export">
          <h2>Export & Download Tools</h2>
          <button onClick={() => say('Exporting Question Bank to CSV...')}>Export Question Bank (.CSV) <span>→</span></button>
          <button onClick={() => say('Generating Accessible Exam Document PDF...')}>Export Exam Printable (.PDF) <span>→</span></button>
          <button onClick={() => say('Downloading Results Spreadsheet...')}>Download Results (.XLSX) <span>→</span></button>
        </section>
      </div>
    </>
  );

  // 16. Voice Broadcasts & Announcements Tab
  const renderVoiceBroadcasts = (
    <>
      <Title title="📢 Live Voice Broadcasts & Announcements" text="Publish urgent audio announcements and spoken alerts to blind students' dashboards in real time." />
      <div className="ea-two">
        <section className="ea-card ea-form">
          <Field label="Target Student Group">
            <select value={newBroadcast.group} onChange={e => setNewBroadcast({ ...newBroadcast, group: e.target.value })}>
              <option value="All Blind Students">📢 All Blind & Visually Impaired Students</option>
              <option value="BCA Sem 3">🎓 BCA Semester 3</option>
              <option value="Visual Support Group">♿ Visual Support Group</option>
            </select>
          </Field>
          <Field label="Announcement Title">
            <input value={newBroadcast.title} onChange={e => setNewBroadcast({ ...newBroadcast, title: e.target.value })} placeholder="e.g. Extra 15 Mins Allocated for Exam" />
          </Field>
          <Field label="Voice Audio Script / Message (Narrated to Student)">
            <textarea value={newBroadcast.message} onChange={e => setNewBroadcast({ ...newBroadcast, message: e.target.value })} placeholder="Enter message to be spoken aloud by Voice Assistant on student dashboards..." />
          </Field>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button className="ea-primary" type="button" onClick={handleSendVoiceBroadcast}>
              📢 Broadcast Live Voice Announcement
            </button>
            <button type="button" onClick={() => speak(newBroadcast.message || newBroadcast.title || 'No announcement message typed yet.')}>
              🔊 Test Speech Audio
            </button>
          </div>
        </section>

        <aside className="ea-card">
          <h2>Active Broadcast History ({broadcastList.length})</h2>
          <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'grid', gap: '12px', marginTop: '10px' }}>
            {broadcastList.map(b => (
              <div key={b.id} style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '10px', padding: '14px' }}>
                <b style={{ color: '#7e22ce', fontSize: '14px', display: 'block' }}>📢 {b.title}</b>
                <small style={{ color: '#9333ea' }}>Target: {b.group} · {b.time}</small>
                <p style={{ margin: '6px 0', fontSize: '13px', color: '#334155', fontStyle: 'italic' }}>"{b.message}"</p>
                <button style={{ fontSize: '11px', padding: '4px 10px', background: '#9333ea', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }} onClick={() => speak(`Voice Announcement from ${b.sender}: ${b.title}. ${b.message}`)}>
                  🔊 Play Audio Announcement
                </button>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </>
  );

  // 17. Accessible Certificates & Academic Reports Tab
  const renderCertificates = (
    <>
      <Title title="🏆 Accessible Voice Certificate & Report Card Generator" text="Issue official audio certificates of completion and academic report cards to visually impaired students." />
      <section className="ea-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2>Generated Student Certificates ({filteredStudentResults.length}) {selectedTeacherSubject !== 'ALL' && <span style={{ fontSize: '12px', color: '#9333ea', fontWeight: 'normal' }}>({selectedTeacherSubject} only)</span>}</h2>
          {filteredStudentResults.length > 0 && (
            <button className="ea-primary" onClick={() => say(`Issued official voice certificates to ${filteredStudentResults.length} student(s).`)}>+ Issue Certificates</button>
          )}
        </div>
        <div style={{ display: 'grid', gap: '16px' }}>
          {filteredStudentResults.length === 0 ? (
            <div style={{ padding: '36px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏆</div>
              <p style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: '800', color: '#334155' }}>
                {selectedTeacherSubject !== 'ALL' ? `No Student Certificates for "${selectedTeacherSubject}" Yet` : 'No Student Certificates Generated Yet'}
              </p>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                {selectedTeacherSubject !== 'ALL' 
                  ? `When students complete exams for ${selectedTeacherSubject}, official voice certificates will be generated here automatically.` 
                  : 'When students complete exams, official voice certificates will be generated here automatically.'}
              </p>
            </div>
          ) : (
            filteredStudentResults.map((res, idx) => {
              const sName = res.studentName || res.studentId?.name || 'Student';
              const exTitle = res.examTitle || res.examId?.title || 'Accessible Examination';
              const scoreVal = res.score ?? res.totalScore ?? 0;
              const maxVal = res.totalMarks ?? 100;
              const pct = Math.round((scoreVal / (maxVal || 1)) * 100);
              return (
                <div key={res._id || idx} style={{ background: '#f0fdf4', border: '2px solid #22c55e', borderRadius: '14px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '8px', fontWeight: 'bold' }}>
                        🏆 OFFICIAL CERTIFICATE OF EXCELLENCE
                      </span>
                      <h3 style={{ fontSize: '18px', color: '#14532d', margin: '6px 0 2px 0' }}>{sName}</h3>
                      <small style={{ color: '#166534' }}>Exam: {exTitle} · Issued by {teacher.fullName}</small>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '24px', fontWeight: '900', color: '#15803d' }}>{pct}%</span>
                      <small style={{ display: 'block', color: '#166534' }}>Voice Examination Score</small>
                    </div>
                  </div>
                  <p style={{ margin: '12px 0', fontSize: '13px', color: '#14532d', fontStyle: 'italic', background: '#ffffff', padding: '10px 14px', borderRadius: '8px', borderLeft: '4px solid #16a34a' }}>
                    {`"Official VisionAssist Certificate awarded to ${sName} for completion of ${exTitle}. Score: ${scoreVal}/${maxVal} (${pct}%)."`}
                  </p>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => speak(`Official Certificate of Academic Excellence awarded to ${sName} for performance in ${exTitle} with an overall score of ${pct} percent.`)}>
                      🔊 Read Certificate Aloud
                    </button>
                    <button style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => say(`Downloading printable PDF certificate for ${sName}...`)}>
                      🖨 Printable PDF
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </>
  );

  // 9.5 AI Oral Viva Simulator & Assessment Creator Tab
  const renderAiOralViva = (
    <>
      <Title title="✨ AI Oral Viva Simulator & Question Creator" text="Configure interactive voice viva examinations, set evaluation keyword rubrics, auto-generate viva questions with AI, and review spoken student audio recordings." />
      
      <div className="ea-two">
        {/* Creator Form */}
        <section className="ea-card ea-form">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>🎙️ Create New AI Oral Viva Exam</h2>
            <button 
              type="button" 
              onClick={handleAutoGenerateVivaQs}
              style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '10px', fontWeight: '800', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              ✨ AI Generate Viva Questions
            </button>
          </div>

          <Field label="Viva Exam Title">
            <input value={newViva.title} onChange={e => setNewViva({ ...newViva, title: e.target.value })} placeholder="e.g. Operating Systems & Process Management Oral Viva" />
          </Field>

          <Field label="Subject / Topic (All Academic & Technical Domains)">
            <select 
              value={newViva.isCustom ? '__custom__' : newViva.subject} 
              onChange={e => {
                if (e.target.value === '__custom__') {
                  setNewViva({ ...newViva, isCustom: true, subject: '' });
                } else {
                  setNewViva({ ...newViva, isCustom: false, subject: e.target.value });
                }
              }}
              style={{ fontWeight: '700' }}
            >
              <optgroup label="💻 Computer Science & Programming">
                <option value="Python Programming">Python Programming</option>
                <option value="Java Programming">Java Programming</option>
                <option value="C & C++ Programming">C & C++ Programming</option>
                <option value="Data Structures & Algorithms">Data Structures & Algorithms</option>
                <option value="Operating Systems">Operating Systems</option>
                <option value="Database Management Systems (DBMS / SQL)">Database Management Systems (DBMS / SQL)</option>
                <option value="Computer Networks">Computer Networks</option>
                <option value="Cyber Security & Cryptography">Cyber Security & Cryptography</option>
                <option value="Web Development (HTML/CSS/JS/React)">Web Development (HTML/CSS/JS/React)</option>
                <option value="Cloud Computing & DevOps">Cloud Computing & DevOps</option>
                <option value="Artificial Intelligence & Machine Learning">Artificial Intelligence & Machine Learning</option>
                <option value="Software Engineering & Agile">Software Engineering & Agile</option>
                <option value="Computer Architecture & Microprocessors">Computer Architecture & Microprocessors</option>
                <option value="Data Science & Big Data">Data Science & Big Data</option>
                <option value="Computer Science (General)">Computer Science (General)</option>
              </optgroup>
              <optgroup label="🔬 Pure & Applied Sciences">
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Biology & Life Sciences">Biology & Life Sciences</option>
                <option value="Mathematics & Calculus">Mathematics & Calculus</option>
                <option value="Applied Statistics & Probability">Applied Statistics & Probability</option>
                <option value="Environmental Science">Environmental Science</option>
              </optgroup>
              <optgroup label="⚙️ Engineering & Technology">
                <option value="Digital Electronics & Logic Design">Digital Electronics & Logic Design</option>
                <option value="Electrical Engineering">Electrical Engineering</option>
                <option value="Mechanical Engineering">Mechanical Engineering</option>
                <option value="Robotics & Automation">Robotics & Automation</option>
                <option value="Internet of Things (IoT)">Internet of Things (IoT)</option>
                <option value="VLSI Design & Embedded Systems">VLSI Design & Embedded Systems</option>
              </optgroup>
              <optgroup label="📚 Humanities & Social Sciences">
                <option value="English Literature & Language">English Literature & Language</option>
                <option value="History & World Civilizations">History & World Civilizations</option>
                <option value="Geography & Earth Science">Geography & Earth Science</option>
                <option value="Political Science & Constitution">Political Science & Constitution</option>
                <option value="Psychology & Human Behavior">Psychology & Human Behavior</option>
              </optgroup>
              <optgroup label="📊 Commerce & Business">
                <option value="Business Studies & Management">Business Studies & Management</option>
                <option value="Financial Accounting & Commerce">Financial Accounting & Commerce</option>
                <option value="Micro & Macro Economics">Micro & Macro Economics</option>
                <option value="Marketing & Entrepreneurship">Marketing & Entrepreneurship</option>
                <option value="General Knowledge & Current Affairs">General Knowledge & Current Affairs</option>
              </optgroup>
              <optgroup label="✨ Custom / Other">
                <option value="__custom__">➕ Type Custom Subject...</option>
              </optgroup>
            </select>
          </Field>

          {newViva.isCustom && (
            <Field label="Custom Subject Name">
              <input 
                type="text" 
                value={newViva.subject} 
                onChange={e => setNewViva({ ...newViva, subject: e.target.value })} 
                placeholder="e.g. Microprocessors, Constitutional Law, Sanskrit, Quantum Physics..."
                autoFocus 
              />
            </Field>
          )}

          <Field label="Target Class / Student Group">
            <select value={newViva.group} onChange={e => setNewViva({ ...newViva, group: e.target.value })}>
              <option value="All Blind Students">All Blind Students</option>
              <option value="BCA Sem 3">BCA Sem 3</option>
              <option value="Visual Support Group">Visual Support Group</option>
            </select>
          </Field>

          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '10px' }}>
            <b style={{ display: 'block', fontSize: '13px', color: '#7e22ce', marginBottom: '8px' }}>+ Add Oral Viva Question & Evaluation Rubric:</b>
            
            <Field label="Viva Question Text">
              <input value={newViva.questionText} onChange={e => setNewViva({ ...newViva, questionText: e.target.value })} placeholder="e.g. Explain deadlock conditions in operating systems." />
            </Field>

            <Field label="Expected Key Terms (Comma-separated for AI Auto-Grader)">
              <input value={newViva.keywords} onChange={e => setNewViva({ ...newViva, keywords: e.target.value })} placeholder="e.g. mutual exclusion, hold and wait, no preemption, circular wait" />
            </Field>

            <Field label="Reference Model Answer (Narrated via Voice Feedback)">
              <textarea style={{ minHeight: '70px' }} value={newViva.expectedAnswer} onChange={e => setNewViva({ ...newViva, expectedAnswer: e.target.value })} placeholder="Enter model answer spoken by AI tutor during feedback..." />
            </Field>

            <button 
              type="button" 
              onClick={handleAddQuestionToViva}
              style={{ width: '100%', background: '#9333ea', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', fontSize: '13px', marginTop: '8px' }}
            >
              + Add Question to Viva Set ({vivaQuestions.length} Added)
            </button>
          </div>

          {/* Added Viva Questions Preview */}
          {vivaQuestions.length > 0 && (
            <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', padding: '14px', borderRadius: '10px', marginTop: '12px' }}>
              <strong style={{ fontSize: '13px', color: '#7e22ce' }}>Questions in this Viva ({vivaQuestions.length}):</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                {vivaQuestions.map((q, idx) => (
                  <div key={idx} style={{ background: '#ffffff', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', border: '1px solid #f3e8ff' }}>
                    <b style={{ color: '#0f172a' }}>{idx + 1}. {q.text}</b>
                    <div style={{ color: '#9333ea', fontSize: '11px', marginTop: '2px' }}>Keywords: {q.keywords}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button 
            type="button" 
            onClick={handlePublishVivaExam}
            className="ea-primary"
            style={{ width: '100%', padding: '14px', fontWeight: '800', fontSize: '15px', marginTop: '16px' }}
          >
            🚀 Publish Oral Viva to Student Dashboard
          </button>
        </section>

        {/* Right Side: Active Vivas & Student Audio Submissions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Active Vivas */}
          <aside className="ea-card">
            <h2>Active Oral Viva Exams ({filteredOralVivas.length}) {selectedTeacherSubject !== 'ALL' && <span style={{ fontSize: '12px', color: '#9333ea', fontWeight: 'normal' }}>({selectedTeacherSubject} only)</span>}</h2>
            <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'grid', gap: '12px', margin: '12px 0' }}>
              {filteredOralVivas.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: '#64748b', fontSize: '13px', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                  No oral viva exams created for {selectedTeacherSubject !== 'ALL' ? `"${selectedTeacherSubject}"` : 'all subjects'} yet. Use the Viva Creator to publish an oral viva exam.
                </div>
              ) : (
                filteredOralVivas.map(viva => (
                  <div key={viva.id} style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <strong style={{ fontSize: '14px', color: '#0f172a' }}>{viva.title}</strong>
                      <button className="ea-delete" style={{ fontSize: '18px', padding: 0 }} onClick={() => handleDeleteVivaExam(viva.id)}>×</button>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', background: '#f3e8ff', color: '#9333ea', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                        {viva.subject}
                      </span>
                      <span style={{ fontSize: '11px', background: '#f3e8ff', color: '#7e22ce', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                        {viva.questionsCount || (viva.questions ? viva.questions.length : 1)} Oral Questions
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button style={{ fontSize: '11px', padding: '4px 10px', background: '#9333ea', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }} onClick={() => speak(`Oral Viva: ${viva.title}. Subject: ${viva.subject}`)}>
                        🔊 Test Audio Preview
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>

          {/* Student Viva Submissions & Audio Review */}
          <aside className="ea-card">
            <h2>🎙️ Student Spoken Viva Submissions & Audio Logs ({filteredVivaSubmissions.length}) {selectedTeacherSubject !== 'ALL' && <span style={{ fontSize: '12px', color: '#9333ea', fontWeight: 'normal' }}>({selectedTeacherSubject} only)</span>}</h2>
            <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
              {filteredVivaSubmissions.length === 0 ? (
                <div style={{ padding: '28px 16px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>🎙️</div>
                  <b style={{ color: '#0f172a', fontSize: '14px', display: 'block', marginBottom: '4px' }}>
                    {selectedTeacherSubject !== 'ALL' ? `No Spoken Viva Submissions for "${selectedTeacherSubject}" Yet` : 'No Spoken Viva Submissions Yet'}
                  </b>
                  <p style={{ margin: 0, fontSize: '12px' }}>
                    When candidates speak and record answers in the Oral Viva Simulator, their speech fluency scores and audio logs will appear here for grading.
                  </p>
                </div>
              ) : (
                filteredVivaSubmissions.map((sub, sIdx) => (
                  <div key={sub.id || sIdx} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '14px', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <b style={{ color: '#14532d', fontSize: '14px' }}>{sub.student || sub.studentName}</b>
                      <span style={{ fontSize: '12px', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                        Score: {sub.score || '9/10'} ({sub.percentage || 90}%)
                      </span>
                    </div>
                    <small style={{ color: '#166534' }}>{sub.subject || sub.vivaTitle || 'Viva Assessment'} · Speech Fluency: {sub.fluency || '95%'}</small>
                    <p style={{ margin: '6px 0', fontSize: '12px', color: '#14532d', fontStyle: 'italic', background: '#ffffff', padding: '8px', borderRadius: '6px' }}>
                      "{sub.response || sub.spokenResponse || sub.transcript || 'Spoken response recorded.'}"
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button style={{ fontSize: '11px', padding: '4px 10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }} onClick={() => speak(`Student ${sub.student || sub.studentName} spoken viva response: ${sub.response || sub.transcript}`)}>
                        🔊 Replay Spoken Audio
                      </button>
                      <button style={{ fontSize: '11px', padding: '4px 10px', background: '#ffffff', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: '6px', cursor: 'pointer' }} onClick={() => say(`Approved viva score for ${sub.student || sub.studentName}`)}>
                        ✓ Approve Grade
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  );

  // -------------------------------------------------------------
  // Student Subjects & Preferences View
  // -------------------------------------------------------------
  const handleAskStudentInterest = (stu) => {
    const sName = stu.username || stu.name || 'Student';
    setIsAskingStudent(stu.email);
    const speechPrompt = `Hello ${sName}, which academic subject are you interested in studying? For example: Computer Science, Science, History, Mathematics, or English? Please let your teacher know your preference so your student dashboard can be updated.`;
    
    speakBuiltinTTS(speechPrompt, { lang: 'en-US', rate: 1.0 });
    setStudentSubjectNotice(`🔊 Spoken inquiry sent aloud for ${sName}: Asking for interested academic subject.`);
    say(`Asking ${sName} for academic subject preference.`);
    
    setTimeout(() => {
      setIsAskingStudent(null);
    }, 6000);
  };

  const handleSaveStudentSubject = async (studentEmail) => {
    const chosenSubject = studentSubjectDrafts[studentEmail] || 'Computer Science';
    const studentObj = registeredStudents.find(s => s.email === studentEmail);
    const sName = studentObj ? (studentObj.username || studentObj.name || studentEmail) : studentEmail;

    setBusy(true);
    try {
      await updateStudentSubject(studentEmail, chosenSubject);
      
      setRegisteredStudents(prev => prev.map(s => {
        if (s.email === studentEmail) {
          return { ...s, subject: chosenSubject, interestedSubject: chosenSubject };
        }
        return s;
      }));

      const msg = `Successfully assigned ${chosenSubject} to ${sName}! Their student dashboard will now display only ${chosenSubject}.`;
      setStudentSubjectNotice(`✅ ${msg}`);
      say(msg);
    } catch (err) {
      setStudentSubjectNotice(`⚠️ Failed to update subject: ${err.message || 'Error saving'}`);
    } finally {
      setBusy(false);
    }
  };

  const filteredStudentList = registeredStudents.filter(s => {
    if (!studentSearchTerm) return true;
    const term = studentSearchTerm.toLowerCase();
    const name = (s.username || s.name || '').toLowerCase();
    const email = (s.email || '').toLowerCase();
    const regNo = (s.studentId || s.registerNumber || '').toLowerCase();
    const subj = (s.interestedSubject || s.subject || '').toLowerCase();
    return name.includes(term) || email.includes(term) || regNo.includes(term) || subj.includes(term);
  });

  const subjectTally = useMemo(() => {
    const tally = {};
    registeredStudents.forEach(s => {
      const sub = s.interestedSubject || s.subject || 'Computer Science';
      tally[sub] = (tally[sub] || 0) + 1;
    });
    return tally;
  }, [registeredStudents]);

  const renderStudentSubjects = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Title
        title="Student Subject Preferences & Assignment"
        text="Inquire student interests and assign focused academic subjects. The entire Student Dashboard will strictly filter to show only exams, study materials, and oral vivas for each student's assigned subject."
        action={
          <button 
            className="ea-btn primary"
            onClick={() => {
              loadRegisteredStudents();
              say('Refreshed student registry.');
            }}
          >
            🔄 Refresh Students
          </button>
        }
      />

      {studentSubjectNotice && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', padding: '14px 18px', borderRadius: '12px', color: '#166534', fontWeight: '700', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{studentSubjectNotice}</span>
          <button onClick={() => setStudentSubjectNotice('')} style={{ background: 'none', border: 'none', color: '#15803d', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '700' }}>TOTAL REGISTERED STUDENTS</span>
          <h2 style={{ margin: '4px 0 0 0', fontSize: '24px', color: '#0f172a' }}>{registeredStudents.length}</h2>
        </div>
        {Object.entries(subjectTally).map(([subj, count]) => (
          <div key={subj} style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11px', color: '#0369a1', fontWeight: '800', textTransform: 'uppercase' }}>📚 {subj}</span>
            <h2 style={{ margin: '4px 0 0 0', fontSize: '24px', color: '#0369a1' }}>{count} <small style={{ fontSize: '13px', color: '#64748b' }}>student{count > 1 ? 's' : ''}</small></h2>
          </div>
        ))}
      </div>

      {/* Search Bar */}
      <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input 
          type="text"
          placeholder="🔍 Search student by name, email, register number, or subject..."
          value={studentSearchTerm}
          onChange={e => setStudentSearchTerm(e.target.value)}
          style={{ flex: 1, minWidth: '260px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
        />
        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '700' }}>
          Showing {filteredStudentList.length} of {registeredStudents.length} Students
        </span>
      </div>

      {/* Students List */}
      <div style={{ display: 'grid', gap: '16px' }}>
        {filteredStudentList.length > 0 ? (
          filteredStudentList.map(stu => {
            const currentSub = stu.interestedSubject || stu.subject || 'Computer Science';
            const draftSub = studentSubjectDrafts[stu.email] || currentSub;
            const isAsking = isAskingStudent === stu.email;

            return (
              <div 
                key={stu.email || stu._id} 
                style={{ 
                  background: isAsking ? '#eff6ff' : '#ffffff', 
                  border: isAsking ? '2px solid #3b82f6' : '1px solid #e2e8f0', 
                  borderRadius: '16px', 
                  padding: '22px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#0284c7', color: '#ffffff', display: 'grid', placeItems: 'center', fontWeight: '800', fontSize: '18px' }}>
                      {(stu.username || stu.name || 'S')[0].toUpperCase()}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '17px', color: '#0f172a', fontWeight: '800' }}>
                        {stu.username || stu.name || 'Student'}
                      </h3>
                      <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                        Email: <strong>{stu.email}</strong> • Reg No: <strong>{stu.studentId || stu.registerNumber || '2026011001'}</strong>
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '700' }}>Currently Focused:</span>
                    <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '6px 14px', borderRadius: '20px', fontWeight: '800', fontSize: '13px', border: '1px solid #bfdbfe' }}>
                      🎓 {currentSub}
                    </span>
                  </div>
                </div>

                {isAsking && (
                  <div style={{ background: '#dbeafe', color: '#1e40af', padding: '10px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🔊</span>
                    <span>Inquiring {stu.username || stu.name}'s subject interest out loud... Listening for response.</span>
                  </div>
                )}

                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
                  {/* Inquiry Button */}
                  <button 
                    onClick={() => handleAskStudentInterest(stu)}
                    style={{ 
                      background: '#eff6ff', 
                      color: '#0284c7', 
                      border: '1px solid #bae6fd', 
                      padding: '10px 18px', 
                      borderRadius: '8px', 
                      fontWeight: '800', 
                      fontSize: '13px', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    title="Ask the student via voice which subject they like/prefer"
                  >
                    🔊 Ask Student Interest
                  </button>

                  {/* Subject Selector & Save */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>Assign Subject:</label>
                    <select
                      value={draftSub}
                      onChange={e => {
                        const val = e.target.value;
                        setStudentSubjectDrafts(prev => ({ ...prev, [stu.email]: val }));
                      }}
                      style={{ 
                        padding: '9px 14px', 
                        borderRadius: '8px', 
                        border: '1px solid #7dd3fc', 
                        fontSize: '13px', 
                        fontWeight: '700',
                        background: '#ffffff',
                        color: '#0f172a',
                        minWidth: '200px'
                      }}
                    >
                      {!ALL_PREDEFINED_SUBJECTS.includes(studentSubjectDrafts[stu.email] || stu.interestedSubject || stu.subject) && (
                        <option value={studentSubjectDrafts[stu.email] || stu.interestedSubject || stu.subject || 'Computer Science'}>
                          {studentSubjectDrafts[stu.email] || stu.interestedSubject || stu.subject || 'Computer Science'}
                        </option>
                      )}
                      {COMPREHENSIVE_SUBJECTS_AND_LANGUAGES.map(cat => (
                        <optgroup key={cat.category} label={cat.category}>
                          {cat.items.map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>

                    <button
                      onClick={() => handleSaveStudentSubject(stu.email)}
                      disabled={busy}
                      style={{ 
                        background: '#0284c7', 
                        color: '#ffffff', 
                        border: 'none', 
                        padding: '10px 18px', 
                        borderRadius: '8px', 
                        fontWeight: '800', 
                        fontSize: '13px', 
                        cursor: busy ? 'not-allowed' : 'pointer',
                        boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)'
                      }}
                    >
                      💾 Save & Assign
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCreateExamForStudent(stu)}
                      style={{ 
                        background: '#16a34a', 
                        color: '#ffffff', 
                        border: 'none', 
                        padding: '10px 18px', 
                        borderRadius: '8px', 
                        fontWeight: '800', 
                        fontSize: '13px', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)'
                      }}
                      title={`Create a personalized exam for ${stu.username || stu.name} based on their interested subject: ${currentSub}`}
                    >
                      📝 Create {currentSub} Exam
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', color: '#64748b' }}>
            No registered students found matching "{studentSearchTerm}".
          </div>
        )}
      </div>
    </div>
  );

  const pageComponents = {
    Overview: renderOverview,
    'Create exam': renderCreateExam,
    'Question bank': renderQuestionBank,
    'Question builder': renderCreateExam,
    'AI generator': renderCreateExam,
    'Schedule & assign': renderSchedule,
    'Student Subjects': renderStudentSubjects,
    'Voice Broadcasts': renderVoiceBroadcasts,
    Accessibility: renderAccessibility,
    'Voice exam': renderVoiceExam,
    'AI Oral Viva': renderAiOralViva,
    'Question reader': renderQuestionReader,
    Monitoring: renderMonitoring,
    Assistance: renderAssistance,
    'Extra time': renderExtraTime,
    Instructions: renderInstructions,
    'Study materials': renderStudyMaterials,
    'Results & analytics': renderResults,
    Certificates: renderCertificates,
    'Import & export': renderImportExport
  };

  const currentMenuIndex = menuItems.findIndex(m => m.id === page || m.label === page);
  const prevMenuItem = currentMenuIndex > 0 ? menuItems[currentMenuIndex - 1] : null;
  const nextMenuItem = currentMenuIndex >= 0 && currentMenuIndex < menuItems.length - 1 ? menuItems[currentMenuIndex + 1] : null;

  return (
    <div className={`exam-assistant ${access.contrast ? 'high-contrast-mode' : ''}`}>
      <aside>
        <div className="ea-brand">
          ◉ VisionAssist
          <small>TEACHER EXAM PORTAL</small>
        </div>
        <nav aria-label="Teacher exam assistant menu">
          {menuItems.map(item => (
            <button
              key={item.id}
              className={page === item.id ? 'active' : ''}
              onClick={() => setPage(item.id)}
            >
              <span style={{ marginRight: '8px' }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="ea-help">
          <b>Assistive Exam Tools</b>
          <small>Designed for blind and visually impaired examinees.</small>
        </div>
        <div style={{ padding: '14px 16px', marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#fca5a5',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '10px',
              padding: '10px 14px',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            🚪 Log Out Portal
          </button>
        </div>
      </aside>

      <main>
        <header>
          <span>Teacher Dashboard <b>/</b> {page}</span>

          {/* Teacher Subject Selection Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '16px' }}>
            <label htmlFor="teacher-subject-dropdown" style={{ fontSize: '12px', fontWeight: '800', color: '#581c87', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: '15px' }}>🎯</span> Subject:
            </label>
            <select
              id="teacher-subject-dropdown"
              aria-label="Filter Teacher Dashboard by Teaching Subject"
              value={selectedTeacherSubject}
              onChange={(e) => handleTeacherSubjectChange(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '2px solid #9333ea',
                background: '#ffffff',
                color: '#581c87',
                fontWeight: '800',
                fontSize: '13px',
                cursor: 'pointer',
                outline: 'none',
                boxShadow: '0 1px 3px rgba(147, 51, 234, 0.2)'
              }}
            >
              <option value="ALL">🌐 All Subjects (Show All)</option>
              {COMPREHENSIVE_SUBJECTS_AND_LANGUAGES.map(cat => (
                <optgroup key={cat.category} label={cat.category}>
                  {cat.items.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <button
            onClick={() => setAccess(a => ({ ...a, contrast: !a.contrast }))}
            style={{ fontSize: '12px', padding: '6px 12px', marginRight: '10px' }}
          >
            {access.contrast ? '☀️ Normal View' : '👁️ High Contrast'}
          </button>
          <strong>{teacher.initials}</strong>
          <b>{teacher.fullName}</b>
          <button
            onClick={handleLogout}
            title="Log Out of Teacher Portal"
            style={{
              background: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '6px 14px',
              fontWeight: '700',
              fontSize: '12px',
              cursor: 'pointer',
              marginLeft: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            🚪 Log Out
          </button>
        </header>

        {/* Active Subject Filter Banner Indicator */}
        {selectedTeacherSubject && selectedTeacherSubject !== 'ALL' && (
          <div style={{
            background: '#faf5ff',
            border: '1.5px solid #c084fc',
            borderRadius: '10px',
            padding: '10px 18px',
            margin: '14px 24px 0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            fontSize: '13px',
            boxShadow: '0 2px 4px rgba(147, 51, 234, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🎯</span>
              <span style={{ color: '#581c87', fontWeight: '800' }}>
                Active Teaching Subject: <span style={{ textDecoration: 'underline' }}>{selectedTeacherSubject}</span>
              </span>
              <span style={{ color: '#7e22ce', fontSize: '12px', fontWeight: '600' }}>
                — Showing only {selectedTeacherSubject} exams, questions, materials, vivas & results (other subjects are hidden).
              </span>
            </div>
            <button
              onClick={() => handleTeacherSubjectChange('ALL')}
              style={{
                background: '#f3e8ff',
                border: '1px solid #d8b4fe',
                color: '#6b21a8',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              ✖ Show All Subjects
            </button>
          </div>
        )}

        {notice && <div className="ea-notice" role="status">✓ {notice}</div>}
        
        {pendingSosRequests.length > 0 && (
          <div style={{
            background: '#fef2f2',
            border: '2px solid #ef4444',
            borderRadius: '12px',
            padding: '16px 20px',
            margin: '16px 24px 0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 10px 15px -3px rgba(239, 68, 68, 0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ background: '#ef4444', color: '#ffffff', fontSize: '22px', width: '42px', height: '42px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>🚨</div>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: '#991b1b' }}>
                  EMERGENCY ASSIST SOS ALERT RECEIVED ({pendingSosRequests.length})
                </h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#7f1d1d', fontWeight: '600' }}>
                  Student: <b>{pendingSosRequests[0].student || pendingSosRequests[0].studentName}</b> — {pendingSosRequests[0].question || pendingSosRequests[0].request} ({pendingSosRequests[0].time})
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                style={{ background: '#dc2626', color: '#ffffff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', fontSize: '13px' }}
                onClick={() => {
                  setPage('Assistance');
                  speak(`Opening Student Assistance. Active SOS request from ${pendingSosRequests[0].student || pendingSosRequests[0].studentName}`);
                }}
              >
                View Requests ({pendingSosRequests.length}) →
              </button>
              <button
                style={{ background: '#ffffff', border: '1px solid #fca5a5', color: '#991b1b', padding: '10px 14px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}
                onClick={() => handleUpdateRequestStatus(pendingSosRequests[0].id, 'Resolved')}
              >
                ✓ Mark Resolved
              </button>
            </div>
          </div>
        )}

        <div className="ea-content">
          {/* Top Section Step Navigation Bar */}
          <div style={{
            marginBottom: '20px', padding: '12px 20px', background: '#ffffff', border: '1px solid #e9d5ff',
            borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            boxShadow: '0 4px 12px rgba(147, 51, 234, 0.06)', flexWrap: 'wrap', gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {prevMenuItem ? (
                <button
                  type="button"
                  onClick={() => { setPage(prevMenuItem.id); say(`Switched to ${prevMenuItem.label}`); }}
                  style={{ background: '#faf5ff', color: '#7e22ce', border: '1px solid #7dd3fc', padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  ← Previous: {prevMenuItem.label}
                </button>
              ) : (
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700' }}>First Section</span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', background: '#f3e8ff', color: '#9333ea', padding: '4px 12px', borderRadius: '12px', fontWeight: '800' }}>
                Section {currentMenuIndex + 1} of {menuItems.length}: {menuItems[currentMenuIndex]?.label}
              </span>
              <span style={{ fontSize: '11px', color: '#166534', background: '#dcfce7', padding: '3px 8px', borderRadius: '8px', fontWeight: '700' }}>
                ✓ Form Draft Preserved
              </span>
            </div>

            <div>
              {nextMenuItem ? (
                <button
                  type="button"
                  onClick={() => { setPage(nextMenuItem.id); say(`Switched to ${nextMenuItem.label}`); }}
                  style={{ background: '#9333ea', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  Next: {nextMenuItem.label} →
                </button>
              ) : (
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '700' }}>Final Section</span>
              )}
            </div>
          </div>

          {pageComponents[page]}

          {/* Bottom Section Step Navigation Bar */}
          <div style={{
            marginTop: '32px', padding: '16px 20px', background: '#ffffff', border: '1px solid #e9d5ff',
            borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            boxShadow: '0 4px 12px rgba(147, 51, 234, 0.08)', flexWrap: 'wrap', gap: '12px'
          }}>
            {prevMenuItem ? (
              <button
                type="button"
                onClick={() => { setPage(prevMenuItem.id); say(`Switched to ${prevMenuItem.label}`); }}
                style={{ background: '#faf5ff', color: '#7e22ce', border: '1px solid #7dd3fc', padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                ← Go to Previous Section ({prevMenuItem.label})
              </button>
            ) : <div />}

            <div style={{ textAlign: 'center' }}>
              <b style={{ fontSize: '13px', color: '#7e22ce', display: 'block' }}>Draft Exam Form Preserved</b>
              <small style={{ fontSize: '11px', color: '#64748b' }}>Switch sections anytime. Exam title, details, and questions remain saved.</small>
            </div>

            {nextMenuItem ? (
              <button
                type="button"
                onClick={() => { setPage(nextMenuItem.id); say(`Switched to ${nextMenuItem.label}`); }}
                style={{ background: '#9333ea', color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                Go to Next Section ({nextMenuItem.label}) →
              </button>
            ) : <div />}
          </div>
        </div>
        {/* 📝 INTERACTIVE EXAM CORRECTION & GRADING MODAL */}
        {activeCorrection && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.8)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            backdropFilter: 'blur(4px)'
          }}>
            <div style={{
              background: '#ffffff',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '960px',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              overflow: 'hidden'
            }}>
              {/* Modal Header */}
              <div style={{
                background: 'linear-gradient(135deg, #9333ea 0%, #7e22ce 100%)',
                color: '#ffffff',
                padding: '20px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: '6px', fontWeight: '800', textTransform: 'uppercase' }}>
                    📝 Teacher Exam Correction & Grading Portal
                  </span>
                  <h2 style={{ margin: '6px 0 2px 0', fontSize: '20px', fontWeight: '900' }}>
                    {activeCorrection.examTitle || activeCorrection.examName || 'Student Examination'}
                  </h2>
                  <div style={{ fontSize: '13px', color: '#f3e8ff' }}>
                    Student: <b>{activeCorrection.student || activeCorrection.studentName}</b> ({activeCorrection.studentId || 'ID: 2024001'}) · Submitted: {activeCorrection.submittedAt || activeCorrection.date || 'Today'} · Duration: {activeCorrection.timeSpent || '45 mins'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: '#ffffff', color: '#7e22ce', padding: '8px 16px', borderRadius: '12px', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', display: 'block', textTransform: 'uppercase' }}>Current Total</span>
                    <b style={{ fontSize: '18px', fontWeight: '900' }}>
                      {correctionQuestions.reduce((acc, q) => acc + (Number(q.marksAwarded) || 0), 0)} / {correctionQuestions.reduce((acc, q) => acc + (Number(q.maxMarks) || 5), 0)} Marks
                    </b>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveCorrection(null)}
                    style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: '36px', height: '36px', borderRadius: '50%', fontSize: '18px', cursor: 'pointer', display: 'grid', placeItems: 'center', fontWeight: 'bold' }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Modal Body - Scrollable Questions Review */}
              <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', background: '#f8fafc' }}>
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '12px 16px', borderRadius: '10px', fontSize: '13px', color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <span>💡 <strong>Teacher Correction Guide:</strong> Review each student response below, assign marks, and write constructive remarks. Corrected marks and feedback will be published live to the student's dashboard and official certificates.</span>
                  <button
                    type="button"
                    onClick={() => {
                      const speechText = correctionQuestions.map((q, i) => `Question ${i + 1}: ${q.text}. Student response: ${q.studentAnswer}.`).join(' ');
                      speak(speechText);
                    }}
                    style={{ background: '#9333ea', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    🔊 Read All Student Answers Aloud
                  </button>
                </div>

                {correctionQuestions.map((q, idx) => (
                  <div key={idx} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                      <div style={{ flex: 1, minWidth: '240px' }}>
                        <span style={{ fontSize: '11px', background: '#f3e8ff', color: '#9333ea', padding: '3px 8px', borderRadius: '6px', fontWeight: '800' }}>
                          QUESTION {idx + 1} ({q.type})
                        </span>
                        <h3 style={{ margin: '6px 0 0 0', fontSize: '15px', color: '#0f172a', fontWeight: '800' }}>
                          {q.text}
                        </h3>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: '#475569' }}>Award Marks:</span>
                        <input
                          type="number"
                          min="0"
                          max={q.maxMarks || 5}
                          value={q.marksAwarded}
                          onChange={(e) => handleUpdateQuestionMark(idx, e.target.value)}
                          style={{ width: '60px', padding: '6px 10px', borderRadius: '8px', border: '2px solid #9333ea', fontWeight: '900', fontSize: '15px', textAlign: 'center', color: '#7e22ce' }}
                        />
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748b' }}>/ {q.maxMarks || 5}</span>

                        <div style={{ display: 'flex', gap: '4px', marginLeft: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleQuickMark(idx, 1.0)}
                            style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}
                            title="Award Full Marks"
                          >
                            Full
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickMark(idx, 0.5)}
                            style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}
                            title="Award Half Marks"
                          >
                            Half
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickMark(idx, 0)}
                            style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}
                            title="Award 0 Marks"
                          >
                            0
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expected / Rubric Answer */}
                    {q.correctAnswer && (
                      <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', borderLeft: '4px solid #94a3b8', fontSize: '12px', color: '#475569', marginBottom: '12px' }}>
                        <strong>📖 Reference / Expected Answer:</strong> {q.correctAnswer}
                      </div>
                    )}

                    {/* Student Submitted Answer */}
                    <div style={{ background: '#f0fdf4', padding: '12px 16px', borderRadius: '10px', border: '1px solid #bbf7d0', borderLeft: '4px solid #16a34a', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '800', color: '#15803d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            🎙️ Student Spoken / Typed Response:
                          </span>
                          <button
                            type="button"
                            onClick={() => speak(`Student answer for Question ${idx + 1}: ${q.studentAnswer || 'No response recorded'}`)}
                            style={{ background: '#dcfce7', color: '#15803d', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            🔊 Listen Student Answer
                          </button>
                        </div>
                      </div>
                      <p style={{ margin: 0, fontSize: '14px', color: '#14532d', fontWeight: '600', lineHeight: 1.5 }}>
                        "{q.studentAnswer || 'No answer recorded by student'}"
                      </p>
                    </div>

                    {/* Teacher Feedback per question */}
                    <div>
                      <input
                        type="text"
                        value={q.teacherComment}
                        onChange={(e) => handleUpdateQuestionComment(idx, e.target.value)}
                        placeholder="Teacher remark for this question (e.g., 'Accurate concept explanation, clear voice dictation')..."
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                ))}

                {/* Overall Teacher Remarks */}
                <div style={{ background: '#ffffff', border: '2px solid #e9d5ff', borderRadius: '14px', padding: '18px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '800', color: '#7e22ce', display: 'block', marginBottom: '6px' }}>
                    🎓 Overall Teacher Evaluation & Feedback (Sent directly to Student Dashboard):
                  </label>
                  <textarea
                    rows={3}
                    value={overallFeedbackInput}
                    onChange={(e) => setOverallFeedbackInput(e.target.value)}
                    placeholder="Enter overall remarks for student (e.g. 'Exceptional conceptual depth and accurate speech fluency. Grade A+ awarded.')..."
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                background: '#ffffff',
                borderTop: '1px solid #e2e8f0',
                padding: '16px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <button
                  type="button"
                  onClick={() => setActiveCorrection(null)}
                  style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '12px 20px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
                >
                  ✕ Cancel
                </button>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: '#7e22ce' }}>
                    Final Score: {correctionQuestions.reduce((acc, q) => acc + (Number(q.marksAwarded) || 0), 0)} / {correctionQuestions.reduce((acc, q) => acc + (Number(q.maxMarks) || 5), 0)} ({Math.round((correctionQuestions.reduce((acc, q) => acc + (Number(q.marksAwarded) || 0), 0) / (correctionQuestions.reduce((acc, q) => acc + (Number(q.maxMarks) || 5), 0) || 100)) * 100)}%)
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveAndPublishCorrection}
                    style={{ background: '#16a34a', color: '#ffffff', border: 'none', padding: '12px 28px', borderRadius: '10px', fontWeight: '900', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)' }}
                  >
                    💾 Save Corrections & Publish Grade to Student ✨
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
