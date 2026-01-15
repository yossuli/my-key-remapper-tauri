import type { JSX } from "react";
import React from "react";
import { findWithComponentType } from "@/components/control/index";
import { define } from "@/utils/define";
import type { BaseProps } from ".";

type CaseProps<T extends React.ElementType = typeof React.Fragment> = BaseProps<
  T,
  {
    when: boolean;
    children?: React.ReactNode;
  }
>;

type DefineCaseProps<
  T,
  U extends React.ElementType = typeof React.Fragment,
> = BaseProps<
  U,
  {
    when: T | undefined | null;
    children: (when: T) => React.ReactNode;
  }
>;

export const Case = <T extends React.ElementType = typeof React.Fragment>({
  children,
  as,
  ...props
}: CaseProps<T>) => {
  const Tag = as ?? React.Fragment;
  return <Tag {...props}>{children}</Tag>;
};

export const DefineCase = <
  T,
  U extends React.ElementType = typeof React.Fragment,
>({
  children,
  when,
  as,
  ...props
}: DefineCaseProps<T, U>) => {
  if (!define(when)) {
    return null;
  }
  const Tag = as ?? React.Fragment;
  return <Tag {...props}>{children(when)}</Tag>;
};

export const Default = <T extends React.ElementType = typeof React.Fragment>({
  children,
  as,
  ...props
}: BaseProps<T>) => {
  const Tag = as ?? React.Fragment;
  return <Tag {...props}>{children}</Tag>;
};

export const Switch = ({ children }: { children: JSX.Element[] }) => {
  const match = children.find(
    (child) =>
      (child.type === Case || child.type === DefineCase) &&
      Boolean(child.props.when)
  );

  const defaultCase = findWithComponentType(children, Default);

  return <>{match || defaultCase}</>;
};
