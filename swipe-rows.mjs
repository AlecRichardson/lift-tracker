export function rowSwipeDirection(dx, dy) {
  return Math.abs(dx) >= 60 && Math.abs(dx) >= Math.abs(dy) * 1.5 ? (dx < 0 ? -1 : 1) : 0;
}

export function setupSwipeRows(root) {
  let start = null;
  const revealWidth = 84;
  const setOpen = (row, open) => {
    row.classList.toggle("swipeDragging", false);
    row.style.removeProperty("--swipe-offset");
    row.classList.toggle("swipeOpen", open);
    const button = row.querySelector(".swipeDelete");
    // Keep the action rendered behind the front while it slides closed.
    if (button) { button.hidden = false; button.disabled = !open; }
  };
  const closeOthers = except => root.querySelectorAll(".swipeRow.swipeOpen").forEach(row => { if (row !== except) setOpen(row, false); });
  root.addEventListener("touchstart", event => {
    if (start) setOpen(start.row, start.wasOpen);
    start = null;
    const row = event.target.closest?.(".swipeRow");
    if (!row || event.touches.length !== 1 || !event.target.closest?.(".swipeFront") ||
      event.target.closest?.("input,textarea,select,[contenteditable='true']")) return;
    const touch = event.touches[0];
    if (touch.clientX <= 20 || touch.clientX >= window.innerWidth - 20) return;
    start = { row, x: touch.clientX, y: touch.clientY,
      wasOpen: row.classList.contains("swipeOpen"), dragging: false };
  }, { passive: true });
  root.addEventListener("touchmove", event => {
    if (!start) return;
    if (event.touches.length !== 1) {
      setOpen(start.row, start.wasOpen); start = null; return;
    }
    const touch = event.touches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (!start.dragging) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return;
      // Once a scroll starts, never turn it into a row swipe later.
      if (Math.abs(dx) < Math.abs(dy) * 1.5) { start = null; return; }
      if (!start.wasOpen && dx > 0) { start = null; return; }
      start.dragging = true;
      closeOthers(start.row);
      start.row.classList.toggle("swipeDragging", true);
      const button = start.row.querySelector(".swipeDelete");
      if (button) { button.hidden = false; button.disabled = true; }
    }
    if (event.cancelable) event.preventDefault();
    const offset = Math.max(-revealWidth, Math.min(0, (start.wasOpen ? -revealWidth : 0) + dx));
    start.offset = offset;
    start.row.style.setProperty("--swipe-offset", `${offset}px`);
  }, { passive: false });
  root.addEventListener("touchcancel", () => {
    if (start) setOpen(start.row, start.wasOpen);
    start = null;
  }, { passive: true });
  root.addEventListener("touchend", event => {
    const gesture = start;
    start = null;
    if (!gesture) return;
    if (event.changedTouches.length !== 1) { setOpen(gesture.row, gesture.wasOpen); return; }
    const touch = event.changedTouches[0];
    const direction = rowSwipeDirection(touch.clientX - gesture.x, touch.clientY - gesture.y);
    if (!direction && !gesture.dragging) return;
    closeOthers(gesture.row);
    setOpen(gesture.row, gesture.dragging ? gesture.offset <= -revealWidth / 2 : direction < 0);
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
  root.addEventListener("keydown", event => {
    if (event.key === "Escape") closeOthers(null);
  });
}
