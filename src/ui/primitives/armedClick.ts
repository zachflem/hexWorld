/**
 * Android Chrome often fires a compatibility ("ghost") click after a touch
 * that opened UI under the finger. Real taps deliver pointerdown on the target
 * first; ghost clicks do not. Keyboard activation (detail === 0) has no
 * pointerdown and must still be allowed.
 */
export function createArmedClickGuard() {
  let armed = false;

  return {
    arm(button: number) {
      if (button === 0) armed = true;
    },
    disarm() {
      armed = false;
    },
    /** Returns true when the click should be honored. */
    consume(detail: number) {
      if (detail === 0) return true;
      if (!armed) return false;
      armed = false;
      return true;
    },
  };
}
