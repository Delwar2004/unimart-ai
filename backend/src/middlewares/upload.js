import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Allowed MIME types and extensions for images
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

// Ensure directories exist
const avatarUploadDir = path.resolve(process.cwd(), 'uploads/avatars');
const productUploadDir = path.resolve(process.cwd(), 'uploads/products');
const tempUploadDir = path.resolve(process.cwd(), 'uploads/temp');

if (!fs.existsSync(avatarUploadDir)) {
  fs.mkdirSync(avatarUploadDir, { recursive: true });
}
if (!fs.existsSync(productUploadDir)) {
  fs.mkdirSync(productUploadDir, { recursive: true });
}
if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true });
}

// Storage for avatars
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `avatar-${uniqueSuffix}${ext}`);
  },
});

// Storage for products
const productStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, productUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `product-${uniqueSuffix}${ext}`);
  },
});

// File filter validator
const imageFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype) || !ALLOWED_EXTENSIONS.includes(ext)) {
    const error = new Error('Invalid file format. Only JPEG, PNG, WEBP, and GIF images are allowed.');
    error.statusCode = 400;
    return cb(error, false);
  }

  cb(null, true);
};

// Avatar Upload Middleware (1 image, max 2MB)
export const uploadAvatarMiddleware = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: imageFileFilter,
});

// Storage for temporary classification images
const classificationStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tempUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `classify-${uniqueSuffix}${ext}`);
  },
});

// Product Images Upload Middleware (Up to 5 images, max 5MB each)
export const uploadProductImagesMiddleware = multer({
  storage: productStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 5,                  // Max 5 files
  },
  fileFilter: imageFileFilter,
});

// Classification Image Upload Middleware (1 image, max 5MB)
export const uploadClassificationImageMiddleware = multer({
  storage: classificationStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1,                  // Max 1 file
  },
  fileFilter: imageFileFilter,
});
