import { useCallback, useEffect, useState } from 'react';
import * as LibraryStorage from '../services/storage/LibraryStorage';
import { error as logError } from '../services/logging';


export const useLibrary = (): {
  libraryFiles: LibraryStorage.LibraryFile[];
  addLibraryFile: (name: string, content: string) => Promise<void>;
  deleteLibraryFile: (id: string) => Promise<void>;
  clearAllLibraryFiles: () => Promise<void>;
  importLibraryFiles: (files: LibraryStorage.LibraryFile[]) => Promise<void>;
} => {
  const [libraryFiles, setLibraryFiles] = useState<LibraryStorage.LibraryFile[]>([]);

  useEffect(() => {
    LibraryStorage.getAllLibraryFiles().then(setLibraryFiles).catch((err) => {
      logError('Failed to load library files:', err);
    });
  }, []);

  const addLibraryFile = useCallback(async (name: string, content: string): Promise<void> => {
    const entry = LibraryStorage.createLibraryFile(name, content);
    // Upsert by name: saveLibraryFile alone would leave a duplicate row in
    // the database (new id) that reappears after the next reload.
    await LibraryStorage.upsertLibraryFileByName(entry);
    setLibraryFiles((prev) => [...prev.filter((f) => f.name !== entry.name), entry]);
  }, []);

  const deleteLibraryFile = useCallback(async (id: string): Promise<void> => {
    await LibraryStorage.deleteLibraryFile(id);
    setLibraryFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  /** Delete all library files (data page: "delete everything") */
  const clearAllLibraryFiles = useCallback(async (): Promise<void> => {
    await LibraryStorage.clearAllLibraryFiles();
    setLibraryFiles([]);
  }, []);

  const importLibraryFiles = useCallback(async (files: LibraryStorage.LibraryFile[]): Promise<void> => {
    for (const file of files) {
      // Upsert by name: a backup containing an existing name must replace
      // it, not create a permanent duplicate with a second id.
      await LibraryStorage.upsertLibraryFileByName(file);
    }
    const all = await LibraryStorage.getAllLibraryFiles();
    setLibraryFiles(all);
  }, []);

  return {
    libraryFiles,
    addLibraryFile,
    deleteLibraryFile,
    clearAllLibraryFiles,
    importLibraryFiles,
  };
};
