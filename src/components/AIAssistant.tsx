import { useState } from "react";
import { PanelSection, PanelSectionRow, TextField, ButtonItem, Spinner } from "@decky/ui";
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
      setResponse("Errore nella richiesta.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PanelSection title="AI‑ssistant Deck">
      <PanelSectionRow>
        <TextField label="Domanda" value={input} onChange={(e) => setInput(e.currentTarget.value)} />
      </PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" label="Chiedi" onClick={handleAsk} />
      </PanelSectionRow>
      {loading && (
        <PanelSectionRow>
          <Spinner />
        </PanelSectionRow>
      )}
      {response && (
        <PanelSectionRow>
          <div style={{ whiteSpace: "pre-wrap" }}>{response}</div>
        </PanelSectionRow>
      )}
    </PanelSection>
  );
};

export default AIAssistant;
