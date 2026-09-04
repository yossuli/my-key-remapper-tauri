import { Check, FileDown, FileUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Dialog } from "@/components/atoms/Dialog";
import { Icon } from "@/components/atoms/Icon";
import { Input } from "@/components/atoms/Input";
import { Text } from "@/components/atoms/Text";
import { ConfirmDialog } from "@/components/molecules/ConfirmDialog";
import { HStack, VStack } from "@/components/template/Flex";

interface ManageProfileDialogProps {
  open: boolean;
  onClose: () => void;
  activeProfile: string;
  profiles: string[];
  onSelectProfile: (name: string) => Promise<boolean>;
  onCreateProfile: (name: string) => Promise<boolean>;
  onDeleteProfile: (name: string) => Promise<boolean>;
  onImportProfile: () => Promise<boolean>;
  onExportProfile: (profileName?: string) => Promise<string | null>;
}

const INVALID_CHARS = ["\\", "/", ":", "*", "?", '"', "<", ">", "|"];
const MAX_PROFILE_NAME_LENGTH = 64;

export function ManageProfileDialog({
  open,
  onClose,
  activeProfile,
  profiles,
  onSelectProfile,
  onCreateProfile,
  onDeleteProfile,
  onImportProfile,
  onExportProfile,
}: ManageProfileDialogProps) {
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileError, setNewProfileError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<string | null>(null);

  const validate = (name: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) {
      return "プロファイル名を入力してください。";
    }
    if (trimmed.length > MAX_PROFILE_NAME_LENGTH) {
      return `プロファイル名は${MAX_PROFILE_NAME_LENGTH}文字以内で入力してください。`;
    }
    if (INVALID_CHARS.some((c) => trimmed.includes(c))) {
      return 'プロファイル名に使用できない文字が含まれています (\\ / : * ? " < > |)';
    }
    if (trimmed === "." || trimmed === "..") {
      return "無効なプロファイル名です。";
    }
    if (profiles.includes(trimmed)) {
      return "同名のプロファイルが既に存在します。";
    }
    return null;
  };

  const handleNewNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewProfileName(val);
    setNewProfileError(validate(val));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate(newProfileName);
    if (err) {
      setNewProfileError(err);
      return;
    }

    setIsCreating(true);
    const success = await onCreateProfile(newProfileName.trim());
    setIsCreating(false);
    if (success) {
      setNewProfileName("");
      setNewProfileError(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!profileToDelete) {
      return;
    }
    const target = profileToDelete;
    setProfileToDelete(null);
    await onDeleteProfile(target);
  };

  const handleImport = async () => {
    await onImportProfile();
  };

  const handleExport = async (name: string) => {
    await onExportProfile(name);
  };

  return (
    <>
      <Dialog onClose={onClose} open={open} title="プロファイル管理">
        <VStack className="mt-2" gap={4}>
          {/* 新規プロファイル作成 */}
          <form onSubmit={handleCreate}>
            <VStack gap={2}>
              <Text size="xs" variant="muted" weight="medium">
                新規プロファイルの作成
              </Text>
              <HStack className="items-start" gap={2}>
                <div className="flex-1">
                  <Input
                    error={newProfileError ?? undefined}
                    id="create-profile-input"
                    input-onChange={handleNewNameChange}
                    input-placeholder="新しいプロファイル名"
                    input-value={newProfileName}
                  />
                </div>
                <Button
                  className="shrink-0 gap-1"
                  disabled={
                    isCreating ||
                    Boolean(newProfileError) ||
                    !newProfileName.trim()
                  }
                  type="submit"
                  variant="default"
                >
                  <Icon icon={Plus} size="sm" />
                  <span>作成</span>
                </Button>
              </HStack>
            </VStack>
          </form>

          {/* プロファイル一覧 */}
          <VStack gap={2}>
            <HStack className="items-center justify-between">
              <Text size="xs" variant="muted" weight="medium">
                プロファイル一覧 ({profiles.length})
              </Text>
              <Button
                className="h-7 gap-1.5 text-xs"
                onClick={handleImport}
                size="sm"
                title="エクスプローラーから外部の .json ファイルを選んで読み込む"
                type="button"
                variant="outline"
              >
                <Icon icon={FileUp} size="sm" />
                <span>ファイルから読み込む</span>
              </Button>
            </HStack>

            <VStack className="max-h-60 overflow-y-auto pr-1" gap={2}>
              {profiles.map((p) => {
                const isActive = p === activeProfile;
                return (
                  <HStack
                    className={`items-center justify-between rounded-lg border p-2 transition-colors ${
                      isActive
                        ? "border-primary/30 bg-primary/5"
                        : "border-border bg-card/50 hover:bg-muted/50"
                    }`}
                    key={p}
                  >
                    <HStack className="min-w-0 items-center" gap={2}>
                      <Text
                        className="truncate"
                        size="sm"
                        weight={isActive ? "bold" : "normal"}
                      >
                        {p}
                      </Text>
                      {isActive ? (
                        <Badge className="py-0 text-[10px]" variant="primary">
                          使用中
                        </Badge>
                      ) : null}
                    </HStack>

                    <HStack gap={1}>
                      {isActive ? null : (
                        <Button
                          className="h-7 text-xs"
                          onClick={() => onSelectProfile(p)}
                          size="sm"
                          variant="ghost"
                        >
                          <Icon className="mr-1" icon={Check} size="sm" />
                          切り替え
                        </Button>
                      )}
                      <Button
                        className="h-7 w-7 p-0 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        onClick={() => handleExport(p)}
                        size="sm"
                        title={`${p} をエクスプローラーで名前を付けて保存（エクスポート）`}
                        variant="ghost"
                      >
                        <Icon icon={FileDown} size="sm" />
                      </Button>
                      <Button
                        className="h-7 w-7 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        disabled={profiles.length <= 1}
                        onClick={() => setProfileToDelete(p)}
                        size="sm"
                        title={
                          profiles.length <= 1
                            ? "最後の1つは削除できません"
                            : `${p} を削除`
                        }
                        variant="ghost"
                      >
                        <Icon icon={Trash2} size="sm" />
                      </Button>
                    </HStack>
                  </HStack>
                );
              })}
            </VStack>
          </VStack>

          <HStack className="justify-end border-t pt-2">
            <Button onClick={onClose} variant="outline">
              閉じる
            </Button>
          </HStack>
        </VStack>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <ConfirmDialog
        description={
          <span>
            プロファイル「<strong>{profileToDelete}</strong>
            」を削除してもよろしいですか？
            <br />
            この操作は取り消せません。
          </span>
        }
        onConfirm={handleConfirmDelete}
        onOpenChange={(isOpen) => !isOpen && setProfileToDelete(null)}
        open={Boolean(profileToDelete)}
        title="プロファイルの削除"
      />
    </>
  );
}
