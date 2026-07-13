import { call, toaster } from "@decky/api";
import { Button, Dropdown, Field, PanelSection, TextField } from "@decky/ui";
import { useEffect, useState } from "react";
import { FaCheckCircle, FaKey, FaTimesCircle } from "react-icons/fa";

const SUPPORTED_MODELS = [
	"gemini-2.5-flash",
	"gemini-2.5-pro",
	"gemini-2.0-flash",
	"gemini-2.0-flash-lite",
	"gemini-1.5-flash",
	"gemini-1.5-pro",
];

const modelOptions = SUPPORTED_MODELS.map((m) => ({
	data: m,
	label: m,
}));

interface SaveResult {
	valid: boolean;
	message: string;
}

const SettingsPage = () => {
	const [apiKey, setApiKey] = useState("");
	const [saving, setSaving] = useState(false);
	const [isKeyValid, setIsKeyValid] = useState(false);
	const [model, setModel] = useState("gemini-2.5-flash");
	const [modelSaving, setModelSaving] = useState(false);

	useEffect(() => {
		const init = async () => {
			try {
				const savedKey = await call<[], string>("get_api_key");
				if (savedKey?.trim()) {
					setApiKey(savedKey);
					// Probe the saved key so the badge reflects real validity.
					const valid = await call<[], boolean>("validate_api_key");
					setIsKeyValid(valid);
				}
				const savedModel = await call<[], string>("get_model");
				if (savedModel) setModel(savedModel);
			} catch (error) {
				console.error("Settings init error:", error);
				setIsKeyValid(false);
			}
		};
		init();
	}, []);

	const handleSave = async () => {
		if (!apiKey.trim()) return;
		setSaving(true);
		try {
			const result = await call<[string], SaveResult>(
				"save_api_key",
				apiKey.trim(),
			);
			setIsKeyValid(result.valid);
			toaster.toast({
				title: result.valid ? "Key verified" : "Key invalid",
				body: result.message,
				duration: 5000,
			});
		} catch (error) {
			setIsKeyValid(false);
			toaster.toast({
				title: "Save failed",
				body: "The key was not saved.",
				duration: 5000,
			});
			console.error("Error saving key:", error);
		} finally {
			setSaving(false);
		}
	};

	const handleModelChange = async (data: { data: string }) => {
		const newModel = data.data;
		setModel(newModel);
		setModelSaving(true);
		try {
			await call<[string], string>("set_model", newModel);
		} catch (error) {
			console.error("Error saving model:", error);
		} finally {
			setModelSaving(false);
		}
	};

	return (
		<div style={{ paddingTop: "52px" }}>
			<PanelSection title="AI Settings">
				<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
					<FaKey size={16} />
					<TextField
						value={apiKey}
						onChange={(e) => setApiKey(e.currentTarget.value)}
						disabled={saving}
						style={{ flex: 1, minWidth: 320 }}
					/>
				</div>

				<Button
					style={{
						height: 45,
						display: "flex",
						alignItems: "center",
						gap: 8,
						marginTop: 12,
					}}
					onClick={handleSave}
					disabled={saving || !apiKey.trim()}
				>
					<span style={{ display: "flex", alignItems: "center", gap: 8 }}>
						<span>{saving ? "Saving..." : "Save key"}</span>
					</span>
				</Button>
			</PanelSection>

			<PanelSection title="Gemini Status">
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 8,
						color: isKeyValid ? "#22c55e" : "#f87171",
					}}
				>
					{isKeyValid ? <FaCheckCircle /> : <FaTimesCircle />}
					{isKeyValid ? "API key is valid" : "API key is invalid or missing"}
				</div>
			</PanelSection>

			<PanelSection title="Model">
				<Field
					label="Gemini model"
					description={modelSaving ? "Saving..." : undefined}
				>
					<Dropdown
						rgOptions={modelOptions}
						selectedOption={model}
						onChange={handleModelChange}
						menuLabel="Select model"
						disabled={modelSaving}
					/>
				</Field>
			</PanelSection>
		</div>
	);
};

export default SettingsPage;
