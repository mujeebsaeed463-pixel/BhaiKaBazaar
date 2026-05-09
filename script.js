const firebaseConfig = {
    apiKey: "AIzaSyBjgDaLnUMFVNfeEG76bcY2AIy9q_hfMLI",
    authDomain: "bhai-ka-bazar.firebaseapp.com",
    databaseURL: "https://bhai-ka-bazar-default-rtdb.firebaseio.com",
    projectId: "bhai-ka-bazar",
    storageBucket: "bhai-ka-bazar.firebasestorage.app",
    messagingSenderId: "178213150439",
    appId: "1:178213150439:web:e39937c5f12a5c00038c42"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let products = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let orders = [];
let adminCredentials = JSON.parse(localStorage.getItem('adminCredentials')) || { username: "admin", password: "admin123" };
let notifications = JSON.parse(localStorage.getItem('notifications')) || [];
let currentCategory = 'all';
let selectedPayment = 'cod';
let editingProductId = null;
let isAdminLoggedIn = false;
let currentImageTab = 'upload';
let uploadedImageBase64 = null;

const categoryNames = {
    'all': 'All Products', 'men': "Men's Fashion", 'women': "Women's Fashion",
    'electronics': 'Electronics', 'accessories': 'Accessories', 'home': 'Home & Living',
    'groceries': 'Groceries', 'foods': 'Foods', 'beauty': 'Beauty & Skincare'
};

function showToast(title, message, type, duration) {
    type = type || 'info';
    duration = duration || 4000;
    const container = document.getElementById('toastContainer');
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle', order: 'fa-bell' };
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.innerHTML = '<div class="toast-icon"><i class="fas ' + icons[type] + '"></i></div><div class="toast-content"><div class="toast-title">' + title + '</div><div class="toast-message">' + message + '</div></div><button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>';
    container.appendChild(toast);
    if (type === 'order') playNotificationSound();
    setTimeout(function() { toast.classList.add('hiding'); setTimeout(function() { toast.remove(); }, 400); }, duration);
}

function playNotificationSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch(e) {}
}

function sendBrowserNotification(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body: body, icon: 'https://cdn-icons-png.flaticon.com/512/3714/3714797.png', badge: 'https://cdn-icons-png.flaticon.com/512/3714/3714797.png', tag: 'order-notification', requireInteraction: true });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    loadProducts();
    loadOrders();
    updateCartCount();
    setupRealtimeListeners();
    document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
        overlay.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('active'); });
    });
    setupDragAndDrop();
});

function setupDragAndDrop() {
    const dropzone = document.getElementById('imageDropzone');
    if (!dropzone) return;
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(function(eventName) {
        dropzone.addEventListener(eventName, preventDefaults, false);
    });
    function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
    ['dragenter', 'dragover'].forEach(function(eventName) {
        dropzone.addEventListener(eventName, function() {
            dropzone.style.borderColor = 'var(--primary)';
            dropzone.style.background = 'var(--primary-light)';
        }, false);
    });
    ['dragleave', 'drop'].forEach(function(eventName) {
        dropzone.addEventListener(eventName, function() {
            dropzone.style.borderColor = '';
            dropzone.style.background = '';
        }, false);
    });
    dropzone.addEventListener('drop', handleDrop, false);
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) handleImageFile(files[0]);
}

function switchImageTab(tab) {
    currentImageTab = tab;
    document.querySelectorAll('.image-tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.image-upload-panel').forEach(function(p) { p.classList.remove('active'); });
    if (tab === 'upload') {
        document.getElementById('tabUpload').classList.add('active');
        document.getElementById('panelUpload').classList.add('active');
    } else {
        document.getElementById('tabUrl').classList.add('active');
        document.getElementById('panelUrl').classList.add('active');
    }
}

function handleImageUpload(input) {
    if (input.files && input.files[0]) handleImageFile(input.files[0]);
}

function handleImageFile(file) {
    if (!file.type.startsWith('image/')) { showToast('Invalid File', 'Please upload an image file (JPG, PNG, WEBP)', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { showToast('File Too Large', 'Image must be less than 5MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = function(e) {
        uploadedImageBase64 = e.target.result;
        document.getElementById('productImageBase64').value = uploadedImageBase64;
        const preview = document.getElementById('uploadPreview');
        preview.src = uploadedImageBase64;
        preview.style.display = 'block';
        const dropzone = document.getElementById('imageDropzone');
        dropzone.classList.add('has-image');
        document.getElementById('dropzoneContent').style.display = 'none';
        document.getElementById('removeImageBtn').style.display = 'inline-block';
        showToast('Image Uploaded', 'Image ready to use', 'success');
    };
    reader.readAsDataURL(file);
}

function removeUploadedImage() {
    uploadedImageBase64 = null;
    document.getElementById('productImageBase64').value = '';
    document.getElementById('productImageFile').value = '';
    const preview = document.getElementById('uploadPreview');
    preview.src = '';
    preview.style.display = 'none';
    const dropzone = document.getElementById('imageDropzone');
    dropzone.classList.remove('has-image');
    document.getElementById('dropzoneContent').style.display = 'block';
    document.getElementById('removeImageBtn').style.display = 'none';
}

function setupRealtimeListeners() {
    database.ref('products').on('value', function(snapshot) {
        const data = snapshot.val();
        if (data) {
            products = Object.values(data);
            renderProducts(currentCategory, document.getElementById('searchInput').value);
            if (isAdminLoggedIn) { renderAdminProducts(); updateAdminStats(); }
        }
    });
    database.ref('orders').on('child_added', function(snapshot) {
        const order = snapshot.val();
        if (isAdminLoggedIn && order.timestamp) {
            const orderTime = new Date(order.timestamp).getTime();
            if (Date.now() - orderTime < 5000) {
                showToast('New Order!', 'Order #' + order.id + ' from ' + order.customer.name + ' - Rs. ' + order.total.toLocaleString(), 'order', 8000);
                sendBrowserNotification('New Order Received!', 'Order #' + order.id + ' - Rs. ' + order.total.toLocaleString());
                addNotification(order);
            }
        }
        loadOrders();
    });
    database.ref('orders').on('value', function(snapshot) {
        const data = snapshot.val();
        if (data) {
            orders = Object.values(data).sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
            if (isAdminLoggedIn) { renderAdminOrders(); renderRecentOrders(); updateAdminStats(); }
        }
    });
}

function addNotification(order) {
    const notification = { id: Date.now(), orderId: order.id, customer: order.customer.name, amount: order.total, timestamp: new Date().toISOString(), read: false };
    notifications.unshift(notification);
    if (notifications.length > 50) notifications = notifications.slice(0, 50);
    localStorage.setItem('notifications', JSON.stringify(notifications));
    if (isAdminLoggedIn) renderNotifications();
}

function renderNotifications() {
    const container = document.getElementById('notificationList');
    if (notifications.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 20px;">No new notifications</p>';
        return;
    }
    container.innerHTML = notifications.map(function(notif) {
        return '<div class="notification-item ' + (notif.read ? '' : 'new') + '" onclick="markNotificationRead(' + notif.id + ')"><i class="fas fa-bell" style="color: ' + (notif.read ? 'var(--gray)' : 'var(--danger)') + ';"></i><div class="notification-content"><h4>New Order #' + notif.orderId + '</h4><p>' + notif.customer + ' - Rs. ' + notif.amount.toLocaleString() + '</p></div><span class="notification-time">' + formatTime(notif.timestamp) + '</span></div>';
    }).join('');
}

function markNotificationRead(id) {
    const notif = notifications.find(function(n) { return n.id === id; });
    if (notif) { notif.read = true; localStorage.setItem('notifications', JSON.stringify(notifications)); renderNotifications(); }
}

function clearNotifications() {
    notifications = [];
    localStorage.setItem('notifications', JSON.stringify(notifications));
    renderNotifications();
    showToast('Cleared', 'All notifications cleared', 'info');
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
    if (diff < 86400) return Math.floor(diff / 3600) + ' hours ago';
    return date.toLocaleDateString();
}

function loadProducts() {
    database.ref('products').once('value', function(snapshot) {
        const data = snapshot.val();
        if (data) products = Object.values(data);
        renderProducts();
    });
}

function loadOrders() {
    database.ref('orders').once('value', function(snapshot) {
        const data = snapshot.val();
        if (data) orders = Object.values(data).sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
    });
}

function renderProducts(filter, searchTerm) {
    filter = filter || 'all';
    searchTerm = searchTerm || '';
    const grid = document.getElementById('productsGrid');
    let filtered = products;
    if (filter !== 'all') filtered = filtered.filter(function(p) { return p.category === filter; });
    if (searchTerm) filtered = filtered.filter(function(p) { return p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase())); });
    
    if (filter !== 'all' && filtered.length === 0) {
        const catName = categoryNames[filter] || filter;
        grid.innerHTML = '<div class="coming-soon-container fade-in"><div class="coming-soon-icon"><i class="fas fa-rocket" style="font-size: 80px; color: var(--primary);"></i></div><h3>Coming Soon!</h3><p>' + catName + ' products will be available very soon. Stay tuned for amazing deals!</p><span class="coming-soon-badge"><i class="fas fa-clock"></i> Products Uploading Soon</span></div>';
        return;
    }
    if (filtered.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px;"><i class="fas fa-search" style="font-size: 60px; color: #DDD; margin-bottom: 20px;"></i><h3>No products found</h3><p style="color: var(--gray);">Try different search terms or category</p></div>';
        return;
    }
    grid.innerHTML = filtered.map(function(product) {
        return '<div class="product-card fade-in">' + 
            (product.badge ? '<div class="product-badge ' + product.badge + '">' + product.badge.toUpperCase() + '</div>' : '') +
            '<img src="' + product.image + '" alt="' + product.name + '" class="product-image" onerror="this.src=\'https://via.placeholder.com/400x400?text=No+Image\'">' +
            '<div class="product-info"><div class="product-category">' + product.category + '</div><div class="product-name">' + product.name + '</div>' +
            '<div class="product-price"><span class="current-price">Rs. ' + product.price.toLocaleString() + '</span>' + 
            (product.originalPrice ? '<span class="original-price">Rs. ' + product.originalPrice.toLocaleString() + '</span>' : '') + '</div>' +
            '<div class="product-actions"><button class="btn-add-cart" onclick="addToCart(' + product.id + ')"><i class="fas fa-shopping-cart"></i> Add to Cart</button>' +
            '<button class="btn-buy-now" onclick="buyNow(' + product.id + ')"><i class="fas fa-bolt"></i> Buy Now</button></div></div></div>';
    }).join('');
}

function filterCategory(category) {
    currentCategory = category;
    document.querySelectorAll('.nav-links a').forEach(function(link) {
        link.classList.remove('active');
        if (link.textContent.toLowerCase().includes(category) || (category === 'all' && link.textContent.includes('All'))) link.classList.add('active');
    });
    renderProducts(category, document.getElementById('searchInput').value);
    if (category !== 'all') document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
}

function searchProducts() {
    renderProducts(currentCategory, document.getElementById('searchInput').value);
}

function scrollToProducts() {
    document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
}

function scrollToCategories() {
    document.getElementById('categories').scrollIntoView({ behavior: 'smooth' });
}

function showHome() {
    document.getElementById('customerSite').style.display = 'block';
    document.getElementById('adminPanel').classList.remove('active');
    isAdminLoggedIn = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function addToCart(productId) {
    const product = products.find(function(p) { return p.id === productId; });
    if (!product) return;
    const existingItem = cart.find(function(item) { return item.id === productId; });
    if (existingItem) existingItem.quantity += 1;
    else cart.push({ id: product.id, name: product.name, price: product.price, image: product.image, quantity: 1 });
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    showToast('Added to Cart!', product.name + ' added successfully', 'success');
}

function buyNow(productId) {
    const product = products.find(function(p) { return p.id === productId; });
    if (!product) return;
    cart = [{ id: product.id, name: product.name, price: product.price, image: product.image, quantity: 1 }];
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    showCheckout();
    showToast('Buy Now', 'Proceeding to checkout with ' + product.name, 'info');
}

function updateCartCount() {
    document.getElementById('cartCount').textContent = cart.reduce(function(sum, item) { return sum + item.quantity; }, 0);
}

function toggleCart() {
    document.getElementById('cartSidebar').classList.toggle('active');
    renderCartItems();
}

function renderCartItems() {
    const container = document.getElementById('cartItems');
    if (cart.length === 0) {
        container.innerHTML = '<div class="cart-empty"><i class="fas fa-shopping-cart"></i><h3>Your cart is empty</h3><p>Add some products to get started!</p></div>';
        document.getElementById('cartTotal').textContent = 'Rs. 0';
        return;
    }
    container.innerHTML = cart.map(function(item) {
        return '<div class="cart-item"><img src="' + item.image + '" alt="' + item.name + '" onerror="this.src=\'https://via.placeholder.com/80?text=No+Image\'"><div class="cart-item-info"><div class="cart-item-name">' + item.name + '</div><div class="cart-item-price">Rs. ' + (item.price * item.quantity).toLocaleString() + '</div><div class="cart-item-qty"><button class="qty-btn" onclick="updateQuantity(' + item.id + ', -1)"><i class="fas fa-minus" style="font-size: 10px;"></i></button><span>' + item.quantity + '</span><button class="qty-btn" onclick="updateQuantity(' + item.id + ', 1)"><i class="fas fa-plus" style="font-size: 10px;"></i></button></div><div class="remove-item" onclick="removeFromCart(' + item.id + ')"><i class="fas fa-trash"></i> Remove</div></div></div>';
    }).join('');
    document.getElementById('cartTotal').textContent = 'Rs. ' + cart.reduce(function(sum, item) { return sum + (item.price * item.quantity); }, 0).toLocaleString();
}

function updateQuantity(productId, change) {
    const item = cart.find(function(item) { return item.id === productId; });
    if (!item) return;
    item.quantity += change;
    if (item.quantity <= 0) { removeFromCart(productId); return; }
    localStorage.setItem('cart', JSON.stringify(cart));
    renderCartItems();
    updateCartCount();
}

function removeFromCart(productId) {
    cart = cart.filter(function(item) { return item.id !== productId; });
    localStorage.setItem('cart', JSON.stringify(cart));
    renderCartItems();
    updateCartCount();
    showToast('Removed', 'Item removed from cart', 'info');
}

function showCheckout() {
    if (cart.length === 0) { showToast('Empty Cart', 'Please add items to cart first', 'warning'); return; }
    document.getElementById('cartSidebar').classList.remove('active');
    document.getElementById('checkoutModal').classList.add('active');
    document.getElementById('shippingStep').style.display = 'block';
    document.getElementById('paymentStep').style.display = 'none';
    document.getElementById('successStep').style.display = 'none';
    document.getElementById('step1').classList.add('active');
    document.getElementById('step2').classList.remove('active');
    document.getElementById('step3').classList.remove('active');
    document.getElementById('step1').classList.remove('completed');
    document.getElementById('step2').classList.remove('completed');
    const subtotal = cart.reduce(function(sum, item) { return sum + (item.price * item.quantity); }, 0);
    const shipping = subtotal >= 10000 ? 0 : 150;
    const total = subtotal + shipping;
    document.getElementById('checkoutSubtotal').textContent = 'Rs. ' + subtotal.toLocaleString();
    document.getElementById('checkoutShipping').textContent = shipping === 0 ? 'FREE' : 'Rs. ' + shipping;
    document.getElementById('checkoutTotal').textContent = 'Rs. ' + total.toLocaleString();
}

function closeCheckout() {
    document.getElementById('checkoutModal').classList.remove('active');
}

function goToPayment() {
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const email = document.getElementById('customerEmail').value.trim();
    const address = document.getElementById('customerAddress').value.trim();
    const city = document.getElementById('customerCity').value;
    const province = document.getElementById('customerProvince').value;
    const pin = document.getElementById('customerPin').value.trim();
    if (!name || !phone || !email || !address || !city || !province || !pin) { showToast('Missing Information', 'Please fill all required fields', 'error'); return; }
    document.getElementById('shippingStep').style.display = 'none';
    document.getElementById('paymentStep').style.display = 'block';
    document.getElementById('step1').classList.remove('active');
    document.getElementById('step1').classList.add('completed');
    document.getElementById('step2').classList.add('active');
}

function goBackToShipping() {
    document.getElementById('shippingStep').style.display = 'block';
    document.getElementById('paymentStep').style.display = 'none';
    document.getElementById('step1').classList.add('active');
    document.getElementById('step1').classList.remove('completed');
    document.getElementById('step2').classList.remove('active');
}

function selectPayment(method) {
    selectedPayment = method;
    document.querySelectorAll('.payment-method').forEach(function(el) { el.classList.remove('selected'); el.querySelector('input').checked = false; });
    event.currentTarget.classList.add('selected');
    event.currentTarget.querySelector('input').checked = true;
    document.getElementById('mobilePaymentDetails').style.display = (method === 'easypaisa' || method === 'jazzcash') ? 'block' : 'none';
}

function placeOrder() {
    if (selectedPayment === 'easypaisa' || selectedPayment === 'jazzcash') {
        const mobileNum = document.getElementById('mobileAccountNumber').value.trim();
        const cnic = document.getElementById('cnicNumber').value.trim();
        if (!mobileNum || !cnic) { showToast('Missing Details', 'Please enter mobile account number and CNIC', 'error'); return; }
    }
    const orderId = 'ORD-' + Date.now().toString().slice(-6);
    const subtotal = cart.reduce(function(sum, item) { return sum + (item.price * item.quantity); }, 0);
    const shipping = subtotal >= 10000 ? 0 : 150;
    const total = subtotal + shipping;
    const order = {
        id: orderId, timestamp: new Date().toISOString(), date: new Date().toLocaleString(),
        customer: { name: document.getElementById('customerName').value, phone: document.getElementById('customerPhone').value, email: document.getElementById('customerEmail').value, address: document.getElementById('customerAddress').value, city: document.getElementById('customerCity').value, province: document.getElementById('customerProvince').value, pin: document.getElementById('customerPin').value },
        items: cart.slice(), subtotal: subtotal, shipping: shipping, total: total, payment: selectedPayment, status: 'Pending'
    };
    database.ref('orders/' + orderId).set(order).then(function() {
        cart = [];
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
        document.getElementById('paymentStep').style.display = 'none';
        document.getElementById('successStep').style.display = 'block';
        document.getElementById('step2').classList.remove('active');
        document.getElementById('step2').classList.add('completed');
        document.getElementById('step3').classList.add('active');
        document.getElementById('orderDetails').innerHTML = 
            '<div class="order-detail-row"><span>Order ID:</span><span>#' + orderId + '</span></div>' +
            '<div class="order-detail-row"><span>Customer:</span><span>' + order.customer.name + '</span></div>' +
            '<div class="order-detail-row"><span>Phone:</span><span>' + order.customer.phone + '</span></div>' +
            '<div class="order-detail-row"><span>Address:</span><span>' + order.customer.address + ', ' + order.customer.city + '</span></div>' +
            '<div class="order-detail-row"><span>Payment:</span><span>' + selectedPayment.toUpperCase() + '</span></div>' +
            '<div class="order-detail-row"><span>Items:</span><span>' + order.items.length + ' products</span></div>' +
            '<div class="order-detail-row"><span>Total Amount:</span><span>Rs. ' + total.toLocaleString() + '</span></div>';
        showToast('Order Placed!', 'Order #' + orderId + ' confirmed successfully', 'success', 6000);
    }).catch(function(error) { showToast('Error', 'Failed to place order. Please try again.', 'error'); });
}

function showAdminLogin() {
    document.getElementById('adminLoginModal').classList.add('active');
}

function closeAdminLogin() {
    document.getElementById('adminLoginModal').classList.remove('active');
    document.getElementById('adminUsername').value = '';
    document.getElementById('adminPassword').value = '';
}

function loginAdmin() {
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value;
    if (username === adminCredentials.username && password === adminCredentials.password) {
        document.getElementById('adminLoginModal').classList.remove('active');
        document.getElementById('customerSite').style.display = 'none';
        document.getElementById('adminPanel').classList.add('active');
        isAdminLoggedIn = true;
        showAdminSection('dashboard');
        updateAdminStats();
        renderAdminProducts();
        renderAdminOrders();
        renderRecentOrders();
        renderNotifications();
        showToast('Welcome Admin!', 'Successfully logged in to admin panel', 'success');
    } else {
        showToast('Login Failed', 'Invalid username or password', 'error');
    }
}

function logoutAdmin() {
    document.getElementById('adminPanel').classList.remove('active');
    document.getElementById('customerSite').style.display = 'block';
    isAdminLoggedIn = false;
    showToast('Logged Out', 'You have been logged out successfully', 'info');
}

function showAdminSection(section) {
    document.querySelectorAll('.admin-section').forEach(function(el) { el.classList.remove('active'); });
    document.querySelectorAll('.admin-nav a').forEach(function(el) { el.classList.remove('active'); });
    document.getElementById('admin' + section.charAt(0).toUpperCase() + section.slice(1)).classList.add('active');
    document.querySelectorAll('.admin-nav a').forEach(function(link) { if (link.textContent.toLowerCase().includes(section)) link.classList.add('active'); });
    if (section === 'products') renderAdminProducts();
    if (section === 'orders') renderAdminOrders();
    if (section === 'dashboard') { updateAdminStats(); renderRecentOrders(); renderNotifications(); }
}

function updateAdminStats() {
    const totalSales = orders.reduce(function(sum, order) { return sum + order.total; }, 0);
    const pendingOrders = orders.filter(function(o) { return o.status === 'Pending'; }).length;
    document.getElementById('totalSales').textContent = 'Rs. ' + totalSales.toLocaleString();
    document.getElementById('totalOrders').textContent = orders.length;
    document.getElementById('totalProducts').textContent = products.length;
    document.getElementById('pendingOrders').textContent = pendingOrders;
}

function renderRecentOrders() {
    const tbody = document.getElementById('recentOrdersTable');
    const recent = orders.slice(0, 5);
    if (recent.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--gray);">No orders yet</td></tr>'; return; }
    tbody.innerHTML = recent.map(function(order) {
        return '<tr><td><strong>#' + order.id + '</strong></td><td>' + order.customer.name + '</td><td>Rs. ' + order.total.toLocaleString() + '</td><td>' + order.payment.toUpperCase() + '</td><td><span class="status-badge status-' + order.status.toLowerCase() + '">' + order.status + '</span></td></tr>';
    }).join('');
}

function renderAdminProducts() {
    const tbody = document.getElementById('adminProductsTable');
    if (products.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--gray);">No products added yet</td></tr>'; return; }
    tbody.innerHTML = products.map(function(product) {
        return '<tr><td><img src="' + product.image + '" class="product-thumb" onerror="this.src=\'https://via.placeholder.com/50?text=No+Image\'"></td><td><strong>' + product.name + '</strong></td><td><span style="text-transform: capitalize;">' + product.category + '</span></td><td>Rs. ' + product.price.toLocaleString() + '</td><td>' + product.stock + '</td><td><div class="action-btns"><button class="action-btn edit" onclick="editProduct(' + product.id + ')" title="Edit"><i class="fas fa-edit"></i></button><button class="action-btn delete" onclick="deleteProduct(' + product.id + ')" title="Delete"><i class="fas fa-trash"></i></button></div></td></tr>';
    }).join('');
}

function renderAdminOrders() {
    const tbody = document.getElementById('allOrdersTable');
    if (orders.length === 0) { tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--gray);">No orders yet</td></tr>'; return; }
    tbody.innerHTML = orders.map(function(order) {
        return '<tr><td><strong>#' + order.id + '</strong></td><td>' + order.date + '</td><td>' + order.customer.name + '<br><small style="color: var(--gray);">' + order.customer.phone + '</small></td><td>' + order.items.length + ' items</td><td>Rs. ' + order.total.toLocaleString() + '</td><td>' + order.payment.toUpperCase() + '</td><td><span class="status-badge status-' + order.status.toLowerCase() + '">' + order.status + '</span></td><td><div class="action-btns"><button class="action-btn view" onclick="viewOrder(\'' + order.id + '\')" title="View"><i class="fas fa-eye"></i></button><button class="action-btn edit" onclick="updateOrderStatus(\'' + order.id + '\')" title="Update Status"><i class="fas fa-check"></i></button></div></td></tr>';
    }).join('');
}

function showAddProductModal() {
    editingProductId = null;
    currentImageTab = 'upload';
    uploadedImageBase64 = null;
    document.getElementById('productModalTitle').innerHTML = '<i class="fas fa-plus"></i> Add New Product';
    document.getElementById('editProductId').value = '';
    document.getElementById('productImageUrl').value = '';
    document.getElementById('productImageBase64').value = '';
    document.getElementById('productName').value = '';
    document.getElementById('productCategory').value = '';
    document.getElementById('productPrice').value = '';
    document.getElementById('productOriginalPrice').value = '';
    document.getElementById('productStock').value = '';
    document.getElementById('productBadge').value = '';
    document.getElementById('productDescription').value = '';
    removeUploadedImage();
    switchImageTab('upload');
    document.getElementById('productModal').classList.add('active');
}

function editProduct(productId) {
    const product = products.find(function(p) { return p.id === productId; });
    if (!product) return;
    editingProductId = productId;
    currentImageTab = 'url';
    uploadedImageBase64 = null;
    document.getElementById('productModalTitle').innerHTML = '<i class="fas fa-edit"></i> Edit Product';
    document.getElementById('editProductId').value = productId;
    document.getElementById('productImageUrl').value = product.image;
    document.getElementById('productImageBase64').value = '';
    document.getElementById('productName').value = product.name;
    document.getElementById('productCategory').value = product.category;
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productOriginalPrice').value = product.originalPrice || '';
    document.getElementById('productStock').value = product.stock;
    document.getElementById('productBadge').value = product.badge || '';
    document.getElementById('productDescription').value = product.description || '';
    removeUploadedImage();
    switchImageTab('url');
    document.getElementById('productModal').classList.add('active');
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
}

function saveProduct() {
    const name = document.getElementById('productName').value.trim();
    const category = document.getElementById('productCategory').value;
    const price = parseFloat(document.getElementById('productPrice').value);
    const originalPrice = parseFloat(document.getElementById('productOriginalPrice').value) || 0;
    const stock = parseInt(document.getElementById('productStock').value);
    const badge = document.getElementById('productBadge').value;
    const description = document.getElementById('productDescription').value.trim();
    let image = '';
    if (currentImageTab === 'upload') {
        image = document.getElementById('productImageBase64').value;
    } else {
        image = document.getElementById('productImageUrl').value.trim();
    }
    if (!image || !name || !category || !price || !stock) { showToast('Missing Fields', 'Please fill all required fields including image', 'error'); return; }
    const productData = { id: editingProductId || (products.length > 0 ? Math.max.apply(null, products.map(function(p) { return p.id; })) + 1 : 1), image: image, name: name, category: category, price: price, originalPrice: originalPrice || null, stock: stock, badge: badge || '', description: description };
    database.ref('products/' + productData.id).set(productData).then(function() {
        showToast(editingProductId ? 'Updated!' : 'Added!', editingProductId ? 'Product updated successfully' : 'New product added successfully', 'success');
        closeProductModal();
    }).catch(function(error) { showToast('Error', 'Failed to save product', 'error'); });
}

function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    database.ref('products/' + productId).remove().then(function() { showToast('Deleted!', 'Product removed successfully', 'warning'); }).catch(function(error) { showToast('Error', 'Failed to delete product', 'error'); });
}

function viewOrder(orderId) {
    const order = orders.find(function(o) { return o.id === orderId; });
    if (!order) return;
    alert('Order Details:\n\nOrder ID: #' + order.id + '\nCustomer: ' + order.customer.name + '\nPhone: ' + order.customer.phone + '\nAddress: ' + order.customer.address + ', ' + order.customer.city + '\nItems: ' + order.items.map(function(i) { return i.name + ' x' + i.quantity; }).join(', ') + '\nTotal: Rs. ' + order.total.toLocaleString() + '\nPayment: ' + order.payment.toUpperCase() + '\nStatus: ' + order.status);
}

function updateOrderStatus(orderId) {
    const order = orders.find(function(o) { return o.id === orderId; });
    if (!order) return;
    const statuses = ['Pending', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];
    const nextStatus = statuses[(statuses.indexOf(order.status) + 1) % statuses.length];
    database.ref('orders/' + orderId + '/status').set(nextStatus).then(function() { showToast('Status Updated', 'Order #' + orderId + ' is now ' + nextStatus, 'success'); }).catch(function(error) { showToast('Error', 'Failed to update status', 'error'); });
}

function updateCredentials() {
    const currentPass = document.getElementById('currentPassword').value;
    const newUser = document.getElementById('newUsername').value.trim();
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmPassword').value;
    if (currentPass !== adminCredentials.password) { showToast('Wrong Password', 'Current password is incorrect', 'error'); return; }
    if (!newUser || !newPass) { showToast('Missing Fields', 'Please enter new username and password', 'error'); return; }
    if (newPass !== confirmPass) { showToast('Mismatch', 'New passwords do not match', 'error'); return; }
    adminCredentials = { username: newUser, password: newPass };
    localStorage.setItem('adminCredentials', JSON.stringify(adminCredentials));
    document.getElementById('currentUsername').value = newUser;
    document.getElementById('currentPassword').value = '';
    document.getElementById('newUsername').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    showToast('Updated!', 'Login credentials changed successfully', 'success');
}

if (document.getElementById('currentUsername')) {
    document.getElementById('currentUsername').value = adminCredentials.username;
}