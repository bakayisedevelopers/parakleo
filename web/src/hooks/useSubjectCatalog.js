import { useEffect, useState } from 'react';
import { getFirebaseClients } from '../firebase/config';
import { FALLBACK_SUBJECTS, normalizeSubjectList, toSubjectOptions } from '../constants/subjects';

export function useSubjectCatalog() {
  const [subjectNames, setSubjectNames] = useState(FALLBACK_SUBJECTS);

  useEffect(() => {
    let unsubscribe = null;
    let isMounted = true;

    getFirebaseClients().then((clients) => {
      if (!isMounted || !clients) return;

      const { db, firestoreModule } = clients;
      const { doc, onSnapshot } = firestoreModule;

      unsubscribe = onSnapshot(
        doc(db, 'system', 'subjects'),
        (snapshot) => {
          if (!snapshot.exists()) {
            setSubjectNames(FALLBACK_SUBJECTS);
            return;
          }

          const names = normalizeSubjectList(snapshot.data()?.subjectNames || []);
          setSubjectNames(names.length ? names : FALLBACK_SUBJECTS);
        },
        () => setSubjectNames(FALLBACK_SUBJECTS),
      );
    }).catch(() => setSubjectNames(FALLBACK_SUBJECTS));

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  return {
    subjectNames,
    subjectOptions: toSubjectOptions(subjectNames),
  };
}
