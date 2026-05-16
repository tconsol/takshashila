import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarPlus, Users, User, RefreshCw, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useTutorCreateClass } from '../../hooks/use-classes';
import { useMyStudentsAsTutor } from '../../hooks/use-students';

type ClassType = 'DEMO' | 'ONE_ON_ONE' | 'GROUP' | 'RECURRING';
type Recurrence = 'NONE' | 'DAILY' | 'WEEKLY';

const CLASS_TYPES: { value: ClassType; label: string; desc: string }[] = [
  { value: 'DEMO', label: 'Demo', desc: 'Free introductory class' },
  { value: 'ONE_ON_ONE', label: 'One-on-One', desc: 'Private session' },
  { value: 'GROUP', label: 'Group', desc: 'Multiple students' },
  { value: 'RECURRING', label: 'Recurring', desc: 'Repeating schedule' },
];

function now15(): string {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return d.toISOString().slice(0, 16);
}

function addHour(dt: string): string {
  if (!dt) return '';
  return new Date(new Date(dt).getTime() + 3_600_000).toISOString().slice(0, 16);
}

export function TutorCreateClassPage() {
  const navigate = useNavigate();

  const [type, setType] = useState<ClassType>('ONE_ON_ONE');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startUTC, setStartUTC] = useState(now15);
  const [endUTC, setEndUTC] = useState(() => addHour(now15()));
  const [recurrence, setRecurrence] = useState<Recurrence>('NONE');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [studentMode, setStudentMode] = useState<'all' | 'specific'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showStudents, setShowStudents] = useState(false);

  const { mutateAsync: create, isPending } = useTutorCreateClass();
  const { data: studentsData } = useMyStudentsAsTutor({ limit: '200' });
  const students = (studentsData?.items ?? [])
    .filter((s) => s.status === 'ACTIVE' || s.status === 'APPROVED')
    .map((s) => ({
      publicId: s.publicId,
      name: s.displayName || `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || 'Student',
    }));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const canSubmit =
    title.trim().length > 0 &&
    startUTC.length > 0 &&
    endUTC.length > 0 &&
    new Date(endUTC) > new Date(startUTC);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await create({
      title: title.trim(),
      description: description.trim() || undefined,
      classType: type,
      startUTC: new Date(startUTC).toISOString(),
      endUTC: new Date(endUTC).toISOString(),
      recurrence,
      recurrenceEndDate:
        recurrence !== 'NONE' && recurrenceEndDate
          ? new Date(recurrenceEndDate).toISOString()
          : undefined,
      studentPublicIds: studentMode === 'all' ? [] : [...selected],
    });
    navigate('/dashboard/tutor/classes');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/dashboard/tutor/classes')}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Class</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Schedule a new session for your students</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
        {/* Class type */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Class Type</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CLASS_TYPES.map((ct) => (
              <button
                key={ct.value}
                onClick={() => setType(ct.value)}
                className={`rounded-xl border-2 px-3 py-2.5 text-left transition-all ${
                  type === ct.value
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-brand-300'
                }`}
              >
                <p className={`text-sm font-semibold ${type === ct.value ? 'text-brand-700 dark:text-brand-300' : 'text-gray-800 dark:text-gray-200'}`}>
                  {ct.label}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">{ct.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Algebra Introduction"
            className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Optional class description…"
            className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white px-3.5 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Date/time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Start <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={startUTC}
              onChange={(e) => {
                setStartUTC(e.target.value);
                if (e.target.value) setEndUTC(addHour(e.target.value));
              }}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              End <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={endUTC}
              min={startUTC}
              onChange={(e) => setEndUTC(e.target.value)}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Recurrence */}
        {type === 'RECURRING' && (
          <div className="rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/20 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-brand-700 dark:text-brand-300">
              <RefreshCw className="h-4 w-4" /> Recurrence Settings
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Repeat</label>
                <select
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as Recurrence)}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Until</label>
                <input
                  type="datetime-local"
                  value={recurrenceEndDate}
                  min={startUTC}
                  onChange={(e) => setRecurrenceEndDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Student selection */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assign Students</p>
          <div className="flex gap-2">
            <button
              onClick={() => { setStudentMode('all'); setSelected(new Set()); setShowStudents(false); }}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border-2 py-2 text-sm font-medium transition-all ${
                studentMode === 'all'
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              <Users className="h-4 w-4" /> All My Students
            </button>
            <button
              onClick={() => { setStudentMode('specific'); setShowStudents(true); }}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border-2 py-2 text-sm font-medium transition-all ${
                studentMode === 'specific'
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              <User className="h-4 w-4" /> Specific Students
            </button>
          </div>

          {studentMode === 'specific' && (
            <div className="mt-2">
              <button
                onClick={() => setShowStudents((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 px-3.5 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <span>
                  {selected.size === 0
                    ? 'Select students…'
                    : `${selected.size} student${selected.size !== 1 ? 's' : ''} selected`}
                </span>
                {showStudents ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {showStudents && (
                <div className="mt-1 max-h-56 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                  {students.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-gray-400">No active students found</p>
                  ) : (
                    students.map((s) => (
                      <label
                        key={s.publicId}
                        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(s.publicId)}
                          onChange={() => toggle(s.publicId)}
                          className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span className="text-sm text-gray-800 dark:text-gray-200">{s.name}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pb-8">
        <Button variant="ghost" onClick={() => navigate('/dashboard/tutor/classes')} disabled={isPending}>
          Cancel
        </Button>
        <Button
          variant="gradient"
          onClick={handleSubmit}
          loading={isPending}
          disabled={!canSubmit}
        >
          <CalendarPlus className="h-4 w-4" /> Create Class
        </Button>
      </div>
    </div>
  );
}
