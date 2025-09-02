export enum AspectRatio {
  SQUARE = '1:1',
  PORTRAIT = '9:16',
  LANDSCAPE = '16:9',
}

export interface CsvRow {
  id: string;
  prompt: string;
}

export type GenerationStatus = 'pending' | 'generating' | 'success' | 'error';

export interface ImageResult {
  id: string;
  prompt: string;
  imageUrl: string | null;
  status: GenerationStatus;
  error?: string;
}

export type Provider = 'google' | 'openai';

export interface ApiKeys {
  google: string[];
  openai: string[];
}
