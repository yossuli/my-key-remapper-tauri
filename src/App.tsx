import { useState } from "react";
import { Else, Ternary, Then } from "@/components/control/Ternary";
import { KeyRemapperPage } from "@/components/pages/KeyRemapperPage";
import { MacroManagerPage } from "@/components/pages/MacroManagerPage";
import { useRemapControl } from "@/hooks/api/useRemapControl";

export type ViewType = "remapper" | "macros";

export default function App() {
  const [view, setView] = useState<ViewType>("remapper");
  const { enableRemap } = useRemapControl();

  const handleBackFromMacros = () => {
    enableRemap(); // マクロ編集ページを離れる際に確実にリマップを復帰させる
    setView("remapper");
  };

  return (
    <Ternary condition={view === "macros"}>
      <Then>
        <MacroManagerPage onBack={handleBackFromMacros} />
      </Then>
      <Else>
        <KeyRemapperPage onNavigateMacros={() => setView("macros")} />
      </Else>
    </Ternary>
  );
}
