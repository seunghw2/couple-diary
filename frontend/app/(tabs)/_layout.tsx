import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, useColors } from '../../theme/theme';

function TabIcon({
  name,
  color,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
}) {
  return <Ionicons name={name} size={24} color={color} />;
}

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: colors.subText,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 88,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '달력',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'calendar' : 'calendar-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: '지도',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'map' : 'map-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '설정',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'settings' : 'settings-outline'} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
