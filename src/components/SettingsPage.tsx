import { useEffect, useState } from "react";
import { TextField, ButtonItem, PanelSection } from "@decky/ui";
import { call, toaster } from "@decky/api";

const showToast = (title: string, body: string) => {
    toaster.toast({ title, body, duration: 5000 });
  };

const SettingsPage = () => {
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Recupera chiave API esistente
    const fetchKey = async () => {
      try {
        const savedKey = await call<[], string>("get_api_key");
        if (savedKey) setApiKey(savedKey);
      } catch (error) {
        console.error("Errore nel recupero chiave:", error);
      }
    };

    fetchKey();
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      showToast("Salvataggio riuscito", "La chiave è stata salvata.");
    } catch (error) {
      showToast("Errore nel salvataggio", "La chiave non è stata salvata.");
      console.error("Errore nel salvataggio chiave:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: "24px" }}>
      <PanelSection title="🔐 Impostazioni AI">
        <TextField
          label="Chiave API"
          value={apiKey}
          onChange={(e) => setApiKey(e.currentTarget.value)}
          disabled={saving}
        />

        <ButtonItem
          label={saving ? "Salvataggio..." : "Salva chiave"}
          layout="below"
          onClick={handleSave}
          disabled={saving || !apiKey.trim()}
        />
      </PanelSection>
    </div>
  );
};

export default SettingsPage;
