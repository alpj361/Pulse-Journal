import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { usePulseConnectionStore } from '../state/pulseConnectionStore';

const PROJECT_ID = 'e055c204-0d79-46a3-bbf5-b35d45e0bb17';

// How notifications appear when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function useNotifications() {
  const notificationListener = useRef(null);
  const responseListener = useRef(null);
  const connectedUser = usePulseConnectionStore((s) => s.connectedUser);

  useEffect(() => {
    _registerForPush(connectedUser?.id);

    // Notification arrives while app is open
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('[notifications] received:', notification.request.content.title);
      }
    );

    // User taps a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        console.log('[notifications] tapped:', data?.type);
        // Future: navigate to Feed tab using expo-router
      }
    );

    return () => {
      if (typeof Notifications.removeNotificationSubscription === 'function') {
        if (notificationListener.current) {
          Notifications.removeNotificationSubscription(notificationListener.current);
        }
        if (responseListener.current) {
          Notifications.removeNotificationSubscription(responseListener.current);
        }
      }
    };
  }, [connectedUser?.id]);
}

async function _registerForPush(userId) {
  // Android requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('news', {
      name: 'Noticias',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366f1',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[notifications] permission not granted');
    return;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: PROJECT_ID,
    });

    if (userId && token) {
      const { error } = await supabase
        .from('profiles')
        .update({ push_token: token })
        .eq('id', userId);

      if (error) {
        console.warn('[notifications] token save error:', error.message);
      } else {
        console.log('[notifications] token registered for user', userId);
      }
    }
  } catch (err) {
    // Physical device required for push tokens — simulators will throw
    console.warn('[notifications] getExpoPushTokenAsync:', err.message);
  }
}
