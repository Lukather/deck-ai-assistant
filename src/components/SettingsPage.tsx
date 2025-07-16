import { useEffect, useState } from "react";
import { TextField, ButtonItem, PanelSection } from "@decky/ui";
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
    <div style={{ paddingTop: "56px", padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
      <PanelSection title="🔐 Impostazioni AI">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <FaKey size={16} />
          <TextField
            value={apiKey}
            onChange={(e) => setApiKey(e.currentTarget.value)}
            disabled={saving}
            style={{ flex: 1 }}
          />
        </div>

        <ButtonItem
          label={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              🔒 <span>{saving ? "Salvataggio..." : "Salva chiave"}</span>
            </div>
          }
          layout="below"
          onClick={handleSave}
          disabled={saving || !apiKey.trim()}
        />
      </PanelSection>

      <PanelSection title="🧠 Stato Gemini">
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: isKeyValid ? "#22c55e" : "#f87171"
        }}>
          {isKeyValid ? <FaCheckCircle /> : <FaTimesCircle />}
          {isKeyValid ? "✓ API valida e attiva" : "✗ Chiave non valida o assente"}
        </div>
      </PanelSection>
    </div>
  );
};

export default SettingsPage;
