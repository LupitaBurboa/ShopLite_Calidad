/* =========================================================
   cart.js — cart page logic (cart.html)
   ========================================================= */

const TAX_RATE = 0.08;
const FLAT_SHIPPING = 5.00;
const FREE_SHIPPING_THRESHOLD = 75;

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await requireLogin('login.html');
  if (!currentUser) return;

  await renderNavbar();
  await renderCart();

  document.getElementById('checkoutBtn').addEventListener('click', async () => {
    const items = await CartDB.getCart(currentUser.id);
    if (items.length === 0) {
      showToast('Your cart is empty.', 'error');
      return;
    }
    window.location.href = 'checkout.html';
  });
});

async function getEnrichedCartItems() {
  const items = await CartDB.getCart(currentUser.id);
  const enriched = await Promise.all(items.map(async item => ({
    ...item,
    product: await ProductDB.getById(item.productId)
  })));
  return enriched.filter(item => item.product);
}

async function renderCart() {
  const listEl = document.getElementById('cartItemsList');
  const layoutEl = document.getElementById('cartLayout');
  const emptyEl = document.getElementById('emptyCart');
  const enriched = await getEnrichedCartItems();

  if (enriched.length === 0) {
    layoutEl.style.display = 'none';
    emptyEl.style.display = 'block';
    return;
  }
  layoutEl.style.display = 'grid';
  emptyEl.style.display = 'none';

  listEl.innerHTML = enriched.map(({ product, qty }) => `
    <div class="cart-item">
      <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.name)}"
           onerror="this.src='https://via.placeholder.com/100x100?text=No+Image'">
      <div>
        <div class="cart-item-name">${escapeHTML(product.name)}</div>
        <div class="cart-item-price">${formatPrice(product.price)} each</div>
        <button class="remove-link" data-remove="${product.id}">Remove</button>
      </div>
      <div class="qty-control">
        <button data-decrease="${product.id}" aria-label="Decrease quantity">−</button>
        <span>${qty}</span>
        <button data-increase="${product.id}" aria-label="Increase quantity"
          ${qty >= product.stock ? 'disabled' : ''}>+</button>
      </div>
      <div style="font-weight:700;">${formatPrice(product.price * qty)}</div>
    </div>
  `).join('');

  listEl.querySelectorAll('[data-increase]').forEach(btn => {
    btn.addEventListener('click', () => { void changeQty(btn.dataset.increase, 1); });
  });
  listEl.querySelectorAll('[data-decrease]').forEach(btn => {
    btn.addEventListener('click', () => { void changeQty(btn.dataset.decrease, -1); });
  });
  listEl.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => { void removeItem(btn.dataset.remove); });
  });

  renderSummary(enriched);
}

async function changeQty(productId, delta) {
  const items = await CartDB.getCart(currentUser.id);
  const item = items.find(i => i.productId === productId);
  if (!item) return;

  const product = await ProductDB.getById(productId);
  const newQty = item.qty + delta;

  if (newQty > product.stock) {
    showToast(`Only ${product.stock} in stock.`, 'error');
    return;
  }

  try {
    await CartDB.updateQty(currentUser.id, productId, newQty);
    await renderCart();
    await updateCartBadge();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function removeItem(productId) {
  await CartDB.removeItem(currentUser.id, productId);
  await renderCart();
  await updateCartBadge();
  showToast('Item removed from cart.');
}

function renderSummary(enrichedItems) {
  const subtotal = enrichedItems.reduce((sum, i) => sum + i.product.price * i.qty, 0);
  const tax = subtotal * TAX_RATE;
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
  const total = subtotal + tax + shipping;

  document.getElementById('sumSubtotal').textContent = formatPrice(subtotal);
  document.getElementById('sumTax').textContent = formatPrice(tax);
  document.getElementById('sumShipping').textContent = shipping === 0 ? 'FREE' : formatPrice(shipping);
  document.getElementById('sumTotal').textContent = formatPrice(total);
}
