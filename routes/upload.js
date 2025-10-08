const express = require('express');
const router = express.Router();
const multer = require('multer');
const googleDriveService = require('../services/GoogleDriveService');
const { auth } = require('../middleware/auth');

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

/**
 * @route   POST /api/upload/image
 * @desc    Upload image to Google Drive
 * @access  Private
 */
router.post('/image', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check if Google Drive is configured
    if (!googleDriveService.isConfigured()) {
      return res.status(503).json({ 
        error: 'Google Drive not configured',
        message: 'Please configure Google Drive credentials in .env file'
      });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `${timestamp}-${req.file.originalname}`;

    // Upload to Google Drive
    const result = await googleDriveService.uploadFile(
      req.file.buffer,
      fileName,
      req.file.mimetype
    );

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: result.url,
        fileId: result.fileId,
        fileName: result.fileName,
        webViewLink: result.webViewLink
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload image',
      message: error.message 
    });
  }
});

/**
 * @route   POST /api/upload/images
 * @desc    Upload multiple images to Google Drive
 * @access  Private
 */
router.post('/images', auth, upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Check if Google Drive is configured
    if (!googleDriveService.isConfigured()) {
      return res.status(503).json({ 
        error: 'Google Drive not configured',
        message: 'Please configure Google Drive credentials in .env file'
      });
    }

    // Upload all files
    const uploadPromises = req.files.map(async (file) => {
      const timestamp = Date.now();
      const fileName = `${timestamp}-${file.originalname}`;
      
      return await googleDriveService.uploadFile(
        file.buffer,
        fileName,
        file.mimetype
      );
    });

    const results = await Promise.all(uploadPromises);

    res.json({
      success: true,
      message: `${results.length} images uploaded successfully`,
      data: results.map(result => ({
        url: result.url,
        fileId: result.fileId,
        fileName: result.fileName,
        webViewLink: result.webViewLink
      }))
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload images',
      message: error.message 
    });
  }
});

/**
 * @route   POST /api/upload/base64
 * @desc    Upload base64 image to Google Drive
 * @access  Private
 */
router.post('/base64', auth, async (req, res) => {
  try {
    const { imageData, fileName } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // Check if Google Drive is configured
    if (!googleDriveService.isConfigured()) {
      return res.status(503).json({ 
        error: 'Google Drive not configured',
        message: 'Please configure Google Drive credentials in .env file'
      });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const finalFileName = fileName || `image-${timestamp}.jpg`;

    // Upload to Google Drive
    const result = await googleDriveService.uploadBase64Image(imageData, finalFileName);

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: result.url,
        fileId: result.fileId,
        fileName: result.fileName,
        webViewLink: result.webViewLink
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload image',
      message: error.message 
    });
  }
});

/**
 * @route   DELETE /api/upload/:fileId
 * @desc    Delete image from Google Drive
 * @access  Private
 */
router.delete('/:fileId', auth, async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!googleDriveService.isConfigured()) {
      return res.status(503).json({ 
        error: 'Google Drive not configured',
        message: 'Please configure Google Drive credentials in .env file'
      });
    }

    await googleDriveService.deleteFile(fileId);

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });

  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ 
      error: 'Failed to delete image',
      message: error.message 
    });
  }
});

module.exports = router;
