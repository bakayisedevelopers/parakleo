import { createContext, useEffect, useMemo, useState } from 'react';
import {
  deleteAccount,
  loginWithEmail,
  logoutUser,
  signupWithEmail,
  subscribeToAuthChanges,
} from '../services/authService';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((nextUser) => {
      setUser(nextUser);
      setIsInitializing(false);
    });

    return () => unsubscribe?.();
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isInitializing,
      login: loginWithEmail,
      signup: signupWithEmail,
      logout: logoutUser,
      deleteAccount,
      setUser,
    }),
    [user, isInitializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
