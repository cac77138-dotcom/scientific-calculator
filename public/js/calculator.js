
const expressionEl = document.getElementById("expression");
const resultEl = document.getElementById("result");
const statusEl = document.getElementById("status");
const angleEl = document.getElementById("angleMode");
const historyList = document.getElementById("historyList");
const soundToggle = document.getElementById("soundToggle");

let expression = "";
let lastAnswer = 0;
let angleMode = "DEG";
let soundEnabled = true;
let audioContext;

function playSound(frequency = 650) {
  if (!soundEnabled) return;

  try {
    audioContext ??= new (
      window.AudioContext || window.webkitAudioContext
    )();

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.08, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.06
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.06);
  } catch (error) {
    console.warn("Audio unavailable:", error.message);
  }
}

function render() {
  expressionEl.textContent = expression || "";
  angleEl.textContent = angleMode;
}

function insertValue(value) {
  if (resultEl.dataset.finished === "true") {
    const continuesExpression =
      ["+", "-", "*", "/", "^", "!", "%"].includes(value);

    if (!continuesExpression) {
      expression = "";
    }

    resultEl.dataset.finished = "false";
  }

  expression += value;
  statusEl.textContent = "Editing";
  render();
}

function clearCalculator() {
  expression = "";
  resultEl.textContent = "0";
  resultEl.dataset.finished = "false";
  statusEl.textContent = "Ready";
  render();
}

function deleteLast() {
  expression = expression.slice(0, -1);
  resultEl.dataset.finished = "false";
  render();
}

function formatResult(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Result is not finite");
    }

    return math.format(value, { precision: 12 });
  }

  return String(value);
}

function calculate() {
  if (!expression.trim()) return;

  try {
    // Scope contains explicit trigonometric functions for DEG/RAD mode.
    const trig = angleMode === "DEG"
      ? x => x * Math.PI / 180
      : x => x;

    const scope = {
      sin: x => Math.sin(trig(x)),
      cos: x => Math.cos(trig(x)),
      tan: x => Math.tan(trig(x)),
      asin: x => angleMode === "DEG"
        ? Math.asin(x) * 180 / Math.PI : Math.asin(x),
      acos: x => angleMode === "DEG"
        ? Math.acos(x) * 180 / Math.PI : Math.acos(x),
      atan: x => angleMode === "DEG"
        ? Math.atan(x) * 180 / Math.PI : Math.atan(x),
      log: x => Math.log10(x),
      ln: x => Math.log(x),
      sqrt: x => Math.sqrt(x),
      pi: Math.PI,
      e: Math.E
    };

    // Parse first so malformed expressions fail clearly.
    const node = math.parse(expression);

    // Restrict expressions to calculator operations and approved functions.
    node.traverse((child) => {
      if (child.isFunctionNode) {
        const allowed = [
          "sin", "cos", "tan", "asin", "acos", "atan",
          "log", "ln", "sqrt"
        ];

        if (!allowed.includes(child.fn.name)) {
          throw new Error("Unsupported function");
        }
      }

      if (child.isSymbolNode) {
        const allowedSymbols = [
          "sin", "cos", "tan", "asin", "acos", "atan",
          "log", "ln", "sqrt", "pi", "e"
        ];

        if (!allowedSymbols.includes(child.name)) {
          throw new Error("Unsupported symbol: " + child.name);
        }
      }

      if (
        child.isAssignmentNode ||
        child.isAccessorNode ||
        child.isFunctionAssignmentNode
      ) {
        throw new Error("Unsupported expression");
      }
    });

    const value = node.evaluate(scope);
    const formatted = formatResult(value);

    lastAnswer = value;
    resultEl.textContent = formatted;
    resultEl.dataset.finished = "true";
    statusEl.textContent = "Calculated";
    playSound(900);

    saveHistory(expression, formatted);
  } catch (error) {
    resultEl.textContent = "Invalid expression";
    statusEl.textContent = "Check your input";
    resultEl.dataset.finished = "false";
    playSound(220);
    console.error(error);
  }
}

async function saveHistory(expr, answer) {
  try {
    const response = await fetch("/api/calculator/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expression: expr,
        result: answer
      })
    });

    if (!response.ok) {
      throw new Error("History could not be saved");
    }

    await loadHistory();
  } catch (error) {
    statusEl.textContent = "Result calculated; history save failed";
    console.error(error);
  }
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

async function loadHistory() {
  try {
    const response = await fetch("/api/calculator/history");

    if (!response.ok) throw new Error("Failed to load history");

    const items = await response.json();
    historyList.replaceChildren();

    if (items.length === 0) {
      historyList.append(
        makeElement("p", "empty", "No calculations yet.")
      );
      return;
    }

    for (const item of items) {
      const card = makeElement("div", "history-item", "");
      const expr = makeElement(
        "div", "history-expression", item.expression
      );
      const answer = makeElement(
        "div", "history-result", "= " + item.result
      );
      const date = makeElement(
        "div",
        "history-date",
        new Date(item.createdAt).toLocaleString()
      );

      const actions = makeElement("div", "history-actions", "");
      const reuse = makeElement("button", "", "Use again");
      const remove = makeElement("button", "", "Delete");

      reuse.addEventListener("click", () => {
        playSound();
        expression = item.expression;
        resultEl.dataset.finished = "false";
        resultEl.textContent = item.result;
        render();
      });

      remove.addEventListener("click", async () => {
        playSound(400);

        try {
          const response = await fetch(
            "/api/calculator/history/" + encodeURIComponent(item._id),
            { method: "DELETE" }
          );

          if (!response.ok) throw new Error("Delete failed");
          await loadHistory();
        } catch (error) {
          alert("Could not delete this calculation.");
        }
      });

      actions.append(reuse, remove);
      card.append(expr, answer, date, actions);
      historyList.append(card);
    }
  } catch (error) {
    historyList.replaceChildren(
      makeElement("p", "empty", "Could not load history.")
    );
    console.error(error);
  }
}

document.querySelectorAll("[data-value]").forEach(button => {
  button.addEventListener("click", () => {
    playSound();
    const value = button.dataset.value;

    if (value === "Ans") {
      insertValue(String(lastAnswer));
    } else {
      insertValue(value);
    }
  });
});

document.querySelectorAll("[data-action]").forEach(button => {
  button.addEventListener("click", async () => {
    const action = button.dataset.action;
    playSound(action === "calculate" ? 900 : 450);

    if (action === "clear") clearCalculator();
    if (action === "delete") deleteLast();

    if (action === "calculate") calculate();

    if (action === "angle") {
      angleMode = angleMode === "DEG" ? "RAD" : "DEG";
      statusEl.textContent = "Mode: " + angleMode;
      render();
    }
  });
});

soundToggle.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundToggle.textContent = soundEnabled ? "🔊 Sound ON" : "🔇 Sound OFF";

  if (soundEnabled) playSound();
});

document.getElementById("clearHistory").addEventListener(
  "click",
  async () => {
    if (!confirm("Delete all calculation history?")) return;

    try {
      const response = await fetch("/api/calculator/history", {
        method: "DELETE"
      });

      if (!response.ok) throw new Error("Could not clear history");
      await loadHistory();
    } catch (error) {
      alert("Could not clear history.");
    }
  }
);

document.addEventListener("keydown", event => {
  if (/^[0-9.]$/.test(event.key)) {
    insertValue(event.key);
    playSound();
  } else if (["+", "-", "*", "/", "^", "(", ")", "%", "!"].includes(event.key)) {
    insertValue(event.key);
    playSound();
  } else if (event.key === "Enter" || event.key === "=") {
    event.preventDefault();
    playSound(900);
    calculate();
  } else if (event.key === "Backspace") {
    deleteLast();
    playSound();
  } else if (event.key === "Escape") {
    clearCalculator();
    playSound(400);
  }
});

render();
loadHistory();
