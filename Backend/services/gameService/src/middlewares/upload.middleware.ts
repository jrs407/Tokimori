import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = path.join(__dirname, '../../..', 'Miscelanius/gameImage');

try {
  fs.mkdirSync(uploadDir, { recursive: true });
} catch (error) {
  console.error('Error creating upload directory:', error);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const normalizedName = file.originalname.replace(/\\/g, '/');
    const baseName = path.basename(normalizedName);
    const safeName = baseName.replace(/[<>:"/\\|?*]+/g, '_') || `upload-${Date.now()}`;
    cb(null, safeName);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

export const uploadGameImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export const getImagePath = (filename: string): string => {
  return `Miscelanius/gameImage/${filename}`;
};

export const deleteImage = (imagePath: string): void => {
  try {
    const fullPath = path.join(__dirname, '../../..', imagePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (error) {
    console.error('Error deleting image:', error);
  }
};
