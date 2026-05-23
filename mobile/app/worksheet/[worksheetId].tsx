import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { worksheetsService } from '../../services/worksheets.service';
import type { Worksheet, WorksheetSubmission } from '../../types/api.types';

export default function WorksheetTestScreen() {
  const { worksheetId } = useLocalSearchParams<{ worksheetId: string }>();
  const qc = useQueryClient();
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const startedAtRef = useRef<number>(Date.now());

  const { data: worksheet, isLoading: wLoading } = useQuery({
    queryKey: ['worksheet', worksheetId],
    queryFn: () => worksheetsService.getById(worksheetId),
  });

  const { data: existingSubmission, isLoading: sLoading } = useQuery({
    queryKey: ['worksheet-submission', worksheetId],
    queryFn: () => worksheetsService.getMySubmission(worksheetId),
  });

  useEffect(() => {
    if (existingSubmission) setSubmitted(true);
  }, [existingSubmission]);

  const submitMutation = useMutation({
    mutationFn: () => {
      const total = worksheet?.questions?.length ?? 0;
      const arr: number[] = Array.from({ length: total }, (_, i) => answers[i] ?? -1);
      const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000);
      return worksheetsService.submit(worksheetId, arr, elapsed);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['worksheet-submission', worksheetId] });
      qc.invalidateQueries({ queryKey: ['my-worksheets'] });
      setSubmitted(true);
    },
    onError: (err: Error) => Alert.alert('Submit failed', err.message),
  });

  if (wLoading || sLoading || !worksheet) return <LoadingScreen />;

  if (submitted && existingSubmission) {
    return <ResultsView worksheet={worksheet} submission={existingSubmission} />;
  }

  if (submitted && submitMutation.data) {
    return <ResultsView worksheet={worksheet} submission={submitMutation.data} />;
  }

  const questions = worksheet.questions ?? [];
  const q = questions[currentQ];
  const total = questions.length;
  const answered = Object.keys(answers).length;
  const isLast = currentQ === total - 1;

  if (!q) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center p-8">
          <Ionicons name="document-text-outline" size={48} color="#CBD5E1" />
          <Text className="text-gray-500 mt-3">This worksheet has no questions yet.</Text>
        </View>
      </SafeAreaView>
    );
  }

  function selectAnswer(idx: number) {
    setAnswers((prev) => ({ ...prev, [currentQ]: idx }));
  }

  function handleSubmit() {
    Alert.alert(
      'Submit test?',
      `You've answered ${answered} of ${total} questions. Once submitted you cannot change your answers.`,
      [
        { text: 'Continue', style: 'cancel' },
        { text: 'Submit', onPress: () => submitMutation.mutate() },
      ],
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      {/* Header */}
      <View className="px-5 pt-2 pb-3">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-xs text-gray-500">
            Question {currentQ + 1} of {total}
          </Text>
          <Text className="text-xs font-semibold text-primary-600">
            {answered}/{total} answered
          </Text>
        </View>
        <ProgressBar value={currentQ + 1} max={total} height={6} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Card className="mb-5">
          <Text className="text-[11px] font-bold text-primary-600 uppercase tracking-wide mb-2">
            Question {currentQ + 1}
          </Text>
          <Text className="text-lg font-bold text-gray-900 leading-7">{q.text}</Text>
        </Card>

        {/* Options */}
        <View className="gap-3">
          {q.options.map((opt, i) => {
            const selected = answers[currentQ] === i;
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.85}
                onPress={() => selectAnswer(i)}
                className={`flex-row items-center p-4 rounded-2xl border-2 ${
                  selected
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-100 bg-white'
                }`}
              >
                <View
                  className={`w-8 h-8 rounded-xl items-center justify-center ${
                    selected ? 'bg-primary-500' : 'bg-gray-100'
                  }`}
                >
                  <Text
                    className={`font-bold ${selected ? 'text-white' : 'text-gray-500'}`}
                  >
                    {String.fromCharCode(65 + i)}
                  </Text>
                </View>
                <Text
                  className={`flex-1 ml-3 text-base ${
                    selected ? 'font-semibold text-primary-900' : 'text-gray-700'
                  }`}
                >
                  {opt}
                </Text>
                {selected && <Ionicons name="checkmark-circle" size={22} color="#6366F1" />}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom nav */}
      <View className="border-t border-gray-100 bg-white px-5 py-3 flex-row gap-3">
        <Button
          variant="outline"
          size="md"
          disabled={currentQ === 0}
          onPress={() => setCurrentQ((c) => Math.max(0, c - 1))}
          className="flex-1"
        >
          Previous
        </Button>
        {isLast ? (
          <Button
            variant="primary"
            size="md"
            disabled={answered === 0}
            loading={submitMutation.isPending}
            onPress={handleSubmit}
            className="flex-1"
          >
            Submit Test
          </Button>
        ) : (
          <Button
            variant="primary"
            size="md"
            onPress={() => setCurrentQ((c) => Math.min(total - 1, c + 1))}
            className="flex-1"
          >
            Next
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
}

function ResultsView({ worksheet, submission }: { worksheet: Worksheet; submission: WorksheetSubmission }) {
  const score = Math.round(submission.scorePercent ?? 0);
  const color = score >= 80 ? '#059669' : score >= 60 ? '#D97706' : '#E11D48';
  const bg = score >= 80 ? '#D1FAE5' : score >= 60 ? '#FEF3C7' : '#FFE4E6';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Score hero */}
        <Card className="items-center py-8 mb-4">
          <View
            className="w-32 h-32 rounded-full items-center justify-center mb-3"
            style={{ backgroundColor: bg }}
          >
            <Text className="text-4xl font-bold" style={{ color }}>
              {score}%
            </Text>
          </View>
          <Text className="text-xl font-bold text-gray-900">
            {score >= 80 ? 'Excellent work! 🎉' : score >= 60 ? 'Good job!' : 'Keep practicing'}
          </Text>
          <Text className="text-sm text-gray-500 mt-1">
            {submission.correctCount} out of {submission.totalQuestions} correct
          </Text>
          {submission.timeTakenSeconds && (
            <View className="flex-row items-center mt-3">
              <Ionicons name="time-outline" size={14} color="#64748B" />
              <Text className="text-xs text-gray-500 ml-1">
                {Math.floor(submission.timeTakenSeconds / 60)}m {submission.timeTakenSeconds % 60}s
              </Text>
            </View>
          )}
        </Card>

        {/* Review */}
        <Text className="text-base font-bold text-gray-900 mb-3 px-1">Review answers</Text>

        {worksheet.questions?.map((q, i) => {
          const userAns = submission.answers?.[i] ?? -1;
          const correct = q.correctOptionIndex;
          const isCorrect = userAns === correct;
          return (
            <Card key={i} className="mb-3">
              <View className="flex-row items-start gap-2 mb-3">
                <View
                  className={`w-6 h-6 rounded-full items-center justify-center ${
                    isCorrect ? 'bg-emerald-100' : 'bg-rose-100'
                  }`}
                >
                  <Ionicons
                    name={isCorrect ? 'checkmark' : 'close'}
                    size={14}
                    color={isCorrect ? '#059669' : '#E11D48'}
                  />
                </View>
                <Text className="flex-1 text-sm font-semibold text-gray-900">
                  {i + 1}. {q.text}
                </Text>
              </View>
              <View className="gap-2 mb-2">
                {q.options.map((opt, oi) => {
                  const isUser = userAns === oi;
                  const isAns = correct === oi;
                  let bg = 'bg-gray-50';
                  let fg = 'text-gray-700';
                  if (isAns) { bg = 'bg-emerald-50'; fg = 'text-emerald-700'; }
                  else if (isUser && !isCorrect) { bg = 'bg-rose-50'; fg = 'text-rose-700'; }
                  return (
                    <View key={oi} className={`flex-row items-center p-2 rounded-xl ${bg}`}>
                      <Text className={`text-xs font-bold w-5 ${fg}`}>
                        {String.fromCharCode(65 + oi)}
                      </Text>
                      <Text className={`flex-1 text-sm ${fg}`}>{opt}</Text>
                      {isAns && <Ionicons name="checkmark" size={14} color="#059669" />}
                      {isUser && !isCorrect && <Ionicons name="close" size={14} color="#E11D48" />}
                    </View>
                  );
                })}
              </View>
              {q.explanation && (
                <View className="bg-sky-50 rounded-xl p-3 mt-1">
                  <Text className="text-xs font-bold text-sky-700 mb-0.5">Explanation</Text>
                  <Text className="text-xs text-sky-900">{q.explanation}</Text>
                </View>
              )}
            </Card>
          );
        })}

        <Button variant="outline" size="lg" onPress={() => router.back()} className="mt-3">
          Back to Worksheets
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
