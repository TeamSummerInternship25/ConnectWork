import { z } from 'zod'; 
 
export const loginSchema = z.object({ 
  email: z.string().email('Invalid email address'), 
  password: z.string().min(6, 'Password must be at least 6 characters') 
}); 
 
export const registerSchema = z.object({ 
  email: z.string().email('Invalid email address'), 
  password: z.string().min(6, 'Password must be at least 6 characters'), 
  confirmPassword: z.string() 
}).refine((data) => data.password === data.confirmPassword, { 
  message: "Passwords don't match", 
  path: ["confirmPassword"] 
}); 
