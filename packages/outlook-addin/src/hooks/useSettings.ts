import { useState } from "react";

export type AddinSettings = {
  apiKey: string;
  serverUrl: string;
};

const SETTINGS_KEY_API = "trustello_api_key";
const SETTINGS_KEY_URL = "trustello_server_url";
const DEFAULT_URL = "https://app.trustello.de";

function readFromRoamingSettings(): AddinSettings {
  const apiKey = (Office.context.roamingSettings.get(SETTINGS_KEY_API) as string) ?? "";
  const serverUrl = (Office.context.roamingSettings.get(SETTINGS_KEY_URL) as string) ?? DEFAULT_URL;
  return { apiKey, serverUrl };
}

export function useSettings() {
  // Office ist bereits bereit wenn dieser Hook aufgerufen wird (nach Office.onReady())
  const [settings, setSettings] = useState<AddinSettings>(readFromRoamingSettings);
  const loaded = true; // synchron geladen aus Roaming Settings

  function saveSettings(next: AddinSettings): Promise<void> {
    return new Promise((resolve, reject) => {
      Office.context.roamingSettings.set(SETTINGS_KEY_API, next.apiKey);
      Office.context.roamingSettings.set(SETTINGS_KEY_URL, next.serverUrl);
      Office.context.roamingSettings.saveAsync((result) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          setSettings(next);
          resolve();
        } else {
          reject(new Error(result.error.message));
        }
      });
    });
  }

  return { settings, loaded, saveSettings };
}
