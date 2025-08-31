import React from 'react';
import { CloseIcon, TrashIcon, TargetIcon } from './icons';

interface ViewKeysModalProps {
    keys: string[];
    onClose: () => void;
    onRemoveKey: (key: string) => void;
    activeKeyIndex: number;
    isManualSelection: boolean;
    onSelectKey: (index: number) => void;
    onSetAutomatic: () => void;
}

const ViewKeysModal: React.FC<ViewKeysModalProps> = ({ 
    keys, 
    onClose, 
    onRemoveKey, 
    activeKeyIndex,
    isManualSelection,
    onSelectKey,
    onSetAutomatic
}) => {

    const maskKey = (key: string) => {
        if (key.length <= 8) {
            return '****';
        }
        return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl w-full max-w-lg relative" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
                    <CloseIcon className="w-6 h-6" />
                </button>
                <div className="p-8">
                    <h2 className="text-2xl font-bold text-white mb-2">Manage & Select API Keys</h2>
                    <p className="text-gray-400 mb-6">Select a key for manual use or switch to automatic rotation.</p>
                    
                    <div className="flex items-center justify-center bg-gray-900 rounded-lg p-1 mb-4">
                        <button 
                            onClick={onSetAutomatic}
                            className={`px-4 py-1.5 w-1/2 rounded-md text-sm font-semibold transition-colors ${!isManualSelection ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                        >
                            Automatic Rotation
                        </button>
                        <button
                            onClick={isManualSelection ? undefined : () => onSelectKey(activeKeyIndex)}
                            className={`px-4 py-1.5 w-1/2 rounded-md text-sm font-semibold transition-colors ${isManualSelection ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                        >
                            Manual Selection
                        </button>
                    </div>

                    <div className="max-h-72 overflow-y-auto pr-2 space-y-2">
                        {keys.length > 0 ? (
                            keys.map((key, index) => (
                                <div key={index} className={`flex items-center justify-between p-3 rounded-lg transition-colors ${index === activeKeyIndex ? 'bg-indigo-900/50 border border-indigo-500' : 'bg-gray-900'}`}>
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        {index === activeKeyIndex && (
                                            <div className="flex-shrink-0">
                                                <TargetIcon className="w-5 h-5 text-indigo-400" />
                                                <span className="sr-only">Active Key</span>
                                            </div>
                                        )}
                                        <span className={`font-mono truncate ${index === activeKeyIndex ? 'text-indigo-300' : 'text-gray-300'}`} title={key}>{maskKey(key)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
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
                                            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/50 rounded-full transition-colors"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-gray-500 py-4">No API keys have been added yet.</p>
                        )}
                    </div>
                    
                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-lg bg-gray-600 hover:bg-gray-500 text-white font-bold transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ViewKeysModal;