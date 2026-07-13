import { call, toaster } from "@decky/api";
import { Button, Dropdown, Field, PanelSection, TextField } from "@decky/ui";
import { useEffect, useState } from "react";
import { FaCheckCircle, FaKey, FaTimesCircle } from "react-icons/fa";

const PROVIDERS = ["gemini", "openrouter", "infomaniak"];

const providerOptions = PROVIDERS.map((p) => ({ data: p, label: p }));

interface SaveResult {
	valid: boolean;
	message: string;
}

const SettingsPage = () => {
	const [provider, setProvider] = useState("gemini");
	const [apiKey, setApiKey] = useState("");
	const [saving, setSaving] = useState(false);
	const [isKeyValid, setIsKeyValid] = useState(false);
	const [model, setModel] = useState("gemini-2.5-flash");
	const [models, setModels] = useState<string[]>([]);
	const [modelSaving, setModelSaving] = useState(false);
	const [customModel, setCustomModel] = useState("");
	const [productId, setProductId] = useState("");

	useEffect(() => {
		const init = async () => {
			try {
				const savedProvider = await call<[], string>("get_provider");
				if (savedProvider) setProvider(savedProvider);

				const savedKey = await call<[], string>("get_api_key");
				if (savedKey?.trim()) {
					setApiKey(savedKey);
					const valid = await call<[], boolean>("validate_api_key");
					setIsKeyValid(valid);
				}

				const savedModel = await call<[], string>("get_model");
				if (savedModel) setModel(savedModel);

				const modelList = await call<[], string[]>("get_models");
				if (modelList) setModels(modelList);

				const savedCustom = await call<[], string>("get_custom_model");
				if (savedCustom) setCustomModel(savedCustom);

				const savedProductId = await call<[], string>("get_product_id");
				if (savedProductId) setProductId(savedProductId);
			} catch (error) {
				console.error("Settings init error:", error);
				setIsKeyValid(false);
			}
		};
		init();
	}, []);

	const refreshModels = async () => {
		try {
			const modelList = await call<[], string[]>("get_models");
			if (modelList) setModels(modelList);
			const savedModel = await call<[], string>("get_model");
			if (savedModel) setModel(savedModel);
		} catch (error) {
			console.error("Error refreshing models:", error);
		}
	};

	const handleProviderChange = async (data: { data: string }) => {
		const newProvider = data.data;
		setProvider(newProvider);
		setIsKeyValid(false);
		setCustomModel("");
		try {
			await call<[string], string>("set_provider", newProvider);
			await refreshModels();
			toaster.toast({
				title: "Provider switched",
				body: `Now using ${newProvider}. Enter your API key.`,
				duration: 4000,
			});
		} catch (error) {
			console.error("Error switching provider:", error);
		}
	};

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

	const handleCustomModelSave = async () => {
		if (!customModel.trim()) return;
		try {
			await call<[string], string>("set_custom_model", customModel.trim());
			toaster.toast({
				title: "Custom model saved",
				body: customModel.trim(),
				duration: 3000,
			});
		} catch (error) {
			console.error("Error saving custom model:", error);
		}
	};

	const handleProductIdSave = async () => {
		if (!productId.trim()) return;
		try {
			await call<[string], string>("set_product_id", productId.trim());
			toaster.toast({
				title: "Product ID saved",
				body: productId.trim(),
				duration: 3000,
			});
		} catch (error) {
			console.error("Error saving product ID:", error);
		}
	};

	const modelOptions = models.map((m) => ({ data: m, label: m }));

	return (
		<div style={{ paddingTop: "52px" }}>
			<PanelSection title="AI Settings">
				<Field label="Provider">
					<Dropdown
						rgOptions={providerOptions}
						selectedOption={provider}
						onChange={handleProviderChange}
						menuLabel="Select provider"
					/>
				</Field>

				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 12,
						marginTop: 12,
					}}
				>
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

			<PanelSection title="Status">
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
					label="Model"
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

				{provider === "openrouter" && (
					<Field
						label="Custom model"
						description="Override the dropdown with any OpenRouter model ID"
					>
						<TextField
							value={customModel}
							onChange={(e) => setCustomModel(e.currentTarget.value)}
							label="e.g. anthropic/claude-3.7-sonnet"
						/>
						<Button
							style={{ marginTop: 8 }}
							onClick={handleCustomModelSave}
							disabled={!customModel.trim()}
						>
							Save custom model
						</Button>
					</Field>
				)}

				{provider === "infomaniak" && (
					<Field
						label="Product ID"
						description="Required for Infomaniak AI API"
					>
						<TextField
							value={productId}
							onChange={(e) => setProductId(e.currentTarget.value)}
							label="e.g. abc123"
						/>
						<Button
							style={{ marginTop: 8 }}
							onClick={handleProductIdSave}
							disabled={!productId.trim()}
						>
							Save product ID
						</Button>
					</Field>
				)}
			</PanelSection>
		</div>
	);
};

export default SettingsPage;
