import { useState } from 'react';
import { Badge } from '../ui/Badge';
import { Table } from '../ui/Table';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { attendanceService } from '../../services/attendance.service';
import type { AttendanceRecord } from '../../services/attendance.service';
import { useQueryClient } from '@tanstack/react-query';

const statusVariant: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
  PRESENT: 'success',
  ABSENT: 'danger',
  PARTIAL: 'warning',
  EXCUSED: 'default',
};

interface AttendanceSheetProps {
  classPublicId: string;
  records: AttendanceRecord[];
  loading?: boolean;
  canOverride?: boolean;
}

export function AttendanceSheet({ classPublicId, records, loading, canOverride }: AttendanceSheetProps) {
  const qc = useQueryClient();
  const [overriding, setOverriding] = useState<AttendanceRecord | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const handleOverride = async () => {
    if (!overriding || !newStatus) return;
    setSaving(true);
    try {
      await attendanceService.overrideAttendance(overriding.publicId, { status: newStatus, remarks });
      qc.invalidateQueries({ queryKey: ['attendance', classPublicId] });
      setOverriding(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Table
        columns={[
          {
            key: 'studentPublicId',
            header: 'Student ID',
            render: (r) => <span className="font-mono text-xs">{r.studentPublicId.slice(0, 8)}…</span>,
          },
          {
            key: 'status',
            header: 'Status',
            render: (r) => (
              <Badge variant={statusVariant[r.status] ?? 'default'}>{r.status}</Badge>
            ),
          },
          {
            key: 'source',
            header: 'Source',
            render: (r) => (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {r.source === 'MANUAL_OVERRIDE' ? 'Manual' : 'Auto'}
              </span>
            ),
          },
          {
            key: 'durationPresentMinutes',
            header: 'Duration',
            render: (r) => `${r.durationPresentMinutes} min`,
          },
          ...(canOverride
            ? [
                {
                  key: 'actions',
                  header: '',
                  render: (r: AttendanceRecord) => (
                    <button
                      onClick={() => { setOverriding(r); setNewStatus(r.status); setRemarks(''); }}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Override
                    </button>
                  ),
                },
              ]
            : []),
        ]}
        data={records}
        keyField="publicId"
        loading={loading}
        emptyMessage="No attendance records for this class."
      />

      <Modal
        open={!!overriding}
        onClose={() => setOverriding(null)}
        title="Override Attendance"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOverriding(null)}>Cancel</Button>
            <Button onClick={handleOverride} loading={saving} disabled={!newStatus}>Save</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Select
            label="New Status"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            options={[
              { value: 'PRESENT', label: 'Present' },
              { value: 'ABSENT', label: 'Absent' },
              { value: 'PARTIAL', label: 'Partial' },
              { value: 'EXCUSED', label: 'Excused' },
            ]}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Remarks
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Reason for override…"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
