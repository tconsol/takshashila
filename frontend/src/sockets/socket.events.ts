export const SocketEvent = {
  // Class room
  CLASS_JOIN: 'class:join',
  CLASS_LEAVE: 'class:leave',
  CLASS_STATUS_UPDATE: 'class:status-update',
  CLASS_STATUS_CHANGED: 'class:status-changed',
  CLASS_USER_JOINED: 'class:user-joined',
  CLASS_USER_LEFT: 'class:user-left',
  CLASS_CHAT: 'class:chat',
  CLASS_CHAT_MESSAGE: 'class:chat-message',
  CLASS_RAISE_HAND: 'class:raise-hand',
  CLASS_HAND_RAISED: 'class:hand-raised',
  CLASS_ANNOUNCE: 'class:announce',

  // Notifications
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_MARK_READ: 'notification:mark-read',
  NOTIFICATION_READ_ACK: 'notification:read-ack',

  // WebRTC signaling
  RTC_READY: 'rtc:ready',
  RTC_OFFER: 'rtc:offer',
  RTC_ANSWER: 'rtc:answer',
  RTC_ICE_CANDIDATE: 'rtc:ice-candidate',
  RTC_LEAVE: 'rtc:leave',
  RTC_PEER_JOINED: 'rtc:peer-joined',
  RTC_PEER_LEFT: 'rtc:peer-left',

  // Screen share signaling
  CLASS_SCREEN_SHARE: 'class:screen-share',

  // Whiteboard
  WB_UPDATE: 'wb:update',

  // Recording
  RECORDING_STARTED: 'recording:started',
  RECORDING_STOPPED: 'recording:stopped',

  // Data invalidation (server pushes when data changes)
  DATA_INVALIDATE: 'data:invalidate',

  // Schedule alerts (sent to connected students/principals when tutor changes a slot)
  SCHEDULE_ALERT: 'schedule:alert',

  // Demo request outcomes pushed to student in real-time
  DEMO_ACCEPTED: 'demo:accepted',
  DEMO_REJECTED: 'demo:rejected',
  // New demo request pushed to tutor in real-time
  DEMO_NEW_REQUEST: 'demo:new-request',
  // Tutor invite pushed to student
  STUDENT_INVITED: 'student:invited',
} as const;

export type SocketEvent = (typeof SocketEvent)[keyof typeof SocketEvent];

export interface ClassChatMessage {
  from: string;
  role: string;
  name: string;
  message: string;
  timestamp: string;
}

export interface ClassStatusChangedPayload {
  classPublicId: string;
  status: string;
  updatedBy: string;
}

export interface NotificationNewPayload {
  notificationPublicId: string;
  type: string;
}

export interface RtcPeerInfo {
  socketId: string;
  userPublicId: string;
  role: string;
}

export interface RtcOfferPayload {
  from: string;
  fromUserPublicId: string;
  offer: RTCSessionDescriptionInit;
}

export interface RtcAnswerPayload {
  from: string;
  answer: RTCSessionDescriptionInit;
}

export interface RtcIceCandidatePayload {
  from: string;
  candidate: RTCIceCandidateInit;
}

export interface WbUpdatePayload {
  elements: unknown[];
  appState: unknown;
}
