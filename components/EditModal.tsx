
import React, { useState } from 'react';
import { ImageResult } from '../types';
import { CloseIcon, GenerateIcon } from './icons';

interface EditModalProps {
    result: ImageResult;
    onClose: () => void;
    onSave: (id: string, newPrompt: string) => void;
}

const EditModal: React.FC<EditModalProps> = ({ result, onClose, onSave }) => {
    const [prompt, setPrompt] = useState(result.prompt);

    const handleSave = () => {
        if (prompt.trim()) {
            onSave(result.id, prompt.trim());
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl w-full max-w-2xl relative" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
                    <CloseIcon className="w-6 h-6" />
                </button>
                <div className="p-8">
                    <h2 className="text-2xl font-bold text-white mb-2">Edit & Regenerate</h2>
                    <p className="text-gray-400 mb-6">Modify the prompt for image <span className="font-mono bg-gray-700 px-1.5 py-0.5 rounded">{result.id}</span> and generate it again.</p>

                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        rows={4}
                        className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
                        placeholder="Enter your new prompt here"
                    />
                    
                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={!prompt.trim()}
                            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors disabled:bg-indigo-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                            <GenerateIcon className="w-5 h-5" />
                            <span>Regenerate Image</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditModal;
