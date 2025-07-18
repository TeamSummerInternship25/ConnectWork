import { useState } from 'react'; 
import { authAPI, LoginRequest, RegisterRequest } from '@/services/api/auth'; 
 
export function useAuth() { 
  const [isLoading, setIsLoading] = useState(false); 
  const [error, setError] = useState<string | null>(null); 
 
  const login = async (data: LoginRequest) => { 
    setIsLoading(true); 
    setError(null); 
    try { 
      const result = await authAPI.login(data); 
      if (result.success) { 
        localStorage.setItem('token', result.token); 
        return { success: true }; 
      } else { 
        setError(result.message); 
        return { success: false, error: result.message }; 
      } 
    } catch (err) { 
      setError('Login failed'); 
      return { success: false, error: 'Login failed' }; 
    } finally { 
      setIsLoading(false); 
    } 
  }; 
 
  const register = async (data: RegisterRequest) => { 
    setIsLoading(true); 
    setError(null); 
    try { 
      const result = await authAPI.register(data); 
      return { success: result.success, message: result.message }; 
    } catch (err) { 
      setError('Registration failed'); 
      return { success: false, error: 'Registration failed' }; 
    } finally { 
      setIsLoading(false); 
    } 
  }; 
 
  return { login, register, isLoading, error }; 
} 
