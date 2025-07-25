"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileProcessingService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const client_1 = require("@prisma/client");
const mammoth_1 = __importDefault(require("mammoth"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const pdfParse = require('pdf-parse');
const child_process_1 = require("child_process");
const util_1 = require("util");
const tesseract_js_1 = __importDefault(require("tesseract.js"));
const AdmZip = require('adm-zip');
const enhancedAudioService_1 = require("./enhancedAudioService");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const prisma = new client_1.PrismaClient();
class FileProcessingService {
    constructor() {
        this.uploadDir = process.env.UPLOAD_DIR || './uploads';
        this.ensureUploadDir();
        this.checkExternalTools();
    }
    checkExternalTools() {
        console.log('🔧 Checking external tools availability...');
        try {
            require('child_process').execSync('soffice --version', { stdio: 'ignore' });
            console.log('✅ LibreOffice: Available');
        }
        catch (error) {
            console.log('⚠️ LibreOffice: Not available (PowerPoint processing will use fallback)');
        }
        try {
            require('child_process').execSync('ffmpeg -version', { stdio: 'ignore' });
            console.log('✅ FFmpeg: Available');
        }
        catch (error) {
            console.log('⚠️ FFmpeg: Not available (Audio/Video processing will be limited)');
        }
        try {
            require('child_process').execSync('python -c "import whisper"', { stdio: 'ignore' });
            console.log('✅ Python + Whisper: Available');
        }
        catch (error) {
            console.log('⚠️ Python + Whisper: Not available (Speech-to-text will be limited)');
        }
        console.log('💡 To install missing tools, run: setup-external-tools.bat');
    }
    ensureUploadDir() {
        if (!fs_1.default.existsSync(this.uploadDir)) {
            fs_1.default.mkdirSync(this.uploadDir, { recursive: true });
        }
    }
    async processFile(file) {
        try {
            const fileExtension = path_1.default.extname(file.originalname).toLowerCase();
            const contentType = this.getContentType(fileExtension);
            let result;
            switch (contentType) {
                case 'text':
                    result = await this.processTextFile(file);
                    break;
                case 'pdf':
                    result = await this.processPDFFile(file);
                    break;
                case 'ppt':
                    result = await this.processPPTFile(file);
                    break;
                case 'audio':
                    result = await this.processAudioFile(file);
                    break;
                case 'video':
                    result = await this.processVideoFile(file);
                    break;
                default:
                    throw new Error(`Unsupported file type: ${fileExtension}`);
            }
            return { success: true, content: result };
        }
        catch (error) {
            console.error('File processing error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    getContentType(extension) {
        const typeMap = {
            '.txt': 'text',
            '.md': 'text',
            '.pdf': 'pdf',
            '.ppt': 'ppt',
            '.pptx': 'ppt',
            '.mp3': 'audio',
            '.wav': 'audio',
            '.m4a': 'audio',
            '.mp4': 'video',
            '.avi': 'video',
            '.mov': 'video',
            '.mkv': 'video'
        };
        return typeMap[extension] || 'unknown';
    }
    async processTextFile(file) {
        const content = fs_1.default.readFileSync(file.path, 'utf-8');
        return {
            contentType: 'text',
            originalName: file.originalname,
            extractedText: content,
            metadata: {
                fileSize: file.size
            }
        };
    }
    async processPDFFile(file) {
        try {
            console.log(`📄 Processing PDF file: ${file.originalname}`);
            const dataBuffer = fs_1.default.readFileSync(file.path);
            const pdfData = await pdfParse(dataBuffer);
            console.log(`✅ PDF processed successfully: ${pdfData.numpages} pages, ${pdfData.text.length} characters`);
            return {
                contentType: 'pdf',
                originalName: file.originalname,
                extractedText: pdfData.text,
                metadata: {
                    pages: pdfData.numpages,
                    fileSize: file.size,
                    info: pdfData.info
                }
            };
        }
        catch (error) {
            console.error(`❌ PDF processing failed for ${file.originalname}:`, error);
            throw new Error(`PDF processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async processPPTFile(file) {
        try {
            console.log(`📊 Processing PowerPoint file: ${file.originalname}`);
            if (file.originalname.endsWith('.pptx')) {
                try {
                    const extractedText = await this.extractPPTXTextEnhanced(file.path);
                    console.log(`✅ PPTX processed successfully with enhanced parser: ${extractedText.length} characters`);
                    return {
                        contentType: 'ppt',
                        originalName: file.originalname,
                        extractedText: extractedText,
                        metadata: {
                            fileSize: file.size,
                            format: 'pptx',
                            processingMethod: 'pptx-parser'
                        }
                    };
                }
                catch (enhancedError) {
                    console.log('⚠️ Enhanced parser failed, falling back to LibreOffice...');
                    const extractedText = await this.extractPPTXText(file.path);
                    console.log(`✅ PPTX processed successfully with LibreOffice fallback: ${extractedText.length} characters`);
                    return {
                        contentType: 'ppt',
                        originalName: file.originalname,
                        extractedText: extractedText,
                        metadata: {
                            fileSize: file.size,
                            format: 'pptx',
                            processingMethod: 'libreoffice-fallback'
                        }
                    };
                }
            }
            else if (file.originalname.endsWith('.ppt')) {
                const extractedText = await this.extractPPTText(file.path);
                console.log(`✅ PPT processed successfully: ${extractedText.length} characters`);
                return {
                    contentType: 'ppt',
                    originalName: file.originalname,
                    extractedText: extractedText,
                    metadata: {
                        fileSize: file.size,
                        format: 'ppt'
                    }
                };
            }
            else {
                throw new Error('Unsupported PowerPoint format. Please use PPT or PPTX format.');
            }
        }
        catch (error) {
            console.error(`❌ PowerPoint processing failed for ${file.originalname}:`, error);
            throw new Error(`PowerPoint processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async processAudioFile(file) {
        try {
            console.log(`🎵 Processing audio file: ${file.originalname}`);
            const result = await enhancedAudioService_1.enhancedAudioService.processAudio(file.path, {
                method: 'auto',
                language: 'en',
                maxDuration: 600
            });
            if (!result.success) {
                console.warn(`⚠️ Enhanced audio processing failed, using fallback: ${result.error}`);
            }
            console.log(`✅ Audio processed successfully using ${result.processingMethod}: ${result.transcription?.length || 0} characters`);
            return {
                contentType: 'audio',
                originalName: file.originalname,
                extractedText: result.transcription || '',
                metadata: {
                    duration: result.metadata.duration,
                    fileSize: result.metadata.fileSize,
                    format: result.metadata.format,
                    processingMethod: result.processingMethod,
                    bitrate: result.metadata.bitrate,
                    sampleRate: result.metadata.sampleRate,
                    channels: result.metadata.channels
                }
            };
        }
        catch (error) {
            console.error(`❌ Audio processing failed for ${file.originalname}:`, error);
            try {
                const basicMetadata = await this.getAudioMetadata(file.path);
                return {
                    contentType: 'audio',
                    originalName: file.originalname,
                    extractedText: `[Audio file processed: ${file.originalname}]\n\nDuration: ${Math.round(basicMetadata.duration)} seconds\nFile size: ${(file.size / 1024 / 1024).toFixed(2)} MB\n\nNote: Automatic transcription failed. Please configure audio processing options.`,
                    metadata: {
                        duration: basicMetadata.duration,
                        fileSize: file.size,
                        format: path_1.default.extname(file.originalname).slice(1),
                        processingMethod: 'basic-fallback'
                    }
                };
            }
            catch (fallbackError) {
                throw new Error(`Audio processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }
    async processVideoFile(file) {
        try {
            console.log(`🎬 Processing video file: ${file.originalname}`);
            const metadata = await this.getVideoMetadata(file.path);
            const audioPath = await this.extractAudioFromVideo(file.path);
            let speechText = '';
            try {
                speechText = await this.transcribeAudio(audioPath);
                console.log(`✅ Video audio transcribed: ${speechText.length} characters`);
            }
            catch (error) {
                console.warn(`Audio transcription failed:`, error);
                speechText = '[Audio transcription failed - please ensure Whisper is installed]';
            }
            let ocrText = '';
            try {
                ocrText = await this.extractTextFromVideoFrames(file.path);
                console.log(`✅ Video OCR completed: ${ocrText.length} characters`);
            }
            catch (error) {
                console.warn(`Video OCR failed:`, error);
                ocrText = '[OCR text extraction failed]';
            }
            const combinedText = `[Video Content from ${file.originalname}]\n\n=== Speech Transcript ===\n${speechText}\n\n=== Text from Video (OCR) ===\n${ocrText}`;
            if (fs_1.default.existsSync(audioPath)) {
                fs_1.default.unlinkSync(audioPath);
            }
            console.log(`✅ Video processed successfully: ${combinedText.length} total characters`);
            return {
                contentType: 'video',
                originalName: file.originalname,
                extractedText: combinedText,
                metadata: {
                    duration: metadata.duration,
                    fileSize: file.size
                }
            };
        }
        catch (error) {
            console.error(`❌ Video processing failed for ${file.originalname}:`, error);
            throw new Error(`Video processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async getAudioMetadata(filePath) {
        return new Promise((resolve, reject) => {
            fluent_ffmpeg_1.default.ffprobe(filePath, (err, metadata) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve({
                        duration: metadata.format.duration || 0
                    });
                }
            });
        });
    }
    async getVideoMetadata(filePath) {
        return this.getAudioMetadata(filePath);
    }
    async extractAudioFromVideo(videoPath) {
        const audioPath = videoPath.replace(path_1.default.extname(videoPath), '_audio.wav');
        return new Promise((resolve, reject) => {
            (0, fluent_ffmpeg_1.default)(videoPath)
                .output(audioPath)
                .audioCodec('pcm_s16le')
                .on('end', () => resolve(audioPath))
                .on('error', reject)
                .run();
        });
    }
    async extractPPTXTextEnhanced(filePath) {
        try {
            console.log('🚀 Using enhanced PPTX parser (pure JavaScript ZIP extraction)...');
            const zip = new AdmZip(filePath);
            const zipEntries = zip.getEntries();
            let extractedText = '';
            let slideCount = 0;
            zipEntries.forEach((entry) => {
                if (entry.entryName.includes('ppt/slides/slide') && entry.entryName.endsWith('.xml')) {
                    slideCount++;
                    const content = entry.getData().toString('utf8');
                    extractedText += `\n--- Slide ${slideCount} ---\n`;
                    const textPatterns = [
                        /<a:t[^>]*>([^<]*)<\/a:t>/g,
                        /<t[^>]*>([^<]*)<\/t>/g,
                        /<text[^>]*>([^<]*)<\/text>/g
                    ];
                    textPatterns.forEach(pattern => {
                        const matches = content.match(pattern);
                        if (matches) {
                            matches.forEach((match) => {
                                const text = match.replace(/<[^>]*>/g, '').trim();
                                if (text && text.length > 0) {
                                    extractedText += text + ' ';
                                }
                            });
                        }
                    });
                    extractedText += '\n';
                }
            });
            if (slideCount === 0) {
                console.log('⚠️ No slides found, trying alternative extraction...');
                zipEntries.forEach((entry) => {
                    if (entry.entryName.endsWith('.xml') &&
                        (entry.entryName.includes('slide') ||
                            entry.entryName.includes('content') ||
                            entry.entryName.includes('document'))) {
                        const content = entry.getData().toString('utf8');
                        const allTextMatches = content.match(/>([^<]+)</g);
                        if (allTextMatches) {
                            allTextMatches.forEach((match) => {
                                const text = match.replace(/[><]/g, '').trim();
                                if (text && text.length > 2 && !text.includes('xml') && !text.includes('http')) {
                                    extractedText += text + ' ';
                                }
                            });
                        }
                    }
                });
            }
            if (!extractedText.trim()) {
                throw new Error('No text content found in PPTX file');
            }
            extractedText = extractedText
                .replace(/\s+/g, ' ')
                .replace(/\n\s*\n/g, '\n')
                .trim();
            console.log(`✅ Enhanced PPTX extraction successful: ${extractedText.length} characters from ${slideCount} slides`);
            return extractedText;
        }
        catch (error) {
            console.error('Enhanced PPTX extraction failed:', error);
            throw new Error(`Enhanced PPTX extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async extractPPTXText(filePath) {
        try {
            const outputPath = filePath.replace(path_1.default.extname(filePath), '.txt');
            const command = `libreoffice --headless --convert-to txt --outdir "${path_1.default.dirname(outputPath)}" "${filePath}"`;
            await execAsync(command);
            if (fs_1.default.existsSync(outputPath)) {
                const text = fs_1.default.readFileSync(outputPath, 'utf-8');
                fs_1.default.unlinkSync(outputPath);
                return text;
            }
            else {
                return await this.extractPPTXTextFallback(filePath);
            }
        }
        catch (error) {
            console.warn(`LibreOffice conversion failed, using fallback method:`, error);
            return await this.extractPPTXTextFallback(filePath);
        }
    }
    async extractPPTXTextFallback(filePath) {
        try {
            const result = await mammoth_1.default.extractRawText({ path: filePath });
            return result.value || `[PowerPoint file processed: ${path_1.default.basename(filePath)}]\n\nContent extraction requires LibreOffice installation for full functionality.`;
        }
        catch (error) {
            return `[PowerPoint file uploaded: ${path_1.default.basename(filePath)}]\n\nNote: Text extraction failed. Please ensure LibreOffice is installed for PowerPoint processing.`;
        }
    }
    async extractPPTText(filePath) {
        try {
            const outputPath = filePath.replace(path_1.default.extname(filePath), '.txt');
            const command = `libreoffice --headless --convert-to txt --outdir "${path_1.default.dirname(outputPath)}" "${filePath}"`;
            await execAsync(command);
            if (fs_1.default.existsSync(outputPath)) {
                const text = fs_1.default.readFileSync(outputPath, 'utf-8');
                fs_1.default.unlinkSync(outputPath);
                return text;
            }
            else {
                return `[Legacy PPT file processed: ${path_1.default.basename(filePath)}]\n\nNote: Text extraction requires LibreOffice installation for full functionality.`;
            }
        }
        catch (error) {
            console.warn(`PPT conversion failed:`, error);
            return `[Legacy PPT file uploaded: ${path_1.default.basename(filePath)}]\n\nNote: Text extraction failed. Please ensure LibreOffice is installed for PowerPoint processing.`;
        }
    }
    async transcribeAudio(audioPath) {
        try {
            const transcript = await this.transcribeWithWhisperCLI(audioPath);
            return transcript;
        }
        catch (error) {
            console.warn(`Whisper CLI failed, using fallback method:`, error);
            return await this.transcribeWithPythonWhisper(audioPath);
        }
    }
    async transcribeWithWhisperCLI(audioPath) {
        try {
            const command = `whisper "${audioPath}" --model base --output_format txt --output_dir "${path_1.default.dirname(audioPath)}"`;
            await execAsync(command);
            const outputFile = audioPath.replace(path_1.default.extname(audioPath), '.txt');
            if (fs_1.default.existsSync(outputFile)) {
                const transcript = fs_1.default.readFileSync(outputFile, 'utf-8');
                fs_1.default.unlinkSync(outputFile);
                return transcript;
            }
            else {
                throw new Error('Whisper output file not found');
            }
        }
        catch (error) {
            throw new Error(`Whisper CLI transcription failed: ${error}`);
        }
    }
    async transcribeWithPythonWhisper(audioPath) {
        try {
            const pythonScript = `
import whisper
import sys

model = whisper.load_model("base")
result = model.transcribe("${audioPath}")
print(result["text"])
`;
            const scriptPath = path_1.default.join(path_1.default.dirname(audioPath), 'transcribe.py');
            fs_1.default.writeFileSync(scriptPath, pythonScript);
            const { stdout } = await execAsync(`python "${scriptPath}"`);
            fs_1.default.unlinkSync(scriptPath);
            return stdout.trim();
        }
        catch (error) {
            console.warn(`Python Whisper failed:`, error);
            return await this.transcribeAudioFallback(audioPath);
        }
    }
    async transcribeAudioFallback(audioPath) {
        const fileName = path_1.default.basename(audioPath);
        const metadata = await this.getAudioMetadata(audioPath);
        return `[Audio file processed: ${fileName}]

Duration: ${Math.round(metadata.duration)} seconds
File size: ${(fs_1.default.statSync(audioPath).size / 1024 / 1024).toFixed(2)} MB

Note: Automatic transcription requires Whisper installation.
To enable speech-to-text functionality:
1. Install OpenAI Whisper: pip install openai-whisper
2. Or install Whisper CLI: pip install whisper

The audio file has been uploaded and can be manually transcribed if needed.`;
    }
    async extractTextFromVideoFrames(videoPath) {
        try {
            console.log(`🔍 Starting OCR processing for video: ${path_1.default.basename(videoPath)}`);
            const tempDir = path_1.default.join(path_1.default.dirname(videoPath), 'frames_' + Date.now());
            fs_1.default.mkdirSync(tempDir, { recursive: true });
            await this.extractVideoFrames(videoPath, tempDir);
            const frameFiles = fs_1.default.readdirSync(tempDir).filter(f => f.endsWith('.png'));
            const ocrResults = [];
            for (const frameFile of frameFiles.slice(0, 10)) {
                const framePath = path_1.default.join(tempDir, frameFile);
                try {
                    const text = await this.performOCR(framePath);
                    if (text.trim()) {
                        ocrResults.push(`[Frame ${frameFile}]\n${text.trim()}`);
                    }
                }
                catch (error) {
                    console.warn(`OCR failed for frame ${frameFile}:`, error);
                }
            }
            this.cleanupDirectory(tempDir);
            if (ocrResults.length > 0) {
                return ocrResults.join('\n\n');
            }
            else {
                return '[No text detected in video frames]';
            }
        }
        catch (error) {
            console.error(`Video OCR processing failed:`, error);
            return `[OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}]`;
        }
    }
    async extractVideoFrames(videoPath, outputDir) {
        return new Promise((resolve, reject) => {
            (0, fluent_ffmpeg_1.default)(videoPath)
                .screenshots({
                count: 10,
                folder: outputDir,
                filename: 'frame_%i.png',
                size: '1280x720'
            })
                .on('end', () => resolve())
                .on('error', reject);
        });
    }
    async performOCR(imagePath) {
        try {
            const { data: { text } } = await tesseract_js_1.default.recognize(imagePath, 'eng', {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        console.log(`OCR progress: ${Math.round(m.progress * 100)}%`);
                    }
                }
            });
            return text;
        }
        catch (error) {
            throw new Error(`OCR failed: ${error}`);
        }
    }
    cleanupDirectory(dirPath) {
        try {
            if (fs_1.default.existsSync(dirPath)) {
                const files = fs_1.default.readdirSync(dirPath);
                for (const file of files) {
                    fs_1.default.unlinkSync(path_1.default.join(dirPath, file));
                }
                fs_1.default.rmdirSync(dirPath);
            }
        }
        catch (error) {
            console.warn(`Failed to cleanup directory ${dirPath}:`, error);
        }
    }
    async saveProcessedContent(presentationId, content, filePath) {
        return await prisma.presentationContent.create({
            data: {
                presentationId,
                contentType: content.contentType,
                originalName: content.originalName,
                filePath,
                extractedText: content.extractedText,
                timestamp: new Date()
            }
        });
    }
    async getPresentationContents(presentationId) {
        return await prisma.presentationContent.findMany({
            where: { presentationId },
            orderBy: { timestamp: 'asc' }
        });
    }
    cleanupFile(filePath) {
        if (fs_1.default.existsSync(filePath)) {
            fs_1.default.unlinkSync(filePath);
        }
    }
}
exports.fileProcessingService = new FileProcessingService();
//# sourceMappingURL=fileProcessingService.js.map