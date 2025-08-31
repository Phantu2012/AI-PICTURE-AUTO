
import React from 'react';
import { ImageResult } from '../types';
import { DownloadIcon, EditIcon, RetryIcon, ErrorIcon } from './icons';
import Spinner from './Spinner';

interface ImageCardProps {
    result: ImageResult;
    onRetry: (id: string) => void;
    onEdit: (id: string) => void;
}

const ImageCard: React.FC<ImageCardProps> = ({ result, onRetry, onEdit }) => {
    const { id, status, imageUrl, error, prompt } = result;

    const handleDownload = () => {
        if (!imageUrl) return;
        const link = document.createElement('a');
        link.href = imageUrl;
        // The user wants .png, so we name it as such, even if the content is jpeg.
        link.download = `${id}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderContent = () => {
        switch (status) {
            case 'generating':
                return (
                    <div className="flex flex-col items-center justify-center h-full">
                        <Spinner />
                        <p className="mt-2 text-sm text-gray-400">Generating...</p>
                    </div>
                );
            case 'success':
                return (
                    <>
                        <img src={imageUrl!} alt={prompt} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3 p-4">
                            <button onClick={handleDownload} title="Download" className="p-3 bg-gray-800/80 rounded-full text-white hover:bg-indigo-600 transition-colors">
                                <DownloadIcon className="w-5 h-5" />
                            </button>
                            <button onClick={() => onEdit(id)} title="Edit & Regenerate" className="p-3 bg-gray-800/80 rounded-full text-white hover:bg-indigo-600 transition-colors">
                                <EditIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </>
                );
            case 'error':
                return (
                    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                        <ErrorIcon className="w-10 h-10 text-red-400 mb-2" />
                        <p className="text-sm font-semibold text-red-400">Generation Failed</p>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2" title={error}>{error}</p>
                        <div className="mt-4 flex gap-2">
                             <button onClick={() => onRetry(id)} title="Retry" className="p-2 bg-gray-600 rounded-full text-white hover:bg-indigo-600 transition-colors">
                                <RetryIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => onEdit(id)} title="Edit & Retry" className="p-2 bg-gray-600 rounded-full text-white hover:bg-indigo-600 transition-colors">
                                <EditIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                );
            case 'pending':
            default:
                return (
                     <div className="flex flex-col items-center justify-center h-full">
                        <p className="text-sm text-gray-500">Pending...</p>
                    </div>
                );
        }
    };

    return (
        <div className="group relative aspect-square bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-md flex flex-col">
            <div className="flex-grow min-h-0 flex items-center justify-center">
                {renderContent()}
            </div>
            <div className="p-2 bg-gray-800/80 border-t border-gray-700">
                <p className="text-xs text-gray-300 truncate font-mono" title={prompt}>
                    <span className="font-bold">{id}.</span> {prompt}
                </p>
            </div>
        </div>
    );
};

export default ImageCard;
