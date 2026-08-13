import { Mapped } from "@/components/control/Mapped";
import { Case, Default, Switch } from "@/components/control/Switch";

/**
 * 簡易的なマークダウン記法パーサー
 * **text**: 太字 + プライマリーカラー
 * ((text)): 補足情報（薄い文字）
 * [[text]]: リンク/ID（青文字）
 */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*.*?\*\*|\(\(.*\)\)|\[\[.*\]\])/g);
  // Mappedコンポーネントのキー要件を満たすためにオブジェクト配列に変換
  const items = parts.map((part, i) => ({ id: i, part }));

  return (
    <Mapped as="span" value={items}>
      {({ part }) => (
        <Switch>
          <Case when={part.startsWith("**") && part.endsWith("**")}>
            <span className="font-bold text-primary">{part.slice(2, -2)}</span>
          </Case>
          <Case when={part.startsWith("((") && part.endsWith("))")}>
            <span className="ml-2 text-muted-foreground text-xs opacity-80">
              {part.slice(2, -2)}
            </span>
          </Case>
          <Case when={part.startsWith("[[") && part.endsWith("]]")}>
            <span className="font-mono text-blue-400">{part.slice(2, -2)}</span>
          </Case>
          <Default>{part}</Default>
        </Switch>
      )}
    </Mapped>
  );
}
