'use client'; 
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'; 
 
interface User { 
  id: string; 
  email: string; 
  name?: string; 
} 
 
interface AuthContextType { 
  user: User | null; 
  isLoading: boolean; 
  login: (email: string, password: string) => Promise<boolean>; 
  logout: () => void; 
  isAuthenticated: boolean; 
} 
 
const AuthContext = createContext<AuthContextType | undefined>(undefined); 
 
export function AuthProvider({ children }: { children: ReactNode }) { 
  const [user, setUser] = useState<User | null>(null); 
  const [isLoading, setIsLoading] = useState(true); 
 
  useEffect(() => { 
    // Check for existing token on mount 
    const token = localStorage.getItem('token'); 
    if (token) { 
      // TODO: Validate token with API 
      setUser({ id: '1', email: 'user@example.com' }); 
    } 
    setIsLoading(false); 
  }, []); 
 
  const login = async (email: string, password: string): Promise<boolean> => { 
    setIsLoading(true); 
    try { 
      // TODO: Implement actual login API call 
      localStorage.setItem('token', 'mock-token'); 
      setUser({ id: '1', email }); 
      return true; 
    } catch (error) { 
      return false; 
    } finally { 
      setIsLoading(false); 
    } 
  }; 
 
  const logout = () => { 
    localStorage.removeItem('token'); 
    setUser(null); 
  }; 
 
  return ( 
    <AuthContext.Provider value={{ 
      user, 
      isLoading, 
      login, 
      logout, 
      isAuthenticated: !!user 
    }}> 
      {children} 
    </AuthContext.Provider> 
  ); 
} 
 
export function useAuthContext() { 
  const context = useContext(AuthContext); 
  if (context === undefined) { 
    throw new Error('useAuthContext must be used within an AuthProvider'); 
  } 
  return context; 
} 
