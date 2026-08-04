import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView,
  Platform, ActivityIndicator, Linking, Alert, StatusBar as RNStatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { connectSocket, getSocket } from '../../lib/socket';
import { classesService } from '../../services/classes.service';
import { useAuthStore } from '../../stores/auth.store';

interface ChatMsg { from: string; role: string; name: string; message: string; timestamp: string }
interface Peer { userPublicId: string; role: string; name?: string }

const AVATAR_COLORS = ['#6366F1', '#0EA5E9', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899'];
function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?';
}
function roleLabel(r: string) {
  return r ? r.charAt(0) + r.slice(1).toLowerCase() : 'Guest';
}

function Tile({ name, role, muted, cameraOff, isYou }: {
  name: string; role: string; muted?: boolean; cameraOff?: boolean; isYou?: boolean;
}) {
  return (
    <View
      className="flex-1 m-1 rounded-2xl overflow-hidden items-center justify-center"
      style={{ backgroundColor: '#1E293B', minHeight: 150, borderWidth: isYou ? 1.5 : 0, borderColor: '#6366F1' }}
    >
      <View className="h-16 w-16 rounded-full items-center justify-center" style={{ backgroundColor: colorFor(name) }}>
        <Text className="text-xl font-bold text-white">{initials(name)}</Text>
      </View>
      <View className="absolute left-2 bottom-2 flex-row items-center gap-1 rounded-lg px-2 py-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        {muted && <Ionicons name="mic-off" size={11} color="#F87171" />}
        <Text className="text-[11px] font-medium text-white" numberOfLines={1}>
          {isYou ? 'You' : name} {role ? `· ${roleLabel(role)}` : ''}
        </Text>
      </View>
      {cameraOff && (
        <View className="absolute right-2 top-2 rounded-md px-1.5 py-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <Ionicons name="videocam-off" size={12} color="#94A3B8" />
        </View>
      )}
    </View>
  );
}

export default function ClassRoomScreen() {
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const myId = user?.publicId ?? '';
  const myName = user ? `${user.firstName} ${user.lastName}`.trim() : 'You';
  const myRole = user?.role ?? 'STUDENT';

  const [peers, setPeers] = useState<Map<string, Peer>>(new Map());
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [handNotice, setHandNotice] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [joinError, setJoinError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMsg>>(null);
  const handTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: cls } = useQuery({
    queryKey: ['class', classId],
    queryFn: () => classesService.getById(classId),
    enabled: !!classId,
  });

  // Auto-join (SCHEDULED → LIVE) + wire the class socket room.
  useEffect(() => {
    if (!classId) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    classesService.join(classId)
      .then(() => qc.invalidateQueries({ queryKey: ['my-classes'] }))
      .catch((e: Error) => setJoinError(e.message || 'Failed to join class'));

    (async () => {
      const socket = getSocket() ?? (await connectSocket());
      if (!socket || cancelled) return;
      setConnecting(false);
      socket.emit('class:join', classId);
      socket.emit('class:announce', { classPublicId: classId, agoraUid: 0, name: myName, role: myRole });

      const onJoined = (p: { userPublicId: string; role: string }) => {
        if (p.userPublicId === myId) return;
        setPeers((prev) => {
          const next = new Map(prev);
          next.set(p.userPublicId, { userPublicId: p.userPublicId, role: p.role, name: next.get(p.userPublicId)?.name });
          return next;
        });
        // Re-announce so the newcomer learns our name.
        socket.emit('class:announce', { classPublicId: classId, agoraUid: 0, name: myName, role: myRole });
      };
      const onLeft = (p: { userPublicId: string }) => {
        setPeers((prev) => { const next = new Map(prev); next.delete(p.userPublicId); return next; });
      };
      const onChat = (m: ChatMsg) => {
        setMessages((prev) => [...prev, m]);
        if (m.from !== myId && m.name) {
          setPeers((prev) => {
            const ex = prev.get(m.from);
            if (!ex) return prev;
            const next = new Map(prev); next.set(m.from, { ...ex, name: m.name }); return next;
          });
        }
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
      };
      const onHand = (p: { userPublicId: string }) => {
        const nm = peersRef.current.get(p.userPublicId)?.name ?? 'A participant';
        setHandNotice(`${nm} raised their hand ✋`);
        setTimeout(() => setHandNotice(null), 4000);
      };
      const onStatus = (p: { status: string }) => {
        if (p.status === 'COMPLETED' || p.status === 'CANCELLED') {
          Alert.alert('Class ended', 'This class has ended.');
          leave();
        }
      };

      socket.on('class:user-joined', onJoined);
      socket.on('class:user-left', onLeft);
      socket.on('rtc:peer-left', onLeft);
      socket.on('class:chat-message', onChat);
      socket.on('class:hand-raised', onHand);
      socket.on('class:status-changed', onStatus);

      cleanup = () => {
        socket.emit('class:leave', classId);
        socket.off('class:user-joined', onJoined);
        socket.off('class:user-left', onLeft);
        socket.off('rtc:peer-left', onLeft);
        socket.off('class:chat-message', onChat);
        socket.off('class:hand-raised', onHand);
        socket.off('class:status-changed', onStatus);
      };
    })();

    return () => { cancelled = true; cleanup?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  // Keep a ref of peers for event handlers (avoids stale closures).
  const peersRef = useRef(peers);
  useEffect(() => { peersRef.current = peers; }, [peers]);

  function send() {
    const body = input.trim();
    if (!body) return;
    getSocket()?.emit('class:chat', { classPublicId: classId, message: body, senderName: myName });
    setInput('');
  }

  function toggleHand() {
    if (handRaised) { setHandRaised(false); return; }
    getSocket()?.emit('class:raise-hand', classId);
    setHandRaised(true);
    if (handTimer.current) clearTimeout(handTimer.current);
    handTimer.current = setTimeout(() => setHandRaised(false), 12000);
  }

  function leave() {
    qc.invalidateQueries({ queryKey: ['my-classes'] });
    if (router.canGoBack()) router.back();
    else router.replace('/(student)/classes');
  }

  const tiles = useMemo(() => {
    const arr: { key: string; name: string; role: string; isYou?: boolean; muted?: boolean; cameraOff?: boolean }[] = [
      { key: 'me', name: myName, role: myRole, isYou: true, muted, cameraOff },
    ];
    peers.forEach((p) => arr.push({ key: p.userPublicId, name: p.name ?? roleLabel(p.role), role: p.role }));
    return arr;
  }, [peers, myName, myRole, muted, cameraOff]);

  const participantCount = tiles.length;

  return (
    <View className="flex-1" style={{ backgroundColor: '#020617' }}>
      <Stack.Screen options={{ headerShown: false }} />
      <RNStatusBar barStyle="light-content" />
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3" style={{ backgroundColor: '#0F172A' }}>
          <View className="flex-row items-center gap-2 flex-1">
            <View className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1" style={{ backgroundColor: 'rgba(239,68,68,0.2)' }}>
              <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#EF4444' }} />
              <Text className="text-[11px] font-bold" style={{ color: '#F87171' }}>LIVE</Text>
            </View>
            <Text className="text-sm font-semibold text-white flex-1" numberOfLines={1}>
              {cls?.subject || 'Live Class'}
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            <View className="flex-row items-center gap-1">
              <Ionicons name="people" size={15} color="#94A3B8" />
              <Text className="text-xs text-slate-400">{participantCount}</Text>
            </View>
            <TouchableOpacity onPress={leave} className="rounded-lg px-3 py-1.5" style={{ backgroundColor: '#EF4444' }}>
              <Text className="text-xs font-bold text-white">Leave</Text>
            </TouchableOpacity>
          </View>
        </View>

        {connecting && (
          <View className="flex-row items-center justify-center gap-2 py-1.5" style={{ backgroundColor: 'rgba(245,158,11,0.15)' }}>
            <ActivityIndicator size="small" color="#FBBF24" />
            <Text className="text-xs" style={{ color: '#FBBF24' }}>Connecting…</Text>
          </View>
        )}
        {handNotice && (
          <View className="items-center py-1.5" style={{ backgroundColor: 'rgba(234,179,8,0.15)' }}>
            <Text className="text-xs font-medium" style={{ color: '#FDE047' }}>{handNotice}</Text>
          </View>
        )}
        {joinError && (
          <View className="items-center py-1.5" style={{ backgroundColor: 'rgba(239,68,68,0.15)' }}>
            <Text className="text-xs" style={{ color: '#FCA5A5' }}>{joinError}</Text>
          </View>
        )}

        {/* Video note (native video needs the installable app / meeting link) */}
        {cls?.meetingUrl ? (
          <TouchableOpacity
            onPress={() => Linking.openURL(cls.meetingUrl!)}
            className="mx-3 mt-2 flex-row items-center justify-center gap-2 rounded-xl py-2.5"
            style={{ backgroundColor: '#6366F1' }}
          >
            <Ionicons name="videocam" size={16} color="#fff" />
            <Text className="text-sm font-bold text-white">Open video call</Text>
          </TouchableOpacity>
        ) : null}

        {/* Stage */}
        {chatOpen ? (
          <KeyboardAvoidingView
            className="flex-1"
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={90}
          >
            <View className="px-4 pt-3 pb-1 flex-row items-center justify-between">
              <Text className="text-sm font-bold text-white">Class chat</Text>
              <TouchableOpacity onPress={() => setChatOpen(false)}>
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(_, i) => String(i)}
              contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              ListEmptyComponent={<Text className="text-center text-xs text-slate-600 mt-8">No messages yet. Say hi 👋</Text>}
              renderItem={({ item }) => {
                const mine = item.from === myId;
                return (
                  <View className={mine ? 'items-end' : 'items-start'}>
                    {!mine && <Text className="text-[10px] text-slate-500 mb-0.5 ml-1">{item.name || roleLabel(item.role)}</Text>}
                    <View
                      className="rounded-2xl px-3 py-2 max-w-[80%]"
                      style={{ backgroundColor: mine ? '#6366F1' : '#1E293B' }}
                    >
                      <Text className="text-sm text-white leading-5">{item.message}</Text>
                    </View>
                  </View>
                );
              }}
            />
            <View className="flex-row items-center gap-2 px-3 pb-2 pt-1">
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Type a message…"
                placeholderTextColor="#64748B"
                className="flex-1 rounded-2xl px-4 py-2.5 text-sm text-white"
                style={{ backgroundColor: '#1E293B' }}
                onSubmitEditing={send}
                returnKeyType="send"
              />
              <TouchableOpacity onPress={send} className="h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: '#6366F1' }}>
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        ) : (
          <FlatList
            data={tiles}
            key="grid"
            numColumns={2}
            keyExtractor={(t) => t.key}
            contentContainerStyle={{ padding: 8, paddingBottom: 16 }}
            className="flex-1"
            renderItem={({ item }) => (
              <Tile name={item.name} role={item.role} isYou={item.isYou} muted={item.muted} cameraOff={item.cameraOff} />
            )}
          />
        )}

        {/* Control bar */}
        <View className="flex-row items-center justify-around px-4 py-3" style={{ backgroundColor: '#0F172A' }}>
          <Ctrl icon={muted ? 'mic-off' : 'mic'} active={!muted} danger={muted} label="Mic" onPress={() => setMuted((v) => !v)} />
          <Ctrl icon={cameraOff ? 'videocam-off' : 'videocam'} active={!cameraOff} danger={cameraOff} label="Camera" onPress={() => setCameraOff((v) => !v)} />
          <Ctrl icon="hand-left" active={handRaised} label="Hand" onPress={toggleHand} />
          <Ctrl icon="chatbubble-ellipses" active={chatOpen} label="Chat" onPress={() => setChatOpen((v) => !v)} badge={messages.length} />
          <Ctrl icon="exit" danger label="Leave" onPress={leave} />
        </View>
      </SafeAreaView>
    </View>
  );
}

function Ctrl({ icon, label, onPress, active, danger, badge }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void;
  active?: boolean; danger?: boolean; badge?: number;
}) {
  const bg = danger ? '#EF4444' : active ? '#6366F1' : '#1E293B';
  return (
    <TouchableOpacity onPress={onPress} className="items-center gap-1">
      <View className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: bg }}>
        <Ionicons name={icon} size={20} color={danger || active ? '#fff' : '#CBD5E1'} />
        {!!badge && badge > 0 && (
          <View className="absolute -right-0.5 -top-0.5 h-4 min-w-[16px] items-center justify-center rounded-full px-1" style={{ backgroundColor: '#10B981' }}>
            <Text className="text-[9px] font-bold text-white">{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </View>
      <Text className="text-[10px] text-slate-400">{label}</Text>
    </TouchableOpacity>
  );
}
