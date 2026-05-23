import React, { useState } from 'react';
import {
  View, Text, ScrollView, Alert, Linking, Modal, TextInput, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { classesService } from '../../services/classes.service';
import { ratingsService } from '../../services/ratings.service';
import type { ClassStatus } from '../../types/api.types';

const STATUS_BADGE: Record<ClassStatus, { label: string; variant: 'success' | 'warning' | 'error' | 'info' | 'neutral' }> = {
  SCHEDULED:   { label: 'Scheduled',  variant: 'info' },
  IN_PROGRESS: { label: 'Live Now',   variant: 'success' },
  COMPLETED:   { label: 'Completed',  variant: 'neutral' },
  CANCELLED:   { label: 'Cancelled',  variant: 'error' },
  NO_SHOW:     { label: 'No Show',    variant: 'warning' },
};

function InfoRow({ icon, label, value, color = '#6366F1' }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View className="flex-row items-start py-3 border-b border-gray-50 last:border-0">
      <View
        className="w-9 h-9 rounded-2xl items-center justify-center"
        style={{ backgroundColor: color + '15' }}
      >
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-[11px] text-gray-500 font-medium uppercase tracking-wide">{label}</Text>
        <Text className="text-sm text-gray-900 mt-0.5">{value}</Text>
      </View>
    </View>
  );
}

export default function ClassDetailScreen() {
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const qc = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [rateOpen, setRateOpen] = useState(false);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');

  const { data: cls, isLoading } = useQuery({
    queryKey: ['class', classId],
    queryFn: () => classesService.getById(classId),
    enabled: !!classId,
  });

  const { data: ratedIds } = useQuery({
    queryKey: ['rated-class-ids'],
    queryFn: ratingsService.getMyRatedClassIds,
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) => classesService.cancel(classId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-classes'] });
      qc.invalidateQueries({ queryKey: ['class', classId] });
      setCancelOpen(false);
      Alert.alert('Cancelled', 'Your class has been cancelled.');
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const rateMutation = useMutation({
    mutationFn: () =>
      ratingsService.rateClass({ classPublicId: classId, score, comment: comment || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rated-class-ids'] });
      setRateOpen(false);
      Alert.alert('Thank you!', 'Your rating has been submitted.');
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  if (isLoading || !cls) return <LoadingScreen />;

  const start = parseISO(cls.scheduledStartUTC);
  const end = parseISO(cls.scheduledEndUTC);
  const duration = differenceInMinutes(end, start);
  const badge = STATUS_BADGE[cls.status] ?? { label: cls.status, variant: 'neutral' as const };
  const cost = cls.costCents > 0 ? `₹${(cls.costCents / 100).toFixed(0)}` : 'Free';
  const isRated = (ratedIds ?? []).includes(classId);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Hero */}
        <Card className="mb-4">
          <View className="flex-row items-start justify-between mb-3">
            <View className="flex-1 mr-2">
              <Text className="text-xs text-gray-500 mb-1">
                {format(start, 'EEEE, MMMM d')}
              </Text>
              <Text className="text-xl font-bold text-gray-900" numberOfLines={2}>
                {cls.subject || 'Class'}
              </Text>
            </View>
            <Badge label={badge.label} variant={badge.variant} />
          </View>

          {cls.status === 'IN_PROGRESS' && (
            <View className="bg-emerald-50 rounded-2xl p-3 flex-row items-center mt-1">
              <View className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
              <Text className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                Class is happening right now
              </Text>
            </View>
          )}

          <View className="mt-3">
            <InfoRow
              icon="time-outline"
              label="Time"
              value={`${format(start, 'h:mm a')} – ${format(end, 'h:mm a')} (${duration} min)`}
            />
            <InfoRow
              icon="layers-outline"
              label="Type"
              value={cls.classType.replace(/_/g, ' ')}
              color="#9333EA"
            />
            <InfoRow
              icon="cash-outline"
              label="Cost"
              value={cost}
              color="#059669"
            />
            {cls.notes && (
              <InfoRow icon="document-text-outline" label="Notes" value={cls.notes} color="#0284C7" />
            )}
          </View>
        </Card>

        {/* Actions */}
        <View className="gap-3">
          {cls.status === 'IN_PROGRESS' && cls.meetingUrl && (
            <Button
              variant="secondary"
              size="lg"
              onPress={() => Linking.openURL(cls.meetingUrl!)}
            >
              Join class now
            </Button>
          )}

          {cls.status === 'SCHEDULED' && cls.meetingUrl && (
            <Button
              variant="outline"
              size="lg"
              onPress={() => Linking.openURL(cls.meetingUrl!)}
            >
              Open meeting link
            </Button>
          )}

          {cls.status === 'SCHEDULED' && (
            <Button
              variant="danger"
              size="md"
              loading={cancelMutation.isPending}
              onPress={() => setCancelOpen(true)}
            >
              Cancel class
            </Button>
          )}

          {cls.status === 'COMPLETED' && !isRated && (
            <Button variant="primary" size="lg" onPress={() => setRateOpen(true)}>
              Rate this class
            </Button>
          )}

          {cls.status === 'COMPLETED' && isRated && (
            <View className="bg-emerald-50 rounded-3xl p-4 flex-row items-center">
              <Ionicons name="checkmark-circle" size={22} color="#059669" />
              <Text className="text-sm font-semibold text-emerald-700 ml-2">
                You've already rated this class
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Cancel modal */}
      <Modal visible={cancelOpen} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl p-5 pb-8">
            <Text className="text-xl font-bold text-gray-900 mb-2">Cancel class</Text>
            <Text className="text-sm text-gray-500 mb-4">
              Please tell us why you're cancelling so we can improve.
            </Text>
            <TextInput
              className="bg-gray-50 border border-gray-100 rounded-2xl px-3 py-3 text-base text-gray-900 mb-4"
              placeholder="Reason for cancellation..."
              placeholderTextColor="#94A3B8"
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />
            <View className="flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onPress={() => setCancelOpen(false)}
              >
                Keep class
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                loading={cancelMutation.isPending}
                disabled={cancelReason.trim().length < 3}
                onPress={() => cancelMutation.mutate(cancelReason.trim())}
              >
                Cancel class
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rate modal */}
      <Modal visible={rateOpen} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl p-5 pb-8">
            <Text className="text-xl font-bold text-gray-900 mb-1">Rate this class</Text>
            <Text className="text-sm text-gray-500 mb-5">How was your experience?</Text>

            <View className="flex-row justify-center gap-2 mb-5">
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setScore(s)}
                  activeOpacity={0.7}
                  className="p-2"
                >
                  <Ionicons
                    name={s <= score ? 'star' : 'star-outline'}
                    size={36}
                    color={s <= score ? '#F59E0B' : '#CBD5E1'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              className="bg-gray-50 border border-gray-100 rounded-2xl px-3 py-3 text-base text-gray-900 mb-4"
              placeholder="Optional feedback..."
              placeholderTextColor="#94A3B8"
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />

            <View className="flex-row gap-3">
              <Button variant="outline" className="flex-1" onPress={() => setRateOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                disabled={score === 0}
                loading={rateMutation.isPending}
                onPress={() => rateMutation.mutate()}
              >
                Submit
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
