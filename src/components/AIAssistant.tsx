import { useState, useEffect } from "react";
import { TextField, Button, Spinner, Router } from "@decky/ui";
import { call } from "@decky/api";
import {
  getInstalledGames,
  getAllGames,
  getGameNameByAppId,
  GameEntry,
} from "../utils/gameNameMap";
import ReactMarkdown from "react-markdown";
import { FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";


const AIAssistant = () => {
  const [input, setInput] = useState("");
  const [conversation, setConversation] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [typingText, setTypingText] = useState<string | null>(null);
  const [activeGame, setActiveGame] = useState<{ appid: number; name: string } | null>(null);
  const [games, setGames] = useState<GameEntry[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

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

    // Only proceed if games array has been loaded
    if (games.length === 0) return;

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

  // Update active game name when games list is loaded (in case game was detected before games were fetched)
  useEffect(() => {
    if (games.length > 0 && activeGame && activeGame.name.startsWith('AppID:')) {
      const name = getGameNameByAppId(activeGame.appid, games);
      setActiveGame({ appid: activeGame.appid, name });
    }
  }, [games, activeGame]);

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

  // Initialize backend voice recording  
  useEffect(() => {
    const initVoice = async () => {
      await call("log_message", "Initializing backend voice recording...");
      setSpeechSupported(true); // Always supported via backend
      await call("log_message", "Backend voice recording initialized successfully");
    };

    initVoice();
  }, []);

  const handleAsk = async () => {
    if (!input.trim()) return;
    const question = input.trim();

    setLoading(true);
    setTypingText(null);
    // Prepare the new conversation including the new user message
    const updatedConversation = [...conversation, { role: "user" as const, text: question }];
    setConversation(updatedConversation);
    setInput("");

    try {
      const payload = activeGame
        ? { question, game: activeGame, conversation: updatedConversation }
        : { question, conversation: updatedConversation };
      const result = await call("ask_question", payload);
      const aiText = typeof result === "string" ? result : "❌ Error: Invalid AI response.";

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
      setTypingText(null);
      setConversation(prev => [...prev, { role: "ai", text: "❌ Error in the request." }]);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceInput = async () => {
    await call("log_message", `Voice button clicked - isRecording: ${isRecording}`);
    
    try {
      if (isRecording) {
        await call("log_message", "Stopping backend voice recording...");
        setIsRecording(false);
        
        // Call backend to stop recording and get transcription
        const transcription = await call("stop_voice_recording") as string;
        await call("log_message", `Backend transcription result: "${transcription}"`);
        
        if (transcription && typeof transcription === 'string' && !transcription.startsWith("Error")) {
          setInput(prev => prev + transcription + ' ');
          await call("log_message", "Added transcription to input field");
        }
      } else {
        await call("log_message", "Starting backend voice recording...");
        setIsRecording(true);
        
        // First test if we can call voice methods at all
        try {
          const testResult = await call("test_voice_method") as string;
          await call("log_message", `Test method result: "${testResult}"`);
        } catch (testError) {
          await call("log_message", `Test method error: ${testError}`);
        }
        
        // Call backend to start recording
        const result = await call("start_voice_recording") as string;
        await call("log_message", `Backend start result: "${result}"`);
        
        if (result && typeof result === 'string' && result.startsWith("Error")) {
          setIsRecording(false);
          await call("log_message", "Failed to start backend recording");
        }
      }
    } catch (error) {
      await call("log_message", `Error in handleVoiceInput: ${error}`);
      setIsRecording(false);
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

      {/* Input section with voice button */}
      <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <TextField
            label="Question"
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            disabled={loading}
          />
        </div>
        
        {speechSupported && (
          <Button
            onClick={handleVoiceInput}
            disabled={loading}
            style={{ 
              paddingTop: "-12px",
              height: "40px", 
              width: "45px", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              backgroundColor: isRecording ? "#dc2626" : undefined
            }}
          >
            {isRecording ? <FaMicrophoneSlash /> : <FaMicrophone />}
          </Button>
        )}
      </div>

      {/* Status indicator for recording */}
      {isRecording && (
        <div style={{ 
          color: "#dc2626", 
          fontSize: "0.9em", 
          textAlign: "center",
          fontWeight: "bold"
        }}>
          🔴 Recording... Speak now
        </div>
      )}

      {/* Send button */}
      <Button
        onClick={handleAsk}
        disabled={loading || !input.trim()}
        style={{ height: "45px", marginTop: 8, width: "120px" }}
      >
        {loading ? "Asking..." : "Send"}
      </Button> 

      {loading && <Spinner style={{ marginTop: "8px" }} />}
    </div>
  );
};

export default AIAssistant;
