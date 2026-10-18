import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import RoleSelectionLoginPage from './components/RoleSelectionLoginPage.jsx';
import StudentLoginPage from './components/StudentLoginPage.jsx';
import StudentRegistrationPage from './components/StudentRegistrationPage.jsx';
import TeacherLoginPage from './components/TeacherLoginPage.jsx';
import TeacherRegistrationPage from './components/TeacherRegistrationPage.jsx';
import AdminLoginPage from './components/AdminLoginPage.jsx';
import VoiceLoginPage from './components/VoiceLoginPage.jsx';
import VoiceRegistrationPage from './components/VoiceRegistration.jsx';
import ForgotPassword from './components/ForgotPassword.jsx';
import HomePage from './components/HomePage.jsx';
import StudentDashboard from './components/StudentDashboard.jsx';
import TeacherDashboard from './components/TeacherDashboard.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import ExamPortalPage from './pages/ExamPortalPage.jsx';

export default function App() {
  return (
    <Router>
      <Routes>
        {/* 1. FIRST: HOME PAGE */}
        <Route path="/" element={<HomePage />} />
        <Route path="/home" element={<HomePage />} />

        {/* 2. THEN: LOGIN PAGES */}
        <Route path="/login" element={<RoleSelectionLoginPage />} />
        <Route path="/role-login" element={<RoleSelectionLoginPage />} />
        <Route path="/voice-login" element={<VoiceLoginPage />} />
        <Route path="/student-login" element={<StudentLoginPage />} />
        <Route path="/teacher-login" element={<TeacherLoginPage />} />
        <Route path="/admin-login" element={<AdminLoginPage />} />

        {/* 3. IF ACCOUNT IS NOT CREATED: REGISTRATION PAGES */}
        <Route path="/register" element={<StudentRegistrationPage />} />
        <Route path="/student-register" element={<StudentRegistrationPage />} />
        <Route path="/teacher-register" element={<TeacherRegistrationPage />} />
        <Route path="/voice-register" element={<VoiceRegistrationPage />} />
        
        {/* Password Recovery */}
        <Route path="/forgot-password" element={<ForgotPassword />} />
        
        {/* Dashboards & Portals */}
        <Route path="/dashboard" element={<StudentDashboard />} />
        <Route path="/student-dashboard" element={<StudentDashboard />} />
        <Route path="/teacher-dashboard" element={<TeacherDashboard />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/exam-portal" element={<ExamPortalPage />} />
      </Routes>
    </Router>
  );
}