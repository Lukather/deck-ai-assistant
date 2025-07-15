import { useState } from "react";
import { TextField, ButtonItem, Spinner } from "@decky/ui";
import { call } from "@decky/api";

const AIAssistant = () => {
  const [input, setInput] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const result = await call<[question: string], string>("ask_question", input);
      setResponse(result);
      setInput("");
    } catch (error) {
      setResponse("❌ Errore nella richiesta.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      padding: "24px",
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      overflowY: "auto",
      height: "100%",
      boxSizing: "border-box"
    }}>
      <h2 style={{ margin: 0, fontSize: "1.5em" }}>🎮 AI‑ssistant Deck</h2>

      <TextField
        label="Domanda"
        value={input}
        onChange={(e) => setInput(e.currentTarget.value)}
      />

      <ButtonItem
        label={loading ? "Chiedo..." : "Chiedi"}
        layout="below"
        onClick={handleAsk}
        disabled={loading || !input.trim()}
      />

      {loading && <Spinner style={{ marginTop: "8px" }} />}

      {response && (
        <div style={{
          marginTop: "16px",
          background: "#1f1f1f",
          padding: "12px",
          borderRadius: "8px",
          whiteSpace: "pre-wrap"
        }}>
          {response}
        </div>
      )}
    </div>
  );
};

export default AIAssistant;
