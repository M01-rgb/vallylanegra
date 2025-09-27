// Configuration Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAG0n1uwFULiy3x00OXHsFUQCetRGhjTjU",
    authDomain: "valy-3c8d8.firebaseapp.com",
    projectId: "valy-3c8d8",
    storageBucket: "valy-3c8d8.firebasestorage.app",
    messagingSenderId: "231448443924",
    appId: "1:231448443924:web:366b608f77368cd720fb01"
};

// Variables globales
let currentUser = null;
let products = [];
let cart = [];
let searchTerm = '';
let currentCategory = 'all';

document.addEventListener("DOMContentLoaded", () => {
    console.log("Boutique Valy la Negra - Chargement...");
    
    // Initialiser Firebase
    if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        window.db = firebase.firestore();
        loadProducts();
    }
    
    loadCart();
    checkUserRegistration();
    setupEventListeners();
});

function loadProducts() {
    if (!window.db) {
        console.log("Mode démo activé");
        showDemoProducts();
        return;
    }
    
    const productsCol = window.db.collection("products");
    const q = productsCol.orderBy("createdAt", "desc");
    
    q.onSnapshot((snapshot) => {
        products = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        }));
        
        console.log(`${products.length} produits chargés depuis Firebase`);
        renderProducts();
    }, (error) => {
        console.error("Erreur chargement produits:", error);
        showDemoProducts();
    });
}

function showDemoProducts() {
    products = [];
    renderProducts();
}

function renderProducts() {
    const grid = document.getElementById("productsGrid");
    if (!grid) return;
    
    // Filtrer les produits
    let filteredProducts = products;
    
    if (currentCategory !== 'all') {
        filteredProducts = filteredProducts.filter(p => p.category === currentCategory);
    }
    
    if (searchTerm) {
        filteredProducts = filteredProducts.filter(p => 
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }
    
    if (filteredProducts.length === 0) {
        grid.innerHTML = `
            <div class="no-products">
                <i class="fas fa-search" style="font-size:3rem;color:#ff4d94;"></i>
                <h3>${products.length === 0 ? 'Aucun produit disponible' : 'Aucun produit trouvé'}</h3>
                <p>${products.length === 0 ? 
                    'Les produits seront affichés ici une fois ajoutés via la page admin.' : 
                    'Aucun produit ne correspond à votre recherche.'}
                </p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = filteredProducts.map(product => {
        const discount = product.originalPrice > product.price ? 
            Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0;
            
        const mainImage = product.images && product.images.length > 0 ? product.images[0] : 
            'https://images.unsplash.com/photo-1560769684-55015cee73a8?w=400&h=400&fit=crop';
            
        return `
            <div class="product-card">
                <div class="product-image">
                    <img src="${mainImage}" alt="${product.name}">
                    ${discount > 0 ? `<div class="discount-badge">-${discount}%</div>` : ''}
                </div>
                <div class="product-info">
                    <h3 class="product-name">${product.name}</h3>
                    <p class="product-category">${product.category}</p>
                    <p class="product-description">${product.description || 'Produit de qualité'}</p>
                    <div class="product-price">
                        <span class="current-price">$${product.price.toFixed(2)}</span>
                        ${discount > 0 ? `<span class="original-price">$${product.originalPrice.toFixed(2)}</span>` : ''}
                    </div>
                    <button class="add-to-cart" onclick="addToCart('${product.id}')">
                        <i class="fas fa-shopping-cart"></i> Ajouter au panier
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Le reste de vos fonctions existantes...
function setupEventListeners() {
    // Recherche
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            searchTerm = e.target.value;
            renderProducts();
        });
    }
    
    // Catégories
    document.querySelectorAll(".category-btn").forEach(btn => {
        btn.addEventListener("click", function() {
            document.querySelectorAll(".category-btn").forEach(b => b.classList.remove("active"));
            this.classList.add("active");
            currentCategory = this.dataset.category;
            renderProducts();
        });
    });
}

function loadCart() {
    const saved = localStorage.getItem("valylanegra-cart");
    cart = saved ? JSON.parse(saved) : [];
    updateCartUI();
}

function saveCart() {
    localStorage.setItem("valylanegra-cart", JSON.stringify(cart));
    updateCartUI();
}

function updateCartUI() {
    const count = document.getElementById("cartCount");
    const total = document.getElementById("cartTotal");
    const items = document.getElementById("cartItems");
    
    if (count) count.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (total) total.textContent = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2);
    
    if (items) {
        if (cart.length === 0) {
            items.innerHTML = '<p class="empty-cart">Votre panier est vide</p>';
        } else {
            items.innerHTML = cart.map(item => `
                <div class="cart-item">
                    <img src="${item.image}" alt="${item.name}">
                    <div class="cart-item-details">
                        <h4>${item.name}</h4>
                        <p>$${item.price} x ${item.quantity}</p>
                    </div>
                </div>
            `).join('');
        }
    }
}

window.addToCart = function(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const existing = cart.find(item => item.id === productId);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.images && product.images.length > 0 ? product.images[0] : '',
            quantity: 1
        });
    }
    
    saveCart();
    alert(`${product.name} ajouté au panier!`);
};

window.toggleCart = function() {
    const sidebar = document.getElementById("cartSidebar");
    const overlay = document.getElementById("overlay");
    if (sidebar) sidebar.classList.toggle("active");
    if (overlay) overlay.classList.toggle("active");
};

function checkUserRegistration() {
    const user = localStorage.getItem("valylanegra-current-user");
    if (user) {
        currentUser = JSON.parse(user);
        document.getElementById("userNameDisplay").textContent = currentUser.name;
    } else {
        document.getElementById("registrationModal").classList.add("active");
    }
}

// Gestion de l'inscription
document.getElementById("registrationForm").addEventListener("submit", function(e) {
    e.preventDefault();
    const name = document.getElementById("userName").value;
    const email = document.getElementById("userEmail").value;
    const phone = document.getElementById("userPhone").value;
    
    if (name && email && phone) {
        currentUser = { name, email, phone };
        localStorage.setItem("valylanegra-current-user", JSON.stringify(currentUser));
        document.getElementById("userNameDisplay").textContent = name;
        document.getElementById("registrationModal").classList.remove("active");
    }
});
