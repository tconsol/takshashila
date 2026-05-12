import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ProtectedRoute } from './protected-route';

// Landing
import { LandingPage } from '../pages/LandingPage';

// Auth
import { LoginPage } from '../pages/auth/Login';
import { RegisterPage } from '../pages/auth/Register';
import { RegisterStudentPage } from '../pages/auth/RegisterStudent';
import { RegisterTutorPage } from '../pages/auth/RegisterTutor';
import { RegisterPrincipalPage } from '../pages/auth/RegisterPrincipal';
import { ForgotPasswordPage } from '../pages/auth/ForgotPassword';

// Dashboards
import { SuperAdminDashboard } from '../pages/dashboards/SuperAdminDashboard';
import { AdminDashboard } from '../pages/dashboards/AdminDashboard';
import { PrincipalDashboard } from '../pages/dashboards/PrincipalDashboard';
import { TutorDashboard } from '../pages/dashboards/TutorDashboard';
import { StudentDashboard } from '../pages/dashboards/StudentDashboard';
import { SupportDashboard } from '../pages/dashboards/SupportDashboard';

// SuperAdmin pages
import { SuperAdminAdminsPage } from '../pages/superadmin/SuperAdminAdminsPage';
import { SuperAdminAnalyticsPage } from '../pages/superadmin/SuperAdminAnalyticsPage';
import { SuperAdminAuditPage } from '../pages/superadmin/SuperAdminAuditPage';
import { SuperAdminSettingsPage } from '../pages/superadmin/SuperAdminSettingsPage';

// Admin pages
import { AdminPrincipalsPage } from '../pages/admin/AdminPrincipalsPage';
import { AdminAnalyticsPage } from '../pages/admin/AdminAnalyticsPage';
import { PrincipalTutorsPage } from '../pages/principal/PrincipalTutorsPage';
import { PrincipalStudentsPage } from '../pages/principal/PrincipalStudentsPage';

// Principal pages
import { PrincipalAnalyticsPage } from '../pages/principal/PrincipalAnalyticsPage';
import { PrincipalWalletPage } from '../pages/principal/PrincipalWalletPage';

// Tutor pages
import { TutorClassesPage } from '../pages/tutor/TutorClassesPage';
import { TutorSchedulePage } from '../pages/tutor/TutorSchedulePage';
import { TutorStudentsPage } from '../pages/tutor/TutorStudentsPage';
import { TutorAssignmentsPage } from '../pages/tutor/TutorAssignmentsPage';
import { TutorWalletPage } from '../pages/tutor/TutorWalletPage';

// Student pages
import { StudentClassesPage } from '../pages/student/StudentClassesPage';
import { StudentAssignmentsPage } from '../pages/student/StudentAssignmentsPage';
import { StudentProgressPage } from '../pages/student/StudentProgressPage';
import { StudentWalletPage } from '../pages/student/StudentWalletPage';

// Support pages
import { SupportTicketsPage } from '../pages/support/SupportTicketsPage';
import { SupportAccountsPage } from '../pages/support/SupportAccountsPage';

// Live class
import { ClassRoomPage } from '../features/live-class/ClassRoomPage';

// Chat
import { ChatPage } from '../pages/shared/ChatPage';

// Shared (public-friendly)
import { TutorsBrowsePage } from '../pages/shared/TutorsBrowsePage';
import { ProfilePage } from '../pages/shared/ProfilePage';

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/tutors', element: <TutorsBrowsePage variant="public" /> },

  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/register/student', element: <RegisterStudentPage /> },
      { path: '/register/tutor', element: <RegisterTutorPage /> },
      { path: '/register/principal', element: <RegisterPrincipalPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
    ],
  },

  // ─── Super Admin ──────────────────────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['SUPER_ADMIN']} />,
    children: [{
      element: <DashboardLayout />,
      children: [
        { path: '/dashboard/super-admin', element: <SuperAdminDashboard /> },
        { path: '/dashboard/super-admin/admins', element: <SuperAdminAdminsPage /> },
        { path: '/dashboard/super-admin/analytics', element: <SuperAdminAnalyticsPage /> },
        { path: '/dashboard/super-admin/audit', element: <SuperAdminAuditPage /> },
        { path: '/dashboard/super-admin/settings', element: <SuperAdminSettingsPage /> },
      ],
    }],
  },

  // ─── Admin ────────────────────────────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['ADMIN']} />,
    children: [{
      element: <DashboardLayout />,
      children: [
        { path: '/dashboard/admin', element: <AdminDashboard /> },
        { path: '/dashboard/admin/principals', element: <AdminPrincipalsPage /> },
        { path: '/dashboard/admin/tutors', element: <PrincipalTutorsPage /> },
        { path: '/dashboard/admin/analytics', element: <AdminAnalyticsPage /> },
        { path: '/dashboard/admin/support', element: <SupportTicketsPage /> },
      ],
    }],
  },

  // ─── Principal ────────────────────────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['PRINCIPAL']} />,
    children: [{
      element: <DashboardLayout />,
      children: [
        { path: '/dashboard/principal', element: <PrincipalDashboard /> },
        { path: '/dashboard/principal/tutors', element: <PrincipalTutorsPage /> },
        { path: '/dashboard/principal/students', element: <PrincipalStudentsPage /> },
        { path: '/dashboard/principal/analytics', element: <PrincipalAnalyticsPage /> },
        { path: '/dashboard/principal/wallet', element: <PrincipalWalletPage /> },
      ],
    }],
  },

  // ─── Tutor ────────────────────────────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['TUTOR']} />,
    children: [{
      element: <DashboardLayout />,
      children: [
        { path: '/dashboard/tutor', element: <TutorDashboard /> },
        { path: '/dashboard/tutor/classes', element: <TutorClassesPage /> },
        { path: '/dashboard/tutor/schedule', element: <TutorSchedulePage /> },
        { path: '/dashboard/tutor/students', element: <TutorStudentsPage /> },
        { path: '/dashboard/tutor/assignments', element: <TutorAssignmentsPage /> },
        { path: '/dashboard/tutor/wallet', element: <TutorWalletPage /> },
      ],
    }],
  },

  // ─── Student ──────────────────────────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['STUDENT']} />,
    children: [{
      element: <DashboardLayout />,
      children: [
        { path: '/dashboard/student', element: <StudentDashboard /> },
        { path: '/dashboard/student/tutors', element: <TutorsBrowsePage variant="student" /> },
        { path: '/dashboard/student/classes', element: <StudentClassesPage /> },
        { path: '/dashboard/student/assignments', element: <StudentAssignmentsPage /> },
        { path: '/dashboard/student/progress', element: <StudentProgressPage /> },
        { path: '/dashboard/student/wallet', element: <StudentWalletPage /> },
      ],
    }],
  },

  // ─── Support ──────────────────────────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['SUPPORT']} />,
    children: [{
      element: <DashboardLayout />,
      children: [
        { path: '/dashboard/support', element: <SupportDashboard /> },
        { path: '/dashboard/support/tickets', element: <SupportTicketsPage /> },
        { path: '/dashboard/support/accounts', element: <SupportAccountsPage /> },
      ],
    }],
  },

  // ─── Chat + Profile (shared across all authenticated roles) ─────────────────
  {
    element: <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'PRINCIPAL', 'TUTOR', 'STUDENT', 'SUPPORT']} />,
    children: [{
      element: <DashboardLayout />,
      children: [
        { path: '/chat', element: <ChatPage /> },
        { path: '/chat/:conversationId', element: <ChatPage /> },
        { path: '/profile', element: <ProfilePage /> },
      ],
    }],
  },

  // Class room (full screen, auth-gated)
  {
    element: <ProtectedRoute allowedRoles={['TUTOR', 'STUDENT', 'PRINCIPAL', 'ADMIN', 'SUPER_ADMIN', 'SUPPORT']} />,
    children: [
      { path: '/class/:classPublicId', element: <ClassRoomPage /> },
    ],
  },

  { path: '*', element: <Navigate to="/" replace /> },
]);
