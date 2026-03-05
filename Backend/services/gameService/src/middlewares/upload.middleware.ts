import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = path.resolve(process.cwd(), 'Miscelanius/gameImage');

console.log('📁 Upload directory:', uploadDir);

try {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('✅ Upload directory ready');
} catch (error) {
  console.error('Error creating upload directory:', error);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log('📥 File destination:', uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const normalizedName = file.originalname.replace(/\\/g, '/');
    const baseName = path.basename(normalizedName);
    const safeName = baseName.replace(/[<>:"/\\|?*]+/g, '_') || `upload-${Date.now()}`;
    console.log('📝 Original filename:', file.originalname, '-> Safe filename:', safeName);
    cb(null, safeName);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedMimes.includes(file.mimetype)) {
    console.log('✅ File type accepted:', file.mimetype);
    cb(null, true);
  } else {
    console.log('❌ File type rejected:', file.mimetype);
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
  const imagePath = `/gameImage/${filename}`;
  console.log('🔗 Generated image path:', imagePath);
  return imagePath;
};

export const deleteImage = (imagePath: string): void => {
  try {
    const fullPath = path.resolve(process.cwd(), imagePath);
    console.log('🗑️ Attempting to delete image at:', fullPath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log('✅ Image deleted successfully');
    } else {
      console.log('⚠️ Image file not found:', fullPath);
    }
  } catch (error) {
    console.error('Error deleting image:', error);
  }
};
