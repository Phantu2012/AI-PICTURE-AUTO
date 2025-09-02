import React, { useState, useEffect, useCallback } from 'react';
import ImageGenerator from './components/ImageGenerator';
import { GithubIcon } from './components/icons';
import { ApiKeys, Provider } from './types';

const ApiKeySetup: React.FC<{ onApiKeySubmit: (keys: ApiKeys) => void }> = ({ onApiKeySubmit }) => {
  const [activeTab, setActiveTab] = useState<Provider>('google');
  const [keys, setKeys] = useState<ApiKeys>({ google: [], openai: [] });

  const handleInputChange = (provider: Provider, value: string) => {
    const keysArray = value.split('\n').map(k => k.trim()).filter(Boolean);
    setKeys(prev => ({ ...prev, [provider]: keysArray }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keys.google.length > 0 || keys.openai.length > 0) {
      onApiKeySubmit(keys);
    } else {
      alert('Please enter at least one API key.');
    }
  };

  const hasKeys = keys.google.length > 0 || keys.openai.length > 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
      <div className="w-full max-w-lg p-8 space-y-6 bg-gray-800 rounded-2xl shadow-lg border border-gray-700">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">AI Batch Image Creator</h1>
          <p className="mt-2 text-gray-400">Enter your API Keys to start</p>
          <p className="mt-1 text-xs text-gray-500">The app will automatically rotate keys for each provider.</p>
        </div>
        
        <div className="flex border-b border-gray-700">
          <button onClick={() => setActiveTab('google')} className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'google' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-white'}`}>
            Google AI
          </button>
          <button onClick={() => setActiveTab('openai')} className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'openai' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-white'}`}>
            OpenAI (GPT)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {activeTab === 'google' && (
            <div>
              <label htmlFor="google-api-key" className="sr-only">Google AI API Keys</label>
              <textarea
                id="google-api-key"
                value={keys.google.join('\n')}
                onChange={(e) => handleInputChange('google', e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-200 h-32 resize-none font-mono"
                placeholder="Enter one Google AI API Key per line"
              />
               <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-indigo-400 hover:text-indigo-300">
                Get your Google AI API Key &rarr;
              </a>
            </div>
          )}
          {activeTab === 'openai' && (
            <div>
              <label htmlFor="openai-api-key" className="sr-only">OpenAI API Keys</label>
              <textarea
                id="openai-api-key"
                value={keys.openai.join('\n')}
                onChange={(e) => handleInputChange('openai', e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-200 h-32 resize-none font-mono"
                placeholder="Enter one OpenAI API Key per line"
              />
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-indigo-400 hover:text-indigo-300">
                Get your OpenAI API Key &rarr;
              </a>
            </div>
          )}
          <button
            type="submit"
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-semibold transition duration-200 disabled:bg-indigo-400 disabled:cursor-not-allowed"
            disabled={!hasKeys}
          >
            Save & Continue
          </button>
        </form>
        <p className="text-center text-sm text-gray-500">
          Your API keys are stored securely in your browser's local storage.
        </p>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<ApiKeys>({ google: [], openai: [] });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedKeysStr = localStorage.getItem('ai_api_keys');
      if (storedKeysStr) {
        const storedKeys = JSON.parse(storedKeysStr);
        setApiKeys({
            google: storedKeys.google || [],
            openai: storedKeys.openai || [],
        });
      } else {
        // Migration logic for old key format
        const oldGoogleKeysStr = localStorage.getItem('gemini_api_key');
        if (oldGoogleKeysStr) {
            let googleKeys: string[] = [];
            try {
                const parsed = JSON.parse(oldGoogleKeysStr);
                if (Array.isArray(parsed)) {
                    googleKeys = parsed;
                } else if (typeof parsed === 'string') {
                    googleKeys = [parsed];
                }
            } catch (e) {
                googleKeys = [oldGoogleKeysStr]; // Plain string
            }
            
            if (googleKeys.length > 0) {
                const newKeys = { google: googleKeys, openai: [] };
                localStorage.setItem('ai_api_keys', JSON.stringify(newKeys));
                setApiKeys(newKeys);
                localStorage.removeItem('gemini_api_key'); // Clean up old key
            }
        }
      }
    } catch (error) {
      console.error("Could not access local storage:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleApiKeySubmit = useCallback((keys: ApiKeys) => {
    try {
      localStorage.setItem('ai_api_keys', JSON.stringify(keys));
      setApiKeys(keys);
    } catch (error) {
      console.error("Could not save to local storage:", error);
      alert("Error: Could not save API keys. Please ensure local storage is enabled.");
    }
  }, []);

  const handleAddKeys = useCallback((keysToAdd: string, provider: Provider) => {
    try {
        const newKeysArray = keysToAdd.split('\n').map(k => k.trim()).filter(k => k);
        if (newKeysArray.length > 0) {
            setApiKeys(prevKeys => {
                const existingKeys = prevKeys[provider] || [];
                const updatedKeysForProvider = Array.from(new Set([...existingKeys, ...newKeysArray]));
                const finalKeys = { ...prevKeys, [provider]: updatedKeysForProvider };
                localStorage.setItem('ai_api_keys', JSON.stringify(finalKeys));
                return finalKeys;
            });
        }
    } catch (error) {
        console.error("Could not save to local storage:", error);
        alert("Error: Could not save API keys. Please ensure local storage is enabled.");
    }
  }, []);
  
  const handleRemoveKey = useCallback((keyToRemove: string, provider: Provider) => {
    try {
        setApiKeys(prevKeys => {
            const updatedKeysForProvider = (prevKeys[provider] || []).filter(key => key !== keyToRemove);
            const finalKeys = { ...prevKeys, [provider]: updatedKeysForProvider };
            localStorage.setItem('ai_api_keys', JSON.stringify(finalKeys));
            return finalKeys;
        });
    } catch (error) {
        console.error("Could not update local storage:", error);
        alert("Error: Could not remove API key. Please ensure local storage is enabled.");
    }
  }, []);
  
  const handleClearAllKeys = useCallback(() => {
    try {
      localStorage.removeItem('ai_api_keys');
      localStorage.removeItem('gemini_api_key'); // Also clear old key just in case
      setApiKeys({ google: [], openai: [] });
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
  
  const hasAnyKey = apiKeys.google.length > 0 || apiKeys.openai.length > 0;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      {hasAnyKey ? (
        <ImageGenerator apiKeys={apiKeys} onClearAllKeys={handleClearAllKeys} onAddKeys={handleAddKeys} onRemoveKey={handleRemoveKey} />
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
