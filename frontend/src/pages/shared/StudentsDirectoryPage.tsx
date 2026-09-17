import { useQuery } from '@tanstack/react-query';
import { Users, UserCheck, UserX, BookOpen } from 'lucide-react';
import { PeopleDirectory, type DirectoryRow } from '../../components/shared/PeopleDirectory';
import { StatsCard } from '../../components/shared/StatsCard';
import { BarList } from '../../components/shared/BarList';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { adminUsersService } from '../../services/admin-users.service';

function num(profile: Record<string, unknown> | null, key: string): number {
  return Number(profile?.[key] ?? 0);
}

export function StudentsDirectoryPage() {
  const { data: students } = useQuery({
    queryKey: ['student-breakdown'],
    queryFn: adminUsersService.studentBreakdown,
    staleTime: 60_000,
  });

  return (
    <PeopleDirectory
      title="Students"
      eyebrow="Learners"
      description="Every student on the platform — grade, tutor assignment, attendance and class history."
      icon={<Users className="h-5 w-5" />}
      lockedRole="STUDENT"
      summary={
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              index={0}
              title="Total Students"
              value={(students?.total ?? 0).toLocaleString()}
              accent="green"
              icon={<Users className="h-5 w-5" />}
            />
            <StatsCard
              index={1}
              title="Assigned a Tutor"
              value={(students?.withTutor ?? 0).toLocaleString()}
              accent="sky"
              icon={<UserCheck className="h-5 w-5" />}
              hint={students ? `${students.withoutTutor.toLocaleString()} unassigned` : undefined}
            />
            <StatsCard
              index={2}
              title="Avg Attendance"
              value={students ? `${students.avgAttendanceRate}%` : '—'}
              accent="violet"
              icon={<BookOpen className="h-5 w-5" />}
              hint={students ? `${students.totalClassesAttended.toLocaleString()} attended` : undefined}
            />
            <StatsCard
              index={3}
              title="Classes Missed"
              value={(students?.totalClassesMissed ?? 0).toLocaleString()}
              accent="rose"
              icon={<UserX className="h-5 w-5" />}
              hint={students ? `${students.demoClassesUsed.toLocaleString()} demo classes used` : undefined}
            />
          </div>

          {students && students.total > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>By Grade</CardTitle>
                    <p className="mt-1 text-xs text-slate-500">Top 12 grades</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <BarList
                    items={students.byGrade.map((g) => ({ label: g.grade, value: g.count }))}
                    emptyMessage="No grades recorded."
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>By Status</CardTitle>
                    <p className="mt-1 text-xs text-slate-500">Enrollment lifecycle</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <BarList
                    items={students.byStatus.map((s) => ({
                      label: s.status.replace(/_/g, ' '),
                      value: s.count,
                    }))}
                    emptyMessage="No students yet."
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      }
      profileColumns={[
        {
          key: 'grade',
          header: 'Grade',
          render: (u: DirectoryRow) => (
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {(u.profile?.grade as string) || '—'}
            </span>
          ),
        },
        {
          key: 'tutor',
          header: 'Tutor',
          render: (u: DirectoryRow) =>
            u.profile?.tutorPublicId ? (
              <Badge variant="success" tone="soft">Assigned</Badge>
            ) : (
              <Badge variant="warning" tone="soft">Unassigned</Badge>
            ),
        },
        {
          key: 'attendance',
          header: 'Attendance',
          render: (u: DirectoryRow) => {
            const rate = num(u.profile, 'attendanceRate');
            return (
              <span className="text-xs text-slate-500">
                {rate}% · {num(u.profile, 'totalClassesAttended')} attended ·{' '}
                {num(u.profile, 'totalClassesMissed')} missed
              </span>
            );
          },
        },
      ]}
    />
  );
}
