export interface AudioConfig {
    defaultMethod: 'auto' | 'free-api' | 'whisper-api' | 'offline' | 'fallback';
    openaiApiKey?: string;
    googleCloudProjectId?: string;
    azureSpeechKey?: string;
    azureSpeechRegion?: string;
    maxFileSize: number;
    maxDuration: number;
    defaultLanguage: string;
    supportedLanguages: string[];
    enableFallback: boolean;
    retryAttempts: number;
    timeoutMs: number;
}
export declare const defaultAudioConfig: AudioConfig;
export declare const getAudioConfig: () => AudioConfig;
//# sourceMappingURL=audioConfig.d.ts.map