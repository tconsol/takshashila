import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs } from '../../components/ui/Tabs';
import { StudentClassesPage } from './StudentClassesPage';
import { StudentAttendancePage } from './StudentAttendancePage';
import { useTabActivity } from '../../hooks/use-tab-activity';
import { attendanceService } from '../../services/attendance.service';

/* Combined "Classes" hub Classes + Attendance in one place.
   (Progress was redundant with Attendance, so it's folded in here.) */
const TABS = [
  { key: 'classes', label: 'Classes' },
  { key: 'attendance', label: 'Attendance & Progress' },
];

export function StudentLearningPage() {
  const [tab, setTab] = useState<'classes' | 'attendance'>('classes');

  // The tutor marking attendance is a one-way push to the student, so poll the
  // record count and light the tab when it grows.
  const { data: attendance } = useQuery({
    queryKey: ['attendance', 'my', 'tab-signal'],
    queryFn: () => attendanceService.getMyHistory({ limit: 1 }),
    refetchInterval: 60_000,
  });
  const { dirty, markSeen } = useTabActivity({ attendance: attendance?.pagination.total }, tab);
  const tabs = TABS.map((t) => ({ ...t, indicator: dirty.has(t.key) }));

  return (
    <div className="space-y-5">
      <Tabs
        tabs={tabs}
        activeTab={tab}
        onChange={(k) => { setTab(k as 'classes' | 'attendance'); markSeen(k); }}
      />
      {tab === 'classes' ? <StudentClassesPage /> : <StudentAttendancePage />}
    </div>
  );
}
