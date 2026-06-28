/* =========================================================
   checkout.js — checkout page logic (checkout.html)
   ========================================================= */

const CHK_TAX_RATE = 0.08;
const CHK_FLAT_SHIPPING = 5.00;
const CHK_FREE_SHIPPING_THRESHOLD = 75;

let checkoutUser = null;
let checkoutItems = [];

document.addEventListener('DOMContentLoaded', () => {
  checkoutUser = requireLogin('login.html');
  if (!checkoutUser) return;

  renderNavbar();

  checkoutItems = CartDB.getCart(checkoutUser.id)
    .map(item => {
      const product = ProductDB.getById(item.productId);
      return product ? { ...item, product } : null;
    })
    .filter(Boolean);

  if (checkoutItems.length === 0) {
    window.location.href = 'cart.html';
    return;
  }

  // prefill name from account
  document.getElementById('fullName').value = checkoutUser.name || '';

  renderMiniOrder();
  renderSummary();
  setupCardFormatting();

  document.getElementById('checkoutForm').addEventListener('submit', handlePlaceOrder);
});

function renderMiniOrder() {
  const el = document.getElementById('miniOrderItems');
  el.innerHTML = checkoutItems.map(({ product, qty }) => `
    <div class="mini-order-item">
      <span>${escapeHTML(product.name)} × ${qty}</span>
      <span>${formatPrice(product.price * qty)}</span>
    </div>
  `).join('');
}

function calcTotals() {
  const subtotal = checkoutItems.reduce((sum, i) => sum + i.product.price * i.qty, 0);
  const tax = subtotal * CHK_TAX_RATE;
  const shipping = subtotal >= CHK_FREE_SHIPPING_THRESHOLD ? 0 : CHK_FLAT_SHIPPING;
  const total = subtotal + tax + shipping;
  return { subtotal, tax, shipping, total };
}

function renderSummary() {
  const { subtotal, tax, shipping, total } = calcTotals();
  document.getElementById('sumSubtotal').textContent = formatPrice(subtotal);
  document.getElementById('sumTax').textContent = formatPrice(tax);
  document.getElementById('sumShipping').textContent = shipping === 0 ? 'FREE' : formatPrice(shipping);
  document.getElementById('sumTotal').textContent = formatPrice(total);
}

function setupCardFormatting() {
  const cardInput = document.getElementById('cardNumber');
  cardInput.addEventListener('input', () => {
    let digits = cardInput.value.replace(/\D/g, '').slice(0, 16);
    cardInput.value = digits.replace(/(.{4})/g, '$1 ').trim();
  });

  const expiryInput = document.getElementById('expiry');
  expiryInput.addEventListener('input', () => {
    let digits = expiryInput.value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) {
      expiryInput.value = digits.slice(0, 2) + '/' + digits.slice(2);
    } else {
      expiryInput.value = digits;
    }
  });

  document.getElementById('cvv').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
  });
}

function validatePayment() {
  const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
  const expiry = document.getElementById('expiry').value;
  const cvv = document.getElementById('cvv').value;
  const errorBox = document.getElementById('paymentError');

  errorBox.classList.remove('show');

  if (cardNumber.length < 13 || cardNumber.length > 16 || !/^\d+$/.test(cardNumber)) {
    errorBox.textContent = 'Please enter a valid card number.';
    errorBox.classList.add('show');
    return false;
  }

  const expiryMatch = /^(\d{2})\/(\d{2})$/.exec(expiry);
  if (!expiryMatch) {
    errorBox.textContent = 'Please enter expiry as MM/YY.';
    errorBox.classList.add('show');
    return false;
  }
  const month = parseInt(expiryMatch[1], 10);
  if (month < 1 || month > 12) {
    errorBox.textContent = 'Please enter a valid expiry month.';
    errorBox.classList.add('show');
    return false;
  }

  if (cvv.length < 3) {
    errorBox.textContent = 'Please enter a valid CVV.';
    errorBox.classList.add('show');
    return false;
  }

  return true;
}

function handlePlaceOrder(e) {
  e.preventDefault();

  // re-check stock right before placing the order in case it changed
  for (const item of checkoutItems) {
    const liveProduct = ProductDB.getById(item.product.id);
    if (!liveProduct || liveProduct.stock < item.qty) {
      showToast(`Not enough stock for ${item.product.name}.`, 'error');
      return;
    }
  }

  if (!validatePayment()) return;

  const placeOrderBtn = document.getElementById('placeOrderBtn');
  placeOrderBtn.disabled = true;
  placeOrderBtn.textContent = 'Processing...';

  // simulate a payment processing delay
  setTimeout(() => {
    const { subtotal, tax, shipping, total } = calcTotals();

    const shipping_info = {
      fullName: document.getElementById('fullName').value.trim(),
      address: document.getElementById('address').value.trim(),
      city: document.getElementById('city').value.trim(),
      zip: document.getElementById('zip').value.trim(),
      country: document.getElementById('country').value.trim()
    };

    const orderItems = checkoutItems.map(i => ({
      productId: i.product.id,
      name: i.product.name,
      price: i.product.price,
      qty: i.qty
    }));

    const order = OrderDB.create({
      userId: checkoutUser.id,
      items: orderItems,
      subtotal,
      tax,
      shipping,
      total,
      shippingInfo: shipping_info,
      paymentLast4: document.getElementById('cardNumber').value.replace(/\s/g, '').slice(-4)
    });

    // decrement stock for each purchased product
    orderItems.forEach(i => ProductDB.decrementStock(i.productId, i.qty));

    // clear the user's cart
    CartDB.clearCart(checkoutUser.id);

    // stash last order id for confirmation page
    sessionStorage.setItem('lastOrderId', order.id);

    window.location.href = 'order-confirmation.html';
  }, 900);
}
