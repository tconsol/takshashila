import React from 'react';
import { View, type ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'flat' | 'gradient';
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <View
      className={`bg-white rounded-3xl p-5 ${className ?? ''}`}
      style={{
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      }}
      {...props}
    >
      {children}
    </View>
  );
}
