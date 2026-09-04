import { useCallback, useEffect, useState } from "react";
import { useIpc } from "@/hooks/api/useIpc";
import type { ProfileListResponse } from "@/types/profile";

export interface UseProfileStateOptions {
  onProfileChanged?: () => void | Promise<void>;
}

export interface UseProfileStateReturn {
  profiles: string[];
  activeProfile: string;
  isLoading: boolean;
  error: string | null;
  loadProfile: (profileName: string) => Promise<boolean>;
  copyProfile: (newName: string) => Promise<boolean>;
  copyProfileWithDialog: () => Promise<boolean>;
  importProfileWithDialog: () => Promise<boolean>;
  exportProfileWithDialog: (profileName?: string) => Promise<string | null>;
  createProfile: (profileName: string) => Promise<boolean>;
  deleteProfile: (profileName: string) => Promise<boolean>;
  refreshProfiles: () => Promise<void>;
  clearError: () => void;
}

export function useProfileState(
  options?: UseProfileStateOptions
): UseProfileStateReturn {
  const { invoke } = useIpc();
  const [profiles, setProfiles] = useState<string[]>([]);
  const [activeProfile, setActiveProfile] = useState<string>("default");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const refreshProfiles = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await invoke<ProfileListResponse>("list-profiles");
      if (res) {
        setProfiles(res.profiles);
        setActiveProfile(res.activeProfile);
      }
    } catch (err) {
      console.error("Failed to load profiles:", err);
      setError(
        typeof err === "string" ? err : "プロファイルの取得に失敗しました"
      );
    } finally {
      setIsLoading(false);
    }
  }, [invoke]);

  useEffect(() => {
    refreshProfiles();
  }, [refreshProfiles]);

  const loadProfile = useCallback(
    async (profileName: string): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);
        await invoke("load-profile", { profileName });
        setActiveProfile(profileName);
        await options?.onProfileChanged?.();
        return true;
      } catch (err) {
        console.error(`Failed to load profile "${profileName}":`, err);
        setError(
          typeof err === "string"
            ? err
            : `プロファイル "${profileName}" の読み込みに失敗しました`
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [invoke, options]
  );

  const copyProfile = useCallback(
    async (newName: string): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);
        await invoke("copy-profile", {
          sourceName: activeProfile,
          newName,
        });
        await refreshProfiles();
        await options?.onProfileChanged?.();
        return true;
      } catch (err) {
        console.error("Failed to copy profile:", err);
        setError(
          typeof err === "string" ? err : "プロファイルのコピーに失敗しました"
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [invoke, activeProfile, refreshProfiles, options]
  );

  const copyProfileWithDialog = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await invoke<ProfileListResponse | null>(
        "copy-profile-with-dialog"
      );
      if (res) {
        setProfiles(res.profiles);
        setActiveProfile(res.activeProfile);
        await options?.onProfileChanged?.();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to copy profile with dialog:", err);
      setError(
        typeof err === "string" ? err : "プロファイルの複製保存に失敗しました"
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [invoke, options]);

  const importProfileWithDialog = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await invoke<ProfileListResponse | null>(
        "import-profile-with-dialog"
      );
      if (res) {
        setProfiles(res.profiles);
        setActiveProfile(res.activeProfile);
        await options?.onProfileChanged?.();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to import profile with dialog:", err);
      setError(
        typeof err === "string" ? err : "設定ファイルの読み込みに失敗しました"
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [invoke, options]);

  const exportProfileWithDialog = useCallback(
    async (profileName?: string): Promise<string | null> => {
      try {
        const target = profileName || activeProfile;
        const res = await invoke<string | null>("export-profile-with-dialog", {
          profileName: target,
        });
        return res ?? null;
      } catch (err) {
        console.error("Failed to export profile with dialog:", err);
        setError(
          typeof err === "string"
            ? err
            : "プロファイルのエクスポートに失敗しました"
        );
        return null;
      }
    },
    [invoke, activeProfile]
  );

  const createProfile = useCallback(
    async (profileName: string): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);
        await invoke("create-profile", { profileName });
        await refreshProfiles();
        await options?.onProfileChanged?.();
        return true;
      } catch (err) {
        console.error("Failed to create profile:", err);
        setError(
          typeof err === "string" ? err : "プロファイルの新規作成に失敗しました"
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [invoke, refreshProfiles, options]
  );

  const deleteProfile = useCallback(
    async (profileName: string): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await invoke<ProfileListResponse>("delete-profile", {
          profileName,
        });
        if (res) {
          setProfiles(res.profiles);
          setActiveProfile(res.activeProfile);
        }
        await options?.onProfileChanged?.();
        return true;
      } catch (err) {
        console.error("Failed to delete profile:", err);
        setError(
          typeof err === "string" ? err : "プロファイルの削除に失敗しました"
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [invoke, options]
  );

  return {
    profiles,
    activeProfile,
    isLoading,
    error,
    loadProfile,
    copyProfile,
    copyProfileWithDialog,
    importProfileWithDialog,
    exportProfileWithDialog,
    createProfile,
    deleteProfile,
    refreshProfiles,
    clearError,
  };
}
