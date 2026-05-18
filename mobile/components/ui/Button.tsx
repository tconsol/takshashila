import React from 'react';
import {
  TouchableOpacity, Text, ActivityIndicator,
  type TouchableOpacityProps,
} from 'react-native';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends TouchableOpacityProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<Variant, { container: string; text: string }> = {
  primary:   { container: 'bg-primary-500 active:bg-primary-700', text: 'text-white font-bold' },
  secondary: { container: 'bg-emerald-500 active:bg-emerald-700', text: 'text-white font-bold' },
  outline:   { container: 'border border-primary-200 bg-white active:bg-primary-50', text: 'text-primary-600 font-bold' },
  ghost:     { container: 'bg-transparent active:bg-gray-100', text: 'text-gray-700 font-semibold' },
  danger:    { container: 'bg-rose-500 active:bg-rose-700', text: 'text-white font-bold' },
};

const sizeStyles: Record<Size, { container: string; text: string }> = {
  sm: { container: 'px-3 py-2 rounded-xl',     text: 'text-[13px]' },
  md: { container: 'px-4 py-3 rounded-2xl',    text: 'text-[15px]' },
  lg: { container: 'px-6 py-4 rounded-2xl',    text: 'text-base' },
};

export function Button({
  variant = 'primary', size = 'md', loading = false,
  disabled, children, className, ...props
}: ButtonProps) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      className={`flex-row items-center justify-center ${v.container} ${s.container} ${isDisabled ? 'opacity-50' : ''} ${className ?? ''}`}
      disabled={isDisabled}
      activeOpacity={0.85}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? '#6366F1' : '#fff'}
        />
      ) : (
        <Text className={`${v.text} ${s.text}`}>{children}</Text>
      )}
    </TouchableOpacity>
  );
}
