import { useEffect, useState } from 'react';
import { subscribeToTutorAcceptedRequests, subscribeToTutorAvailableRequests } from '../services/classRequestService';

export function useTutorAvailableRequests(tutorId) {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tutorId) {
      setRequests([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsub = subscribeToTutorAvailableRequests(
      tutorId,
      (items) => {
        setRequests(items);
        setIsLoading(false);
      },
      () => setIsLoading(false)
    );

    return () => unsub?.();
  }, [tutorId]);

  return { requests, isLoading };
}

export function useTutorAcceptedRequests(tutorId) {
  const [classes, setClasses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tutorId) {
      setClasses([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsub = subscribeToTutorAcceptedRequests(
      tutorId,
      (items) => {
        setClasses(items);
        setIsLoading(false);
      },
      () => setIsLoading(false)
    );

    return () => unsub?.();
  }, [tutorId]);

  return { classes, isLoading };
}
