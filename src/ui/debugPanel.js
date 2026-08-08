import { CONTROL_DEFINITIONS, STORAGE_KEYS, saveConfig } from "../config.js";

function formatValue(value) {
  return Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function updateRangeVisual(input) {
  const min = Number(input.min);
  const max = Number(input.max);
  const value = Number(input.value);
  const percentage = ((value - min) / Math.max(1, max - min)) * 100;
  input.style.setProperty("--fill", `${percentage}%`);
}

function createControl(key, definition, value) {
  const wrapper = document.createElement("div");
  wrapper.className = "debug-control";
  wrapper.innerHTML = `
    <div class="debug-control__label-row">
      <label for="${key}">${definition.label}</label>
      <output id="${key}Value" for="${key}"></output>
    </div>
    <input
      class="debug-range"
      id="${key}"
      type="range"
      min="${definition.min}"
      max="${definition.max}"
      step="${definition.step}"
      value="${value}"
    />
  `;
  return wrapper;
}

export function setupDebugPanel({ config, engine }) {
  const controlsRoot = document.getElementById("debugControls");
  const panel = document.getElementById("debugPanel");
  const toggle = document.getElementById("debugToggle");
  let structuralTimer = 0;

  for (const [key, definition] of Object.entries(CONTROL_DEFINITIONS)) {
    const element = createControl(key, definition, config[key]);
    controlsRoot.appendChild(element);

    const input = element.querySelector(`#${key}`);
    const output = element.querySelector(`#${key}Value`);

    const updateDisplay = () => {
      output.value = `${formatValue(config[key])}${definition.suffix}`;
      output.textContent = output.value;
      updateRangeVisual(input);
    };

    updateDisplay();

    input.addEventListener("input", () => {
      config[key] = Number(input.value);
      updateDisplay();
      saveConfig(config);

      // Controles de interaction usam o mesmo objeto config compartilhado,
      // então não precisam reconstruir o oceano.
      if (definition.affectsOcean === false) return;

      if (definition.structural) {
        clearTimeout(structuralTimer);
        structuralTimer = setTimeout(() => {
          engine.updateConfig(key, config[key]);
        }, 40);
      } else {
        engine.updateConfig(key, config[key]);
      }
    });
  }

  const setPanelOpen = (isOpen) => {
    panel.hidden = !isOpen;
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute(
      "aria-label",
      isOpen ? "Fechar painel de debug" : "Abrir painel de debug"
    );
    toggle.textContent = isOpen ? "×" : "⚙";

    try {
      localStorage.setItem(STORAGE_KEYS.panel, String(isOpen));
    } catch {
      // Sem persistência, o toggle ainda funciona.
    }
  };

  let initialOpen = true;
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.panel);
    if (stored !== null) initialOpen = stored === "true";
  } catch {
    // Mantém aberto por padrão.
  }

  setPanelOpen(initialOpen);

  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    setPanelOpen(!isOpen);
  });

  document.getElementById("refreshView").addEventListener("click", () => {
    engine.rebuildCurrentVariation();
  });

  document.getElementById("newVariation").addEventListener("click", () => {
    engine.regenerate(true, false);
  });
}
