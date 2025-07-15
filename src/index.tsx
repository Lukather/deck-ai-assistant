import { definePlugin } from "@decky/api";
import { FaRobot } from "react-icons/fa";
import AIAssistant from "./components/AIAssistant";

export default definePlugin(() => ({
  name: "AI‑ssistant Deck",
  titleView: <div style={{ padding: "8px", fontSize: "1.2em" }}>AI‑ssistant Deck</div>,
  content: <AIAssistant />,
  icon: <FaRobot />,
}));
