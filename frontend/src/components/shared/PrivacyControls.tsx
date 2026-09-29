import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Trash2, ShieldAlert } from 'lucide-react';
import { api } from '../../lib/axios';
import { useAuthStore } from '../../stores/auth.store';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface DeletionCheck {
  canDelete: boolean;
  blockers: string[];
}

const errorText = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message
  ?? (e instanceof Error ? e.message : fallback);

/**
 * "Download my data" and "Delete my account" for every role, shown in
 * Profile → Security. Deleting needs the password and the word DELETE, and the
 * server refuses while money, classes or organization ties are unsettled.
 */
export function PrivacyControls() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const [open, setOpen] = useState(false);
  const [check, setCheck] = useState<DeletionCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [password, setPassword] = useState('');
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const download = async () => {
    setDownloading(true);
    setMessage(null);
    try {
      const res = await api.get('/users/me/export');
      const blob = new Blob([JSON.stringify(res.data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `brainbaseedu-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ type: 'ok', text: 'Your data was downloaded.' });
    } catch (e) {
      setMessage({ type: 'error', text: errorText(e, 'Could not download your data.') });
    } finally {
      setDownloading(false);
    }
  };

  const openDelete = async () => {
    setOpen(true);
    setPassword('');
    setTyped('');
    setError('');
    setCheck(null);
    setChecking(true);
    try {
      const res = await api.get('/users/me/deletion-check');
      setCheck(res.data.data as DeletionCheck);
    } catch (e) {
      setError(errorText(e, 'Could not check whether your account can be closed.'));
    } finally {
      setChecking(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      await api.post('/users/me/delete', { password, confirm: typed.trim() });
      clearAuth();
      window.location.assign('/login');
    } catch (e) {
      setError(errorText(e, 'Could not delete your account.'));
      setDeleting(false);
    }
  };

  const blocked = !!check && !check.canDelete;
  const ready = !!check?.canDelete && password.length > 0 && typed.trim() === 'DELETE';

  return (
    <div className="rounded-2xl border border-rule bg-surface p-6 shadow-card">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger-wash">
          <ShieldAlert className="h-4 w-4 text-danger" />
        </span>
        <div>
          <h3 className="text-base font-semibold text-ink">Your data and privacy</h3>
          <p className="text-xs text-ink-muted">
            Read the <Link to="/privacy" className="underline">Privacy Policy</Link>,{' '}
            <Link to="/terms" className="underline">Terms of Use</Link> and{' '}
            <Link to="/data-policy" className="underline">Data &amp; Deletion Policy</Link>.
          </p>
        </div>
      </div>

      {message && (
        <p className={`mb-3 text-sm font-medium ${message.type === 'ok' ? 'text-ok' : 'text-danger'}`}>{message.text}</p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={download} loading={downloading}>
          <Download className="mr-1.5 h-4 w-4" /> Download my data
        </Button>
        <Button variant="danger" onClick={openDelete}>
          <Trash2 className="mr-1.5 h-4 w-4" /> Delete my account
        </Button>
      </div>

      <Modal
        open={open}
        onClose={() => !deleting && setOpen(false)}
        title="Delete your account?"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleting} disabled={!ready}>
              Delete my account
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-sm text-ink-2">
          <p>If you continue:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>You are signed out everywhere and can no longer sign in.</li>
            <li>Your classes, homework and messages are removed from your view.</li>
            <li>Money records are kept for accounting, as our Data &amp; Deletion Policy explains.</li>
            <li>An administrator can restore the account for a short recovery period.</li>
          </ul>

          {checking && <p className="text-ink-muted">Checking your account…</p>}

          {blocked && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
              <p className="mb-1.5 font-semibold">Please settle these first:</p>
              <ul className="list-disc space-y-1 pl-5">
                {check!.blockers.map((b) => <li key={b}>{b}</li>)}
              </ul>
            </div>
          )}

          {check?.canDelete && (
            <div className="space-y-3">
              <Input
                label="Your password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Input
                label='Type "DELETE" to confirm'
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
              />
            </div>
          )}

          {error && <p className="font-medium text-danger">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}
