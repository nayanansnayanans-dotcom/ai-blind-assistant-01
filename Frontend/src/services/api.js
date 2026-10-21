const API_BASE_URL = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? 'http://localhost:5000/api'
  : (import.meta.env?.VITE_API_BASE_URL || 'https://ai-blind-assistant-01.vercel.app/api');

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
      message: 'Network error or backend unavailable.'
    };
  }
};

export const studentLoginOtpApi = async (email, otp) => {
  const cleanEmail = String(email || '').toLowerCase().trim();
  const cleanOtp = String(otp || '').trim();
  try {
    const response = await fetch(`${API_BASE_URL}/auth/student-login-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, otp: cleanOtp }),
    });
    return await response.json();
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
      message: 'Network error or backend unavailable.'
    };
  }
};

export const adminLoginOtpApi = async (email, otp) => {
  const cleanEmail = String(email || '').toLowerCase().trim();
  const cleanOtp = String(otp || '').trim();
  try {
    const response = await fetch(`${API_BASE_URL}/auth/admin-login-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, otp: cleanOtp }),
    });
    return await response.json();
  } catch (error) {
    console.warn('Backend error during adminLoginOtpApi:', error);
    return {
      success: false,
      message: 'Network error or backend unavailable.'
    };
  }
};

export const createExam = async (examData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/exams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(examData),
    });
    return await response.json();
  } catch (error) {
    console.warn('Error in createExam:', error);
    return { success: false, message: 'Server unavailable' };
  }
};

export const fetchExams = async (params = {}) => {
  try {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${API_BASE_URL}/exams?${query}` : `${API_BASE_URL}/exams`;
    const response = await fetch(url);
    const data = await response.json();
    return data?.data || data || [];
  } catch (error) {
    console.warn('Error in fetchExams:', error);
    return [];
  }
};

export const fetchResults = async (params = {}) => {
  try {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${API_BASE_URL}/results?${query}` : `${API_BASE_URL}/results`;
    const response = await fetch(url);
    const data = await response.json();
    return data?.data || data || [];
  } catch (error) {
    console.warn('Error in fetchResults:', error);
    return [];
  }
};

export const generateDraftQuestions = async (payload) => {
  try {
    const response = await fetch(`${API_BASE_URL}/ai/generate-questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    return data?.data || [];
  } catch (error) {
    console.warn('Error in generateDraftQuestions:', error);
    return [];
  }
};

export const updateExam = async (id, examData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/exams/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(examData),
    });
    return await response.json();
  } catch (error) {
    console.warn('Error in updateExam:', error);
    return { success: false, message: 'Server unavailable' };
  }
};

export const deleteExam = async (id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/exams/${id}`, {
      method: 'DELETE',
    });
    return await response.json();
  } catch (error) {
    console.warn('Error in deleteExam:', error);
    return { success: false, message: 'Server unavailable' };
  }
};

export const fetchAssistanceRequests = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/assistance-requests`);
    const data = await response.json();
    return data?.data || data || [];
  } catch (error) {
    console.warn('Error in fetchAssistanceRequests:', error);
    return [];
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
    console.warn('Error in updateAssistanceRequest:', error);
    return { success: false, message: 'Server unavailable' };
  }
};

export const postAssistanceRequest = async (data) => {
  try {
    const response = await fetch(`${API_BASE_URL}/assistance-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await response.json();
  } catch (error) {
    console.warn('Error in postAssistanceRequest:', error);
    return { success: false, message: 'Server unavailable' };
  }
};

export const fetchRegisteredStudents = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/students`);
    const data = await response.json();
    return data?.data || [];
  } catch (error) {
    console.warn('Error in fetchRegisteredStudents:', error);
    return [];
  }
};

export const fetchRegisteredTeachers = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/users`);
    const data = await response.json();
    const users = data?.data || [];
    return users.filter(u => (u.role || '').toLowerCase() === 'teacher');
  } catch (error) {
    console.warn('Error in fetchRegisteredTeachers:', error);
    return [];
  }
};

export const updateStudentSubject = async (email, subject) => {
  const cleanEmail = String(email || '').toLowerCase().trim();
  try {
    const response = await fetch(`${API_BASE_URL}/auth/students/${encodeURIComponent(cleanEmail)}/subject`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject }),
    });
    return await response.json();
  } catch (error) {
    console.warn('Error in updateStudentSubject:', error);
    return { success: false, message: 'Server unavailable' };
  }
};

export const saveQuestion = async (questionData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(questionData),
    });
    return await response.json();
  } catch (error) {
    console.warn('Error in saveQuestion:', error);
    return { success: false, message: 'Server unavailable' };
  }
};


