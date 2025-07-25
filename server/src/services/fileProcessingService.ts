import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import mammoth from 'mammoth';
import ffmpeg from 'fluent-ffmpeg';
import { promisify } from 'util';
const pdfParse = require('pdf-parse');
import { exec } from 'child_process';
import { promisify as promisifyExec } from 'util';
import Tesseract from 'tesseract.js';

// Enhanced PowerPoint processing with pure JS
const AdmZip = require('adm-zip');

// Enhanced Audio processing
import { enhancedAudioService } from './enhancedAudioService';

const execAsync = promisifyExec(exec);

const prisma = new PrismaClient();

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

class FileProcessingService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
    this.ensureUploadDir();
    this.checkExternalTools();
  }

  /**
   * Check availability of external tools
   */
  private checkExternalTools(): void {
    console.log('🔧 Checking external tools availability...');

    // Check LibreOffice
    try {
      require('child_process').execSync('soffice --version', { stdio: 'ignore' });
      console.log('✅ LibreOffice: Available');
    } catch (error) {
      console.log('⚠️ LibreOffice: Not available (PowerPoint processing will use fallback)');
    }

    // Check FFmpeg
    try {
      require('child_process').execSync('ffmpeg -version', { stdio: 'ignore' });
      console.log('✅ FFmpeg: Available');
    } catch (error) {
      console.log('⚠️ FFmpeg: Not available (Audio/Video processing will be limited)');
    }

    // Check Python + Whisper
    try {
      require('child_process').execSync('python -c "import whisper"', { stdio: 'ignore' });
      console.log('✅ Python + Whisper: Available');
    } catch (error) {
      console.log('⚠️ Python + Whisper: Not available (Speech-to-text will be limited)');
    }

    console.log('💡 To install missing tools, run: setup-external-tools.bat');
  }

  /**
   * 确保上传目录存在
   */
  private ensureUploadDir(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * 处理上传的文件
   */
  async processFile(file: Express.Multer.File): Promise<ProcessingResult> {
    try {
      const fileExtension = path.extname(file.originalname).toLowerCase();
      const contentType = this.getContentType(fileExtension);

      let result: ProcessedContent;

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
    } catch (error) {
      console.error('File processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 根据文件扩展名确定内容类型
   */
  private getContentType(extension: string): string {
    const typeMap: { [key: string]: string } = {
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

  /**
   * 处理文本文件
   */
  private async processTextFile(file: Express.Multer.File): Promise<ProcessedContent> {
    const content = fs.readFileSync(file.path, 'utf-8');

    return {
      contentType: 'text',
      originalName: file.originalname,
      extractedText: content,
      metadata: {
        fileSize: file.size
      }
    };
  }

  /**
   * 处理PDF文件
   */
  private async processPDFFile(file: Express.Multer.File): Promise<ProcessedContent> {
    try {
      console.log(`📄 Processing PDF file: ${file.originalname}`);

      // 读取PDF文件
      const dataBuffer = fs.readFileSync(file.path);

      // 使用pdf-parse提取文本
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
    } catch (error) {
      console.error(`❌ PDF processing failed for ${file.originalname}:`, error);
      throw new Error(`PDF processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 处理PowerPoint文件
   */
  private async processPPTFile(file: Express.Multer.File): Promise<ProcessedContent> {
    try {
      console.log(`📊 Processing PowerPoint file: ${file.originalname}`);

      if (file.originalname.endsWith('.pptx')) {
        // 优先使用纯JavaScript解析器
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
        } catch (enhancedError) {
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
      } else if (file.originalname.endsWith('.ppt')) {
        // 对于老版本PPT，也尝试用LibreOffice转换
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
      } else {
        throw new Error('Unsupported PowerPoint format. Please use PPT or PPTX format.');
      }
    } catch (error) {
      console.error(`❌ PowerPoint processing failed for ${file.originalname}:`, error);
      throw new Error(`PowerPoint processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 处理音频文件
   */
  private async processAudioFile(file: Express.Multer.File): Promise<ProcessedContent> {
    try {
      console.log(`🎵 Processing audio file: ${file.originalname}`);

      // 使用增强的音频处理服务
      const result = await enhancedAudioService.processAudio(file.path, {
        method: 'auto', // 自动选择最佳方法
        language: 'en', // 可以根据需要配置
        maxDuration: 600 // 10分钟限制
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
    } catch (error) {
      console.error(`❌ Audio processing failed for ${file.originalname}:`, error);

      // 备用处理：返回基本信息
      try {
        const basicMetadata = await this.getAudioMetadata(file.path);
        return {
          contentType: 'audio',
          originalName: file.originalname,
          extractedText: `[Audio file processed: ${file.originalname}]\n\nDuration: ${Math.round(basicMetadata.duration)} seconds\nFile size: ${(file.size / 1024 / 1024).toFixed(2)} MB\n\nNote: Automatic transcription failed. Please configure audio processing options.`,
          metadata: {
            duration: basicMetadata.duration,
            fileSize: file.size,
            format: path.extname(file.originalname).slice(1),
            processingMethod: 'basic-fallback'
          }
        };
      } catch (fallbackError) {
        throw new Error(`Audio processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * 处理视频文件
   */
  private async processVideoFile(file: Express.Multer.File): Promise<ProcessedContent> {
    try {
      console.log(`🎬 Processing video file: ${file.originalname}`);

      // 获取视频元数据
      const metadata = await this.getVideoMetadata(file.path);

      // 提取音频进行语音识别
      const audioPath = await this.extractAudioFromVideo(file.path);
      let speechText = '';

      try {
        speechText = await this.transcribeAudio(audioPath);
        console.log(`✅ Video audio transcribed: ${speechText.length} characters`);
      } catch (error) {
        console.warn(`Audio transcription failed:`, error);
        speechText = '[Audio transcription failed - please ensure Whisper is installed]';
      }

      // OCR文字识别（从视频帧中提取文字）
      let ocrText = '';
      try {
        ocrText = await this.extractTextFromVideoFrames(file.path);
        console.log(`✅ Video OCR completed: ${ocrText.length} characters`);
      } catch (error) {
        console.warn(`Video OCR failed:`, error);
        ocrText = '[OCR text extraction failed]';
      }

      const combinedText = `[Video Content from ${file.originalname}]\n\n=== Speech Transcript ===\n${speechText}\n\n=== Text from Video (OCR) ===\n${ocrText}`;

      // 清理临时音频文件
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
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
    } catch (error) {
      console.error(`❌ Video processing failed for ${file.originalname}:`, error);
      throw new Error(`Video processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 获取音频元数据
   */
  private async getAudioMetadata(filePath: string): Promise<{ duration: number }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            duration: metadata.format.duration || 0
          });
        }
      });
    });
  }

  /**
   * 获取视频元数据
   */
  private async getVideoMetadata(filePath: string): Promise<{ duration: number }> {
    return this.getAudioMetadata(filePath); // 相同的实现
  }

  /**
   * 从视频中提取音频
   */
  private async extractAudioFromVideo(videoPath: string): Promise<string> {
    const audioPath = videoPath.replace(path.extname(videoPath), '_audio.wav');

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .output(audioPath)
        .audioCodec('pcm_s16le')
        .on('end', () => resolve(audioPath))
        .on('error', reject)
        .run();
    });
  }

  /**
   * 增强的PPTX文本提取 - 使用纯JavaScript ZIP解析
   */
  private async extractPPTXTextEnhanced(filePath: string): Promise<string> {
    try {
      console.log('🚀 Using enhanced PPTX parser (pure JavaScript ZIP extraction)...');

      // 直接解析PPTX文件（实际上是ZIP文件）
      const zip = new AdmZip(filePath);
      const zipEntries = zip.getEntries();

      let extractedText = '';
      let slideCount = 0;

      // 遍历ZIP中的所有条目
      zipEntries.forEach((entry: any) => {
        if (entry.entryName.includes('ppt/slides/slide') && entry.entryName.endsWith('.xml')) {
          slideCount++;
          const content = entry.getData().toString('utf8');

          extractedText += `\n--- Slide ${slideCount} ---\n`;

          // 提取文本内容 - 多种XML标签模式
          const textPatterns = [
            /<a:t[^>]*>([^<]*)<\/a:t>/g,  // PowerPoint文本标签
            /<t[^>]*>([^<]*)<\/t>/g,      // 简化文本标签
            /<text[^>]*>([^<]*)<\/text>/g // 通用文本标签
          ];

          textPatterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
              matches.forEach((match: string) => {
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

      // 如果没有找到幻灯片，尝试其他XML文件
      if (slideCount === 0) {
        console.log('⚠️ No slides found, trying alternative extraction...');

        zipEntries.forEach((entry: any) => {
          if (entry.entryName.endsWith('.xml') &&
            (entry.entryName.includes('slide') ||
              entry.entryName.includes('content') ||
              entry.entryName.includes('document'))) {

            const content = entry.getData().toString('utf8');

            // 更广泛的文本提取
            const allTextMatches = content.match(/>([^<]+)</g);
            if (allTextMatches) {
              allTextMatches.forEach((match: string) => {
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

      // 清理提取的文本
      extractedText = extractedText
        .replace(/\s+/g, ' ')  // 合并多个空格
        .replace(/\n\s*\n/g, '\n')  // 合并多个换行
        .trim();

      console.log(`✅ Enhanced PPTX extraction successful: ${extractedText.length} characters from ${slideCount} slides`);
      return extractedText;

    } catch (error) {
      console.error('Enhanced PPTX extraction failed:', error);
      throw new Error(`Enhanced PPTX extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 使用LibreOffice提取PPTX文本 - 备用方法
   */
  private async extractPPTXText(filePath: string): Promise<string> {
    try {
      // 使用LibreOffice将PPTX转换为文本
      const outputPath = filePath.replace(path.extname(filePath), '.txt');
      const command = `libreoffice --headless --convert-to txt --outdir "${path.dirname(outputPath)}" "${filePath}"`;

      await execAsync(command);

      if (fs.existsSync(outputPath)) {
        const text = fs.readFileSync(outputPath, 'utf-8');
        // 清理临时文件
        fs.unlinkSync(outputPath);
        return text;
      } else {
        // 如果LibreOffice不可用，使用备用方案
        return await this.extractPPTXTextFallback(filePath);
      }
    } catch (error) {
      console.warn(`LibreOffice conversion failed, using fallback method:`, error);
      return await this.extractPPTXTextFallback(filePath);
    }
  }

  /**
   * PPTX文本提取备用方案
   */
  private async extractPPTXTextFallback(filePath: string): Promise<string> {
    try {
      // 使用mammoth作为备用方案（虽然主要用于Word文档，但可能提取部分内容）
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value || `[PowerPoint file processed: ${path.basename(filePath)}]\n\nContent extraction requires LibreOffice installation for full functionality.`;
    } catch (error) {
      return `[PowerPoint file uploaded: ${path.basename(filePath)}]\n\nNote: Text extraction failed. Please ensure LibreOffice is installed for PowerPoint processing.`;
    }
  }

  /**
   * 提取PPT文本
   */
  private async extractPPTText(filePath: string): Promise<string> {
    try {
      // 使用LibreOffice将PPT转换为文本
      const outputPath = filePath.replace(path.extname(filePath), '.txt');
      const command = `libreoffice --headless --convert-to txt --outdir "${path.dirname(outputPath)}" "${filePath}"`;

      await execAsync(command);

      if (fs.existsSync(outputPath)) {
        const text = fs.readFileSync(outputPath, 'utf-8');
        // 清理临时文件
        fs.unlinkSync(outputPath);
        return text;
      } else {
        return `[Legacy PPT file processed: ${path.basename(filePath)}]\n\nNote: Text extraction requires LibreOffice installation for full functionality.`;
      }
    } catch (error) {
      console.warn(`PPT conversion failed:`, error);
      return `[Legacy PPT file uploaded: ${path.basename(filePath)}]\n\nNote: Text extraction failed. Please ensure LibreOffice is installed for PowerPoint processing.`;
    }
  }

  /**
   * 使用Whisper进行音频转录
   */
  private async transcribeAudio(audioPath: string): Promise<string> {
    try {
      // 首先尝试使用本地Whisper命令行工具
      const transcript = await this.transcribeWithWhisperCLI(audioPath);
      return transcript;
    } catch (error) {
      console.warn(`Whisper CLI failed, using fallback method:`, error);
      // 备用方案：使用Python Whisper脚本
      return await this.transcribeWithPythonWhisper(audioPath);
    }
  }

  /**
   * 使用Whisper CLI进行转录
   */
  private async transcribeWithWhisperCLI(audioPath: string): Promise<string> {
    try {
      const command = `whisper "${audioPath}" --model base --output_format txt --output_dir "${path.dirname(audioPath)}"`;
      await execAsync(command);

      const outputFile = audioPath.replace(path.extname(audioPath), '.txt');
      if (fs.existsSync(outputFile)) {
        const transcript = fs.readFileSync(outputFile, 'utf-8');
        fs.unlinkSync(outputFile); // 清理临时文件
        return transcript;
      } else {
        throw new Error('Whisper output file not found');
      }
    } catch (error) {
      throw new Error(`Whisper CLI transcription failed: ${error}`);
    }
  }

  /**
   * 使用Python Whisper脚本进行转录
   */
  private async transcribeWithPythonWhisper(audioPath: string): Promise<string> {
    try {
      // 创建Python脚本进行转录
      const pythonScript = `
import whisper
import sys

model = whisper.load_model("base")
result = model.transcribe("${audioPath}")
print(result["text"])
`;

      const scriptPath = path.join(path.dirname(audioPath), 'transcribe.py');
      fs.writeFileSync(scriptPath, pythonScript);

      const { stdout } = await execAsync(`python "${scriptPath}"`);

      // 清理临时脚本
      fs.unlinkSync(scriptPath);

      return stdout.trim();
    } catch (error) {
      console.warn(`Python Whisper failed:`, error);
      // 最终备用方案
      return await this.transcribeAudioFallback(audioPath);
    }
  }

  /**
   * 音频转录备用方案
   */
  private async transcribeAudioFallback(audioPath: string): Promise<string> {
    // 如果所有Whisper方案都失败，返回基本信息
    const fileName = path.basename(audioPath);
    const metadata = await this.getAudioMetadata(audioPath);

    return `[Audio file processed: ${fileName}]

Duration: ${Math.round(metadata.duration)} seconds
File size: ${(fs.statSync(audioPath).size / 1024 / 1024).toFixed(2)} MB

Note: Automatic transcription requires Whisper installation.
To enable speech-to-text functionality:
1. Install OpenAI Whisper: pip install openai-whisper
2. Or install Whisper CLI: pip install whisper

The audio file has been uploaded and can be manually transcribed if needed.`;
  }

  /**
   * 从视频帧中提取文字（OCR）
   */
  private async extractTextFromVideoFrames(videoPath: string): Promise<string> {
    try {
      console.log(`🔍 Starting OCR processing for video: ${path.basename(videoPath)}`);

      // 创建临时目录存储帧
      const tempDir = path.join(path.dirname(videoPath), 'frames_' + Date.now());
      fs.mkdirSync(tempDir, { recursive: true });

      // 使用FFmpeg提取关键帧
      await this.extractVideoFrames(videoPath, tempDir);

      // 对每个帧进行OCR
      const frameFiles = fs.readdirSync(tempDir).filter(f => f.endsWith('.png'));
      const ocrResults: string[] = [];

      for (const frameFile of frameFiles.slice(0, 10)) { // 限制处理前10帧
        const framePath = path.join(tempDir, frameFile);
        try {
          const text = await this.performOCR(framePath);
          if (text.trim()) {
            ocrResults.push(`[Frame ${frameFile}]\n${text.trim()}`);
          }
        } catch (error) {
          console.warn(`OCR failed for frame ${frameFile}:`, error);
        }
      }

      // 清理临时目录
      this.cleanupDirectory(tempDir);

      if (ocrResults.length > 0) {
        return ocrResults.join('\n\n');
      } else {
        return '[No text detected in video frames]';
      }
    } catch (error) {
      console.error(`Video OCR processing failed:`, error);
      return `[OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}]`;
    }
  }

  /**
   * 提取视频关键帧
   */
  private async extractVideoFrames(videoPath: string, outputDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
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

  /**
   * 对图像执行OCR
   */
  private async performOCR(imagePath: string): Promise<string> {
    try {
      const { data: { text } } = await Tesseract.recognize(imagePath, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      return text;
    } catch (error) {
      throw new Error(`OCR failed: ${error}`);
    }
  }

  /**
   * 清理临时目录
   */
  private cleanupDirectory(dirPath: string): void {
    try {
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          fs.unlinkSync(path.join(dirPath, file));
        }
        fs.rmdirSync(dirPath);
      }
    } catch (error) {
      console.warn(`Failed to cleanup directory ${dirPath}:`, error);
    }
  }

  /**
   * 保存处理结果到数据库
   */
  async saveProcessedContent(
    presentationId: string,
    content: ProcessedContent,
    filePath: string
  ) {
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

  /**
   * 获取演讲的所有内容
   */
  async getPresentationContents(presentationId: string) {
    return await prisma.presentationContent.findMany({
      where: { presentationId },
      orderBy: { timestamp: 'asc' }
    });
  }

  /**
   * 清理临时文件
   */
  cleanupFile(filePath: string): void {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

export const fileProcessingService = new FileProcessingService();
export { ProcessedContent, ProcessingResult };
