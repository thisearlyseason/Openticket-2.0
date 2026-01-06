
import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Upload, Image as ImageIcon, X, Trash2, Calendar, Clock, ChevronDown, Check, Copy, Facebook, Twitter, Linkedin, Instagram, Link2, Share2, ZoomIn, ChevronLeft, ChevronRight, Eye, Info, FileText, Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Heading1, Heading2, Link as LinkIcon, Printer, AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { Registration, Event, User } from '../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// --- Utilities ---

export const resizeImage = (file: File, maxWidth: number = 600): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
        };
    });
};

export const formatTime = (time: string | null | undefined, format?: '12h' | '24h') => {
    if (!time) return '';
    if (format === '24h') return time;
    try {
        const [h, m] = time.split(':');
        const hour = parseInt(h, 10);
        if (isNaN(hour)) return time;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${m} ${ampm}`;
    } catch (e) {
        return time;
    }
};

// --- Base Components ---

const getButtonStyles = (variant: string = 'primary', className: string = '') => {
    const baseStyle = "px-6 py-3 rounded-full font-bold transition-all duration-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed select-none tracking-wide text-sm active:scale-95";
    const variants: Record<string, string> = {
        primary: "bg-primary text-primary-fg hover:opacity-90 shadow-lg shadow-primary/20 border border-transparent",
        secondary: "bg-secondary text-secondary-fg hover:opacity-90 shadow-lg shadow-secondary/20 border border-black/10 dark:border-transparent",
        outline: "bg-transparent border-2 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white hover:border-primary hover:bg-primary/10 hover:text-primary",
        ghost: "text-zinc-600 dark:text-zinc-400 hover:text-primary hover:bg-zinc-200 dark:hover:bg-zinc-800/50",
        danger: "bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/50",
        white: "bg-white text-black hover:bg-zinc-200 border border-transparent shadow-lg"
    };
    return `${baseStyle} ${variants[variant] || variants.primary} ${className}`;
};

export const Button = ({ children, variant = 'primary', className = '', isLoading, type = "button", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'white', isLoading?: boolean, size?: 'sm' | 'md' | 'lg' }) => {
    let sizeClasses = "";
    if (props.size === 'sm') sizeClasses = "!px-4 !py-2 !text-xs";

    return (
        <button type={type} className={`${getButtonStyles(variant, className)} ${sizeClasses}`} disabled={isLoading || props.disabled} {...props}>
            {isLoading && <Loader2 className="animate-spin mr-2" size={18} />}
            {children}
        </button>
    );
};

export const AnchorButton = ({ children, variant = 'primary', className = '', href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'white' }) => (
    <a href={href} className={getButtonStyles(variant, className)} {...props}>{children}</a>
);

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => (
    <div className={`bg-surface border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-xl overflow-hidden text-zinc-900 dark:text-white ${className}`} {...props}>{children}</div>
);

export const Badge = ({ children, color = 'blue', className = '' }: { children?: React.ReactNode, color?: string, className?: string }) => {
    const colors: Record<string, string> = {
        blue: 'bg-blue-600 text-white border-blue-400',
        green: 'bg-secondary text-secondary-fg border-black/10 dark:border-transparent',
        purple: 'bg-accent text-white border-transparent',
        red: 'bg-red-500 text-white border-transparent',
        primary: 'bg-primary text-white border-transparent',
        secondary: 'bg-secondary text-secondary-fg border-black/10 dark:border-transparent',
        orange: 'bg-orange-500 text-white border-orange-400',
        gray: 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700',
        yellow: 'bg-[#E0FF20] text-black border-transparent'
    };
    return <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm ${colors[color] || colors.blue} ${className}`}>{children}</span>;
};

export const Input = ({ label, error, required, className = '', containerClassName = '', icon: Icon, id, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string, error?: string, containerClassName?: string, icon?: React.ElementType }) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
        <div className={`mb-4 ${containerClassName}`}>
            {label && <label htmlFor={inputId} className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2 ml-1">{label} {required && <span className="text-red-500">*</span>}</label>}
            <div className="relative">
                {Icon && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                        <Icon size={18} />
                    </div>
                )}
                <input
                    id={inputId}
                    className={`w-full bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-primary dark:focus:border-primary text-zinc-900 dark:text-white text-sm rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-primary transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600 shadow-sm ${Icon ? 'pl-11' : ''} ${className}`}
                    {...props}
                />
            </div>
            {error && <p className="text-red-500 text-xs mt-1 font-bold">{error}</p>}
        </div>
    );
};

export const Textarea = ({ label, error, required, className = '', id, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string, error?: string }) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    return (
        <div className="mb-4">
            {label && <label htmlFor={inputId} className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2 ml-1">{label} {required && <span className="text-red-500">*</span>}</label>}
            <textarea
                id={inputId}
                className={`w-full bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-primary dark:focus:border-primary text-zinc-900 dark:text-white text-sm rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-primary transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600 min-h-[100px] resize-y shadow-sm ${className}`}
                {...props}
            />
            {error && <p className="text-red-500 text-xs mt-1 font-bold">{error}</p>}
        </div>
    );
};

export const Select = ({ label, options, error, className = '', containerClassName = '', id, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string, options: { value: string, label: string }[], error?: string, containerClassName?: string }) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    return (
        <div className={`mb-4 ${containerClassName}`}>
            {label && <label htmlFor={inputId} className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2 ml-1">{label}</label>}
            <div className="relative">
                <select
                    id={inputId}
                    className={`w-full appearance-none bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white text-base rounded-xl px-4 py-4 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all ${className}`}
                    {...props}
                >
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                    <ChevronDown size={16} />
                </div>
            </div>
            {error && <p className="text-red-500 text-xs mt-1 font-bold">{error}</p>}
        </div>
    );
};

export const RichTextarea = ({ label, value, onChange, placeholder, name, className = '' }: any) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [isFocused, setIsFocused] = useState(false);

    // Sync external value changes to the div, but ONLY when not focused 
    // to prevent cursor jumping or conflicts with user input.
    useEffect(() => {
        if (editorRef.current && !isFocused) {
            const currentHTML = editorRef.current.innerHTML;
            const newValue = value || '';
            // Only update if significantly different to avoid unnecessary reflows
            if (currentHTML !== newValue) {
                editorRef.current.innerHTML = newValue;
            }
        }
    }, [value, isFocused]);

    const handleInput = () => {
        if (editorRef.current) {
            const html = editorRef.current.innerHTML;
            onChange({ target: { name, value: html } });
        }
    };

    const execCmd = (command: string, value: string | undefined = undefined) => {
        document.execCommand(command, false, value);
        handleInput();
        editorRef.current?.focus();
    };

    const handleImageUpload = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event: any) => {
                    execCmd('insertImage', event.target.result);
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    };

    const handleLink = () => {
        const url = prompt('Enter URL:');
        if (url) execCmd('createLink', url);
    };

    return (
        <div className={`mb-4 ${className}`}>
            {label && <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2 ml-1">{label}</label>}
            <div className="relative border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-zinc-50 dark:bg-zinc-900/30 focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all shadow-sm">
                <div className="flex flex-wrap gap-1 p-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 items-center">
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('bold') }} className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400" title="Bold"><Bold size={16} /></button>
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('italic') }} className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400" title="Italic"><Italic size={16} /></button>
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('underline') }} className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400" title="Underline"><Underline size={16} /></button>
                    <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1 self-center"></div>
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('formatBlock', 'H2') }} className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400" title="Heading 1"><Heading1 size={16} /></button>
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('formatBlock', 'H3') }} className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400" title="Heading 2"><Heading2 size={16} /></button>
                    <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1 self-center"></div>
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('justifyLeft') }} className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400" title="Align Left"><AlignLeft size={16} /></button>
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('justifyCenter') }} className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400" title="Align Center"><AlignCenter size={16} /></button>
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('justifyRight') }} className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400" title="Align Right"><AlignRight size={16} /></button>
                    <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1 self-center"></div>
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('insertUnorderedList') }} className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400" title="Bullet List"><List size={16} /></button>
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd('insertOrderedList') }} className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400" title="Numbered List"><ListOrdered size={16} /></button>
                    <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1 self-center"></div>
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); handleLink() }} className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400" title="Insert Link"><LinkIcon size={16} /></button>
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); handleImageUpload() }} className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400" title="Insert Image"><ImageIcon size={16} /></button>
                </div>

                <style>{`
                    .rich-text-editor img {
                        resize: both;
                        overflow: hidden;
                        display: inline-block;
                        max-width: 100%;
                        border: 1px solid transparent;
                        vertical-align: middle;
                    }
                    .rich-text-editor img:hover {
                        border-color: var(--color-primary);
                        outline: 2px dashed var(--color-primary);
                    }
                `}</style>
                <div className="relative">
                    <div
                        ref={editorRef}
                        className="p-4 min-h-[150px] outline-none text-zinc-900 dark:text-white text-sm rich-text-editor font-sans text-left"
                        contentEditable
                        suppressContentEditableWarning={true}
                        dir="ltr"
                        onInput={handleInput}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        style={{ whiteSpace: 'pre-wrap' }}
                    />
                    {!value && !isFocused && (
                        <div className="absolute top-4 left-4 text-zinc-400 text-sm pointer-events-none">{placeholder}</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export const DatePicker = ({ label, value, onChange, error, className = '', containerClassName = '', required }: any) => (
    <div className={`mb-4 ${containerClassName}`}>
        {label && <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2 ml-1">{label} {required && <span className="text-red-500">*</span>}</label>}
        <div className="relative">
            <input
                type="date"
                value={value}
                onChange={onChange}
                className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white text-sm rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all custom-picker-input ${className}`}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                <Calendar size={18} />
            </div>
        </div>
        {error && <p className="text-red-500 text-xs mt-1 font-bold">{error}</p>}
    </div>
);

export const TimePicker = ({ label, value, onChange, error, className = '', containerClassName = '', required }: any) => (
    <div className={`mb-4 ${containerClassName}`}>
        {label && <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2 ml-1">{label} {required && <span className="text-red-500">*</span>}</label>}
        <div className="relative">
            <input
                type="time"
                value={value}
                onChange={onChange}
                className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white text-sm rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all custom-picker-input ${className}`}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                <Clock size={18} />
            </div>
        </div>
        {error && <p className="text-red-500 text-xs mt-1 font-bold">{error}</p>}
    </div>
);

export const Switch = ({ checked, onChange, disabled }: { checked: boolean, onChange: (c: boolean) => void, disabled?: boolean }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950 ${checked ? 'bg-primary' : 'bg-zinc-200 dark:bg-zinc-700'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        <span className="sr-only">Use setting</span>
        <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`}
        />
    </button>
);

export const Tooltip = ({ text, children }: { text: string, children?: React.ReactNode }) => (
    <div className="group relative flex items-center w-max">
        {children}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-max max-w-xs bg-black text-white text-xs font-bold px-2 py-1 rounded shadow-lg z-50 pointer-events-none">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black"></div>
        </div>
    </div>
);

export const FileDropZone = ({ label, currentImage, onFileSelect, onClear, multiple = false, imageStyle, accept = "image/*,application/pdf" }: { label?: string, currentImage?: string | null, onFileSelect: (base64: string | string[], name?: string) => void, onClear: () => void, multiple?: boolean, imageStyle?: React.CSSProperties, accept?: string }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        // Check for file size limit (10MB)
        for (let i = 0; i < files.length; i++) {
            if (files[i].size > 10 * 1024 * 1024) {
                alert(`File "${files[i].name}" is too large. Maximum size is 10MB.`);
                return;
            }
        }

        if (multiple) {
            const promises: Promise<string>[] = [];
            for (let i = 0; i < files.length; i++) {
                promises.push(resizeImage(files[i], 800));
            }
            const results = await Promise.all(promises);
            onFileSelect(results);
        } else {
            try {
                if (files[0].type === 'application/pdf') {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const dataUrl = e.target?.result as string;
                        onFileSelect(dataUrl, files[0].name);
                    };
                    reader.readAsDataURL(files[0]);
                    return;
                }
                const resized = await resizeImage(files[0], 800);
                onFileSelect(resized, files[0].name);
            } catch (e) {
                console.error(e);
                alert("Error processing file.");
            }
        }
    };

    return (
        <div className="mb-4">
            {label && <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2 ml-1">{label}</label>}
            {currentImage && !multiple ? (
                <div className="relative rounded-xl overflow-hidden group border border-zinc-200 dark:border-zinc-800">
                    {currentImage.startsWith('data:application/pdf') || currentImage === 'PDF UPLOADED' || currentImage === 'PDF_UPLOADED' || currentImage.endsWith('.pdf') ? (
                        <div className="h-48 bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center flex-col text-zinc-500">
                            <FileText size={48} className="mb-2" />
                            <span className="font-bold">PDF Document Uploaded</span>
                        </div>
                    ) : (
                        currentImage && <img src={currentImage} alt="Preview" className="w-full h-48 object-cover" style={imageStyle} />
                    )}
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={onClear} className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600">
                            <Trash2 size={20} />
                        </button>
                    </div>
                </div>
            ) : (
                <div
                    onClick={() => inputRef.current?.click()}
                    className="h-32 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl flex flex-col items-center justify-center text-zinc-500 hover:border-primary hover:bg-primary/5 cursor-pointer transition-all"
                >
                    <Upload size={24} className="mb-2" />
                    <span className="text-xs font-bold uppercase">{multiple ? "Click to Upload Images" : "Click to Upload Image or PDF"}</span>
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        multiple={multiple}
                        onChange={(e) => handleFile(e.target.files)}
                    />
                </div>
            )}
        </div>
    );
};

export const CodeBlock = ({ label, code }: { label: string, code: string }) => {
    const [copied, setCopied] = useState(false);
    return (
        <div className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800">
            <div className="bg-zinc-800 px-4 py-2 flex justify-between items-center">
                <span className="text-xs font-bold text-zinc-400 uppercase">{label}</span>
                <button
                    onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className="text-xs text-zinc-300 hover:text-white flex items-center gap-1"
                >
                    {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <pre className="p-4 text-xs text-green-400 font-mono overflow-x-auto whitespace-pre-wrap">
                {code}
            </pre>
        </div>
    );
};

export const SimpleChart = ({ label, data }: { label: string, data: { label: string, value: number }[] }) => {
    if (!data || data.length === 0) return <div className="text-center text-zinc-500 py-10">No data available</div>;
    const max = Math.max(...data.map(d => d.value));
    return (
        <div>
            <div className="text-xs font-bold text-zinc-500 uppercase mb-4">{label}</div>
            <div className="flex items-end gap-2 h-40">
                {data.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col justify-end items-center group">
                        <div className="text-[10px] font-bold mb-1 opacity-0 group-hover:opacity-100 transition-opacity">{d.value}</div>
                        <div
                            className="w-full bg-primary/20 hover:bg-primary rounded-t-sm transition-all relative"
                            style={{ height: `${max > 0 ? (d.value / max) * 100 : 0}%` }}
                        ></div>
                        <div className="text-[10px] text-zinc-500 mt-2 truncate w-full text-center">{d.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const DonutChart = ({ data }: { data: { label: string, value: number, color?: string }[] }) => {
    if (!data || data.length === 0) return <div className="text-center text-zinc-500 py-10">No data available</div>;
    const total = data.reduce((acc, d) => acc + d.value, 0);
    let currentAngle = 0;

    const colors = ['#ec4899', '#E0FF20', '#00ff9d', '#3b82f6', '#f59e0b', '#8b5cf6'];

    return (
        <div className="flex items-center gap-8">
            <div className="relative w-32 h-32 shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    {data.map((d, i) => {
                        const sliceAngle = (d.value / total) * 360;
                        const x1 = 50 + 50 * Math.cos(Math.PI * currentAngle / 180);
                        const y1 = 50 + 50 * Math.sin(Math.PI * currentAngle / 180);
                        const x2 = 50 + 50 * Math.cos(Math.PI * (currentAngle + sliceAngle) / 180);
                        const y2 = 50 + 50 * Math.sin(Math.PI * (currentAngle + sliceAngle) / 180);
                        const largeArc = sliceAngle > 180 ? 1 : 0;

                        const pathData = total === d.value
                            ? `M 50 50 m -50, 0 a 50,50 0 1,0 100,0 a 50,50 0 1,0 -100,0`
                            : `M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArc} 1 ${x2} ${y2} Z`;

                        currentAngle += sliceAngle;
                        return (
                            <path key={i} d={pathData} fill={d.color || colors[i % colors.length]} />
                        );
                    })}
                    <circle cx="50" cy="50" r="30" className="fill-white dark:fill-black" />
                </svg>
            </div>
            <div className="space-y-2 text-sm flex-1">
                {data.map((d, i) => (
                    <div key={i} className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color || colors[i % colors.length] }}></div>
                            <span className="text-zinc-600 dark:text-zinc-300">{d.label}</span>
                        </div>
                        <span className="font-bold">{d.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const ShareButtons = ({ title, url }: { title: string, url: string }) => {
    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title);

    const handleNativeShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({ title, url });
            } catch (err) {
                console.log('Error sharing:', err);
            }
        } else {
            navigator.clipboard.writeText(url);
            alert("Link copied to clipboard!");
        }
    };

    const shareInstagram = () => {
        navigator.clipboard.writeText(url);
        if (confirm("Instagram doesn't allow direct link sharing from websites. \n\nWe've copied the event link to your clipboard. Would you like to open Instagram now to paste it in your Bio or Story?")) {
            window.open('https://www.instagram.com/', '_blank');
        }
    };

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
                <button onClick={handleNativeShare} className="col-span-2 flex items-center justify-center gap-2 bg-primary text-white p-3 rounded-lg text-sm font-bold hover:opacity-90 md:hidden mb-1">
                    <Share2 size={18} /> Share via Apps
                </button>

                <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 bg-[#1877F2] text-white p-2.5 rounded-lg text-xs font-bold hover:bg-[#166fe5]">
                    <Facebook size={16} /> Facebook
                </a>
                <a href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 bg-black text-white p-2.5 rounded-lg text-xs font-bold hover:bg-zinc-800">
                    <Twitter size={16} /> X / Twitter
                </a>
                <button onClick={shareInstagram} className="flex items-center justify-center gap-2 bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white p-2.5 rounded-lg text-xs font-bold hover:opacity-90">
                    <Instagram size={16} /> Instagram
                </button>
                <a href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 bg-[#0A66C2] text-white p-2.5 rounded-lg text-xs font-bold hover:bg-[#0958a8]">
                    <Linkedin size={16} /> LinkedIn
                </a>
                <button onClick={() => { navigator.clipboard.writeText(url); alert("Link Copied!"); }} className="col-span-2 flex items-center justify-center gap-2 bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white p-2.5 rounded-lg text-xs font-bold hover:bg-zinc-300 dark:hover:bg-zinc-700 mt-1">
                    <Link2 size={16} /> Copy Direct Link
                </button>
            </div>

            {isLocalhost && (
                <div className="p-3 bg-zinc-100 dark:bg-black/40 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-500 leading-tight">
                    <span className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">Developer Tip:</span>
                    Facebook and LinkedIn cannot preview "localhost" links. The share button will work once your site is deployed to a public URL.
                </div>
            )}
        </div>
    );
};

export const Lightbox = ({ images, currentIndex, onClose, onChangeIndex }: { images: any[], currentIndex: number, onClose: () => void, onChangeIndex: (i: number) => void }) => {
    if (currentIndex < 0) return null;
    const current = images[currentIndex];

    return (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col justify-center animate-in fade-in">
            <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-gray-300 p-2"><X size={32} /></button>
            <div className="flex-1 flex items-center justify-center relative">
                <button onClick={() => onChangeIndex((currentIndex - 1 + images.length) % images.length)} className="absolute left-4 p-4 text-white hover:bg-white/10 rounded-full"><ChevronLeft size={32} /></button>
                <img src={current.url} className="max-h-[80vh] max-w-[90vw] object-contain shadow-2xl" />
                <button onClick={() => onChangeIndex((currentIndex + 1) % images.length)} className="absolute right-4 p-4 text-white hover:bg-white/10 rounded-full"><ChevronRight size={32} /></button>
            </div>
            {current.caption && (
                <div className="text-center text-white pb-8 px-4 font-medium text-lg">
                    {current.caption}
                </div>
            )}
            <div className="flex justify-center gap-2 pb-8">
                {images.map((_, idx) => (
                    <div key={idx} className={`w-2 h-2 rounded-full ${idx === currentIndex ? 'bg-white' : 'bg-white/30'}`}></div>
                ))}
            </div>
        </div>
    );
};

export const ReceiptModal = ({ isOpen, onClose, registration, event, organizer }: { isOpen: boolean, onClose: () => void, registration: Registration, event: Event, organizer?: User }) => {
    if (!isOpen) return null;

    const totalTickets = registration.tickets?.reduce((acc, t) => acc + (t.status === 'refunded' ? 0 : t.quantity), 0) || 0;
    const ticketCost = registration.tickets?.reduce((acc, t) => acc + (t.status === 'refunded' ? 0 : t.pricePerTicket * t.quantity), 0) || 0;
    const addOnCost = registration.addOns?.reduce((acc, a) => acc + (a.price * a.quantity), 0) || 0;

    // Calculate totals
    const subtotal = ticketCost + addOnCost;
    const fees = (registration.serviceFee || 0) + (registration.customFeesAmount || 0);
    const tax = registration.taxAmount || 0;
    const donation = (registration.donationAmount || 0) + (registration.platformDonationAmount || 0);
    const discount = registration.discountAmount || 0;
    const total = Math.max(0, subtotal + fees + tax + donation - discount);
    const refunded = registration.refundedAmount || 0;

    const hasBranding = organizer && (organizer.subscription?.plan === 'pro' || organizer.subscription?.plan === 'premium') && organizer.logoUrl;

    const handleDownloadPDF = async () => {
        const element = document.getElementById('receipt-content');
        if (!element) return;

        // Show loading state if needed, or just run
        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const imgWidth = 210;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`ticket-${registration.id}.pdf`);
        } catch (error) {
            console.error('PDF Generation failed:', error);
            alert('Failed to generate PDF. Please try the Print button instead.');
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in receipt-modal-wrapper">
            <div className="bg-white text-black w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Print Styles */}
                <style>{`
                    @media print {
                        body * { visibility: hidden; }
                        .receipt-modal-wrapper, .receipt-modal-wrapper * { visibility: visible; }
                        .receipt-modal-wrapper { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999; background: white; padding: 0; align-items: flex-start; justify-content: center; }
                        .receipt-modal-wrapper > div { box-shadow: none; max-width: 100%; max-height: none; width: 100%; border-radius: 0; }
                        #receipt-content { padding: 40px; }
                        .no-print { display: none !important; }
                    }
                `}</style>

                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 no-print">
                    <h3 className="font-bold text-lg">Receipt</h3>
                    <div className="flex gap-2">
                        <button onClick={handleDownloadPDF} className="p-2 hover:bg-gray-200 rounded-full" title="Download PDF">
                            <Download size={20} />
                        </button>
                        <button onClick={handlePrint} className="p-2 hover:bg-gray-200 rounded-full" title="Print">
                            <Printer size={20} />
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div id="receipt-content" className="p-8 overflow-y-auto flex-1 bg-white">
                    <div className="text-center mb-8">
                        {/* BRANDING HEADER */}
                        {hasBranding ? (
                            <div className="mb-4 flex flex-col items-center">
                                <img src={organizer!.logoUrl} alt="Logo" className="h-16 w-auto object-contain mb-2" />
                                {organizer!.socials?.website && <a href={organizer!.socials.website} className="text-xs text-gray-500 no-underline">{organizer!.socials.website}</a>}
                            </div>
                        ) : (
                            <div className="mb-4 text-center">
                                <div className="text-xl font-bold font-display tracking-tight text-black mb-1">
                                    Open<span className="text-pink-500">Ticket</span>
                                </div>
                                <div className="text-xs text-gray-400">openticket.com</div>
                            </div>
                        )}

                        <div className="text-sm font-bold uppercase text-gray-500 tracking-widest mb-1">Receipt</div>
                        <h2 className="text-2xl font-black">{event.title}</h2>
                        <div className="text-sm text-gray-600 mt-1">
                            {new Date(registration.timestamp).toLocaleDateString()} • {new Date(registration.timestamp).toLocaleTimeString()}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="border-t border-b border-gray-200 py-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Order ID</span>
                                <span className="font-mono font-bold">#{registration.id.slice(-8).toUpperCase()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Customer</span>
                                <span className="font-bold">{registration.attendeeName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Email</span>
                                <span>{registration.attendeeEmail}</span>
                            </div>
                        </div>

                        <div>
                            <div className="text-xs font-bold uppercase text-gray-400 mb-2">Items</div>
                            <div className="space-y-2 text-sm">
                                {registration.tickets?.map((t, i) => (
                                    <div key={i} className="flex justify-between">
                                        <div className={t.status === 'refunded' ? 'line-through text-gray-400' : ''}>
                                            <span className="font-bold">{t.quantity}x</span> {t.name}
                                        </div>
                                        <div className={t.status === 'refunded' ? 'line-through text-gray-400' : ''}>
                                            ${(t.pricePerTicket * t.quantity).toFixed(2)}
                                        </div>
                                    </div>
                                ))}
                                {registration.addOns?.map((a, i) => (
                                    <div key={`addon-${i}`} className="flex justify-between">
                                        <div>
                                            <span className="font-bold">{a.quantity}x</span> {a.name}
                                        </div>
                                        <div>${(a.price * a.quantity).toFixed(2)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="border-t border-gray-200 pt-4 space-y-2 text-sm">
                            <div className="flex justify-between text-gray-600">
                                <span>Subtotal</span>
                                <span>${subtotal.toFixed(2)}</span>
                            </div>
                            {fees > 0 && (
                                <div className="flex justify-between text-gray-600">
                                    <span>Fees</span>
                                    <span>${fees.toFixed(2)}</span>
                                </div>
                            )}
                            {tax > 0 && (
                                <div className="flex justify-between text-gray-600">
                                    <span>Tax</span>
                                    <span>${tax.toFixed(2)}</span>
                                </div>
                            )}
                            {donation > 0 && (
                                <div className="flex justify-between text-gray-600">
                                    <span>Donation</span>
                                    <span>${donation.toFixed(2)}</span>
                                </div>
                            )}
                            {discount > 0 && (
                                <div className="flex justify-between text-green-600">
                                    <span>Discount</span>
                                    <span>-${discount.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-xl font-black pt-2 border-t border-gray-200 mt-2">
                                <span>Total</span>
                                <span>${total.toFixed(2)}</span>
                            </div>
                            {refunded > 0 && (
                                <div className="flex justify-between text-red-600 font-bold">
                                    <span>Refunded</span>
                                    <span>-${refunded.toFixed(2)}</span>
                                </div>
                            )}
                        </div>

                        <div className="text-center pt-8 text-xs text-gray-400">
                            <p>Thank you for your purchase.</p>
                            <p className="mt-1">Organized by {event.organizer}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const ErrorModal = ({ isOpen, onClose, title = "Action Required", message, actionLabel = "I understand and will fix this" }: { isOpen: boolean, onClose: () => void, title?: string, message: string, actionLabel?: string }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center text-red-600 dark:text-red-500 shrink-0">
                        <AlertCircle size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-zinc-900 dark:text-white leading-none">{title}</h3>
                        <p className="text-xs font-bold text-red-500 uppercase mt-1">Validation Error</p>
                    </div>
                </div>

                <div className="bg-zinc-50 dark:bg-black/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 mb-6 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed font-medium">
                    {message}
                </div>

                <button
                    onClick={onClose}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                >
                    <CheckCircle2 size={18} />
                    {actionLabel}
                </button>
            </div>
        </div>
    );
};

export const PriceDisplay = ({ amount, className = '', showCurrencyCode = true }: { amount: number, className?: string, showCurrencyCode?: boolean }) => {
    const [displayData, setDisplayData] = React.useState({ symbol: '$', converted: amount, currency: 'USD' });

    React.useEffect(() => {
        const getCurrencyData = () => {
            try {
                const pref = localStorage.getItem('openticket_currency');
                const cached = localStorage.getItem('openticket_currency_cache');
                const ratesCache = localStorage.getItem('openticket_exchange_rates');
                let currency = 'USD';
                
                if (pref) {
                    currency = pref;
                } else if (cached) {
                    const data = JSON.parse(cached);
                    currency = data.currency || 'USD';
                }

                // Default rates (updated from backend when available)
                let rates: Record<string, { rate: number; symbol: string }> = {
                    USD: { rate: 1, symbol: '$' },
                    EUR: { rate: 0.92, symbol: '€' },
                    GBP: { rate: 0.79, symbol: '£' },
                    CAD: { rate: 1.36, symbol: 'C$' },
                    AUD: { rate: 1.53, symbol: 'A$' },
                };

                // Use cached rates from backend if available
                if (ratesCache) {
                    try {
                        const ratesData = JSON.parse(ratesCache);
                        if (ratesData.rates) {
                            Object.keys(ratesData.rates).forEach(code => {
                                if (rates[code]) {
                                    rates[code].rate = ratesData.rates[code];
                                }
                            });
                        }
                    } catch {
                        // Use defaults
                    }
                }

                const info = rates[currency] || rates.USD;
                setDisplayData({
                    symbol: info.symbol,
                    converted: amount * info.rate,
                    currency: currency,
                });
            } catch {
                setDisplayData({ symbol: '$', converted: amount, currency: 'USD' });
            }
        };

        getCurrencyData();

        // Listen for currency changes
        const handleStorage = () => getCurrencyData();
        window.addEventListener('storage', handleStorage);
        window.addEventListener('currencyChanged', handleStorage);

        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('currencyChanged', handleStorage);
        };
    }, [amount]);

    if (amount === 0) return <span className={`font-bold ${className}`}>Free</span>;

    // Format with locale-aware number formatting
    try {
        const formatted = new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: displayData.currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(displayData.converted);
        
        return (
            <span className={`font-mono ${className}`}>
                {formatted}
                {showCurrencyCode && <span className="text-xs font-bold text-zinc-500 ml-1">({displayData.currency})</span>}
            </span>
        );
    } catch {
        return (
            <span className={`font-mono ${className}`}>
                {displayData.symbol}{displayData.converted.toFixed(2)}
                {showCurrencyCode && <span className="text-xs font-bold text-zinc-500 ml-1">({displayData.currency})</span>}
            </span>
        );
    }
};

/**
 * EventPriceDisplay - Displays prices in the event's CHARGE currency
 * Use this for event tickets, add-ons, and checkout totals
 * The price shown is the exact price the buyer will be charged
 * 
 * CURRENCY PRIORITY:
 * 1. Event's charge currency (if specified)
 * 2. Backend default currency
 * 3. USD (fallback)
 * 
 * Optionally shows approximate display currency below if user has selected different currency
 */
export const EventPriceDisplay = ({ 
    amount, 
    currency,  // Event's charge currency (optional - will use backend default if not set)
    className = '',
    showCurrencyCode = true,  // Always show currency code by default
    showDisplayCurrency = false,  // Show approximate conversion in user's display currency
}: { 
    amount: number, 
    currency?: string, 
    className?: string,
    showCurrencyCode?: boolean,
    showDisplayCurrency?: boolean,
}) => {
    const [displayData, setDisplayData] = React.useState<{
        chargeCurrency: string;
        displayCurrency: string;
        convertedAmount: number;
        showConversion: boolean;
    } | null>(null);

    React.useEffect(() => {
        // Import CurrencyService dynamically to get charge currency resolution
        const getDisplayData = async () => {
            try {
                const { CurrencyService } = await import('../services/currencyService');
                
                // Get charge currency using priority: event → backend default → USD
                const chargeCurrency = CurrencyService.getChargeCurrency(currency);
                const displayCurrency = CurrencyService.getDisplayCurrency();
                
                // Calculate display conversion if different
                const showConversion = showDisplayCurrency && chargeCurrency !== displayCurrency;
                let convertedAmount = amount;
                
                if (showConversion) {
                    const chargeInfo = CurrencyService.getInfo(chargeCurrency);
                    const displayInfo = CurrencyService.getInfo(displayCurrency);
                    // Convert: charge → USD → display
                    const amountInUsd = chargeInfo.rate !== 0 ? amount / chargeInfo.rate : amount;
                    convertedAmount = amountInUsd * displayInfo.rate;
                }
                
                setDisplayData({
                    chargeCurrency,
                    displayCurrency,
                    convertedAmount,
                    showConversion,
                });
            } catch {
                setDisplayData({
                    chargeCurrency: currency || 'USD',
                    displayCurrency: 'USD',
                    convertedAmount: amount,
                    showConversion: false,
                });
            }
        };

        getDisplayData();
        
        // Listen for currency changes
        const handleCurrencyChange = () => getDisplayData();
        window.addEventListener('storage', handleCurrencyChange);
        window.addEventListener('currencyChanged', handleCurrencyChange);
        
        return () => {
            window.removeEventListener('storage', handleCurrencyChange);
            window.removeEventListener('currencyChanged', handleCurrencyChange);
        };
    }, [amount, currency, showDisplayCurrency]);

    const currencySymbols: Record<string, string> = {
        USD: '$',
        EUR: '€',
        GBP: '£',
        CAD: 'C$',
        AUD: 'A$',
    };

    if (amount === 0) return <span className={`font-bold ${className}`}>Free</span>;
    
    // Use resolved charge currency or fallback
    const chargeCurrency = displayData?.chargeCurrency || currency || 'USD';
    const symbol = currencySymbols[chargeCurrency] || '$';
    const validCurrency = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'].includes(chargeCurrency) ? chargeCurrency : 'USD';

    // Format the charge price
    let formattedPrice: string;
    try {
        formattedPrice = new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: validCurrency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    } catch {
        formattedPrice = `${symbol}${amount.toFixed(2)}`;
    }

    // Format display currency if different
    let displayConversion: string | null = null;
    if (displayData?.showConversion && displayData.displayCurrency !== chargeCurrency) {
        const displaySymbol = currencySymbols[displayData.displayCurrency] || '$';
        try {
            displayConversion = new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: displayData.displayCurrency,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(displayData.convertedAmount);
            displayConversion = `≈ ${displayConversion}`;
        } catch {
            displayConversion = `≈ ${displaySymbol}${displayData.convertedAmount.toFixed(2)}`;
        }
    }

    return (
        <span className={`font-mono ${className}`}>
            <span>{formattedPrice}</span>
            {showCurrencyCode && <span className="text-xs font-bold text-zinc-500 ml-1">({chargeCurrency})</span>}
            {displayConversion && (
                <span className="text-xs text-zinc-400 ml-2">{displayConversion}</span>
            )}
        </span>
    );
};

/**
 * DisplayCurrencySelector - Allows users to switch their display currency
 * This is for UI display only and does NOT affect Stripe charges
 * 
 * The charge currency is always determined by: Event Currency → Backend Default → USD
 * This selector only changes how prices are DISPLAYED to the user
 */
export const DisplayCurrencySelector = ({ 
    className = '',
    compact = false,
    showLabel = true,
}: { 
    className?: string,
    compact?: boolean,
    showLabel?: boolean,
}) => {
    const [displayCurrency, setDisplayCurrency] = React.useState('USD');
    const [isOpen, setIsOpen] = React.useState(false);

    const currencies = [
        { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
        { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
        { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' },
        { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', flag: '🇨🇦' },
        { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺' },
    ];

    React.useEffect(() => {
        // Load saved display currency preference
        const loadCurrency = async () => {
            try {
                const { CurrencyService } = await import('../services/currencyService');
                setDisplayCurrency(CurrencyService.getDisplayCurrency());
            } catch {
                const pref = localStorage.getItem('openticket_currency');
                setDisplayCurrency(pref || 'USD');
            }
        };
        loadCurrency();
    }, []);

    const handleCurrencyChange = async (newCurrency: string) => {
        setDisplayCurrency(newCurrency);
        setIsOpen(false);
        
        try {
            const { CurrencyService } = await import('../services/currencyService');
            CurrencyService.setDisplayCurrency(newCurrency);
        } catch {
            localStorage.setItem('openticket_currency', newCurrency);
        }
        
        // Dispatch event to trigger re-renders in price display components
        window.dispatchEvent(new Event('currencyChanged'));
    };

    const currentCurrency = currencies.find(c => c.code === displayCurrency) || currencies[0];

    if (compact) {
        return (
            <div className={`relative ${className}`}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                >
                    <span>{currentCurrency.flag}</span>
                    <span>{currentCurrency.code}</span>
                    <ChevronDown size={12} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isOpen && (
                    <div className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl z-50 min-w-[140px] overflow-hidden">
                        {currencies.map(currency => (
                            <button
                                key={currency.code}
                                onClick={() => handleCurrencyChange(currency.code)}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${displayCurrency === currency.code ? 'bg-primary/10 text-primary font-bold' : ''}`}
                            >
                                <span>{currency.flag}</span>
                                <span>{currency.code}</span>
                                {displayCurrency === currency.code && <Check size={12} className="ml-auto" />}
                            </button>
                        ))}
                        <div className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                            <p className="text-[10px] text-zinc-500">Display only. Payment uses event currency.</p>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={`${className}`}>
            {showLabel && (
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-2">
                    Display Currency
                </label>
            )}
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-colors border border-zinc-200 dark:border-zinc-700"
                >
                    <span className="flex items-center gap-2">
                        <span className="text-lg">{currentCurrency.flag}</span>
                        <span className="font-bold">{currentCurrency.code}</span>
                        <span className="text-zinc-500 text-sm">({currentCurrency.symbol})</span>
                    </span>
                    <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                        {currencies.map(currency => (
                            <button
                                key={currency.code}
                                onClick={() => handleCurrencyChange(currency.code)}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${displayCurrency === currency.code ? 'bg-primary/10' : ''}`}
                            >
                                <span className="text-lg">{currency.flag}</span>
                                <div className="flex-1">
                                    <span className="font-bold">{currency.code}</span>
                                    <span className="text-zinc-500 text-sm ml-2">{currency.name}</span>
                                </div>
                                {displayCurrency === currency.code && <Check size={16} className="text-primary" />}
                            </button>
                        ))}
                        <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-700 bg-amber-50 dark:bg-amber-900/20">
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                                ⚠️ This changes display only. Actual payments are charged in the event's currency.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
