import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Profile } from '../../types';
import { ProfileEditor } from './ProfileEditor';

interface ProfileManagerProps {
  profiles: Profile[];
  activeProfile: Profile | null;
  onSelectProfile: (profile: Profile) => void;
  onCreateProfile: (name: string, systemPrompt: string) => Profile;
  onUpdateProfile: (profile: Profile) => void;
  onDeleteProfile: (profileId: string) => void;
  onExportProfiles: () => string;
  onImportProfiles: (jsonData: string) => boolean;
}

export const ProfileManager: React.FC<ProfileManagerProps> = ({
  profiles,
  activeProfile,
  onSelectProfile,
  onCreateProfile,
  onUpdateProfile,
  onDeleteProfile,
  onExportProfiles,
  onImportProfiles,
}) => {
  const { t } = useTranslation();
  const [isCreating, setIsCreating] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);

  const handleExport = (): void => {
    const data = onExportProfiles();
    const element = document.createElement('a');
    element.setAttribute('href', `data:text/json;charset=utf-8,${  encodeURIComponent(data)}`);
    element.setAttribute('download', 'profiles.json');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleImport = async (): Promise<void> => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: unknown): Promise<void> => {
      const file = (e as { target: { files: File[] } }).target.files[0];
      if (file) {
        try {
          const text = await file.text();
          if (onImportProfiles(text)) {
            alert(t('profiles.importSuccess'));
          } else {
            alert('Failed to import profiles - invalid JSON format');
          }
        } catch (error) {
          alert(`Error reading file: ${  error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    };
    input.click();
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">{t('sidebar.profiles')}</h2>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-zinc-700 dark:hover:bg-zinc-600 transition-colors"
            >
              Export
            </button>
            <button
              onClick={handleImport}
              className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-zinc-700 dark:hover:bg-zinc-600 transition-colors"
            >
              Import
            </button>
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
            >
              {isCreating ? 'Cancel' : '+ New Profile'}
            </button>
          </div>
        </div>

        {isCreating && (
          <ProfileEditor
            profile={null}
            onSave={(name, systemPrompt) => {
              onCreateProfile(name, systemPrompt);
              setIsCreating(false);
            }}
            onCancel={() => setIsCreating(false)}
          />
        )}

        {editingProfile && (
          <ProfileEditor
            profile={editingProfile}
            onSave={(name, systemPrompt) => {
              onUpdateProfile({
                ...editingProfile,
                name,
                systemPrompt,
              });
              setEditingProfile(null);
            }}
            onCancel={() => setEditingProfile(null)}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                activeProfile?.id === profile.id
                  ? 'border-blue-600 bg-indigo-50 dark:bg-indigo-950/40'
                  : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
              }`}
              onClick={() => onSelectProfile(profile)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-bold text-zinc-800 dark:text-zinc-100">{profile.name}</h3>
                  {activeProfile?.id === profile.id && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">Active</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingProfile(profile);
                    }}
                    className="px-2 py-1 text-xs bg-blue-100 text-indigo-700 dark:text-indigo-300 rounded hover:bg-blue-200 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Delete this profile?')) {
                        onDeleteProfile(profile.id);
                      }
                    }}
                    className="px-2 py-1 text-xs bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded hover:bg-red-100 dark:hover:bg-red-950/70 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3 line-clamp-2">
                {profile.systemPrompt}
              </p>

              <div className="space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                <p>Temperature: {profile.temperature.toFixed(1)}</p>
                <p>Top-P: {profile.topP.toFixed(2)}</p>
                <p>Max Tokens: {profile.maxTokens}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
