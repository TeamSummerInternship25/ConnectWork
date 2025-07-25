import { Router } from 'express'; 
import { uploadConfig } from '../../middleware/fileValidation'; 
import { UploadService } from '../../services/upload/uploadService'; 
 
const router = Router(); 
 
router.post('/file', uploadConfig.single('file'), async (req, res) => { 
  try { 
    if (!req.file) { 
      return res.status(400).json({ error: 'No file uploaded' }); 
    } 
 
    const result = await UploadService.processFile(req.file); 
    res.json({ 
      message: 'File uploaded successfully', 
      file: result 
    }); 
  } catch (error) { 
    res.status(500).json({ error: 'Upload failed' }); 
  } 
}); 
 
export default router; 
