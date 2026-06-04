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

// Modern gradient palette — one per hash bucket
const GRADIENTS = [
  'from-indigo-400 to-violet-500',
  'from-pink-400 to-rose-500',
  'from-teal-400 to-emerald-500',
  'from-amber-400 to-orange-500',
  'from-sky-400 to-blue-500',
  'from-purple-400 to-indigo-500',
];

function getGradient(name: string): string {
  if (!name) return GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

export function Avatar({ name, src, size = 'md', className = '' }: AvatarProps) {
  const sizeClass = sizeClasses[size];
  const gradient = getGradient(name);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizeClass} rounded-full ring-2 ring-white object-cover flex-shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} bg-gradient-to-br ${gradient} rounded-full flex items-center justify-center text-white font-bold ring-2 ring-white flex-shrink-0 ${className}`}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}
