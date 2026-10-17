// Supabase connection for the browser. Both values are PUBLIC by design: security comes from RLS and
// the save_response RPC. Only the anon/publishable key may ever go here (RF-68); tests/config.test.js guards it.
// Empty values = local mode: answers stay in the local queue and "Saved offline – will sync" is shown.
export const SUPABASE_URL = "https://xbsrdugimqpgxmlwbpxo.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_guS6oY8FtikA8OMcs7vDuQ_jYSF_6BX";
