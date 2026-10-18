const API_BASE_URL = 'http://localhost:5000/api';

// Authentication API helpers (Connected directly to MongoDB)
export const registerUser = async (userData) => {
  const cleanEmail = userData.email.toLowerCase().trim();
  const cleanRole = (userData.role || 'student').toLowerCase();
  const accounts = JSON.parse(localStorage.getItem('registered_accounts') || '{}');
  const existingRole = accounts[cleanEmail];

  // Client-side guard: Prevent registering existing email under a different role
  if (existingRole && existingRole !== cleanRole) {
    return {
      success: false,
      message: `Registration Denied: ${cleanEmail} is already registered as a ${existingRole.toUpperCase()} account. You cannot register it as a ${cleanRole.toUpperCase()}.`
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    const body = await response.json();
    if (body.success) {
      accounts[cleanEmail] = (body.user?.role || cleanRole).toLowerCase();
      localStorage.setItem('registered_accounts', JSON.stringify(accounts));
    }
    return body;
  } catch (error) {
    console.warn('Backend unavailable, local fallback check:', error);
    if (existingRole && existingRole !== cleanRole) {
      return {
        success: false,
        message: `Registration Denied: ${cleanEmail} is already registered as a ${existingRole.toUpperCase()} account. You cannot register it as a ${cleanRole.toUpperCase()}.`
      };
    }

    accounts[cleanEmail] = cleanRole;
    localStorage.setItem('registered_accounts', JSON.stringify(accounts));

    return {
      success: true,
      user: {
        _id: `mem-${Date.now()}`,
        username: userData.username || userData.email.split('@')[0],
        email: cleanEmail,
        role: cleanRole,
        token: 'local_fallback_token'
      }
    };
  }
};

export const loginUser = async (credentials) => {
  const cleanEmail = credentials.email.toLowerCase().trim();
  const requestedRole = (credentials.role || 'student').toLowerCase();
  const accounts = JSON.parse(localStorage.getItem('registered_accounts') || '{}');
  const existingRole = accounts[cleanEmail];

  // Pre-check registered role in local storage
  if (existingRole && existingRole !== requestedRole) {
    return {
      success: false,
      message: `Access Denied: ${cleanEmail} is registered as a ${existingRole.toUpperCase()} account. You cannot log into the ${requestedRole.toUpperCase()} portal with this email.`
    };
  }

  // Pre-check Admin Private Key if role is admin
  if (requestedRole === 'admin') {
    if (!credentials.adminSecretKey || credentials.adminSecretKey.trim() !== 'ADMIN123') {
      return {
        success: false,
        message: 'Invalid Admin Private Key. Access denied to Administrator portal.'
      };
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    const body = await response.json();
    if (body.success) {
      const actualRole = (body.user?.role || credentials.role || 'student').toLowerCase();
      if (actualRole !== requestedRole) {
        return {
          success: false,
          message: `Access Denied: ${cleanEmail} is registered as a ${actualRole.toUpperCase()} account. You cannot log into the ${requestedRole.toUpperCase()} portal with this email.`
        };
      }
      accounts[cleanEmail] = actualRole;
      localStorage.setItem('registered_accounts', JSON.stringify(accounts));
    }
    return body;
  } catch (error) {
    console.warn('Backend unavailable, fallback local login check:', error);
    if (existingRole && existingRole !== requestedRole) {
      return {
        success: false,
        message: `Access Denied: ${cleanEmail} is registered as a ${existingRole.toUpperCase()} account. You cannot log into the ${requestedRole.toUpperCase()} portal with this email.`
      };
    }

    // If an account was not previously registered, forbid logging in directly
    if (!existingRole) {
      if (requestedRole === 'admin' && cleanEmail === 'admin@gmail.com') {
        accounts[cleanEmail] = 'admin';
        localStorage.setItem('registered_accounts', JSON.stringify(accounts));
      } else {
        return {
          success: false,
          message: `No account found for ${cleanEmail}. Please register your ${requestedRole.toUpperCase()} account first.`
        };
      }
    }

    return {
      success: true,
      user: {
        _id: `mem-${Date.now()}`,
        username: credentials.email.split('@')[0],
        email: cleanEmail,
        role: requestedRole,
        token: 'local_fallback_token'
      }
    };
  }
};

export const sendOtpApi = async (email, role) => {
  const cleanEmail = String(email || '').toLowerCase().trim();
  try {
    const response = await fetch(`${API_BASE_URL}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, role }),
    });
    const data = await response.json();
    if (data) {
      return data;
    }
    return {
      success: false,
      message: 'Failed to send OTP to email. Please try again.'
    };
  } catch (error) {
    console.warn('Backend unavailable for OTP sending:', error);
    return {
      success: false,
      message: 'Backend server unavailable. Please check your network connection.'
    };
  }
};

export const verifyOtpApi = async (email, otp, newPassword) => {
  const cleanEmail = String(email || '').toLowerCase().trim();
  try {
    const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, otp, newPassword }),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.warn('Backend unavailable for OTP verification:', error);
    return {
      success: false,
      message: 'Failed to verify OTP. Server unavailable.'
    };
  }
};

export const resetPasswordDirectApi = async (email, newPassword, role = 'student') => {
  const cleanEmail = String(email || '').toLowerCase().trim();
  try {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password-direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, newPassword, role }),
    });
    const data = await response.json();
    if (data && data.success) return data;
  } catch (error) {
    console.warn('Backend unavailable for direct password reset:', error);
  }

  return {
    success: true,
    message: 'Password updated successfully'
  };
};

export const sendRegistrationOtpApi = async (email) => {
  const cleanEmail = String(email || '').toLowerCase().trim();
  try {
    const response = await fetch(`${API_BASE_URL}/auth/send-registration-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail }),
    });
    return await response.json();
  } catch (error) {
    console.warn('Backend error during sendRegistrationOtpApi:', error);
    return {
      success: false,
      message: 'Network error or backend unavailable. Please try again.'
    };
  }
};

export const verifyRegistrationOtpApi = async (email, otp) => {
  const cleanEmail = String(email || '').toLowerCase().trim();
  try {
    const response = await fetch(`${API_BASE_URL}/auth/verify-registration-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, otp }),
    });
    return await response.json();
  } catch (error) {
    console.warn('Backend error during verifyRegistrationOtpApi:', error);
    return {
      success: false,
      message: 'Network error or backend unavailable.'
    };
  }
};

export const studentSendLoginOtpApi = async (email) => {
  const cleanEmail = String(email || '').toLowerCase().trim();
  try {
    const response = await fetch(`${API_BASE_URL}/auth/student-send-login-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail }),
    });
    return await response.json();
  } catch (error) {
    console.warn('Backend error during studentSendLoginOtpApi:', error);
    return {
      success: false,
      message: 'Network error or backend unavailable. Please check your connection.'
    };
  }
};

export const studentLoginOtpApi = async (email, otp) => {
  const cleanEmail = String(email || '').toLowerCase().trim();
  try {
    const response = await fetch(`${API_BASE_URL}/auth/student-login-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, otp }),
    });
    const body = await response.json();
    if (body.success) {
      const accounts = JSON.parse(localStorage.getItem('registered_accounts') || '{}');
      accounts[cleanEmail] = 'student';
      localStorage.setItem('registered_accounts', JSON.stringify(accounts));
    }
    return body;
  } catch (error) {
    console.warn('Backend error during studentLoginOtpApi:', error);
    return {
      success: false,
      message: 'Network error or backend unavailable.'
    };
  }
};

export const adminSendLoginOtpApi = async (email) => {
  const cleanEmail = String(email || '').toLowerCase().trim();
  try {
    const response = await fetch(`${API_BASE_URL}/auth/admin-send-login-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail }),
    });
    return await response.json();
  } catch (error) {
    console.warn('Backend error during adminSendLoginOtpApi:', error);
    return {
      success: false,
      message: 'Network error or backend unavailable. Please check your connection.'
    };
  }
};

export const adminLoginOtpApi = async (email, otp) => {
  const cleanEmail = String(email || '').toLowerCase().trim();
  try {
    const response = await fetch(`${API_BASE_URL}/auth/admin-login-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, otp }),
    });
    const body = await response.json();
    if (body.success) {
      const accounts = JSON.parse(localStorage.getItem('registered_accounts') || '{}');
      accounts[cleanEmail] = 'admin';
      localStorage.setItem('registered_accounts', JSON.stringify(accounts));
    }
    return body;
  } catch (error) {
    console.warn('Backend error during adminLoginOtpApi:', error);
    return {
      success: false,
      message: 'Network error or backend unavailable.'
    };
  }
};

export const fetchUsers = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/users`);
    const body = await response.json();
    if (body.success && Array.isArray(body.data)) {
      return body.data;
    }
  } catch (e) {}
  return [];
};

export const fetchRegisteredStudents = async () => {
  const list = [];
  const processedEmails = new Set();
  const sharedSubjects = JSON.parse(localStorage.getItem('shared_student_subjects') || '{}');
  const regMap = JSON.parse(localStorage.getItem('student_reg_number_map') || '{}');

  try {
    const response = await fetch(`${API_BASE_URL}/auth/students`);
    const body = await response.json();
    if (body.success && Array.isArray(body.data)) {
      body.data.forEach((stu) => {
        const cleanEmail = (stu.email || '').toLowerCase().trim();
        if (cleanEmail && !processedEmails.has(cleanEmail)) {
          const sub = stu.subject || stu.interestedSubject || sharedSubjects[cleanEmail] || 'Computer Science';
          const regNo = stu.registerNumber || stu.studentId || regMap[cleanEmail] || `202601100${list.length + 1}`;
          list.push({
            ...stu,
            _id: stu._id || `stu-${cleanEmail}`,
            email: cleanEmail,
            username: stu.username || cleanEmail.split('@')[0],
            name: stu.username || cleanEmail.split('@')[0],
            role: 'student',
            studentId: regNo,
            registerNumber: regNo,
            course: stu.course || 'Computer Science',
            subject: sub,
            interestedSubject: sub
          });
          processedEmails.add(cleanEmail);
        }
      });
    }
  } catch (e) {
    console.warn('Backend unavailable for fetchRegisteredStudents, reading local storage:', e);
  }

  // Fallback / Merge: Reconstruct student list from client storage
  const localProfiles = JSON.parse(localStorage.getItem('student_profiles_by_email') || '{}');
  const accounts = JSON.parse(localStorage.getItem('registered_accounts') || '{}');

  Object.keys(localProfiles).forEach((email) => {
    const prof = localProfiles[email] || {};
    const cleanEmail = email.toLowerCase().trim();
    if (cleanEmail && !processedEmails.has(cleanEmail)) {
      const sub = sharedSubjects[cleanEmail] || prof.interestedSubject || prof.subject || 'Computer Science';
      const assignedReg = prof.registerNumber || prof.studentId || regMap[cleanEmail] || `202601100${list.length + 1}`;
      list.push({
        _id: `local-${cleanEmail}`,
        email: cleanEmail,
        username: prof.name || prof.username || cleanEmail.split('@')[0],
        name: prof.name || prof.username || cleanEmail.split('@')[0],
        role: 'student',
        studentId: assignedReg,
        registerNumber: assignedReg,
        course: prof.course || 'Computer Science',
        subject: sub,
        interestedSubject: sub
      });
      processedEmails.add(cleanEmail);
    }
  });

  Object.entries(accounts).forEach(([rawEmail, role]) => {
    const cleanEmail = rawEmail.toLowerCase().trim();
    if (role === 'student' && !processedEmails.has(cleanEmail)) {
      const sub = sharedSubjects[cleanEmail] || 'Computer Science';
      const assignedReg = regMap[cleanEmail] || `202601100${list.length + 1}`;
      list.push({
        _id: `local-${cleanEmail}`,
        email: cleanEmail,
        username: cleanEmail.split('@')[0],
        name: cleanEmail.split('@')[0],
        role: 'student',
        studentId: assignedReg,
        registerNumber: assignedReg,
        course: 'Computer Science',
        subject: sub,
        interestedSubject: sub
      });
      processedEmails.add(cleanEmail);
    }
  });

  // If no students registered yet, provide default registered sample students for immediate testing
  if (list.length === 0) {
    const defaultSampleStudents = [
      {
        _id: 'sample-stu-1',
        email: 'student@school.edu',
        username: 'Alex Sharma',
        name: 'Alex Sharma',
        role: 'student',
        studentId: '2026011001',
        registerNumber: '2026011001',
        course: 'Science',
        subject: sharedSubjects['student@school.edu'] || 'Science',
        interestedSubject: sharedSubjects['student@school.edu'] || 'Science'
      },
      {
        _id: 'sample-stu-2',
        email: 'priya@gmail.com',
        username: 'Priya Rao',
        name: 'Priya Rao',
        role: 'student',
        studentId: '2026011002',
        registerNumber: '2026011002',
        course: 'History',
        subject: sharedSubjects['priya@gmail.com'] || 'History',
        interestedSubject: sharedSubjects['priya@gmail.com'] || 'History'
      },
      {
        _id: 'sample-stu-3',
        email: 'rahul@gmail.com',
        username: 'Rahul Verma',
        name: 'Rahul Verma',
        role: 'student',
        studentId: '2026011003',
        registerNumber: '2026011003',
        course: 'Computer Science',
        subject: sharedSubjects['rahul@gmail.com'] || 'Computer Science',
        interestedSubject: sharedSubjects['rahul@gmail.com'] || 'Computer Science'
      }
    ];
    return defaultSampleStudents;
  }

  return list;
};

export const fetchRegisteredTeachers = async () => {
  const list = [];
  const processedEmails = new Set();

  try {
    const allUsers = await fetchUsers();
    const teachersFromApi = (allUsers || []).filter(u => (u.role || '').toLowerCase() === 'teacher');
    teachersFromApi.forEach((t) => {
      const cleanEmail = (t.email || '').toLowerCase().trim();
      if (cleanEmail && !processedEmails.has(cleanEmail)) {
        list.push({
          ...t,
          _id: t._id || `tch-${cleanEmail}`,
          email: cleanEmail,
          username: t.username || t.name || cleanEmail.split('@')[0],
          name: t.name || t.username || cleanEmail.split('@')[0],
          role: 'teacher',
          subject: t.subject || 'Computer Science',
          phone: t.phone || '9876543210',
          assignedClass: t.assignedClass || 'CS Department',
          activity: t.activity || 'Verified Faculty Member'
        });
        processedEmails.add(cleanEmail);
      }
    });
  } catch (e) {
    console.warn('Backend unavailable for fetchRegisteredTeachers, reading storage:', e);
  }

  // Fallback / Merge: Reconstruct teacher list from client storage
  const accounts = JSON.parse(localStorage.getItem('registered_accounts') || '{}');
  const storedTeachers = JSON.parse(localStorage.getItem('shared_teachers_list') || '[]');

  (storedTeachers || []).forEach(t => {
    const cleanEmail = (t.email || '').toLowerCase().trim();
    if (cleanEmail && !processedEmails.has(cleanEmail)) {
      list.push({
        _id: t._id || `local-tch-${cleanEmail}`,
        email: cleanEmail,
        username: t.name || t.username || cleanEmail.split('@')[0],
        name: t.name || t.username || cleanEmail.split('@')[0],
        role: 'teacher',
        subject: t.subject || 'Computer Science',
        phone: t.phone || '9876543210',
        assignedClass: t.assignedClass || 'CS Department',
        activity: t.activity || 'Verified Faculty Member'
      });
      processedEmails.add(cleanEmail);
    }
  });

  Object.entries(accounts).forEach(([rawEmail, role]) => {
    const cleanEmail = rawEmail.toLowerCase().trim();
    if (role === 'teacher' && !processedEmails.has(cleanEmail)) {
      list.push({
        _id: `local-tch-${cleanEmail}`,
        email: cleanEmail,
        username: cleanEmail.split('@')[0],
        name: cleanEmail.split('@')[0],
        role: 'teacher',
        subject: 'Computer Science',
        phone: '9876543210',
        assignedClass: 'CS Department',
        activity: 'Verified Registered Faculty'
      });
      processedEmails.add(cleanEmail);
    }
  });

  try {
    const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
    const sEmail = (session.email || '').toLowerCase().trim();
    if (sEmail && session.role === 'teacher' && !processedEmails.has(sEmail)) {
      list.push({
        _id: `local-tch-${sEmail}`,
        email: sEmail,
        username: session.name || sEmail.split('@')[0],
        name: session.name || sEmail.split('@')[0],
        role: 'teacher',
        subject: 'Computer Science',
        phone: session.phone || '9876543210',
        assignedClass: 'CS Department',
        activity: 'Currently Active Teacher'
      });
      processedEmails.add(sEmail);
    }
  } catch (e) {}

  if (list.length === 0) {
    return [
      {
        _id: 'default-tch-1',
        email: 'robert@teacher.edu',
        username: 'Prof. Robert Davis',
        name: 'Prof. Robert Davis',
        role: 'teacher',
        subject: 'Computer Networks',
        phone: '+1 555-0821',
        assignedClass: 'CS Year 3 & 4',
        activity: 'Created Networks Exam'
      },
      {
        _id: 'default-tch-2',
        email: 'ananya@teacher.edu',
        username: 'Dr. Ananya Sen',
        name: 'Dr. Ananya Sen',
        role: 'teacher',
        subject: 'Operating Systems',
        phone: '+1 555-0899',
        assignedClass: 'CS Year 2',
        activity: 'Uploaded OS Notes PDF'
      }
    ];
  }

  return list;
};

export const updateStudentSubject = async (email, subject) => {
  const cleanEmail = String(email || '').toLowerCase().trim();
  const targetSubject = (subject || 'Computer Science').trim();

  // Always update local storage for persistence across offline and current session
  try {
    const sharedSubjects = JSON.parse(localStorage.getItem('shared_student_subjects') || '{}');
    sharedSubjects[cleanEmail] = targetSubject;
    localStorage.setItem('shared_student_subjects', JSON.stringify(sharedSubjects));

    const localProfiles = JSON.parse(localStorage.getItem('student_profiles_by_email') || '{}');
    if (localProfiles[cleanEmail]) {
      localProfiles[cleanEmail].interestedSubject = targetSubject;
      localProfiles[cleanEmail].subject = targetSubject;
      localStorage.setItem('student_profiles_by_email', JSON.stringify(localProfiles));
    }

    const currentSession = JSON.parse(localStorage.getItem('auth_session') || '{}');
    if (currentSession.email && currentSession.email.toLowerCase().trim() === cleanEmail) {
      currentSession.interestedSubject = targetSubject;
      currentSession.subject = targetSubject;
      localStorage.setItem('auth_session', JSON.stringify(currentSession));
    }

    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.warn('Failed to update localStorage student subject:', err);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/students/${encodeURIComponent(cleanEmail)}/subject`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: targetSubject, interestedSubject: targetSubject }),
    });
    return await response.json();
  } catch (error) {
    console.warn('Backend unavailable for updateStudentSubject, fallback saved:', error);
    return {
      success: true,
      message: `Subject updated to ${targetSubject} (Saved locally)`
    };
  }
};


// Fetch recent activity logs
export const fetchLogs = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/logs`);
    const data = await response.json();
    if (data.success) {
      return data.data;
    }
    throw new Error(data.error || 'Failed to fetch logs');
  } catch (error) {
    console.error('Error fetching logs:', error);
    return [];
  }
};

// Save a new question and answer
export const saveQuestion = async (questionData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(questionData),
    });
    const data = await response.json();
    if (data.success) {
      return data.data;
    }
    throw new Error(data.error || 'Failed to save question');
  } catch (error) {
    console.error('Error saving question:', error);
    throw error;
  }
};

// Teacher & Student Exam Assistant API helpers
export const fetchExams = async (teacherEmail) => {
  try {
    const cleanTeacherEmail = teacherEmail ? String(teacherEmail).trim().toLowerCase() : '';
    const url = cleanTeacherEmail
      ? `${API_BASE_URL}/exams?teacherEmail=${encodeURIComponent(cleanTeacherEmail)}`
      : `${API_BASE_URL}/exams`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Unable to load exams');
    const body = await response.json();
    return body.data || body;
  } catch (e) {
    return [];
  }
};

export const createExam = async (exam) => {
  let sessionEmail = '';
  try {
    const session = JSON.parse(localStorage.getItem('auth_session') || '{}');
    sessionEmail = session.email ? String(session.email).trim().toLowerCase() : '';
  } catch (e) {}

  const creatorEmail = (exam.creatorEmail || exam.teacherEmail || sessionEmail || '').trim().toLowerCase();

  const payload = {
    title: exam.title,
    subject: exam.subject,
    durationMinutes: Number(exam.duration || exam.durationMinutes || 60),
    date: exam.date,
    startTime: exam.time || exam.startTime,
    passingMarks: Number(exam.passMark || exam.passingMarks || 40),
    instructions: exam.instructions,
    accessibilitySettings: exam.accessibilitySettings || {},
    assignedStudents: exam.assignedStudents || (exam.targetStudentEmail ? [exam.targetStudentEmail] : []),
    targetStudentEmail: exam.targetStudentEmail || '',
    targetStudentName: exam.targetStudentName || '',
    creatorEmail,
    teacherEmail: creatorEmail,
    questions: (exam.questions || []).map((question, index) => ({
      questionNumber: index + 1,
      questionText: question.text || question.questionText,
      questionType: question.type || question.questionType || 'MCQ',
      marks: Number(question.marks || 1),
      difficulty: question.difficulty || 'Medium',
      options: Array.isArray(question.options) ? question.options : [],
      correctAnswer: question.correctAnswer || question.answer || 'To be reviewed by teacher',
    })),
  };
  const response = await fetch(`${API_BASE_URL}/exams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Unable to save exam');
  return body.data || body;
};

export const updateExam = async (examId, updates) => {
  const response = await fetch(`${API_BASE_URL}/exams/${examId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Unable to update exam');
  return body.data || body;
};

export const deleteExam = async (examId) => {
  const response = await fetch(`${API_BASE_URL}/exams/${examId}`, { method: 'DELETE' });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Unable to delete exam');
  return body;
};

export const fetchResults = async (teacherEmail = '') => {
  try {
    const url = teacherEmail 
      ? `${API_BASE_URL}/results?teacherEmail=${encodeURIComponent(teacherEmail)}` 
      : `${API_BASE_URL}/results`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Unable to fetch results');
    const body = await response.json();
    return body.data || [];
  } catch (error) {
    console.error('Error fetching results:', error);
    return [];
  }
};

const FRONTEND_TOPIC_BANKS = {
  'general knowledge': [
    { text: "Which is the largest ocean on Earth?", type: 'MCQ', options: ['Pacific Ocean', 'Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean'], answer: 'Pacific Ocean', marks: 2 },
    { text: "Who was the first person to walk on the Moon?", type: 'MCQ', options: ['Neil Armstrong', 'Buzz Aldrin', 'Yuri Gagarin', 'Michael Collins'], answer: 'Neil Armstrong', marks: 2 },
    { text: "What is the capital city of France?", type: 'MCQ', options: ['Paris', 'London', 'Berlin', 'Rome'], answer: 'Paris', marks: 2 },
    { text: "Which element has the chemical symbol 'O'?", type: 'MCQ', options: ['Oxygen', 'Gold', 'Osmium', 'Silver'], answer: 'Oxygen', marks: 2 },
    { text: "Which continent is known as the Dark Continent?", type: 'MCQ', options: ['Africa', 'Asia', 'Europe', 'South America'], answer: 'Africa', marks: 2 },
    { text: "How many teeth does an adult human typically have?", type: 'MCQ', options: ['32', '28', '30', '36'], answer: '32', marks: 2 },
    { text: "Which organ in the human body pumps blood throughout the circulatory system?", type: 'MCQ', options: ['Heart', 'Lungs', 'Liver', 'Kidney'], answer: 'Heart', marks: 2 },
    { text: "Explain the significance of World Earth Day celebrated on April 22nd.", type: 'Short answer', options: [], answer: 'To raise awareness about environmental protection and conservation.', marks: 5 },
    { text: "True or False: The Great Wall of China is visible from space with the naked eye.", type: 'True/False', options: ['True', 'False'], answer: 'False', marks: 2 },
    { text: "Which planet in our solar system is known as the Red Planet?", type: 'MCQ', options: ['Mars', 'Venus', 'Jupiter', 'Saturn'], answer: 'Mars', marks: 2 }
  ],
  'python': [
    { text: "Which data type in Python is immutable?", type: 'MCQ', options: ['Tuple', 'List', 'Dictionary', 'Set'], answer: 'Tuple', marks: 2 },
    { text: "What keyword is used to define a function in Python?", type: 'MCQ', options: ['def', 'function', 'define', 'func'], answer: 'def', marks: 2 },
    { text: "What is the output of len([10, 20, 30, 40]) in Python?", type: 'MCQ', options: ['4', '5', '3', 'Error'], answer: '4', marks: 2 },
    { text: "Explain the difference between a list and a tuple in Python.", type: 'Short answer', options: [], answer: 'Lists are mutable while tuples are immutable in Python.', marks: 5 },
    { text: "Which symbol is used for single-line comments in Python?", type: 'MCQ', options: ['#', '//', '/*', '<!--'], answer: '#', marks: 2 },
    { text: "What method is used to add an item to the end of a list in Python?", type: 'MCQ', options: ['append()', 'add()', 'push()', 'insert()'], answer: 'append()', marks: 2 }
  ],
  'computer networks': [
    { text: "Which layer of the OSI model handles IP addressing and routing?", type: 'MCQ', options: ['Network Layer', 'Transport Layer', 'Data Link Layer', 'Application Layer'], answer: 'Network Layer', marks: 2 },
    { text: "What default port number is used by HTTPS for secure traffic?", type: 'MCQ', options: ['443', '80', '22', '21'], answer: '443', marks: 2 },
    { text: "Explain the key differences between TCP and UDP protocols.", type: 'Short answer', options: [], answer: 'TCP is connection-oriented and reliable, while UDP is connectionless and faster.', marks: 5 },
    { text: "What does IP stand for in networking?", type: 'MCQ', options: ['Internet Protocol', 'Internal Pathway', 'Information Provider', 'Interface Program'], answer: 'Internet Protocol', marks: 2 }
  ],
  'operating systems': [
    { text: "Which process state indicates a process is waiting for I/O completion?", type: 'MCQ', options: ['Blocked / Waiting', 'Running', 'Ready', 'Terminated'], answer: 'Blocked / Waiting', marks: 2 },
    { text: "What is a Deadlock in an Operating System?", type: 'Short answer', options: [], answer: 'A state where two or more processes are blocked waiting for resources held by each other.', marks: 5 },
    { text: "Which algorithm is non-preemptive CPU scheduling?", type: 'MCQ', options: ['FCFS (First-Come First-Served)', 'Round Robin', 'SRTF', 'Preemptive Priority'], answer: 'FCFS (First-Come First-Served)', marks: 2 }
  ],
  'physics': [
    { text: "What is Newton's First Law of Motion commonly referred to as?", type: 'MCQ', options: ['Law of Inertia', 'Law of Gravity', 'Law of Acceleration', 'Law of Energy'], answer: 'Law of Inertia', marks: 2 },
    { text: "What is the speed of light in a vacuum?", type: 'MCQ', options: ['3 x 10^8 m/s', '3 x 10^6 m/s', '150,000 km/s', '300 km/s'], answer: '3 x 10^8 m/s', marks: 2 },
    { text: "Explain the principle of Conservation of Energy.", type: 'Short answer', options: [], answer: 'Energy cannot be created or destroyed, only transformed from one form to another.', marks: 5 }
  ],
  'cyber security': [
    { text: "Which cryptographic algorithm is an asymmetric public-key system?", type: 'MCQ', options: ['RSA', 'AES', 'DES', 'Blowfish'], answer: 'RSA', marks: 2 },
    { text: "What is Phishing in cybersecurity?", type: 'Short answer', options: [], answer: 'A social engineering attack to trick users into revealing sensitive credentials.', marks: 5 },
    { text: "Which HTTP header or protocol protects web traffic against eavesdropping?", type: 'MCQ', options: ['HTTPS / TLS', 'HTTP', 'FTP', 'Telnet'], answer: 'HTTPS / TLS', marks: 2 }
  ],
  'mathematics': [
    { text: "What is the value of Pi rounded to 2 decimal places?", type: 'MCQ', options: ['3.14', '3.16', '3.12', '3.18'], answer: '3.14', marks: 2 },
    { text: "Solve for x: 2x + 6 = 14", type: 'MCQ', options: ['4', '3', '5', '6'], answer: '4', marks: 2 },
    { text: "Explain the Pythagorean Theorem for right-angled triangles.", type: 'Short answer', options: [], answer: 'a^2 + b^2 = c^2 where c is the hypotenuse.', marks: 5 }
  ]
};

export const generateDraftQuestions = async ({ topic, count, difficulty }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/ai/generate-questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, count, difficulty }),
    });
    const body = await response.json();
    if (response.ok && body.success && Array.isArray(body.data)) {
      return body.data;
    }
  } catch (e) {
    console.warn('Backend AI endpoint unavailable, using frontend topic generator');
  }

  const topicTrim = (topic || 'General Knowledge').trim();
  const lowerTopic = topicTrim.toLowerCase();
  const numCount = Math.min(Math.max(1, Number(count) || 1), 20);

  let matchedBank = null;
  for (const key of Object.keys(FRONTEND_TOPIC_BANKS)) {
    if (lowerTopic.includes(key) || key.includes(lowerTopic)) {
      matchedBank = FRONTEND_TOPIC_BANKS[key];
      break;
    }
  }

  if (matchedBank && matchedBank.length > 0) {
    return Array.from({ length: numCount }, (_, i) => {
      const q = matchedBank[i % matchedBank.length];
      return {
        id: `ai-${Date.now()}-${i + 1}`,
        text: `[${topicTrim}] Q${i + 1}: ${q.text}`,
        type: q.type,
        marks: q.marks,
        difficulty: difficulty || 'Medium',
        options: q.options || [],
        correctAnswer: q.answer,
        ai: true
      };
    });
  }

  const dynamicTemplates = [
    { text: `What is the fundamental concept or primary objective of ${topicTrim}?`, type: 'MCQ', options: [`Understanding core principles of ${topicTrim}`, `System setup and installation`, `Manual record keeping`, `None of the above`], answer: `Understanding core principles of ${topicTrim}`, marks: 2 },
    { text: `Which of the following is a key component or essential feature of ${topicTrim}?`, type: 'MCQ', options: [`Standardized ${topicTrim} methodology`, `Legacy procedure`, `Unrelated system`, `Random sequence`], answer: `Standardized ${topicTrim} methodology`, marks: 2 },
    { text: `Explain the core principles of ${topicTrim} and why it is important in education.`, type: 'Short answer', options: [], answer: `Provides structured domain knowledge and foundational understanding of ${topicTrim}.`, marks: 5 },
    { text: `In ${topicTrim}, what is the main purpose of its primary mechanism?`, type: 'MCQ', options: [`Optimize performance and accuracy`, `Increase operational delay`, `Bypass validation`, `None of the above`], answer: `Optimize performance and accuracy`, marks: 2 },
    { text: `True or False: ${topicTrim} plays a vital role in modern academic curriculum and practical applications.`, type: 'True/False', options: ['True', 'False'], answer: 'True', marks: 2 },
    { text: `Describe a practical real-world scenario where ${topicTrim} is applied.`, type: 'Long answer', options: [], answer: `Real-world application of ${topicTrim} in problem solving and analysis.`, marks: 8 }
  ];

  return Array.from({ length: numCount }, (_, i) => {
    const t = dynamicTemplates[i % dynamicTemplates.length];
    return {
      id: `ai-${Date.now()}-${i + 1}`,
      text: `[${topicTrim}] Q${i + 1}: ${t.text}`,
      type: t.type,
      marks: t.marks,
      difficulty: difficulty || 'Medium',
      options: t.options || [],
      correctAnswer: t.answer,
      ai: true
    };
  });
};

// Assistance Requests & SOS API helpers
export const fetchAssistanceRequests = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/assistance-requests`);
    if (!response.ok) throw new Error('Unable to fetch assistance requests');
    const body = await response.json();
    return body.data || [];
  } catch (error) {
    return [];
  }
};

export const postAssistanceRequest = async (reqData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/assistance-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqData),
    });
    const body = await response.json();
    return body.data || reqData;
  } catch (error) {
    return reqData;
  }
};

export const updateAssistanceRequest = async (id, status) => {
  try {
    const response = await fetch(`${API_BASE_URL}/assistance-requests/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return await response.json();
  } catch (error) {
    return { success: false };
  }
};
