import React, { useState, useCallback, useMemo, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import Papa from 'papaparse';
import JSZip from 'jszip';
import { AspectRatio, CsvRow, ImageResult, GenerationStatus } from '../types';
import { UploadIcon, GenerateIcon, DownloadIcon, KeyIcon, TuneIcon, ClockIcon, TargetIcon } from './icons';
import ImageCard from './ImageCard';
import EditModal from './EditModal';
import AddKeysModal from './AddKeysModal';
import ViewKeysModal from './ViewKeysModal';

interface ImageGeneratorProps {
    apiKeys: string[];
    onClearKey: () => void;
    onAddKeys: (keys: string) => void;
    onRemoveKey: (key: string) => void;
}

const maskKey = (key: string) => {
    if (!key || key.length <= 8) return '****';
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
};

const ImageGenerator: React.FC<ImageGeneratorProps> = ({ apiKeys, onClearKey, onAddKeys, onRemoveKey }) => {
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
    const [prompts, setPrompts] = useState<CsvRow[]>([]);
    const [results, setResults] = useState<ImageResult[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [fileName, setFileName] = useState<string>('');
    const [editingResult, setEditingResult] = useState<ImageResult | null>(null);
    const [concurrencyLimit, setConcurrencyLimit] = useState(1);
    const [requestDelay, setRequestDelay] = useState(1000); // 1 second default delay
    const [isAddKeysModalOpen, setIsAddKeysModalOpen] = useState(false);
    const [isViewKeysModalOpen, setIsViewKeysModalOpen] = useState(false);
    
    // New state for range and key selection
    const [startId, setStartId] = useState<string>('');
    const [endId, setEndId] = useState<string>('');
    const [activeKeyIndex, setActiveKeyIndex] = useState(0);
    const [isManualKeySelection, setIsManualKeySelection] = useState(false);

    const aiInstances = useMemo(() => apiKeys.map(key => new GoogleGenAI({ apiKey: key })), [apiKeys]);
    const currentKeyIndex = useRef(0);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setFileName(file.name);
            setResults([]);
            setPrompts([]);
            Papa.parse(file, {
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
    
    const generateSingleImage = useCallback(async (
        resultToGenerate: ImageResult,
        attempt = 0 
    ): Promise<ImageResult> => {
        if (aiInstances.length === 0) {
            return { ...resultToGenerate, imageUrl: null, status: 'error', error: 'No API keys provided.' };
        }

        const handleError = (error: any): string => {
            console.error('Image generation error:', error);
            let errorMessage = 'An unknown error occurred';
            if (typeof error === 'object' && error !== null && 'message' in error) {
                try {
                    const parsedError = JSON.parse(error.message);
                    errorMessage = parsedError.error?.message || error.message;
                } catch (e) {
                    errorMessage = error.message;
                }
            }
            return errorMessage;
        };
        
        if (isManualKeySelection) {
            // Manual mode: only use the selected key. No retries with other keys.
            if (attempt > 0) {
                return { ...resultToGenerate, imageUrl: null, status: 'error', error: 'The manually selected API key is rate-limited or invalid.' };
            }
            const ai = aiInstances[activeKeyIndex];
            try {
                const response = await ai.models.generateImages({
                    model: 'imagen-4.0-generate-001',
                    prompt: resultToGenerate.prompt,
                    config: { numberOfImages: 1, outputMimeType: 'image/jpeg', aspectRatio },
                });
                const base64ImageBytes = response.generatedImages[0].image.imageBytes;
                const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
                return { ...resultToGenerate, imageUrl, status: 'success', error: undefined };
            } catch (error: any) {
                const errorMessage = handleError(error);
                return { ...resultToGenerate, imageUrl: null, status: 'error', error: errorMessage };
            }

        } else {
            // Automatic mode: rotate keys on failure
            if (attempt >= aiInstances.length) {
                return { ...resultToGenerate, imageUrl: null, status: 'error', error: 'All API keys are rate-limited or invalid.' };
            }

            const keyIndexToTry = (currentKeyIndex.current + attempt) % aiInstances.length;
            const ai = aiInstances[keyIndexToTry];

            try {
                const response = await ai.models.generateImages({
                    model: 'imagen-4.0-generate-001',
                    prompt: resultToGenerate.prompt,
                    config: { numberOfImages: 1, outputMimeType: 'image/jpeg', aspectRatio },
                });

                currentKeyIndex.current = keyIndexToTry;
                setActiveKeyIndex(keyIndexToTry);
                const base64ImageBytes = response.generatedImages[0].image.imageBytes;
                const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
                return { ...resultToGenerate, imageUrl, status: 'success', error: undefined };

            } catch (error: any) {
                const errorMessageContent = error.message || '';
                if (errorMessageContent && (
                       errorMessageContent.includes('"code":429') ||
                       errorMessageContent.includes('RESOURCE_EXHAUSTED') ||
                       errorMessageContent.includes('quota exceeded')
                   )) {
                    console.warn(`API key at index ${keyIndexToTry} is rate-limited or quota exceeded. Trying next key...`);
                    return generateSingleImage(resultToGenerate, attempt + 1);
                }
                const errorMessage = handleError(error);
                return { ...resultToGenerate, imageUrl: null, status: 'error', error: errorMessage };
            }
        }
    }, [aiInstances, aspectRatio, activeKeyIndex, isManualKeySelection]);


    const handleStartGeneration = async () => {
        if (prompts.length === 0) {
            alert("Please upload a valid CSV file first.");
            return;
        }
        
        let promptsToGenerate = [...prompts];
        const startNum = parseInt(startId, 10);
        const endNum = parseInt(endId, 10);

        if (startId.trim() !== '' || endId.trim() !== '') {
            if (isNaN(startNum) || isNaN(endNum) || startNum > endNum) {
                alert("Please provide a valid start and end ID for the generation range.");
                return;
            }
            promptsToGenerate = prompts.filter(p => {
                const pNum = parseInt(p.id, 10);
                return pNum >= startNum && pNum <= endNum;
            });

            if (promptsToGenerate.length === 0) {
                alert(`No prompts found in the specified range: ${startNum} - ${endNum}. Please check your IDs.`);
                return;
            }
        }

        setIsGenerating(true);
        setProgress({ current: 0, total: promptsToGenerate.length });
        
        if(isManualKeySelection) {
            currentKeyIndex.current = activeKeyIndex;
        }

        const initialResults: ImageResult[] = promptsToGenerate.map(p => ({
            id: p.id,
            prompt: p.prompt,
            imageUrl: null,
            status: 'pending'
        }));
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
            currentKeyIndex.current = activeKeyIndex;
        }

        setResults(prev => prev.map((r, index) => index === resultIndex ? { ...r, status: 'generating', error: undefined } : r));
        
        const updatedResult = await generateSingleImage(results[resultIndex]);

        setResults(prev => prev.map((r, index) => index === resultIndex ? updatedResult : r));
    };
    
    const handleEditAndSave = async (resultId: string, newPrompt: string) => {
        const resultIndex = results.findIndex(r => r.id === resultId);
        if (resultIndex === -1) return;

        if (isManualKeySelection) {
            currentKeyIndex.current = activeKeyIndex;
        }
        
        const resultToUpdate = { ...results[resultIndex], prompt: newPrompt };

        setResults(prev => prev.map((r, index) => index === resultIndex ? { ...r, prompt: newPrompt, status: 'generating', error: undefined } : r));
        setEditingResult(null);

        const updatedResult = await generateSingleImage(resultToUpdate);

        setResults(prev => prev.map((r, index) => index === resultIndex ? updatedResult : r));
    };

    const handleDownloadAll = async () => {
        const zip = new JSZip();
        const successfulResults = results.filter(r => r.status === 'success' && r.imageUrl);

        if (successfulResults.length === 0) {
            alert("No successful images to download.");
            return;
        }

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
        setActiveKeyIndex(index);
        setIsManualKeySelection(true);
    };

    const handleSetAutomatic = () => {
        setIsManualKeySelection(false);
    };


    const successfulGenerations = results.filter(r => r.status === 'success').length;

    return (
        <div className="container mx-auto p-4 md:p-8">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-4xl font-bold text-white">PromptFlow</h1>
                 <div className="flex items-center gap-2">
                     <button 
                        onClick={() => setIsViewKeysModalOpen(true)}
                        className="flex items-center gap-3 px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                        title="View & Manage API Keys"
                    >
                        <KeyIcon className="w-4 h-4" />
                        <div className="text-left">
                            <span className="font-mono text-xs">{maskKey(apiKeys[activeKeyIndex])}</span>
                            <div className={`text-xs ${isManualKeySelection ? 'text-indigo-400' : 'text-gray-400'}`}>{isManualKeySelection ? 'Manual Mode' : 'Auto-Rotation'}</div>
                        </div>
                    </button>
                    <button 
                        onClick={() => setIsAddKeysModalOpen(true)}
                        className="px-4 py-2 text-sm bg-indigo-700 hover:bg-indigo-600 rounded-lg transition-colors"
                        title="Add more API Keys"
                    >
                        + Add Keys
                    </button>
                    <button 
                      onClick={onClearKey} 
                      className="px-4 py-2 text-sm bg-red-800 hover:bg-red-700 rounded-lg transition-colors"
                      title="Clear all API Keys and Sign Out"
                    >
                        Reset All Keys
                    </button>
                </div>
            </header>

            <main>
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 md:p-8 mb-8 shadow-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-start">
                        <div className="flex flex-col gap-3 lg:col-span-1">
                            <h3 className="font-semibold text-lg text-white">1. Aspect Ratio</h3>
                            <div className="flex gap-2">
                                {(Object.values(AspectRatio) as Array<AspectRatio>).map(ratio => (
                                    <button
                                        key={ratio}
                                        onClick={() => setAspectRatio(ratio)}
                                        disabled={isGenerating}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors w-full ${aspectRatio === ratio ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        {ratio}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 lg:col-span-1">
                            <h3 className="font-semibold text-lg text-white">2. Upload Prompts</h3>
                            <label htmlFor="csv-upload" className={`flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg transition-colors ${isGenerating ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-gray-700 hover:bg-gray-600 text-gray-300 cursor-pointer'}`}>
                                <UploadIcon className="w-5 h-5" />
                                <span>{fileName || 'Upload CSV File'}</span>
                            </label>
                            <input id="csv-upload" type="file" accept=".csv" className="hidden" onChange={handleFileChange} disabled={isGenerating} />
                            <p className="text-xs text-gray-500 text-center">CSV format: `ID`, `Prompt`</p>
                        </div>
                        
                        <div className="flex flex-col gap-3 lg:col-span-2">
                            <h3 className="font-semibold text-lg text-white">3. Generation Range <span className="text-gray-400 font-normal">(Optional)</span></h3>
                            <div className="grid grid-cols-2 gap-4">
                                <input
                                    type="number"
                                    placeholder="Start ID"
                                    value={startId}
                                    onChange={(e) => setStartId(e.target.value)}
                                    disabled={isGenerating}
                                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    aria-label="Start ID"
                                />
                                <input
                                    type="number"
                                    placeholder="End ID"
                                    value={endId}
                                    onChange={(e) => setEndId(e.target.value)}
                                    disabled={isGenerating}
                                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    aria-label="End ID"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 md:col-span-2 lg:col-span-4 lg:mt-4">
                           <button
                                onClick={handleStartGeneration}
                                disabled={isGenerating || prompts.length === 0}
                                className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold transition-colors disabled:bg-green-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                            >
                                <GenerateIcon className="w-5 h-5" />
                                <span>{isGenerating ? 'Generating...' : 'Start Generating'}</span>
                            </button>
                        </div>

                        <div className="col-span-1 md:col-span-2 lg:col-span-4 border-t border-gray-700 mt-4 pt-6">
                            <h3 className="font-semibold text-lg text-white mb-4 text-center md:text-left">Advanced Settings</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                <div className="flex flex-col gap-2">
                                    <label htmlFor="concurrency" className="flex items-center gap-2 text-sm font-medium text-gray-300">
                                        <TuneIcon className="w-5 h-5" />
                                        Concurrent Tasks: <span className="font-bold text-white">{concurrencyLimit}</span>
                                    </label>
                                    <input
                                        id="concurrency"
                                        type="range"
                                        min="1"
                                        max="5"
                                        step="1"
                                        value={concurrencyLimit}
                                        onChange={(e) => setConcurrencyLimit(Number(e.target.value))}
                                        disabled={isGenerating}
                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label htmlFor="delay" className="flex items-center gap-2 text-sm font-medium text-gray-300">
                                        <ClockIcon className="w-5 h-5" />
                                        Request Delay: <span className="font-bold text-white">{(requestDelay / 1000).toFixed(1)}s</span>
                                    </label>
                                    <input
                                        id="delay"
                                        type="range"
                                        min="0"
                                        max="5000"
                                        step="100"
                                        value={requestDelay}
                                        onChange={(e) => setRequestDelay(Number(e.target.value))}
                                        disabled={isGenerating}
                                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:opacity-50"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {(isGenerating || results.length > 0) && (
                    <div className="mb-8">
                        {isGenerating && (
                            <div className="bg-gray-800 p-4 rounded-lg">
                                <p className="text-center mb-2 text-gray-300">{`Generating image... ${progress.current}/${progress.total}`}</p>
                                <div className="w-full bg-gray-700 rounded-full h-2.5">
                                    <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}></div>
                                </div>
                            </div>
                        )}
                        {!isGenerating && results.length > 0 && (
                            <div className="flex justify-between items-center bg-gray-800/50 p-4 rounded-lg">
                                <p className="text-gray-300">{`Generation complete. ${successfulGenerations} / ${results.length} images created.`}</p>
                                <button
                                    onClick={handleDownloadAll}
                                    disabled={successfulGenerations === 0}
                                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors disabled:bg-indigo-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                                >
                                    <DownloadIcon className="w-5 h-5" />
                                    <span>Download All (.zip)</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {results.map(result => (
                        <ImageCard
                            key={result.id}
                            result={result}
                            onRetry={handleRetry}
                            onEdit={() => setEditingResult(result)}
                        />
                    ))}
                </div>

                {editingResult && (
                    <EditModal
                        result={editingResult}
                        onClose={() => setEditingResult(null)}
                        onSave={handleEditAndSave}
                    />
                )}

                {isAddKeysModalOpen && (
                    <AddKeysModal
                        onClose={() => setIsAddKeysModalOpen(false)}
                        onSave={(newKeys) => {
                            onAddKeys(newKeys);
                            setIsAddKeysModalOpen(false);
                        }}
                    />
                )}

                {isViewKeysModalOpen && (
                    <ViewKeysModal
                        keys={apiKeys}
                        onClose={() => setIsViewKeysModalOpen(false)}
                        onRemoveKey={onRemoveKey}
                        activeKeyIndex={activeKeyIndex}
                        isManualSelection={isManualKeySelection}
                        onSelectKey={handleSelectKey}
                        onSetAutomatic={handleSetAutomatic}
                    />
                )}
            </main>
        </div>
    );
};

export default ImageGenerator;