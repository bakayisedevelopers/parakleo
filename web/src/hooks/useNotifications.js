import { useEffect, useState } from 'react';
import { subscribeToNotifications } from '../services/notificationService';

export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsub = subscribeToNotifications(userId, (items) => {
      setNotifications(items);
      setIsLoading(false);
    });

    return () => unsub?.();
  }, [userId]);

  return { notifications, isLoading };
}
