import { definePlugin, routerHook } from "@decky/api";
import { Button, PanelSection } from "@decky/ui";
import { Navigation } from "@decky/ui";
import { FaCog, FaRobot, FaExpand } from "react-icons/fa";
import AIAssistant from "./components/AIAssistant";
import SettingsPage from "./components/SettingsPage";

export default definePlugin(() => {
  routerHook.addRoute("/ai-assistant", AIAssistant, { exact: true });
  routerHook.addRoute("/ai-settings", SettingsPage, { exact: true });

  return {
    name: "deck-ai-assistant",
    titleView: <div style={{ padding: "8px", fontSize: "1.2em" }}>AI‑ssistant Deck</div>,
    content: (
      <PanelSection title="AI‑ssistant Plugin">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Button
          style={{ height: 45, display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={() => {
            Navigation.Navigate("/ai-settings");
            Navigation.CloseSideMenus();
          }}
        >
          <FaCog style={{ marginRight: 8 }} />
          AI Settings
        </Button>
        <Button
          style={{ height: 45, display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={() => {
            Navigation.Navigate("/ai-assistant");
            Navigation.CloseSideMenus();
          }}
        >
          <FaExpand style={{ marginRight: 8 }} />
          Open AI Assistant
        </Button>
        </div>
      </PanelSection>
    ),
    icon: <FaRobot />,
    onDismount() {
      routerHook.removeRoute("/ai-assistant");
      routerHook.removeRoute("/ai-settings");
    },
  };
});