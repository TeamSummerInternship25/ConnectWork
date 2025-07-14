import { Router } from 'express'; 
import multer from 'multer'; 
 
const router = Router(); 
 
// Configure multer for file uploads 
const upload = multer({ dest: 'uploads/' }); 
 
router.post('/file', upload.single('file'), (req, res) => { 
  res.json({ message: 'File upload endpoint ready' }); 
}); 
 
export default router; 
