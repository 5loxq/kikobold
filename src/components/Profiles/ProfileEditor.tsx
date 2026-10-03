import React, { useState } from 'react';
import { Profile } from '../../types';

interface ProfileEditorProps {
  profile: Profile | null;
  onSave: (name: string, systemPrompt: string) => void;
  onCancel: () => void;
}

export const ProfileEditor: React.FC<ProfileEditorProps> = ({
  profile,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(profile?.name ?? '');
  const [systemPrompt, setSystemPrompt] = useState(profile?.systemPrompt ?? '');

  const handleSave = (): void => {
    if (name.trim() && systemPrompt.trim()) {
      onSave(name, systemPrompt);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-bold mb-4 text-zinc-800 dark:text-zinc-100">
        {profile ? 'Edit Profile' : 'Create New Profile'}
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-2">
            Profile Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Creative Assistant"
            className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-2">
            System Prompt
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="Define the personality and behavior of the model..."
            rows={4}
            className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-300 text-zinc-800 dark:text-zinc-100 rounded-lg hover:bg-zinc-400 dark:hover:bg-zinc-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !systemPrompt.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:bg-zinc-400 dark:disabled:bg-zinc-700 transition-colors"
          >
            {profile ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};
