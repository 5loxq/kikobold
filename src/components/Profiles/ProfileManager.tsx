import React, { useState } from 'react';
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
  const [isCreating, setIsCreating] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);

  const handleExport = () => {
    const data = onExportProfiles();
    const element = document.createElement('a');
    element.setAttribute('href', `data:text/json;charset=utf-8,${  encodeURIComponent(data)}`);
    element.setAttribute('download', 'profiles.json');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const text = await file.text();
          if (onImportProfiles(text)) {
            alert('Profiles imported successfully');
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
          <h2 className="text-2xl font-bold text-gray-800">Profiles</h2>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Export
            </button>
            <button
              onClick={handleImport}
              className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Import
            </button>
            <button
              onClick={() => setIsCreating(!isCreating)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => onSelectProfile(profile)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800">{profile.name}</h3>
                  {activeProfile?.id === profile.id && (
                    <span className="text-xs text-green-600 font-medium">Active</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingProfile(profile);
                    }}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
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
                    className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {profile.systemPrompt}
              </p>

              <div className="space-y-1 text-xs text-gray-500">
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
