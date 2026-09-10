function showToast(message) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${message}</span> <button style="background:none;border:none;color:white;cursor:pointer;" onclick="this.parentElement.remove()">✕</button>`;
  container.appendChild(toast);
  setTimeout(() => { if (toast.parentElement) toast.remove(); }, 3000);
}

function updateAuthUI() {
  const token = localStorage.getItem('unicloth_token');
  const user = JSON.parse(localStorage.getItem('unicloth_user') || 'null');
  const authLinks = document.getElementById('auth-links');
  if (authLinks) {
    if (token && user) {
      if (user.role === 'admin') {
        authLinks.innerHTML = `
          <a href="admin.html" class="icon-link" style="color:var(--danger); font-weight:bold;">⚙️ Admin Panel</a>
          <a href="#" onclick="logout()" class="icon-link">Logout</a>
        `;
      } else {
        authLinks.innerHTML = `
          <a href="account.html" class="icon-link">👤 ${user.name}</a>
          <a href="#" onclick="logout()" class="icon-link">Logout</a>
        `;
      }
    } else {
      authLinks.innerHTML = `<a href="login.html" class="icon-link">👤 Account</a>`;
    }
  }
}

function logout() {
  localStorage.removeItem('unicloth_token');
  localStorage.removeItem('unicloth_user');
  window.location.href = 'index.html';
}

function updateCartBadge() {
  let cart = [];
  try {
    cart = JSON.parse(localStorage.getItem('unicloth_cart') || '[]');
  } catch (e) {
    localStorage.setItem('unicloth_cart', '[]');
  }
  
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  document.querySelectorAll('#cart-count').forEach(el => {
    el.textContent = count;
    el.style.display = count > 0 ? 'inline-block' : 'none';
  });
}

function updateWishlistBadge() {
  let wishlist = JSON.parse(localStorage.getItem('unicloth_wishlist') || '[]');
  document.querySelectorAll('#wish-count').forEach(el => {
    el.textContent = wishlist.length;
    el.style.display = wishlist.length > 0 ? 'inline-block' : 'none';
  });
}

function handleSearch(e) {
  e.preventDefault();
  const query = document.getElementById('global-search').value;
  if (query.trim()) {
    window.location.href = `products.html?search=${encodeURIComponent(query.trim())}`;
  }
}

function handleNewsletter(e) {
  e.preventDefault();
  document.getElementById('newsletter-input').value = '';
  showToast('Subscribed to newsletter successfully!');
}

function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

function toggleWishlist(id, name) {
  let wishlist = JSON.parse(localStorage.getItem('unicloth_wishlist') || '[]');
  if (wishlist.includes(id)) {
    wishlist = wishlist.filter(item => item !== id);
    showToast('Removed from Wishlist');
  } else {
    wishlist.push(id);
    showToast('Added to Wishlist');
  }
  localStorage.setItem('unicloth_wishlist', JSON.stringify(wishlist));
  updateWishlistBadge();
}

function addToCart(id, name, price, image) {
  let cart = JSON.parse(localStorage.getItem('unicloth_cart') || '[]');
  const existing = cart.find(i => i.product_id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ product_id: id, name, price, image, qty: 1 });
  }
  localStorage.setItem('unicloth_cart', JSON.stringify(cart));
  updateCartBadge();
  showToast('Added to Cart successfully');
}

document.addEventListener('DOMContentLoaded', () => {
  updateAuthUI();
  updateCartBadge();
  updateWishlistBadge();
});
