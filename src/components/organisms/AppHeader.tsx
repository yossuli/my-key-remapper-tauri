import {
  Eye,
  EyeOff,
  Keyboard,
  List,
  Power,
  Settings,
} from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { Text } from "@/components/atoms/Text";
import { With } from "@/components/control/With";
import { Box, HStack, VStack } from "@/components/template/Flex";

interface AppHeaderProps {
  isActive: boolean;
  onToggleActive: () => void;
  /** シンプル表示モード */
  simpleMode?: boolean;
  /** シンプルモード切り替えコールバック */
  onToggleSimpleMode?: () => void;
  /** グローバル設定を開くコールバック */
  onOpenSettings: () => void;
  /** マクロ管理を開くコールバック */
  onOpenMacros: () => void;
}

export function AppHeader({
  isActive, // 🆕 → 🔥 (E. App Header Control)
  onToggleActive, // 🆕 → 🔥 (E. App Header Control)
  simpleMode, // 🆕 → 🔥 (E. App Header Control)
  onToggleSimpleMode, // 🆕 → 🔥 (E. App Header Control)
  onOpenSettings, // 🆕 → 🔥 (E. App Header Control)
  onOpenMacros,
}: AppHeaderProps) {
  const icon = simpleMode ? Eye : EyeOff;
  return (
    <HStack as="header" className="mb-8 justify-between">
      <HStack gap={3}>
        <Box className="rounded-lg bg-primary/10 p-2">
          <Icon className="text-primary" icon={Keyboard} size="lg" />
        </Box>
        <VStack>
          <Text as="h1" className="tracking-tight" size="xl" weight="bold">
            Key Remapper
          </Text>
          <Text size="xs" variant="muted">
            Windows Native Hook
          </Text>
        </VStack>
      </HStack>

      <HStack gap={2}>
        <With value={onOpenMacros}>
          {(onClick) => (
            <Button
              className="gap-2 rounded-full"
              onClick={onClick}
              variant="ghost"
            >
              <Icon icon={List} />
              マクロ管理
            </Button>
          )}
        </With>
        <With value={onOpenSettings}>
          {(onClick) => (
            <Button
              className="gap-2 rounded-full"
              onClick={onClick}
              variant="ghost"
            >
              <Icon icon={Settings} />
              グローバル設定
            </Button>
          )}
        </With>
        <With value={onToggleSimpleMode}>
          {(onClick) => (
            <Button
              className="gap-2 rounded-full"
              onClick={onClick}
              variant="ghost"
            >
              <Icon icon={icon} />
              {simpleMode ? "詳細表示" : "シンプル表示"}
            </Button>
          )}
        </With>
        <Button
          className="gap-2 rounded-full"
          onClick={onToggleActive}
          size="default"
          variant={isActive ? "default" : "destructive"}
        >
          <Icon icon={Power} />
          {isActive ? "Active" : "Disabled"}
        </Button>
      </HStack>
    </HStack>
  );
}
