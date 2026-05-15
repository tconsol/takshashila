import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../sockets/use-socket';
import { SocketEvent } from '../sockets/socket.events';
import { useToast } from '../components/ui/Toast';

const MODULE_KEYS: Record<string, readonly (readonly string[])[]> = {
  principals:      [['principals'], ['admin-overview'], ['badges']],
  users:           [['users'], ['admin-overview'], ['super-admin-overview']],
  classes:         [['classes']],
  schedules:       [['schedules']],
  assignments:     [['assignments']],
  attendance:      [['attendance']],
  wallet:          [['wallet'], ['transactions']],
  tickets:         [['tickets'], ['admin-overview'], ['badges']],
  students:        [['students'], ['badges']],
  'join-requests': [['join-requests'], ['badges']],
  'demo-requests': [['demo-requests'], ['badges']],
  tutors:          [['tutors', 'me'], ['tutors', 'my-principal'], ['tutors', 'my-tutors'], ['tutors', 'pending'], ['badges']],
};

export function useDataInvalidation() {
  const { socket } = useSocket();
  const qc = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (!socket) return;

    const handleInvalidate = ({ module }: { module: string }) => {
      const keys = MODULE_KEYS[module];
      if (!keys) return;
      keys.forEach((key) => qc.invalidateQueries({ queryKey: key as string[] }));
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

    socket.on(SocketEvent.DATA_INVALIDATE, handleInvalidate);
    socket.on(SocketEvent.DEMO_ACCEPTED, handleDemoAccepted);
    socket.on(SocketEvent.DEMO_REJECTED, handleDemoRejected);

    return () => {
      socket.off(SocketEvent.DATA_INVALIDATE, handleInvalidate);
      socket.off(SocketEvent.DEMO_ACCEPTED, handleDemoAccepted);
      socket.off(SocketEvent.DEMO_REJECTED, handleDemoRejected);
    };
  }, [socket, qc, toast]);
}
