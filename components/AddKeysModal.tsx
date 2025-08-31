
import React, { useState } from 'react';
import { CloseIcon, KeyIcon } from './icons';

interface AddKeysModalProps {
    onClose: () => void;
    onSave: (keys: string) => void;
}

const AddKeysModal: React.FC<AddKeysModalProps> = ({ onClose, onSave }) => {
    const [keysInput, setKeysInput] = useState('');

    const handleSave = () => {
        if (keysInput.trim()) {
            onSave(keysInput.trim());
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl w-full max-w-md relative" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
                    <CloseIcon className="w-6 h-6" />
                </button>
                <div className="p-8">
                    <h2 className="text-2xl font-bold text-white mb-2">Add More API Keys</h2>
                    <p className="text-gray-400 mb-6">Paste new API keys below, one per line. Duplicates will be ignored.</p>

                    <textarea
                        value={keysInput}
                        onChange={(e) => setKeysInput(e.target.value)}
                        rows={5}
                        className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors font-mono"
                        placeholder="Enter one Google AI API Key per line"
                    />

                    <div className="mt-6 flex justify-end gap-4">
                         <button
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-lg bg-gray-600 hover:bg-gray-500 text-white font-bold transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!keysInput.trim()}
                            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors disabled:bg-indigo-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                            <KeyIcon className="w-5 h-5" />
                            <span>Save Keys</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddKeysModal;
