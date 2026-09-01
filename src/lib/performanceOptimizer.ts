// Performance monitoring and optimization utilities

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
}

const metrics: PerformanceMetric[] = [];
const maxMetrics = 100;

export function recordMetric(name: string, duration: number) {
  metrics.push({
    name,
    duration,
    timestamp: Date.now(),
  });
  
  if (metrics.length > maxMetrics) {
    metrics.shift();
  }
}

export function measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  return fn()
    .then(result => {
      recordMetric(name, performance.now() - start);
      return result;
    })
    .catch(error => {
      recordMetric(`${name} (error)`, performance.now() - start);
      throw error;
    });
}

export function measure<T>(name: string, fn: () => T): T {
  const start = performance.now();
  try {
    const result = fn();
    recordMetric(name, performance.now() - start);
    return result;
  } catch (error) {
    recordMetric(`${name} (error)`, performance.now() - start);
    throw error;
  }
}

export function getAverageMetric(name: string): number {
  const relevant = metrics.filter(m => m.name === name);
  if (relevant.length === 0) return 0;
  return relevant.reduce((sum, m) => sum + m.duration, 0) / relevant.length;
}

export function getAllMetrics(): PerformanceMetric[] {
  return [...metrics];
}

export function clearMetrics() {
  metrics.length = 0;
}
