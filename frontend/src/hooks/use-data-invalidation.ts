import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { useSocket } from '../sockets/use-socket';
import { SocketEvent } from '../sockets/socket.events';
import { useToast } from '../components/ui/Toast';
import { useAuthStore } from '../stores/auth.store';
import { realtime } from '../lib/realtime';

const MODULE_KEYS: Record<string, readonly (readonly string[])[]> = {
  principals:      [['principals'], ['admin-overview'], ['badges']],
  users:           [['users'], ['admin-overview'], ['super-admin-overview']],
  classes:         [['classes'], ['analytics']],
  schedules:       [['schedules']],
  assignments:     [['assignments']],
  attendance:      [['attendance'], ['analytics']],
  wallet:          [['wallet'], ['transactions'], ['analytics']],
  tickets:         [['tickets'], ['admin-overview'], ['badges']],
  students:        [['students'], ['badges']],
  'join-requests': [['join-requests'], ['badges']],
  'demo-requests': [['demo-requests'], ['badges']],
  tutors:          [['tutors', 'me'], ['tutors', 'my-principal'], ['tutors', 'my-tutors'], ['tutors', 'pending'], ['badges']],
  badges:          [['badges']],
  worksheets:      [['worksheets'], ['badges']],
  resources:       [['resources']],
};

export function useDataInvalidation() {
  const { socket } = useSocket();
  const qc = useQueryClient();
  const toast = useToast();
  const location = useLocation();
  const { user, accessToken } = useAuthStore();

  // Open the Pusher connection once per session. The server decides whether
  // this client actually gets one; if not, `start` resolves to 'socket' and
  // everything keeps working over Socket.IO.
  useEffect(() => {
    if (!accessToken) return;
    void realtime.start(accessToken);
    return () => { void realtime.stop(); };
  }, [accessToken]);

  useEffect(() => {
    if (!socket) return;

    const handleInvalidate = ({ module }: { module: string }) => {
      const keys = MODULE_KEYS[module];
      if (!keys) return;
      keys.forEach((key) => qc.invalidateQueries({ queryKey: key as string[] }));
    };

    const handleChatMessage = () => {
      // Refresh conversation list + unread/badge counts (notification sound removed).
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
      qc.invalidateQueries({ queryKey: ['chat', 'unread'] });
      qc.invalidateQueries({ queryKey: ['badges'] });
    };

    const handleStudentInvited = () => {
      qc.invalidateQueries({ queryKey: ['students', 'me'] });
      toast.info('Tutor invitation received!', 'A tutor has invited you to join their classroom. Go to My Tutor to accept.');
    };

    const handleDemoNewRequest = ({ subject }: { subject: string }) => {
      qc.invalidateQueries({ queryKey: ['demo-requests'] });
      qc.invalidateQueries({ queryKey: ['badges'] });
      toast.info('New demo request!', subject ? `A student wants a demo for ${subject}.` : 'A student sent you a demo request.');
    };

    const handleDemoAccepted = ({ subject }: { subject: string; classPublicId: string }) => {
      // Invalidate relevant queries
      qc.invalidateQueries({ queryKey: ['demo-requests'] });
      qc.invalidateQueries({ queryKey: ['classes'] });
      qc.invalidateQueries({ queryKey: ['badges'] });
      // Show toast so student sees the notification in real-time
      toast.success('Demo class accepted!', `Your ${subject} demo has been scheduled. Check your Classes page.`);
    };

    const handleDemoRejected = ({ subject }: { subject: string }) => {
      qc.invalidateQueries({ queryKey: ['demo-requests'] });
      toast.warning('Demo request declined', `Your ${subject} demo request was not accepted this time.`);
    };

    const handleWorksheetNew = ({ title, type }: { worksheetPublicId: string; title: string; type: string; subject?: string }) => {
      qc.invalidateQueries({ queryKey: ['worksheets'] });
      qc.invalidateQueries({ queryKey: ['badges'] });
      toast.info(`New ${type === 'ASSIGNMENT' ? 'assignment' : 'worksheet'} available!`, title);
    };

    const handleWorksheetSubmitted = ({ worksheetTitle, score }: { worksheetPublicId: string; worksheetTitle: string; studentPublicId: string; score: number }) => {
      qc.invalidateQueries({ queryKey: ['worksheets'] });
      qc.invalidateQueries({ queryKey: ['badges'] });
      toast.info('Worksheet submitted', `${worksheetTitle} Score: ${score}%`);
    };

    const handleClassCreated = ({ title }: { classPublicId: string; title: string; tutorPublicId: string }) => {
      qc.invalidateQueries({ queryKey: ['classes'] });
      toast.info('New class scheduled!', title);
    };

    const handleInviteDeclined = ({ studentName }: { studentName: string }) => {
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['badges'] });
      toast.warning('Invitation declined', `${studentName} declined your invitation. You can send a new one.`);
    };

    /**
     * Broadcasts arrive over Pusher or Socket.IO depending on how much of the
     * Pusher quota is left — the server picks per message. Registering the same
     * handler on both means the UI reacts identically either way, and the
     * fallback is invisible here.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type AnyHandler = (...args: any[]) => void;
    const BROADCASTS: [string, AnyHandler][] = ([
      [SocketEvent.DATA_INVALIDATE, handleInvalidate],
      [SocketEvent.DEMO_ACCEPTED, handleDemoAccepted],
      [SocketEvent.DEMO_REJECTED, handleDemoRejected],
      [SocketEvent.DEMO_NEW_REQUEST, handleDemoNewRequest],
      [SocketEvent.STUDENT_INVITED, handleStudentInvited],
      ['chat:message', handleChatMessage],
      ['worksheet:new', handleWorksheetNew],
      ['worksheet:submitted', handleWorksheetSubmitted],
      ['class:created', handleClassCreated],
      ['student:invite-declined', handleInviteDeclined],
    ] as unknown) as [string, AnyHandler][];

    BROADCASTS.forEach(([event, handler]) => socket.on(event, handler));
    const unsubscribers = BROADCASTS.map(([event, handler]) =>
      realtime.on(event, handler),
    );

    return () => {
      BROADCASTS.forEach(([event, handler]) => socket.off(event, handler));
      unsubscribers.forEach((off) => off());
    };
  }, [socket, qc, toast, user?.publicId, location.pathname]);
}
