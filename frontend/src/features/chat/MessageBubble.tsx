import { formatTime } from '../../utils/date';
import type { IMessage } from './chat.types';

interface Props {
  message: IMessage;
  isMine: boolean;
}

export function MessageBubble({ message, isMine }: Props) {
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`max-w-[72%] rounded-2xl px-4 py-2 shadow-sm ${
          isMine
            ? 'bg-brand-600 text-white rounded-br-none'
            : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-100 dark:border-gray-600 rounded-bl-none'
        }`}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.body}</p>
        <p className={`mt-1 text-[10px] text-right ${isMine ? 'text-brand-200' : 'text-gray-400'}`}>
          {formatTime(message.createdAt)}
          {isMine && (
            <span className="ml-1">{message.isRead ? '✓✓' : '✓'}</span>
          )}
        </p>
      </div>
    </div>
  );
}
