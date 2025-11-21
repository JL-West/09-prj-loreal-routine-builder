/*
  script.js — Clean implementation for the routine builder
  Features:
  - Product list loading + caching
  - Category dropdown + incremental search (combined)
  - Product selection and Selected Products list with removal
  - Product details modal
  - RTL toggle (sets document dir)
  - Quick web search (DuckDuckGo Instant Answer) for citations
  - Generate Routine: worker-first, fallback to direct OpenAI call if worker fails
*/

const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const rtlToggle = document.getElementById("rtlToggle");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");

if (productsContainer)
  productsContainer.innerHTML = `<div class="placeholder-message">Select a category to view products</div>`;

async function loadProducts() {
  if (window.__productsCache) return window.__productsCache;
  const r = await fetch("products.json");
  const j = await r.json();
  window.__productsCache = j.products || [];
  return window.__productsCache;
}

let currentCategory = "";
let currentSearch = "";
let selectedProducts = [];

function escapeHtml(s) {
  return String(s || "").replace(
    /[&<>\"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}

function renderMarkdown(md) {
  if (!md) return "";
  let s = escapeHtml(md);
  s = s.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  s = s.replace(/^## (.*$)/gim, "<h2>$1</h2>");
  s = s.replace(/^# (.*$)/gim, "<h1>$1</h1>");
  s = s.replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>");
  s = s.replace(/^[-*] (.*)$/gim, "<li>$1</li>");
  s = s.replace(/(<li>.*<\/li>)/gim, "<ul>$1</ul>");
  s = s.replace(/\n\n+/g, "</p><p>");
  s = s.replace(/\n/g, "<br>");
  if (!/^\s*<h|^\s*<ul/.test(s)) s = "<p>" + s + "</p>";
  return s;
}

function renderProductsList(products) {
  if (!productsContainer) return;
  const seen = new Set();
  const unique = [];
  for (const p of products)
    if (!seen.has(p.name)) {
      seen.add(p.name);
      unique.push(p);
    }

  let list = unique;
  if (currentCategory)
    list = list.filter((p) => p.category === currentCategory);
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q))
    );
  }

  productsContainer.innerHTML = list
    .map(
      (p) => `
    <div class="product-card" data-id="${p.id}">
      <img src="${p.image}" alt="${escapeHtml(p.name)}">
      <div class="product-info">
        <h3>${escapeHtml(p.name)}</h3>
        <p>${escapeHtml(p.brand || "")}</p>
        <button class="details-btn" aria-expanded="false">Details</button>
      </div>
    </div>
  `
    )
    .join("");
}

if (categoryFilter)
  categoryFilter.addEventListener("change", async (e) => {
    currentCategory = e.target.value;
    renderProductsList(await loadProducts());
  });
if (productSearch)
  productSearch.addEventListener("input", async (e) => {
    currentSearch = e.target.value.trim();
    renderProductsList(await loadProducts());
  });
if (rtlToggle)
  rtlToggle.addEventListener("click", () => {
    const pressed = rtlToggle.getAttribute("aria-pressed") === "true";
    const next = !pressed;
    rtlToggle.setAttribute("aria-pressed", String(next));
    if (next) document.documentElement.setAttribute("dir", "rtl");
    else document.documentElement.removeAttribute("dir");
  });

async function quickWebSearch(query) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(
      query
    )}&format=json&no_redirect=1&skip_disambig=1`;
    const r = await fetch(url);
    const j = await r.json();
    const res = [];
    if (j.AbstractURL)
      res.push({
        title: j.Heading || query,
        url: j.AbstractURL,
        snippet: j.AbstractText || "",
      });
    (j.RelatedTopics || []).forEach((t) => {
      if (t.FirstURL)
        res.push({
          title: t.Text || query,
          url: t.FirstURL,
          snippet: t.Text || "",
        });
      else if (t.Topics)
        t.Topics.forEach(
          (s) =>
            s.FirstURL &&
            res.push({
              title: s.Text || query,
              url: s.FirstURL,
              snippet: s.Text || "",
            })
        );
    });
    const seen = new Set();
    return res
      .filter((r) => {
        if (!r.url) return false;
        if (seen.has(r.url)) return false;
        seen.add(r.url);
        return true;
      })
      .slice(0, 6);
  } catch (err) {
    console.warn("search failed", err);
    return [];
  }
}

async function generateRoutine() {
  const btn = document.getElementById("generateRoutine");
  if (!btn) return;
  if (!selectedProducts.length) {
    if (chatWindow)
      chatWindow.innerHTML =
        "<p>Please select products to generate a routine.</p>";
    return;
  }
  btn.disabled = true;
  const prev = btn.innerHTML;
  btn.innerHTML = "Generating...";
  if (chatWindow)
    chatWindow.innerHTML =
      "<p>Generating routine — this may take a few seconds...</p>";
  try {
    const products = await loadProducts();
    const selectedData = selectedProducts
      .map((id) => products.find((p) => p.id === id))
      .filter(Boolean)
      .map((p) => ({
        name: p.name,
        brand: p.brand,
        category: p.category,
        description: p.description,
      }));
    const searchQuery =
      selectedData.map((p) => p.name).join(" ") || "L'Oréal products";
    const citations = await quickWebSearch(`${searchQuery} routine L'Oréal`);
    const workerUrl = "/generateRoutine";
    let data = null;
    try {
      const resp = await fetch(workerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: selectedData, citations }),
      });
      data = await resp.json();
    } catch (e) {
      data = { error: String(e) };
    }
    let routineText =
      data?.routine ||
      data?.text ||
      data?.result ||
      (data?.choices && data.choices[0]?.message?.content);
    if ((!routineText || typeof routineText !== "string") && data?.error) {
      const apiKey = window.OPENAI_API_KEY;
      if (!apiKey) {
        if (chatWindow)
          chatWindow.innerHTML = `<pre>Error from worker: ${escapeHtml(
            JSON.stringify(data, null, 2)
          )}</pre>`;
        return;
      }
      const systemMsg = {
        role: "system",
        content:
          "You are a helpful beauty assistant. Given selected products, provide Morning and Evening routines formatted in Markdown with headings and numbered steps.",
      };
      const userMsg = {
        role: "user",
        content: `Selected products: ${JSON.stringify(
          selectedData,
          null,
          2
        )}\n\nPlease generate the routine.`,
      };
      const openaiResp = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${window.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [systemMsg, userMsg],
            max_tokens: 700,
          }),
        }
      );
      const openaiData = await openaiResp.json();
      routineText =
        openaiData?.choices?.[0]?.message?.content ||
        JSON.stringify(openaiData, null, 2);
    }
    if (chatWindow) {
      chatWindow.innerHTML = `<div class="ai-response">${renderMarkdown(
        routineText
      )}</div>`;
      if (citations && citations.length) {
        const citeHtml = citations
          .map(
            (c) =>
              `<li><a href="${
                c.url
              }" target="_blank" rel="noopener noreferrer">${escapeHtml(
                c.title
              )}</a><div class="cite-snippet">${escapeHtml(
                c.snippet
              )}</div></li>`
          )
          .join("");
        const container = document.createElement("div");
        container.className = "ai-citations";
        container.innerHTML = `<h4>Sources</h4><ul>${citeHtml}</ul>`;
        chatWindow.appendChild(container);
      }
    }
  } catch (err) {
    if (chatWindow)
      chatWindow.innerHTML = `<p>Error generating routine: ${escapeHtml(
        err.message
      )}</p>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = prev;
  }
}

const genBtn = document.getElementById("generateRoutine");
if (genBtn) genBtn.addEventListener("click", generateRoutine);

if (chatForm)
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const inputEl = document.getElementById("userInput");
    const text = inputEl ? inputEl.value.trim() : "";
    if (!text) return;
    const userDiv = document.createElement("div");
    userDiv.className = "chat-message chat-user";
    userDiv.textContent = text;
    if (chatWindow) chatWindow.appendChild(userDiv);
    if (inputEl) inputEl.value = "";
    const loading = document.createElement("div");
    loading.className = "chat-message chat-assistant loading";
    loading.textContent = "Thinking...";
    if (chatWindow) chatWindow.appendChild(loading);
    try {
      const apiKey = window.OPENAI_API_KEY;
      if (!apiKey) {
        loading.textContent =
          "Missing OpenAI API key. Add it to secrets.js for fallback.";
        return;
      }
      const allProducts = await loadProducts();
      const selectedData = selectedProducts
        .map((id) => allProducts.find((p) => p.id === id))
        .filter(Boolean)
        .map((p) => ({
          name: p.name,
          brand: p.brand,
          category: p.category,
          description: p.description,
        }));
      const systemMsg = {
        role: "system",
        content:
          "You are a helpful beauty assistant. Use selected products where appropriate and format answers in Markdown.",
      };
      const userMsg = {
        role: "user",
        content: `Selected products (JSON): ${JSON.stringify(
          selectedData,
          null,
          2
        )}\n\nUser request: ${text}`,
      };
      const webQ = `${text} ${selectedData
        .map((s) => s.name)
        .join(" ")}`.trim();
      const webResults = await quickWebSearch(webQ);
      const webMsg = {
        role: "system",
        content: `Web search results: ${JSON.stringify(webResults, null, 2)}`,
      };
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [systemMsg, webMsg, userMsg],
          max_tokens: 700,
        }),
      });
      const data = await resp.json();
      const reply = data?.choices?.[0]?.message?.content || "(no response)";
      loading.innerHTML = renderMarkdown(reply);
      if (webResults && webResults.length) {
        const citeHtml = webResults
          .map(
            (c) =>
              `<li><a href="${
                c.url
              }" target="_blank" rel="noopener noreferrer">${escapeHtml(
                c.title
              )}</a><div class="cite-snippet">${escapeHtml(
                c.snippet
              )}</div></li>`
          )
          .join("");
        const container = document.createElement("div");
        container.className = "ai-citations";
        container.innerHTML = `<h4>Sources</h4><ul>${citeHtml}</ul>`;
        loading.appendChild(container);
      }
      loading.classList.remove("loading");
      loading.classList.add("chat-assistant");
      if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
    } catch (err) {
      loading.textContent = `Error: ${escapeHtml(err.message)}`;
    }
  });

if (productsContainer)
  productsContainer.addEventListener("click", async (e) => {
    const card = e.target.closest(".product-card");
    if (!card) return;
    const id = Number(card.dataset.id);
    if (e.target.closest(".details-btn")) {
      const products = await loadProducts();
      const product = products.find((p) => p.id === id);
      if (!product) return;
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(
        product.name
      )}">
        <button class="modal-close" aria-label="Close">×</button>
        <h3>${escapeHtml(product.name)}</h3>
        <p>${escapeHtml(product.description || "")}</p>
      </div>`;
      document.body.appendChild(overlay);
      const close = overlay.querySelector(".modal-close");
      close && close.focus();
      function closeModal() {
        overlay.remove();
        document.removeEventListener("keydown", onKey);
      }
      function onKey(ev) {
        if (ev.key === "Escape") closeModal();
      }
      overlay.addEventListener("click", (ev) => {
        if (ev.target === overlay) closeModal();
      });
      close.addEventListener("click", closeModal);
      document.addEventListener("keydown", onKey);
      return;
    }
    if (selectedProducts.includes(id)) {
      selectedProducts = selectedProducts.filter((pid) => pid !== id);
      card.classList.remove("selected");
    } else {
      selectedProducts.push(id);
      selectedProducts = Array.from(new Set(selectedProducts));
      card.classList.add("selected");
    }
    updateSelectedProductsSection();
  });

async function updateSelectedProductsSection() {
  const list = document.getElementById("selectedProductsList");
  if (!list) return;
  const products = await loadProducts();
  const map = new Map(products.map((p) => [p.id, p]));
  list.innerHTML = selectedProducts
    .map((id) => {
      const p = map.get(id);
      return `<div class="selected-product-item" data-id="${id}"><span>${escapeHtml(
        p ? p.name : "Unknown"
      )}</span><button class="remove-btn" data-id="${id}">Remove</button></div>`;
    })
    .join("");
}

const selectedListEl = document.getElementById("selectedProductsList");
if (selectedListEl)
  selectedListEl.addEventListener("click", (e) => {
    if (e.target.classList.contains("remove-btn")) {
      const id = Number(e.target.getAttribute("data-id"));
      selectedProducts = selectedProducts.filter((pid) => pid !== id);
      const card = document.querySelector(`.product-card[data-id="${id}"]`);
      if (card) card.classList.remove("selected");
      updateSelectedProductsSection();
    }
  });

if (categoryFilter)
  categoryFilter.addEventListener("focus", async () => {
    if (categoryFilter.dataset.loaded) return;
    const products = await loadProducts();
    const cats = [...new Set(products.map((p) => p.category))];
    const existing = new Set(
      Array.from(categoryFilter.options).map((o) => o.value)
    );
    cats.forEach((c) => {
      if (!existing.has(c)) {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c.charAt(0).toUpperCase() + c.slice(1);
        categoryFilter.appendChild(opt);
      }
    });
    categoryFilter.dataset.loaded = true;
  });

(async () => {
  const prods = await loadProducts();
  renderProductsList(prods);
})();
