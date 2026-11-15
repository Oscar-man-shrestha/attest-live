"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { UserResponse, LoginInput, SignupInput } from "@embedra/types";
import { loginUser, signupUser, getMe, ApiError } from "./api";
import { completeMicrosoftSignIn,
  completeGoogleSignIn, verifyCampusCode } from "./campus-api";

interface AuthContextType {
  user: UserResponse | null;
  token: string | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  verifyCampus: (email: string, code: string) => Promise<{ profileComplete?: boolean }>;
  finishMicrosoft: (code: string, state: string) => Promise<{ profileComplete?: boolean; next: string | null }>;
  finishGoogle: (code: string, state: string) => Promise<{ profileComplete?: boolean; next: string | null }>;
  setCurrentUser: (user: UserResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "embedra_auth_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = localStorage.getItem(TOKEN_KEY);
        if (storedToken) {
          setToken(storedToken);
          const res = await getMe(storedToken);
          setUser(res.user);
        }
      } catch (err) {
        console.warn("Failed to restore auth session:", err);
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (input: LoginInput) => {
    const res = await loginUser(input);
    localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const signup = async (input: SignupInput) => {
    const res = await signupUser(input);
    localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const verifyCampus = async (email: string, code: string) => {
    const res = await verifyCampusCode(email, code);
    localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
    setUser(res.user);
    return { profileComplete: res.user.profileComplete };
  };

  const finishMicrosoft = async (code: string, state: string) => {
    const res = await completeMicrosoftSignIn(code, state);
    localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
    setUser(res.user);
    return { profileComplete: res.user.profileComplete, next: res.next };
  };

  const finishGoogle = async (code: string, state: string) => {
    const res = await completeGoogleSignIn(code, state);
    localStorage.setItem(TOKEN_KEY, res.token);
    setToken(res.token);
    setUser(res.user);
    return { profileComplete: res.user.profileComplete, next: res.next };
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, signup, verifyCampus, finishMicrosoft, finishGoogle, setCurrentUser: setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
