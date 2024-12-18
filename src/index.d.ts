export interface AlertThresholds {
  lag?: number;
  memory?: number;
  latency?: number;
}

export interface LoggerLike {
  log?(...args: unknown[]): void;
  warn?(...args: unknown[]): void;
  info?(...args: unknown[]): void;
  error?(...args: unknown[]): void;
}

export interface PerfMonOptions {
  enableLag?: boolean;
  enableMemory?: boolean;
  enableLatency?: boolean;
  metricsRoute?: string | null;
  standalone?: boolean;
  sampleInterval?: number;
  alertThresholds?: AlertThresholds;
  logger?: LoggerLike;
}

export interface MemoryMetrics {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers?: number;
}

export interface RouteLatencyMetrics {
  count: number;
  average: number;
}

export interface LatencyMetrics {
  lastRequest: {
    route: string;
    duration: number;
  } | null;
  average: number;
  totalRequests: number;
  perRoute: Record<string, RouteLatencyMetrics>;
}

export interface PerfMetrics {
  uptime: number;
  eventLoopLag: number;
  memory: MemoryMetrics;
  latency: LatencyMetrics;
}

export declare class PerfMon {
  constructor(options?: PerfMonOptions);
  start(): void;
  stop(): void;
  getMetrics(): PerfMetrics;
  createMiddleware(): PerfMonMiddleware;
}

export interface PerfMonMiddleware {
  (req: any, res: any, next?: (err?: unknown) => void): void;
  start: () => void;
  stop: () => void;
  metrics: () => PerfMetrics;
  monitor: PerfMon;
}

export declare function perfMon(options?: PerfMonOptions): PerfMon | PerfMonMiddleware;

export default perfMon;
