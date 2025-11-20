/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  if (window.__productsCache) return window.__productsCache;
  const response = await fetch("products.json");
  const data = await response.json();
  window.__productsCache = data.products;
  return window.__productsCache;
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  // Remove duplicate products by name (keep first occurrence)
  const seen = new Set();
  const uniqueProducts = [];
  for (const p of products) {
    if (!seen.has(p.name)) {
      seen.add(p.name);
      uniqueProducts.push(p);
    }
  }

  productsContainer.innerHTML = uniqueProducts
    .map(
      (product) => `
    <div class="product-card" data-id="${product.id}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
        <button class="details-btn" aria-expanded="false">Details</button>
      </div>
    </div>
  `
    )
    .join("");
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory
  );

  displayProducts(filteredProducts);
});

/* Generate routine using selected products and OpenAI API */
document
  .getElementById("generateRoutine")
  .addEventListener("click", async () => {
    const btn = document.getElementById("generateRoutine");
    if (!btn) return;

    if (!selectedProducts || selectedProducts.length === 0) {
      chatWindow.innerHTML = `<p>Please select one or more products to generate a routine.</p>`;
      return;
    }

    // Show loading state
    btn.disabled = true;
    const previousLabel = btn.innerHTML;
    btn.innerHTML = `Generating...`;
    chatWindow.innerHTML = `<p>Generating routine — this may take a few seconds...</p>`;

    try {
      const products = await loadProducts();
      // Map selected IDs to product data
      const selectedData = selectedProducts
        .map((id) => products.find((p) => p.id === id))
        .filter(Boolean)
        .map((p) => ({
          name: p.name,
          brand: p.brand,
          category: p.category,
          description: p.description,
        }));

      // Build messages for the OpenAI API
      const systemMsg = {
        role: "system",
        content:
          "You are a helpful beauty assistant. Given a list of products, produce a clear morning and evening skincare routine with step order, usage instructions, and any important cautions. Keep the output friendly and actionable.",
      };

      const userMsg = {
        role: "user",
        content: `Here are the selected products in JSON. Generate a user-friendly routine (morning and evening) that uses these products where appropriate. Return the routine as plain text.\n\nProducts: ${JSON.stringify(
          selectedData,
          null,
          2
        )}`,
      };

      // Obtain API key from a global injected variable (e.g., secrets.js should set window.OPENAI_API_KEY)
      const apiKey = window.OPENAI_API_KEY;
      if (!apiKey) {
        chatWindow.innerHTML = `<p>Missing OpenAI API key. Add it to <code>secrets.js</code> as <code>window.OPENAI_API_KEY = 'sk-...'</code>.</p>`;
        return;
      }

      const resp = await fetch("https://loreal-chatbot-worker.jaammiiee99.workers.dev/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [systemMsg, userMsg],
          max_tokens: 700,
        }),
      });

      const data = await resp.json();
      const aiText =
        data?.choices?.[0]?.message?.content || JSON.stringify(data, null, 2);

      // Render AI answer in chat window, preserving line breaks
      chatWindow.innerHTML = `<div class="ai-response">${aiText.replace(
        /\n/g,
        "<br>"
      )}</div>`;
      chatWindow.scrollTop = chatWindow.scrollHeight;
    } catch (err) {
      console.error(err);
      chatWindow.innerHTML = `<p>Error generating routine: ${err.message}</p>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = previousLabel;
    }
  });

/* Chat form submission handler - placeholder for OpenAI integration */
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();

  chatWindow.innerHTML = "Connect to the OpenAI API for a response!";
});

/* Enable product selection */
let selectedProducts = []; // will store product IDs (numbers)

/* Update the Selected Products section */
async function updateSelectedProductsSection() {
  const selectedProductsList = document.getElementById("selectedProductsList");
  const products = await loadProducts();
  const map = new Map(products.map((p) => [p.id, p]));

  selectedProductsList.innerHTML = selectedProducts
    .map((id) => {
      const p = map.get(id);
      const title = p ? p.name : "Unknown product";
      return `
        <div class="selected-product-item" data-id="${id}">
          <span>${title}</span>
          <button class="remove-btn" data-id="${id}">Remove</button>
        </div>
      `;
    })
    .join("");
}

/* Unified click handler: selection + accordion triggered by Details button */
productsContainer.addEventListener("click", async (e) => {
  const card = e.target.closest(".product-card");
  if (!card) return; // Ignore clicks outside product cards

  const productId = Number(card.dataset.id);
  const productName = card.querySelector("h3").textContent;

  // If clicked the Details button, handle accordion expand/collapse
  if (e.target.closest(".details-btn")) {
    // Open a modal with product details instead of inline accordion
    const products = await loadProducts();
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    // create overlay
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-label="${product.name}">
        <button class="modal-close" aria-label="Close">×</button>
        <h3>${product.name}</h3>
        <p>${product.description}</p>
      </div>
    `;
    document.body.appendChild(overlay);

    // focus the close button
    const closeBtn = overlay.querySelector(".modal-close");
    closeBtn && closeBtn.focus();

    // close handlers
    function closeModal() {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    }

    function onKey(e) {
      if (e.key === "Escape") closeModal();
    }

    overlay.addEventListener("click", (ev) => {
      if (ev.target === overlay) closeModal();
    });
    closeBtn.addEventListener("click", closeModal);
    document.addEventListener("keydown", onKey);
    return; // Do not toggle selection when user clicked Details
  }

  // --- Selection behavior: toggle membership in selectedProducts (by id) ---
  if (selectedProducts.includes(productId)) {
    // Unselect product
    selectedProducts = selectedProducts.filter((id) => id !== productId);
    card.classList.remove("selected");
  } else {
    // Select product (guard against duplicates)
    selectedProducts.push(productId);
    // Ensure uniqueness just in case
    selectedProducts = Array.from(new Set(selectedProducts));
    card.classList.add("selected");
  }

  updateSelectedProductsSection();
});

/* Allow removal of items directly from the Selected Products list */
document
  .getElementById("selectedProductsList")
  .addEventListener("click", (e) => {
    if (e.target.classList.contains("remove-btn")) {
      const idStr = e.target.getAttribute("data-id");
      const id = Number(idStr);

      // Remove product from the selected list (by id)
      selectedProducts = selectedProducts.filter((pid) => pid !== id);

      // Update the Selected Products section
      updateSelectedProductsSection();

      // Unselect the product card in the grid
      const cardToUnselect = document.querySelector(
        `.product-card[data-id="${id}"]`
      );
      if (cardToUnselect) {
        cardToUnselect.classList.remove("selected");
      }
    }
  });

/* Optimize dropdown list loading */
categoryFilter.addEventListener("focus", async () => {
  if (!categoryFilter.dataset.loaded) {
    const products = await loadProducts();
    const categories = [
      ...new Set(products.map((product) => product.category)),
    ];
    // Build a set of existing option values to avoid duplicates
    const existing = new Set(
      Array.from(categoryFilter.options).map((o) => o.value)
    );

    categories.forEach((category) => {
      if (!existing.has(category)) {
        const option = document.createElement("option");
        option.value = category;
        option.textContent =
          category.charAt(0).toUpperCase() + category.slice(1);
        categoryFilter.appendChild(option);
      }
    });

    // mark loaded to avoid reprocessing
    categoryFilter.dataset.loaded = true;
  }
});
