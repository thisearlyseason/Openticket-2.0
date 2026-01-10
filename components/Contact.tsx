
import React, { useState } from 'react';
import { Mail, MessageSquare, Send, CheckCircle2 } from 'lucide-react';
import { Input, RichTextarea, Button, Card } from './UI';
import { StorageService } from '../services/storageService';

export const Contact = () => {
    const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.message.trim()) {
            window.alert("Please enter a message.");
            return;
        }
        const success = StorageService.saveContactMessage(formData);
        if (success) {
            setIsSubmitted(true);
        } else {
            window.alert("Failed to send message. Please try again.");
        }
    };

    return (
        <div className="max-w-xl mx-auto py-12 px-4">
            <div className="text-center mb-10">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Contact Us</h1>
                <p className="text-gray-500">Have questions? We're here to help.</p>
            </div>
            
            <Card className="p-8">
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <Input 
                            label="Name" 
                            value={formData.name} 
                            onChange={e => setFormData({...formData, name: e.target.value})} 
                            required 
                        />
                        <Input 
                            label="Email" 
                            type="email" 
                            value={formData.email} 
                            onChange={e => setFormData({...formData, email: e.target.value})} 
                            required 
                        />
                        <Input 
                            label="Subject" 
                            value={formData.subject} 
                            onChange={e => setFormData({...formData, subject: e.target.value})} 
                            required 
                        />
                        <RichTextarea 
                            label="Message" 
                            value={formData.message} 
                            onChange={(e: any) => setFormData({...formData, message: e.target.value})} 
                            placeholder="Type your message here..."
                        />
                        <Button type="submit" className="w-full py-3">
                            <Send size={18} className="mr-2" /> Send Message
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};
