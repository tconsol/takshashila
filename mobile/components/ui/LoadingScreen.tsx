import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator size="large" color="#6366F1" />
      <Text className="mt-3 text-muted text-sm">{message}</Text>
    </View>
  );
}
