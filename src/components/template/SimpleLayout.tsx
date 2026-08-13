import type React from "react";
import type { JSX } from "react";
import { type BaseProps, findWithComponentType } from "@/components/control";

interface SimpleLayoutProps {
  children: JSX.Element[];
}

export const Header: React.FC<BaseProps> = ({ children }) => <>{children}</>;

export const Content: React.FC<BaseProps> = ({ children }) => <>{children}</>;

/**
 * シンプルレイアウト (Header + Content)
 * simpleMode 時に使用
 */
export const SimpleLayout: React.FC<SimpleLayoutProps> = ({ children }) => {
  const header = findWithComponentType(children, Header);
  const content = findWithComponentType(children, Content);

  return (
    <div className="flex min-h-screen flex-col bg-background p-6 font-sans text-foreground">
      {header}
      <main className="flex-1">{content}</main>
    </div>
  );
};
