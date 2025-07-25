"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAudioConfig = exports.defaultAudioConfig = void 0;
exports.defaultAudioConfig = {
    defaultMethod: 'auto',
    maxFileSize: 25 * 1024 * 1024,
    maxDuration: 600,
    defaultLanguage: 'en',
    supportedLanguages: ['en', 'zh', 'es', 'fr', 'de', 'ja', 'ko'],
    enableFallback: true,
    retryAttempts: 2,
    timeoutMs: 60000
};
const getAudioConfig = () => {
    return {
        ...exports.defaultAudioConfig,
        openaiApiKey: process.env.OPENAI_API_KEY,
        googleCloudProjectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        azureSpeechKey: process.env.AZURE_SPEECH_KEY,
        azureSpeechRegion: process.env.AZURE_SPEECH_REGION,
        defaultMethod: process.env.AUDIO_PROCESSING_METHOD || 'auto',
        maxFileSize: parseInt(process.env.AUDIO_MAX_FILE_SIZE || '26214400'),
        maxDuration: parseInt(process.env.AUDIO_MAX_DURATION || '600'),
        defaultLanguage: process.env.AUDIO_DEFAULT_LANGUAGE || 'en'
    };
};
exports.getAudioConfig = getAudioConfig;
//# sourceMappingURL=audioConfig.js.map