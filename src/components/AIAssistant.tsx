import { useState } from "react";
import { TextField, ButtonItem, Spinner } from "@decky/ui";
import { call } from "@decky/api";
//import ReactMarkdown from "react-markdown";


const AIAssistant = () => {
  const [input, setInput] = useState("");
  const [conversation, setConversation] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [typingText, setTypingText] = useState<string | null>(null);

  const handleAsk = async () => {
    if (!input.trim()) return;
    const question = input.trim();

    setLoading(true);
    setTypingText(null);
    setConversation(prev => [...prev, { role: "user", text: question }]);
    setInput("");

    try {
      const result = await call<[string], string>("ask_question", question);

      // Simula digitazione carattere per carattere
      let temp = "";
      setTypingText("");
      for (const char of result) {
        temp += char;
        setTypingText(temp);
        await new Promise(res => setTimeout(res, 20)); // Velocità digitazione
      }

      setConversation(prev => [...prev, { role: "ai", text: result }]);
      setTypingText(null);
    } catch (err) {
      setTypingText(null);
      setConversation(prev => [...prev, { role: "ai", text: "❌ Error in the request." }]);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      padding: "24px",
      paddingTop: "56px",
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      height: "100%",
      boxSizing: "border-box",
      overflowY: "auto"
    }}>
      <h2 style={{ margin: 0, fontSize: "1.5em" }}>🎮 AI‑ssistant Deck</h2>

      {/* Conversazione */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {conversation.map((msg, idx) => (
          <div key={idx} style={{
            display: "flex",
            flexDirection: msg.role === "user" ? "row-reverse" : "row",
            gap: "12px",
            alignItems: "flex-start"
          }}>
            {/* Avatar */}
            <span style={{ fontSize: "1.5em" }}>
              {msg.role === "user" ? "🧑" : "🤖"}
            </span>

            {/* Bubble */}
            <div style={{
              backgroundColor: msg.role === "user" ? "#1e3a8a" : "#334155",
              padding: "12px",
              borderRadius: "12px",
              borderTopRightRadius: msg.role === "user" ? "0px" : "12px",
              borderTopLeftRadius: msg.role === "user" ? "12px" : "0px",
              color: "#f1f5f9",
              maxWidth: "80%",
              whiteSpace: "pre-wrap"
            }}>
               {msg.text}
            </div>
          </div>
        ))}

        {/* Digitazione AI */}
        {typingText && (
          <div style={{
            display: "flex",
            gap: "12px",
            alignItems: "flex-start"
          }}>
            <span style={{ fontSize: "1.5em" }}>🤖</span>
            <div style={{
              backgroundColor: "#334155",
              padding: "12px",
              borderRadius: "12px",
              borderTopLeftRadius: "0px",
              color: "#f1f5f9",
              maxWidth: "80%",
              whiteSpace: "pre-wrap"
            }}>
              {typingText}
            </div>
          </div>
        )}
      </div>

      {/* Input domanda */}
      <TextField
        label="Question"
        value={input}
        onChange={(e) => setInput(e.currentTarget.value)}
        disabled={loading}
      />

      {/* Pulsante invio */}
      <ButtonItem
        label={loading ? "Asking..." : "Ask"}
        layout="below"
        onClick={handleAsk}
        disabled={loading || !input.trim()}
      />

      {loading && <Spinner style={{ marginTop: "8px" }} />}
    </div>
  );
};

export default AIAssistant;
