import '@excalidraw/excalidraw/index.css';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { X, PenLine } from 'lucide-react';

interface WhiteboardPanelProps {
  remoteElements: unknown[];
  onUpdate: (elements: unknown[], appState: unknown) => void;
  onClose: () => void;
}

export function WhiteboardPanel({ remoteElements, onUpdate, onClose }: WhiteboardPanelProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const excalidrawAPIRef = useRef<any>(null);
  const [apiReady, setApiReady] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleExcalidrawAPI(api: any) {
    excalidrawAPIRef.current = api;
    setApiReady(true);
  }

  // Clear any library items from localStorage that might render as stale shapes
  useEffect(() => {
    if (!apiReady || !excalidrawAPIRef.current) return;
    try {
      excalidrawAPIRef.current.updateLibrary({ libraryItems: [], merge: false });
    } catch { /* ignore if API doesn't support */ }
  }, [apiReady]);

  // Apply incoming remote element updates imperatively
  useEffect(() => {
    if (!apiReady || !excalidrawAPIRef.current || remoteElements.length === 0) return;
    excalidrawAPIRef.current.updateScene({ elements: remoteElements });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteElements, apiReady]);

  const handleChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (elements: readonly any[], appState: any) => {
      onUpdate([...elements], appState);
    },
    [onUpdate],
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-gray-900 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-200">
          <PenLine className="h-4 w-4 text-violet-400" />
          Whiteboard
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-lg bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Close
        </button>
      </div>

      {/* Canvas — absolute-fill gives Excalidraw a concrete bounding box */}
      <div className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
        <div className="absolute inset-0">
          <Excalidraw
            excalidrawAPI={handleExcalidrawAPI}
            onChange={handleChange}
            theme="dark"
            initialData={{
              elements: [],
              appState: {
                viewBackgroundColor: '#1a1b26',
                currentItemFontFamily: 1,
              },
              libraryItems: [],
            }}
          />
        </div>
      </div>
    </div>
  );
}
