import { Router } from 'express'; 
import { UploadService } from '../../services/upload/uploadService'; 
import fs from 'fs'; 
 
const router = Router(); 
 
router.get('/:fileId', async (req, res) => { 
  try { 
    const { fileId } = req.params; 
    const file = await UploadService.getFileById(fileId); 
 
    if (!file) { 
      return res.status(404).json({ error: 'File not found' }); 
    } 
 
    // Check if file exists on disk 
    if (!fs.existsSync(file.path)) { 
      return res.status(404).json({ error: 'File not found on disk' }); 
    } 
 
    res.setHeader('Content-Type', file.mimetype); 
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`); 
ECHO ´¦ÓÚ¹Ø±Õ×´Ì¬¡£
    const fileStream = fs.createReadStream(file.path); 
    fileStream.pipe(res); 
  } catch (error) { 
    res.status(500).json({ error: 'Download failed' }); 
  } 
}); 
 
export default router; 
