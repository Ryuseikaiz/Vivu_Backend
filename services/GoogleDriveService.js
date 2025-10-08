const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const stream = require('stream');

class GoogleDriveService {
  constructor() {
    this.drive = null;
    this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || null;
    this.initializeDrive();
  }

  initializeDrive() {
    try {
      // Option 1: Using Service Account (Recommended for production)
      if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
        const auth = new google.auth.JWT(
          process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          null,
          process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          ['https://www.googleapis.com/auth/drive.file']
        );

        this.drive = google.drive({ version: 'v3', auth });
        console.log('✅ Google Drive initialized with Service Account');
      }
      // Option 2: Using OAuth2 credentials
      else if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN) {
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000'
        );

        oauth2Client.setCredentials({
          refresh_token: process.env.GOOGLE_REFRESH_TOKEN
        });

        this.drive = google.drive({ version: 'v3', auth: oauth2Client });
        console.log('✅ Google Drive initialized with OAuth2');
      }
      // Option 3: Using API Key (limited functionality)
      else if (process.env.GOOGLE_DRIVE_API_KEY) {
        this.drive = google.drive({ 
          version: 'v3', 
          auth: process.env.GOOGLE_DRIVE_API_KEY 
        });
        console.log('✅ Google Drive initialized with API Key');
      } else {
        console.log('⚠️  Google Drive not configured - will use local storage fallback');
      }
    } catch (error) {
      console.error('❌ Error initializing Google Drive:', error.message);
      this.drive = null;
    }
  }

  /**
   * Upload file to Google Drive
   * @param {Buffer|Stream} fileData - File data (buffer or stream)
   * @param {String} fileName - Name of the file
   * @param {String} mimeType - MIME type of the file
   * @returns {Promise<String>} - Public URL of uploaded file
   */
  async uploadFile(fileData, fileName, mimeType) {
    try {
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      const fileMetadata = {
        name: fileName,
        parents: this.folderId ? [this.folderId] : []
      };

      let media;
      if (Buffer.isBuffer(fileData)) {
        const bufferStream = new stream.PassThrough();
        bufferStream.end(fileData);
        media = {
          mimeType: mimeType,
          body: bufferStream
        };
      } else {
        media = {
          mimeType: mimeType,
          body: fileData
        };
      }

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink, webContentLink'
      });

      const fileId = response.data.id;

      // Make file publicly accessible
      await this.drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });

      // Get public URL
      const publicUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
      
      console.log(`✅ File uploaded to Google Drive: ${fileName}`);
      return {
        fileId: fileId,
        fileName: fileName,
        url: publicUrl,
        webViewLink: response.data.webViewLink,
        webContentLink: response.data.webContentLink
      };

    } catch (error) {
      console.error('❌ Error uploading to Google Drive:', error.message);
      throw error;
    }
  }

  /**
   * Upload file from path
   * @param {String} filePath - Path to file
   * @param {String} fileName - Name for the uploaded file
   * @returns {Promise<String>} - Public URL of uploaded file
   */
  async uploadFileFromPath(filePath, fileName) {
    try {
      const fileStream = fs.createReadStream(filePath);
      const mimeType = this.getMimeType(filePath);
      
      return await this.uploadFile(fileStream, fileName || path.basename(filePath), mimeType);
    } catch (error) {
      console.error('❌ Error uploading file from path:', error.message);
      throw error;
    }
  }

  /**
   * Upload image from base64
   * @param {String} base64Data - Base64 encoded image data
   * @param {String} fileName - Name of the file
   * @returns {Promise<String>} - Public URL of uploaded file
   */
  async uploadBase64Image(base64Data, fileName) {
    try {
      // Extract mime type and data from base64 string
      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      
      if (!matches || matches.length !== 3) {
        throw new Error('Invalid base64 image data');
      }

      const mimeType = matches[1];
      const imageData = matches[2];
      const buffer = Buffer.from(imageData, 'base64');

      return await this.uploadFile(buffer, fileName, mimeType);
    } catch (error) {
      console.error('❌ Error uploading base64 image:', error.message);
      throw error;
    }
  }

  /**
   * Delete file from Google Drive
   * @param {String} fileId - ID of the file to delete
   */
  async deleteFile(fileId) {
    try {
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      await this.drive.files.delete({
        fileId: fileId
      });

      console.log(`✅ File deleted from Google Drive: ${fileId}`);
      return true;
    } catch (error) {
      console.error('❌ Error deleting file from Google Drive:', error.message);
      throw error;
    }
  }

  /**
   * Get MIME type from file extension
   * @param {String} filePath - Path to file
   * @returns {String} - MIME type
   */
  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Check if Google Drive is configured and ready
   * @returns {Boolean}
   */
  isConfigured() {
    return this.drive !== null;
  }

  /**
   * Create a folder in Google Drive
   * @param {String} folderName - Name of the folder
   * @param {String} parentFolderId - Parent folder ID (optional)
   * @returns {Promise<String>} - Folder ID
   */
  async createFolder(folderName, parentFolderId = null) {
    try {
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId ? [parentFolderId] : []
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        fields: 'id, name'
      });

      console.log(`✅ Folder created in Google Drive: ${folderName}`);
      return response.data.id;
    } catch (error) {
      console.error('❌ Error creating folder in Google Drive:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new GoogleDriveService();
