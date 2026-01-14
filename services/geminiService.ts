import { GoogleGenAI, Type } from "@google/genai";
import { Question } from '../types';
import { StorageService } from './storageService';

const getAIClient = async () => {
    const user = StorageService.getCurrentUser();
    
    // Priority: User's personal key → Admin's global key → Provided key
    let apiKey = user?.geminiApiKey;
    
    // If user doesn't have a personal key, try to get the global admin key
    if (!apiKey) {
        try {
            // Fetch global admin Gemini key from backend if available
            const adminKeyResponse = await fetch('/api/settings/admin-gemini-key', {
                headers: {
                    'Authorization': `Bearer ${await StorageService.getAuthToken()}`
                }
            });
            
            if (adminKeyResponse.ok) {
                const data = await adminKeyResponse.json();
                apiKey = data.globalGeminiKey;
            }
        } catch (e) {
            console.warn("Could not fetch global admin Gemini key");
        }
    }
    
    // If still no key, check if the user's key is provided by the user during runtime
    if (!apiKey) {
        // Fallback to checking if there's a provided key (from user's Settings)
        const providedKey = user?.geminiApiKey;
        if (providedKey) {
            apiKey = providedKey;
        }
    }

    if (!apiKey) {
        // console.warn("Gemini API Key not found. Please add a key in Settings.");
        return null;
    }
    return new GoogleGenAI({ apiKey });
};

export const GeminiService = {
    generateDescription: async (title: string, basicInfo: string): Promise<string> => {
        const ai = await getAIClient();
        if (!ai) return "AI is currently unavailable. Please add a Gemini API key in Settings to use AI features.";

        try {
            // FIX: Use recommended gemini-3-flash-preview for text tasks
            const model = 'gemini-3-flash-preview';
            const prompt = `Write a compelling, exciting event description for an event titled "${title}". 
      Basic details: ${basicInfo}. 
      Use HTML formatting (<h3> for sections, <ul> for lists, <strong> for emphasis). 
      Keep it engaging and professional. Do not wrap in markdown.`;

            const response = await ai.models.generateContent({ model, contents: prompt });
            // FIX: Access .text property directly
            return response.text ?? "";
        } catch (error) {
            console.error("AI Generation Error:", error);
            return "There was an issue generating the description.";
        }
    },

    suggestQuestions: async (context: string): Promise<Question[]> => {
        const ai = getAIClient();
        if (!ai) return [];

        try {
            // FIX: Use recommended gemini-3-flash-preview for text tasks
            const model = 'gemini-3-flash-preview';
            const prompt = `Based on this event context: "${context.substring(0, 500)}...", 
      suggest 3-5 relevant registration questions to ask attendees.`;

            const response = await ai.models.generateContent({
                model,
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                label: { type: Type.STRING },
                                type: { type: Type.STRING, enum: ['text', 'textarea', 'select', 'checkbox'] },
                                required: { type: Type.BOOLEAN },
                                options: { type: Type.ARRAY, items: { type: Type.STRING } }
                            },
                            required: ['label', 'type', 'required']
                        }
                    }
                }
            });

            // FIX: Access .text property directly
            const jsonStr = response.text || "[]";

            const questions = JSON.parse(jsonStr);
            return questions.map((q: any) => ({
                ...q,
                id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            }));
        } catch (error) {
            console.error("AI Question Suggestion Error:", error);
            return [];
        }
    },

    generateMarketingContent: async (eventTitle: string, eventDesc: string, eventDetails: string, platform: 'instagram' | 'email' | 'twitter' | 'facebook' | 'tiktok' | 'facebook_ad'): Promise<string> => {
        const ai = getAIClient();
        if (!ai) return "AI unavailable.";

        try {
            // FIX: Use recommended gemini-3-flash-preview for text tasks
            const model = 'gemini-3-flash-preview';
            let prompt = "";
            const context = `Event: "${eventTitle}". When/Where: ${eventDetails}. Description: "${eventDesc.substring(0, 1000)}".`;

            switch (platform) {
                case 'instagram':
                    prompt = `Write 3 catchy Instagram captions with emojis and hashtags for this event. ${context}`;
                    break;
                case 'facebook':
                    prompt = `Write a engaging Facebook post for this event to drive registrations. Focus on community and excitement. ${context}`;
                    break;
                case 'twitter':
                    prompt = `Write 3 engaging Tweets (under 280 characters) for this event. Include relevant hashtags. ${context}`;
                    break;
                case 'tiktok':
                    prompt = `Write a creative TikTok video script concept (Hook, Body, CTA) and a caption for this event. ${context}`;
                    break;
                case 'facebook_ad':
                    prompt = `Write high-conversion Facebook Ad copy (Primary Text, Headline, Description) for this event. Focus on urgency and value. ${context}`;
                    break;
                case 'email':
                    prompt = `Write a persuasive Email Subject Line and a short, exciting body paragraph inviting people to register for "${eventTitle}". ${context}`;
                    break;
            }

            const response = await ai.models.generateContent({ model, contents: prompt });
            // FIX: Access .text property directly
            return response.text || "Could not generate content.";
        } catch (e) {
            return "Error generating content.";
        }
    },

    generateEventImage: async (eventTitle: string, eventDesc: string): Promise<string | null> => {
        const ai = getAIClient();
        if (!ai) return null;

        try {
            const model = 'gemini-2.5-flash-image';
            const prompt = `Create a high-quality, vibrant, modern event poster/social media image for an event titled "${eventTitle}". 
          Context: ${eventDesc.substring(0, 200)}. 
          Style: Cinematic, neon lighting, highly detailed, photorealistic, 4k. 
          Do not include text in the image.`;

            const response = await ai.models.generateContent({
                model,
                contents: {
                    parts: [{ text: prompt }]
                },
                config: {
                    imageConfig: {
                        aspectRatio: "1:1"
                    }
                }
            });

            // FIX: Correctly iterate parts to find the image Part
            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) {
                    return `data:image/png;base64,${part.inlineData.data}`;
                }
            }
            return null;
        } catch (e) {
            console.error("Image Gen Error", e);
            return null;
        }
    },

    generateBroadcastDraft: async (eventTitle: string, purpose: string): Promise<{ subject: string, body: string }> => {
        const ai = getAIClient();
        if (!ai) return { subject: '', body: '' };

        try {
            // FIX: Use recommended gemini-3-flash-preview for text tasks
            const model = 'gemini-3-flash-preview';
            const prompt = `Write an email newsletter for an event titled "${eventTitle}". 
          The purpose of this email is: "${purpose}".
          Use an urgent but professional tone.
          
          Return strict JSON with keys "subject" (string) and "body" (string with HTML tags like <p>, <ul>, <strong>).`;

            const response = await ai.models.generateContent({
                model,
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            subject: { type: Type.STRING },
                            body: { type: Type.STRING }
                        },
                        required: ['subject', 'body']
                    }
                }
            });

            // FIX: Access .text property directly and clean markdown code blocks if necessary
            const text = response.text || '';
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();

            return JSON.parse(jsonStr || '{"subject": "", "body": ""}');
        } catch (e) {
            console.error("Broadcast Generation Failed", e);
            return { subject: "Update regarding " + eventTitle, body: "Content generation failed. Please try again." };
        }
    },

    generateAffiliateContent: async (referralCode: string, platform: 'linkedin' | 'twitter' | 'instagram' | 'facebook' | 'tiktok' | 'google_business'): Promise<string> => {
        const ai = getAIClient();
        if (!ai) return "AI Unavailable";

        try {
            // FIX: Use recommended gemini-3-flash-preview for text tasks
            const model = 'gemini-3-flash-preview';
            const link = `openticket.com?ref=${referralCode}`;

            let platformPrompt = "";
            if (platform === 'facebook') {
                platformPrompt = "Format for a Facebook Post. Engaging, community-focused. Encourage tagging friends.";
            } else if (platform === 'tiktok') {
                platformPrompt = "Format as a TikTok caption. Trendy, punchy, high energy. Use spacing.";
            } else if (platform === 'google_business') {
                platformPrompt = "Format as a Google Business Update. Professional, SEO-friendly, clear value prop.";
            } else if (platform === 'linkedin') {
                platformPrompt = "Format for LinkedIn. Professional thought-leadership style. Use bullet points.";
            } else {
                platformPrompt = `Format for ${platform}.`;
            }

            const prompt = `You are a world-class social media copywriter. Write ONE high-converting piece of content for an Affiliate promoting "OpenTicket".
          
          STRICT RULES:
          1. Output ONLY the caption/text. No introductions ("Here is your post:").
          2. LENGTH: 100-200 words. Tell a compelling mini-story or explain the value proposition clearly.
          3. STRUCTURE: Start with a strong Hook. Provide value in the body. End with a clear CTA.
          4. FORMATTING: Use Markdown. 
             - Use **Bold** for headlines and key benefits.
             - Use *Italics* for emphasis.
             - Use lists (- item) where appropriate.
             - Add ample line breaks between paragraphs for readability.
          5. EMOJIS: Use minimal emojis (max 3-4), placed strategically.
          6. LINK: You MUST include the referral link: ${link} clearly at the end or in the CTA.
          7. TONE: Professional yet enthusiastic. Authentic.
          
          PLATFORM: ${platform}
          CONTEXT: ${platformPrompt}
          
          KEY SELLING POINTS:
          - Zero fees for free events (save money).
          - Instant payouts via Stripe (get paid fast).
          - Easy check-in tools & modern design.
          `;

            const response = await ai.models.generateContent({ model, contents: prompt });
            // FIX: Access .text property directly
            return response.text?.trim() || "Could not generate.";
        } catch (e) {
            return "Error generating content.";
        }
    },

    checkContentSafety: async (title: string, description: string): Promise<{ safe: boolean, reason?: string }> => {
        const ai = getAIClient();
        if (!ai) return { safe: true };

        try {
            // FIX: Use recommended gemini-3-flash-preview for safety analysis
            const model = 'gemini-3-flash-preview';
            const prompt = `Analyze the following event content for violations of safety policies (hate speech, illegal acts, explicit violence, sexually explicit content, scams). 
        Event Title: "${title}"
        Description: "${description.substring(0, 1000)}"
        
        Return JSON format: { "flagged": boolean, "reason": "string" }`;

            const response = await ai.models.generateContent({
                model,
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            flagged: { type: Type.BOOLEAN },
                            reason: { type: Type.STRING }
                        },
                        required: ['flagged', 'reason']
                    }
                }
            });

            // FIX: Access .text property directly
            const result = JSON.parse(response.text || '{"flagged": false}');
            return { safe: !result.flagged, reason: result.reason };
        } catch (e) {
            console.error("Moderation Check Failed", e);
            return { safe: true }; // Default to safe if AI fails
        }
    }
};