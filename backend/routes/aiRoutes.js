import express from 'express';
import verifyFirebaseToken from '../middlewares/authMiddleware.js';

const router = express.Router();

/**
 * Generate image using Gemini Nano Banana
 * POST /api/ai/generate-image
 */
router.post('/generate-image', verifyFirebaseToken, async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        console.log('[AI] Generating image with Nano Banana:', prompt.substring(0, 50) + '...');

        // Dynamic import of emergentintegrations
        const { LlmChat, UserMessage } = await import('emergentintegrations/llm/chat');
        
        // Get API key from environment
        const apiKey = process.env.EMERGENT_LLM_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'AI service not configured' });
        }

        // Create chat session
        const chat = new LlmChat({
            apiKey,
            sessionId: `image-gen-${Date.now()}`,
            systemMessage: 'You are a helpful AI assistant that generates promotional images.'
        });

        // Configure for image generation with Gemini Nano Banana
        chat.withModel('gemini', 'gemini-3-pro-image-preview').withParams({
            modalities: ['image', 'text']
        });

        // Create message
        const msg = new UserMessage({ text: prompt });

        // Generate image
        const [text, images] = await chat.sendMessageMultimodalResponse(msg);

        if (!images || images.length === 0) {
            return res.status(500).json({ error: 'No image generated' });
        }

        // Get first image
        const image = images[0];
        
        // Return as data URL
        const imageUrl = `data:${image.mimeType};base64,${image.data}`;
        
        console.log('[AI] Image generated successfully');

        res.json({ 
            imageUrl,
            text: text || 'Image generated successfully'
        });

    } catch (error) {
        console.error('[AI] Image generation error:', error);
        res.status(500).json({ 
            error: 'Image generation failed',
            details: error.message 
        });
    }
});

export default router;
