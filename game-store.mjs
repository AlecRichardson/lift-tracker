import { createDemoGame, DEMO_GAME_KEY, runDemoCommand, validDemoGame } from "./game-state.mjs";

// Exactly one isolated key; no auth, workout-history or draft access.
export function createDemoStore({ storage = window.localStorage, locks = globalThis.navigator?.locks,
  now = Date.now, random = Math.random } = {}) {
  const load = () => {
    const raw = storage.getItem(DEMO_GAME_KEY);
    if (raw === null) return createDemoGame(now());
    let state;
    try { state = JSON.parse(raw); } catch { throw new Error("Your saved practice game couldn’t be read. It has been kept for recovery."); }
    if (!validDemoGame(state)) throw new Error("Your saved practice game couldn’t be opened. It has been kept for recovery.");
    return state;
  };
  const exclusive = action => locks?.request ? locks.request(DEMO_GAME_KEY, async () => action()) : Promise.resolve().then(action);
  return {
    load,
    transact(command) {
      return exclusive(() => {
        const previous = load();
        const outcome = runDemoCommand(previous, command, { now: now(), random });
        // Persist before advertising rewards or changing the visible inventory.
        if (outcome.result.ok && outcome.state !== previous) storage.setItem(DEMO_GAME_KEY, JSON.stringify(outcome.state));
        return outcome;
      });
    },
    reset() {
      return exclusive(() => {
        const state = createDemoGame(now());
        storage.setItem(DEMO_GAME_KEY, JSON.stringify(state));
        return state;
      });
    }
  };
}
