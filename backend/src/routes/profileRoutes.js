const { Router } = require('express');
const multer = require('multer');
const profileController = require('../controllers/profileController');
const authMiddleware = require('../middleware/authMiddleware');

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, ['image/jpeg','image/png','image/webp'].includes(file.mimetype));
  },
});

router.use(authMiddleware);
router.get('/',        profileController.getProfile);
router.put('/',        profileController.updateProfile);
router.post('/avatar', upload.single('avatar'), profileController.uploadAvatar);

module.exports = router;
