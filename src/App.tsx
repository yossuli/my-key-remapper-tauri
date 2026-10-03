import { useState } from "react";
import { Case, Default, Switch } from "@/components/control/Switch";
import { DiagnosticRecorder } from "@/components/DiagnosticRecorder";
import { KeyRemapperPage } from "@/components/pages/KeyRemapperPage";
import { MacroManagerPage } from "@/components/pages/MacroManagerPage";
import { useRemapControl } from "@/hooks/api/useRemapControl";

export type ViewType = "remapper" | "macros";

export default function App() {
  const [view, setView] = useState<ViewType>("remapper");
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);
  const { enableRemap } = useRemapControl();

  const handleBackToRemapper = () => {
    enableRemap(); // 他ページを離れる際に確実にリマップを復帰させる
    setView("remapper");
  };

  return (
    <>
      <DiagnosticRecorder
        onOpenChange={setDiagnosticOpen}
        open={diagnosticOpen}
      />
      <Switch>
        <Case when={view === "macros"}>
          <MacroManagerPage onBack={handleBackToRemapper} />
        </Case>
        <Default>
          <KeyRemapperPage
            onNavigateMacros={() => setView("macros")}
          />
        </Default>
      </Switch>
    </>
  );
}
