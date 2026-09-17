import { useEffect, useState } from 'react';
import { subscribeToTutorSessions } from '../services/sessionService';

export function useTutorSessions(tutorId) {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tutorId) {
      setSessions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsub = subscribeToTutorSessions(
      tutorId,
      (items) => {
        setSessions(items);
        setIsLoading(false);
      },
      () => setIsLoading(false)
    );

    return () => unsub?.();
  }, [tutorId]);

  return { sessions, isLoading };
}
