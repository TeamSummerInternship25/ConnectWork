/**
 * Audio Processing Configuration
 */

export interface AudioConfig {
  // Processing method preference
  defaultMethod: 'auto' | 'free-api' | 'whisper-api' | 'offline' | 'fallback';
  
  // API configurations
  openaiApiKey?: string;
  googleCloudProjectId?: string;
  azureSpeechKey?: string;
  azureSpeechRegion?: string;
  
  // Processing limits
  maxFileSize: number; // bytes
  maxDuration: number; // seconds
  
  // Language settings
  defaultLanguage: string;
  supportedLanguages: string[];
  
  // Quality settings
  enableFallback: boolean;
  retryAttempts: number;
  timeoutMs: number;
}

export const defaultAudioConfig: AudioConfig = {
  defaultMethod: 'auto',
  maxFileSize: 25 * 1024 * 1024, // 25MB
  maxDuration: 600, // 10 minutes
  defaultLanguage: 'en',
  supportedLanguages: ['en', 'zh', 'es', 'fr', 'de', 'ja', 'ko'],
  enableFallback: true,
  retryAttempts: 2,
  timeoutMs: 60000 // 60 seconds
};

export const getAudioConfig = (): AudioConfig => {
  return {
    ...defaultAudioConfig,
    openaiApiKey: process.env.OPENAI_API_KEY,
    googleCloudProjectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    azureSpeechKey: process.env.AZURE_SPEECH_KEY,
    azureSpeechRegion: process.env.AZURE_SPEECH_REGION,
    defaultMethod: (process.env.AUDIO_PROCESSING_METHOD as any) || 'auto',
    maxFileSize: parseInt(process.env.AUDIO_MAX_FILE_SIZE || '26214400'), // 25MB default
    maxDuration: parseInt(process.env.AUDIO_MAX_DURATION || '600'), // 10 minutes default
    defaultLanguage: process.env.AUDIO_DEFAULT_LANGUAGE || 'en'
  };
};
