import express from 'express';
import supabase from '../services/supabase.js';
import verifyToken from '../middlewares/authMiddleware.js';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Configure multer for memory storage (files stored in buffer)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
    },
    fileFilter: (req, file, cb) => {
        // Allow only specific file types
        const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, PNG, and JPG are allowed.'), false);
        }
    }
});

/**
 * Upload a document to Supabase storage
 * POST /api/upload/document
 */
router.post('/document', verifyToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const userId = req.user.uid;
        const fileType = req.body.type || 'general';
        const file = req.file;

        // Generate unique filename
        const fileExtension = file.originalname.split('.').pop();
        const uniqueFilename = `${fileType}/${userId}/${uuidv4()}.${fileExtension}`;

        // Upload to Supabase storage
        const { data, error } = await supabase.storage
            .from('documents')
            .upload(uniqueFilename, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (error) {
            console.error('[Upload] Supabase storage error:', error);
            
            // If bucket doesn't exist, try to create it
            if (error.message?.includes('not found') || error.statusCode === 404) {
                // Try creating the bucket
                const { error: bucketError } = await supabase.storage.createBucket('documents', {
                    public: false,
                    fileSizeLimit: 10485760 // 10MB
                });
                
                if (bucketError && !bucketError.message?.includes('already exists')) {
                    console.error('[Upload] Failed to create bucket:', bucketError);
                    throw new Error('Storage not configured. Please contact support.');
                }
                
                // Retry upload
                const { data: retryData, error: retryError } = await supabase.storage
                    .from('documents')
                    .upload(uniqueFilename, file.buffer, {
                        contentType: file.mimetype,
                        upsert: false
                    });
                
                if (retryError) {
                    throw retryError;
                }
            } else {
                throw error;
            }
        }

        // Get signed URL for the uploaded file (valid for 1 year)
        const { data: urlData, error: urlError } = await supabase.storage
            .from('documents')
            .createSignedUrl(uniqueFilename, 31536000); // 1 year in seconds

        if (urlError) {
            console.error('[Upload] Failed to create signed URL:', urlError);
            // Fallback: construct public URL if signed URL fails
            const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/documents/${uniqueFilename}`;
            return res.json({
                success: true,
                url: publicUrl,
                path: uniqueFilename,
                filename: file.originalname,
                size: file.size,
                type: file.mimetype
            });
        }

        res.json({
            success: true,
            url: urlData.signedUrl,
            path: uniqueFilename,
            filename: file.originalname,
            size: file.size,
            type: file.mimetype
        });

    } catch (error) {
        console.error('[Upload] Error:', error);
        res.status(500).json({ error: error.message || 'Failed to upload file' });
    }
});

/**
 * Delete a document from Supabase storage
 * DELETE /api/upload/document
 */
router.delete('/document', verifyToken, async (req, res) => {
    try {
        const { path } = req.body;
        const userId = req.user.uid;

        if (!path) {
            return res.status(400).json({ error: 'File path is required' });
        }

        // Verify the file belongs to the user (path should contain userId)
        if (!path.includes(userId)) {
            return res.status(403).json({ error: 'Unauthorized to delete this file' });
        }

        const { error } = await supabase.storage
            .from('documents')
            .remove([path]);

        if (error) {
            console.error('[Upload] Delete error:', error);
            throw error;
        }

        res.json({ success: true, message: 'File deleted successfully' });

    } catch (error) {
        console.error('[Upload] Delete error:', error);
        res.status(500).json({ error: error.message || 'Failed to delete file' });
    }
});

/**
 * Get a signed URL for a document
 * GET /api/upload/signed-url
 */
router.get('/signed-url', verifyToken, async (req, res) => {
    try {
        const { path } = req.query;

        if (!path) {
            return res.status(400).json({ error: 'File path is required' });
        }

        const { data, error } = await supabase.storage
            .from('documents')
            .createSignedUrl(path, 3600); // 1 hour

        if (error) {
            console.error('[Upload] Signed URL error:', error);
            throw error;
        }

        res.json({ url: data.signedUrl });

    } catch (error) {
        console.error('[Upload] Signed URL error:', error);
        res.status(500).json({ error: error.message || 'Failed to get signed URL' });
    }
});

export default router;
