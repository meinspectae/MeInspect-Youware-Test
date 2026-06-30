import { createEdgeSpark } from "@edgespark/client";
import "@edgespark/client/styles.css";

const BACKEND_URL = "https://staging--olkmxpl1sliijytnc48w.youbase.cloud";

// Single client for auth + API calls
export const client = createEdgeSpark({ baseUrl: BACKEND_URL });

// Helper for backward compatibility - but prefer client.api.fetch() directly
export async function apiFetch(path: string, options?: RequestInit) {
  return client.api.fetch(path, options);
}

// Get current session using built-in auth
export async function getSession() {
  try {
    const session = await client.auth.getSession();
    return { data: session.data };
  } catch {
    return { data: null };
  }
}

// Sign out using built-in auth
export async function signOut() {
  await client.auth.signOut();
}
