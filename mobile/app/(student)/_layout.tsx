import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IoniconsName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; title: string; icon: IoniconsName; activeIcon: IoniconsName }[] = [
  { name: 'index',    title: 'Home',     icon: 'home-outline',          activeIcon: 'home' },
  { name: 'classes',  title: 'Classes',  icon: 'calendar-outline',      activeIcon: 'calendar' },
  { name: 'messages', title: 'Messages', icon: 'chatbubbles-outline',   activeIcon: 'chatbubbles' },
  { name: 'homework', title: 'Homework', icon: 'document-text-outline', activeIcon: 'document-text' },
  { name: 'wallet',   title: 'Wallet',   icon: 'wallet-outline',        activeIcon: 'wallet' },
  { name: 'profile',  title: 'More',     icon: 'menu-outline',          activeIcon: 'menu' },
];

export default function StudentLayout() {
  const insets = useSafeAreaInsets();
  // Respect the real device inset (home indicator / gesture-nav bar) instead of
  // hardcoded per-OS padding, so the tab bar never sits under the system nav.
  const bottomInset = insets.bottom > 0 ? insets.bottom : 8;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#F1F5F9',
          borderTopWidth: 1,
          paddingTop: 6,
          paddingBottom: bottomInset,
          height: 60 + bottomInset,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? tab.activeIcon : tab.icon}
                size={22}
                color={color}
              />
            ),
          }}
        />
      ))}
      {/* Schedule still exists as a route but is not shown as a tab (reachable from More). */}
      <Tabs.Screen name="schedule" options={{ href: null }} />
    </Tabs>
  );
}
