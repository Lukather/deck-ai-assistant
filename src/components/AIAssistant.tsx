import { ServerAPI } from "decky-frontend-lib";

import {
    definePlugin,
    PanelSection,
    TextField,
    ButtonItem,
    staticClasses,
  } from "decky-frontend-lib";
  import { useState } from "react";
  
  const AIAssistant = ({ serverAPI }: { serverAPI: ServerAPI }) => {
    const [question, setQuestion] = useState("");
    const [response, setResponse] = useState("");
  
    const handleAsk = async () => {
      const result = await serverAPI.callPluginMethod("ask_question", {
        question: question,
      });
      setResponse(result && typeof result.result === "string" ? result.result : "Nessuna risposta ricevuta");
    };
  
    return (
      <PanelSection title="AI-ssistant Deck">
        <TextField
          label="Fai una domanda all'AI"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <ButtonItem label="Invia" onClick={handleAsk} />
        {response && (
          <div className={staticClasses.Label}>
            <strong>Risposta:</strong> {response}
          </div>
        )}
      </PanelSection>
    );
  };
  
  export default definePlugin((serverApi: ServerAPI) => {
    return {
      title: <div>AI-ssistant Deck</div>, // 👈 lo trasformiamo in elemento React
      content: <AIAssistant serverAPI={serverApi} />,
      icon: <i className="fa fa-robot" /> // 👈 anche l’icona va come elemento
    };
  });