import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { ConfirmDialog } from "@/components/molecules/ConfirmDialog";
import { HStack } from "@/components/template/Flex";
import { isMockMode } from "@/mock/isMock";
import { resetMockState } from "@/mock/mockStorage";

/**
 * ブラウザ完結モックモード時に表示されるインジケーター
 * エージェントや開発者が現在の状態を確認し、必要に応じて初期データへリセット可能
 */
export function MockModeIndicator() {
  const isMock = isMockMode();
  const [showConfirm, setShowConfirm] = useState(false);

  if (!isMock) {
    return null;
  }

  const handleReset = () => {
    resetMockState();
    // 状態を反映するためにリロード
    window.location.reload();
  };

  return (
    <>
      <HStack
        className="items-center rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs"
        gap={2}
      >
        <Badge
          className="bg-amber-600 font-semibold text-[10px] text-white hover:bg-amber-600"
          variant="primary"
        >
          Mock Mode
        </Badge>
        <span
          className="hidden text-amber-700 text-xs md:inline dark:text-amber-300"
          title="Tauri通信はすべてフロントエンド完結でモックされ、localStorageに永続化されています"
        >
          ブラウザ完結 (localStorage保存中)
        </span>
        <Button
          className="h-6 gap-1 px-1.5 text-[11px] text-amber-800 hover:bg-amber-500/20 dark:text-amber-200"
          onClick={() => setShowConfirm(true)}
          size="sm"
          title="モックデータを初期状態にリセットします"
          variant="ghost"
        >
          <Icon icon={RotateCcw} size="sm" />
          <span>リセット</span>
        </Button>
      </HStack>

      <ConfirmDialog
        description={
          <span>
            モック用のプロファイルおよび設定データを初期状態にリセットしますか？
            <br />
            （現在の localStorage
            の変更内容は破棄され、初期プロファイルが再生成されます）
          </span>
        }
        onConfirm={handleReset}
        onOpenChange={(open) => !open && setShowConfirm(false)}
        open={showConfirm}
        title="モックデータのリセット"
      />
    </>
  );
}
