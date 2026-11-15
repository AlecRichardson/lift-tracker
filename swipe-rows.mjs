export function rowSwipeDirection(dx, dy) {
  return Math.abs(dx) >= 60 && Math.abs(dx) >= Math.abs(dy) * 1.5 ? (dx < 0 ? -1 : 1) : 0;
}

export function setupSwipeRows(root) {
  let start = null;
  const setOpen = (row, open) => {
    row.classList.toggle("swipeOpen", open);
    const button = row.querySelector(".swipeDelete");
    if (button) { button.hidden = !open; button.disabled = !open; }
  };
  const closeOthers = except => root.querySelectorAll(".swipeRow.swipeOpen").forEach(row => { if (row !== except) setOpen(row, false); });
  root.addEventListener("touchstart", event => {
    start = null;
    const row = event.target.closest?.(".swipeRow");
    if (!row || event.touches.length !== 1 || !event.target.closest?.(".swipeFront") ||
      event.target.closest?.("input,textarea,select,[contenteditable='true']")) return;
    const touch = event.touches[0];
    if (touch.clientX <= 20 || touch.clientX >= window.innerWidth - 20) return;
    start = { row, x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  root.addEventListener("touchcancel", () => { start = null; }, { passive: true });
  root.addEventListener("touchend", event => {
    const gesture = start;
    start = null;
    if (!gesture || event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0];
    const direction = rowSwipeDirection(touch.clientX - gesture.x, touch.clientY - gesture.y);
    if (!direction) return;
    closeOthers(gesture.row);
    setOpen(gesture.row, direction < 0);
    gesture.row.dataset.swipeClickUntil = String(Date.now() + 400);
  }, { passive: true });
  root.addEventListener("click", event => {
    const row = event.target.closest?.(".swipeRow");
    if (row && event.target.closest?.(".swipeFront") && Date.now() < Number(row.dataset.swipeClickUntil)) {
      event.preventDefault(); event.stopPropagation(); return;
    }
    if (row?.classList.contains("swipeOpen") && event.target.closest?.(".swipeFront")) {
      setOpen(row, false); event.preventDefault(); event.stopPropagation(); return;
    }
    closeOthers(row);
  }, true);
}
