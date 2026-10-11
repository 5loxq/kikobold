import { Profile } from '../../types';
import { error as logError, warn } from '../logging';
import { sanitizeInputLight } from '../security';
import { localStorageGet, localStorageSetJson } from './local-storage';

const PROFILE_STORAGE_KEY = 'llm_profiles_v2';

// Validate profile object
function validateProfile(profile: unknown): profile is Profile {
  return (
    typeof profile === 'object' &&
    profile !== null &&
    typeof (profile as Profile).id === 'string' &&
    typeof (profile as Profile).name === 'string' &&
    typeof (profile as Profile).systemPrompt === 'string' &&
    typeof (profile as Profile).temperature === 'number' &&
    typeof (profile as Profile).topP === 'number' &&
    typeof (profile as Profile).maxTokens === 'number' &&
    typeof (profile as Profile).createdAt === 'number' &&
    typeof (profile as Profile).updatedAt === 'number' &&
    (profile as Profile).temperature >= 0 && (profile as Profile).temperature <= 2 &&
    (profile as Profile).topP >= 0 && (profile as Profile).topP <= 1 &&
    (profile as Profile).maxTokens >= 1 && (profile as Profile).maxTokens <= 2048
  );
}

export const getProfiles = (): Profile[] => {
  try {
    const data = localStorageGet(PROFILE_STORAGE_KEY);
    if (!data) {
      return getDefaultProfiles();
    }
    
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      warn('Invalid profiles data format, using defaults');
      return getDefaultProfiles();
    }
    
    // Filter out invalid profiles
    const validProfiles = parsed.filter(profile => validateProfile(profile));
    
    if (validProfiles.length === 0) {
      warn('No valid profiles found, using defaults');
      return getDefaultProfiles();
    }
    
    return validProfiles;
  } catch (error) {
    logError('Failed to load profiles:', error);
    return getDefaultProfiles();
  }
};

export const saveProfile = (profile: Profile): void => {
  try {
    // Validate profile before saving
    if (!validateProfile(profile)) {
      throw new Error('Invalid profile object');
    }

    // Sanitize profile fields. Light sanitization (HTML tags only): the full
    // sanitizer also strips patterns like "data:" and "on...=" which are
    // perfectly normal words in a system prompt and would silently rewrite
    // the user's text (see ChatStorage for the same decision).
    const sanitizedProfile = {
      ...profile,
      name: sanitizeInputLight(profile.name),
      systemPrompt: sanitizeInputLight(profile.systemPrompt),
    };

    const profiles = getProfiles();
    const index = profiles.findIndex(p => p.id === sanitizedProfile.id);

    if (index >= 0) {
      profiles[index] = sanitizedProfile;
    } else {
      profiles.push(sanitizedProfile);
    }

    localStorageSetJson(PROFILE_STORAGE_KEY, profiles);
  } catch (error) {
    logError('Failed to save profile:', error);
    throw error;
  }
};

export const deleteProfile = (id: string): void => {
  try {
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new Error('Invalid profile ID');
    }

    const profiles = getProfiles().filter(p => p.id !== id);
    localStorageSetJson(PROFILE_STORAGE_KEY, profiles);
  } catch (error) {
    logError('Failed to delete profile:', error);
    throw error;
  }
};

export const getProfile = (id: string): Profile | undefined => {
  try {
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new Error('Invalid profile ID');
    }

    const profile = getProfiles().find(p => p.id === id);
    return profile && validateProfile(profile) ? profile : undefined;
  } catch (error) {
    logError('Failed to get profile:', error);
    return undefined;
  }
};

export const getDefaultProfiles = (): Profile[] => {
  const now = Date.now();
  return [
    {
      id: 'default',
      name: 'Standard',
      systemPrompt: 'Du bist ein hilfreicher KI-Assistent. Antworte klar und strukturiert. Antworte in der Sprache des Nutzers.',
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 512,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'creative',
      name: 'Kreativ',
      systemPrompt: 'Du bist ein kreativer KI-Assistent. Sei einfallsreich, denke quer und bringe ungewöhnliche Ideen und Perspektiven ein.',
      temperature: 0.9,
      topP: 0.95,
      maxTokens: 512,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'precise',
      name: 'Präzise',
      systemPrompt: 'Du bist ein präziser, faktenbasierter Assistent. Antworte kurz, korrekt und ohne Ausschmückungen. Wenn du unsicher bist, sage es deutlich.',
      temperature: 0.3,
      topP: 0.8,
      maxTokens: 512,
      createdAt: now,
      updatedAt: now,
    },
  ];
};

export const createProfile = (name: string, systemPrompt: string): Profile => {
  const now = Date.now();
  return {
    id: `profile_${now}_${Math.random().toString(36).slice(2, 11)}`,
    name,
    systemPrompt,
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 512,
    createdAt: now,
    updatedAt: now,
  };
};
