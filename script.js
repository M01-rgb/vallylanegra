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

// Initialisation
document.addEventListener("DOMContentLoaded", () => {
    console.log("🚀 Valy la Negra - Démarrage...");
    
    // Initialiser Firebase
    if (typeof firebase !== 'undefined') {
        try {
            // Vérifier si Firebase est déjà initialisé
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            window.db = firebase.firestore();
            console.log("✅ Firebase initialisé avec succès");
            
            // Charger les produits
            loadProducts();
        } catch (error) {
            console.error("❌ Erreur Firebase:", error);
            showError("Erreur de connexion à la base de données");
        }
    } else {
        console.error("❌ Firebase non chargé");
        showDemoProducts();
    }
    
    loadCart();
    checkUserRegistration();
    setupEventListeners();
});

// CHARGER LES PRODUITS DEPuis FIRESTORE
function loadProducts() {
    console.log("📦 Chargement des produits depuis Firestore...");
    
    if (!window.db) {
        console.error("❌ Firestore non disponible");
        showDemoProducts();
        return;
    }
    
    const productsCol = window.db.collection("products");
    
    // Écouter les changements en temps réel
    productsCol.onSnapshot((snapshot) => {
        console.log("🔥 Nouveaux données reçues de Firestore");
        
        products = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name || 'Sans nom',
                category: data.category || 'non-categorise',
                price: data.price || 0,
                originalPrice: data.originalPrice || data.price || 0,
                description: data.description || 'Description non disponible',
                images: data.images || [],
                inStock: data.inStock !== false,
                createdAt: data.createdAt
            };
        });
        
        console.log(`✅ ${products.length} produits chargés depuis Firestore`);
        renderProducts();
        
    }, (error) => {
        console.error("❌ Erreur Firestore:", error);
        showError("Impossible de charger les produits");
        showDemoProducts();
    });
}

// AFFICHER LES PRODUITS
function renderProducts() {
    const grid = document.getElementById("productsGrid");
    if (!grid) {
        console.error("❌ Grille de produits non trouvée");
        return;
    }
    
    console.log(`🎨 Rendu de ${products.length} produits...`);
    
    // Filtrer les produits selon la catégorie et la recherche
    let filteredProducts = products.filter(product => {
        // Filtre par catégorie
        if (currentCategory !== 'all' && product.category !== currentCategory) {
            return false;
        }
        
        // Filtre par recherche
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            return product.name.toLowerCase().includes(term) ||
                   (product.description && product.description.toLowerCase().includes(term)) ||
                   (product.category && product.category.toLowerCase().includes(term));
        }
        
        return true;
    });
    
    console.log(`🔍 ${filteredProducts.length} produits après filtrage`);
    
    if (filteredProducts.length === 0) {
        grid.innerHTML = `
            <div class="no-products">
                <i class="fas fa-search" style="font-size:3rem;color:#ff4d94;margin-bottom:1rem;"></i>
                <h3>${products.length === 0 ? 'Aucun produit disponible' : 'Aucun produit trouvé'}</h3>
                <p>${products.length === 0 ? 
                    'Les produits ajoutés via la page admin apparaîtront ici.' : 
                    'Essayez de modifier votre recherche ou catégorie.'
                }</p>
                ${products.length === 0 ? `
                    <div style="margin-top:1rem;">
                        <a href="admin.html" class="btn-primary" style="text-decoration:none;">
                            <i class="fas fa-cog"></i> Accéder à l'admin pour ajouter des produits
                        </a>
                    </div>
                ` : ''}
            </div>
        `;
        return;
    }
    
    // Créer le HTML des produits
    grid.innerHTML = filteredProducts.map(product => {
        const discount = product.originalPrice > product.price ? 
            Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0;
            
        const mainImage = product.images && product.images.length > 0 ? 
            product.images[0] : 'https://images.unsplash.com/photo-1560769684-55015cee73a8?w=400&h=400&fit=crop&text=Image+Manquante';
        
        return `
            <div class="product-card" data-category="${product.category}">
                <div class="product-image">
                    <img src="${mainImage}" alt="${product.name}" loading="lazy">
                    ${discount > 0 ? `<div class="discount-badge">-${discount}%</div>` : ''}
                    ${product.inStock === false ? `<div class="out-of-stock-badge">Rupture</div>` : ''}
                </div>
                <div class="product-info">
                    <h3 class="product-name">${product.name}</h3>
                    <div class="product-category">${formatCategory(product.category)}</div>
                    <p class="product-description">${product.description}</p>
                    <div class="product-price">
                        <span class="current-price">$${product.price.toFixed(2)}</span>
                        ${discount > 0 ? `<span class="original-price">$${product.originalPrice.toFixed(2)}</span>` : ''}
                    </div>
                    <button class="add-to-cart" onclick="addToCart('${product.id}')" ${product.inStock === false ? 'disabled' : ''}>
                        <i class="fas fa-shopping-cart"></i> 
                        ${product.inStock === false ? 'Rupture de stock' : 'Ajouter au panier'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// FORMATER LES CATÉGORIES
function formatCategory(category) {
    const categories = {
        'clothing': '👕 Vêtements',
        'shoes': '👟 Chaussures',
        'electronics': '📱 Électronique',
        'home': '🏠 Maison',
        'sports': '⚽ Sports',
        'beauty': '💄 Beauté',
        'non-categorise': '📦 Non catégorisé'
    };
    return categories[category] || category;
}

// CONFIGURATION DES ÉVÉNEMENTS
function setupEventListeners() {
    console.log("🎯 Configuration des événements...");
    
    // Recherche
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            searchTerm = e.target.value;
            console.log("🔍 Recherche:", searchTerm);
            renderProducts();
        });
    }
    
    // Bouton de suppression de recherche
    const clearSearch = document.getElementById("clearSearch");
    if (clearSearch) {
        clearSearch.addEventListener("click", () => {
            if (searchInput) searchInput.value = '';
            searchTerm = '';
            clearSearch.style.display = 'none';
            renderProducts();
        });
    }
    
    // Catégories
    document.querySelectorAll(".category-btn").forEach(btn => {
        btn.addEventListener("click", function() {
            document.querySelectorAll(".category-btn").forEach(b => b.classList.remove("active"));
            this.classList.add("active");
            currentCategory = this.dataset.category;
            console.log("📂 Catégorie sélectionnée:", currentCategory);
            renderProducts();
        });
    });
    
    // Formulaire d'inscription
    const registrationForm = document.getElementById("registrationForm");
    if (registrationForm) {
        registrationForm.addEventListener("submit", function(e) {
            e.preventDefault();
            registerUser();
        });
    }
}

// INSCRIPTION UTILISATEUR
function registerUser() {
    const name = document.getElementById("userName").value.trim();
    const email = document.getElementById("userEmail").value.trim();
    const phone = document.getElementById("userPhone").value.trim();
    
    if (name && email && phone) {
        currentUser = { name, email, phone };
        localStorage.setItem("valylanegra-current-user", JSON.stringify(currentUser));
        document.getElementById("userNameDisplay").textContent = name;
        document.getElementById("registrationModal").classList.remove("active");
        showMessage(`Bienvenue ${name} ! 🎉`, 'success');
    } else {
        showMessage('Veuillez remplir tous les champs', 'error');
    }
}

// GESTION DU PANIER
function loadCart() {
    try {
        const savedCart = localStorage.getItem("valylanegra-cart");
        const savedUser = localStorage.getItem("valylanegra-current-user");
        
        cart = savedCart ? JSON.parse(savedCart) : [];
        currentUser = savedUser ? JSON.parse(savedUser) : null;
        
        console.log("🛒 Panier chargé:", cart.length, "articles");
    } catch (e) {
        console.error("❌ Erreur chargement panier:", e);
        cart = [];
    }
    updateCartUI();
}

function saveCart() {
    localStorage.setItem("valylanegra-cart", JSON.stringify(cart));
    updateCartUI();
}

function updateCartUI() {
    const countElement = document.getElementById("cartCount");
    const totalElement = document.getElementById("cartTotal");
    const itemsElement = document.getElementById("cartItems");
    
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    if (countElement) countElement.textContent = totalItems;
    if (totalElement) totalElement.textContent = totalPrice.toFixed(2);
    
    if (itemsElement) {
        if (cart.length === 0) {
            itemsElement.innerHTML = `
                <div class="empty-cart">
                    <i class="fas fa-shopping-cart"></i>
                    <p>Votre panier est vide</p>
                </div>
            `;
        } else {
            itemsElement.innerHTML = cart.map(item => `
                <div class="cart-item">
                    <img src="${item.image}" alt="${item.name}">
                    <div class="cart-item-info">
                        <div class="cart-item-name">${item.name}</div>
                        <div class="cart-item-price">$${item.price.toFixed(2)}</div>
                        <div class="quantity-controls">
                            <button onclick="updateQuantity('${item.id}', ${item.quantity - 1})">-</button>
                            <span>${item.quantity}</span>
                            <button onclick="updateQuantity('${item.id}', ${item.quantity + 1})">+</button>
                            <button onclick="removeFromCart('${item.id}')" class="remove-btn">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }
}

// FONCTIONS GLOBALES
window.addToCart = function(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) {
        showMessage('Produit non trouvé', 'error');
        return;
    }
    
    if (product.inStock === false) {
        showMessage('Ce produit est en rupture de stock', 'error');
        return;
    }
    
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity += 1;
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
    showMessage(`${product.name} ajouté au panier! 🛒`, 'success');
};

window.updateQuantity = function(productId, newQuantity) {
    const item = cart.find(item => item.id === productId);
    if (!item) return;
    
    if (newQuantity <= 0) {
        cart = cart.filter(item => item.id !== productId);
    } else {
        item.quantity = newQuantity;
    }
    
    saveCart();
};

window.removeFromCart = function(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    showMessage('Produit retiré du panier', 'success');
};

window.toggleCart = function() {
    const sidebar = document.getElementById("cartSidebar");
    const overlay = document.getElementById("overlay");
    
    if (sidebar) sidebar.classList.toggle("active");
    if (overlay) overlay.classList.toggle("active");
};

// VÉRIFICATION DE L'INSCRIPTION
function checkUserRegistration() {
    const savedUser = localStorage.getItem("valylanegra-current-user");
    
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            document.getElementById("userNameDisplay").textContent = currentUser.name;
        } catch (e) {
            console.error("❌ Erreur parsing utilisateur:", e);
            showRegistrationModal();
        }
    } else {
        showRegistrationModal();
    }
}

function showRegistrationModal() {
    setTimeout(() => {
        const modal = document.getElementById("registrationModal");
        if (modal) modal.classList.add("active");
    }, 1000);
}

// FONCTIONS D'AFFICHAGE DES MESSAGES
function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation' : 'info'}-circle"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => messageDiv.classList.add('show'), 100);
    setTimeout(() => {
        messageDiv.classList.remove('show');
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}

function showError(message) {
    showMessage(message, 'error');
}

// PRODUITS DE DÉMONSTRATION (si Firebase échoue)
function showDemoProducts() {
    console.log("🔄 Affichage des produits de démonstration");
    products = [];
    renderProducts();
}

// FERMETURE DES MODALS
document.getElementById("overlay").addEventListener("click", function() {
    document.getElementById("cartSidebar").classList.remove("active");
    document.getElementById("registrationModal").classList.remove("active");
    this.classList.remove("active");
});

console.log("✅ Script Valy la Negra prêt !");
