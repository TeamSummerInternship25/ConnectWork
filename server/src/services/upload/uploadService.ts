import fs from 'fs/promises'; 
import path from 'path'; 
 
export class UploadService { 
  static async processFile(file: Express.Multer.File) { 
    try { 
      // Validate file exists 
      await fs.access(file.path); 
 
      // Generate unique filename 
      const ext = path.extname(file.originalname); 
      const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`; 
 
      return { 
        filename: uniqueName, 
        originalName: file.originalname, 
        size: file.size, 
        mimetype: file.mimetype, 
        uploadPath: file.path 
      }; 
    } catch (error) { 
      throw new Error('File processing failed'); 
    } 
  } 
 
  static async deleteFile(filePath: string) { 
    try { 
      await fs.unlink(filePath); 
      return true; 
    } catch (error) { 
      return false; 
    } 
  } 
} 
