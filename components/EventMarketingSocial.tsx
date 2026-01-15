import React, { useState } from 'react';
import { Event } from '../types';
import { Button, Card, Input, Select } from './UI';
import { Instagram, Twitter, Linkedin, Facebook, Loader2, Share2, Copy, Download, CheckCircle, Image as ImageIcon } from 'lucide-react';
import { GeminiService } from '../services/geminiService';

interface SocialCaptionSectionProps {
    event: Event;
}

export const SocialCaptionSection: React.FC<SocialCaptionSectionProps> = ({ event }) => {
    // Step 1: Platform Selection
    const [platform, setPlatform] = useState<'instagram' | 'twitter' | 'facebook' | 'linkedin'>('instagram');
    
    // Step 2: Post Intent
    const [postIntent, setPostIntent] = useState('');
    
    // Step 3: Generate Image
    const [generateImage, setGenerateImage] = useState(true);
    
    // Step 4: Include Event Link
    const [includeLink, setIncludeLink] = useState(true);
    
    // Step 5: Tone Selection
    const [tone, setTone] = useState<'humorous' | 'professional' | 'general' | 'exciting'>('exciting');
    
    // Generation State
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedCaption, setGeneratedCaption] = useState('');
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [showResult, setShowResult] = useState(false);

    const eventUrl = `${window.location.origin}/#/event/${event.id}`;

    const handleGenerate = async () => {
        if (!postIntent.trim()) {
            alert('Please enter a post description');
            return;
        }

        setIsGenerating(true);
        setShowResult(false);

        try {
            // Generate Caption
            const details = `Event: ${event.title}, Date: ${new Date(event.date).toLocaleDateString()}, Location: ${event.location}`;
            const linkText = includeLink ? `\n\nRegister here: ${eventUrl}` : '';
            const context = `Platform: ${platform}, Tone: ${tone}, Intent: ${postIntent}. ${details}`;
            
            const caption = await GeminiService.generateMarketingContent(
                event.title,
                event.description,
                context,
                platform as any
            );
            
            setGeneratedCaption(caption + linkText);

            // Generate Image if requested
            if (generateImage) {
                const imagePrompt = `Create a promotional image for: ${event.title}. ${postIntent}. Style: ${tone}, vibrant, eye-catching for ${platform}`;
                const imageData = await GeminiService.generateEventImageNanoBanana(imagePrompt);
                setGeneratedImage(imageData);
            } else {
                setGeneratedImage(null);
            }

            setShowResult(true);
        } catch (error) {
            console.error('Generation error:', error);
            alert('Failed to generate content. Please check your AI settings.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleShare = async () => {
        const shareData: any = {
            title: event.title,
            text: generatedCaption,
            url: includeLink ? eventUrl : undefined
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
                return;
            } catch (err) {
                console.log('Share cancelled or failed');
            }
        }

        // Fallback: Platform-specific sharing
        const encodedText = encodeURIComponent(generatedCaption);
        const encodedUrl = encodeURIComponent(eventUrl);

        let shareUrl = '';
        switch (platform) {
            case 'twitter':
                shareUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
                break;
            case 'facebook':
                shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`;
                break;
            case 'linkedin':
                shareUrl = `https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodeURIComponent(event.title)}&summary=${encodedText}`;
                break;
            case 'instagram':
                navigator.clipboard.writeText(generatedCaption);
                alert('Caption copied! Instagram requires posting from the app.');
                window.open('https://www.instagram.com/', '_blank');
                return;
        }

        if (shareUrl) {
            window.open(shareUrl, '_blank');
        }
    };

    const handleCopyCaption = () => {
        navigator.clipboard.writeText(generatedCaption);
        alert('Caption copied to clipboard!');
    };

    const handleDownloadImage = () => {
        if (!generatedImage) return;
        
        const link = document.createElement('a');
        link.href = generatedImage;
        link.download = `${event.title.replace(/\s+/g, '-').toLowerCase()}-${platform}.png`;
        link.click();
    };

    if (showResult) {
        return (
            <Card className="p-6">
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <CheckCircle className="text-green-500" />
                            Generated Content
                        </h3>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowResult(false);
                                setGeneratedCaption('');
                                setGeneratedImage(null);
                            }}
                        >
                            Generate New
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Caption */}
                        <div className="space-y-4">
                            <h4 className="font-semibold text-gray-900 dark:text-white">Caption</h4>
                            <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                                <p className="whitespace-pre-wrap text-gray-900 dark:text-white">{generatedCaption}</p>
                            </div>
                            <Button
                                variant="outline"
                                onClick={handleCopyCaption}
                                className="w-full"
                            >
                                <Copy size={16} className="mr-2" />
                                Copy Caption
                            </Button>
                        </div>

                        {/* Image */}
                        {generatedImage && (
                            <div className="space-y-4">
                                <h4 className="font-semibold text-gray-900 dark:text-white">Image</h4>
                                <div className="rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                                    <img
                                        src={generatedImage}
                                        alt="Generated promotional image"
                                        className="w-full h-auto"
                                    />
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={handleDownloadImage}
                                    className="w-full"
                                >
                                    <Download size={16} className="mr-2" />
                                    Download Image
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Share Button */}
                    <Button
                        onClick={handleShare}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-lg py-3"
                    >
                        <Share2 size={20} className="mr-2" />
                        Share to {platform.charAt(0).toUpperCase() + platform.slice(1)}
                    </Button>
                </div>
            </Card>
        );
    }

    return (
        <Card className="p-6 max-w-3xl mx-auto">
            <div className="space-y-6">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Social Caption + Image Generator</h3>
                <p className="text-sm text-zinc-500">Follow the steps below to generate your social media post</p>

                {/* Step 1: Platform Selection */}
                <div className="space-y-3">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Step 1: Select Platform
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { value: 'instagram', icon: Instagram, label: 'Instagram', color: 'from-purple-500 to-pink-500' },
                            { value: 'twitter', icon: Twitter, label: 'Twitter', color: 'from-blue-400 to-blue-600' },
                            { value: 'facebook', icon: Facebook, label: 'Facebook', color: 'from-blue-600 to-blue-800' },
                            { value: 'linkedin', icon: Linkedin, label: 'LinkedIn', color: 'from-blue-700 to-blue-900' }
                        ].map(({ value, icon: Icon, label, color }) => (
                            <button
                                key={value}
                                onClick={() => setPlatform(value as any)}
                                className={`p-4 rounded-lg border-2 transition-all ${
                                    platform === value
                                        ? `border-transparent bg-gradient-to-r ${color} text-white shadow-lg`
                                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300'
                                }`}
                            >
                                <Icon className="mx-auto mb-2" size={24} />
                                <div className="text-sm font-medium">{label}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Step 2: Post Intent */}
                <div className="space-y-3">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Step 2: Describe Your Post Intent
                    </label>
                    <textarea
                        value={postIntent}
                        onChange={(e) => setPostIntent(e.target.value)}
                        placeholder="e.g., Exciting announcement about upcoming music festival with special guest lineup"
                        rows={3}
                        className="w-full p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-white"
                    />
                </div>

                {/* Step 3: Generate Image */}
                <div className="space-y-3">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Step 3: Generate Image?
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setGenerateImage(true)}
                            className={`p-3 rounded-lg border-2 transition-colors ${
                                generateImage
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                            }`}
                        >
                            <ImageIcon className="inline mr-2" size={18} />
                            Yes, generate image
                        </button>
                        <button
                            onClick={() => setGenerateImage(false)}
                            className={`p-3 rounded-lg border-2 transition-colors ${
                                !generateImage
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                            }`}
                        >
                            Caption only
                        </button>
                    </div>
                </div>

                {/* Step 4: Include Event Link */}
                <div className="space-y-3">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Step 4: Include Event Link?
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setIncludeLink(true)}
                            className={`p-3 rounded-lg border-2 transition-colors ${
                                includeLink
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                            }`}
                        >
                            Yes, include link
                        </button>
                        <button
                            onClick={() => setIncludeLink(false)}
                            className={`p-3 rounded-lg border-2 transition-colors ${
                                !includeLink
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                            }`}
                        >
                            No link
                        </button>
                    </div>
                    {includeLink && (
                        <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg">
                            <p className="text-xs text-zinc-600 dark:text-zinc-400">Link will be added:</p>
                            <p className="text-sm font-mono text-primary mt-1">{eventUrl}</p>
                        </div>
                    )}
                </div>

                {/* Step 5: Tone Selection */}
                <div className="space-y-3">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Step 5: Select Tone
                    </label>
                    <Select value={tone} onChange={(e) => setTone(e.target.value as any)}>
                        <option value="exciting">Exciting</option>
                        <option value="professional">Professional</option>
                        <option value="humorous">Humorous</option>
                        <option value="general">General</option>
                    </Select>
                </div>

                {/* Generate Button */}
                <Button
                    onClick={handleGenerate}
                    disabled={isGenerating || !postIntent.trim()}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-lg py-3"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="animate-spin mr-2" size={20} />
                            Generating...
                        </>
                    ) : (
                        'Generate Caption + Image'
                    )}
                </Button>
            </div>
        </Card>
    );
};