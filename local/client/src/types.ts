/**
 * RouteForge - TypeScript Definitions
 */

export type TransportMode = 'driving' | 'cycling' | 'walking';

export interface StopMetadata {
  locked?: boolean;
  geocodeStatus?: 'ok' | 'ambiguous' | 'not_found' | 'error';
  displayName?: string;
  source?: string;
  [key: string]: any;
}

export interface Stop {
  stopId: string;
  routeId: string;
  sequence: number;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  lat?: number | null;
  lng?: number | null;
  metadata?: StopMetadata;
}

export interface RouteSummary {
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  provider: string | null;
  isFallback: boolean;
  mode: TransportMode;
  liveTraffic: boolean;
  trafficStatus: string;
}

export interface RouteSettings {
  fixedStart: boolean;
  fixedEnd: boolean;
  returnToStart: boolean;
  provider: string;
  mode: TransportMode;
}

export interface RouteData {
  routeId: string;
  title: string;
  revision: number;
  status: string;
  settings?: RouteSettings;
  createdAt?: string;
  updatedAt?: string;
}

export interface OptimizationOptions {
  objective: 'distance' | 'duration';
  fixedStart: boolean;
  fixedEnd: boolean;
  returnToStart: boolean;
  lockedStops: boolean;
}

export interface OptimizationResult {
  originalDistanceMeters: number;
  optimizedDistanceMeters: number;
  savingsMeters: number;
  savingsPercent: number;
  method: string;
  isGloballyOptimal: boolean;
  targetStops: number;
  stops: Stop[];
}
