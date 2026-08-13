import type { ReactNode } from "react";
import { VStack } from "@/components/atoms/primitives/Flex";
import {
  Header,
  Main,
  MainLayout,
  Side,
} from "@/components/template/MainLayout";
import {
  Content,
  Header as SimpleHeader,
  SimpleLayout,
} from "@/components/template/SimpleLayout";

interface KeyRemapperLayoutProps {
  simpleMode: boolean;
  header: ReactNode;
  main?: ReactNode;
  statusPanel: ReactNode;
  debugPanel: ReactNode;
  logList?: ReactNode;
}

/**
 * KeyRemapper専用の中間テンプレート
 * simpleMode に応じて MainLayout または SimpleLayout を使い分ける
 */
export function KeyRemapperLayout({
  simpleMode,
  header,
  main,
  statusPanel,
  debugPanel,
  logList,
}: KeyRemapperLayoutProps) {
  if (simpleMode) {
    return (
      <SimpleLayout>
        <SimpleHeader>{header}</SimpleHeader>
        <Content>
          <VStack gap={4}>
            {statusPanel}
            {debugPanel}
          </VStack>
        </Content>
      </SimpleLayout>
    );
  }

  return (
    <MainLayout>
      <Header>{header}</Header>
      <Main>{main}</Main>
      <Side>
        <VStack gap={4}>
          {statusPanel}
          {debugPanel}
          {logList}
        </VStack>
      </Side>
    </MainLayout>
  );
}
