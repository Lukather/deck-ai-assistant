import { definePlugin, routerHook } from "@decky/api";
import { ButtonItem, PanelSection } from "@decky/ui";
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
        <ButtonItem layout="below"
          label={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FaCog />
              <span>AI Settings</span>
            </div>
          }
          onClick={() => {
            Navigation.Navigate("/ai-settings");
            Navigation.CloseSideMenus();
          }}
        />
        <ButtonItem layout="below"
          label={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FaExpand />
              <strong>Open AI Assistant</strong>
            </div>
          }
          onClick={() => {
            Navigation.Navigate("/ai-assistant");
            Navigation.CloseSideMenus();
          }}
        />
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