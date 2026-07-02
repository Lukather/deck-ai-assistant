import { call } from "@decky/api";
import { Button, Router, Spinner, TextField } from "@decky/ui";
import { useEffect, useState } from "react";
import { FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";
import {
	type GameEntry,
	getGameNameByAppId,
	getInstalledGames,
} from "../utils/gameNameMap";

const STORAGE_KEY = "deck-ai-assistant:chatHistory";
const LEGACY_STORAGE_KEY = "chatHistory";

// Minimal local type for the SteamClient GameSessions notification payload.
// The full shape is not exposed in any public type declaration; we only
// touch two fields, so this captures what we actually use.
type AppLifetimeNotification = { bRunning: boolean; unAppID: number };

// Sanitization schema for AI-generated markdown
// Allows safe markdown elements while blocking XSS vectors
// Sanitization schema for AI-generated markdown
// Allows safe markdown elements while blocking XSS vectors

const AIAssistant = () => {
	const [input, setInput] = useState("");
	const [conversation, setConversation] = useState<
		{ role: "user" | "ai"; text: string }[]
	>([]);
	const [loading, setLoading] = useState(false);
	const [typingText, setTypingText] = useState<string | null>(null);
	const [activeGame, setActiveGame] = useState<{
		appid: number;
		name: string;
	} | null>(null);
	const [games, setGames] = useState<GameEntry[]>([]);
	const [isRecording, setIsRecording] = useState(false);
	const [speechSupported, setSpeechSupported] = useState(false);

	// Fetch games on mount
	useEffect(() => {
		getInstalledGames().then(setGames);
	}, []);

	// Detect active game using Router.MainRunningApp and SteamClient events, mapping AppID to name
	useEffect(() => {
		// biome-ignore lint/suspicious/noExplicitAny: SteamClient GameSessions unregister handle has no exported type
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
			unregister =
				window.SteamClient.GameSessions.RegisterForAppLifetimeNotifications(
					(appState: AppLifetimeNotification) => {
						if (cancelled) return;
						if (appState.bRunning) {
							const appid = Number(appState.unAppID);
							const name = getGameNameByAppId(appid, games);
							setActiveGame({ appid, name });
						} else {
							setActiveGame(null);
						}
					},
				);
		}
		return () => {
			cancelled = true;
			unregister?.unregister?.();
		};
	}, [games]);

	// Update active game name when games list is loaded (in case game was detected before games were fetched)
	useEffect(() => {
		if (
			games.length > 0 &&
			activeGame &&
			activeGame.name.startsWith("AppID:")
		) {
			const name = getGameNameByAppId(activeGame.appid, games);
			setActiveGame({ appid: activeGame.appid, name });
		}
	}, [games, activeGame]);

	// Load conversation from localStorage on mount (with one-time migration from the legacy key)
	useEffect(() => {
		const newSaved = localStorage.getItem(STORAGE_KEY);
		if (newSaved) {
			setConversation(JSON.parse(newSaved));
			if (localStorage.getItem(LEGACY_STORAGE_KEY) !== null) {
				localStorage.removeItem(LEGACY_STORAGE_KEY);
			}
			return;
		}
		const legacySaved = localStorage.getItem(LEGACY_STORAGE_KEY);
		if (legacySaved) {
			setConversation(JSON.parse(legacySaved));
			localStorage.setItem(STORAGE_KEY, legacySaved);
			localStorage.removeItem(LEGACY_STORAGE_KEY);
		}
	}, []);

	// Save conversation to localStorage whenever it changes
	useEffect(() => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(conversation));
	}, [conversation]);

	// Initialize backend voice recording
	useEffect(() => {
		setSpeechSupported(true);
	}, []);

	const handleAsk = async () => {
		if (!input.trim()) return;
		const question = input.trim();

		setLoading(true);
		setTypingText(null);
		// Prepare the new conversation including the new user message
		const updatedConversation = [
			...conversation,
			{ role: "user" as const, text: question },
		];
		setConversation(updatedConversation);
		setInput("");

		try {
			const payload = activeGame
				? { question, game: activeGame, conversation: updatedConversation }
				: { question, conversation: updatedConversation };
			const result = await call("ask_question", payload);
			const aiText =
				typeof result === "string" ? result : "❌ Error: Invalid AI response.";

			// Simula digitazione carattere per carattere
			let temp = "";
			setTypingText("");
			for (const char of aiText) {
				temp += char;
				setTypingText(temp);
				await new Promise((res) => setTimeout(res, 30)); // Velocità digitazione
			}

			setConversation((prev) => [...prev, { role: "ai", text: aiText }]);
			setTypingText(null);
		} catch (err) {
			setTypingText(null);
			setConversation((prev) => [
				...prev,
				{ role: "ai", text: "❌ Error in the request." },
			]);
			console.error(err);
		} finally {
			setLoading(false);
		}
	};

	const handleVoiceInput = async () => {
		let started = false;
		try {
			if (isRecording) {
				const transcription = (await call("stop_voice_recording")) as string;
				if (
					transcription &&
					typeof transcription === "string" &&
					!transcription.startsWith("Error")
				) {
					setInput((prev) => `${prev}${transcription} `);
				}
			} else {
				const result = (await call("start_voice_recording")) as string;
				if (
					result &&
					typeof result === "string" &&
					result.startsWith("Error")
				) {
					throw new Error(result);
				}
				started = true;
				setIsRecording(true);
			}
		} catch (error) {
			await call("log_message", `Voice handler error: ${error}`);
		} finally {
			if (!started) setIsRecording(false);
		}
	};

	return (
		<div
			style={{
				padding: "24px",
				paddingTop: "56px",
				display: "flex",
				flexDirection: "column",
				gap: "16px",
				height: "100%",
				boxSizing: "border-box",
				overflowY: "auto",
			}}
		>
			<h2 style={{ margin: 0, fontSize: "1.5em" }}>🎮 AI‑ssistant Deck</h2>

			{/* Active Game Display */}
			<div style={{ marginBottom: 16 }}>
				{activeGame ? (
					<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
						<span style={{ fontWeight: "bold" }}>🎮 Active Game:</span>
						<span>
							{activeGame.name ? activeGame.name : `AppID: ${activeGame.appid}`}
						</span>
					</div>
				) : (
					<div style={{ color: "#888" }}>No active game detected</div>
				)}
			</div>

			{/* Clear Chat History Button */}
			<Button
				onClick={() => {
					setConversation([]);
					localStorage.removeItem(STORAGE_KEY);
				}}
				style={{ alignSelf: "flex-end", marginBottom: 8 }}
				disabled={loading || conversation.length === 0}
			>
				Clear Chat
			</Button>

			{/* Conversazione */}
			<div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
				{conversation.map((msg, idx) => (
					<div
						key={idx}
						style={{
							display: "flex",
							flexDirection: msg.role === "user" ? "row-reverse" : "row",
							gap: "12px",
							alignItems: "flex-start",
						}}
					>
						{/* Avatar */}
						<span style={{ fontSize: "1.5em" }}>
							{msg.role === "user" ? "🧑" : "🤖"}
						</span>

						{/* Bubble */}
						<div
							style={{
								backgroundColor: msg.role === "user" ? "#1e3a8a" : "#334155",
								padding: "12px",
								borderRadius: "12px",
								borderTopRightRadius: msg.role === "user" ? "0px" : "12px",
								borderTopLeftRadius: msg.role === "user" ? "12px" : "0px",
								color: "#f1f5f9",
								maxWidth: "80%",
								whiteSpace: "pre-wrap",
							}}
						>
							{msg.role === "ai" ? msg.text : msg.text}
						</div>
					</div>
				))}

				{/* Digitazione AI */}
				{typingText && (
					<div
						style={{
							display: "flex",
							gap: "12px",
							alignItems: "flex-start",
						}}
					>
						<span style={{ fontSize: "1.5em" }}>🤖</span>
						<div
							style={{
								backgroundColor: "#334155",
								padding: "12px",
								borderRadius: "12px",
								borderTopLeftRadius: "0px",
								color: "#f1f5f9",
								maxWidth: "80%",
								whiteSpace: "pre-wrap",
							}}
						>
							{typingText}
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
							backgroundColor: isRecording ? "#dc2626" : undefined,
						}}
					>
						{isRecording ? <FaMicrophoneSlash /> : <FaMicrophone />}
					</Button>
				)}
			</div>

			{/* Status indicator for recording */}
			{isRecording && (
				<div
					style={{
						color: "#dc2626",
						fontSize: "0.9em",
						textAlign: "center",
						fontWeight: "bold",
					}}
				>
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
