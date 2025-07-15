import { Request, Response, NextFunction } from 'express'; 
import multer from 'multer'; 
 
const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf']; 
const maxSize = 5 * 1024 * 1024; // 5MB 
 
export const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => { 
  if (allowedTypes.includes(file.mimetype)) { 
    cb(null, true); 
  } else { 
    cb(new Error('Invalid file type')); 
  } 
}; 
 
export const uploadConfig = multer({ 
  dest: 'uploads/', 
  limits: { fileSize: maxSize }, 
  fileFilter 
}); 
