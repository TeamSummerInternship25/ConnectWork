export class UploadService { 
  static async processFile(file: Express.Multer.File) { 
    // TODO: Implement file processing logic 
    return { 
      filename: file.filename, 
      originalName: file.originalname, 
      size: file.size 
    }; 
  } 
} 
