export const JOURNEY_PUBLIC_MODES = [
  'auto',
  'transit',
  'bicycle',
  'pedestrian',
] as const;

export type JourneyPublicMode = (typeof JOURNEY_PUBLIC_MODES)[number];

export const JOURNEY_LEG_MODES = [
  'auto',
  'walk',
  'bicycle',
  'bus',
  'metro',
  'rail',
  'other',
] as const;

export type JourneyLegMode = (typeof JOURNEY_LEG_MODES)[number];

export type JourneyCoordinate = {
  lat: number;
  lon: number;
};

export type JourneyRequest = {
  origin: JourneyCoordinate;
  destination: JourneyCoordinate;
  departure_time?: string;
};

export type JourneyLeg = {
  mode: JourneyLegMode;
  duration_seconds: number;
  distance_meters: number;
  from_name?: string | null;
  to_name?: string | null;
  route_id?: string | null;
  route_name?: string | null;
  provider?: string | null;
  realtime: boolean;
};

export type JourneyOption = {
  mode: JourneyPublicMode;
  duration_seconds: number;
  distance_meters: number;
  legs: JourneyLeg[];
  transfers: number;
  realtime: boolean;
  source: string | null;
};

export type JourneyModeResult = {
  status: 'OK' | 'NO_ROUTE' | 'ERROR';
  options: JourneyOption[];
  error?: string | null;
};

export type JourneyResults = Record<JourneyPublicMode, JourneyModeResult>;

export type JourneyResponse = {
  status: 'GREEN' | 'YELLOW' | 'RED';
  departure_time: string;
  origin: JourneyCoordinate;
  destination: JourneyCoordinate;
  public_modes: JourneyPublicMode[];
  results: JourneyResults;
};
