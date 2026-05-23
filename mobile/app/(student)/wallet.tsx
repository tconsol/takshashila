import React from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { Card } from '../../components/ui/Card';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { EmptyState } from '../../components/ui/EmptyState';
import { walletService } from '../../services/wallet.service';
import type { LedgerEntry, TransactionType } from '../../types/api.types';

const TX_STYLE: Record<TransactionType, { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  CREDIT: { bg: '#D1FAE5', fg: '#059669', icon: 'arrow-down' },
  DEBIT:  { bg: '#FFE4E6', fg: '#E11D48', icon: 'arrow-up' },
  REFUND: { bg: '#E0F2FE', fg: '#0284C7', icon: 'refresh' },
};

function rs(cents: number) {
  return `₹${(cents / 100).toFixed(0)}`;
}

function TransactionItem({ item }: { item: LedgerEntry }) {
  const style = TX_STYLE[item.type] ?? TX_STYLE.DEBIT;
  const prefix = item.type === 'DEBIT' ? '-' : '+';
  return (
    <View className="flex-row items-center py-3 border-b border-gray-50">
      <View
        className="w-10 h-10 rounded-2xl items-center justify-center"
        style={{ backgroundColor: style.bg }}
      >
        <Ionicons name={style.icon} size={18} color={style.fg} />
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
          {item.description}
        </Text>
        <Text className="text-[11px] text-gray-500 mt-0.5">
          {format(parseISO(item.createdAt), 'MMM d, yyyy · h:mm a')}
        </Text>
      </View>
      <View className="items-end">
        <Text className="text-sm font-bold" style={{ color: style.fg }}>
          {prefix}{rs(item.amountCents)}
        </Text>
        {item.balanceAfterCents != null && (
          <Text className="text-[10px] text-gray-400 mt-0.5">
            bal {rs(item.balanceAfterCents)}
          </Text>
        )}
      </View>
    </View>
  );
}

function CreditBox({ icon, label, value, tint }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tint: { bg: string; fg: string };
}) {
  return (
    <View
      className="flex-1 rounded-2xl p-3"
      style={{ backgroundColor: tint.bg }}
    >
      <Ionicons name={icon} size={18} color={tint.fg} />
      <Text className="text-lg font-bold mt-2" style={{ color: tint.fg }}>{value}</Text>
      <Text className="text-[10px] text-gray-600 mt-0.5">{label}</Text>
    </View>
  );
}

export default function WalletScreen() {
  const { data: wallet, isLoading: wLoading } = useQuery({
    queryKey: ['wallet'],
    queryFn: walletService.getMyWallet,
  });

  const { data: transactions, isLoading: tLoading, refetch, isRefetching } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => walletService.getTransactions({ limit: '50', page: '1' }),
  });

  if (wLoading || tLoading) return <LoadingScreen />;

  const txList = transactions?.items ?? [];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <FlatList
        data={txList}
        keyExtractor={(item) => item.publicId}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366F1" />}
        ListHeaderComponent={
          <View>
            <View className="py-4">
              <Text className="text-2xl font-bold text-gray-900">Wallet</Text>
              <Text className="text-sm text-gray-500 mt-0.5">
                Manage your balance and transactions
              </Text>
            </View>

            {/* Balance hero */}
            <View
              className="rounded-3xl p-6 mb-4 overflow-hidden"
              style={{
                backgroundColor: '#6366F1',
                shadowColor: '#6366F1',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 16,
                elevation: 8,
              }}
            >
              <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                Available balance
              </Text>
              <Text className="text-white text-4xl font-bold mt-2">
                {rs(wallet?.balanceCents ?? 0)}
              </Text>
              <Text className="text-white/60 text-xs mt-1">
                {wallet?.currency ?? 'INR'}
              </Text>

              {/* Credit breakdown */}
              <View
                className="mt-5 pt-4 flex-row gap-3"
                style={{ borderTopColor: 'rgba(255,255,255,0.15)', borderTopWidth: 1 }}
              >
                <View className="flex-1">
                  <Text className="text-white/60 text-[10px] uppercase font-semibold">Demo</Text>
                  <Text className="text-white text-base font-bold mt-1">
                    {rs(wallet?.demoCreditsCents ?? 0)}
                  </Text>
                </View>
                <View className="flex-1" style={{ borderLeftColor: 'rgba(255,255,255,0.15)', borderLeftWidth: 1, paddingLeft: 12 }}>
                  <Text className="text-white/60 text-[10px] uppercase font-semibold">Regular</Text>
                  <Text className="text-white text-base font-bold mt-1">
                    {rs(wallet?.regularCreditsCents ?? 0)}
                  </Text>
                </View>
                <View className="flex-1" style={{ borderLeftColor: 'rgba(255,255,255,0.15)', borderLeftWidth: 1, paddingLeft: 12 }}>
                  <Text className="text-white/60 text-[10px] uppercase font-semibold">Bonus</Text>
                  <Text className="text-white text-base font-bold mt-1">
                    {rs(wallet?.bonusCreditsCents ?? 0)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Quick stats */}
            <View className="flex-row gap-3 mb-5">
              <CreditBox
                icon="arrow-down"
                label="Total Credits"
                value={rs(txList.filter((t) => t.type === 'CREDIT' || t.type === 'REFUND').reduce((s, t) => s + t.amountCents, 0))}
                tint={{ bg: '#D1FAE5', fg: '#059669' }}
              />
              <CreditBox
                icon="arrow-up"
                label="Total Spent"
                value={rs(txList.filter((t) => t.type === 'DEBIT').reduce((s, t) => s + t.amountCents, 0))}
                tint={{ bg: '#FFE4E6', fg: '#E11D48' }}
              />
            </View>

            <Card className="mb-1 px-0 py-2">
              <Text className="text-base font-bold text-gray-900 px-4 py-1">
                Recent Transactions
              </Text>
            </Card>
          </View>
        }
        renderItem={({ item }) => (
          <View className="bg-white px-4">
            <TransactionItem item={item} />
          </View>
        )}
        ItemSeparatorComponent={() => <View className="bg-white h-0" />}
        ListFooterComponent={
          txList.length > 0 ? (
            <View className="bg-white rounded-b-3xl h-4" />
          ) : null
        }
        ListEmptyComponent={
          <View className="bg-white rounded-3xl">
            <EmptyState
              icon="receipt-outline"
              title="No transactions yet"
              description="Your wallet activity will appear here."
            />
          </View>
        }
      />
    </SafeAreaView>
  );
}
