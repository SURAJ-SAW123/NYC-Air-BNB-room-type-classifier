(() => {
  "use strict";

  /* ---------------------------------------------------------
     Config / constraints — mirrors the Pydantic model
  --------------------------------------------------------- */
  const FIELD_RULES = {
    latitude: { type: "number", min: -90, max: 90 },
    longitude: { type: "number", min: -180, max: 180 },
    price: { type: "number", min: 0.01 },
    minimum_nights: { type: "int", min: 1, max: 365 },
    number_of_reviews: { type: "int", min: 0 },
    reviews_per_month: { type: "number", min: 0 },
    calculated_host_listings_count: { type: "int", min: 0 },
    availability_365: { type: "int", min: 0, max: 365 },
    neighbourhood_group: { type: "string" },
    neighbourhood: { type: "string" },
  };

  // Best-effort label sets for predict_proba output. If your model's
  // classes_ order differs, edit these arrays to match.
  const CLASS_LABELS = {
    3: ["Entire home/apt", "Private room", "Shared room"],
    4: ["Entire home/apt", "Hotel room", "Private room", "Shared room"],
  };

  const NEIGHBOURHOODS = {
    Manhattan: ["Harlem", "Upper West Side", "Upper East Side", "Chelsea", "East Village", "Midtown", "Hell's Kitchen", "SoHo"],
    Brooklyn: ["Williamsburg", "Bedford-Stuyvesant", "Bushwick", "Park Slope", "Greenpoint", "Crown Heights", "DUMBO"],
    Queens: ["Astoria", "Long Island City", "Flushing", "Ridgewood", "Jackson Heights"],
    Bronx: ["Mott Haven", "Fordham", "Riverdale", "Kingsbridge"],
    "Staten Island": ["St. George", "Tompkinsville", "Stapleton"],
  };

  const DEFAULT_API_BASE = "http://localhost:8000";

  /* ---------------------------------------------------------
     Elements
  --------------------------------------------------------- */
  const form = document.getElementById("predictForm");
  const submitBtn = document.getElementById("submitBtn");
  const statusPill = document.getElementById("statusPill");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsDrawer = document.getElementById("settingsDrawer");
  const apiBaseInput = document.getElementById("apiBaseInput");
  const apiBaseSave = document.getElementById("apiBaseSave");
  const apiBasePing = document.getElementById("apiBasePing");
  const neighbourhoodGroupEl = document.getElementById("neighbourhood_group");
  const neighbourhoodEl = document.getElementById("neighbourhood");
  const neighbourhoodList = document.getElementById("neighbourhoodList");
  const payloadJsonEl = document.getElementById("payloadJson");
  const resultEmpty = document.getElementById("resultEmpty");
  const resultContent = document.getElementById("resultContent");
  const errorBanner = document.getElementById("errorBanner");
  const errorText = document.getElementById("errorText");
  const predictedLabel = document.getElementById("predictedLabel");
  const probList = document.getElementById("probList");
  const rawToggle = document.getElementById("rawToggle");
  const rawJson = document.getElementById("rawJson");
  const toast = document.getElementById("toast");
  const fillSampleBtn = document.getElementById("fillSampleBtn");

  /* ---------------------------------------------------------
     API base persistence
  --------------------------------------------------------- */
  function getApiBase() {
    return localStorage.getItem("rt_api_base") || DEFAULT_API_BASE;
  }
  function setApiBase(url) {
    localStorage.setItem("rt_api_base", url.trim().replace(/\/+$/, ""));
  }
  apiBaseInput.value = getApiBase();

  settingsBtn.addEventListener("click", () => {
    settingsDrawer.classList.toggle("open");
  });
  apiBaseSave.addEventListener("click", () => {
    if (!apiBaseInput.value.trim()) return;
    setApiBase(apiBaseInput.value);
    showToast("API base URL saved");
    checkStatus();
  });
  apiBasePing.addEventListener("click", checkStatus);

  async function checkStatus() {
    setStatus("pending", "Checking…");
    try {
      const res = await fetch(getApiBase() + "/", { method: "GET" });
      if (res.ok) setStatus("ok", "Connected");
      else setStatus("bad", "Unreachable");
    } catch {
      setStatus("bad", "Unreachable");
    }
  }
  function setStatus(state, label) {
    statusPill.classList.remove("ok", "bad", "pending");
    statusPill.classList.add(state);
    statusText.textContent = label;
  }
  statusPill.addEventListener("click", checkStatus);

  /* ---------------------------------------------------------
     Neighbourhood suggestions per borough
  --------------------------------------------------------- */
  neighbourhoodGroupEl.addEventListener("change", () => {
    const list = NEIGHBOURHOODS[neighbourhoodGroupEl.value] || [];
    neighbourhoodList.innerHTML = list.map((n) => `<option value="${n}"></option>`).join("");
    updatePayloadPreview();
  });

  /* ---------------------------------------------------------
     Sliders <-> outputs
  --------------------------------------------------------- */
  function bindSlider(id, outId, prefix = "", suffix = "") {
    const input = document.getElementById(id);
    const out = document.getElementById(outId);
    const render = () => (out.textContent = `${prefix}${input.value}${suffix}`);
    input.addEventListener("input", () => {
      render();
      updatePayloadPreview();
    });
    render();
  }
  bindSlider("price", "priceOut", "$");
  bindSlider("minimum_nights", "minNightsOut", "", " night(s)");
  bindSlider("availability_365", "availOut", "", " days");

  /* ---------------------------------------------------------
     Live payload preview + validation
  --------------------------------------------------------- */
  function collectPayload() {
    const data = {};
    for (const name of Object.keys(FIELD_RULES)) {
      const el = form.elements[name];
      if (!el) continue;
      const rule = FIELD_RULES[name];
      if (rule.type === "string") {
        data[name] = el.value.trim();
      } else if (el.value === "") {
        data[name] = null;
      } else {
        data[name] = rule.type === "int" ? parseInt(el.value, 10) : parseFloat(el.value);
      }
    }
    return data;
  }

  function updatePayloadPreview() {
    payloadJsonEl.textContent = JSON.stringify(collectPayload(), null, 2);
  }
  form.addEventListener("input", updatePayloadPreview);
  updatePayloadPreview();

  function validate(data) {
    const errors = {};
    for (const [name, rule] of Object.entries(FIELD_RULES)) {
      const val = data[name];
      const fieldWrap = form.elements[name]?.closest(".field");
      const errEl = form.querySelector(`[data-err="${name}"]`);
      let msg = "";

      if (rule.type === "string") {
        if (!val) msg = "Required";
      } else {
        if (val === null || Number.isNaN(val)) msg = "Required";
        else if (rule.min !== undefined && val < rule.min) msg = `Min ${rule.min}`;
        else if (rule.max !== undefined && val > rule.max) msg = `Max ${rule.max}`;
      }

      if (msg) {
        errors[name] = msg;
        fieldWrap?.classList.add("invalid");
        if (errEl) errEl.textContent = msg;
      } else {
        fieldWrap?.classList.remove("invalid");
        if (errEl) errEl.textContent = "";
      }
    }
    return errors;
  }

  /* ---------------------------------------------------------
     Tabs
  --------------------------------------------------------- */
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
  });

  /* ---------------------------------------------------------
     Raw response toggle
  --------------------------------------------------------- */
  rawToggle.addEventListener("click", () => {
    const hidden = rawJson.hasAttribute("hidden");
    if (hidden) rawJson.removeAttribute("hidden");
    else rawJson.setAttribute("hidden", "");
    rawToggle.textContent = hidden ? "Hide raw response" : "View raw response";
  });

  /* ---------------------------------------------------------
     Submit
  --------------------------------------------------------- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = collectPayload();
    const errors = validate(payload);

    if (Object.keys(errors).length) {
      showToast("Fix the highlighted fields");
      const firstBad = Object.keys(errors)[0];
      form.elements[firstBad]?.focus();
      return;
    }

    setLoading(true);
    hideError();

    try {
      const res = await fetch(getApiBase() + "/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { json = { raw: text }; }

      if (!res.ok) {
        const detail = json?.detail
          ? (Array.isArray(json.detail) ? json.detail.map((d) => d.msg).join("; ") : String(json.detail))
          : `Request failed (${res.status})`;
        throw new Error(detail);
      }

      renderResult(json);
      setStatus("ok", "Connected");
    } catch (err) {
      showError(err.message || "Could not reach the API. Check the base URL and that the server is running.");
      setStatus("bad", "Unreachable");
    } finally {
      setLoading(false);
    }
  });

  fillSampleBtn.addEventListener("click", () => {
    const sample = {
      latitude: 40.7128,
      longitude: -73.9654,
      price: 145,
      minimum_nights: 2,
      number_of_reviews: 37,
      reviews_per_month: 1.8,
      calculated_host_listings_count: 3,
      availability_365: 210,
      neighbourhood_group: "Brooklyn",
      neighbourhood: "Williamsburg",
    };
    for (const [key, val] of Object.entries(sample)) {
      const el = form.elements[key];
      if (!el) continue;
      el.value = val;
    }
    neighbourhoodGroupEl.dispatchEvent(new Event("change"));
    document.getElementById("price").dispatchEvent(new Event("input"));
    document.getElementById("minimum_nights").dispatchEvent(new Event("input"));
    document.getElementById("availability_365").dispatchEvent(new Event("input"));
    updatePayloadPreview();
    showToast("Sample listing filled in");
  });

  /* ---------------------------------------------------------
     Result rendering
  --------------------------------------------------------- */
  function renderResult(json) {
    const label = json.Predicted_room_type ?? json.predicted_room_type ?? "Unknown";
    const probs = json.Probability ?? json.probability ?? [];

    predictedLabel.textContent = label;

    const names = CLASS_LABELS[probs.length] || probs.map((_, i) => `Class ${i + 1}`);
    const rows = probs.map((p, i) => ({ name: names[i] ?? `Class ${i + 1}`, value: p }));
    rows.sort((a, b) => b.value - a.value);

    probList.innerHTML = "";
    rows.forEach((row, idx) => {
      const pct = (row.value * 100).toFixed(1);
      const wrap = document.createElement("div");
      wrap.className = "prob-row" + (idx === 0 ? " top" : "");
      wrap.innerHTML = `
        <div class="prob-top">
          <span class="prob-name">${row.name}</span>
          <span class="prob-pct">${pct}%</span>
        </div>
        <div class="prob-track"><div class="prob-fill"></div></div>
      `;
      probList.appendChild(wrap);
      requestAnimationFrame(() => {
        wrap.querySelector(".prob-fill").style.width = pct + "%";
      });
    });

    rawJson.textContent = JSON.stringify(json, null, 2);
    rawJson.setAttribute("hidden", "");
    rawToggle.textContent = "View raw response";

    resultEmpty.hidden = true;
    resultContent.hidden = false;
    document.querySelector('.tab-btn[data-tab="result"]').click();
  }

  function showError(msg) {
    errorText.textContent = msg;
    errorBanner.hidden = false;
    resultContent.hidden = true;
    resultEmpty.hidden = true;
  }
  function hideError() {
    errorBanner.hidden = true;
  }

  function setLoading(isLoading) {
    submitBtn.classList.toggle("loading", isLoading);
    submitBtn.disabled = isLoading;
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), 2400);
  }

  /* ---------------------------------------------------------
     Init
  --------------------------------------------------------- */
  checkStatus();
})();
