import { Request, Response, NextFunction } from 'express'; 
 
interface PerformanceMetrics { 
  endpoint: string; 
  method: string; 
  duration: number; 
  timestamp: Date; 
  statusCode: number; 
} 
 
const metrics: PerformanceMetrics[] = []; 
 
export const performanceMonitor = (req: Request, res: Response, next: NextFunction) => { 
  const startTime = Date.now(); 
 
  res.on('finish', () => { 
    const duration = Date.now() - startTime; 
ECHO 处于关闭状态。
    const metric: PerformanceMetrics = { 
      endpoint: req.path, 
      method: req.method, 
      duration, 
      timestamp: new Date(), 
      statusCode: res.statusCode 
    }; 
 
    metrics.push(metric); 
ECHO 处于关闭状态。
    // Keep only last 1000 metrics 
    if (metrics.length > 1000) { 
      metrics.shift(); 
    } 
 
    // Log slow requests 
    if (duration > 1000) { 
      console.warn(`Slow request: ${req.method} ${req.path} took ${duration}ms`); 
    } 
  }); 
 
  next(); 
}; 
 
export const getMetrics = () => metrics; 
