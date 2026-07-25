/**
 * uploadMiddleware.js
 * Multer in-memory storage for EMR file uploads.
 *
 * We use memoryStorage (not disk) so the buffer is handed directly
 * to Supabase Storage; nothing touches the local filesystem.
 */
const multer = require('multer');

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
  'application/dicom',
]);

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(new Error('Unsupported file type: ' + file.mimetype));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
});

/**
 * Wraps multer's single() so multer errors come back as JSON
 * instead of crashing the request pipeline.
 */
function singleEmrFile(fieldName = 'file') {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err) {
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({ success: false, error: err.message });
      }
      next();
    });
  };
}

module.exports = { upload, singleEmrFile };
