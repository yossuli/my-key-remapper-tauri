import type React from "react";
import type { BaseProps } from "@/components/control";
import { cn } from "@/utils/cn";

type FlexProps<T extends React.ElementType = "div"> = {
  children: React.ReactNode;
  gap?: 1 | 2 | 3 | 4 | 6 | 8;
} & BaseProps<T>;

type StackProps<T extends React.ElementType = "div"> = FlexProps<T>;

type WrapProps<T extends React.ElementType = "div"> = FlexProps<T>;

type ScrollAreaProps<T extends React.ElementType = "div"> = {
  children: React.ReactNode;
  orientation?: "vertical" | "horizontal" | "both";
} & BaseProps<T>;

type CenterProps<T extends React.ElementType = "div"> = {
  children: React.ReactNode;
} & BaseProps<T>;

type BoxProps<T extends React.ElementType = "div"> = {
  children: React.ReactNode;
} & BaseProps<T>;

// gapの値をTailwindクラスにマッピング
const gapMap = {
  1: "gap-1",
  2: "gap-2",
  3: "gap-3",
  4: "gap-4",
  6: "gap-6",
  8: "gap-8",
} as const;

/** 垂直スタック（flex-col） */
export const VStack = <T extends React.ElementType = "div">({
  as,
  children,
  className,
  gap,
  ...props
}: StackProps<T>) => {
  const Tag = as || "div";
  return (
    <Tag
      className={cn(
        "flex flex-col",
        gap !== undefined && gapMap[gap],
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
};

/** 水平スタック（flex-row items-center） */
export const HStack = <T extends React.ElementType = "div">({
  as,
  children,
  className,
  gap,
  ...props
}: StackProps<T>) => {
  const Tag = as || "div";
  return (
    <Tag
      className={cn(
        "flex flex-row items-center",
        gap !== undefined && gapMap[gap],
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
};

/** 中央配置コンテナ */
export const Center = <T extends React.ElementType = "div">({
  as,
  children,
  className,
  ...props
}: CenterProps<T>) => {
  const Tag = as || "div";
  return (
    <Tag
      className={cn("flex items-center justify-center", className)}
      {...props}
    >
      {children}
    </Tag>
  );
};

/** 基本的なボックス（汎用コンテナ） */
export const Box = <T extends React.ElementType = "div">({
  as,
  children,
  className,
  ...props
}: BoxProps<T>) => {
  const Tag = as || "div";
  return (
    <Tag className={cn("", className)} {...props}>
      {children}
    </Tag>
  );
};

/** 折り返しスタック（flex-wrap） */
export const Wrap = <T extends React.ElementType = "div">({
  as,
  children,
  className,
  gap,
  ...props
}: WrapProps<T>) => {
  const Tag = as || "div";
  return (
    <Tag
      className={cn(
        "flex flex-wrap items-center",
        gap !== undefined && gapMap[gap],
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
};

/** スクロールエリア */
export const ScrollArea = <T extends React.ElementType = "div">({
  as,
  children,
  className,
  orientation = "vertical",
  ...props
}: ScrollAreaProps<T>) => {
  const Tag = as || "div";
  const scrollClasses = {
    vertical: "overflow-y-auto overflow-x-hidden",
    horizontal: "overflow-x-auto overflow-y-hidden",
    both: "overflow-auto",
  };

  return (
    <Tag className={cn(scrollClasses[orientation], className)} {...props}>
      {children}
    </Tag>
  );
};
