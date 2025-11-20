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
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
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

/* Toggle product selection on click */
productsContainer.addEventListener("click", (e) => {
  const card = e.target.closest(".product-card");
  if (!card) return; // Ignore clicks outside product cards

  const productName = card.querySelector("h3").textContent;

  if (selectedProducts.includes(productName)) {
    // Unselect product
    selectedProducts = selectedProducts.filter((name) => name !== productName);
    card.classList.remove("selected");
  } else {
    // Select product
    selectedProducts.push(productName);
    card.classList.add("selected");
  }

  console.log("Selected Products:", selectedProducts); // Debugging
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

/* Implement accordion-style product description */
productsContainer.addEventListener("click", async (e) => {
  const card = e.target.closest(".product-card");
  if (!card) return;

  const expandedCard = document.querySelector(".product-card.expanded");

  // Collapse the currently expanded card if it's not the clicked card
  if (expandedCard && expandedCard !== card) {
    const descriptionDiv = expandedCard.querySelector(".product-description");
    if (descriptionDiv) {
      descriptionDiv.remove();
      expandedCard.classList.remove("expanded");
    }
  }

  // Toggle the clicked card
  if (!card.classList.contains("expanded")) {
    const productName = card.querySelector("h3").textContent;
    const products = await loadProducts();
    const product = products.find((p) => p.name === productName);

    if (product) {
      const descriptionDiv = document.createElement("div");
      descriptionDiv.className = "product-description";
      descriptionDiv.innerHTML = `
        <p>${product.description}</p>
      `;
      card.appendChild(descriptionDiv);
      card.classList.add("expanded");
    }
  } else {
    // Collapse the clicked card if it's already expanded
    const descriptionDiv = card.querySelector(".product-description");
    if (descriptionDiv) {
      descriptionDiv.remove();
      card.classList.remove("expanded");
    }
  }
});
