import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: ReactNode;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export function Modal({ open, onClose, title, children, size = 'md', footer }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-[2px] animate-fade-in"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className={`relative flex w-full ${sizeClasses[size]} max-h-[90vh] flex-col rounded border border-rule-strong bg-surface shadow-pop animate-scale-in`}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-rule px-6 py-4">
            <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink"
              aria-label="Close"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2.5 border-t border-rule px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
