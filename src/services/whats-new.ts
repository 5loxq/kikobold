// "What's new" tracking: the app stores which version the user has last
// seen. Returning users get a summary of everything that changed since
// their last visit; first-time visitors don't (they get the welcome page
// and guided tour instead).

const LAST_VERSION_KEY = 'webgui_last_seen_version';

export interface WhatsNewEntry {
  version: string;
  /** i18n keys of the bullet points for this version */
  itemKeys: string[];
}

/** All notable changes, newest first. Keep in sync with CHANGELOG.md. */
export const WHATS_NEW: WhatsNewEntry[] = [
  {
    version: '3.3.0',
    itemKeys: [
      'whatsNew.v330.item1',
      'whatsNew.v330.item2',
      'whatsNew.v330.item3',
    ],
  },
  {
    version: '3.2.1',
    itemKeys: [
      'whatsNew.v321.item1',
      'whatsNew.v321.item2',
    ],
  },
  {
    version: '3.2.0',
    itemKeys: [
      'whatsNew.v320.item1',
      'whatsNew.v320.item2',
    ],
  },
  {
    version: '3.1.0',
    itemKeys: [
      'whatsNew.v310.item1',
      'whatsNew.v310.item2',
      'whatsNew.v310.item3',
    ],
  },
  {
    version: '3.0.0',
    itemKeys: [
      'whatsNew.v300.item1',
      'whatsNew.v300.item2',
      'whatsNew.v300.item3',
      'whatsNew.v300.item4',
      'whatsNew.v300.item5',
    ],
  },
  {
    version: '2.4.0',
    itemKeys: [
      'whatsNew.v240.item1',
      'whatsNew.v240.item2',
    ],
  },
  {
    version: '2.3.0',
    itemKeys: [
      'whatsNew.v230.item1',
      'whatsNew.v230.item2',
    ],
  },
  {
    version: '2.2.0',
    itemKeys: [
      'whatsNew.v220.item1',
      'whatsNew.v220.item2',
    ],
  },
  {
    version: '2.1.0',
    itemKeys: [
      'whatsNew.v210.item1',
      'whatsNew.v210.item2',
      'whatsNew.v210.item3',
    ],
  },
  {
    version: '2.0.0',
    itemKeys: [
      'whatsNew.v200.item1',
    ],
  },
];

/** Compare two semver strings ("2.10.0" > "2.9.4"). Returns > 0 if a > b. */
export const compareVersions = (a: string, b: string): number => {
  const parse = (v: string): number[] =>
    v.split('.').map((part) => parseInt(part, 10) || 0);
  const [aParts, bParts] = [parse(a), parse(b)];
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
};

export const getLastSeenVersion = (): string | null => {
  try {
    return localStorage.getItem(LAST_VERSION_KEY);
  } catch {
    return null;
  }
};

export const setLastSeenVersion = (version: string): void => {
  try {
    localStorage.setItem(LAST_VERSION_KEY, version);
  } catch {
    // Ignore storage errors - the dialog may show again on the next visit
  }
};

/**
 * All entries newer than `sinceVersion` (oldest known version of the user).
 * Returns [] if the user is up to date.
 */
export const getWhatsNewSince = (sinceVersion: string | null): WhatsNewEntry[] => {
  if (!sinceVersion) {
    return [];
  }
  return WHATS_NEW.filter((entry) => compareVersions(entry.version, sinceVersion) > 0);
};
