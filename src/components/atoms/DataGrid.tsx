import type React from "react";
import type { JSX } from "react";
import { Mapped } from "@/components/control/Mapped";
import { cn } from "@/utils/cn";

export interface ColumnDef {
  id: string;
  label: string;
  align?: "left" | "center" | "right";
  /**
   * grid-template-columns に指定する値 (例: "1fr", "6rem")
   * 指定がない場合は "1fr" とする
   */
  grid?: string;
}

/**
 * [Workflow-029] に基づく型安全なグリッドリスト
 * ヘッダーの要素数とデータ行の要素数を型レベルで同期させます。
 */
interface DataGridProps<T, H extends readonly ColumnDef[]> {
  /**
   * リストに表示するデータ配列
   */
  value: T[];
  /**
   * ヘッダー定義。
   * この配列の長さが、children が返すタプルの長さとして強制されます。
   */
  headers: H extends unknown[]
    ? "Error: headers must be readonly (use 'as const')"
    : H;
  /**
   * データ行のレンダラー。
   * DataGrid.Row を返すと型レベルで表が適切であることを検証できます。
   */
  children: (item: T, headers: H) => JSX.Element;
  className?: string;
  /**
   * 最初の子要素がホバーされたときに、行全体の背景色をハイライトするか
   */
  highlightOnFirstChildHover?: boolean;
}

export const DataGrid = <
  T extends { id: string | number },
  H extends readonly ColumnDef[],
>({
  value,
  headers,
  children,
  className,
  highlightOnFirstChildHover = false,
}: DataGridProps<T, H>) => {
  // 制約付き型 H を安全に扱うためキャスト
  const safeHeaders = headers as unknown as H;

  if (children(value[0], safeHeaders).type !== DataGrid.Row) {
    return;
  }
  return (
    <div
      className={cn(
        "grid w-full overflow-hidden rounded-md border border-border bg-background",
        className
      )}
      style={{
        gridTemplateColumns: safeHeaders.map((h) => h.grid ?? "1fr").join(" "),
      }}
    >
      <GridHeader headers={safeHeaders} />

      <Mapped
        as="div"
        className="col-span-full grid grid-cols-subgrid divide-y divide-border"
        value={value}
      >
        {(item) => (
          <div
            className={cn(
              "col-span-full grid grid-cols-subgrid items-center px-4 py-3 transition-colors",
              highlightOnFirstChildHover
                ? "has-[>*:first-child:hover]:bg-muted/50"
                : null
            )}
          >
            {children(item, safeHeaders)}
          </div>
        )}
      </Mapped>
    </div>
  );
};

const GridHeader = <H extends readonly ColumnDef[]>({
  headers,
}: {
  headers: H;
}) => (
  <Mapped
    as="div"
    className="col-span-full grid grid-cols-subgrid items-center border-border border-b bg-muted px-4 py-3 text-muted-foreground text-xs uppercase"
    value={headers}
  >
    {(header) => (
      <div
        className={cn({
          "text-left": !header.align || header.align === "left",
          "text-center": header.align === "center",
          "text-right": header.align === "right",
        })}
      >
        {header.label}
      </div>
    )}
  </Mapped>
);

DataGrid.Row = <
  H extends
    | readonly ColumnDef[]
    | "Error: headers must be readonly (use 'as const')",
>({
  headers: _,
  children,
}: {
  headers: H;
  children: {
    [K in keyof H]: React.ReactNode;
  };
}) => children;
