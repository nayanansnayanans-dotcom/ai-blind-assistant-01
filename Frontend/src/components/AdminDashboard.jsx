import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, UserCheck, GraduationCap, FileText, Bot, Accessibility, BookOpen, 
  BarChart3, Bell, ShieldCheck, Settings, Plus, Edit, Trash2, Search, 
  CheckCircle2, AlertTriangle, Volume2, Lock, Unlock, Clock, Calendar, 
  ArrowRight, Download, RefreshCw, Radio, Database, Activity, Check, Eye, 
  Mail, Key, Upload, Play, HelpCircle, LogOut, Phone, Shield, Filter, RotateCcw,
  Sliders, Cpu, Camera, Globe, Save
} from 'lucide-react';
import { 
  fetchAssistanceRequests, updateAssistanceRequest, fetchRegisteredStudents, 
  fetchRegisteredTeachers, fetchContactMessagesApi, updateContactMessageStatusApi, 
  deleteContactMessageApi 
} from '../services/api';
const speakIn = () => {};
const cancelSpeech = () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); };
import ProjectLogo from './ProjectLogo.jsx';

export default function AdminDashboard() {
  const navigate = useNavigate();

  // Strict role validation
  useEffect(() => {
    try {
      const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
      const sessionRole = (session.role || '').toLowerCase();
      if (sessionRole && sessionRole !== 'admin') {
        if (sessionRole === 'student') navigate('/student-dashboard');
        else if (sessionRole === 'teacher') navigate('/teacher-dashboard');
        else navigate('/admin-login');
      }
    } catch (e) {}
  }, [navigate]);

  // Navigation State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const [currentDate, setCurrentDate] = useState(new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));

  // Dynamic Students and Teachers State (Real registered and logged in users)
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentFilter, setStudentFilter] = useState('all'); // 'all' | 'logged_in' | 'registered'
  const [teacherSearch, setTeacherSearch] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('all'); // 'all' | 'logged_in' | 'registered'
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Modals & Active Selections (Exams, Announcements, System Settings)
  const [showExamModal, setShowExamModal] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [examForm, setExamForm] = useState({ title: '', subject: 'Computer Networks', duration: '45 mins', date: '2026-09-28', time: '10:00 AM', status: 'Scheduled', studentsCount: 150 });

  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '', priority: 'High', target: 'All' });

  // System Settings Hub State
  const [systemSettings, setSystemSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('system_platform_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      institutionName: 'VisionAssist AI Academy',
      academicTerm: '2026 - Fall Academic Session',
      adminSupportEmail: 'admin@visionassist.edu',
      emergencyPhone: '+91 98765 43210',
      systemTimezone: 'Asia/Kolkata (UTC+05:30)',
      ttsEngine: 'Browser Speech Synthesis (Local & Fast)',
      speechRate: 1.0,
      speechPitch: 1.0,
      wakeWordEnabled: true,
      audioChimeEnabled: true,
      autoNarrationOnScreenChange: true,
      webcamFaceVerification: true,
      multiplePersonWarningLimit: '2 Warnings (Auto-Exit on 3rd)',
      faceAbsenceToleranceSec: 5,
      autoReportIntrusions: true,
      fullscreenEnforcement: true,
      studentPasswordPolicy: 'Alphanumeric Only (A-Z, 0-9)',
      otpExpiryMinutes: 10,
      maxFailedAttempts: 5,
      sessionInactivityTimeout: '60 Minutes',
      concurrentSessions: 'Single Active Session Only',
      defaultTheme: 'High Contrast (Amber & Dark Navy)',
      baseFontSize: 'Medium (16px)',
      ariaAssertiveness: 'Polite Live Regions',
      tapAnywhereGuide: true
    };
  });
  const [settingsSavedToast, setSettingsSavedToast] = useState(false);
  const [settingsResetToast, setSettingsResetToast] = useState(false);

  const [resetPassModal, setResetPassModal] = useState(null);
  const [newGeneratedPass, setNewGeneratedPass] = useState('');

  // Loader for real registered & logged-in students and teachers
  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const [stuList, tchList] = await Promise.all([
        fetchRegisteredStudents(),
        fetchRegisteredTeachers()
      ]);

      const activeSession = JSON.parse(localStorage.getItem('auth_session') || '{}');
      const loggedMap = JSON.parse(localStorage.getItem('logged_in_users') || '{}');
      const activeEmail = (activeSession.email || '').toLowerCase().trim();

      const enhancedStudents = (stuList || []).map((s, idx) => {
        const email = (s.email || '').toLowerCase().trim();
        const loggedRecord = loggedMap[email];
        const isOnline = (activeEmail === email && activeSession.role === 'student') || (loggedRecord && loggedRecord.status === 'online');
        return {
          ...s,
          id: s._id || s.id || `stu_${idx}`,
          name: s.name || s.username || email.split('@')[0],
          email,
          studentId: s.studentId || s.registerNumber || `202601100${idx + 1}`,
          course: s.course || s.classCourse || 'Computer Science',
          subject: s.subject || s.interestedSubject || 'Computer Science',
          status: s.status || 'Active',
          accessibility: s.accessibility || 'Voice Assistant + High Contrast',
          phone: s.phone || '9876543210',
          isLoggedIn: Boolean(isOnline),
          lastLogin: isOnline ? 'Online Now' : (loggedRecord?.loginTime ? new Date(loggedRecord.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : 'Offline')
        };
      });

      const enhancedTeachers = (tchList || []).map((t, idx) => {
        const email = (t.email || '').toLowerCase().trim();
        const loggedRecord = loggedMap[email];
        const isOnline = (activeEmail === email && activeSession.role === 'teacher') || (loggedRecord && loggedRecord.status === 'online');
        return {
          ...t,
          id: t._id || t.id || `tch_${idx}`,
          name: t.name || t.username || email.split('@')[0],
          email,
          subject: t.subject || 'Computer Science',
          assignedClass: t.assignedClass || 'CS Department',
          phone: t.phone || '9876543210',
          status: t.status || 'Active',
          activity: t.activity || 'Verified Faculty Member',
          isLoggedIn: Boolean(isOnline),
          lastLogin: isOnline ? 'Online Now' : (loggedRecord?.loginTime ? new Date(loggedRecord.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : 'Offline')
        };
      });

      setStudents(enhancedStudents);
      setTeachers(enhancedTeachers);
    } catch (err) {
      console.error('Failed to load registered users in admin dashboard:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadUsers();
    // Optional periodic refresh to detect newly logged in users
    const pollInterval = setInterval(loadUsers, 15000);
    return () => clearInterval(pollInterval);
  }, []);

  // Update clock and date every minute
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setCurrentDate(now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // 3. DATA STORE: EXAMS
  const initialExams = [
    { id: 'ex_1', title: 'Computer Networks Theory', subject: 'Computer Networks', date: new Date(Date.now() + 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), time: '10:00 AM', duration: '45 mins', studentsCount: 150, status: 'Scheduled' },
    { id: 'ex_2', title: 'Operating Systems & Deadlocks', subject: 'Operating Systems', date: new Date(Date.now() + 2 * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), time: '11:00 AM', duration: '60 mins', studentsCount: 120, status: 'Scheduled' },
    { id: 'ex_3', title: 'Cyber Security & Cryptography', subject: 'Cyber Security', date: new Date(Date.now() + 3 * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), time: '02:00 PM', duration: '30 mins', studentsCount: 100, status: 'Scheduled' },
    { id: 'ex_4', title: 'AI & Machine Learning Foundations', subject: 'Artificial Intelligence', date: new Date(Date.now() + 5 * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), time: '10:00 AM', duration: '45 mins', studentsCount: 95, status: 'Scheduled' }
  ];

  const [exams, setExams] = useState(() => {
    const saved = localStorage.getItem('shared_exams');
    return saved ? JSON.parse(saved) : initialExams;
  });

  useEffect(() => {
    localStorage.setItem('shared_exams', JSON.stringify(exams));
  }, [exams]);

  // 5. DATA STORE: ANNOUNCEMENTS
  const initialAnnouncements = [
    { id: 1, title: 'Upcoming Computer Networks Theory Exam', message: 'All students verify high-contrast accessibility settings before Sep 28.', priority: 'High', target: 'Students', date: 'Today, 09:30 AM' },
    { id: 2, title: 'VisionAssist AI Voice Assistant Upgrade', message: 'TTS engine enhanced with improved Indian & British speech accents.', priority: 'Medium', target: 'All', date: 'Yesterday, 04:15 PM' }
  ];

  const [announcements, setAnnouncements] = useState(() => {
    const saved = localStorage.getItem('shared_announcements');
    return saved ? JSON.parse(saved) : initialAnnouncements;
  });

  useEffect(() => {
    localStorage.setItem('shared_announcements', JSON.stringify(announcements));
  }, [announcements]);

  // 6. ACCESSIBILITY CONFIG STATE
  const [accessConfig, setAccessConfig] = useState({
    screenReader: true,
    voiceNavigation: true,
    fontSize: 'Medium (16px)',
    contrastMode: 'High Contrast (Default)',
    keyboardNav: true,
    speechSpeed: 1.0,
    voiceLang: 'en-US'
  });

  // 8. EMERGENCY ASSISTANCE / SOS REQUESTS STORE
  const [assistanceRequests, setAssistanceRequests] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const syncAssistance = () => {
      fetchAssistanceRequests()
        .then(data => {
          if (isMounted && Array.isArray(data) && data.length > 0) {
            setAssistanceRequests(prev => {
              const existingMap = new Map(prev.map(p => [String(p.id), p]));
              data.forEach(item => {
                existingMap.set(String(item.id || item._id), {
                  id: item.id || item._id,
                  studentName: item.studentName || item.student || 'Student',
                  examTitle: item.request || item.examTitle || 'Emergency SOS',
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

      const raw = localStorage.getItem('shared_assistance_requests');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAssistanceRequests(prev => {
              const existingMap = new Map(prev.map(p => [String(p.id), p]));
              parsed.forEach(p => {
                existingMap.set(String(p.id), {
                  id: p.id,
                  studentName: p.studentName || p.student || 'Student',
                  examTitle: p.request || p.examTitle || 'Emergency SOS',
                  time: p.time || 'Just now',
                  type: p.type || 'Emergency SOS',
                  status: p.status || 'Pending'
                });
              });
              return Array.from(existingMap.values());
            });
          }
        } catch (e) {}
      }
    };

    const handleSosEvent = (e) => {
      syncAssistance();
      if (e.detail) {
        speakIn(`Emergency SOS Alert triggered by ${e.detail.studentName || e.detail.student}`);
      }
    };

    cancelSpeech();
    window.isVoiceAssistantActive = false;
    syncAssistance();
    window.addEventListener('storage', syncAssistance);
    window.addEventListener('sos_alert', handleSosEvent);
    const timer = setInterval(syncAssistance, 2000);

    return () => {
      isMounted = false;
      window.removeEventListener('storage', syncAssistance);
      window.removeEventListener('sos_alert', handleSosEvent);
      clearInterval(timer);
    };
  }, []);

  const handleResolveSos = (id) => {
    setAssistanceRequests(all => all.map(r => String(r.id) === String(id) ? { ...r, status: 'Resolved' } : r));
    try {
      const raw = JSON.parse(localStorage.getItem('shared_assistance_requests') || '[]');
      const updated = raw.map(r => String(r.id) === String(id) ? { ...r, status: 'Resolved' } : r);
      localStorage.setItem('shared_assistance_requests', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {}
    updateAssistanceRequest(id, 'Resolved').catch(() => {});
    speakIn('Emergency SOS request marked as resolved.');
  };

  // 9. CONTACT US / SUPPORT INQUIRIES STORE
  const [contactMessages, setContactMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('shared_contact_messages');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
      {
        id: 'msg_sample_1',
        name: 'Nayana N S',
        email: 'nayana@gmail.com',
        role: 'Student',
        subject: 'Accessibility Feature Request',
        message: 'Hello Support, the voice assistant and high-contrast features are working great. Can we also have an option to customize narration rate during mock tests?',
        status: 'Unread',
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        time: '08:30 AM'
      }
    ];
  });
  const [contactSearch, setContactSearch] = useState('');
  const [contactFilter, setContactFilter] = useState('all'); // 'all' | 'unread' | 'in_review' | 'resolved'
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const loadContactMessages = async () => {
    setIsLoadingMessages(true);
    try {
      const list = await fetchContactMessagesApi();
      if (Array.isArray(list) && list.length > 0) {
        setContactMessages(list);
      }
    } catch (e) {
      console.warn('Error loading contact messages in admin:', e);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    loadContactMessages();
    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem('shared_contact_messages');
        if (saved) setContactMessages(JSON.parse(saved));
      } catch (e) {}
    };
    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(loadContactMessages, 8000);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const handleUpdateMessageStatus = async (id, newStatus) => {
    setContactMessages(prev => prev.map(m => (String(m.id) === String(id) || String(m._id) === String(id)) ? { ...m, status: newStatus } : m));
    await updateContactMessageStatusApi(id, newStatus);
    speakIn(`Message marked as ${newStatus}`);
  };

  const handleDeleteMessage = async (id, name) => {
    if (window.confirm(`Delete support inquiry from ${name}?`)) {
      setContactMessages(prev => prev.filter(m => String(m.id) !== String(id) && String(m._id) !== String(id)));
      await deleteContactMessageApi(id);
      speakIn(`Inquiry from ${name} deleted.`);
    }
  };

  const unreadMessagesCount = contactMessages.filter(m => (m.status || 'Unread').toLowerCase() === 'unread').length;

  const filteredMessages = contactMessages.filter(msg => {
    const status = (msg.status || 'Unread').toLowerCase();
    const matchesFilter =
      contactFilter === 'all' ? true :
      contactFilter === 'unread' ? status === 'unread' :
      contactFilter === 'in_review' ? (status === 'in review' || status === 'in_review') :
      status === 'resolved';

    const query = contactSearch.toLowerCase().trim();
    if (!query) return matchesFilter;

    const matchesSearch =
      (msg.name || '').toLowerCase().includes(query) ||
      (msg.email || '').toLowerCase().includes(query) ||
      (msg.role || '').toLowerCase().includes(query) ||
      (msg.subject || '').toLowerCase().includes(query) ||
      (msg.message || '').toLowerCase().includes(query);

    return matchesFilter && matchesSearch;
  });

  // Global Logout
  const handleLogout = () => {
    cancelSpeech();
    localStorage.removeItem('auth_session');
    speakIn('Logged out from Administrator Dashboard.');
    navigate('/login');
  };



  // STUDENT DIRECTORY HANDLERS
  const handleDeleteStudent = (id, name, email) => {
    if (window.confirm(`Delete student record for ${name}?`)) {
      setStudents(prev => prev.filter(s => s.id !== id));
      try {
        const cleanEmail = (email || '').toLowerCase().trim();
        const accounts = JSON.parse(localStorage.getItem('registered_accounts') || '{}');
        delete accounts[cleanEmail];
        localStorage.setItem('registered_accounts', JSON.stringify(accounts));

        const profiles = JSON.parse(localStorage.getItem('student_profiles_by_email') || '{}');
        delete profiles[cleanEmail];
        localStorage.setItem('student_profiles_by_email', JSON.stringify(profiles));

        const loggedMap = JSON.parse(localStorage.getItem('logged_in_users') || '{}');
        delete loggedMap[cleanEmail];
        localStorage.setItem('logged_in_users', JSON.stringify(loggedMap));
      } catch (e) {}
      speakIn(`Deleted student ${name}`);
    }
  };

  const handleToggleStudentStatus = (id) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, status: s.status === 'Active' ? 'Deactivated' : 'Active' } : s));
  };

  const handleGenerateResetPassword = (user) => {
    const tempPass = `Pass@${Math.floor(1000 + Math.random() * 9000)}`;
    setResetPassModal({ user, tempPass });
    speakIn(`Temporary password for ${user.name} is ${tempPass}`);
  };

  // TEACHER DIRECTORY HANDLERS
  const handleDeleteTeacher = (id, name, email) => {
    if (window.confirm(`Delete teacher account for ${name}?`)) {
      setTeachers(prev => prev.filter(t => t.id !== id));
      try {
        const cleanEmail = (email || '').toLowerCase().trim();
        const accounts = JSON.parse(localStorage.getItem('registered_accounts') || '{}');
        delete accounts[cleanEmail];
        localStorage.setItem('registered_accounts', JSON.stringify(accounts));

        const stored = JSON.parse(localStorage.getItem('shared_teachers_list') || '[]');
        const updated = stored.filter(t => (t.email || '').toLowerCase().trim() !== cleanEmail);
        localStorage.setItem('shared_teachers_list', JSON.stringify(updated));

        const loggedMap = JSON.parse(localStorage.getItem('logged_in_users') || '{}');
        delete loggedMap[cleanEmail];
        localStorage.setItem('logged_in_users', JSON.stringify(loggedMap));
      } catch (e) {}
      speakIn(`Deleted teacher ${name}`);
    }
  };

  // EXAM MANAGEMENT HANDLERS
  const handleSaveExam = (e) => {
    e.preventDefault();
    if (!examForm.title) return;

    if (editingExam) {
      setExams(exams.map(ex => ex.id === editingExam.id ? { ...ex, ...examForm } : ex));
    } else {
      const newEx = { id: `ex_${Date.now()}`, ...examForm };
      setExams([newEx, ...exams]);
      speakIn(`Created new exam ${examForm.title}`);
    }

    setShowExamModal(false);
    setEditingExam(null);
  };

  const handleDeleteExam = (id, title) => {
    if (window.confirm(`Delete exam ${title}?`)) {
      setExams(exams.filter(ex => ex.id !== id));
      speakIn(`Deleted exam ${title}`);
    }
  };

  // ANNOUNCEMENT HANDLERS
  const handleSaveAnnouncement = (e) => {
    e.preventDefault();
    if (!announcementForm.title) return;

    const newAnn = { id: Date.now(), ...announcementForm, date: 'Just now' };
    setAnnouncements([newAnn, ...announcements]);
    speakIn(`Broadcasted announcement to ${announcementForm.target}`);
    setShowAnnouncementModal(false);
  };

  // SYSTEM SETTINGS HANDLERS
  const handleSaveSystemSettings = (e) => {
    if (e) e.preventDefault();
    localStorage.setItem('system_platform_settings', JSON.stringify(systemSettings));
    setSettingsSavedToast(true);
    speakIn('System settings saved successfully');
    setTimeout(() => setSettingsSavedToast(false), 3500);
  };

  const handleResetSystemSettings = () => {
    if (window.confirm('Reset all system settings to platform defaults?')) {
      const defaultSettings = {
        institutionName: 'VisionAssist AI Academy',
        academicTerm: '2026 - Fall Academic Session',
        adminSupportEmail: 'admin@visionassist.edu',
        emergencyPhone: '+91 98765 43210',
        systemTimezone: 'Asia/Kolkata (UTC+05:30)',
        ttsEngine: 'Browser Speech Synthesis (Local & Fast)',
        speechRate: 1.0,
        speechPitch: 1.0,
        wakeWordEnabled: true,
        audioChimeEnabled: true,
        autoNarrationOnScreenChange: true,
        webcamFaceVerification: true,
        multiplePersonWarningLimit: '2 Warnings (Auto-Exit on 3rd)',
        faceAbsenceToleranceSec: 5,
        autoReportIntrusions: true,
        fullscreenEnforcement: true,
        studentPasswordPolicy: 'Alphanumeric Only (A-Z, 0-9)',
        otpExpiryMinutes: 10,
        maxFailedAttempts: 5,
        sessionInactivityTimeout: '60 Minutes',
        concurrentSessions: 'Single Active Session Only',
        defaultTheme: 'High Contrast (Amber & Dark Navy)',
        baseFontSize: 'Medium (16px)',
        ariaAssertiveness: 'Polite Live Regions',
        tapAnywhereGuide: true
      };
      setSystemSettings(defaultSettings);
      localStorage.setItem('system_platform_settings', JSON.stringify(defaultSettings));
      setSettingsResetToast(true);
      speakIn('System settings restored to defaults');
      setTimeout(() => setSettingsResetToast(false), 3500);
    }
  };

  const handleExportSystemBackup = () => {
    try {
      const backupData = {
        exportTimestamp: new Date().toISOString(),
        platform: 'AI Blind Assistant',
        version: '2.5.0-production',
        registeredAccounts: JSON.parse(localStorage.getItem('registered_accounts') || '{}'),
        studentProfiles: JSON.parse(localStorage.getItem('student_profiles_by_email') || '{}'),
        loggedInUsers: JSON.parse(localStorage.getItem('logged_in_users') || '{}'),
        exams: exams,
        announcements: announcements,
        systemSettings: systemSettings
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `VisionAssist_SystemBackup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      speakIn('Complete system backup downloaded');
      alert('System backup exported successfully as JSON file.');
    } catch (e) {
      alert('Failed to export backup: ' + e.message);
    }
  };

  // Filtered Students Calculation
  const filteredStudents = students.filter(st => {
    const matchesFilter = 
      studentFilter === 'all' ? true :
      studentFilter === 'logged_in' ? st.isLoggedIn :
      !st.isLoggedIn;
    
    const query = studentSearch.toLowerCase().trim();
    if (!query) return matchesFilter;

    const matchesSearch = 
      (st.name || '').toLowerCase().includes(query) ||
      (st.email || '').toLowerCase().includes(query) ||
      (st.studentId || '').toLowerCase().includes(query) ||
      (st.course || '').toLowerCase().includes(query) ||
      (st.subject || '').toLowerCase().includes(query);

    return matchesFilter && matchesSearch;
  });

  // Filtered Teachers Calculation
  const filteredTeachers = teachers.filter(tc => {
    const matchesFilter = 
      teacherFilter === 'all' ? true :
      teacherFilter === 'logged_in' ? tc.isLoggedIn :
      !tc.isLoggedIn;
    
    const query = teacherSearch.toLowerCase().trim();
    if (!query) return matchesFilter;

    const matchesSearch = 
      (tc.name || '').toLowerCase().includes(query) ||
      (tc.email || '').toLowerCase().includes(query) ||
      (tc.subject || '').toLowerCase().includes(query) ||
      (tc.assignedClass || '').toLowerCase().includes(query);

    return matchesFilter && matchesSearch;
  });

  // Sidebar Navigation Items
  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboardIcon },
    { id: 'students', label: 'Students Directory', icon: GraduationCap },
    { id: 'teachers', label: 'Teachers Directory', icon: UserCheck },
    { id: 'exams', label: 'Exam Management', icon: FileText },
    { id: 'messages', label: 'Support & Inquiries', icon: Mail, badge: unreadMessagesCount },
    { id: 'accessibility', label: 'Accessibility Management', icon: Accessibility },
    { id: 'announcements', label: 'Notifications & Announcements', icon: Bell },
    { id: 'security', label: 'Security & User Roles', icon: ShieldCheck },
    { id: 'settings', label: 'System Settings', icon: Settings }
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', system-ui, -apple-system, sans-serif", color: '#0f172a' }}>
      


      {/* LEFT SIDEBAR (Dark Navy #0f172a) */}
      <aside style={{ width: '280px', background: '#0f172a', color: '#f8fafc', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '24px 16px', flexShrink: 0, boxSizing: 'border-box' }}>
        <div>
          {/* Logo Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 12px 24px 12px', borderBottom: '1px solid #1e293b' }}>
            <div style={{ background: '#d97706', width: '42px', height: '42px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Accessibility size={24} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '900', margin: 0, color: '#ffffff', letterSpacing: '-0.3px' }}>AI Blind Assistant</h2>
              <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', letterSpacing: '0.5px' }}>Learn | Take Exams | Build Your Future</span>
            </div>
          </div>

          {/* Navigation Items (11 Modules) */}
          <nav style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {sidebarItems.map(item => {
              const IconComp = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    speakIn(`Opening ${item.label}`);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: isActive ? '#d97706' : 'transparent',
                    color: isActive ? '#ffffff' : '#94a3b8',
                    fontSize: '14px',
                    fontWeight: isActive ? '700' : '600',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <IconComp size={18} color={isActive ? '#ffffff' : '#94a3b8'} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {Boolean(item.badge) && (
                    <span style={{
                      background: '#ef4444',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: '900',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      lineHeight: '1.2'
                    }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Sidebar System Status & Settings Quick Card */}
        <div style={{ background: '#1e293b', padding: '16px', borderRadius: '16px', border: '1px solid #334155', marginTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <div style={{ background: '#0284c7', padding: '8px', borderRadius: '10px' }}>
              <Settings size={20} color="#ffffff" />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#ffffff' }}>System Engine</h4>
              <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Operational • v2.5.0</p>
            </div>
          </div>
          <button 
            onClick={() => {
              setActiveTab('settings');
              speakIn('Opening System Settings Hub');
            }}
            style={{ width: '100%', background: 'rgba(2, 132, 199, 0.2)', border: '1px solid #0284c7', color: '#38bdf8', padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
          >
            Configure Settings
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
        
        {/* TOP NAVBAR */}
        <header style={{ background: '#ffffff', padding: '16px 32px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', margin: 0 }}>Welcome, Administrator</h1>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0', fontWeight: '500' }}>Here's what's happening with your AI Blind Assistant system.</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {/* Date & Time Badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={16} color="#64748b" /> {currentDate}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={16} color="#64748b" /> {currentTime}</span>
            </div>

            {/* Notifications Icon */}
            <button 
              onClick={() => setActiveTab('announcements')}
              style={{ position: 'relative', background: '#f1f5f9', border: 'none', padding: '10px', borderRadius: '50%', cursor: 'pointer' }}
            >
              <Bell size={20} color="#475569" />
              <span style={{ position: 'absolute', top: '2px', right: '2px', background: '#ef4444', color: '#ffffff', fontSize: '10px', fontWeight: '900', width: '16px', height: '16px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>3</span>
            </button>

            {/* Admin Avatar & Logout */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderLeft: '1px solid #e2e8f0', paddingLeft: '16px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#d97706', color: '#ffffff', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: '800', fontSize: '16px' }}>
                A
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>Admin</h4>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Administrator</span>
              </div>
              <button 
                onClick={handleLogout} 
                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px', marginLeft: '8px' }}
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* DASHBOARD BODY CONTAINER */}
        <div style={{ padding: '32px', boxSizing: 'border-box' }}>
          
          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* EMERGENCY ASSIST SOS ALERT BANNER */}
              {assistanceRequests.filter(r => r.status === 'Pending').length > 0 && (
                <div style={{
                  background: '#fef2f2',
                  border: '2px solid #ef4444',
                  borderRadius: '16px',
                  padding: '20px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 10px 20px rgba(239, 68, 68, 0.15)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ background: '#ef4444', color: '#ffffff', width: '46px', height: '46px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '24px', fontWeight: '900' }}>🚨</div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '900', color: '#991b1b' }}>
                        EMERGENCY ASSIST SOS ALERT ({assistanceRequests.filter(r => r.status === 'Pending').length} Pending)
                      </h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#7f1d1d', fontWeight: '600' }}>
                        Student: <b>{assistanceRequests.filter(r => r.status === 'Pending')[0].studentName}</b> — {assistanceRequests.filter(r => r.status === 'Pending')[0].examTitle} ({assistanceRequests.filter(r => r.status === 'Pending')[0].time})
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => handleResolveSos(assistanceRequests.filter(r => r.status === 'Pending')[0].id)}
                      style={{ background: '#dc2626', color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}
                    >
                      ✓ Mark SOS Resolved
                    </button>
                    <button
                      onClick={() => setActiveTab('announcements')}
                      style={{ background: '#ffffff', border: '1px solid #fca5a5', color: '#991b1b', padding: '10px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}
                    >
                      View All Alerts →
                    </button>
                  </div>
                </div>
              )}
              
              {/* TOP 6 METRIC CARDS GRID */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                
                {/* 1. Total Students */}
                <div style={{ background: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '12px' }}><Users size={22} color="#d97706" /></div>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Total Students</span>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', margin: '0 0 4px 0' }}>{students.length}</div>
                  <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: '700' }}>🟢 {students.filter(s => s.isLoggedIn).length} Logged In Now</span>
                </div>

                {/* 2. Total Teachers */}
                <div style={{ background: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ background: '#faf5ff', padding: '10px', borderRadius: '12px' }}><UserCheck size={22} color="#9333ea" /></div>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Total Teachers</span>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', margin: '0 0 4px 0' }}>{teachers.length}</div>
                  <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: '700' }}>🟢 {teachers.filter(t => t.isLoggedIn).length} Logged In Now</span>
                </div>

                {/* 3. Total Exams */}
                <div style={{ background: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ background: '#f0fdf4', padding: '10px', borderRadius: '12px' }}><FileText size={22} color="#16a34a" /></div>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Total Exams</span>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', margin: '0 0 4px 0' }}>{exams.length}</div>
                  <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: '700' }}>↑ Live Assessment System</span>
                </div>

                {/* 4. Active Users */}
                <div style={{ background: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ background: '#fff7ed', padding: '10px', borderRadius: '12px' }}><Activity size={22} color="#ea580c" /></div>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Active Users</span>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', margin: '0 0 4px 0' }}>{students.filter(s => s.isLoggedIn).length + teachers.filter(t => t.isLoggedIn).length}</div>
                  <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: '700' }}>🟢 Currently Online</span>
                </div>

                {/* 5. Completed Exams */}
                <div style={{ background: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ background: '#f0fdfa', padding: '10px', borderRadius: '12px' }}><CheckCircle2 size={22} color="#0d9488" /></div>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Completed Exams</span>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', margin: '0 0 4px 0' }}>98</div>
                  <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: '700' }}>↑ 20% <span style={{ color: '#94a3b8', fontWeight: '500' }}>vs last month</span></span>
                </div>

                {/* 6. AI Assistant Usage */}
                <div style={{ background: '#ffffff', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ background: '#f5f3ff', padding: '10px', borderRadius: '12px' }}><Bot size={22} color="#7c3aed" /></div>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>AI Assistant Usage</span>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', margin: '0 0 4px 0' }}>92%</div>
                  <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: '700' }}>↑ 5% <span style={{ color: '#94a3b8', fontWeight: '500' }}>vs last month</span></span>
                </div>

                {/* 7. Support & Contact Us Inquiries */}
                <div 
                  onClick={() => { setActiveTab('messages'); speakIn('Opening Support and Inquiries'); }}
                  style={{ background: '#ffffff', padding: '20px', borderRadius: '16px', border: unreadMessagesCount > 0 ? '2px solid #ef4444' : '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ background: '#fef2f2', padding: '10px', borderRadius: '12px' }}><Mail size={22} color="#dc2626" /></div>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Contact Us Inquiries</span>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', margin: '0 0 4px 0' }}>{contactMessages.length}</div>
                  <span style={{ fontSize: '12px', color: unreadMessagesCount > 0 ? '#dc2626' : '#16a34a', fontWeight: '800' }}>
                    {unreadMessagesCount > 0 ? `🔴 ${unreadMessagesCount} Unread / New` : '✓ All Handled'}
                  </span>
                </div>

              </div>

              {/* MIDDLE ROW: SYSTEM OVERVIEW CHART, AI USAGE DONUT CHART, QUICK ACTIONS */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '20px' }}>
                
                {/* System Overview Line Chart Card */}
                <div style={{ background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BarChart3 size={18} color="#d97706" /> System Overview
                      </h3>
                      <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '12px', fontWeight: '700' }}>
                        <span style={{ color: '#d97706' }}>● Students</span>
                        <span style={{ color: '#9333ea' }}>● Exams</span>
                        <span style={{ color: '#16a34a' }}>● AI Usage</span>
                      </div>
                    </div>
                    <select style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: '600' }}>
                      <option>Last 7 Days</option>
                      <option>Last 30 Days</option>
                    </select>
                  </div>

                  {/* SVG Chart visualization */}
                  <div style={{ height: '180px', width: '100%', position: 'relative' }}>
                    <svg viewBox="0 0 500 150" style={{ width: '100%', height: '100%' }}>
                      <path d="M0,110 Q100,70 200,80 T400,40 T500,20" fill="none" stroke="#d97706" strokeWidth="3" />
                      <path d="M0,130 Q100,110 200,100 T400,90 T500,60" fill="none" stroke="#16a34a" strokeWidth="3" />
                      <path d="M0,140 Q100,130 200,125 T400,110 T500,85" fill="none" stroke="#9333ea" strokeWidth="3" />
                    </svg>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>
                      {Array.from({ length: 7 }).map((_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - (6 - i));
                        return <span key={i}>{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>;
                      })}
                    </div>
                  </div>
                </div>

                {/* AI Assistant Usage Donut Chart Card */}
                <div style={{ background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', margin: '0 0 16px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bot size={18} color="#7c3aed" /> AI Assistant Usage
                  </h3>

                  <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '10px 0' }}>
                    <div style={{ width: '110px', height: '110px', borderRadius: '50%', background: 'conic-gradient(#d97706 0% 68%, #9333ea 68% 86%, #16a34a 86% 95%, #f97316 95% 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <div style={{ width: '75px', height: '75px', borderRadius: '50%', background: '#ffffff', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                        <span style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a' }}>92%</span>
                        <span style={{ fontSize: '9px', color: '#64748b' }}>Usage Rate</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', fontWeight: '700' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#d97706' }}>● Voice Commands</span><span>68%</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#9333ea' }}>● Text-to-Speech</span><span>18%</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#16a34a' }}>● Speech-to-Text</span><span>9%</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#f97316' }}>● Other</span><span>5%</span></div>
                  </div>
                </div>

                {/* Quick Actions Card */}
                <div style={{ background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', margin: '0 0 6px 0', color: '#0f172a' }}>⚡ Quick Actions</h3>
                  
                  <button onClick={() => setActiveTab('students')} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: 'none', background: '#d97706', color: '#ffffff', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>👨‍🎓 View Students ({students.length} Total • {students.filter(s => s.isLoggedIn).length} Online)</span><span>›</span>
                  </button>

                  <button onClick={() => setActiveTab('teachers')} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: 'none', background: '#7c3aed', color: '#ffffff', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>👨‍🏫 View Teachers ({teachers.length} Total • {teachers.filter(t => t.isLoggedIn).length} Online)</span><span>›</span>
                  </button>

                  <button onClick={() => { setActiveTab('exams'); setShowExamModal(true); }} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: 'none', background: '#16a34a', color: '#ffffff', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>📄 Create Exam</span><span>›</span>
                  </button>

                  <button onClick={() => { setActiveTab('messages'); speakIn('Opening Support and Contact Inquiries'); }} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: 'none', background: unreadMessagesCount > 0 ? '#dc2626' : '#0284c7', color: '#ffffff', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>📩 Contact Inquiries ({unreadMessagesCount} Unread • {contactMessages.length} Total)</span><span>›</span>
                  </button>

                  <button onClick={() => setActiveTab('settings')} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: 'none', background: '#0284c7', color: '#ffffff', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>⚙️ Manage System Settings</span><span>›</span>
                  </button>

                  <button onClick={() => { setActiveTab('announcements'); setShowAnnouncementModal(true); }} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: 'none', background: '#f97316', color: '#ffffff', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>📢 Send Announcement</span><span>›</span>
                  </button>
                </div>

              </div>

              {/* BOTTOM ROW: UPCOMING EXAMS TABLE & RECENT ACTIVITY FEED */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                
                {/* Upcoming Exams Table */}
                <div style={{ background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar size={18} color="#d97706" /> Upcoming Exams
                    </h3>
                    <button onClick={() => setActiveTab('exams')} style={{ background: 'transparent', border: 'none', color: '#d97706', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>View All →</button>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', fontWeight: '700' }}>
                        <th style={{ padding: '10px 8px' }}>Subject</th>
                        <th style={{ padding: '10px 8px' }}>Date</th>
                        <th style={{ padding: '10px 8px' }}>Time</th>
                        <th style={{ padding: '10px 8px' }}>Students</th>
                        <th style={{ padding: '10px 8px' }}>Status</th>
                        <th style={{ padding: '10px 8px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exams.map((ex, idx) => (
                        <tr key={ex.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 8px', fontWeight: '800', color: '#0f172a' }}>{ex.subject}</td>
                          <td style={{ padding: '12px 8px', color: '#475569' }}>{ex.date}</td>
                          <td style={{ padding: '12px 8px', color: '#475569' }}>{ex.time}</td>
                          <td style={{ padding: '12px 8px', fontWeight: '700', color: '#0f172a' }}>{ex.studentsCount}</td>
                          <td style={{ padding: '12px 8px' }}>
                            <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800' }}>{ex.status}</span>
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <button onClick={() => setActiveTab('exams')} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}>View</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Right Column: Recent Activity Feed */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  {/* Recent Activity Card */}
                  <div style={{ background: '#ffffff', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={16} color="#d97706" /> Recent Activity
                      </h3>
                      <button onClick={() => setActiveTab('security')} style={{ background: 'transparent', border: 'none', color: '#d97706', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>View All →</button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <div style={{ background: '#eff6ff', padding: '6px', borderRadius: '50%', color: '#d97706' }}>👤</div>
                        <div>
                          <div style={{ fontWeight: '800', color: '#0f172a' }}>New student registered</div>
                          <span style={{ color: '#64748b' }}>Rahul Kumar (S123) - 2 hours ago</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <div style={{ background: '#f0fdf4', padding: '6px', borderRadius: '50%', color: '#16a34a' }}>📄</div>
                        <div>
                          <div style={{ fontWeight: '800', color: '#0f172a' }}>Exam created</div>
                          <span style={{ color: '#64748b' }}>Mathematics - Scheduled - 150 students</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <div style={{ background: '#faf5ff', padding: '6px', borderRadius: '50%', color: '#9333ea' }}>👤</div>
                        <div>
                          <div style={{ fontWeight: '800', color: '#0f172a' }}>Teacher added</div>
                          <span style={{ color: '#64748b' }}>Ms. Priya Sharma - 3 hours ago</span>
                        </div>
                      </div>
                    </div>

                    {/* System Health Badges Footer */}
                    <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: '700' }}>
                      <span style={{ color: '#0f172a', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}>🛡️ System Health</span>
                      <div style={{ display: 'flex', gap: '6px', color: '#16a34a' }}>
                        <span>Database 🟢</span><span>AI Services 🟢</span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* TAB 2: STUDENT DIRECTORY (REGISTERED & LOGGED IN) */}
          {activeTab === 'students' && (
            <div style={{ background: '#ffffff', padding: '28px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: '900', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    👨‍🎓 Student Directory — Registered & Logged-In
                    <span style={{ fontSize: '13px', background: '#fef3c7', color: '#b45309', padding: '3px 12px', borderRadius: '14px', fontWeight: '800' }}>
                      {students.length} Total • {students.filter(s => s.isLoggedIn).length} Online
                    </span>
                  </h2>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                    Directory of registered students showing real-time login session status, register numbers, and assigned courses.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button 
                    onClick={loadUsers} 
                    disabled={isLoadingUsers}
                    style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', padding: '10px 16px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <RefreshCw size={15} className={isLoadingUsers ? 'animate-spin' : ''} /> 
                    {isLoadingUsers ? 'Refreshing...' : 'Refresh List'}
                  </button>
                </div>
              </div>

              {/* SEARCH & FILTER CONTROLS */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px', background: '#f8fafc', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                {/* Search Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '8px 14px', flex: '1', minWidth: '260px' }}>
                  <Search size={16} color="#64748b" />
                  <input
                    type="text"
                    placeholder="Search by name, email, register number, course..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px', fontWeight: '600' }}
                  />
                  {studentSearch && (
                    <button onClick={() => setStudentSearch('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', fontWeight: '800' }}>×</button>
                  )}
                </div>

                {/* Filter Pills */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setStudentFilter('all')}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: studentFilter === 'all' ? '2px solid #d97706' : '1px solid #cbd5e1',
                      background: studentFilter === 'all' ? '#fef3c7' : '#ffffff',
                      color: studentFilter === 'all' ? '#92400e' : '#475569',
                      fontWeight: '800',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    All ({students.length})
                  </button>
                  <button
                    onClick={() => setStudentFilter('logged_in')}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: studentFilter === 'logged_in' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                      background: studentFilter === 'logged_in' ? '#dcfce7' : '#ffffff',
                      color: studentFilter === 'logged_in' ? '#15803d' : '#475569',
                      fontWeight: '800',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    🟢 Currently Logged In ({students.filter(s => s.isLoggedIn).length})
                  </button>
                  <button
                    onClick={() => setStudentFilter('registered')}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: studentFilter === 'registered' ? '2px solid #64748b' : '1px solid #cbd5e1',
                      background: studentFilter === 'registered' ? '#f1f5f9' : '#ffffff',
                      color: studentFilter === 'registered' ? '#0f172a' : '#475569',
                      fontWeight: '800',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    📋 Registered Accounts ({students.filter(s => !s.isLoggedIn).length})
                  </button>
                </div>
              </div>

              {/* STUDENT LIST */}
              {filteredStudents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 20px', background: '#f8fafc', borderRadius: '14px', border: '1px dashed #cbd5e1' }}>
                  <Users size={40} color="#94a3b8" style={{ marginBottom: '10px' }} />
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '800', color: '#334155' }}>No Students Found</h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                    {studentSearch || studentFilter !== 'all' ? 'Try adjusting your search query or filter selection.' : 'No registered students detected in the system yet.'}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {filteredStudents.map(st => (
                    <div key={st.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderRadius: '16px', background: '#ffffff', border: st.isLoggedIn ? '2px solid #86efac' : '1px solid #e2e8f0', boxShadow: st.isLoggedIn ? '0 4px 14px rgba(22, 163, 74, 0.08)' : '0 2px 6px rgba(0,0,0,0.02)', flexWrap: 'wrap', gap: '16px' }}>
                      <div style={{ flex: '1', minWidth: '280px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <h3 style={{ fontSize: '17px', fontWeight: '900', margin: 0, color: '#0f172a' }}>{st.name}</h3>
                          
                          {/* Register Number Badge */}
                          <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '10px', background: '#eff6ff', color: '#1d4ed8', fontWeight: '800', border: '1px solid #bfdbfe' }}>
                            Reg No: {st.studentId}
                          </span>

                          {/* Logged In Status Badge */}
                          {st.isLoggedIn ? (
                            <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '10px', background: '#dcfce7', color: '#15803d', fontWeight: '800', border: '1px solid #86efac', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              🟢 Logged In (Online Now)
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '10px', background: '#f1f5f9', color: '#475569', fontWeight: '700', border: '1px solid #e2e8f0' }}>
                              📋 Registered Account (Offline)
                            </span>
                          )}

                          {/* Active / Deactivated */}
                          <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '10px', background: st.status === 'Active' ? '#f0fdf4' : '#fee2e2', color: st.status === 'Active' ? '#16a34a' : '#ef4444', fontWeight: '800' }}>
                            ● {st.status}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: '#475569', margin: '4px 0' }}>
                          <span>📧 <strong>Email:</strong> {st.email}</span>
                          <span>🎓 <strong>Course:</strong> {st.course || 'Computer Science'}</span>
                          <span>📚 <strong>Enrolled Subject:</strong> {st.subject || 'Computer Science'}</span>
                          <span>📱 <strong>Phone:</strong> {st.phone || '9876543210'}</span>
                        </div>

                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', marginTop: '6px' }}>
                          <span style={{ color: '#7c3aed', fontWeight: '700' }}>♿ Accessibility: {st.accessibility || 'Voice Assistant + High Contrast'}</span>
                          <span style={{ color: st.isLoggedIn ? '#16a34a' : '#64748b', fontWeight: '700' }}>🕒 Last Activity: {st.lastLogin}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button onClick={() => handleGenerateResetPassword(st)} style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a' }}>
                          <Key size={14} color="#d97706" /> Reset Pass
                        </button>
                        <button onClick={() => handleToggleStudentStatus(st.id)} style={{ background: st.status === 'Active' ? '#fee2e2' : '#dcfce7', border: 'none', color: st.status === 'Active' ? '#ef4444' : '#16a34a', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}>
                          {st.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onClick={() => handleDeleteStudent(st.id, st.name, st.email)} title="Delete student record" style={{ background: '#ef4444', border: 'none', color: '#ffffff', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TEACHER DIRECTORY (REGISTERED & LOGGED IN) */}
          {activeTab === 'teachers' && (
            <div style={{ background: '#ffffff', padding: '28px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: '900', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    👨‍🏫 Teacher Directory — Registered & Logged-In
                    <span style={{ fontSize: '13px', background: '#ede9fe', color: '#6d28d9', padding: '3px 12px', borderRadius: '14px', fontWeight: '800' }}>
                      {teachers.length} Total • {teachers.filter(t => t.isLoggedIn).length} Online
                    </span>
                  </h2>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                    Directory of registered teachers showing real-time login session status, departments, and assigned classes.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button 
                    onClick={loadUsers} 
                    disabled={isLoadingUsers}
                    style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', padding: '10px 16px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <RefreshCw size={15} className={isLoadingUsers ? 'animate-spin' : ''} /> 
                    {isLoadingUsers ? 'Refreshing...' : 'Refresh List'}
                  </button>
                </div>
              </div>

              {/* SEARCH & FILTER CONTROLS */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px', background: '#f8fafc', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                {/* Search Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '8px 14px', flex: '1', minWidth: '260px' }}>
                  <Search size={16} color="#64748b" />
                  <input
                    type="text"
                    placeholder="Search by teacher name, email, department, subject..."
                    value={teacherSearch}
                    onChange={(e) => setTeacherSearch(e.target.value)}
                    style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px', fontWeight: '600' }}
                  />
                  {teacherSearch && (
                    <button onClick={() => setTeacherSearch('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', fontWeight: '800' }}>×</button>
                  )}
                </div>

                {/* Filter Pills */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setTeacherFilter('all')}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: teacherFilter === 'all' ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                      background: teacherFilter === 'all' ? '#ede9fe' : '#ffffff',
                      color: teacherFilter === 'all' ? '#5b21b6' : '#475569',
                      fontWeight: '800',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    All ({teachers.length})
                  </button>
                  <button
                    onClick={() => setTeacherFilter('logged_in')}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: teacherFilter === 'logged_in' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                      background: teacherFilter === 'logged_in' ? '#dcfce7' : '#ffffff',
                      color: teacherFilter === 'logged_in' ? '#15803d' : '#475569',
                      fontWeight: '800',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    🟢 Currently Logged In ({teachers.filter(t => t.isLoggedIn).length})
                  </button>
                  <button
                    onClick={() => setTeacherFilter('registered')}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: teacherFilter === 'registered' ? '2px solid #64748b' : '1px solid #cbd5e1',
                      background: teacherFilter === 'registered' ? '#f1f5f9' : '#ffffff',
                      color: teacherFilter === 'registered' ? '#0f172a' : '#475569',
                      fontWeight: '800',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    📋 Registered Accounts ({teachers.filter(t => !t.isLoggedIn).length})
                  </button>
                </div>
              </div>

              {/* TEACHER LIST */}
              {filteredTeachers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 20px', background: '#f8fafc', borderRadius: '14px', border: '1px dashed #cbd5e1' }}>
                  <UserCheck size={40} color="#94a3b8" style={{ marginBottom: '10px' }} />
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '800', color: '#334155' }}>No Teachers Found</h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                    {teacherSearch || teacherFilter !== 'all' ? 'Try adjusting your search query or filter selection.' : 'No registered faculty members detected in the system yet.'}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {filteredTeachers.map(tc => (
                    <div key={tc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderRadius: '16px', background: '#ffffff', border: tc.isLoggedIn ? '2px solid #86efac' : '1px solid #e2e8f0', boxShadow: tc.isLoggedIn ? '0 4px 14px rgba(22, 163, 74, 0.08)' : '0 2px 6px rgba(0,0,0,0.02)', flexWrap: 'wrap', gap: '16px' }}>
                      <div style={{ flex: '1', minWidth: '280px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <h3 style={{ fontSize: '17px', fontWeight: '900', margin: 0, color: '#0f172a' }}>{tc.name}</h3>
                          
                          {/* Logged In Status Badge */}
                          {tc.isLoggedIn ? (
                            <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '10px', background: '#dcfce7', color: '#15803d', fontWeight: '800', border: '1px solid #86efac', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              🟢 Logged In (Online Now)
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '10px', background: '#f1f5f9', color: '#475569', fontWeight: '700', border: '1px solid #e2e8f0' }}>
                              📋 Registered Account (Offline)
                            </span>
                          )}

                          {/* Subject Badge */}
                          <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '10px', background: '#faf5ff', color: '#7c3aed', fontWeight: '800', border: '1px solid #e9d5ff' }}>
                            Subject: {tc.subject || 'Computer Science'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: '#475569', margin: '4px 0' }}>
                          <span>📧 <strong>Email:</strong> {tc.email}</span>
                          <span>🏢 <strong>Assigned Class / Dept:</strong> {tc.assignedClass || 'CS Department'}</span>
                          <span>📱 <strong>Phone:</strong> {tc.phone || '9876543210'}</span>
                        </div>

                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', marginTop: '6px' }}>
                          <span style={{ color: '#16a34a', fontWeight: '700' }}>📌 Role: Faculty Member</span>
                          <span style={{ color: tc.isLoggedIn ? '#16a34a' : '#64748b', fontWeight: '700' }}>🕒 Last Activity: {tc.lastLogin}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button onClick={() => handleGenerateResetPassword(tc)} style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a' }}>
                          <Key size={14} color="#7c3aed" /> Reset Pass
                        </button>
                        <button onClick={() => handleDeleteTeacher(tc.id, tc.name, tc.email)} title="Delete teacher account" style={{ background: '#ef4444', border: 'none', color: '#ffffff', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Trash2 size={14} /> Delete Account
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: EXAM MANAGEMENT */}
          {activeTab === 'exams' && (
            <div style={{ background: '#ffffff', padding: '28px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: '900', margin: 0 }}>📝 Exam Management ({exams.length})</h2>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>Create, schedule, set durations, and monitor theory assessments.</p>
                </div>
                <button onClick={() => { setEditingExam(null); setExamForm({ title: '', subject: 'Computer Networks', duration: '45 mins', date: '2026-09-28', time: '10:00 AM', status: 'Scheduled', studentsCount: 150 }); setShowExamModal(true); }} style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Plus size={18} /> Create Exam
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                {exams.map(ex => (
                  <div key={ex.id} style={{ padding: '20px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '10px', background: '#e0f2fe', color: '#0369a1', fontWeight: '800' }}>{ex.status}</span>
                      <h3 style={{ fontSize: '16px', fontWeight: '800', margin: '8px 0 4px 0' }}>{ex.title}</h3>
                      <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Subject: {ex.subject} • Duration: {ex.duration}</p>
                      <p style={{ fontSize: '13px', color: '#475569', marginTop: '6px' }}>📅 {ex.date} at {ex.time} ({ex.studentsCount} Students)</p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                      <button onClick={() => handleDeleteExam(ex.id, ex.title)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', flex: 1 }}>
                        Delete Exam
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: SUPPORT & CONTACT US INQUIRIES */}
          {activeTab === 'messages' && (
            <div style={{ background: '#ffffff', padding: '28px', borderRadius: '20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Header Box */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: '900', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    📩 Support & Contact Us Inquiries
                    <span style={{ fontSize: '13px', background: unreadMessagesCount > 0 ? '#fef2f2' : '#f0fdf4', color: unreadMessagesCount > 0 ? '#dc2626' : '#15803d', padding: '3px 12px', borderRadius: '14px', fontWeight: '800', border: unreadMessagesCount > 0 ? '1px solid #fecaca' : '1px solid #bbf7d0' }}>
                      {unreadMessagesCount} Unread • {contactMessages.length} Total
                    </span>
                  </h2>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                    Review, manage, and respond to inquiries, questions, and accessibility support requests submitted via the Contact Us modal.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button 
                    onClick={loadContactMessages}
                    disabled={isLoadingMessages}
                    style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', padding: '10px 16px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <RefreshCw size={15} className={isLoadingMessages ? 'animate-spin' : ''} /> 
                    {isLoadingMessages ? 'Refreshing...' : 'Refresh Inquiries'}
                  </button>
                </div>
              </div>

              {/* Search & Filter Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', background: '#f8fafc', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                {/* Search Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '8px 14px', flex: '1', minWidth: '260px' }}>
                  <Search size={16} color="#64748b" />
                  <input
                    type="text"
                    placeholder="Search by name, email, role, subject, or message text..."
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px', fontWeight: '600' }}
                  />
                  {contactSearch && (
                    <button onClick={() => setContactSearch('')} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>✕</button>
                  )}
                </div>

                {/* Filter Pills */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'all', label: `All (${contactMessages.length})` },
                    { id: 'unread', label: `🔴 Unread (${unreadMessagesCount})` },
                    { id: 'in_review', label: `⏳ In Review (${contactMessages.filter(m => (m.status || '').toLowerCase().includes('review')).length})` },
                    { id: 'resolved', label: `✓ Resolved (${contactMessages.filter(m => (m.status || '').toLowerCase() === 'resolved').length})` }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setContactFilter(f.id)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '10px',
                        fontSize: '12px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        border: contactFilter === f.id ? '2px solid #0284c7' : '1px solid #cbd5e1',
                        background: contactFilter === f.id ? '#e0f2fe' : '#ffffff',
                        color: contactFilter === f.id ? '#0369a1' : '#475569'
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Messages Cards List */}
              {filteredMessages.length === 0 ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                  <Mail size={44} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0' }}>No Inquiries Found</h3>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                    {contactSearch ? 'No messages match your search filter.' : 'All incoming messages have been addressed.'}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {filteredMessages.map(msg => {
                    const status = msg.status || 'Unread';
                    const isUnread = status.toLowerCase() === 'unread';
                    const isResolved = status.toLowerCase() === 'resolved';

                    return (
                      <div 
                        key={msg.id || msg._id}
                        style={{
                          background: isUnread ? '#fffbfb' : '#ffffff',
                          border: isUnread ? '2px solid #fca5a5' : '1px solid #e2e8f0',
                          borderRadius: '16px',
                          padding: '22px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '14px',
                          boxShadow: isUnread ? '0 4px 14px rgba(239, 68, 68, 0.08)' : '0 2px 8px rgba(0,0,0,0.02)'
                        }}
                      >
                        {/* Header: Sender details and Status Selector */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ 
                              width: '42px', 
                              height: '42px', 
                              borderRadius: '50%', 
                              background: isUnread ? '#fee2e2' : '#f1f5f9', 
                              color: isUnread ? '#dc2626' : '#475569',
                              display: 'flex', 
                              justifyContent: 'center', 
                              alignItems: 'center', 
                              fontWeight: '900',
                              fontSize: '16px'
                            }}>
                              {(msg.name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#0f172a' }}>{msg.name}</h3>
                                <span style={{
                                  fontSize: '11px',
                                  padding: '2px 8px',
                                  borderRadius: '8px',
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  fontWeight: '800',
                                  border: '1px solid #bfdbfe'
                                }}>
                                  {msg.role || 'Student'}
                                </span>
                              </div>
                              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                <span>📧 <a href={`mailto:${msg.email}`} style={{ color: '#0284c7', textDecoration: 'none', fontWeight: '700' }}>{msg.email}</a></span>
                                <span>🕒 {msg.date} at {msg.time}</span>
                              </div>
                            </div>
                          </div>

                          {/* Status Badge & Selector */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{
                              fontSize: '12px',
                              fontWeight: '900',
                              padding: '5px 12px',
                              borderRadius: '12px',
                              background: isUnread ? '#fef2f2' : isResolved ? '#f0fdf4' : '#eff6ff',
                              color: isUnread ? '#dc2626' : isResolved ? '#16a34a' : '#2563eb',
                              border: isUnread ? '1px solid #fecaca' : isResolved ? '1px solid #bbf7d0' : '1px solid #bfdbfe'
                            }}>
                              {isUnread ? '● UNREAD' : isResolved ? '✓ RESOLVED' : '⏳ IN REVIEW'}
                            </span>

                            <select
                              value={status}
                              onChange={(e) => handleUpdateMessageStatus(msg.id || msg._id, e.target.value)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                fontSize: '12px',
                                fontWeight: '700',
                                background: '#f8fafc',
                                color: '#0f172a',
                                cursor: 'pointer'
                              }}
                            >
                              <option value="Unread">Mark as Unread</option>
                              <option value="In Review">Mark In Review</option>
                              <option value="Resolved">Mark as Resolved</option>
                            </select>
                          </div>
                        </div>

                        {/* Subject Tag */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '800', color: '#0369a1', background: '#e0f2fe', padding: '4px 10px', borderRadius: '8px' }}>
                            📌 Topic: {msg.subject || 'General Inquiry'}
                          </span>
                        </div>

                        {/* Message Content Box */}
                        <div style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '12px',
                          padding: '14px 18px',
                          color: '#1e293b',
                          fontSize: '14px',
                          lineHeight: '1.6',
                          fontWeight: '500',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {msg.message}
                        </div>

                        {/* Card Action Buttons */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <a
                              href={`mailto:${msg.email}?subject=${encodeURIComponent(`Re: [VisionAssist AI Support] ${msg.subject || 'Inquiry'}`)}&body=${encodeURIComponent(`Hello ${msg.name},\n\nThank you for reaching out to VisionAssist AI Support regarding your inquiry:\n"${msg.message}"\n\n[Type your response here]\n\nBest regards,\nAdministrator Support Team\nVisionAssist AI Academy`)}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: '#0284c7',
                                color: '#ffffff',
                                textDecoration: 'none',
                                padding: '8px 14px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontWeight: '800',
                                cursor: 'pointer'
                              }}
                            >
                              <Mail size={14} /> Reply via Email
                            </a>

                            {!isResolved ? (
                              <button
                                onClick={() => handleUpdateMessageStatus(msg.id || msg._id, 'Resolved')}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  background: '#16a34a',
                                  color: '#ffffff',
                                  border: 'none',
                                  padding: '8px 14px',
                                  borderRadius: '8px',
                                  fontSize: '12px',
                                  fontWeight: '800',
                                  cursor: 'pointer'
                                }}
                              >
                                <CheckCircle2 size={14} /> Mark as Resolved
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateMessageStatus(msg.id || msg._id, 'Unread')}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  background: '#f8fafc',
                                  color: '#475569',
                                  border: '1px solid #cbd5e1',
                                  padding: '8px 14px',
                                  borderRadius: '8px',
                                  fontSize: '12px',
                                  fontWeight: '800',
                                  cursor: 'pointer'
                                }}
                              >
                                Re-open Inquiry
                              </button>
                            )}
                          </div>

                          <button
                            onClick={() => handleDeleteMessage(msg.id || msg._id, msg.name)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: '#ffffff',
                              color: '#ef4444',
                              border: '1px solid #fecaca',
                              padding: '8px 14px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: '800',
                              cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

          {/* TAB 6: ACCESSIBILITY MANAGEMENT */}
          {activeTab === 'accessibility' && (
            <div style={{ background: '#ffffff', padding: '28px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '900', margin: '0 0 8px 0' }}>♿ Accessibility Management</h2>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>Set system accessibility defaults for visually impaired users.</p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', margin: '0 0 14px 0' }}>High Contrast Theme</h3>
                  <select value={accessConfig.contrastMode} onChange={(e) => setAccessConfig({ ...accessConfig, contrastMode: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: '700' }}>
                    <option>High Contrast (Default)</option>
                    <option>Dark Mode High Contrast</option>
                    <option>Yellow & Black High Contrast</option>
                  </select>
                </div>

                <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', margin: '0 0 14px 0' }}>Speech Narration Speed</h3>
                  <input type="range" min="0.5" max="2.0" step="0.1" value={accessConfig.speechSpeed} onChange={(e) => setAccessConfig({ ...accessConfig, speechSpeed: parseFloat(e.target.value) })} style={{ width: '100%' }} />
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#d97706' }}>{accessConfig.speechSpeed}x Speed</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: NOTIFICATIONS & ANNOUNCEMENTS */}
          {activeTab === 'announcements' && (
            <div style={{ background: '#ffffff', padding: '28px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: '900', margin: 0 }}>🔔 Notifications & Announcements</h2>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>Broadcast alerts to students and teachers.</p>
                </div>
                <button onClick={() => setShowAnnouncementModal(true)} style={{ background: '#f97316', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Plus size={18} /> New Broadcast
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {announcements.map(ann => (
                  <div key={ann.id} style={{ padding: '18px 22px', borderRadius: '14px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>{ann.title}</h3>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: '#fee2e2', color: '#ef4444', fontWeight: '800' }}>{ann.priority} Priority</span>
                    </div>
                    <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 6px 0' }}>{ann.message}</p>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Target: {ann.target} • {ann.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: SECURITY & USER ROLES */}
          {activeTab === 'security' && (
            <div style={{ background: '#ffffff', padding: '28px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '900', margin: '0 0 8px 0' }}>🔐 Security & User Roles</h2>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>Manage role permissions, password security policies, and audit access governance.</p>

              <div style={{ padding: '20px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', margin: '0 0 12px 0' }}>Role Permissions Matrix</h3>
                <div style={{ fontSize: '13px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>🛡️ <strong>Administrator:</strong> Full System Access, User Governance & Platform Settings</div>
                  <div>👨‍🏫 <strong>Teacher:</strong> Exam Creation, Subject Grading & Student Proctoring</div>
                  <div>🎓 <strong>Student:</strong> AI Voice Guided Navigation, Accessible Exams & Screen Tap Assistance</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: SYSTEM SETTINGS HUB */}
          {activeTab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* Toast Notifications */}
              {settingsSavedToast && (
                <div style={{ background: '#f0fdf4', border: '2px solid #22c55e', color: '#15803d', padding: '14px 20px', borderRadius: '14px', fontWeight: '800', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 12px rgba(34, 197, 94, 0.15)' }}>
                  <CheckCircle2 size={20} color="#15803d" />
                  <span>System settings updated and applied across all modules successfully!</span>
                </div>
              )}

              {settingsResetToast && (
                <div style={{ background: '#eff6ff', border: '2px solid #3b82f6', color: '#1d4ed8', padding: '14px 20px', borderRadius: '14px', fontWeight: '800', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)' }}>
                  <RotateCcw size={20} color="#1d4ed8" />
                  <span>All system settings have been restored to platform defaults.</span>
                </div>
              )}

              {/* Header Box with Actions */}
              <div style={{ background: '#ffffff', padding: '24px 28px', borderRadius: '20px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    ⚙️ System Settings & Platform Governance
                  </h2>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                    Configure global parameters, AI speech engine, proctoring rules, authentication security policies, database telemetry, and automated system backups.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <button 
                    onClick={handleExportSystemBackup}
                    style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#0f172a', padding: '10px 16px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                    title="Export complete system data as JSON"
                  >
                    <Download size={16} /> Export Backup (.JSON)
                  </button>

                  <button 
                    onClick={handleResetSystemSettings}
                    style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#64748b', padding: '10px 16px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <RotateCcw size={16} /> Reset Defaults
                  </button>

                  <button 
                    onClick={handleSaveSystemSettings}
                    style={{ background: '#16a34a', border: 'none', color: '#ffffff', padding: '10px 20px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)' }}
                  >
                    <Check size={16} /> Save All Changes
                  </button>
                </div>
              </div>

              {/* Grid of Settings Modules */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>

                {/* 1. Institution & Platform Identity */}
                <div style={{ background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ background: '#fef3c7', padding: '8px', borderRadius: '10px', color: '#d97706' }}>
                      <Globe size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#0f172a' }}>Institution & Identity</h3>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Platform branding and contact routing</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Institution / Platform Name</label>
                      <input 
                        type="text" 
                        value={systemSettings.institutionName} 
                        onChange={(e) => setSystemSettings({ ...systemSettings, institutionName: e.target.value })}
                        style={modalInputStyle} 
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Current Academic Term</label>
                      <input 
                        type="text" 
                        value={systemSettings.academicTerm} 
                        onChange={(e) => setSystemSettings({ ...systemSettings, academicTerm: e.target.value })}
                        style={modalInputStyle} 
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Administrative Support Email</label>
                      <input 
                        type="email" 
                        value={systemSettings.adminSupportEmail} 
                        onChange={(e) => setSystemSettings({ ...systemSettings, adminSupportEmail: e.target.value })}
                        style={modalInputStyle} 
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Emergency Audio Helpline Phone</label>
                      <input 
                        type="text" 
                        value={systemSettings.emergencyPhone} 
                        onChange={(e) => setSystemSettings({ ...systemSettings, emergencyPhone: e.target.value })}
                        style={modalInputStyle} 
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>System Timezone & Regional Clock</label>
                      <select 
                        value={systemSettings.systemTimezone} 
                        onChange={(e) => setSystemSettings({ ...systemSettings, systemTimezone: e.target.value })}
                        style={modalInputStyle}
                      >
                        <option value="Asia/Kolkata (UTC+05:30)">Asia/Kolkata (UTC+05:30 IST)</option>
                        <option value="America/New_York (UTC-05:00)">America/New_York (UTC-05:00 EST)</option>
                        <option value="Europe/London (UTC+00:00)">Europe/London (UTC+00:00 GMT)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. AI Voice & Narration Defaults */}
                <div style={{ background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ background: '#eff6ff', padding: '8px', borderRadius: '10px', color: '#2563eb' }}>
                      <Volume2 size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#0f172a' }}>AI Voice & Speech Engine</h3>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Speech synthesis, wake word & chimes</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Speech Engine Provider</label>
                      <select 
                        value={systemSettings.ttsEngine} 
                        onChange={(e) => setSystemSettings({ ...systemSettings, ttsEngine: e.target.value })}
                        style={modalInputStyle}
                      >
                        <option value="Browser Speech Synthesis (Local & Fast)">Browser Speech Synthesis (Local & Fast)</option>
                        <option value="Edge Neural HD Voice Engine">Edge Neural HD Voice Engine</option>
                        <option value="Google Cloud Wavenet TTS">Google Cloud Wavenet TTS</option>
                      </select>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                        <span>Narration Rate / Speed</span>
                        <span style={{ color: '#d97706' }}>{systemSettings.speechRate}x</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.75" 
                        max="1.75" 
                        step="0.05"
                        value={systemSettings.speechRate} 
                        onChange={(e) => setSystemSettings({ ...systemSettings, speechRate: parseFloat(e.target.value) })}
                        style={{ width: '100%', accentColor: '#d97706' }} 
                      />
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                        <span>Voice Pitch</span>
                        <span style={{ color: '#2563eb' }}>{systemSettings.speechPitch}x</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.8" 
                        max="1.3" 
                        step="0.05"
                        value={systemSettings.speechPitch} 
                        onChange={(e) => setSystemSettings({ ...systemSettings, speechPitch: parseFloat(e.target.value) })}
                        style={{ width: '100%', accentColor: '#2563eb' }} 
                      />
                    </div>

                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: '700', color: '#0f172a', cursor: 'pointer' }}>
                        <span>Hands-Free Wake-Word ("Hey Assistant")</span>
                        <input 
                          type="checkbox" 
                          checked={systemSettings.wakeWordEnabled} 
                          onChange={(e) => setSystemSettings({ ...systemSettings, wakeWordEnabled: e.target.checked })} 
                          style={{ width: '16px', height: '16px', accentColor: '#16a34a' }}
                        />
                      </label>

                      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: '700', color: '#0f172a', cursor: 'pointer' }}>
                        <span>Audio Chime on Status Transitions</span>
                        <input 
                          type="checkbox" 
                          checked={systemSettings.audioChimeEnabled} 
                          onChange={(e) => setSystemSettings({ ...systemSettings, audioChimeEnabled: e.target.checked })} 
                          style={{ width: '16px', height: '16px', accentColor: '#16a34a' }}
                        />
                      </label>

                      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: '700', color: '#0f172a', cursor: 'pointer' }}>
                        <span>Auto-Narration for Screen Changes</span>
                        <input 
                          type="checkbox" 
                          checked={systemSettings.autoNarrationOnScreenChange} 
                          onChange={(e) => setSystemSettings({ ...systemSettings, autoNarrationOnScreenChange: e.target.checked })} 
                          style={{ width: '16px', height: '16px', accentColor: '#16a34a' }}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* 3. Proctoring & Exam Integrity Rules */}
                <div style={{ background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ background: '#fef2f2', padding: '8px', borderRadius: '10px', color: '#dc2626' }}>
                      <Camera size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#0f172a' }}>Proctoring & Exam Rules</h3>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Camera monitoring, absence & intruder limits</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '12px', borderRadius: '12px' }}>
                      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: '800', color: '#991b1b', cursor: 'pointer' }}>
                        <span>Webcam Face Verification Mandatory</span>
                        <input 
                          type="checkbox" 
                          checked={systemSettings.webcamFaceVerification} 
                          onChange={(e) => setSystemSettings({ ...systemSettings, webcamFaceVerification: e.target.checked })} 
                          style={{ width: '18px', height: '18px', accentColor: '#dc2626' }}
                        />
                      </label>
                      <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#b91c1c' }}>Requires students to scan face and keeps live proctor camera active during exam.</p>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Intruder / Multiple Person Warning Limit</label>
                      <select 
                        value={systemSettings.multiplePersonWarningLimit} 
                        onChange={(e) => setSystemSettings({ ...systemSettings, multiplePersonWarningLimit: e.target.value })}
                        style={modalInputStyle}
                      >
                        <option value="2 Warnings (Auto-Exit on 3rd)">2 Warnings (Auto-Exit on 3rd Violation) [Recommended]</option>
                        <option value="1 Warning (Auto-Exit on 2nd)">Strict: 1 Warning (Auto-Exit on 2nd)</option>
                        <option value="3 Warnings (Auto-Exit on 4th)">Lenient: 3 Warnings (Auto-Exit on 4th)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Face Absence Alert Tolerance (Seconds)</label>
                      <input 
                        type="number" 
                        min="2" 
                        max="20"
                        value={systemSettings.faceAbsenceToleranceSec} 
                        onChange={(e) => setSystemSettings({ ...systemSettings, faceAbsenceToleranceSec: parseInt(e.target.value) || 5 })}
                        style={modalInputStyle} 
                      />
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Triggers warning sound if scanned face leaves view for longer than threshold.</span>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: '700', color: '#0f172a', cursor: 'pointer' }}>
                        <span>Auto-Report Alert Logs to Teacher Hub</span>
                        <input 
                          type="checkbox" 
                          checked={systemSettings.autoReportIntrusions} 
                          onChange={(e) => setSystemSettings({ ...systemSettings, autoReportIntrusions: e.target.checked })} 
                          style={{ width: '16px', height: '16px', accentColor: '#16a34a' }}
                        />
                      </label>

                      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: '700', color: '#0f172a', cursor: 'pointer' }}>
                        <span>Fullscreen Lockdown Mode</span>
                        <input 
                          type="checkbox" 
                          checked={systemSettings.fullscreenEnforcement} 
                          onChange={(e) => setSystemSettings({ ...systemSettings, fullscreenEnforcement: e.target.checked })} 
                          style={{ width: '16px', height: '16px', accentColor: '#16a34a' }}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* 4. Authentication & Security Policies */}
                <div style={{ background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ background: '#faf5ff', padding: '8px', borderRadius: '10px', color: '#9333ea' }}>
                      <Lock size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#0f172a' }}>Security & Auth Policies</h3>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Password formatting, OTP life & timeouts</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>STUDENT PASSWORD POLICY</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', fontWeight: '800', fontSize: '13px', marginTop: '2px' }}>
                        <CheckCircle2 size={16} /> Alphanumeric Only (A-Z, 0-9, No Symbols)
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Forgot Password OTP Life Window</label>
                      <select 
                        value={systemSettings.otpExpiryMinutes} 
                        onChange={(e) => setSystemSettings({ ...systemSettings, otpExpiryMinutes: parseInt(e.target.value) || 10 })}
                        style={modalInputStyle}
                      >
                        <option value={5}>5 Minutes (High Security)</option>
                        <option value={10}>10 Minutes (Standard)</option>
                        <option value={15}>15 Minutes (Extended)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Max Failed Login Attempts Before Lockout</label>
                      <select 
                        value={systemSettings.maxFailedAttempts} 
                        onChange={(e) => setSystemSettings({ ...systemSettings, maxFailedAttempts: parseInt(e.target.value) || 5 })}
                        style={modalInputStyle}
                      >
                        <option value={3}>3 Attempts</option>
                        <option value={5}>5 Attempts (Recommended)</option>
                        <option value={10}>10 Attempts</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Inactivity Session Timeout</label>
                      <select 
                        value={systemSettings.sessionInactivityTimeout} 
                        onChange={(e) => setSystemSettings({ ...systemSettings, sessionInactivityTimeout: e.target.value })}
                        style={modalInputStyle}
                      >
                        <option value="30 Minutes">30 Minutes</option>
                        <option value="60 Minutes">60 Minutes</option>
                        <option value="120 Minutes">120 Minutes</option>
                        <option value="Never">Never (Keep Session Active)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Concurrent Session Policy</label>
                      <select 
                        value={systemSettings.concurrentSessions} 
                        onChange={(e) => setSystemSettings({ ...systemSettings, concurrentSessions: e.target.value })}
                        style={modalInputStyle}
                      >
                        <option value="Single Active Session Only">Single Active Session Only (Auto-logout old device)</option>
                        <option value="Allow Concurrent Sessions">Allow Concurrent Sessions Across Devices</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 5. Database Telemetry & Backup Tools */}
                <div style={{ background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ background: '#f0fdf4', padding: '8px', borderRadius: '10px', color: '#16a34a' }}>
                      <Database size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#0f172a' }}>Database Telemetry & Backup</h3>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Cluster status, storage footprint & exports</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: '800', color: '#166534' }}>MongoDB Atlas Cluster</div>
                        <span style={{ fontSize: '11px', color: '#15803d' }}>Live Connected • 24ms roundtrip</span>
                      </div>
                      <span style={{ background: '#22c55e', color: '#fff', fontSize: '10px', fontWeight: '900', padding: '3px 8px', borderRadius: '8px' }}>HEALTHY</span>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700' }}>
                      <span style={{ color: '#64748b' }}>Registered Accounts:</span>
                      <span style={{ color: '#0f172a' }}>{students.length + teachers.length + 1} Records</span>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700' }}>
                      <span style={{ color: '#64748b' }}>Scheduled Exams:</span>
                      <span style={{ color: '#0f172a' }}>{exams.length} Exams</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                      <button 
                        onClick={handleExportSystemBackup}
                        style={{ width: '100%', background: '#d97706', color: '#fff', border: 'none', padding: '10px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      >
                        <Download size={16} /> Download Complete Backup (.JSON)
                      </button>

                      <button 
                        onClick={() => {
                          speakIn('Database indices synchronized successfully');
                          alert('Database synchronization completed. All storage indices verified.');
                        }}
                        style={{ width: '100%', background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      >
                        <RefreshCw size={16} /> Synchronize & Optimize Indices
                      </button>

                      <button 
                        onClick={() => {
                          if (window.confirm('Clear all resolved emergency assistance requests?')) {
                            setAssistanceRequests(prev => prev.filter(r => r.status === 'Pending'));
                            speakIn('Cleared resolved alert logs');
                          }
                        }}
                        style={{ width: '100%', background: '#ffffff', color: '#ef4444', border: '1px solid #fecaca', padding: '10px', borderRadius: '10px', fontWeight: '800', fontSize: '12px', cursor: 'pointer' }}
                      >
                        🧹 Purge Resolved SOS & Temp Logs
                      </button>
                    </div>
                  </div>
                </div>

                {/* 6. Interface Accessibility Defaults */}
                <div style={{ background: '#ffffff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ background: '#fff7ed', padding: '8px', borderRadius: '10px', color: '#ea580c' }}>
                      <Accessibility size={20} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, color: '#0f172a' }}>Global Accessibility Defaults</h3>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Default theme, ARIA, screen tap guide</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>System Default Contrast Theme</label>
                      <select 
                        value={systemSettings.defaultTheme} 
                        onChange={(e) => setSystemSettings({ ...systemSettings, defaultTheme: e.target.value })}
                        style={modalInputStyle}
                      >
                        <option value="High Contrast (Amber & Dark Navy)">High Contrast (Amber & Dark Navy)</option>
                        <option value="Dark Monochrome">Deep Dark Monochrome</option>
                        <option value="Light Crisp Canvas">Light Crisp Canvas</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Base Font Scale</label>
                      <select 
                        value={systemSettings.baseFontSize} 
                        onChange={(e) => setSystemSettings({ ...systemSettings, baseFontSize: e.target.value })}
                        style={modalInputStyle}
                      >
                        <option value="Medium (16px)">Medium (16px - Standard)</option>
                        <option value="Large (18px)">Large (18px - High Legibility)</option>
                        <option value="Extra-Large (22px)">Extra-Large (22px - Maximum)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Screen Reader ARIA Live Assertiveness</label>
                      <select 
                        value={systemSettings.ariaAssertiveness} 
                        onChange={(e) => setSystemSettings({ ...systemSettings, ariaAssertiveness: e.target.value })}
                        style={modalInputStyle}
                      >
                        <option value="Polite Live Regions">Polite (Wait until speaker finishes current phrase)</option>
                        <option value="Assertive Immediate Interruption">Assertive (Interrupt immediately for urgent alerts)</option>
                      </select>
                    </div>

                    <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '12px', borderRadius: '12px' }}>
                      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: '800', color: '#92400e', cursor: 'pointer' }}>
                        <span>Screen Tap Voice Guide Active</span>
                        <input 
                          type="checkbox" 
                          checked={systemSettings.tapAnywhereGuide} 
                          onChange={(e) => setSystemSettings({ ...systemSettings, tapAnywhereGuide: e.target.checked })} 
                          style={{ width: '18px', height: '18px', accentColor: '#d97706' }}
                        />
                      </label>
                      <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#b45309' }}>Guides student verbally when tapping anywhere across the screen.</p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Bottom Sticky Action Bar */}
              <div style={{ background: '#ffffff', padding: '18px 28px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ShieldCheck size={22} color="#16a34a" />
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>
                    All changes persist in local platform storage and apply to live exams automatically.
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    onClick={handleExportSystemBackup}
                    style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', padding: '10px 18px', borderRadius: '10px', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Download size={16} /> Export JSON
                  </button>
                  <button 
                    onClick={handleSaveSystemSettings}
                    style={{ background: '#16a34a', border: 'none', color: '#ffffff', padding: '10px 24px', borderRadius: '10px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)' }}
                  >
                    <Save size={16} /> Save All System Settings
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>
      </main>

      {/* EXAM MODAL */}
      {showExamModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ background: '#ffffff', padding: '32px', borderRadius: '20px', width: '100%', maxWidth: '440px', boxSizing: 'border-box' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 16px 0' }}>Create New Exam</h3>
            <form onSubmit={handleSaveExam} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input type="text" placeholder="Exam Title" value={examForm.title} onChange={(e) => setExamForm({ ...examForm, title: e.target.value })} style={modalInputStyle} required />
              <input type="text" placeholder="Subject" value={examForm.subject} onChange={(e) => setExamForm({ ...examForm, subject: e.target.value })} style={modalInputStyle} />
              <input type="text" placeholder="Duration (e.g. 45 mins)" value={examForm.duration} onChange={(e) => setExamForm({ ...examForm, duration: e.target.value })} style={modalInputStyle} />
              <input type="text" placeholder="Date (e.g. Oct 18, 2026)" value={examForm.date} onChange={(e) => setExamForm({ ...examForm, date: e.target.value })} style={modalInputStyle} />

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowExamModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: '800', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#16a34a', color: '#fff', fontWeight: '800', cursor: 'pointer' }}>Save Exam</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ANNOUNCEMENT MODAL */}
      {showAnnouncementModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ background: '#ffffff', padding: '32px', borderRadius: '20px', width: '100%', maxWidth: '440px', boxSizing: 'border-box' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 16px 0' }}>Broadcast Announcement</h3>
            <form onSubmit={handleSaveAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input type="text" placeholder="Announcement Title" value={announcementForm.title} onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })} style={modalInputStyle} required />
              <textarea rows={3} placeholder="Message text" value={announcementForm.message} onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })} style={modalInputStyle} required />

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowAnnouncementModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: '800', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#f97316', color: '#fff', fontWeight: '800', cursor: 'pointer' }}>Broadcast</button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* RESET PASSWORD MODAL */}
      {resetPassModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ background: '#ffffff', padding: '32px', borderRadius: '20px', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
            <Key size={36} color="#d97706" style={{ marginBottom: '12px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 8px 0' }}>Password Reset Successful</h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0' }}>
              Temporary password for <strong>{resetPassModal.user?.name || resetPassModal.student?.name}</strong>:
            </p>
            <div style={{ background: '#f1f5f9', padding: '12px', borderRadius: '10px', fontSize: '18px', fontWeight: '900', color: '#d97706', letterSpacing: '1px', marginBottom: '20px' }}>
              {resetPassModal.tempPass}
            </div>
            <button onClick={() => setResetPassModal(null)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', background: '#d97706', color: '#fff', fontWeight: '800', cursor: 'pointer' }}>
              Close & Notify User
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// Icon helper
function LayoutDashboardIcon(props) {
  return (
    <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill="none" stroke={props.color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

const modalInputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '13px',
  fontWeight: '600',
  boxSizing: 'border-box'
};