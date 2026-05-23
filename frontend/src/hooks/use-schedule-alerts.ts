import { useEffect } from 'react';
import { useSocket } from '../sockets/use-socket';
import { SocketEvent } from '../sockets/socket.events';
import { useScheduleAlertsStore } from '../stores/schedule-alerts.store';

export function useScheduleAlerts() {
  const { socket } = useSocket();
  const increment = useScheduleAlertsStore((s) => s.increment);

  useEffect(() => {
    if (!socket) return;
    socket.on(SocketEvent.SCHEDULE_ALERT, increment);
    return () => { socket.off(SocketEvent.SCHEDULE_ALERT, increment); };
  }, [socket, increment]);
}
