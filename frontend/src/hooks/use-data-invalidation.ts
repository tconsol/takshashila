import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../sockets/use-socket';
import { SocketEvent } from '../sockets/socket.events';

const MODULE_KEYS: Record<string, readonly (readonly string[])[]> = {
  principals: [['principals'], ['admin-overview'], ['badges']],
  users:      [['users'], ['admin-overview'], ['super-admin-overview']],
  classes:    [['classes']],
  assignments:[['assignments']],
  attendance: [['attendance']],
  wallet:     [['wallet'], ['transactions']],
  tickets:    [['tickets'], ['admin-overview'], ['badges']],
  students:   [['students'], ['badges']],
  'join-requests': [['join-requests'], ['badges']],
  tutors:     [['tutors', 'me'], ['tutors', 'my-principal'], ['tutors', 'my-tutors'], ['tutors', 'pending'], ['badges']],
};

export function useDataInvalidation() {
  const { socket } = useSocket();
  const qc = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    const handler = ({ module }: { module: string }) => {
      const keys = MODULE_KEYS[module];
      if (!keys) return;
      keys.forEach((key) => qc.invalidateQueries({ queryKey: key as string[] }));
    };

    socket.on(SocketEvent.DATA_INVALIDATE, handler);
    return () => { socket.off(SocketEvent.DATA_INVALIDATE, handler); };
  }, [socket, qc]);
}
