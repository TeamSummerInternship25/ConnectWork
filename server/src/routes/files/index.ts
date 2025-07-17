import { Router } from 'express'; 
import { File } from '../../models/File'; 
import { UploadService } from '../../services/upload/uploadService'; 
 
const router = Router(); 
 
// Get all files for a user 
router.get('/', async (req, res) => { 
  try { 
    const { userId } = req.query; 
    const { page = 1, limit = 10 } = req.query; 
 
    const files = await File.find({ uploadedBy: userId }) 
      .sort({ uploadedAt: -1 }) 
      .limit(Number(limit) * 1) 
      .skip((Number(page) - 1) * Number(limit)) 
      .select('-path'); // Don't expose file paths 
 
    const total = await File.countDocuments({ uploadedBy: userId }); 
 
    res.json({ 
      files, 
      pagination: { 
        page: Number(page), 
        limit: Number(limit), 
        total, 
        pages: Math.ceil(total / Number(limit)) 
      } 
    }); 
  } catch (error) { 
    res.status(500).json({ error: 'Failed to fetch files' }); 
  } 
}); 
 
// Delete a file 
router.delete('/:fileId', async (req, res) => { 
  try { 
    const { fileId } = req.params; 
    const success = await UploadService.deleteFile(fileId); 
 
    if (success) { 
      res.json({ message: 'File deleted successfully' }); 
    } else { 
      res.status(404).json({ error: 'File not found' }); 
    } 
  } catch (error) { 
    res.status(500).json({ error: 'Failed to delete file' }); 
  } 
}); 
 
export default router; 
