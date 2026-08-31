import { lazy, Suspense, type ReactNode, type ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AuthLayout } from '../layouts/AuthLayout';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ProtectedRoute } from './protected-route';
import { Spinner } from '../components/ui/Loading';

// Dynamic-import chunks can fail to load after a new deploy (old hashed filename
// gone) or when a browser extension hijacks the import. Recover by reloading once.
function lazyWithRetry<T extends { default: ComponentType<unknown> }>(
  factory: () => Promise<T>,
) {
  const KEY = 'chunk-reload-once';
  return lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(KEY); // loaded fine → allow a future retry
      return mod;
    } catch (err) {
      if (!sessionStorage.getItem(KEY)) {
        sessionStorage.setItem(KEY, '1');
        window.location.reload();
        // Never resolves — the reload takes over.
        return await new Promise<T>(() => {});
      }
      throw err;
    }
  });
}

// Heavy, self-contained routes are code-split so they don't bloat the initial bundle.
const LandingPage = lazyWithRetry(() => import('../pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const StudentGamesPage = lazyWithRetry(() => import('../pages/student/StudentGamesPage').then((m) => ({ default: m.StudentGamesPage })));
const ClassRoomPage = lazyWithRetry(() => import('../features/live-class/ClassRoomPage').then((m) => ({ default: m.ClassRoomPage })));

const lazyEl = (node: ReactNode): ReactNode => (
  <Suspense fallback={<div className="flex h-screen items-center justify-center"><Spinner /></div>}>{node}</Suspense>
);

// Auth
import { LoginPage } from '../pages/auth/Login';
import { RegisterPage } from '../pages/auth/Register';
import { RegisterStudentPage } from '../pages/auth/RegisterStudent';
import { RegisterTutorPage } from '../pages/auth/RegisterTutor';
import { RegisterPrincipalPage } from '../pages/auth/RegisterPrincipal';
import { RegisterParentPage } from '../pages/auth/RegisterParent';
import { ForgotPasswordPage } from '../pages/auth/ForgotPassword';
import { ResetPasswordPage } from '../pages/auth/ResetPassword';
import { VerifyEmailPage } from '../pages/auth/VerifyEmail';
import { AcceptInvitePage } from '../pages/auth/AcceptInvite';

// Dashboards
import { SuperAdminDashboard } from '../pages/dashboards/SuperAdminDashboard';
import { AdminDashboard } from '../pages/dashboards/AdminDashboard';
import { PrincipalDashboard } from '../pages/dashboards/PrincipalDashboard';
import { TutorDashboard } from '../pages/dashboards/TutorDashboard';
import { StudentDashboard } from '../pages/dashboards/StudentDashboard';
import { SupportDashboard } from '../pages/dashboards/SupportDashboard';
import { ParentDashboard } from '../pages/dashboards/ParentDashboard';

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
import { PrincipalClassesPage } from '../pages/principal/PrincipalClassesPage';
import { PrincipalContentPage } from '../pages/principal/PrincipalContentPage';

// Tutor pages
import { TutorPrincipalsPage } from '../pages/tutor/TutorPrincipalsPage';
import { TutorClassesPage } from '../pages/tutor/TutorClassesPage';
import { ClassDetailPage } from '../pages/shared/ClassDetailPage';
import { TutorSchedulePage } from '../pages/tutor/TutorSchedulePage';
import { TutorStudentsPage } from '../pages/tutor/TutorStudentsPage';
import { TutorAssignmentsPage } from '../pages/tutor/TutorAssignmentsPage';
import { TutorWorksheetsPage } from '../pages/tutor/TutorWorksheetsPage';
import { TutorAttendancePage } from '../pages/tutor/TutorAttendancePage';
import { TutorProgressPage } from '../pages/tutor/TutorProgressPage';
import { TutorWalletPage } from '../pages/tutor/TutorWalletPage';
import { TutorDemoRequestsPage } from '../pages/tutor/TutorDemoRequestsPage';
import { TutorResourcesPage } from '../pages/tutor/TutorResourcesPage';
import { TutorWorksheetResultsPage } from '../pages/tutor/TutorWorksheetResultsPage';
import { TutorCreateClassPage } from '../pages/tutor/TutorCreateClassPage';

// Student pages
import { StudentMyTutorPage } from '../pages/student/StudentMyTutorPage';
import { StudentPrincipalPage } from '../pages/student/StudentPrincipalPage';
import { StudentLearningPage } from '../pages/student/StudentLearningPage';
import { StudentAssignmentsPage } from '../pages/student/StudentAssignmentsPage';
import { StudentAttendancePage } from '../pages/student/StudentAttendancePage';
import { StudentProgressPage } from '../pages/student/StudentProgressPage';
import { StudentWalletPage } from '../pages/student/StudentWalletPage';
import { StudentWorksheetsPage } from '../pages/student/StudentWorksheetsPage';
import { StudentWorksheetTestPage } from '../pages/student/StudentWorksheetTestPage';
import { StudentResourcesPage } from '../pages/student/StudentResourcesPage';
import { StudentParentRequestsPage } from '../pages/student/StudentParentRequestsPage';

// Parent pages
import { ParentChildrenPage } from '../pages/parent/ParentChildrenPage';
import { ParentChildDetailPage } from '../pages/parent/ParentChildDetailPage';
import { ParentClassesPage } from '../pages/parent/ParentClassesPage';
import { ParentAttendancePage } from '../pages/parent/ParentAttendancePage';
import { ParentAssignmentsPage } from '../pages/parent/ParentAssignmentsPage';
import { ParentWorksheetsPage } from '../pages/parent/ParentWorksheetsPage';
import { ParentProgressPage } from '../pages/parent/ParentProgressPage';
import { ParentTutorsPage } from '../pages/parent/ParentTutorsPage';
import { ParentPrincipalsPage } from '../pages/parent/ParentPrincipalsPage';

// Support pages
import { SupportTicketsPage } from '../pages/support/SupportTicketsPage';
import { SupportAccountsPage } from '../pages/support/SupportAccountsPage';

// Live class

// Chat
import { ChatPage } from '../pages/shared/ChatPage';

// Shared
import { TutorsBrowsePage } from '../pages/shared/TutorsBrowsePage';
import { ProfilePage } from '../pages/shared/ProfilePage';

// ─── Lazy parent aggregate views ─────────────────────────────────────────────
// These show data across all children combined (picked from the first child or
// aggregated). We reuse ParentChildDetailPage with a special "all" param.

export const router = createBrowserRouter([
  { path: '/', element: lazyEl(<LandingPage />) },
  { path: '/tutors', element: <TutorsBrowsePage variant="public" /> },

  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/register/student', element: <RegisterStudentPage /> },
      { path: '/register/tutor', element: <RegisterTutorPage /> },
      { path: '/register/principal', element: <RegisterPrincipalPage /> },
      { path: '/register/parent', element: <RegisterParentPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/verify-email', element: <VerifyEmailPage /> },
      { path: '/accept-invite', element: <AcceptInvitePage /> },
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
        { path: '/dashboard/principal/classes', element: <PrincipalClassesPage /> },
        { path: '/dashboard/principal/content', element: <PrincipalContentPage /> },
        { path: '/dashboard/principal/analytics', element: <PrincipalAnalyticsPage /> },
        { path: '/dashboard/principal/wallet', element: <PrincipalWalletPage /> },
        // Principal teaching reuses tutor pages (principal acts as a tutor)
        { path: '/dashboard/principal/teach/schedule', element: <TutorSchedulePage /> },
        { path: '/dashboard/principal/teach/classes', element: <TutorClassesPage /> },
        { path: '/dashboard/principal/teach/classes/create', element: <TutorCreateClassPage /> },
        { path: '/dashboard/principal/teach/students', element: <TutorStudentsPage /> },
        { path: '/dashboard/principal/teach/assignments', element: <TutorAssignmentsPage /> },
        { path: '/dashboard/principal/teach/worksheets', element: <TutorWorksheetsPage /> },
        { path: '/dashboard/principal/teach/worksheets/:worksheetId/results', element: <TutorWorksheetResultsPage /> },
        { path: '/dashboard/principal/teach/attendance', element: <TutorAttendancePage /> },
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
        { path: '/dashboard/tutor/demo-requests', element: <TutorDemoRequestsPage /> },
        { path: '/dashboard/tutor/principals', element: <TutorPrincipalsPage /> },
        { path: '/dashboard/tutor/classes', element: <TutorClassesPage /> },
        { path: '/dashboard/tutor/classes/create', element: <TutorCreateClassPage /> },
        { path: '/dashboard/tutor/classes/:classId', element: <ClassDetailPage /> },
        { path: '/dashboard/tutor/schedule', element: <TutorSchedulePage /> },
        { path: '/dashboard/tutor/students', element: <TutorStudentsPage /> },
        { path: '/dashboard/tutor/assignments', element: <TutorAssignmentsPage /> },
        { path: '/dashboard/tutor/worksheets', element: <TutorWorksheetsPage /> },
        { path: '/dashboard/tutor/worksheets/:worksheetId/results', element: <TutorWorksheetResultsPage /> },
        { path: '/dashboard/tutor/resources', element: <TutorResourcesPage /> },
        { path: '/dashboard/tutor/attendance', element: <TutorAttendancePage /> },
        { path: '/dashboard/tutor/progress', element: <TutorProgressPage /> },
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
        { path: '/dashboard/student/my-tutor', element: <StudentMyTutorPage /> },
        { path: '/dashboard/student/my-organization', element: <StudentPrincipalPage /> },
        { path: '/dashboard/student/tutors', element: <TutorsBrowsePage variant="student" /> },
        { path: '/dashboard/student/classes', element: <StudentLearningPage /> },
        { path: '/dashboard/student/assignments', element: <StudentAssignmentsPage /> },
        { path: '/dashboard/student/worksheets', element: <StudentWorksheetsPage /> },
        { path: '/dashboard/student/worksheets/:worksheetId/test', element: <StudentWorksheetTestPage /> },
        { path: '/dashboard/student/resources', element: <StudentResourcesPage /> },
        { path: '/dashboard/student/games', element: lazyEl(<StudentGamesPage />) },
        { path: '/dashboard/student/attendance', element: <StudentAttendancePage /> },
        { path: '/dashboard/student/progress', element: <StudentProgressPage /> },
        { path: '/dashboard/student/wallet', element: <StudentWalletPage /> },
        { path: '/dashboard/student/parent-requests', element: <StudentParentRequestsPage /> },
      ],
    }],
  },

  // ─── Parent ───────────────────────────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['PARENT']} />,
    children: [{
      element: <DashboardLayout />,
      children: [
        { path: '/dashboard/parent', element: <ParentDashboard /> },
        { path: '/dashboard/parent/children', element: <ParentChildrenPage /> },
        { path: '/dashboard/parent/children/:studentPublicId', element: <ParentChildDetailPage /> },
        { path: '/dashboard/parent/tutors', element: <ParentTutorsPage /> },
        { path: '/dashboard/parent/principals', element: <ParentPrincipalsPage /> },
        { path: '/dashboard/parent/classes', element: <ParentClassesPage /> },
        { path: '/dashboard/parent/attendance', element: <ParentAttendancePage /> },
        { path: '/dashboard/parent/assignments', element: <ParentAssignmentsPage /> },
        { path: '/dashboard/parent/worksheets', element: <ParentWorksheetsPage /> },
        { path: '/dashboard/parent/progress', element: <ParentProgressPage /> },
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

  // ─── Chat + Profile (shared across all authenticated roles) ──────────────
  {
    element: <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'PRINCIPAL', 'TUTOR', 'STUDENT', 'SUPPORT', 'PARENT']} />,
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
      { path: '/class/:classPublicId', element: lazyEl(<ClassRoomPage />) },
    ],
  },

  { path: '*', element: <Navigate to="/" replace /> },
]);
