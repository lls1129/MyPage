// Reference-counted body-scroll lock. Multiple modals can be open at
// once (e.g. the crop modal opened from inside the photo editor), so a
// naive "capture prev overflow / restore it" per modal breaks: the
// inner modal captures the outer's already-"hidden" value and restores
// THAT, leaving the page permanently unscrollable after everything
// closes (symptom: wheel does nothing but Tab still focus-scrolls,
// because overflow:hidden blocks user scroll yet allows programmatic
// scrollIntoView). Counting locks fixes it — the body is unlocked only
// when the last lock releases.
let locks = 0;
let saved = "";

/** Lock body scroll; returns an idempotent release fn. Call in a
 *  useEffect and return the result so it releases on unmount:
 *    useEffect(() => lockBodyScroll(), []);
 */
export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => {};
  if (locks === 0) {
    saved = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  locks += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    if (locks === 0) document.body.style.overflow = saved;
  };
}
