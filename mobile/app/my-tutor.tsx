import React from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { EmptyState } from '../components/ui/EmptyState';
import { studentService } from '../services/student.service';
import { tutorsService } from '../services/tutors.service';

function StatBox({ icon, label, value, color }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; value: string; color: string;
}) {
  return (
    <View className="flex-1 items-center py-3">
      <Ionicons name={icon} size={18} color={color} />
      <Text className="text-base font-bold text-gray-900 mt-1">{value}</Text>
      <Text className="text-[11px] text-gray-500 mt-0.5 text-center">{label}</Text>
    </View>
  );
}

export default function MyTutorScreen() {
  const qc = useQueryClient();

  const { data: profile, isLoading: pLoading } = useQuery({
    queryKey: ['student-profile'],
    queryFn: studentService.getMyProfile,
  });

  const tutorId = profile?.tutorPublicId;

  const { data: tutor, isLoading: tLoading } = useQuery({
    queryKey: ['tutor', tutorId],
    queryFn: () => tutorsService.getByPublicId(tutorId!),
    enabled: !!tutorId,
  });

  const acceptMutation = useMutation({
    mutationFn: studentService.acceptInvite,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-profile'] });
      Alert.alert('Welcome!', 'You can now book classes with your tutor.');
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const declineMutation = useMutation({
    mutationFn: studentService.declineInvite,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-profile'] });
    },
  });

  if (pLoading) return <LoadingScreen />;

  if (!tutorId) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <EmptyState
          icon="person-add-outline"
          title="No tutor connected yet"
          description="Browse available tutors and book a demo class to get started."
        />
      </SafeAreaView>
    );
  }

  if (tLoading || !tutor) return <LoadingScreen />;

  const isPending = profile?.status === 'INVITED';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {isPending && (
          <Card className="mb-4" >
            <View className="flex-row items-start">
              <Ionicons name="mail-unread" size={22} color="#D97706" />
              <View className="flex-1 ml-3">
                <Text className="font-bold text-gray-900">Pending invitation</Text>
                <Text className="text-sm text-gray-500 mt-1">
                  {tutor.displayName} invited you to be their student.
                </Text>
                <View className="flex-row gap-2 mt-3">
                  <Button
                    size="sm"
                    loading={acceptMutation.isPending}
                    onPress={() => acceptMutation.mutate()}
                    className="flex-1"
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={declineMutation.isPending}
                    onPress={() => declineMutation.mutate()}
                    className="flex-1"
                  >
                    Decline
                  </Button>
                </View>
              </View>
            </View>
          </Card>
        )}

        {/* Profile hero */}
        <Card className="items-center py-6 mb-4">
          <Avatar name={tutor.displayName} size={84} />
          <View className="flex-row items-center mt-3 gap-1">
            <Text className="text-xl font-bold text-gray-900">{tutor.displayName}</Text>
            {tutor.isVerified && (
              <Ionicons name="checkmark-circle" size={18} color="#0284C7" />
            )}
          </View>
          <View className="flex-row items-center mt-1">
            <Ionicons name="star" size={14} color="#F59E0B" />
            <Text className="text-sm font-semibold text-gray-700 ml-1">
              {tutor.rating?.toFixed(1) ?? 'New'}
            </Text>
            {tutor.totalRatings != null && (
              <Text className="text-xs text-gray-500 ml-1">({tutor.totalRatings})</Text>
            )}
          </View>
          {tutor.bio && (
            <Text className="text-sm text-gray-600 text-center mt-3 px-4" numberOfLines={4}>
              {tutor.bio}
            </Text>
          )}
        </Card>

        {/* Stats row */}
        <Card className="flex-row mb-4 px-0">
          <StatBox icon="people-outline" label="Students" value={String(tutor.totalStudents ?? 0)} color="#4F46E5" />
          <View className="w-px bg-gray-100 my-3" />
          <StatBox icon="checkmark-done" label="Classes" value={String(tutor.totalClassesCompleted ?? 0)} color="#059669" />
          <View className="w-px bg-gray-100 my-3" />
          <StatBox
            icon="cash-outline"
            label="Hourly Rate"
            value={`₹${((tutor.hourlyRateCents ?? 0) / 100).toFixed(0)}`}
            color="#D97706"
          />
        </Card>

        {/* Subjects */}
        {tutor.subjects?.length > 0 && (
          <Card className="mb-4">
            <Text className="text-sm font-bold text-gray-900 mb-3">Subjects</Text>
            <View className="flex-row flex-wrap gap-2">
              {tutor.subjects.map((s) => (
                <Badge key={s} label={s} variant="info" />
              ))}
            </View>
          </Card>
        )}

        {/* Contact info */}
        <Card>
          <Text className="text-sm font-bold text-gray-900 mb-2">Contact</Text>
          {tutor.email && (
            <View className="flex-row items-center py-2">
              <Ionicons name="mail-outline" size={18} color="#64748B" />
              <Text className="text-sm text-gray-700 ml-3">{tutor.email}</Text>
            </View>
          )}
          {tutor.phone && (
            <View className="flex-row items-center py-2">
              <Ionicons name="call-outline" size={18} color="#64748B" />
              <Text className="text-sm text-gray-700 ml-3">{tutor.phone}</Text>
            </View>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
