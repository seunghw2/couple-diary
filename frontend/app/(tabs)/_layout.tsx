import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuestionStore } from '../../store/useQuestionStore';
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
  const hasTodo = useQuestionStore((s) => s.hasTodo);
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
        name="question"
        options={{
          title: '질문',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'mail' : 'mail-outline'} color={color} />
          ),
          // 할 일(봉투 선택/답장)이 있으면 작은 코럴 점. 빈 라벨 + 원형 스타일로 점처럼.
          tabBarBadge: hasTodo ? '' : undefined,
          tabBarBadgeStyle: {
            backgroundColor: c.primary,
            minWidth: 10,
            maxWidth: 10,
            height: 10,
            borderRadius: 5,
            marginLeft: 2,
          },
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '전체',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'menu' : 'menu-outline'} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
