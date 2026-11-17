import { mountGamePreview } from "./game-ui.mjs";
const root = document.getElementById("gameTestRoot");
try {
  mountGamePreview(root, { standalone: true });
} catch (error) {
  console.error(error);
  root.textContent = "The practice game couldn’t open. Allow this site to save practice progress, then reload. Your real workouts are unaffected.";
}
