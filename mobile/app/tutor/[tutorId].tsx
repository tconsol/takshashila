import React, { useState } from 'react';
import {
  View, Text, ScrollView, Alert, TouchableOpacity, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { EmptyState } from '../../components/ui/EmptyState';
import { tutorsService } from '../../services/tutors.service';
import { scheduleService } from '../../services/schedule.service';
import { classesService } from '../../services/classes.service';
import { useAuthStore } from '../../stores/auth.store';
import type { TutorSlot } from '../../types/api.types';

export default function BookWithTutorScreen() {
  const { tutorId } = useLocalSearchParams<{ tutorId: string }>();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [selectedSlot, setSelectedSlot] = useState<TutorSlot | null>(null);
  const [subject, setSubject] = useState('');

  const { data: tutor, isLoading: tLoading } = useQuery({
    queryKey: ['tutor', tutorId],
    queryFn: () => tutorsService.getByPublicId(tutorId),
  });

  const { data: slots, isLoading: sLoading } = useQuery({
    queryKey: ['tutor-availability', tutorId],
    queryFn: () => scheduleService.getTutorAvailability(tutorId),
  });

  const bookMutation = useMutation({
    mutationFn: () =>
      classesService.book({
        tutorPublicId: tutorId,
        availabilitySlotPublicId: selectedSlot!.publicId,
        classType: 'ONE_ON_ONE',
        title: subject || 'Class with ' + (tutor?.displayName ?? 'tutor'),
        idempotencyKey: `${user?.publicId}-${selectedSlot!.publicId}-${Date.now()}`,
      }),
    onSuccess: (newClass) => {
      qc.invalidateQueries({ queryKey: ['my-classes'] });
      qc.invalidateQueries({ queryKey: ['tutor-availability', tutorId] });
      setSelectedSlot(null);
      Alert.alert('Booked!', 'Your class has been successfully booked.', [
        { text: 'View class', onPress: () => router.replace(`/class/${newClass.publicId}`) },
        { text: 'OK' },
      ]);
    },
    onError: (err: Error) => Alert.alert('Booking Failed', err.message),
  });

  if (tLoading || sLoading || !tutor) return <LoadingScreen />;

  const availableSlots = Array.isArray(slots) ? slots.filter((s) => !s.isBooked) : [];

  // Group slots by date
  const grouped = availableSlots.reduce<Record<string, TutorSlot[]>>((acc, slot) => {
    const day = format(parseISO(slot.startUTC), 'yyyy-MM-dd');
    if (!acc[day]) acc[day] = [];
    acc[day].push(slot);
    return acc;
  }, {});

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Tutor header */}
        <Card className="items-center py-5 mb-4">
          <Avatar name={tutor.displayName} size={64} />
          <View className="flex-row items-center mt-2 gap-1">
            <Text className="text-lg font-bold text-gray-900">{tutor.displayName}</Text>
            {tutor.isVerified && <Ionicons name="checkmark-circle" size={16} color="#0284C7" />}
          </View>
          <View className="flex-row items-center mt-1">
            <Ionicons name="star" size={13} color="#F59E0B" />
            <Text className="text-xs font-semibold text-gray-700 ml-1">
              {tutor.rating?.toFixed(1) ?? 'New'}
            </Text>
            <Text className="text-xs text-gray-300 mx-1.5">·</Text>
            <Text className="text-xs text-gray-500">
              ₹{((tutor.hourlyRateCents ?? 0) / 100).toFixed(0)}/hr
            </Text>
          </View>
        </Card>

        <Text className="text-base font-bold text-gray-900 mb-3 px-1">
          Available time slots
        </Text>

        {Object.keys(grouped).length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="No slots available"
            description="This tutor has no open slots right now."
          />
        ) : (
          Object.entries(grouped).map(([day, daySlots]) => (
            <View key={day} className="mb-4">
              <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 px-1">
                {format(parseISO(day), 'EEEE, MMM d')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {daySlots.map((slot) => {
                  const start = parseISO(slot.startUTC);
                  const isSelected = selectedSlot?.publicId === slot.publicId;
                  return (
                    <TouchableOpacity
                      key={slot.publicId}
                      onPress={() => setSelectedSlot(isSelected ? null : slot)}
                      activeOpacity={0.8}
                      className={`px-4 py-2.5 rounded-2xl border ${
                        isSelected
                          ? 'bg-primary-500 border-primary-500'
                          : 'bg-white border-gray-100'
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold ${
                          isSelected ? 'text-white' : 'text-gray-700'
                        }`}
                      >
                        {format(start, 'h:mm a')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))
        )}

        {selectedSlot && (
          <Card className="mt-2 border border-primary-200">
            <Text className="text-sm font-bold text-gray-900 mb-1">Selected slot</Text>
            <Text className="text-xs text-gray-500 mb-3">
              {format(parseISO(selectedSlot.startUTC), 'EEE, MMM d · h:mm a')} –{' '}
              {format(parseISO(selectedSlot.endUTC), 'h:mm a')}{' '}
              ({differenceInMinutes(parseISO(selectedSlot.endUTC), parseISO(selectedSlot.startUTC))} min)
            </Text>
            <Text className="text-xs font-medium text-gray-700 mb-2">Subject / Topic</Text>
            <TextInput
              className="bg-gray-50 border border-gray-100 rounded-2xl px-3 py-3 text-base text-gray-900 mb-3"
              placeholder="e.g. Math – Algebra basics"
              placeholderTextColor="#94A3B8"
              value={subject}
              onChangeText={setSubject}
            />
            <Button
              variant="primary"
              size="lg"
              loading={bookMutation.isPending}
              onPress={() => bookMutation.mutate()}
            >
              Confirm Booking
            </Button>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
