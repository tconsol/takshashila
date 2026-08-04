import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform,
  Image, ActivityIndicator, Pressable, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { format, parseISO, isSameDay } from 'date-fns';
import { chatService, type Message } from '../../services/chat.service';
import {
  pickImage, pickDocument, uploadChatMedia, getMediaReadUrl, validateChatFile,
  startVoiceRecording, stopVoiceRecording, cancelVoiceRecording,
} from '../../services/chat-media.service';
import { useAuthStore } from '../../stores/auth.store';

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

function fileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── Lazily-loaded media inside a bubble ──────────────────────────────────────
function MediaContent({ msg, mine }: { msg: Message; mine: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (msg.mediaPublicId) getMediaReadUrl(msg.mediaPublicId).then(setUrl).catch(() => {});
  }, [msg.mediaPublicId]);

  const mime = msg.mediaMimeType ?? '';

  if (mime.startsWith('image/')) {
    return url
      ? <Image source={{ uri: url }} style={{ width: 200, height: 200, borderRadius: 12 }} resizeMode="cover" />
      : <View className="h-48 w-48 items-center justify-center rounded-xl bg-black/10"><ActivityIndicator /></View>;
  }
  if (mime.startsWith('audio/')) return <VoiceBubble url={url} mine={mine} />;

  // video / document → chip that opens the file
  return (
    <TouchableOpacity
      onPress={() => url && require('react-native').Linking.openURL(url)}
      className="flex-row items-center gap-2"
    >
      <Ionicons name={mime.startsWith('video/') ? 'videocam' : 'document'} size={22} color={mine ? '#fff' : '#6366F1'} />
      <View>
        <Text className={mine ? 'text-white font-medium' : 'text-slate-800 font-medium'} numberOfLines={1}>{msg.mediaName ?? 'File'}</Text>
        <Text className={mine ? 'text-white/70 text-[11px]' : 'text-slate-400 text-[11px]'}>{fileSize(msg.mediaSizeBytes)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function VoiceBubble({ url, mine }: { url: string | null; mine: boolean }) {
  const [playing, setPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  const toggle = async () => {
    if (!url) return;
    if (playing) { await soundRef.current?.pauseAsync(); setPlaying(false); return; }
    if (!soundRef.current) {
      const { sound } = await Audio.Sound.createAsync({ uri: url });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((s) => { if (s.isLoaded && s.didJustFinish) setPlaying(false); });
    }
    await soundRef.current.playAsync();
    setPlaying(true);
  };
  useEffect(() => () => { soundRef.current?.unloadAsync(); }, []);

  return (
    <TouchableOpacity onPress={toggle} className="flex-row items-center gap-2">
      <Ionicons name={playing ? 'pause-circle' : 'play-circle'} size={30} color={mine ? '#fff' : '#6366F1'} />
      <View className="h-1 w-28 rounded-full" style={{ backgroundColor: mine ? 'rgba(255,255,255,0.5)' : '#C7D2FE' }} />
      <Ionicons name="mic" size={16} color={mine ? '#fff' : '#6366F1'} />
    </TouchableOpacity>
  );
}

export default function ChatScreen() {
  const { conversationId, name } = useLocalSearchParams<{ conversationId: string; name?: string }>();
  const myId = useAuthStore((s) => s.user?.publicId);
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [reactTarget, setReactTarget] = useState<Message | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  const { data: messages = [] } = useQuery({
    queryKey: ['chat', conversationId, 'messages'],
    queryFn: () => chatService.getMessages(conversationId!, { limit: '100' }),
    enabled: !!conversationId,
    refetchInterval: 4000,
  });

  useEffect(() => { if (conversationId) chatService.markRead(conversationId).catch(() => {}); }, [conversationId, messages.length]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['chat', conversationId, 'messages'] });
    qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
  };

  const sendText = useMutation({
    mutationFn: (body: string) => chatService.sendMessage(conversationId!, { body }),
    onSuccess: () => { setText(''); invalidate(); },
  });

  const sendMedia = async (picker: typeof pickImage | typeof pickDocument) => {
    const file = await picker();
    if (!file) return;
    const v = await validateChatFile({ mimeType: file.mimeType, size: file.size, name: file.name });
    if (!v.valid) { Alert.alert('Cannot send', v.error); return; }
    setUploading(true);
    try {
      const up = await uploadChatMedia(file);
      await chatService.sendMessage(conversationId!, {
        mediaPublicId: up.mediaPublicId, mediaMimeType: up.mediaMimeType,
        mediaName: up.mediaName, mediaSizeBytes: up.mediaSizeBytes,
      });
      invalidate();
    } catch { Alert.alert('Upload failed', 'Could not send the file.'); }
    finally { setUploading(false); }
  };

  const toggleVoice = async () => {
    if (recording) {
      setRecording(false);
      const file = await stopVoiceRecording();
      if (!file) return;
      setUploading(true);
      try {
        const up = await uploadChatMedia({ ...file, size: file.size || 1 });
        await chatService.sendMessage(conversationId!, {
          mediaPublicId: up.mediaPublicId, mediaMimeType: up.mediaMimeType, mediaName: up.mediaName, mediaSizeBytes: up.mediaSizeBytes,
        });
        invalidate();
      } catch { Alert.alert('Failed', 'Could not send the voice message.'); }
      finally { setUploading(false); }
    } else {
      const ok = await startVoiceRecording();
      if (ok) setRecording(true);
      else Alert.alert('Microphone', 'Permission denied or unavailable.');
    }
  };

  const react = async (emoji: string) => {
    if (!reactTarget) return;
    try { await chatService.reactToMessage(conversationId!, reactTarget.publicId, emoji); invalidate(); } catch {}
    setReactTarget(null);
  };
  const deleteMsg = async () => {
    if (!reactTarget) return;
    try { await chatService.deleteMessage(conversationId!, reactTarget.publicId, true); invalidate(); } catch {}
    setReactTarget(null);
  };

  const ordered = [...messages].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));

  return (
    <SafeAreaView className="flex-1" edges={['bottom']} style={{ backgroundColor: '#ECE5DD' }}>
      <Stack.Screen options={{ headerTitle: (name as string) || 'Chat' }} />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <FlatList
          ref={listRef}
          data={ordered}
          keyExtractor={(m) => m.publicId}
          contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item, index }) => {
            const mine = item.senderPublicId === myId;
            const prev = ordered[index - 1];
            const showDate = !prev || !isSameDay(parseISO(item.createdAt), parseISO(prev.createdAt));
            const isMedia = !!item.mediaPublicId;
            const reactionList = item.reactions ? Object.entries(item.reactions).filter(([, u]) => u.length) : [];
            return (
              <>
                {showDate && (
                  <View className="my-2 items-center">
                    <Text className="rounded-full bg-white/70 px-3 py-1 text-[11px] text-slate-500">
                      {format(parseISO(item.createdAt), 'MMM d, yyyy')}
                    </Text>
                  </View>
                )}
                <Pressable
                  onLongPress={() => setReactTarget(item)}
                  className={`mb-1.5 max-w-[82%] ${mine ? 'self-end' : 'self-start'}`}
                >
                  <View
                    className={`px-2.5 py-2 ${mine ? 'rounded-2xl rounded-tr-sm bg-[#DCF8C6]' : 'rounded-2xl rounded-tl-sm bg-white'}`}
                    style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 1, shadowOffset: { width: 0, height: 1 }, elevation: 1 }}
                  >
                    {isMedia ? <MediaContent msg={item} mine={mine} /> : null}
                    {!!item.body && <Text className="text-[15px] text-slate-800" style={{ marginTop: isMedia ? 6 : 0 }}>{item.body}</Text>}
                    <View className="mt-0.5 flex-row items-center justify-end gap-1">
                      <Text className="text-[10px] text-slate-400">{format(parseISO(item.createdAt), 'h:mm a')}</Text>
                      {mine && <Ionicons name={item.isRead ? 'checkmark-done' : 'checkmark'} size={14} color={item.isRead ? '#34B7F1' : '#94A3B8'} />}
                    </View>
                  </View>
                  {reactionList.length > 0 && (
                    <View className={`mt-0.5 flex-row ${mine ? 'self-end' : 'self-start'}`}>
                      <View className="flex-row rounded-full bg-white px-1.5 py-0.5" style={{ elevation: 1 }}>
                        {reactionList.map(([emoji]) => <Text key={emoji} className="text-xs">{emoji}</Text>)}
                      </View>
                    </View>
                  )}
                </Pressable>
              </>
            );
          }}
        />

        {uploading && (
          <View className="flex-row items-center justify-center gap-2 bg-white/80 py-1.5">
            <ActivityIndicator size="small" color="#6366F1" />
            <Text className="text-xs text-slate-500">Uploading…</Text>
          </View>
        )}

        {/* Composer */}
        <View className="flex-row items-end gap-2 px-2 py-2" style={{ backgroundColor: '#F0F0F0' }}>
          <TouchableOpacity onPress={() => sendMedia(pickImage)} className="h-10 w-10 items-center justify-center">
            <Ionicons name="image" size={24} color="#6366F1" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => sendMedia(pickDocument)} className="h-10 w-10 items-center justify-center">
            <Ionicons name="attach" size={24} color="#6366F1" />
          </TouchableOpacity>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={recording ? 'Recording…' : 'Message'}
            editable={!recording}
            multiline
            className="max-h-28 flex-1 rounded-3xl bg-white px-4 py-2.5 text-[15px] text-slate-900"
          />
          {text.trim() ? (
            <TouchableOpacity onPress={() => sendText.mutate(text.trim())} className="h-11 w-11 items-center justify-center rounded-full bg-indigo-600">
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={toggleVoice} className={`h-11 w-11 items-center justify-center rounded-full ${recording ? 'bg-rose-600' : 'bg-indigo-600'}`}>
              <Ionicons name={recording ? 'stop' : 'mic'} size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Reaction / delete sheet */}
      {reactTarget && (
        <Pressable onPress={() => setReactTarget(null)} className="absolute inset-0 items-center justify-end bg-black/30 pb-24">
          <View className="mx-4 rounded-3xl bg-white p-4" onStartShouldSetResponder={() => true}>
            <View className="flex-row justify-around">
              {REACTIONS.map((e) => (
                <TouchableOpacity key={e} onPress={() => react(e)}><Text className="text-3xl">{e}</Text></TouchableOpacity>
              ))}
            </View>
            {reactTarget.senderPublicId === myId && (
              <TouchableOpacity onPress={deleteMsg} className="mt-3 flex-row items-center justify-center gap-2 rounded-2xl border border-rose-200 py-2.5">
                <Ionicons name="trash-outline" size={18} color="#E11D48" />
                <Text className="font-semibold text-rose-500">Delete message</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      )}
    </SafeAreaView>
  );
}
