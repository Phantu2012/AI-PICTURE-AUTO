import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, Modality } from '@google/genai';
import Papa from 'papaparse';
import JSZip from 'jszip';
import { AspectRatio, CsvRow, ImageResult, ApiKeys, Provider } from '../types';
import { UploadIcon, GenerateIcon, DownloadIcon, KeyIcon, TuneIcon, ClockIcon, ShieldIcon, AnonymizeIcon } from './icons';
import ImageCard from './ImageCard';
import EditModal from './EditModal';
import ViewKeysModal from './ViewKeysModal';

interface ImageGeneratorProps {
    apiKeys: ApiKeys;
    onClearAllKeys: () => void;
    onAddKeys: (keys: string, provider: Provider) => void;
    onRemoveKey: (key: string, provider: Provider) => void;
}

const MODELS = {
    'openai-dalle3': { provider: 'openai', name: 'OpenAI - DALL·E 3' },
    'google-imagen-4': { provider: 'google', name: 'Google - Imagen 4' },
    'google-gemini-flash-image': { provider: 'google', name: 'Google - Gemini Flash Image' },
    'openai-dalle2': { provider: 'openai', name: 'OpenAI - DALL·E 2' },
};

type SafetyLevel = 'default' | 'lenient' | 'none';

const SAFETY_SETTINGS_CONFIG: Record<Exclude<SafetyLevel, 'default'>, Array<{category: HarmCategory, threshold: HarmBlockThreshold}>> = {
  lenient: [
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ],
  none: [
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ]
};


const maskKey = (key: string) => {
    if (!key || key.length <= 8) return '****';
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
};

const ImageGenerator: React.FC<ImageGeneratorProps> = ({ apiKeys, onClearAllKeys, onAddKeys, onRemoveKey }) => {
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
    const [prompts, setPrompts] = useState<CsvRow[]>([]);
    const [results, setResults] = useState<ImageResult[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [fileName, setFileName] = useState<string>('');
    const [editingResult, setEditingResult] = useState<ImageResult | null>(null);
    const [concurrencyLimit, setConcurrencyLimit] = useState(1);
    const [requestDelay, setRequestDelay] = useState(1000);
    const [isViewKeysModalOpen, setIsViewKeysModalOpen] = useState(false);
    const [safetyLevel, setSafetyLevel] = useState<SafetyLevel>('none');
    
    const [startId, setStartId] = useState<string>('');
    const [endId, setEndId] = useState<string>('');
    
    const [selectedModel, setSelectedModel] = useState<keyof typeof MODELS>('openai-dalle3');
    const [activeKeyIndices, setActiveKeyIndices] = useState({ google: 0, openai: 0 });
    const [isManualKeySelection, setIsManualKeySelection] = useState(false);
    const [anonymizePrompts, setAnonymizePrompts] = useState(true);

    const [inputMode, setInputMode] = useState<'csv' | 'text'>('csv');
    const [textInput, setTextInput] = useState('');

    const googleInstances = useMemo(() => apiKeys.google.map(key => new GoogleGenAI({ apiKey: key })), [apiKeys.google]);
    const googleKeyIndex = useRef(0);
    const openaiKeyIndex = useRef(0);

    const activeProvider = MODELS[selectedModel].provider as Provider;
    const activeKeys = apiKeys[activeProvider];
    const activeKeyIndex = activeKeyIndices[activeProvider];

    useEffect(() => {
        // Reset aspect ratio if not supported by the new model
        if ((selectedModel === 'openai-dalle2' || selectedModel === 'google-gemini-flash-image') && aspectRatio !== AspectRatio.SQUARE) {
            setAspectRatio(AspectRatio.SQUARE);
        }
    }, [selectedModel, aspectRatio]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setTextInput('');
            setFileName(file.name);
            setResults([]);
            setPrompts([]);
            Papa.parse(file, {
                skipEmptyLines: true,
                complete: (result: any) => {
                    const parsedPrompts: CsvRow[] = result.data
                        .map((row: any) => ({ id: row[0]?.trim(), prompt: row[1]?.trim() }))
                        .filter((p: CsvRow) => p.id && p.prompt && !isNaN(parseInt(p.id, 10)));
                    setPrompts(parsedPrompts);
                    if (parsedPrompts.length > 0) {
                        setStartId(parsedPrompts[0].id);
                        setEndId(parsedPrompts[parsedPrompts.length - 1].id);
                    } else {
                        setStartId('');
                        setEndId('');
                    }
                },
                error: (error: Error) => {
                    alert(`Error parsing CSV file: ${error.message}`);
                    setFileName('');
                }
            });
        }
    };

    const handleTextInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = event.target.value;
        setTextInput(text);
        setFileName('');
        setResults([]);
    
        Papa.parse(text, {
            skipEmptyLines: true,
            complete: (result: { data: string[][] }) => {
                const parsedPrompts: CsvRow[] = result.data
                    .map((row: string[]) => {
                        if (!row || row.length < 2) return null;
                        const id = row[0]?.trim();
                        // Join all subsequent columns to form the full prompt, handling commas in prompts
                        const prompt = row.slice(1).join(',').trim();
                        return { id, prompt };
                    })
                    .filter((p): p is CsvRow => !!p && !!p.id && !!p.prompt && !isNaN(parseInt(p.id, 10)));
                
                setPrompts(parsedPrompts);
                
                if (parsedPrompts.length > 0) {
                    setStartId(parsedPrompts[0].id);
                    setEndId(parsedPrompts[parsedPrompts.length - 1].id);
                } else {
                    setStartId('');
                    setEndId('');
                }
            },
            error: (error: Error) => {
                console.error(`Error parsing text input: ${error.message}`);
            }
        });
    };
    
    const anonymizePrompt = async (prompt: string, aiInstance: GoogleGenAI): Promise<string> => {
        if (!aiInstance) return prompt;
    
        try {
            const systemInstruction = `You are a prompt sanitization expert. Your task is to identify names of real, famous people (celebrities, politicians, historical figures, etc.) in the user's prompt and replace them with a generic, non-famous, fictional first name (like Alex, Jordan, Casey).
- Replace each unique famous name consistently with the same fictional name.
- Do not change any other part of the prompt.
- If no famous names are found, return the original prompt.
- Your output must be ONLY the modified (or original) prompt as a single line of text, with no extra formatting, explanation, or labels.

Example 1:
User: "A photo of Barack Obama playing basketball."
You: "A photo of Alex playing basketball."

Example 2:
User: "Impressionist painting of a cat sleeping on a windowsill."
You: "Impressionist painting of a cat sleeping on a windowsill."

Example 3:
User: "Taylor Swift and Travis Kelce on a date at a pizzeria."
You: "Jordan and Casey on a date at a pizzeria."`;

            const response = await aiInstance.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    systemInstruction: systemInstruction,
                    temperature: 0.2,
                },
            });
    
            const anonymizedText = response.text.trim();
            if (anonymizedText) {
                console.log(`Anonymized prompt: "${prompt}" -> "${anonymizedText}"`);
                return anonymizedText;
            }
            return prompt;
        } catch (error) {
            console.error("Prompt anonymization failed:", error);
            return prompt; // Fallback to original prompt on error
        }
    };

    const generateSingleImage = useCallback(async (
        resultToGenerate: ImageResult,
        attempt = 0
    ): Promise<ImageResult> => {
        const currentProvider = MODELS[selectedModel].provider as Provider;
        const keysForProvider = apiKeys[currentProvider];
        if (keysForProvider.length === 0) {
            return { ...resultToGenerate, status: 'error', error: `No API keys provided for ${currentProvider}.` };
        }

        let promptForApi = resultToGenerate.prompt;
        if (anonymizePrompts && apiKeys.google.length > 0) {
            const googleAiInstance = googleInstances[googleKeyIndex.current];
            if (googleAiInstance) {
                promptForApi = await anonymizePrompt(promptForApi, googleAiInstance);
            }
        }

        const handleError = (error: any, provider: Provider): string => {
            console.error(`[${provider}] Image generation error:`, error);
            if (provider === 'google') {
                if (typeof error === 'object' && error !== null) {
                    if (error.error?.message) return error.error.message;
                    if (typeof error.message === 'string') {
                        try {
                            const parsedError = JSON.parse(error.message);
                            return parsedError.error?.message || error.message;
                        } catch (e) { return error.message; }
                    }
                }
            } else if (provider === 'openai') {
                 if (error?.error?.message) {
                    return `OpenAI Error: ${error.error.message}`;
                }
            }
            return error.message || 'An unknown error occurred';
        };

        const keyIndexRef = currentProvider === 'google' ? googleKeyIndex : openaiKeyIndex;
        let keyIndexToTry: number;
        
        if (isManualKeySelection) {
            if (attempt > 0) {
                 return { ...resultToGenerate, status: 'error', error: 'The manually selected API key is rate-limited or invalid.' };
            }
            keyIndexToTry = activeKeyIndices[currentProvider];
        } else {
            if (attempt >= keysForProvider.length) {
                return { ...resultToGenerate, status: 'error', error: 'All API keys are rate-limited or invalid.' };
            }
            keyIndexToTry = (keyIndexRef.current + attempt) % keysForProvider.length;
        }

        try {
            let imageUrl: string;
            if (currentProvider === 'google') {
                const ai = googleInstances[keyIndexToTry];
                if (!ai) throw new Error("Google AI instance not found");

                const safetySettings = safetyLevel === 'default' ? undefined : SAFETY_SETTINGS_CONFIG[safetyLevel];
                
                if (selectedModel === 'google-imagen-4') {
                    const response = await ai.models.generateImages({
                        model: 'imagen-4.0-generate-001',
                        prompt: promptForApi,
                        config: {
                          numberOfImages: 1,
                          outputMimeType: 'image/jpeg',
                          aspectRatio: aspectRatio,
                        },
                        safetySettings,
                    });
                    
                    const base64ImageBytes: string | undefined = response.generatedImages?.[0]?.image?.imageBytes;
                    
                    if (!base64ImageBytes) {
                        let errorMessage = 'No image was returned from the API. This is often caused by safety filters. Try rewriting the prompt.';
                        throw new Error(errorMessage);
                    }
                    
                    imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
                } else if (selectedModel === 'google-gemini-flash-image') {
                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash-image',
                        contents: {
                            parts: [{ text: promptForApi }],
                        },
                        config: {
                            responseModalities: [Modality.IMAGE],
                        },
                        safetySettings,
                    });
        
                    const part = response.candidates?.[0]?.content?.parts?.find(p => !!p.inlineData);
                    const base64ImageBytes = part?.inlineData?.data;
        
                    if (!base64ImageBytes) {
                        let errorMessage = 'No image was returned from the API. This is often caused by safety filters. Try rewriting the prompt.';
                        throw new Error(errorMessage);
                    }
                    imageUrl = `data:image/png;base64,${base64ImageBytes}`;
                } else {
                     throw new Error(`Unsupported Google model: ${selectedModel}`);
                }
            } else { // OpenAI
                const apiKey = keysForProvider[keyIndexToTry];
                const model = selectedModel === 'openai-dalle3' ? 'dall-e-3' : 'dall-e-2';
                const size = model === 'dall-e-3' 
                    ? { '1:1': '1024x1024', '16:9': '1792x1024', '9:16': '1024x1792' }[aspectRatio]
                    : '1024x1024';

                const response = await fetch('https://api.openai.com/v1/images/generations', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model,
                        prompt: promptForApi,
                        n: 1,
                        size,
                        response_format: 'b64_json',
                    }),
                });

                const data = await response.json();
                if (!response.ok) throw data;
                
                const b64Json = data.data?.[0]?.b64_json;
                if (!b64Json) {
                    throw new Error('Generation failed: No image data returned from OpenAI API.');
                }
                imageUrl = `data:image/png;base64,${b64Json}`;
            }
            
            if (!isManualKeySelection) {
                keyIndexRef.current = keyIndexToTry;
                setActiveKeyIndices(prev => ({...prev, [currentProvider]: keyIndexToTry}));
            }
            return { ...resultToGenerate, imageUrl, status: 'success', error: undefined };

        } catch (error: any) {
            const isRateLimitError = (
                (error?.error?.code === 429 || error?.error?.code === 'rate_limit_exceeded') ||
                (error?.error?.status === 'RESOURCE_EXHAUSTED') ||
                JSON.stringify(error).includes('quota exceeded') ||
                JSON.stringify(error).includes('billed users')
            );
            
            if (isRateLimitError && !isManualKeySelection) {
                 console.warn(`API key at index ${keyIndexToTry} for ${currentProvider} failed. Trying next key...`);
                 return generateSingleImage(resultToGenerate, attempt + 1);
            }
            
            const errorMessage = handleError(error, currentProvider);
            return { ...resultToGenerate, status: 'error', error: errorMessage };
        }
    }, [selectedModel, apiKeys, aspectRatio, isManualKeySelection, activeKeyIndices, googleInstances, safetyLevel, anonymizePrompts]);

    const handleStartGeneration = async () => {
        if (prompts.length === 0) return alert("Please upload a valid CSV file or paste data first.");
        if (activeKeys.length === 0) return alert(`Please add at least one API key for ${activeProvider}.`);
        
        let promptsToGenerate = [...prompts];
        const startNum = parseInt(startId, 10);
        const endNum = parseInt(endId, 10);

        if (startId.trim() !== '' || endId.trim() !== '') {
            if (isNaN(startNum) || isNaN(endNum) || startNum > endNum) {
                return alert("Please provide a valid start and end ID for the generation range.");
            }
            promptsToGenerate = prompts.filter(p => {
                const pNum = parseInt(p.id, 10);
                return pNum >= startNum && pNum <= endNum;
            });

            if (promptsToGenerate.length === 0) {
                 return alert(`No prompts found in the specified range: ${startNum} - ${endNum}.`);
            }
        }

        setIsGenerating(true);
        setProgress({ current: 0, total: promptsToGenerate.length });
        
        if(isManualKeySelection) {
            if (activeProvider === 'google') googleKeyIndex.current = activeKeyIndex;
            else openaiKeyIndex.current = activeKeyIndex;
        }

        const initialResults: ImageResult[] = promptsToGenerate.map(p => ({ ...p, imageUrl: null, status: 'pending' }));
        setResults(initialResults);

        const queue = [...initialResults];
        const processQueue = async () => {
            const workers = Array(concurrencyLimit).fill(null).map(async () => {
                while (queue.length > 0) {
                    const item = queue.shift();
                    if (!item) continue;
                    
                    setResults(prev => prev.map(r => r.id === item.id ? { ...r, status: 'generating' } : r));
                    const updatedResult = await generateSingleImage(item);
                    setResults(prev => prev.map(r => r.id === item.id ? updatedResult : r));
                    setProgress(prev => ({ ...prev, current: prev.current + 1 }));

                    if (queue.length > 0 && requestDelay > 0) {
                        await new Promise(resolve => setTimeout(resolve, requestDelay));
                    }
                }
            });
            await Promise.all(workers);
        };

        await processQueue();
        setIsGenerating(false);
    };

    const handleRetry = async (resultId: string) => {
        const resultIndex = results.findIndex(r => r.id === resultId);
        if (resultIndex === -1) return;
        
        if (isManualKeySelection) {
            const keyIndexRef = activeProvider === 'google' ? googleKeyIndex : openaiKeyIndex;
            keyIndexRef.current = activeKeyIndex;
        }

        setResults(prev => prev.map((r, i) => i === resultIndex ? { ...r, status: 'generating', error: undefined } : r));
        const updatedResult = await generateSingleImage(results[resultIndex]);
        setResults(prev => prev.map((r, i) => i === resultIndex ? updatedResult : r));
    };
    
    const handleEditAndSave = async (resultId: string, newPrompt: string) => {
        const resultIndex = results.findIndex(r => r.id === resultId);
        if (resultIndex === -1) return;
        
        if (isManualKeySelection) {
             const keyIndexRef = activeProvider === 'google' ? googleKeyIndex : openaiKeyIndex;
            keyIndexRef.current = activeKeyIndex;
        }
        
        const resultToUpdate = { ...results[resultIndex], prompt: newPrompt };
        setResults(prev => prev.map((r, i) => i === resultIndex ? { ...r, prompt: newPrompt, status: 'generating', error: undefined } : r));
        setEditingResult(null);

        const updatedResult = await generateSingleImage(resultToUpdate);
        setResults(prev => prev.map((r, i) => i === resultIndex ? updatedResult : r));
    };

    const handleDownloadAll = async () => {
        const zip = new JSZip();
        const successfulResults = results.filter(r => r.status === 'success' && r.imageUrl);
        if (successfulResults.length === 0) return alert("No successful images to download.");
        
        successfulResults.forEach(result => {
            const imgData = result.imageUrl!.split(',')[1];
            zip.file(`${result.id}.png`, imgData, { base64: true });
        });

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = 'ai-generated-images.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const handleSelectKey = (index: number) => {
        setActiveKeyIndices(prev => ({...prev, [activeProvider]: index}));
        setIsManualKeySelection(true);
    };

    const successfulGenerations = results.filter(r => r.status === 'success').length;

    return (
        <div className="container mx-auto p-4 md:p-8">
            <header className="flex justify-between items-center mb-8 flex-wrap gap-4">
                <h1 className="text-4xl font-bold text-white">PromptFlow</h1>
                 <div className="flex items-center gap-2">
                     <button 
                        onClick={() => setIsViewKeysModalOpen(true)}
                        className="flex items-center gap-3 px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                        title="Manage API Keys"
                    >
                        <KeyIcon className="w-4 h-4" />
                        <div className="text-left">
                            <span className="font-mono text-xs">{maskKey(activeKeys[activeKeyIndex]) || 'No Key Selected'}</span>
                            <div className={`text-xs ${isManualKeySelection ? 'text-indigo-400' : 'text-gray-400'}`}>{isManualKeySelection ? 'Manual Mode' : 'Auto-Rotation'}</div>
                        </div>
                    </button>
                    <button 
                      onClick={onClearAllKeys} 
                      className="px-4 py-2 text-sm bg-red-800 hover:bg-red-700 rounded-lg transition-colors"
                      title="Clear all API Keys and Sign Out"
                    >
                        Reset All Keys
                    </button>
                </div>
            </header>

            <main>
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 md:p-8 mb-8 shadow-lg">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                         <div className="flex flex-col gap-3">
                            <h3 className="font-semibold text-lg text-white">1. Select Model</h3>
                             <select
                                value={selectedModel}
                                onChange={e => setSelectedModel(e.target.value as keyof typeof MODELS)}
                                disabled={isGenerating}
                                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                {Object.entries(MODELS).map(([key, { name }]) => (
                                    <option key={key} value={key}>{name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-3">
                            <h3 className="font-semibold text-lg text-white">2. Aspect Ratio</h3>
                            <div className="flex gap-2">
                                {(Object.values(AspectRatio) as Array<AspectRatio>).map(ratio => {
                                    const isUnsupportedModel = selectedModel === 'openai-dalle2' || selectedModel === 'google-gemini-flash-image';
                                    const isUnsupported = isUnsupportedModel && ratio !== '1:1';
                                    const title = isUnsupported ? 'This model only supports 1:1 ratio' : '';
                                    return (
                                        <button
                                            key={ratio}
                                            onClick={() => setAspectRatio(ratio)}
                                            disabled={isGenerating || isUnsupported}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors w-full ${aspectRatio === ratio ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                            title={title}
                                        >
                                            {ratio}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex flex-col gap-3">
                            <h3 className="font-semibold text-lg text-white">3. Upload Prompts</h3>
                            <div className="flex border-b border-gray-700">
                                <button 
                                    onClick={() => setInputMode('csv')} 
                                    disabled={isGenerating}
                                    className={`px-4 py-2 text-sm font-medium transition-colors ${inputMode === 'csv' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-white'} disabled:cursor-not-allowed`}
                                >
                                    Upload CSV
                                </button>
                                <button 
                                    onClick={() => setInputMode('text')} 
                                    disabled={isGenerating}
                                    className={`px-4 py-2 text-sm font-medium transition-colors ${inputMode === 'text' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-white'} disabled:cursor-not-allowed`}
                                >
                                    Paste Text
                                </button>
                            </div>

                            {inputMode === 'csv' && (
                                <div className="pt-2">
                                    <label htmlFor="csv-upload" className={`flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg transition-colors ${isGenerating ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600 text-gray-300 cursor-pointer'}`}>
                                        <UploadIcon className="w-5 h-5" />
                                        <span>{fileName || 'Upload CSV File'}</span>
                                    </label>
                                    <input id="csv-upload" type="file" accept=".csv" className="hidden" onChange={handleFileChange} disabled={isGenerating} />
                                </div>
                            )}
                            
                            {inputMode === 'text' && (
                                <div className="pt-2">
                                    <textarea
                                        value={textInput}
                                        onChange={handleTextInputChange}
                                        disabled={isGenerating}
                                        rows={5}
                                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-200 resize-y font-mono"
                                        placeholder="Paste your data here, one per line, e.g.,&#10;1,A photo of a cat&#10;2,A drawing of a dog"
                                    />
                                </div>
                            )}
                        </div>
                        
                        <div className="flex flex-col gap-3 md:col-span-3">
                            <h3 className="font-semibold text-lg text-white">4. Generation Range <span className="text-gray-400 font-normal">(Optional)</span></h3>
                            <div className="grid grid-cols-2 gap-4">
                                <input type="number" placeholder="Start ID" value={startId} onChange={(e) => setStartId(e.target.value)} disabled={isGenerating} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg" />
                                <input type="number" placeholder="End ID" value={endId} onChange={(e) => setEndId(e.target.value)} disabled={isGenerating} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg" />
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 md:col-span-3 lg:mt-4">
                           <button onClick={handleStartGeneration} disabled={isGenerating || prompts.length === 0 || activeKeys.length === 0} className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold transition-colors disabled:bg-green-800 disabled:text-gray-400 disabled:cursor-not-allowed">
                                <GenerateIcon className="w-5 h-5" />
                                <span>{isGenerating ? 'Generating...' : `Start Generating with ${MODELS[selectedModel].name}`}</span>
                            </button>
                        </div>

                        <div className="md:col-span-3 border-t border-gray-700 mt-4 pt-6">
                            <h3 className="font-semibold text-lg text-white mb-4 text-center md:text-left">Advanced Settings</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                <div className="flex flex-col gap-2">
                                    <label htmlFor="concurrency" className="flex items-center gap-2 text-sm"><TuneIcon className="w-5 h-5" /> Concurrent Tasks: <span className="font-bold">{concurrencyLimit}</span></label>
                                    <input id="concurrency" type="range" min="1" max="5" value={concurrencyLimit} onChange={(e) => setConcurrencyLimit(Number(e.target.value))} disabled={isGenerating} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label htmlFor="delay" className="flex items-center gap-2 text-sm"><ClockIcon className="w-5 h-5" /> Request Delay: <span className="font-bold">{(requestDelay / 1000).toFixed(1)}s</span></label>
                                    <input id="delay" type="range" min="0" max="5000" step="100" value={requestDelay} onChange={(e) => setRequestDelay(Number(e.target.value))} disabled={isGenerating} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label htmlFor="safety" className="flex items-center gap-2 text-sm"><ShieldIcon className="w-5 h-5" /> Safety Filtering (Google AI)</label>
                                    <select 
                                        id="safety" 
                                        value={safetyLevel} 
                                        onChange={(e) => setSafetyLevel(e.target.value as SafetyLevel)}
                                        disabled={isGenerating || MODELS[selectedModel].provider !== 'google'} 
                                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title={MODELS[selectedModel].provider !== 'google' ? 'This setting is only available for Google AI models.' : ''}
                                    >
                                        <option value="default">Standard (Default)</option>
                                        <option value="lenient">Lenient</option>
                                        <option value="none">Permissive (Block None)</option>
                                    </select>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="flex items-center gap-2 text-sm"><AnonymizeIcon className="w-5 h-5" /> Anonymize Prompts</label>
                                    <div className="flex items-center">
                                        <button
                                            type="button"
                                            className={`${
                                                anonymizePrompts ? 'bg-indigo-600' : 'bg-gray-600'
                                            } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed`}
                                            role="switch"
                                            aria-checked={anonymizePrompts}
                                            onClick={() => setAnonymizePrompts(!anonymizePrompts)}
                                            disabled={isGenerating || apiKeys.google.length === 0}
                                            title={apiKeys.google.length === 0 ? "Requires a Google AI key to be added." : "Automatically replaces names of famous people with generic names to improve safety compliance."}
                                        >
                                            <span
                                                aria-hidden="true"
                                                className={`${
                                                    anonymizePrompts ? 'translate-x-5' : 'translate-x-0'
                                                } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                                            />
                                        </button>
                                        <span className="ml-3 text-xs text-gray-400">
                                            {apiKeys.google.length === 0 ? "Requires Google AI Key" : (anonymizePrompts ? "Enabled" : "Disabled")}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {(isGenerating || results.length > 0) && (
                    <div className="mb-8">
                        {isGenerating && (
                            <div className="bg-gray-800 p-4 rounded-lg">
                                <p className="text-center mb-2">{`Generating image... ${progress.current}/${progress.total}`}</p>
                                <div className="w-full bg-gray-700 rounded-full h-2.5"><div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}></div></div>
                            </div>
                        )}
                        {!isGenerating && results.length > 0 && (
                            <div className="flex justify-between items-center bg-gray-800/50 p-4 rounded-lg">
                                <p>{`Generation complete. ${successfulGenerations} / ${results.length} images created.`}</p>
                                <button onClick={handleDownloadAll} disabled={successfulGenerations === 0} className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800">
                                    <DownloadIcon className="w-5 h-5" /><span>Download All (.zip)</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {results.map(result => <ImageCard key={result.id} result={result} onRetry={handleRetry} onEdit={() => setEditingResult(result)} />)}
                </div>

                {editingResult && <EditModal result={editingResult} onClose={() => setEditingResult(null)} onSave={handleEditAndSave} />}
                {isViewKeysModalOpen && <ViewKeysModal provider={activeProvider} keys={activeKeys} onClose={() => setIsViewKeysModalOpen(false)} onRemoveKey={(key) => onRemoveKey(key, activeProvider)} onAddKeys={(newKeys) => { onAddKeys(newKeys, activeProvider); }} activeKeyIndex={activeKeyIndex} isManualSelection={isManualKeySelection} onSelectKey={handleSelectKey} onSetAutomatic={() => setIsManualKeySelection(false)} />}
            </main>
        </div>
    );
};

export default ImageGenerator;