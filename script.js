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
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
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
    <div class="product-card">
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

/* Chat form submission handler - placeholder for OpenAI integration */
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();

  chatWindow.innerHTML = "Connect to the OpenAI API for a response!";
});

/* Enable product selection */
let selectedProducts = [];

/* Update the Selected Products section */
function updateSelectedProductsSection() {
  const selectedProductsList = document.getElementById("selectedProductsList");
  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
        <div class="selected-product-item">
          <span>${product}</span>
          <button class="remove-btn" data-product="${product}">Remove</button>
        </div>
      `
    )
    .join("");
}

/* Unified click handler: selection + accordion triggered by Details button */
productsContainer.addEventListener("click", async (e) => {
  const card = e.target.closest(".product-card");
  if (!card) return; // Ignore clicks outside product cards

  const productName = card.querySelector("h3").textContent;

  // If clicked the close button inside a description, collapse and return
  if (e.target.classList.contains("close-description")) {
    const descriptionDiv = card.querySelector(".product-description");
    if (descriptionDiv) {
      descriptionDiv.remove();
      card.classList.remove("expanded");
      const detailsBtn = card.querySelector(".details-btn");
      if (detailsBtn) detailsBtn.setAttribute("aria-expanded", "false");
    }
    return;
  }

  // If clicked the Details button, handle accordion expand/collapse
  if (e.target.closest(".details-btn")) {
    const expandedCard = document.querySelector(".product-card.expanded");

    // Collapse previously expanded card (if different)
    if (expandedCard && expandedCard !== card) {
      const descriptionDiv = expandedCard.querySelector(".product-description");
      if (descriptionDiv) {
        descriptionDiv.remove();
        expandedCard.classList.remove("expanded");
        const prevDetailsBtn = expandedCard.querySelector(".details-btn");
        if (prevDetailsBtn)
          prevDetailsBtn.setAttribute("aria-expanded", "false");
      }
    }

    // Toggle expansion for the clicked card
    if (!card.classList.contains("expanded")) {
      const products = await loadProducts();
      const product = products.find((p) => p.name === productName);

      if (product) {
        const descriptionDiv = document.createElement("div");
        descriptionDiv.className = "product-description";
        descriptionDiv.innerHTML = `\n        <p>${product.description}</p>\n        <button class="close-description">Close</button>\n      `;
        card.appendChild(descriptionDiv);
        card.classList.add("expanded");
        const detailsBtn = card.querySelector(".details-btn");
        if (detailsBtn) detailsBtn.setAttribute("aria-expanded", "true");
      }
    } else {
      // Collapse the clicked card if it's already expanded
      const descriptionDiv = card.querySelector(".product-description");
      if (descriptionDiv) {
        descriptionDiv.remove();
        card.classList.remove("expanded");
        const detailsBtn = card.querySelector(".details-btn");
        if (detailsBtn) detailsBtn.setAttribute("aria-expanded", "false");
      }
    }

    return; // Do not toggle selection when user clicked Details
  }

  // --- Selection behavior: toggle membership in selectedProducts ---
  if (selectedProducts.includes(productName)) {
    // Unselect product
    selectedProducts = selectedProducts.filter((name) => name !== productName);
    card.classList.remove("selected");
  } else {
    // Select product (guard against duplicates)
    selectedProducts.push(productName);
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
      const productName = e.target.getAttribute("data-product");

      // Remove product from the selected list
      selectedProducts = selectedProducts.filter(
        (name) => name !== productName
      );

      // Update the Selected Products section
      updateSelectedProductsSection();

      // Unselect the product card in the grid
      const productCards = Array.from(
        document.querySelectorAll(".product-card")
      );
      const cardToUnselect = productCards.find(
        (card) => card.querySelector("h3").textContent === productName
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

    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category.charAt(0).toUpperCase() + category.slice(1);
      categoryFilter.appendChild(option);
    });

    categoryFilter.dataset.loaded = true;
  }
});
