import { useState } from 'react'; 
 
export function useAuth() { 
  const [isLoading, setIsLoading] = useState(false); 
 
  const login = async (email: string, password: string) => { 
    setIsLoading(true); 
    // TODO: Implement actual login logic 
    setTimeout(() => setIsLoading(false), 1000); 
  }; 
 
  return { login, isLoading }; 
} 
