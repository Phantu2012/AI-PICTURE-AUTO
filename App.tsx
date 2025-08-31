
import React, { useState, useEffect, useCallback } from 'react';
import ImageGenerator from './components/ImageGenerator';
import { GithubIcon } from './components/icons';

const ApiKeySetup: React.FC<{ onApiKeySubmit: (keys: string) => void }> = ({ onApiKeySubmit }) => {
  const [apiKeyInput, setApiKeyInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKeyInput.trim()) {
      onApiKeySubmit(apiKeyInput.trim());
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-2xl shadow-lg border border-gray-700">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">AI Batch Creator</h1>
          <p className="mt-2 text-gray-400">Enter your Google AI API Keys to start</p>
           <p className="mt-1 text-xs text-gray-500">The app will automatically rotate keys when one hits its rate limit.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="api-key" className="sr-only">Google AI API Keys</label>
            <textarea
              id="api-key"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-200 h-32 resize-none font-mono"
              placeholder="Enter one Google AI API Key per line"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-semibold transition duration-200 disabled:bg-indigo-400 disabled:cursor-not-allowed"
            disabled={!apiKeyInput.trim()}
          >
            Save & Continue
          </button>
        </form>
        <div className="text-center text-sm text-gray-500">
          <p>Your API keys are stored securely in your browser's local storage and are never sent to our servers.</p>
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-indigo-400 hover:text-indigo-300">
            Get your Google AI API Key &rarr;
          </a>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedKeys = localStorage.getItem('gemini_api_key');
      if (storedKeys) {
        try {
          // New format: array of keys
          const parsedKeys = JSON.parse(storedKeys);
          if (Array.isArray(parsedKeys)) {
            setApiKeys(parsedKeys);
          } else if (typeof parsedKeys === 'string') {
            // Handle old format (single key string) for backward compatibility
            setApiKeys([parsedKeys]);
          }
        } catch (e) {
            // It might be the old format (plain string, not JSON)
            setApiKeys([storedKeys]);
        }
      }
    } catch (error) {
      console.error("Could not access local storage:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleApiKeySubmit = useCallback((keys: string) => {
    try {
      const keysArray = keys.split('\n').map(k => k.trim()).filter(k => k);
      if (keysArray.length > 0) {
        localStorage.setItem('gemini_api_key', JSON.stringify(keysArray));
        setApiKeys(keysArray);
      } else {
        alert("Please enter at least one valid API key.");
      }
    } catch (error) {
      console.error("Could not save to local storage:", error);
      alert("Error: Could not save API keys. Please ensure local storage is enabled.");
    }
  }, []);

  const handleAddKeys = useCallback((keysToAdd: string) => {
    try {
        const newKeysArray = keysToAdd.split('\n').map(k => k.trim()).filter(k => k);
        if (newKeysArray.length > 0) {
            const updatedKeys = Array.from(new Set([...apiKeys, ...newKeysArray]));
            localStorage.setItem('gemini_api_key', JSON.stringify(updatedKeys));
            setApiKeys(updatedKeys);
        }
    } catch (error) {
        console.error("Could not save to local storage:", error);
        alert("Error: Could not save API keys. Please ensure local storage is enabled.");
    }
  }, [apiKeys]);
  
  const handleRemoveKey = useCallback((keyToRemove: string) => {
    try {
        const updatedKeys = apiKeys.filter(key => key !== keyToRemove);
        localStorage.setItem('gemini_api_key', JSON.stringify(updatedKeys));
        setApiKeys(updatedKeys);
    } catch (error) {
        console.error("Could not update local storage:", error);
        alert("Error: Could not remove API key. Please ensure local storage is enabled.");
    }
  }, [apiKeys]);
  
  const handleClearKey = useCallback(() => {
    try {
      localStorage.removeItem('gemini_api_key');
      setApiKeys([]);
    } catch (error) {
       console.error("Could not clear from local storage:", error);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      {apiKeys.length > 0 ? (
        <ImageGenerator apiKeys={apiKeys} onClearKey={handleClearKey} onAddKeys={handleAddKeys} onRemoveKey={handleRemoveKey} />
      ) : (
        <ApiKeySetup onApiKeySubmit={handleApiKeySubmit} />
      )}
       <footer className="absolute bottom-4 right-4 text-gray-500">
          <a href="https://github.com/google/prompt-gallery/tree/main/frames/csv-to-image-generator" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-gray-300">
              <GithubIcon className="w-5 h-5" />
              View on GitHub
          </a>
      </footer>
    </div>
  );
};

export default App;
