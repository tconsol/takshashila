import React from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { EmptyState } from '../components/ui/EmptyState';
import { resourcesService } from '../services/resources.service';

function iconFor(mime: string): keyof typeof Ionicons.glyphMap {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'videocam';
  if (mime.startsWith('audio/')) return 'musical-notes';
  if (mime.includes('pdf')) return 'document-text';
  return 'document';
}
function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ResourcesScreen() {
  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['resources', 'student'],
    queryFn: () => resourcesService.getMyAsStudent({ limit: '100' }),
  });
  const items = data?.items ?? [];

  const open = async (resourceId: string) => {
    try {
      const url = await resourcesService.getReadUrl(resourceId);
      if (url) await Linking.openURL(url);
      else Alert.alert('Unavailable', 'Could not open this file.');
    } catch {
      Alert.alert('Unavailable', 'Could not open this file.');
    }
  };

  if (isLoading) return <LoadingScreen message="Loading resources..." />;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <FlatList
        data={items}
        keyExtractor={(r) => r.publicId}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366F1" />}
        ListEmptyComponent={<EmptyState icon="folder-open-outline" title="No resources yet" description="Study materials shared by your tutor appear here." />}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => open(item.publicId)}
            className="mb-3 flex-row items-center rounded-2xl border border-slate-100 bg-white p-4"
          >
            <View className="mr-3 h-11 w-11 items-center justify-center rounded-xl bg-violet-50">
              <Ionicons name={iconFor(item.mimeType)} size={20} color="#7C3AED" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-slate-900" numberOfLines={1}>{item.title}</Text>
              <Text className="mt-0.5 text-xs text-slate-400" numberOfLines={1}>
                {item.filename} · {fileSize(item.fileSizeBytes)}
              </Text>
            </View>
            <Ionicons name="download-outline" size={18} color="#6366F1" />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
