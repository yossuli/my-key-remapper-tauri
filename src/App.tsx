import { useState } from "react";
import { Case, Default, Switch } from "@/components/control/Switch";
import { KeyRemapperPage } from "@/components/pages/KeyRemapperPage";
import { MacroManagerPage } from "@/components/pages/MacroManagerPage";
import { TrackpadTraceTestPage } from "@/components/pages/TrackpadTraceTestPage";
import { useRemapControl } from "@/hooks/api/useRemapControl";

export type ViewType = "remapper" | "macros" | "trackpad-test";

export default function App() {
  const [view, setView] = useState<ViewType>("remapper");
  const { enableRemap } = useRemapControl();

  const handleBackToRemapper = () => {
    enableRemap(); // 他ページを離れる際に確実にリマップを復帰させる
    setView("remapper");
  };

  return (
    <Switch>
      <Case when={view === "macros"}>
        <MacroManagerPage onBack={handleBackToRemapper} />
      </Case>
      <Case when={view === "trackpad-test"}>
        <TrackpadTraceTestPage onBack={handleBackToRemapper} />
      </Case>
      <Default>
        <KeyRemapperPage
          onNavigateMacros={() => setView("macros")}
          onNavigateTrackpadTest={() => setView("trackpad-test")}
        />
      </Default>
    </Switch>
  );
}
