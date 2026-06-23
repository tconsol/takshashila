import { useState } from 'react';
import { Tabs } from '../../components/ui/Tabs';
import { StudentClassesPage } from './StudentClassesPage';
import { StudentAttendancePage } from './StudentAttendancePage';

/* Combined "Classes" hub — Classes + Attendance in one place.
   (Progress was redundant with Attendance, so it's folded in here.) */
const TABS = [
  { key: 'classes', label: 'Classes' },
  { key: 'attendance', label: 'Attendance & Progress' },
];

export function StudentLearningPage() {
  const [tab, setTab] = useState<'classes' | 'attendance'>('classes');
  return (
    <div className="space-y-5">
      <Tabs tabs={TABS} activeTab={tab} onChange={(k) => setTab(k as 'classes' | 'attendance')} />
      {tab === 'classes' ? <StudentClassesPage /> : <StudentAttendancePage />}
    </div>
  );
}
