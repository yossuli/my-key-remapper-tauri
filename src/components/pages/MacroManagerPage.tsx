import { Keyboard } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { Text } from "@/components/atoms/Text";
import { MacroManager } from "@/components/organisms/macro/MacroManager";
import { Box, HStack, VStack } from "@/components/template/Flex";
import { Header, Main, MainLayout } from "@/components/template/MainLayout";

interface MacroManagerPageProps {
  onBack: () => void;
}

export function MacroManagerPage({ onBack }: MacroManagerPageProps) {
  return (
    <MainLayout fullWidth>
      <Header>
        <HStack as="header" className="mb-8 justify-between">
          <HStack gap={3}>
            <Box className="rounded-lg bg-primary/10 p-2">
              <Icon className="text-primary" icon={Keyboard} size="lg" />
            </Box>
            <VStack>
              <Text as="h1" className="tracking-tight" size="xl" weight="bold">
                マクロ管理
              </Text>
              <Text size="xs" variant="muted">
                Macro & Sequence Management
              </Text>
            </VStack>
          </HStack>

          <Button onClick={onBack} variant="ghost">
            キーリマップ画面に戻る
          </Button>
        </HStack>
      </Header>
      <Main>
        <div className="h-full">
          <MacroManager />
        </div>
      </Main>
    </MainLayout>
  );
}
