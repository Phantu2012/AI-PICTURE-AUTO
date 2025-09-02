import React, { useState } from 'react';
import { CloseIcon, TrashIcon, TargetIcon } from './icons';
import { Provider } from '../types';

interface ViewKeysModalProps {
    keys: string[];
    onClose: () => void;
    onRemoveKey: (key: string) => void;
    onAddKeys: (keys: string) => void;
    activeKeyIndex: number;
    isManualSelection: boolean;
    onSelectKey: (index: number) => void;
    onSetAutomatic: () => void;
    provider: Provider;
}

const PROVIDER_NAMES = {
    google: 'Google AI',
    openai: 'OpenAI'
};

const ViewKeysModal: React.FC<ViewKeysModalProps> = ({ 
    keys, 
    onClose, 
    onRemoveKey,
    onAddKeys, 
    activeKeyIndex,
    isManualSelection,
    onSelectKey,
    onSetAutomatic,
    provider
}) => {
    const [newKeyInput, setNewKeyInput] = useState('');
    const providerName = PROVIDER_NAMES[provider];

    const handleAddKey = () => {
        if (newKeyInput.trim()) {
            onAddKeys(newKeyInput.trim());
            setNewKeyInput('');
        }
    };
    
    const handleInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleAddKey();
        }
    };

    const maskKey = (key: string) => {
        if (key.length <= 8) return '****';
        return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl w-full max-w-2xl relative" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
                    <CloseIcon className="w-6 h-6" />
                </button>
                <div className="p-8">
                    <h2 className="text-2xl font-bold text-white mb-6">Manage {providerName} API Keys</h2>
                    
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Danh sách API Key</h3>
                    <div className="max-h-60 overflow-y-auto pr-2 space-y-2 rounded-lg bg-black/20 p-2">
                        {keys.length > 0 ? (
                            keys.map((key, index) => (
                                <div key={index} className={`flex items-center justify-between p-3 rounded-lg transition-colors ${index === activeKeyIndex ? 'bg-gray-900' : 'bg-gray-900/50'}`}>
                                    <span className={`font-mono truncate ${index === activeKeyIndex ? 'text-indigo-300' : 'text-gray-300'}`} title={key}>{maskKey(key)}</span>
                                    
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        {index === activeKeyIndex && (
                                             <span className="text-xs font-medium bg-green-900/50 text-green-300 px-2.5 py-1 rounded-full">
                                                Đang hoạt động
                                             </span>
                                        )}
                                        {isManualSelection && index !== activeKeyIndex && (
                                             <button
                                                onClick={() => onSelectKey(index)}
                                                title="Use this key"
                                                className="px-3 py-1 text-xs bg-gray-700 hover:bg-indigo-600 text-white rounded-md transition-colors"
                                            >
                                                Select
                                            </button>
                                        )}
                                        <button
                                            onClick={() => onRemoveKey(key)}
                                            title="Remove Key"
                                            className="p-2 text-gray-500 hover:text-red-400 rounded-full transition-colors"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-gray-500 py-4">No {providerName} API keys have been added yet.</p>
                        )}
                    </div>
                     {isManualSelection && (
                        <button onClick={onSetAutomatic} className="text-sm text-indigo-400 hover:text-indigo-300 mt-3 w-full text-left">
                            Switch back to Automatic Rotation
                        </button>
                    )}

                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 mt-8">{providerName} API Key</h3>
                    <div className="flex items-center gap-2">
                         <input
                            type="password"
                            value={newKeyInput}
                            onChange={(e) => setNewKeyInput(e.target.value)}
                            onKeyPress={handleInputKeyPress}
                            placeholder={`Paste your ${providerName} API Key here`}
                            className="flex-grow px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                        />
                        <button
                            onClick={handleAddKey}
                            disabled={!newKeyInput.trim()}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors disabled:bg-indigo-800 disabled:cursor-not-allowed flex-shrink-0"
                        >
                            Thêm Key
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ViewKeysModal;