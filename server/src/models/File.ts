import { Schema, model, Document } from 'mongoose'; 
 
export interface IFile extends Document { 
  filename: string; 
  originalName: string; 
  mimetype: string; 
  size: number; 
  path: string; 
  uploadedBy: string; 
  uploadedAt: Date; 
} 
 
const FileSchema = new Schema<IFile>({ 
  filename: { type: String, required: true }, 
  originalName: { type: String, required: true }, 
  mimetype: { type: String, required: true }, 
  size: { type: Number, required: true }, 
  path: { type: String, required: true }, 
  uploadedBy: { type: String, required: true }, 
  uploadedAt: { type: Date, default: Date.now } 
}); 
 
export const File = model<IFile>('File', FileSchema); 
