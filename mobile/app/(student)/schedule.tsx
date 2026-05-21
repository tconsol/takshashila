import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, isAfter } from 'date-fns';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { EmptyState } from '../../components/ui/EmptyState';
import { worksheetsService } from '../../services/worksheets.service';
import { resourcesService } from '../../services/resources.service';
import type { WorksheetSummary, Resource } from '../../types/api.types';

type TabKey = 'worksheets' | 'assignments' | 'resources';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'worksheets',  label: 'Worksheets' },
  { key: 'assignments', label: 'Assignments' },
  { key: 'resources',   label: 'Resources' },
];

const FILE_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  pdf:  { bg: '#FFE4E6', fg: '#E11D48', label: 'PDF' },
  doc:  { bg: '#E0F2FE', fg: '#0284C7', label: 'DOC' },
  docx: { bg: '#E0F2FE', fg: '#0284C7', label: 'DOC' },
  xls:  { bg: '#D1FAE5', fg: '#059669', label: 'XLS' },
  xlsx: { bg: '#D1FAE5', fg: '#059669', label: 'XLS' },
  ppt:  { bg: '#FEF3C7', fg: '#D97706', label: 'PPT' },
  pptx: { bg: '#FEF3C7', fg: '#D97706', label: 'PPT' },
  jpg:  { bg: '#F3E8FF', fg: '#9333EA', label: 'IMG' },
  png:  { bg: '#F3E8FF', fg: '#9333EA', label: 'IMG' },
  jpeg: { bg: '#F3E8FF', fg: '#9333EA', label: 'IMG' },
};

function getFileType(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return FILE_COLORS[ext] ?? { bg: '#F1F5F9', fg: '#475569', label: 'FILE' };
}

function WorksheetRow({ item }: { item: WorksheetSummary }) {
  const isSubmitted = !!item.mySubmission;
  const score = item.mySubmission?.scorePercent;
  const due = item.dueDate ? parseISO(item.dueDate) : null;
  const overdue = due ? isAfter(new Date(), due) : false;

  let scoreLabel = 'Pending';
  let scoreBg = '#F1F5F9';
  let scoreFg = '#64748B';
  if (isSubmitted && score != null) {
    const s = Math.round(score);
    scoreLabel = `${s}%`;
    if (s >= 80) { scoreBg = '#D1FAE5'; scoreFg = '#059669'; }
    else if (s >= 60) { scoreBg = '#FEF3C7'; scoreFg = '#D97706'; }
    else { scoreBg = '#FFE4E6'; scoreFg = '#E11D48'; }
  } else if (overdue) {
    scoreLabel = 'Overdue';
    scoreBg = '#FFE4E6';
    scoreFg = '#E11D48';
  }

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => {
        if (overdue) return;
        router.push({ pathname: '/worksheet/[worksheetId]', params: { worksheetId: item.publicId } });
      }}
      className="mb-3"
    >
      <Card>
        <View className="flex-row items-start">
          <View
            className="w-12 h-12 rounded-2xl items-center justify-center"
            style={{ backgroundColor: isSubmitted ? '#D1FAE5' : '#EEF2FF' }}
          >
            <Ionicons
              name={isSubmitted ? 'trophy' : 'document-text-outline'}
              size={22}
              color={isSubmitted ? '#059669' : '#4F46E5'}
            />
          </View>
          <View className="flex-1 ml-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-bold text-gray-900 flex-1 mr-2" numberOfLines={1}>
                {item.title}
              </Text>
              <View
                className="px-2 py-0.5 rounded-full"
                style={{ backgroundColor: scoreBg }}
              >
                <Text className="text-[11px] font-bold" style={{ color: scoreFg }}>
                  {scoreLabel}
                </Text>
              </View>
            </View>
            <Text className="text-xs text-gray-500 mt-1">
              {item.questionCount} questions
              {item.subject ? ` · ${item.subject}` : ''}
            </Text>
            {due && (
              <View className="flex-row items-center mt-1.5">
                <Ionicons
                  name="time-outline"
                  size={11}
                  color={overdue ? '#E11D48' : '#94A3B8'}
                />
                <Text
                  className="text-[11px] ml-1"
                  style={{ color: overdue ? '#E11D48' : '#94A3B8' }}
                >
                  Due {format(due, 'MMM d, h:mm a')}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

function ResourceRow({ item }: { item: Resource }) {
  const fileInfo = getFileType(item.filename);

  async function openResource() {
    try {
      const url = await resourcesService.getReadUrl(item.publicId);
      if (url) Linking.openURL(url);
      else Alert.alert('Cannot open', 'Resource URL not available.');
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to fetch resource');
    }
  }

  return (
    <TouchableOpacity onPress={openResource} activeOpacity={0.85} className="mb-3">
      <Card>
        <View className="flex-row items-center">
          <View
            className="w-12 h-12 rounded-2xl items-center justify-center"
            style={{ backgroundColor: fileInfo.bg }}
          >
            <Text className="text-[10px] font-bold" style={{ color: fileInfo.fg }}>
              {fileInfo.label}
            </Text>
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-sm font-bold text-gray-900" numberOfLines={1}>
              {item.title}
            </Text>
            {item.description && (
              <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
                {item.description}
              </Text>
            )}
            <Text className="text-[11px] text-gray-400 mt-1">
              {(item.fileSizeBytes / 1024).toFixed(0)} KB · {format(parseISO(item.createdAt), 'MMM d')}
            </Text>
          </View>
          <Ionicons name="open-outline" size={18} color="#94A3B8" />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

export default function StudyScreen() {
  const [tab, setTab] = useState<TabKey>('worksheets');

  const { data: worksheets, isLoading: wLoading, refetch: refetchW, isRefetching: rW } = useQuery({
    queryKey: ['my-worksheets', 'WORKSHEET'],
    queryFn: () => worksheetsService.getMyAsStudent({ type: 'WORKSHEET', limit: '50' }),
    enabled: tab === 'worksheets',
  });

  const { data: assignments, isLoading: aLoading, refetch: refetchA, isRefetching: rA } = useQuery({
    queryKey: ['my-worksheets', 'ASSIGNMENT'],
    queryFn: () => worksheetsService.getMyAsStudent({ type: 'ASSIGNMENT', limit: '50' }),
    enabled: tab === 'assignments',
  });

  const { data: resources, isLoading: rLoading, refetch: refetchR, isRefetching: rR } = useQuery({
    queryKey: ['my-resources'],
    queryFn: () => resourcesService.getMyAsStudent({ limit: '50' }),
    enabled: tab === 'resources',
  });

  const isLoading = (tab === 'worksheets' && wLoading) ||
                    (tab === 'assignments' && aLoading) ||
                    (tab === 'resources' && rLoading);

  let listData: (WorksheetSummary | Resource)[] = [];
  if (tab === 'worksheets')  listData = worksheets?.items ?? [];
  if (tab === 'assignments') listData = assignments?.items ?? [];
  if (tab === 'resources')   listData = resources?.items ?? [];

  const refetch = tab === 'resources' ? refetchR : tab === 'assignments' ? refetchA : refetchW;
  const isRefetching = tab === 'resources' ? rR : tab === 'assignments' ? rA : rW;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-bold text-gray-900">Study</Text>
        <Text className="text-sm text-gray-500 mt-0.5">
          Worksheets, assignments and learning resources
        </Text>
      </View>

      {/* Tabs */}
      <View className="flex-row gap-2 px-5 mb-2">
        {TABS.map((t) => (
          <Chip
            key={t.key}
            label={t.label}
            selected={tab === t.key}
            onPress={() => setTab(t.key)}
          />
        ))}
      </View>

      {isLoading ? (
        <LoadingScreen />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.publicId}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366F1" />}
          renderItem={({ item }) =>
            tab === 'resources'
              ? <ResourceRow item={item as Resource} />
              : <WorksheetRow item={item as WorksheetSummary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon={
                tab === 'resources' ? 'folder-open-outline'
                : tab === 'assignments' ? 'clipboard-outline'
                : 'document-text-outline'
              }
              title={`No ${tab} yet`}
              description={
                tab === 'resources'
                  ? 'Your tutor will share study materials here.'
                  : `Your ${tab} will appear here when assigned.`
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
