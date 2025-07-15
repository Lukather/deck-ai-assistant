import { definePlugin, routerHook } from "@decky/api";
import { ButtonItem, PanelSection } from "@decky/ui";
import { Navigation } from "@decky/ui";
import { FaRobot } from "react-icons/fa";
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
        <ButtonItem
          label="Impostazioni AI"
          onClick={() => {
            Navigation.Navigate("/ai-settings");
            Navigation.CloseSideMenus();
          }}
        />
        <ButtonItem
          label="Open full-screen AI‑ssistant"
          onClick={() => {
            Navigation.Navigate("/ai-assistant");
            Navigation.CloseSideMenus();
          }}
        />
      </PanelSection>
    ),
    icon: <FaRobot />,
    onDismount() {
      routerHook.removeRoute("/ai-assistant");
      routerHook.removeRoute("/ai-settings");
    },
  };
});