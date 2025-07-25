interface ProcessedContent {
    contentType: string;
    originalName: string;
    extractedText: string;
    metadata?: {
        duration?: number;
        pages?: number;
        slides?: number;
        fileSize: number;
        info?: any;
        format?: string;
        processingMethod?: string;
        bitrate?: number;
        sampleRate?: number;
        channels?: number;
    };
}
interface ProcessingResult {
    success: boolean;
    content?: ProcessedContent;
    error?: string;
}
declare class FileProcessingService {
    private uploadDir;
    constructor();
    private checkExternalTools;
    private ensureUploadDir;
    processFile(file: Express.Multer.File): Promise<ProcessingResult>;
    private getContentType;
    private processTextFile;
    private processPDFFile;
    private processPPTFile;
    private processAudioFile;
    private processVideoFile;
    private getAudioMetadata;
    private getVideoMetadata;
    private extractAudioFromVideo;
    private extractPPTXTextEnhanced;
    private extractPPTXText;
    private extractPPTXTextFallback;
    private extractPPTText;
    private transcribeAudio;
    private transcribeWithWhisperCLI;
    private transcribeWithPythonWhisper;
    private transcribeAudioFallback;
    private extractTextFromVideoFrames;
    private extractVideoFrames;
    private performOCR;
    private cleanupDirectory;
    saveProcessedContent(presentationId: string, content: ProcessedContent, filePath: string): Promise<{
        id: string;
        presentationId: string;
        contentType: string;
        originalName: string;
        extractedText: string;
        filePath: string | null;
        timestamp: Date;
    }>;
    getPresentationContents(presentationId: string): Promise<{
        id: string;
        presentationId: string;
        contentType: string;
        originalName: string;
        extractedText: string;
        filePath: string | null;
        timestamp: Date;
    }[]>;
    cleanupFile(filePath: string): void;
}
export declare const fileProcessingService: FileProcessingService;
export { ProcessedContent, ProcessingResult };
//# sourceMappingURL=fileProcessingService.d.ts.map