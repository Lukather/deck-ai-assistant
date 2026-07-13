import { call, toaster } from "@decky/api";
import { Button, Router, Spinner, TextField } from "@decky/ui";
import { useEffect, useRef, useState } from "react";
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
	// Monotonic ID per send. Incrementing this aborts the in-flight typing
	// animation: the running effect captures the id at start and bails out if
	// it no longer matches. Keeps exactly one AI bubble per question (#15).
	const turnIdRef = useRef(0);
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

		// Abort any in-flight typing animation: a new turn id makes the
		// running effect bail out, and we commit the previous AI text as-is.
		const myTurnId = ++turnIdRef.current;
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
			const result = await call<[unknown], string>("ask_question", payload);
			if (typeof result !== "string") {
				throw new Error("Invalid AI response.");
			}

			// Type out the AI text. Keyed on turnIdRef so a newer send aborts us.
			setTypingText("");
			let temp = "";
			for (const char of result) {
				if (turnIdRef.current !== myTurnId) return; // aborted by a newer send
				temp += char;
				setTypingText(temp);
				await new Promise((res) => setTimeout(res, 30));
			}
			// Only commit if we weren't aborted mid-animation.
			if (turnIdRef.current === myTurnId) {
				setConversation((prev) => [...prev, { role: "ai", text: result }]);
				setTypingText(null);
			}
		} catch (err) {
			// Aborted by a newer send: leave the new send in charge.
			if (turnIdRef.current !== myTurnId) return;
			setTypingText(null);
			const msg = err instanceof Error ? err.message : "Request failed.";
			toaster.toast({
				title: "Request failed",
				body: msg,
				duration: 5000,
			});
			// No AI bubble appended on failure (#15).
		} finally {
			if (turnIdRef.current === myTurnId) setLoading(false);
		}
	};

	const handleVoiceInput = async () => {
		let started = false;
		try {
			if (isRecording) {
				const transcription = await call<[], string>("stop_voice_recording");
				if (typeof transcription === "string" && transcription.trim()) {
					setInput((prev) => `${prev}${transcription} `);
				}
			} else {
				await call<[], string>("start_voice_recording");
				started = true;
				setIsRecording(true);
			}
		} catch (error) {
			const msg = error instanceof Error ? error.message : "Voice error.";
			toaster.toast({
				title: "Voice error",
				body: msg,
				duration: 5000,
			});
			await call("log_message", `Voice handler error: ${msg}`).catch(() => {});
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
