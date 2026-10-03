// frontend/src/features/curriculum/GradeFilter.tsx
import { Select } from '../../components/ui/Select';
import { GRADE_LIST, HIGH_SCHOOL, isHighSchoolGrade } from '../../constants/grades';

export const ALL_GRADES = 'all';

const OPTIONS = [
  { value: ALL_GRADES, label: 'All grades' },
  ...GRADE_LIST.filter((g) => !isHighSchoolGrade(g)).map((g) => ({ value: g, label: g })),
  { value: HIGH_SCHOOL, label: HIGH_SCHOOL },
];

/** The filter value that shows a student's own grade (Grades 9-12 map to the High School courses). */
export const filterForGrade = (grade?: string | null) => (!grade ? ALL_GRADES : isHighSchoolGrade(grade) ? HIGH_SCHOOL : grade);

export function GradeFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="w-44">
      <Select options={OPTIONS} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
