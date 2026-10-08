import { useCallback, useEffect, useState } from 'react';
import { Profile, UseProfilesReturn } from '../types';
import * as ProfileStorage from '../services/storage/ProfileStorage';
import { error as logError } from '../services/logging';


export const useProfiles = (): UseProfilesReturn => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);

  useEffect(() => {
    try {
      const loaded = ProfileStorage.getProfiles();
      if (Array.isArray(loaded)) {
        setProfiles(loaded);
        if (loaded.length > 0) {
          setActiveProfile(loaded[0]);
        }
      }
    } catch (error) {
      logError('Failed to load profiles:', error);
    }
  }, []);

  const createProfile = useCallback((name: string, systemPrompt: string) => {
    try {
      if (typeof name !== 'string' || name.trim().length === 0) {
        throw new Error('Profile name must be a non-empty string');
      }

      if (typeof systemPrompt !== 'string' || systemPrompt.trim().length === 0) {
        throw new Error('System prompt must be a non-empty string');
      }

      const newProfile = ProfileStorage.createProfile(name, systemPrompt);
      ProfileStorage.saveProfile(newProfile);
      setProfiles([...profiles, newProfile]);
      return newProfile;
    } catch (error) {
      logError('Failed to create profile:', error);
      throw error;
    }
  }, [profiles]);

  const updateProfile = useCallback((profile: Profile) => {
    try {
      if (!profile || typeof profile !== 'object' || !profile.id) {
        throw new Error('Invalid profile object');
      }

      profile.updatedAt = Date.now();
      ProfileStorage.saveProfile(profile);
      setProfiles(profiles.map(p => (p.id === profile.id ? profile : p)));
      if (activeProfile?.id === profile.id) {
        setActiveProfile(profile);
      }
    } catch (error) {
      logError('Failed to update profile:', error);
      throw error;
    }
  }, [profiles, activeProfile]);

  const deleteProfile = useCallback((id: string) => {
    try {
      if (typeof id !== 'string' || id.trim().length === 0) {
        throw new Error('Invalid profile ID');
      }

      ProfileStorage.deleteProfile(id);
      setProfiles(profiles.filter(p => p.id !== id));
      if (activeProfile?.id === id) {
        const remaining = profiles.filter(p => p.id !== id);
        setActiveProfile(remaining.length > 0 ? remaining[0] : null);
      }
    } catch (error) {
      logError('Failed to delete profile:', error);
      throw error;
    }
  }, [profiles, activeProfile]);

  const selectProfile = useCallback((profile: Profile) => {
    try {
      if (!profile || typeof profile !== 'object') {
        throw new Error('Invalid profile object');
      }
      setActiveProfile(profile);
    } catch (error) {
      logError('Failed to select profile:', error);
      throw error;
    }
  }, []);

  const loadProfiles = useCallback(() => {
    try {
      const loaded = ProfileStorage.getProfiles();
      if (Array.isArray(loaded)) {
        setProfiles(loaded);
        if (loaded.length > 0) {
          setActiveProfile(loaded[0]);
        }
      }
    } catch (error) {
      logError('Failed to load profiles:', error);
      throw error;
    }
  }, []);

  const exportProfiles = useCallback((): string => {
    try {
      if (!Array.isArray(profiles)) {
        throw new Error('No profiles to export');
      }
      return JSON.stringify(profiles, null, 2);
    } catch (error) {
      logError('Failed to export profiles:', error);
      throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [profiles]);

  const importProfiles = useCallback((jsonData: string) => {
    try {
      if (typeof jsonData !== 'string' || jsonData.trim().length === 0) {
        throw new Error('Invalid JSON data');
      }

      const imported = JSON.parse(jsonData) as Profile[];
      
      if (!Array.isArray(imported)) {
        throw new Error('Invalid profiles array in import data');
      }

      // Assign new IDs to imported profiles to avoid conflicts
      const newProfiles = imported.map(p => ({
        ...p,
        id: `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now(),
      }));

      newProfiles.forEach(p => ProfileStorage.saveProfile(p));
      setProfiles([...profiles, ...newProfiles]);
      return true;
    } catch (error) {
      logError('Failed to import profiles:', error);
      return false;
    }
  }, [profiles]);

  return {
    profiles,
    activeProfile,
    createProfile,
    updateProfile,
    deleteProfile,
    selectProfile,
    exportProfiles,
    importProfiles,
    loadProfiles,
  };
};
