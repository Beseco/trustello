import { useState } from "react";

export type AddinSettings = {
  token: string;
  serverUrl: string;
  userName: string;
  tenantName: string;
};

const SETTINGS_KEY_TOKEN = "trustello_token";
const SETTINGS_KEY_URL = "trustello_server_url";
const SETTINGS_KEY_USER = "trustello_user_name";
const SETTINGS_KEY_TENANT = "trustello_tenant_name";
const DEFAULT_URL = "https://app.trustello.de";

function readFromRoamingSettings(): AddinSettings {
  const token = (Office.context.roamingSettings.get(SETTINGS_KEY_TOKEN) as string) ?? "";
  const serverUrl = (Office.context.roamingSettings.get(SETTINGS_KEY_URL) as string) ?? DEFAULT_URL;
  const userName = (Office.context.roamingSettings.get(SETTINGS_KEY_USER) as string) ?? "";
  const tenantName = (Office.context.roamingSettings.get(SETTINGS_KEY_TENANT) as string) ?? "";
  return { token, serverUrl, userName, tenantName };
}

export function useSettings() {
  const [settings, setSettings] = useState<AddinSettings>(readFromRoamingSettings);

  function saveSettings(next: AddinSettings): Promise<void> {
    return new Promise((resolve, reject) => {
      Office.context.roamingSettings.set(SETTINGS_KEY_TOKEN, next.token);
      Office.context.roamingSettings.set(SETTINGS_KEY_URL, next.serverUrl);
      Office.context.roamingSettings.set(SETTINGS_KEY_USER, next.userName);
      Office.context.roamingSettings.set(SETTINGS_KEY_TENANT, next.tenantName);
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

  return { settings, saveSettings };
}
