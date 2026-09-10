import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2, RotateCcw, AlertTriangle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { systemService } from '../../services/system.service';

interface FailedJobsModalProps {
  /** Queue name, or null when closed. */
  queue: string | null;
  onClose: () => void;
}

/**
 * The failures behind a queue's "failed" count, with the reason each job died
 * and a retry once the cause is fixed. Payloads are summarised server-side —
 * an ops console must not double as a way to read users' mail.
 */
export function FailedJobsModal({ queue, onClose }: FailedJobsModalProps) {
  const qc = useQueryClient();

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['failed-jobs', queue],
    queryFn: () => systemService.getFailedJobs(queue!),
    enabled: !!queue,
  });

  const { mutate: retry, isPending: retrying, variables: retryingId } = useMutation({
    mutationFn: (jobId: string) => systemService.retryFailedJob(queue!, jobId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['failed-jobs', queue] });
      qc.invalidateQueries({ queryKey: ['system-health'] });
    },
  });

  return (
    <Modal
      open={!!queue}
      onClose={onClose}
      size="xl"
      title={queue ? `Failed jobs · ${queue}` : 'Failed jobs'}
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}
    >
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      ) : jobs.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">
          Nothing failed in this queue.
        </p>
      ) : (
        <div className="space-y-2.5">
          {jobs.map((job) => (
            <div key={job.id} className="rounded border border-rule p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink">{job.name}</p>
                    <Badge variant="danger" tone="soft">
                      {job.attemptsMade} attempt{job.attemptsMade === 1 ? '' : 's'}
                    </Badge>
                    {job.failedAt && (
                      <span className="text-[11px] text-ink-muted">
                        {format(new Date(job.failedAt), 'MMM d, HH:mm:ss')}
                      </span>
                    )}
                  </div>
                  {job.summary && (
                    <p className="mt-1 truncate text-xs text-ink-muted" title={job.summary}>
                      {job.summary}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  loading={retrying && retryingId === job.id}
                  onClick={() => retry(job.id)}
                >
                  <RotateCcw className="h-3 w-3" /> Retry
                </Button>
              </div>

              {job.failedReason && (
                <div className="mt-2.5 flex gap-2 rounded bg-danger-wash p-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-danger" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-danger">{job.failedReason}</p>
                    {job.stackHead && (
                      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-snug text-ink-muted">
                        {job.stackHead}
                      </pre>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
