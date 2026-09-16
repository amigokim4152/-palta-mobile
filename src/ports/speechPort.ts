export type SpeechStatus =
  | 'idle'
  | 'speaking'
  | 'paused'
  | 'stopped'
  | 'unavailable';

export type SpeechRequest = {
  text: string;
  locale?: string;
  rate?: number;
  pitch?: number;
};

export interface SpeechPort {
  isAvailable(): Promise<boolean>;
  speak(request: SpeechRequest): Promise<void>;
  stop(): Promise<void>;
  pause?(): Promise<void>;
  resume?(): Promise<void>;
}
