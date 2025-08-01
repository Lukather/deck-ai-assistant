import { useEffect, useState } from "react";
import { TextField, Button, PanelSection } from "@decky/ui";
import { call, toaster } from "@decky/api";
import { FaKey, FaCheckCircle, FaTimesCircle } from "react-icons/fa";

const SettingsPage = () => {
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [isKeyValid, setIsKeyValid] = useState(false);

  useEffect(() => {
    const fetchKey = async () => {
      try {
        const savedKey = await call<[], string>("get_api_key");
        if (savedKey && savedKey.trim().length > 10) {
          setApiKey(savedKey);
          setIsKeyValid(true);
        }
      } catch (error) {
        console.error("Errore nel recupero chiave:", error);
        setIsKeyValid(false);
      }
    };

    fetchKey();
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      const result = await call<[string], string>("save_api_key", apiKey.trim());
      toaster.toast({
        title: "Salvataggio riuscito",
        body: result || "La chiave è stata salvata.",
        duration: 5000,
      });
      setIsKeyValid(true);
    } catch (error) {
      toaster.toast({
        title: "Errore nel salvataggio",
        body: "La chiave non è stata salvata.",
        duration: 5000,
      });
      console.error("Errore nel salvataggio chiave:", error);
      setIsKeyValid(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ paddingTop: "52px"}}>
      <PanelSection title="🔐 AI Settings">
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
          style={{ height: 45, display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}
          onClick={handleSave}
          disabled={saving || !apiKey.trim()}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            🔒 <span>{saving ? "Saving..." : "Save key"}</span>
          </span>
        </Button>
      </PanelSection>

      <PanelSection title="🧠 Gemini Status">
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: isKeyValid ? "#22c55e" : "#f87171"
        }}>
          {isKeyValid ? <FaCheckCircle /> : <FaTimesCircle />}
          {isKeyValid ? "✓ API is valid and active" : "✗ Key is invalid or missing"}
        </div>
      </PanelSection>
    </div>
  );
};

export default SettingsPage;
