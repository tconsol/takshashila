interface AvatarProps {
  name: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
};

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Squared-off initial chip in flat ink, not a rainbow gradient circle — the
 * accent is reserved for live/active state, so an avatar never competes with it.
 */
export function Avatar({ name, src, size = 'md', className = '' }: AvatarProps) {
  const sizeClass = sizeClasses[size];

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizeClass} flex-shrink-0 rounded object-cover ring-1 ring-rule ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex flex-shrink-0 items-center justify-center rounded bg-ink font-display font-semibold text-paper ${className}`}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}
