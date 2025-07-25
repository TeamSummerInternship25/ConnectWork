import fs from 'fs/promises'; 
import { File, IFile } from '../../models/File'; 
import { UploadService } from './uploadService'; 
 
export class BatchService { 
  static async deleteMultipleFiles(fileIds: string[]) { 
    const results = { 
      success: [], 
      failed: [] 
    }; 
 
    for (const fileId of fileIds) { 
      try { 
        const success = await UploadService.deleteFile(fileId); 
        if (success) { 
          results.success.push(fileId); 
        } else { 
          results.failed.push(fileId); 
        } 
      } catch (error) { 
        results.failed.push(fileId); 
      } 
    } 
 
    return results; 
  } 
 
  static async getFileStats(userId: string) { 
    try { 
      const totalFiles = await File.countDocuments({ uploadedBy: userId }); 
ECHO ´¦ÓÚ¹Ø±Õ×´Ì¬¡£
      const sizeAggregation = await File.aggregate([ 
        { $match: { uploadedBy: userId } }, 
        { $group: { _id: null, totalSize: { $sum: '$size' } } } 
      ]); 
 
