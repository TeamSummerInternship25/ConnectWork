interface AudioMetadata {
    duration: number;
    format: string;
    bitrate?: number;
    sampleRate?: number;
    channels?: number;
    fileSize: number;
}
interface AudioProcessingResult {
    success: boolean;
    transcription?: string;
    metadata: AudioMetadata;
    processingMethod: string;
    error?: string;
}
interface AudioProcessingOptions {
    method?: 'auto' | 'free-api' | 'whisper-api' | 'offline' | 'fallback';
    language?: string;
    maxDuration?: number;
}
export declare class EnhancedAudioService {
    private readonly maxFileSize;
    private readonly supportedFormats;
    processAudio(filePath: string, options?: AudioProcessingOptions): Promise<AudioProcessingResult>;
    private processWithAutoSelection;
    private processWithFreeAPI;
    private processWithWhisperAPI;
    private processOffline;
    private getAudioMetadata;
    private callFreeSTTAPI;
    private tryAssemblyAI;
    private tryDeepgram;
    private tryLocalSTT;
    private getEnhancedAudioAnalysis;
    private getFallbackTranscription;
    isFormatSupported(filePath: string): boolean;
    getSupportedFormats(): string[];
}
export declare const enhancedAudioService: EnhancedAudioService;
export {};
//# sourceMappingURL=enhancedAudioService.d.ts.map