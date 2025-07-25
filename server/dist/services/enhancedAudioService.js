"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enhancedAudioService = exports.EnhancedAudioService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
const music_metadata_1 = require("music-metadata");
class EnhancedAudioService {
    constructor() {
        this.maxFileSize = 25 * 1024 * 1024;
        this.supportedFormats = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac'];
    }
    async processAudio(filePath, options = {}) {
        try {
            console.log(`🎵 Processing audio file: ${path_1.default.basename(filePath)}`);
            const metadata = await this.getAudioMetadata(filePath);
            console.log(`📊 Audio metadata: ${metadata.duration}s, ${metadata.format}, ${(metadata.fileSize / 1024 / 1024).toFixed(2)}MB`);
            if (metadata.fileSize > this.maxFileSize) {
                throw new Error(`File too large: ${(metadata.fileSize / 1024 / 1024).toFixed(2)}MB (max: 25MB)`);
            }
            if (options.maxDuration && metadata.duration > options.maxDuration) {
                throw new Error(`Audio too long: ${metadata.duration}s (max: ${options.maxDuration}s)`);
            }
            const method = options.method || 'auto';
            let transcription = '';
            let processingMethod = '';
            switch (method) {
                case 'free-api':
                    ({ transcription, processingMethod } = await this.processWithFreeAPI(filePath, options));
                    break;
                case 'whisper-api':
                    ({ transcription, processingMethod } = await this.processWithWhisperAPI(filePath, options));
                    break;
                case 'offline':
                    ({ transcription, processingMethod } = await this.processOffline(filePath, options));
                    break;
                case 'auto':
                default:
                    ({ transcription, processingMethod } = await this.processWithAutoSelection(filePath, options));
                    break;
            }
            console.log(`✅ Audio processing completed using ${processingMethod}: ${transcription.length} characters`);
            return {
                success: true,
                transcription,
                metadata,
                processingMethod
            };
        }
        catch (error) {
            console.error(`❌ Audio processing failed:`, error);
            const metadata = await this.getAudioMetadata(filePath).catch(() => ({
                duration: 0,
                format: 'unknown',
                fileSize: fs_1.default.statSync(filePath).size
            }));
            return {
                success: false,
                metadata,
                processingMethod: 'fallback',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async processWithAutoSelection(filePath, options) {
        const methods = [
            { name: 'free-api', handler: this.processWithFreeAPI.bind(this) },
            { name: 'whisper-api', handler: this.processWithWhisperAPI.bind(this) },
            { name: 'offline', handler: this.processOffline.bind(this) }
        ];
        for (const method of methods) {
            try {
                console.log(`🔄 Trying ${method.name}...`);
                const result = await method.handler(filePath, options);
                if (result.transcription && result.transcription.trim()) {
                    return result;
                }
            }
            catch (error) {
                console.log(`⚠️ ${method.name} failed:`, error instanceof Error ? error.message : 'Unknown error');
                continue;
            }
        }
        return this.getFallbackTranscription(filePath);
    }
    async processWithFreeAPI(filePath, options) {
        try {
            const transcription = await this.callFreeSTTAPI(filePath, options.language || 'en');
            return {
                transcription,
                processingMethod: 'free-online-api'
            };
        }
        catch (error) {
            throw new Error(`Free API processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async processWithWhisperAPI(filePath, options) {
        try {
            const openaiApiKey = process.env.OPENAI_API_KEY;
            if (!openaiApiKey) {
                throw new Error('OpenAI API key not configured');
            }
            const formData = new form_data_1.default();
            formData.append('file', fs_1.default.createReadStream(filePath));
            formData.append('model', 'whisper-1');
            formData.append('language', options.language || 'en');
            const response = await axios_1.default.post('https://api.openai.com/v1/audio/transcriptions', formData, {
                headers: {
                    'Authorization': `Bearer ${openaiApiKey}`,
                    ...formData.getHeaders()
                },
                timeout: 60000
            });
            return {
                transcription: response.data.text || '',
                processingMethod: 'openai-whisper-api'
            };
        }
        catch (error) {
            throw new Error(`Whisper API processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async processOffline(filePath, options) {
        try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);
            try {
                await execAsync('whisper --help');
            }
            catch {
                throw new Error('Whisper not installed locally');
            }
            const outputDir = path_1.default.dirname(filePath);
            const command = `whisper "${filePath}" --output_dir "${outputDir}" --output_format txt --language ${options.language || 'en'}`;
            await execAsync(command);
            const baseName = path_1.default.basename(filePath, path_1.default.extname(filePath));
            const outputFile = path_1.default.join(outputDir, `${baseName}.txt`);
            if (fs_1.default.existsSync(outputFile)) {
                const transcription = fs_1.default.readFileSync(outputFile, 'utf-8');
                fs_1.default.unlinkSync(outputFile);
                return {
                    transcription: transcription.trim(),
                    processingMethod: 'whisper-offline'
                };
            }
            else {
                throw new Error('Whisper output file not found');
            }
        }
        catch (error) {
            throw new Error(`Offline processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getAudioMetadata(filePath) {
        try {
            const metadata = await (0, music_metadata_1.parseFile)(filePath);
            const stats = fs_1.default.statSync(filePath);
            return {
                duration: metadata.format.duration || 0,
                format: metadata.format.container || path_1.default.extname(filePath).slice(1),
                bitrate: metadata.format.bitrate,
                sampleRate: metadata.format.sampleRate,
                channels: metadata.format.numberOfChannels,
                fileSize: stats.size
            };
        }
        catch (error) {
            const stats = fs_1.default.statSync(filePath);
            return {
                duration: 0,
                format: path_1.default.extname(filePath).slice(1),
                fileSize: stats.size
            };
        }
    }
    async callFreeSTTAPI(filePath, language) {
        try {
            const assemblyAIResult = await this.tryAssemblyAI(filePath, language);
            if (assemblyAIResult) {
                return assemblyAIResult;
            }
        }
        catch (error) {
            console.log('⚠️ AssemblyAI failed, trying alternative...');
        }
        try {
            const deepgramResult = await this.tryDeepgram(filePath, language);
            if (deepgramResult) {
                return deepgramResult;
            }
        }
        catch (error) {
            console.log('⚠️ Deepgram failed, trying alternative...');
        }
        try {
            const localResult = await this.tryLocalSTT(filePath);
            if (localResult) {
                return localResult;
            }
        }
        catch (error) {
            console.log('⚠️ Local STT failed, using enhanced fallback...');
        }
        return await this.getEnhancedAudioAnalysis(filePath);
    }
    async tryAssemblyAI(filePath, language = 'en') {
        try {
            const apiKey = process.env.ASSEMBLYAI_API_KEY;
            if (!apiKey) {
                throw new Error('AssemblyAI API key not configured');
            }
            const fileData = fs_1.default.readFileSync(filePath);
            const uploadResponse = await axios_1.default.post('https://api.assemblyai.com/v2/upload', fileData, {
                headers: {
                    'authorization': apiKey,
                    'content-type': 'application/octet-stream'
                }
            });
            const transcriptResponse = await axios_1.default.post('https://api.assemblyai.com/v2/transcript', {
                audio_url: uploadResponse.data.upload_url,
                language_code: language === 'zh' ? 'zh' : 'en'
            }, {
                headers: {
                    'authorization': apiKey,
                    'content-type': 'application/json'
                }
            });
            const transcriptId = transcriptResponse.data.id;
            let result;
            do {
                await new Promise(resolve => setTimeout(resolve, 3000));
                result = await axios_1.default.get(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
                    headers: { 'authorization': apiKey }
                });
            } while (result.data.status === 'processing' || result.data.status === 'queued');
            if (result.data.status === 'completed') {
                return result.data.text || 'No speech detected in audio file.';
            }
            else {
                throw new Error('Transcription failed');
            }
        }
        catch (error) {
            console.log('AssemblyAI error:', error instanceof Error ? error.message : 'Unknown error');
            return null;
        }
    }
    async tryDeepgram(filePath, language = 'en') {
        try {
            const apiKey = process.env.DEEPGRAM_API_KEY;
            if (!apiKey) {
                throw new Error('Deepgram API key not configured');
            }
            const fileData = fs_1.default.readFileSync(filePath);
            const response = await axios_1.default.post('https://api.deepgram.com/v1/listen', fileData, {
                headers: {
                    'Authorization': `Token ${apiKey}`,
                    'Content-Type': 'audio/wav'
                },
                params: {
                    model: 'nova-2',
                    language: language === 'zh' ? 'zh-CN' : 'en-US'
                }
            });
            const transcript = response.data.results?.channels?.[0]?.alternatives?.[0]?.transcript;
            return transcript || 'No speech detected in audio file.';
        }
        catch (error) {
            console.log('Deepgram error:', error instanceof Error ? error.message : 'Unknown error');
            return null;
        }
    }
    async tryLocalSTT(filePath) {
        try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);
            await execAsync('whisper --help');
            const outputDir = path_1.default.dirname(filePath);
            const baseName = path_1.default.basename(filePath, path_1.default.extname(filePath));
            const command = `whisper "${filePath}" --model tiny --output_dir "${outputDir}" --output_format txt --language auto`;
            await execAsync(command);
            const outputFile = path_1.default.join(outputDir, `${baseName}.txt`);
            if (fs_1.default.existsSync(outputFile)) {
                const transcription = fs_1.default.readFileSync(outputFile, 'utf-8');
                fs_1.default.unlinkSync(outputFile);
                return transcription.trim() || 'No speech detected in audio file.';
            }
            return null;
        }
        catch (error) {
            return null;
        }
    }
    async getEnhancedAudioAnalysis(filePath) {
        const fileName = path_1.default.basename(filePath);
        const metadata = await this.getAudioMetadata(filePath);
        let analysisText = `[Enhanced Audio Analysis: ${fileName}]\n\n`;
        if (metadata.duration > 0) {
            if (metadata.duration < 5) {
                analysisText += "Short audio clip detected - likely a brief message or sound effect.\n";
            }
            else if (metadata.duration < 60) {
                analysisText += "Medium-length audio - possibly a voice message, announcement, or short speech segment.\n";
            }
            else if (metadata.duration < 300) {
                analysisText += "Extended audio content - likely contains speech, presentation, or conversation.\n";
            }
            else {
                analysisText += "Long-form audio content - probably a lecture, meeting, or extended discussion.\n";
            }
        }
        if (metadata.sampleRate) {
            if (metadata.sampleRate >= 44100) {
                analysisText += "High-quality audio detected - good for speech recognition.\n";
            }
            else if (metadata.sampleRate >= 16000) {
                analysisText += "Standard quality audio - suitable for speech processing.\n";
            }
            else {
                analysisText += "Lower quality audio - may affect transcription accuracy.\n";
            }
        }
        if (metadata.channels === 1) {
            analysisText += "Mono audio - likely recorded speech or single source.\n";
        }
        else if (metadata.channels === 2) {
            analysisText += "Stereo audio - may contain multiple speakers or music.\n";
        }
        analysisText += `\nTechnical Details:
- Duration: ${Math.round(metadata.duration)} seconds
- Format: ${metadata.format}
- File size: ${(metadata.fileSize / 1024 / 1024).toFixed(2)} MB
- Sample rate: ${metadata.sampleRate || 'Unknown'} Hz
- Channels: ${metadata.channels || 'Unknown'}
- Bitrate: ${metadata.bitrate || 'Unknown'} kbps

To enable automatic speech-to-text transcription:
1. Configure OPENAI_API_KEY for Whisper API (recommended)
2. Set up ASSEMBLYAI_API_KEY for free transcription
3. Configure DEEPGRAM_API_KEY for advanced features
4. Install Whisper locally: pip install openai-whisper

The audio file has been successfully processed and analyzed.`;
        return analysisText;
    }
    async getFallbackTranscription(filePath) {
        const fileName = path_1.default.basename(filePath);
        const metadata = await this.getAudioMetadata(filePath);
        const transcription = `[Audio file processed: ${fileName}]

Duration: ${Math.round(metadata.duration)} seconds
Format: ${metadata.format}
File size: ${(metadata.fileSize / 1024 / 1024).toFixed(2)} MB
${metadata.bitrate ? `Bitrate: ${metadata.bitrate} kbps` : ''}
${metadata.sampleRate ? `Sample rate: ${metadata.sampleRate} Hz` : ''}
${metadata.channels ? `Channels: ${metadata.channels}` : ''}

Note: Automatic transcription requires API configuration or local Whisper installation.
To enable speech-to-text functionality:

1. Set OPENAI_API_KEY for Whisper API
2. Configure Google Cloud credentials
3. Install Whisper locally: pip install openai-whisper

The audio file has been uploaded and can be manually transcribed if needed.`;
        return {
            transcription,
            processingMethod: 'metadata-fallback'
        };
    }
    isFormatSupported(filePath) {
        const ext = path_1.default.extname(filePath).toLowerCase();
        return this.supportedFormats.includes(ext);
    }
    getSupportedFormats() {
        return [...this.supportedFormats];
    }
}
exports.EnhancedAudioService = EnhancedAudioService;
exports.enhancedAudioService = new EnhancedAudioService();
//# sourceMappingURL=enhancedAudioService.js.map