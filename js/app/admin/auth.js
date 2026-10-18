// Session adapter of /admin (plan §4.2): sign in, local sign out, remembered session, is_admin and the
// "session ended" notice. Each call returns the class decided by js/lib/admin-auth.js; nothing here decides.
import { getClient, forgetStoredSession } from "./client.js";
import { classifyAuthResult, classifyAdminCheck, classifySessionRestore } from "../../lib/admin-auth.js";

let leaving = false; // true while WE sign out (Log out, RF-12): that SIGNED_OUT is not "session ended"
let onEnded = () => {};
let watching = false;

/** The client, subscribed once to the end of the session (RF-16). */
async function ready() {
  const client = await getClient();
  if (!watching) {
    watching = true;
    client.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT" || leaving) return;
      // Outside the callback: supabase-js holds a lock while it runs it.
      setTimeout(() => onEnded(), 0);
    });
  }
  return client;
}

/** signInWithPassword → "ok" | "credentials" | "rate_limited" | "not_confirmed" | "network" (RF-5, RF-7 to RF-9, RF-68). */
export async function signIn(email, password) {
  let client;
  try {
    client = await ready();
  } catch {
    return classifyAuthResult({ threw: true });
  }
  try {
    const { error } = await client.auth.signInWithPassword({ email, password });
    return classifyAuthResult({ error });
  } catch {
    return classifyAuthResult({ threw: true });
  }
}

/** is_admin RPC → "admin" | "no_access" | "network" | "session_ended" (RF-11, RF-12, RF-16, RF-69). */
export async function checkAdmin() {
  try {
    const client = await ready();
    const { data, error } = await client.rpc("is_admin");
    return classifyAdminCheck({ data, error });
  } catch {
    return classifyAdminCheck({ threw: true });
  }
}

/** Remembered session when the page opens → "none" | "session" | "network" | "session_ended" (RF-13). */
export async function restoreSession() {
  try {
    const client = await ready();
    const { data, error } = await client.auth.getSession();
    return classifySessionRestore({ data, error });
  } catch {
    return classifySessionRestore({ threw: true });
  }
}

/**
 * Signs out in THIS browser only (RF-15). Trap: signOut without a scope is global and would sign out the other
 * students too. If the server can't be reached, supabase-js keeps the local session, so it is removed by hand.
 */
export async function signOutLocal() {
  leaving = true;
  try {
    const client = await ready();
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) forgetStoredSession();
  } catch {
    forgetStoredSession();
  } finally {
    leaving = false;
  }
}

/** `onEnded` is called when the session ends on its own (refresh rejected, revoked), not by our sign out (RF-16). */
export function onSessionEnd(handler) {
  onEnded = handler;
}
