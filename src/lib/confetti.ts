import confetti from "canvas-confetti";

/** 答对庆祝彩带 */
export function fireCelebration() {
  const colors = ["#58CC02", "#FFC93C", "#4A90D9", "#FF9F43", "#FF5B5B"];
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.7 },
    colors,
    scalar: 1.1,
  });
  setTimeout(
    () =>
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
      }),
    150,
  );
  setTimeout(
    () =>
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
      }),
    300,
  );
}
