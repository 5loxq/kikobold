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

      // Copy instead of mutating the caller's object: callers may pass an
      // object straight from state, and mutating it makes the map() below a
      // reference no-op that React does not render.
      const updated: Profile = { ...profile, updatedAt: Date.now() };
      ProfileStorage.saveProfile(updated);
      setProfiles(profiles.map(p => (p.id === updated.id ? updated : p)));
      if (activeProfile?.id === updated.id) {
        setActiveProfile(updated);
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

      // Validate each entry before saving: an import file without the
      // required fields would otherwise break the app at runtime.
      const validProfiles = imported.filter((p): p is Profile =>
        !!p &&
        typeof p === 'object' &&
        typeof p.name === 'string' && p.name.trim().length > 0 &&
        typeof p.systemPrompt === 'string'
      );

      // Normalize the numeric fields to the ranges saveProfile enforces:
      // a hand-edited or foreign export file with missing/out-of-range
      // values would otherwise make saveProfile throw and abort the whole
      // import halfway through (with the already-saved entries stuck in
      // storage but missing from the state).
      const now = Date.now();
      const num = (value: unknown, fallback: number): number =>
        typeof value === 'number' && Number.isFinite(value) ? value : fallback;
      const newProfiles = validProfiles.map(p => ({
        ...p,
        id: `profile_${now}_${Math.random().toString(36).slice(2, 11)}`,
        temperature: Math.min(2, Math.max(0, num(p.temperature, 0.7))),
        topP: Math.min(1, Math.max(0, num(p.topP, 0.9))),
        maxTokens: Math.min(2048, Math.max(1, Math.round(num(p.maxTokens, 512)))),
        createdAt: now,
        updatedAt: now,
      }));

      // Save one by one: a single failing entry must not abort the rest -
      // only the entries that actually made it into the storage go into
      // the state, so the two can never diverge.
      const savedProfiles: Profile[] = [];
      for (const p of newProfiles) {
        try {
          ProfileStorage.saveProfile(p);
          savedProfiles.push(p);
        } catch (err) {
          logError(`Failed to import profile "${p.name}":`, err);
        }
      }
      if (savedProfiles.length > 0) {
        setProfiles([...profiles, ...savedProfiles]);
      }
      return savedProfiles.length > 0;
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
