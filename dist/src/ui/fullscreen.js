export function setupFullscreen() {
  const button = document.getElementById("fullscreenToggle");
  const app = document.getElementById("app");

  const fullscreenSupported =
    document.fullscreenEnabled && typeof app.requestFullscreen === "function";

  if (!fullscreenSupported) {
    button.classList.add("is-unavailable");
    button.setAttribute("aria-label", "Tela cheia indisponível neste navegador");
    button.title = "Tela cheia indisponível neste navegador";
    return;
  }

  const updateButton = () => {
    const active = Boolean(document.fullscreenElement);
    button.textContent = active ? "↙" : "⛶";
    button.setAttribute(
      "aria-label",
      active ? "Sair da tela cheia" : "Entrar em tela cheia"
    );
  };

  button.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) {
        await app.requestFullscreen({ navigationUI: "hide" });
        try {
          await screen.orientation?.lock?.("portrait");
        } catch {
          // Alguns browsers não permitem lock de orientação.
        }
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // A API pode ser limitada pelo browser.
    }
  });

  document.addEventListener("fullscreenchange", updateButton);
  updateButton();
}
