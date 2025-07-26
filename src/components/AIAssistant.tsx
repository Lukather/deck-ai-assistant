import { useState, useEffect } from "react";
import { Button, Spinner, Router } from "@decky/ui";
import { call } from "@decky/api";
import {
  getInstalledGames,
  getAllGames,
  getGameNameByAppId,
  GameEntry,
} from "../utils/gameNameMap";
import ReactMarkdown from "react-markdown";
import { FaMicrophone, FaMicrophoneSlash, FaStop } from "react-icons/fa";

const AIAssistant = () => {
  const [input, setInput] = useState("");
  const [conversation, setConversation] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [typingText, setTypingText] = useState<string | null>(null);
  const [activeGame, setActiveGame] = useState<{ appid: number; name: string } | null>(null);
  const [games, setGames] = useState<GameEntry[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [speechStatus, setSpeechStatus] = useState<string>("");

  // Check speech recognition status on mount
  useEffect(() => {
    const checkSpeechStatus = async () => {
      try {
        const status = await call<[], string>("get_speech_status");
        setSpeechStatus(status);
        call("log_message", `Speech status: ${status}`);
      } catch (error) {
        call("log_message", `Failed to get speech status: ${error}`);
        setSpeechStatus("Speech recognition not available");
      }
    };
    
    checkSpeechStatus();
  }, []);

  // Fetch games on mount
  useEffect(() => {
    getInstalledGames().then((installed) => {
      if (installed.length > 0) {
        setGames(installed);
      } else {
        setGames(getAllGames());
      }
    });
  }, []);

  // Detect active game using Router.MainRunningApp and SteamClient events, mapping AppID to name
  useEffect(() => {
    let unregister: any = null;
    let cancelled = false;

    // On mount, use Router.MainRunningApp if available
    if (Router.MainRunningApp) {
      const appid = Number(Router.MainRunningApp.appid);
      const name = getGameNameByAppId(appid, games);
      setActiveGame({ appid, name });
    }

    // Listen for game session changes
    if (window.SteamClient?.GameSessions?.RegisterForAppLifetimeNotifications) {
      unregister = window.SteamClient.GameSessions.RegisterForAppLifetimeNotifications((appState: any) => {
        if (cancelled) return;
        if (appState.bRunning) {
          const appid = Number(appState.unAppID);
          const name = getGameNameByAppId(appid, games);
          setActiveGame({ appid, name });
        } else {
          setActiveGame(null);
        }
      });
    }
    return () => {
      cancelled = true;
      if (unregister && unregister.unregister) unregister.unregister();
    };
  }, [games]);

  // Load conversation from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("chatHistory");
    if (saved) {
      setConversation(JSON.parse(saved));
    }
  }, []);

  // Save conversation to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("chatHistory", JSON.stringify(conversation));
  }, [conversation]);

  const handleAsk = async () => {
    if (!input.trim()) return;
    const question = input.trim();

    call("log_message", `Sending question: ${question}`);
    setLoading(true);
    setTypingText(null);
    
    const updatedConversation = [...conversation, { role: "user" as const, text: question }];
    setConversation(updatedConversation);
    setInput("");

    try {
      const payload = activeGame
        ? { question, game: activeGame, conversation: updatedConversation }
        : { question, conversation: updatedConversation };
      const result = await call("ask_question", payload);
      const aiText = typeof result === "string" ? result : "❌ Error: Invalid AI response.";

      call("log_message", `AI response received: ${aiText.substring(0, 100)}...`);

      // Simula digitazione carattere per carattere
      let temp = "";
      setTypingText("");
      for (const char of aiText) {
        temp += char;
        setTypingText(temp);
        await new Promise(res => setTimeout(res, 30)); // Velocità digitazione
      }

      setConversation(prev => [...prev, { role: "ai", text: aiText }]);
      setTypingText(null);
    } catch (err) {
      call("log_message", `Error in handleAsk: ${err}`);
      setTypingText(null);
      setConversation(prev => [...prev, { role: "ai", text: "❌ Error in the request." }]);
    } finally {
      setLoading(false);
    }
  };

  const startListening = async () => {
    if (!isListening) {
      try {
        call("log_message", "Starting speech recognition...");
        const result = await call<[], string>("start_speech_recognition");
        call("log_message", `Start result: ${result}`);
        if (result.includes("started")) {
          setIsListening(true);
        } else {
          call("log_message", `Failed to start: ${result}`);
        }
      } catch (error) {
        call("log_message", `Failed to start speech recognition: ${error}`);
        setIsListening(false);
      }
    } else {
      call("log_message", "Already listening");
    }
  };

  const stopListening = async () => {
    if (isListening) {
      try {
        call("log_message", "Stopping speech recognition...");
        const transcript = await call<[], string>("stop_speech_recognition");
        call("log_message", `Stop result: ${transcript}`);
        
        if (transcript && !transcript.includes("Failed") && !transcript.includes("No speech")) {
          setInput(prev => prev + transcript);
        }
        
        setIsListening(false);
      } catch (error) {
        call("log_message", `Failed to stop speech recognition: ${error}`);
        setIsListening(false);
      }
    } else {
      call("log_message", "Not currently listening");
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
      {/* CSS for pulse animation */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>

      <h2 style={{ margin: 0, fontSize: "1.5em" }}>🎮 AI‑ssistant Deck</h2>

      {/* Active Game Display */}
      <div style={{ marginBottom: 16 }}>
        {activeGame ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: "bold" }}>🎮 Active Game:</span>
            <span>{activeGame.name ? activeGame.name : `AppID: ${activeGame.appid}`}</span>
          </div>
        ) : (
          <div style={{ color: "#888" }}>No active game detected</div>
        )}
      </div>

      {/* Clear Chat History Button */}
      <Button
        onClick={() => {
          setConversation([]);
          localStorage.removeItem("chatHistory");
        }}
        style={{ alignSelf: "flex-end", marginBottom: 8 }}
        disabled={loading || conversation.length === 0}
      >
        Clear Chat
      </Button>

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
               {msg.role === "ai" ? (
                 <ReactMarkdown>{msg.text}</ReactMarkdown>
               ) : (
                 msg.text
               )}
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
              <ReactMarkdown>{typingText}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {/* Input domanda */}
      <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <label style={{ 
            fontSize: "14px", 
            color: "#6b7280", 
            marginBottom: "4px",
            fontWeight: "500"
          }}>
            Question
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Type your question here..."
            style={{
              width: "90%",
              height: "80px",
              padding: "12px",
              border: "1px solid #374151",
              borderRadius: "8px",
              backgroundColor: "#1f2937",
              color: "#f9fafb",
              fontSize: "14px",
              resize: "none",
              fontFamily: "inherit",
              outline: "none"
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAsk();
              }
            }}
          />
        </div>
        
        {/* Microphone Button */}
        {speechStatus.includes("Ready") && (
          <Button
            onClick={isListening ? stopListening : startListening}
            disabled={loading}
            style={{
              paddingTop: "12px",
              height: "80px",
              width: "45px",
              minWidth: "45px",
              backgroundColor: isListening ? "#ef4444" : "#3b82f6",
              border: "none",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
              alignSelf: "stretch"
            }}
          >
            {isListening ? (
              <FaStop size={16} color="white" />
            ) : (
              <FaMicrophone size={16} color="white" />
            )}
          </Button>
        )}
      </div>

      {/* Speech Recognition Status */}
      {speechStatus.includes("Ready") && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "0.9em",
          color: isListening ? "#ef4444" : "#6b7280"
        }}>
          {isListening ? (
            <>
              <div style={{
                width: "8px",
                height: "8px",
                backgroundColor: "#ef4444",
                borderRadius: "50%",
                animation: "pulse 1.5s infinite"
              }} />
              Listening... Speak now
            </>
          ) : (
            <>
              <FaMicrophoneSlash size={12} />
              Click microphone to speak
            </>
          )}
        </div>
      )}

      {/* Speech Recognition Not Supported Warning */}
      {!speechStatus.includes("Ready") && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "0.9em",
          color: "#f59e0b",
          padding: "8px",
          backgroundColor: "#1f2937",
          borderRadius: "6px",
          border: "1px solid #f59e0b"
        }}>
          ⚠️ {speechStatus}
        </div>
      )}

      {/* Pulsante invio */}
      <Button
        onClick={handleAsk}
        disabled={loading || !input.trim()}
        style={{ height: "45px", marginTop: 8, width: "120px" }}
      >
        {loading ? "Asking..." : "Ask"}
      </Button>

      {loading && <Spinner style={{ marginTop: "8px" }} />}
    </div>
  );
};

export default AIAssistant;
