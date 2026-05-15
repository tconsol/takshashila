import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { useSocket } from '../sockets/use-socket';
import { SocketEvent } from '../sockets/socket.events';
import { useToast } from '../components/ui/Toast';
import { useAuthStore } from '../stores/auth.store';
import notificationSound from '../assets/aayein-meme.mp3';

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
  badges:          [['badges']],
  worksheets:      [['worksheets'], ['badges']],
  resources:       [['resources']],
};

export function useDataInvalidation() {
  const { socket } = useSocket();
  const qc = useQueryClient();
  const toast = useToast();
  const location = useLocation();
  const { user } = useAuthStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(notificationSound);
    audioRef.current.volume = 0.6;
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleInvalidate = ({ module }: { module: string }) => {
      const keys = MODULE_KEYS[module];
      if (!keys) return;
      keys.forEach((key) => qc.invalidateQueries({ queryKey: key as string[] }));
    };

    const handleChatMessage = (msg: { senderPublicId: string; conversationPublicId: string }) => {
      // Always refresh conversation list (re-sorts to top + updates preview)
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
      qc.invalidateQueries({ queryKey: ['badges'] });

      // Play sound only if message is from someone else and we're not viewing that conversation
      const isFromMe = msg.senderPublicId === user?.publicId;
      const isViewingConversation = location.pathname === `/chat/${msg.conversationPublicId}`;
      if (!isFromMe && !isViewingConversation && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
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
      const isOnWorksheetsPage = location.pathname.includes('/worksheets');
      if (!isOnWorksheetsPage && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      toast.info(`New ${type === 'ASSIGNMENT' ? 'assignment' : 'worksheet'} available!`, title);
    };

    const handleWorksheetSubmitted = ({ worksheetTitle, score }: { worksheetPublicId: string; worksheetTitle: string; studentPublicId: string; score: number }) => {
      qc.invalidateQueries({ queryKey: ['worksheets'] });
      qc.invalidateQueries({ queryKey: ['badges'] });
      toast.info('Worksheet submitted', `${worksheetTitle} — Score: ${score}%`);
    };

    socket.on(SocketEvent.DATA_INVALIDATE, handleInvalidate);
    socket.on(SocketEvent.DEMO_ACCEPTED, handleDemoAccepted);
    socket.on(SocketEvent.DEMO_REJECTED, handleDemoRejected);
    socket.on(SocketEvent.DEMO_NEW_REQUEST, handleDemoNewRequest);
    socket.on(SocketEvent.STUDENT_INVITED, handleStudentInvited);
    socket.on('chat:message', handleChatMessage);
    socket.on('worksheet:new', handleWorksheetNew);
    socket.on('worksheet:submitted', handleWorksheetSubmitted);

    return () => {
      socket.off(SocketEvent.DATA_INVALIDATE, handleInvalidate);
      socket.off(SocketEvent.DEMO_ACCEPTED, handleDemoAccepted);
      socket.off(SocketEvent.DEMO_REJECTED, handleDemoRejected);
      socket.off(SocketEvent.DEMO_NEW_REQUEST, handleDemoNewRequest);
      socket.off(SocketEvent.STUDENT_INVITED, handleStudentInvited);
      socket.off('chat:message', handleChatMessage);
      socket.off('worksheet:new', handleWorksheetNew);
      socket.off('worksheet:submitted', handleWorksheetSubmitted);
    };
  }, [socket, qc, toast, user?.publicId, location.pathname]);
}
