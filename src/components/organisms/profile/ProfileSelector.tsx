import { Copy, FolderGit2, Settings2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { HStack } from "@/components/template/Flex";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UseProfileStateReturn } from "@/hooks/api/useProfileState";
import { ManageProfileDialog } from "./ManageProfileDialog";

interface ProfileSelectorProps {
  profileState: UseProfileStateReturn;
}

export function ProfileSelector({ profileState }: ProfileSelectorProps) {
  const {
    profiles,
    activeProfile,
    loadProfile,
    copyProfileWithDialog,
    importProfileWithDialog,
    exportProfileWithDialog,
    createProfile,
    deleteProfile,
  } = profileState;

  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);

  const handleSelect = async (name: string) => {
    if (name !== activeProfile) {
      await loadProfile(name);
    }
  };

  const handleCopy = async () => {
    // Windows標準のエクスプローラー保存ダイアログで名前と場所を選んで複製
    await copyProfileWithDialog();
  };

  return (
    <>
      <HStack
        className="items-center rounded-lg border bg-card/80 px-2 py-1 shadow-sm"
        gap={2}
      >
        <Icon
          className="ml-1 shrink-0 text-primary/70"
          icon={FolderGit2}
          size="sm"
        />

        <div className="flex items-center">
          <Select onValueChange={handleSelect} value={activeProfile}>
            <SelectTrigger
              className="h-7 min-w-[120px] max-w-[180px] rounded border-0 bg-transparent px-2 font-semibold text-xs shadow-none transition-colors hover:bg-muted/40 focus:ring-0"
              title={`現在のプロファイル: ${activeProfile}`}
            >
              <SelectValue placeholder="プロファイル" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((p) => (
                <SelectItem className="text-xs" key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mx-0.5 h-4 w-[1px] bg-border" />

        <Button
          className="h-7 gap-1 px-2 text-muted-foreground text-xs hover:bg-muted/60 hover:text-foreground"
          onClick={handleCopy}
          size="sm"
          title="エクスプローラーを使って現在のプロファイルを複製保存（場所・名称を選択）"
          variant="ghost"
        >
          <Icon icon={Copy} size="sm" />
          <span className="hidden sm:inline">複製</span>
        </Button>

        <Button
          className="h-7 w-7 p-0 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          onClick={() => setIsManageDialogOpen(true)}
          size="sm"
          title="プロファイル管理（外部ファイル読み込み・新規作成・削除など）"
          variant="ghost"
        >
          <Icon icon={Settings2} size="sm" />
        </Button>
      </HStack>

      <ManageProfileDialog
        activeProfile={activeProfile}
        onClose={() => setIsManageDialogOpen(false)}
        onCreateProfile={createProfile}
        onDeleteProfile={deleteProfile}
        onExportProfile={exportProfileWithDialog}
        onImportProfile={importProfileWithDialog}
        onSelectProfile={loadProfile}
        open={isManageDialogOpen}
        profiles={profiles}
      />
    </>
  );
}
