import fs from 'fs/promises'; 
import path from 'path'; 
import { File, IFile } from '../../models/File'; 
 
export class UploadService { 
  static async processFile(file: Express.Multer.File, userId: string) { 
    try { 
      // Validate file exists 
      await fs.access(file.path); 
 
      // Generate unique filename 
      const ext = path.extname(file.originalname); 
      const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`; 
 
      // Save to database 
      const fileRecord = new File({ 
        filename: uniqueName, 
        originalName: file.originalname, 
        mimetype: file.mimetype, 
        size: file.size, 
        path: file.path, 
        uploadedBy: userId 
      }); 
 
      await fileRecord.save(); 
 
      return { 
        id: fileRecord._id, 
        filename: uniqueName, 
        originalName: file.originalname, 
        size: file.size, 
        mimetype: file.mimetype 
      }; 
    } catch (error) { 
      throw new Error('File processing failed'); 
    } 
  } 
 
  static async getFileById(fileId: string) { 
    try { 
      const file = await File.findById(fileId); 
      return file; 
    } catch (error) { 
      return null; 
    } 
  } 
 
  static async deleteFile(fileId: string) { 
    try { 
      const file = await File.findById(fileId); 
      if (file) { 
        await fs.unlink(file.path); 
        await File.findByIdAndDelete(fileId); 
        return true; 
      } 
      return false; 
    } catch (error) { 
      return false; 
    } 
  } 
} 
