import { GraduationCap, Star, MessageSquare, BookOpen, Users, Clock, CheckCircle, Mail, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { useMyStudentProfile, useMyTutor, useAcceptInvite, useDeclineInvite } from '../../hooks/use-students';
import { Spinner } from '../../components/ui/Loading';

export function StudentMyTutorPage() {
  const { data: profile, isLoading: profileLoading } = useMyStudentProfile();
  const { data: tutor, isLoading: tutorLoading } = useMyTutor();
  const { mutate: acceptInvite, isPending: accepting } = useAcceptInvite();
  const { mutate: declineInvite, isPending: declining } = useDeclineInvite();

  const isPendingInvite = profile?.status === 'PENDING_APPROVAL' && !!profile?.tutorPublicId;

  if (profileLoading || tutorLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  if (!profile?.tutorPublicId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="My Tutor"
          subtitle="Your connected tutor will appear here"
          icon={<GraduationCap className="h-5 w-5" />}
        />
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <GraduationCap className="h-8 w-8 text-gray-400" />
          </div>
          <div>
            <p className="text-base font-medium text-gray-700 dark:text-gray-300">No tutor connected yet</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Browse tutors and request a demo class to get started.</p>
          </div>
          <Link to="/dashboard/student/tutors">
            <Button variant="gradient">
              <BookOpen className="h-4 w-4" /> Browse Tutors
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Tutor"
        subtitle="Your connected tutor's profile and details"
        icon={<GraduationCap className="h-5 w-5" />}
      />

      {/* Pending invite banner */}
      {isPendingInvite && (
        <div className="flex items-center gap-4 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-5 py-4">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Tutor invitation pending</p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
              {tutor?.displayName ?? 'A tutor'} has invited you to join their classroom.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button size="sm" variant="outline" onClick={() => declineInvite()} loading={declining}>
              Decline
            </Button>
            <Button size="sm" onClick={() => acceptInvite()} loading={accepting}>
              Accept
            </Button>
          </div>
        </div>
      )}

      {tutor ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main profile card */}
          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <div className="flex items-start gap-5">
                <Avatar name={tutor.displayName} size="xl" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{tutor.displayName}</h2>
                    {tutor.isVerified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                        <CheckCircle className="h-3 w-3" /> Verified
                      </span>
                    )}
                  </div>

                  {tutor.rating > 0 && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      <span className="text-sm font-semibold text-gray-800 dark:text-white">{tutor.rating.toFixed(1)}</span>
                      <span className="text-sm text-gray-500">rating</span>
                    </div>
                  )}

                  {tutor.bio && (
                    <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{tutor.bio}</p>
                  )}

                  {tutor.subjects?.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Subjects</p>
                      <div className="flex flex-wrap gap-1.5">
                        {tutor.subjects.map((s) => (
                          <span key={s} className="rounded-full bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-700 px-3 py-1 text-xs font-medium text-brand-700 dark:text-brand-300">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-800 flex gap-3">
                <Link to="/chat" className="flex-1">
                  <Button variant="outline" fullWidth>
                    <MessageSquare className="h-4 w-4" /> Message
                  </Button>
                </Link>
                <Link to="/dashboard/student/classes" className="flex-1">
                  <Button variant="gradient" fullWidth>
                    <BookOpen className="h-4 w-4" /> My Classes
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Stats sidebar */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-5 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tutor Stats</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/20">
                      <Users className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total Students</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{tutor.totalStudents}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-900/20">
                      <BookOpen className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Classes Completed</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{tutor.totalClassesCompleted}</p>
                    </div>
                  </div>
                  {tutor.hourlyRateCents != null && tutor.hourlyRateCents > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 dark:bg-green-900/20">
                        <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Hourly Rate</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          ${(tutor.hourlyRateCents / 100).toFixed(0)}/hr
                        </p>
                      </div>
                    </div>
                  )}
                  {tutor.email && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-900/20">
                        <Mail className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Email</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{tutor.email}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-4 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Connection status</p>
              <p className={`mt-1 text-sm font-semibold ${
                profile?.status === 'ACTIVE' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
              }`}>
                {profile?.status === 'ACTIVE' ? 'Active' : 'Pending Approval'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}
    </div>
  );
}
