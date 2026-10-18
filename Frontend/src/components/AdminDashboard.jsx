import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, UserCheck, GraduationCap, FileText, Bot, Accessibility, BookOpen, 
  BarChart3, Bell, ShieldCheck, Settings, Plus, Edit, Trash2, Search, 
  CheckCircle2, AlertTriangle, Volume2, Lock, Unlock, Clock, Calendar, 
  ArrowRight, Download, RefreshCw, Radio, Database, Activity, Check, Eye, 
  Mail, Key, Upload, Play, HelpCircle, LogOut, Phone, Shield, Filter, RotateCcw
} from 'lucide-react';
import { fetchAssistanceRequests, updateAssistanceRequest, fetchRegisteredStudents, fetchRegisteredTeachers } from '../services/api';
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

  // Modals & Active Selections (Exams, Announcements, Materials)
  const [showExamModal, setShowExamModal] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [examForm, setExamForm] = useState({ title: '', subject: 'Computer Networks', duration: '45 mins', date: '2026-09-28', time: '10:00 AM', status: 'Scheduled', studentsCount: 150 });

  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '', priority: 'High', target: 'All' });

  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [materialForm, setMaterialForm] = useState({ title: '', type: 'PDF Document', subject: 'Computer Networks', assignedClass: 'CS Year 3', link: '#' });

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

  // 4. DATA STORE: STUDY MATERIALS
  const [materials, setMaterials] = useState(() => {
    try {
      const saved = localStorage.getItem('shared_study_materials');
      if (saved) {
        const parsed = JSON.parse(saved);
        const filtered = parsed.filter(m => 
          !(m.id === 1 && m.title === 'Physics: Motion & Laws of Force') && 
          !(m.id === 2 && m.title === 'Computer Networks: OSI Model & Protocols') && 
          !(m.id === 3 && m.title === 'Mathematics: Algebra & Equations') &&
          !(m.id === 1 && m.title === 'Computer Networks OSI Layer Guide (PDF)') &&
          !(m.id === 2 && m.title === 'OS Deadlocks Audio Lecture & Voice Notes') &&
          !(m.id === 3 && m.title === 'Cyber Security Phishing Defense Book')
        );
        if (parsed.length !== filtered.length) {
          localStorage.setItem('shared_study_materials', JSON.stringify(filtered));
        }
        return filtered;
      }
      return [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('shared_study_materials', JSON.stringify(materials));
  }, [materials]);

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

  // MATERIAL HANDLERS
  const handleSaveMaterial = (e) => {
    e.preventDefault();
    if (!materialForm.title) return;

    const newMat = { id: Date.now(), ...materialForm, date: 'Just now', size: '3.5 MB' };
    setMaterials([newMat, ...materials]);
    speakIn(`Uploaded study material ${materialForm.title}`);
    setShowMaterialModal(false);
  };

  const handleDeleteMaterial = (id, title) => {
    if (window.confirm(`Remove study material ${title}?`)) {
      setMaterials(materials.filter(m => m.id !== id));
      speakIn(`Removed material ${title}`);
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

  // 11 Sidebar Items
  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboardIcon },
    { id: 'students', label: 'Students Directory', icon: GraduationCap },
    { id: 'teachers', label: 'Teachers Directory', icon: UserCheck },
    { id: 'exams', label: 'Exam Management', icon: FileText },
    { id: 'ai_assistant', label: 'AI Exam Assistant', icon: Bot },
    { id: 'accessibility', label: 'Accessibility Management', icon: Accessibility },
    { id: 'materials', label: 'Study Material Management', icon: BookOpen },
    { id: 'reports', label: 'Results & Reports', icon: BarChart3 },
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
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Sidebar AI Assistant Card */}
        <div style={{ background: '#1e293b', padding: '16px', borderRadius: '16px', border: '1px solid #334155', marginTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <div style={{ background: '#d97706', padding: '8px', borderRadius: '10px' }}>
              <Volume2 size={20} color="#ffffff" />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#ffffff' }}>AI Assistant</h4>
              <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Manage and monitor AI features</p>
            </div>
          </div>
          <button 
            onClick={() => setActiveTab('ai_assistant')}
            style={{ width: '100%', background: 'rgba(217, 119, 6, 0.2)', border: '1px solid #d97706', color: '#f59e0b', padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
          >
            Manage AI Services
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

                  <button onClick={() => { setActiveTab('materials'); setShowMaterialModal(true); }} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: 'none', background: '#0d9488', color: '#ffffff', fontWeight: '800', fontSize: '13px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>📁 Upload Study Material</span><span>›</span>
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

                {/* Right Column: AI Exam Assistant Banner + Recent Activity */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* AI Exam Assistant Card */}
                  <div style={{ background: '#ffffff', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ background: '#f5f3ff', padding: '12px', borderRadius: '14px' }}><Bot size={28} color="#7c3aed" /></div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>AI Exam Assistant</h4>
                        <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>Monitor AI services, voice features, and usage statistics.</p>
                      </div>
                    </div>
                    <button onClick={() => setActiveTab('ai_assistant')} style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}>View Details</button>
                  </div>

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

          {/* TAB 5: AI EXAM ASSISTANT MANAGEMENT */}
          {activeTab === 'ai_assistant' && (
            <div style={{ background: '#ffffff', padding: '28px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '900', margin: '0 0 8px 0' }}>🤖 AI Exam Assistant Management</h2>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>Configure speech synthesis, text-to-speech narration, voice command keyphrases, and AI diagnostics.</p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', margin: '0 0 12px 0' }}>AI Feature Toggles</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px', fontWeight: '700' }}>
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      Text-to-Speech Narration <input type="checkbox" checked={aiConfig.ttsEnabled} onChange={(e) => setAiConfig({ ...aiConfig, ttsEnabled: e.target.checked })} />
                    </label>
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      Speech-to-Text Dictation <input type="checkbox" checked={aiConfig.sttEnabled} onChange={(e) => setAiConfig({ ...aiConfig, sttEnabled: e.target.checked })} />
                    </label>
                    <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      Hands-Free Voice Commands <input type="checkbox" checked={aiConfig.voiceCommands} onChange={(e) => setAiConfig({ ...aiConfig, voiceCommands: e.target.checked })} />
                    </label>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', margin: '0 0 12px 0' }}>Language & Accents</h3>
                  <select value={aiConfig.language} onChange={(e) => setAiConfig({ ...aiConfig, language: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: '700' }}>
                    <option>English (US)</option>
                    <option>English (UK)</option>
                    <option>English (India)</option>
                  </select>
                  <p style={{ fontSize: '12px', color: '#16a34a', marginTop: '12px', fontWeight: '700' }}>🟢 AI Recognition Models Loaded & Verified</p>
                </div>
              </div>
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

          {/* TAB 7: STUDY MATERIAL MANAGEMENT */}
          {activeTab === 'materials' && (
            <div style={{ background: '#ffffff', padding: '28px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: '900', margin: 0 }}>📚 Study Material Management ({materials.length})</h2>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>Upload accessible PDFs, audio lectures, and study documents.</p>
                </div>
                <button onClick={() => setShowMaterialModal(true)} style={{ background: '#0d9488', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Plus size={18} /> Upload Material
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {materials.map(mat => (
                  <div key={mat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderRadius: '14px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: '800', margin: '0 0 4px 0' }}>{mat.title}</h3>
                      <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Type: {mat.type} • Class: {mat.assignedClass} • Size: {mat.size}</p>
                    </div>
                    <button onClick={() => handleDeleteMaterial(mat.id, mat.title)} style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '8px 12px', borderRadius: '8px', fontWeight: '800', fontSize: '12px', cursor: 'pointer' }}>
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 8: RESULTS & REPORTS */}
          {activeTab === 'reports' && (
            <div style={{ background: '#ffffff', padding: '28px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '900', margin: '0 0 8px 0' }}>📈 Results & Analytics Reports</h2>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>Export analytics and inspect student completion performance.</p>
              
              <div style={{ padding: '24px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 4px 0' }}>System Performance Report (JSON/CSV)</h3>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Export complete statistics on students, exams, and audio usage.</p>
                </div>
                <button onClick={() => alert('Exporting full analytics report...')} style={{ background: '#d97706', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Download size={18} /> Export Analytics
                </button>
              </div>
            </div>
          )}

          {/* TAB 9: NOTIFICATIONS & ANNOUNCEMENTS */}
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

          {/* TAB 10: SECURITY & USER ROLES */}
          {activeTab === 'security' && (
            <div style={{ background: '#ffffff', padding: '28px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '900', margin: '0 0 8px 0' }}>🔐 Security & User Roles</h2>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>Manage role permissions and audit login activities.</p>

              <div style={{ padding: '20px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', margin: '0 0 12px 0' }}>Role Permissions Matrix</h3>
                <div style={{ fontSize: '13px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>🛡️ <strong>Administrator:</strong> Full System Access & User Governance</div>
                  <div>👨‍🏫 <strong>Teacher:</strong> Exam Creation, Subject Grading & Student Proctoring</div>
                  <div>🎓 <strong>Student:</strong> AI Guided Exam Taking & Accessible Study Materials</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 11: SYSTEM SETTINGS */}
          {activeTab === 'settings' && (
            <div style={{ background: '#ffffff', padding: '28px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '900', margin: '0 0 8px 0' }}>⚙️ System Settings</h2>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>Application settings, database telemetry, and backup configurations.</p>

              <div style={{ padding: '20px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', margin: '0 0 4px 0' }}>Database & System Backup</h3>
                  <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: '700' }}>🟢 All Databases Operational & Backed Up</span>
                </div>
                <button onClick={() => alert('Triggered instant database backup.')} style={{ background: '#d97706', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}>
                  Backup Now
                </button>
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

      {/* STUDY MATERIAL MODAL */}
      {showMaterialModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ background: '#ffffff', padding: '32px', borderRadius: '20px', width: '100%', maxWidth: '440px', boxSizing: 'border-box' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 16px 0' }}>Upload Study Material</h3>
            <form onSubmit={handleSaveMaterial} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input type="text" placeholder="Material Title" value={materialForm.title} onChange={(e) => setMaterialForm({ ...materialForm, title: e.target.value })} style={modalInputStyle} required />
              <input type="text" placeholder="Type (PDF / Audio Lecture)" value={materialForm.type} onChange={(e) => setMaterialForm({ ...materialForm, type: e.target.value })} style={modalInputStyle} />
              <input type="text" placeholder="Subject" value={materialForm.subject} onChange={(e) => setMaterialForm({ ...materialForm, subject: e.target.value })} style={modalInputStyle} />

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowMaterialModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: '800', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#0d9488', color: '#fff', fontWeight: '800', cursor: 'pointer' }}>Upload Material</button>
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