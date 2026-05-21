import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

type IoniconsName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; title: string; icon: IoniconsName; activeIcon: IoniconsName }[] = [
  { name: 'index',    title: 'Home',    icon: 'home-outline',         activeIcon: 'home' },
  { name: 'classes',  title: 'Classes', icon: 'calendar-outline',     activeIcon: 'calendar' },
  { name: 'schedule', title: 'Study',   icon: 'library-outline',      activeIcon: 'library' },
  { name: 'wallet',   title: 'Wallet',  icon: 'wallet-outline',       activeIcon: 'wallet' },
  { name: 'profile',  title: 'More',    icon: 'menu-outline',         activeIcon: 'menu' },
];

export default function StudentLayout() {
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
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          height: Platform.OS === 'ios' ? 86 : 64,
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
    </Tabs>
  );
}
