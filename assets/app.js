const page = document.querySelector(".page-backdrop");
const panelButtons = [...document.querySelectorAll("[data-panel]")];
const panels = [...document.querySelectorAll(".floating-panel")];
const menuToggle = document.querySelector(".nav__toggle");
const menu = document.querySelector(".nav__menu");

function closePanels() {
  panels.forEach((panel) => { panel.hidden = true; });
  panelButtons.forEach((button) => button.setAttribute("aria-expanded", "false"));
}

panelButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const panel = document.getElementById(button.dataset.panel);
    if (!panel) return;

    const shouldOpen = panel.hidden;
    closePanels();
    if (shouldOpen) {
      panel.hidden = false;
      button.setAttribute("aria-expanded", "true");
      if (panel.id === "search-panel") document.querySelector("#product-search")?.focus();
    }
  });
});

document.querySelectorAll("[data-close-panel]").forEach((button) => {
  button.addEventListener("click", closePanels);
});

menuToggle?.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
  menu?.classList.toggle("is-open", !isOpen);
});

menu?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    menuToggle?.setAttribute("aria-expanded", "false");
    menuToggle?.setAttribute("aria-label", "Open navigation");
    menu?.classList.remove("is-open");
  });
});

const searchInput = document.querySelector("#product-search");
const searchStatus = document.querySelector("#search-status");
const productCards = [...document.querySelectorAll(".product-card")];

searchInput?.addEventListener("input", () => {
  const query = searchInput.value.trim().toLocaleLowerCase();
  let visibleCount = 0;

  productCards.forEach((card) => {
    const matches = card.querySelector(".h3")?.textContent.toLocaleLowerCase().includes(query) ?? false;
    card.hidden = !matches;
    if (matches) visibleCount += 1;
  });

  if (searchStatus) {
    searchStatus.textContent = query
      ? visibleCount ? `${visibleCount} produto${visibleCount === 1 ? "" : "s"} encontrado${visibleCount === 1 ? "" : "s"}.` : "Nenhum vinho encontrado."
      : "Sparkling, fortified ou aromatized wine";
  }
});

const cart = new Map();
const cartList = document.querySelector("#cart-items");
const cartEmpty = document.querySelector("#cart-empty");
const cartCount = document.querySelector("#cart-count");
const checkoutLink = document.querySelector(".cart-checkout");

function renderCart() {
  if (!cartList) return;
  cartList.replaceChildren();
  let total = 0;

  cart.forEach((quantity, name) => {
    total += quantity;
    const item = document.createElement("li");
    item.className = "cart-item";

    const label = document.createElement("span");
    label.textContent = `${name} × ${quantity}`;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.dataset.removeItem = name;
    remove.textContent = "Remover";

    item.append(label, remove);
    cartList.append(item);
  });

  if (cartCount) {
    cartCount.textContent = String(total);
    cartCount.setAttribute("aria-label", `${total} ${total === 1 ? "item" : "itens"} no carrinho`);
  }
  if (cartEmpty) cartEmpty.hidden = total > 0;
  if (checkoutLink) checkoutLink.hidden = total === 0;
}

document.querySelectorAll("[data-add-to-cart]").forEach((button) => {
  button.addEventListener("click", () => {
    const name = button.dataset.addToCart;
    if (!name) return;
    cart.set(name, (cart.get(name) ?? 0) + 1);
    renderCart();
    const cartPanel = document.querySelector("#cart-panel");
    closePanels();
    if (cartPanel) {
      cartPanel.hidden = false;
      document.querySelector('[data-panel="cart-panel"]')?.setAttribute("aria-expanded", "true");
    }
  });
});

cartList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-item]");
  if (!button) return;
  cart.delete(button.dataset.removeItem);
  renderCart();
});

const settings = {
  contrast: "is-high-contrast",
  text: "is-large-text",
  motion: "is-reduced-motion",
};

document.querySelectorAll("[data-setting]").forEach((input) => {
  const className = settings[input.dataset.setting];
  if (!className || !page) return;

  input.addEventListener("change", () => {
    page.classList.toggle(className, input.checked);
  });
});

document.querySelectorAll("[data-scroll]").forEach((button) => {
  button.addEventListener("click", () => {
    const track = document.getElementById(button.dataset.scroll);
    if (!track) return;
    const direction = Number(button.dataset.direction) || 1;
    const distance = Math.max(track.clientWidth * 0.82, 260) * direction;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: distance, behavior: reducedMotion ? "instant" : "smooth" });
  });
});

renderCart();
