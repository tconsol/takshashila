import { useCallback } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { X } from 'lucide-react';

interface WhiteboardPanelProps {
  remoteElements: unknown[];
  onUpdate: (elements: unknown[], appState: unknown) => void;
  onClose: () => void;
}

export function WhiteboardPanel({ remoteElements, onUpdate, onClose }: WhiteboardPanelProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChange = useCallback(
    (elements: readonly any[], appState: any) => {
      onUpdate([...elements], appState);
    },
    [onUpdate],
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/40 backdrop-blur-sm">
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-800/90 text-white hover:bg-gray-700 transition-colors shadow-lg"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 rounded-2xl overflow-hidden m-4 shadow-2xl border border-white/10">
        <Excalidraw
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          initialData={{ elements: remoteElements as any[] }}
          onChange={handleChange}
          theme="dark"
        />
      </div>
    </div>
  );
}
