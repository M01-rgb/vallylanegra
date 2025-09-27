// Configuration Firebase avec vos informations
const firebaseConfig = {
  apiKey: "AIzaSyAG0n1uwFULiy3x00OXHsFUQCetRGhjTjU",
  authDomain: "valy-3c8d8.firebaseapp.com",
  projectId: "valy-3c8d8",
  storageBucket: "valy-3c8d8.firebasestorage.app",
  messagingSenderId: "231448443924",
  appId: "1:231448443924:web:366b608f77368cd720fb01"
};

// Initialiser Firebase
let db;
try {
    // Initialiser Firebase
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log("Firebase initialisé avec succès");
} catch (error) {
    console.error("Erreur d'initialisation Firebase:", error);
}

// Variables globales
let currentUser = null;
let products = [];
let allProducts = [];
let filteredProducts = [];
let cart = [];
let users = [];
let currentProductImages = [];
let currentImageIndex = 0;
let isAddingToCart = false;
let searchTerm = '';
let currentCategory = 'all';

// Options par catégorie
const SIZE_OPTIONS = {
    clothing: ["XS", "S", "M", "L", "XL", "XXL", "XXXL"],
    shoes: ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"],
    electronics: ["Standard", "Petit", "Moyen", "Grand", "Extra Large"],
    home: ["Petit", "Moyen", "Grand", "Personnalisé"],
    sports: ["XS", "S", "M", "L", "XL", "XXL"],
    beauty: ["100ml", "200ml", "250ml", "500ml", "1L"],
    default: ["Unique", "Standard", "Personnalisé"]
};

const COLORS = ["Blanc", "Noir", "Rouge", "Bleu", "Vert", "Jaune", "Rose", "Violet", "Orange", "Gris", "Marron", "Beige"];

document.addEventListener("DOMContentLoaded", () => {
    console.log("Chargement de l'application Valy la Negra...");
    
    // Vérifier si Firebase est disponible
    if (typeof firebase !== 'undefined' && db) {
        console.log("Mode Firebase activé");
        loadFirestoreProducts();
        loadFirestoreUsers();
    } else {
        console.warn("Firebase non disponible - mode démo activé");
        loadDemoProducts();
    }
    
    loadCart();
    checkUserRegistration();
    setupEventListeners();
    setupLightbox();
    window.toggleCart = toggleCart;
});

function loadFirestoreProducts() {
    if (!db) {
        console.error("Firestore non initialisé");
        loadDemoProducts();
        return;
    }
    
    console.log("Chargement des produits depuis Firestore...");
    
    const productsCol = db.collection("products");
    const q = productsCol.orderBy("createdAt", "desc");
    
    q.onSnapshot((snapshot) => {
        console.log(`${snapshot.docs.length} produits chargés depuis Firestore`);
        allProducts = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        }));
        
        // Mélanger aléatoirement les produits
        products = shuffleArray([...allProducts]);
        
        // Appliquer les filtres actuels (recherche et catégorie)
        applyFilters();
    }, (error) => {
        console.error("Erreur chargement produits Firestore:", error);
        loadDemoProducts();
    });
}

function loadDemoProducts() {
    console.log("Chargement des produits de démonstration...");
    
    // Produits de démonstration si Firebase n'est pas disponible
    products = [
        {
            id: "1",
            name: "Robe Élégante Valy",
            category: "clothing",
            price: 29.99,
            originalPrice: 39.99,
            description: "Robe élégante pour toutes occasions",
            images: ["https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=300&h=300&fit=crop"]
        },
        {
            id: "2", 
            name: "Chaussures Tendances",
            category: "shoes",
            price: 49.99,
            originalPrice: 59.99,
            description: "Chaussures confortables et stylées",
            images: ["https://images.unsplash.com/photo-1549298916-b41d501d3772?w=300&h=300&fit=crop"]
        },
        {
            id: "3",
            name: "Sac à Main Design",
            category: "accessories",
            price: 39.99,
            originalPrice: 49.99,
            description: "Sac pratique et élégant",
            images: ["https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=300&h=300&fit=crop"]
        },
        {
            id: "4",
            name: "Bijoux Fantaisie",
            category: "jewelry",
            price: 19.99,
            originalPrice: 24.99,
            description: "Bijoux uniques et tendance",
            images: ["https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=300&h=300&fit=crop"]
        }
    ];
    
    allProducts = [...products];
    applyFilters();
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function loadFirestoreUsers() {
    if (!db) return;
    
    const usersCol = db.collection("users");
    usersCol.onSnapshot((snapshot) => {
        users = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        }));
        console.log(`${users.length} utilisateurs chargés`);
    }, (error) => {
        console.error("Erreur chargement utilisateurs:", error);
    });
}

function loadCart() {
    try {
        const savedCart = localStorage.getItem("valylanegra-cart");
        const savedUser = localStorage.getItem("valylanegra-current-user");
        
        cart = savedCart ? JSON.parse(savedCart) : [];
        currentUser = savedUser ? JSON.parse(savedUser) : null;
        
        console.log("Panier chargé:", cart.length, "articles");
    } catch (e) {
        console.error("Erreur chargement panier:", e);
        cart = [];
        currentUser = null;
    }
    updateCartUI();
    
    // Synchroniser le panier avec Firestore si l'utilisateur est connecté
    if (currentUser && db) {
        syncCartToFirestore();
    }
}

// Synchroniser le panier avec Firestore
async function syncCartToFirestore() {
    if (!currentUser || !db) return;
    
    try {
        // Vérifier si l'utilisateur a déjà un panier
        const cartsQuery = db.collection("carts").where("userId", "==", currentUser.id);
        const querySnapshot = await cartsQuery.get();
        
        if (!querySnapshot.empty) {
            // Mettre à jour le panier existant
            const cartDoc = querySnapshot.docs[0];
            await cartDoc.ref.update({
                items: cart,
                totalAmount: calculateTotal(),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log("Panier Firestore mis à jour");
        } else {
            // Créer un nouveau panier
            await db.collection("carts").add({
                userId: currentUser.id,
                items: cart,
                totalAmount: calculateTotal(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log("Nouveau panier Firestore créé");
        }
    } catch (error) {
        console.error("Erreur synchronisation panier:", error);
    }
}

function calculateTotal() {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

// Mettre à jour l'activité de l'utilisateur
async function updateUserActivity() {
    if (!currentUser || !db) return;
    
    try {
        const userRef = db.collection("users").doc(currentUser.id);
        await userRef.update({
            lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
            isActive: true
        });
    } catch (error) {
        console.error("Erreur mise à jour activité:", error);
    }
}

function saveCart() {
    try {
        localStorage.setItem("valylanegra-cart", JSON.stringify(cart));
        if (currentUser) {
            localStorage.setItem("valylanegra-current-user", JSON.stringify(currentUser));
            if (db) {
                updateUserActivity();
                syncCartToFirestore();
            }
        }
        updateCartUI();
        console.log("Panier sauvegardé:", cart.length, "articles");
    } catch (e) {
        console.error("Erreur sauvegarde panier:", e);
    }
}

function checkUserRegistration() {
    if (!currentUser) {
        console.log("Utilisateur non enregistré - affichage du modal");
        setTimeout(() => {
            const modal = document.getElementById("registrationModal");
            if (modal) {
                modal.classList.add("active");
                console.log("Modal d'inscription affiché");
            }
        }, 1000);
    } else {
        console.log("Utilisateur déjà enregistré:", currentUser.name);
        displayUserName();
    }
}

function setupEventListeners() {
    console.log("Configuration des écouteurs d'événements...");
    
    const registrationForm = document.getElementById("registrationForm");
    if (registrationForm) {
        registrationForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.getElementById("userName")?.value.trim();
            const email = document.getElementById("userEmail")?.value.trim();
            const phone = document.getElementById("userPhone")?.value.trim();
            
            if (name && email && phone) {
                console.log("Tentative d'inscription:", {name, email, phone});
                await registerUser(name, email, phone);
            } else {
                alert("Veuillez remplir tous les champs");
            }
        });
    }

    const shareBtn = document.getElementById("shareBtn");
    if (shareBtn) {
        shareBtn.addEventListener("click", shareWebsite);
    }

    const userLogo = document.querySelector(".user-logo");
    if (userLogo) {
        userLogo.addEventListener("click", showUserProfile);
    }

    const profileBtn = document.getElementById("profileBtn");
    if (profileBtn) {
        profileBtn.addEventListener("click", showUserProfile);
    }

    document.querySelectorAll(".category-btn").forEach((btn) => {
        btn.addEventListener("click", function () {
            document.querySelectorAll(".category-btn").forEach(b => b.classList.remove("active"));
            this.classList.add("active");
            currentCategory = this.dataset.category;
            console.log("Catégorie sélectionnée:", currentCategory);
            filterByCategory(this.dataset.category);
        });
    });

    const overlay = document.getElementById("overlay");
    if (overlay) {
        overlay.addEventListener("click", () => {
            closeAllPanels();
        });
    }
    
    // Recherche de produits
    const searchInput = document.getElementById("searchInput");
    const clearSearch = document.getElementById("clearSearch");
    const searchIcon = document.getElementById("searchIcon");
    
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            searchTerm = e.target.value.toLowerCase().trim();
            if (clearSearch) clearSearch.style.display = searchTerm ? 'block' : 'none';
            applyFilters();
        });
    }
    
    if (clearSearch) {
        clearSearch.addEventListener("click", () => {
            if (searchInput) searchInput.value = '';
            searchTerm = '';
            clearSearch.style.display = 'none';
            applyFilters();
        });
    }
    
    if (searchIcon) {
        searchIcon.addEventListener("click", () => {
            applyFilters();
        });
    }
    
    if (searchInput) {
        searchInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                applyFilters();
            }
        });
    }
    
    console.log("Écouteurs d'événements configurés");
}

function applyFilters() {
    console.log("Application des filtres - Recherche:", searchTerm, "Catégorie:", currentCategory);
    
    // Filtrer d'abord par catégorie
    if (currentCategory === 'all') {
        filteredProducts = [...products];
    } else {
        filteredProducts = products.filter(product => product.category === currentCategory);
    }
    
    // Puis filtrer par terme de recherche
    if (searchTerm) {
        filteredProducts = filteredProducts.filter(product => 
            product.name.toLowerCase().includes(searchTerm) ||
            (product.description && product.description.toLowerCase().includes(searchTerm))
        );
    }
    
    console.log(`${filteredProducts.length} produits après filtrage`);
    renderProducts();
}

function setupLightbox() {
    const lightbox = document.getElementById("productLightbox");
    if (!lightbox) return;
    
    const closeBtn = lightbox.querySelector(".close");
    const prevBtn = lightbox.querySelector(".prev");
    const nextBtn = lightbox.querySelector(".next");
    
    if (closeBtn) closeBtn.addEventListener("click", closeLightbox);
    if (prevBtn) prevBtn.addEventListener("click", () => changeImage(-1));
    if (nextBtn) nextBtn.addEventListener("click", () => changeImage(1));
    
    window.addEventListener("click", (e) => {
        if (e.target === lightbox) closeLightbox();
    });
}

window.openLightbox = openLightbox;
function openLightbox(productId, imgIndex = 0) {
    const product = products.find(p => p.id === productId);
    if (!product || !product.images || product.images.length === 0) return;
    
    currentProductImages = product.images;
    currentImageIndex = imgIndex;
    const lightboxImg = document.getElementById("lightboxImage");
    const descriptionDiv = document.getElementById("lightboxDescription");
    const lightbox = document.getElementById("productLightbox");
    
    if (!lightboxImg || !lightbox) return;
    
    lightboxImg.src = currentProductImages[currentImageIndex];
    
    // Afficher la description du produit si elle existe
    if (product.description && descriptionDiv) {
        descriptionDiv.innerHTML = `
            <h3>${product.name}</h3>
            <p>${product.description}</p>
        `;
        descriptionDiv.style.display = 'block';
    } else if (descriptionDiv) {
        descriptionDiv.style.display = 'none';
    }
    
    lightbox.style.display = "block";
    const overlay = document.getElementById("overlay");
    if (overlay) overlay.classList.add("active");
}

function closeLightbox() {
    const lightbox = document.getElementById("productLightbox");
    const overlay = document.getElementById("overlay");
    
    if (lightbox) lightbox.style.display = "none";
    if (overlay) overlay.classList.remove("active");
}

function changeImage(direction) {
    currentImageIndex += direction;
    if (currentImageIndex < 0) {
        currentImageIndex = currentProductImages.length - 1;
    } else if (currentImageIndex >= currentProductImages.length) {
        currentImageIndex = 0;
    }
    const lightboxImg = document.getElementById("lightboxImage");
    if (lightboxImg) lightboxImg.src = currentProductImages[currentImageIndex];
}

async function registerUser(name, email, phone) {
    const newUser = {
        name: name,
        email: email,
        phone: phone,
        registeredAt: new Date(),
        isActive: true,
        lastActivity: new Date(),
    };
    
    try {
        if (db) {
            // Mode Firebase
            const ref = await db.collection("users").add({
                ...newUser,
                registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastActivity: firebase.firestore.FieldValue.serverTimestamp()
            });
            newUser.id = ref.id;
            console.log("Utilisateur enregistré dans Firestore:", newUser.id);
        } else {
            // Mode démo
            newUser.id = 'demo-' + Date.now();
            console.log("Utilisateur enregistré en mode démo");
        }
        
        currentUser = newUser;
        saveCart();
        displayUserName();
        
        // Créer un panier Firestore pour le nouvel utilisateur
        if (db) {
            await syncCartToFirestore();
        }
        
        const modal = document.getElementById("registrationModal");
        if (modal) modal.classList.remove("active");
        
        console.log("Inscription réussie:", name);
    } catch (e) {
        console.error("Erreur inscription:", e);
        alert("Erreur lors de l'inscription. Réessayez.");
    }
}

function displayUserName() {
    const nameDisplay = document.getElementById("userNameDisplay");
    if (nameDisplay) {
        const name = currentUser && currentUser.name ? currentUser.name : "Valy la Negra";
        nameDisplay.textContent = name;
        console.log("Nom d'utilisateur affiché:", name);
    }
}

function showUserProfile() {
    if (!currentUser) {
        alert("Veuillez vous inscrire d'abord!");
        return;
    }
    alert(`Bienvenue ${currentUser.name}\nEmail : ${currentUser.email}\nTéléphone : ${currentUser.phone}`);
}

function renderProducts() {
    const grid = document.getElementById("productsGrid");
    if (!grid) return;
    
    if (filteredProducts.length === 0) {
        grid.innerHTML = `
            <div class="no-products">
                <i class="fas fa-search" style="font-size: 3rem; color: #ff4d94; margin-bottom: 1rem;"></i>
                <h3>Aucun produit trouvé</h3>
                <p>Aucun produit ne correspond à votre recherche.</p>
                <button onclick="resetFilters()" class="btn-primary" style="margin-top: 1rem;">
                    Voir tous les produits
                </button>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = filteredProducts.map(product => {
        const discount = product.originalPrice > 0 ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0;
        const rating = 4.0 + Math.random() * 1.0;
        const reviews = Math.floor(Math.random() * 1000) + 100;
        const firstImage = product.images && product.images.length > 0 ? product.images[0] : "https://images.unsplash.com/photo-1560769684-55015cee73a8?w=300&h=300&fit=crop&text=Image+Manquante";
        
        return `
            <div class="product-card" data-category="${product.category}">
                <div class="product-image" onclick="openLightbox('${product.id}')">
                    <img src="${firstImage}" alt="${product.name}" class="product-img" loading="lazy">
                    <div class="product-badge">NOUVEAU</div>
                    ${discount > 0 ? `<div class="discount-badge">-${discount}%</div>` : ''}
                    <div class="image-overlay">
                        <i class="fas fa-search-plus"></i>
                    </div>
                </div>
                <div class="product-info">
                    <div class="product-name">${product.name}</div>
                    <div class="product-rating">
                        <span class="stars">${"★".repeat(Math.floor(rating))}${"☆".repeat(5 - Math.floor(rating))}</span>
                        <span>(${reviews})</span>
                    </div>
                    <div class="product-price">
                        <span class="current-price">$${product.price.toFixed(2)}</span>
                        ${product.originalPrice > 0 ? `<span class="original-price">$${product.originalPrice.toFixed(2)}</span>` : ''}
                    </div>
                    <button class="add-to-cart" onclick="addToCart('${product.id}'); event.stopPropagation()">
                        <i class="fas fa-shopping-cart"></i> Ajouter au panier
                    </button>
                </div>
            </div>
        `;
    }).join("");
    
    console.log(`${filteredProducts.length} produits affichés`);
}

window.addToCart = function(productId) {
    if (isAddingToCart) return;
    
    const product = products.find((p) => p.id === productId);
    if (!product) {
        console.error("Produit non trouvé:", productId);
        return;
    }
    
    isAddingToCart = true;
    console.log("Ajout au panier:", product.name);
    openProductOptions(product);
};

function openProductOptions(product) {
    const overlay = document.getElementById("overlay");
    if (overlay) overlay.classList.add("active");
    
    // Déterminer les options de taille en fonction de la catégorie
    const category = product.category || 'default';
    const sizeOptions = SIZE_OPTIONS[category] || SIZE_OPTIONS.default;
    
    let modal = document.createElement("div");
    modal.className = "modal";
    modal.style.display = "flex";
    modal.innerHTML = `
        <div class="modal-content" style="max-width:400px;">
            <span class="close-modal" onclick="closeProductModal()">&times;</span>
            <h3>Ajouter au panier</h3>
            <img src="${product.images && product.images.length > 0 ? product.images[0] : 'https://images.unsplash.com/photo-1560769684-55015cee73a8?w=120&h=120&fit=crop'}" 
                 style="max-width:120px;max-height:120px;border-radius:6px;margin:1rem auto;display:block;">
            <p style="text-align:center;font-weight:bold;">${product.name}</p>
            <p style="text-align:center;color:#ff4d94;font-size:1.2rem;font-weight:bold;">$${product.price.toFixed(2)}</p>
            <form id="optionsForm">
                <div class="form-group">
                    <label for="cartSize">Taille/Modèle :</label>
                    <select id="cartSize" name="size" required>
                        <option value="">Sélectionner</option>
                        ${sizeOptions.map(s => `<option value="${s}">${s}</option>`).join("")}
                    </select>
                </div>
                <div class="form-group">
                    <label for="cartColor">Couleur :</label>
                    <select id="cartColor" name="color" required>
                        <option value="">Sélectionner</option>
                        ${COLORS.map(c => `<option value="${c}">${c}</option>`).join("")}
                    </select>
                </div>
                <div class="form-group">
                    <label for="cartQty">Quantité :</label>
                    <div class="quantity-selector">
                        <button type="button" onclick="decreaseQuantity()">-</button>
                        <input type="number" id="cartQty" name="qty" min="1" value="1" readonly>
                        <button type="button" onclick="increaseQuantity()">+</button>
                    </div>
                </div>
                <button type="submit" id="submitOptions" class="btn-primary">
                    <i class="fas fa-cart-plus"></i> Ajouter au panier
                </button>
                <button type="button" onclick="closeProductModal()" class="btn-secondary">
                    Annuler
                </button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Stocker la référence du modal pour pouvoir le fermer
    window.currentProductModal = modal;
}

window.closeProductModal = function() {
    if (window.currentProductModal) {
        window.currentProductModal.remove();
        const overlay = document.getElementById("overlay");
        if (overlay) overlay.classList.remove("active");
        isAddingToCart = false;
    }
}

window.decreaseQuantity = function() {
    const qtyInput = document.getElementById("cartQty");
    if (qtyInput && parseInt(qtyInput.value) > 1) {
        qtyInput.value = parseInt(qtyInput.value) - 1;
    }
}

window.increaseQuantity = function() {
    const qtyInput = document.getElementById("cartQty");
    if (qtyInput) {
        qtyInput.value = parseInt(qtyInput.value) + 1;
    }
}

// Gérer la soumission du formulaire d'options
document.addEventListener('submit', function(e) {
    if (e.target && e.target.id === 'optionsForm') {
        e.preventDefault();
        const form = e.target;
        const submitBtn = document.getElementById("submitOptions");
        
        if (submitBtn) submitBtn.disabled = true;
        
        const size = form.elements.size.value;
        const color = form.elements.color.value;
        const qty = parseInt(form.elements.qty.value) || 1;
        
        // Trouver le produit correspondant
        const productName = form.querySelector('p')?.textContent;
        const product = products.find(p => p.name === productName);
        
        if (product) {
            addProductToCart(product, size, color, qty);
        }
        
        closeProductModal();
    }
});

function addProductToCart(product, size, color, quantity) {
    const key = `${product.id}-${size}-${color}`;
    let existing = cart.find((item) => item.key === key);
    
    if (existing) {
        existing.quantity += quantity;
    } else {
        cart.push({
            key,
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.images && product.images.length > 0 ? product.images[0] : "https://images.unsplash.com/photo-1560769684-55015cee73a8?w=200&h=200&fit=crop",
            quantity,
            size,
            color
        });
    }
    
    saveCart();
    
    // Affiche une confirmation d'ajout
    showCartNotification(`${product.name} ajouté au panier!`);
}

function showCartNotification(message) {
    const notification = document.createElement("div");
    notification.className = "cart-notification";
    notification.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(notification);
    
    // Animation d'apparition
    setTimeout(() => {
        notification.classList.add("show");
    }, 10);
    
    // Disparition après 3 secondes
    setTimeout(() => {
        notification.classList.remove("show");
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

function updateCartUI() {
    const cartCount = document.getElementById("cartCount");
    const cartItems = document.getElementById("cartItems");
    const cartTotal = document.getElementById("cartTotal");

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = calculateTotal();

    if (cartCount) cartCount.textContent = totalItems;
    if (cartTotal) cartTotal.textContent = totalPrice.toFixed(2);

    if (!cartItems) return;

    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-shopping-cart" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                <p>Votre panier est vide</p>
                <p style="color: #666; font-size: 0.9rem;">Ajoutez des produits pour commencer vos achats</p>
            </div>
        `;
        const paypalDiv = document.getElementById("paypal-button-container");
        if (paypalDiv) paypalDiv.innerHTML = '';
        const addressForm = document.getElementById("addressForm");
        if (addressForm) addressForm.style.display = 'none';
    } else {
        cartItems.innerHTML = cart.map(item => `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.name}" loading="lazy">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-details">
                        ${item.size ? `Taille: <b>${item.size}</b>` : ''}
                        ${item.size && item.color ? ' • ' : ''}
                        ${item.color ? `Couleur: <b>${item.color}</b>` : ''}
                    </div>
                    <div class="cart-item-price">$${item.price.toFixed(2)}</div>
                    <div class="quantity-controls">
                        <button class="quantity-btn" onclick="updateQuantity('${item.key}', ${item.quantity - 1})">-</button>
                        <span>${item.quantity}</span>
                        <button class="quantity-btn" onclick="updateQuantity('${item.key}', ${item.quantity + 1})">+</button>
                        <button class="remove-btn" onclick="removeFromCart('${item.key}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join("");
        
        // Ajouter le formulaire d'adresse si nécessaire
        if (!document.getElementById("addressForm")) {
            const addressFormHTML = `
                <div id="addressForm" style="margin-top: 1.5rem; padding: 1rem; background: #ffe6f2; border-radius: 0.5rem;">
                    <h4 style="margin-bottom: 1rem;">Adresse de livraison</h4>
                    <div class="form-group">
                        <label for="shippingAddress">Adresse complète *</label>
                        <textarea id="shippingAddress" rows="3" placeholder="Entrez votre adresse complète pour la livraison" required></textarea>
                    </div>
                </div>
            `;
            cartItems.insertAdjacentHTML('beforeend', addressFormHTML);
        }
        
        // Gestion PayPal
        setTimeout(() => {
            if (totalPrice > 0) {
                renderPaypalButton(totalPrice);
            }
        }, 300);
    }
}

window.updateQuantity = function(key, newQuantity) {
    let item = cart.find((i) => i.key === key);
    if (!item) return;
    if (newQuantity <= 0) {
        cart = cart.filter((i) => i.key !== key);
    } else {
        item.quantity = newQuantity;
    }
    saveCart();
};

window.removeFromCart = function(key) {
    if (confirm("Êtes-vous sûr de vouloir supprimer cet article du panier?")) {
        cart = cart.filter((i) => i.key !== key);
        saveCart();
    }
};

function renderPaypalButton(totalPrice) {
    if (!window.paypal) {
        console.warn("PayPal SDK non chargé");
        return;
    }
    
    const container = document.getElementById("paypal-button-container");
    if (!container) return;
    
    // Réinitialiser complètement le conteneur
    container.innerHTML = "";
    
    // Vérifier que le montant est valide
    if (typeof totalPrice !== 'number' || totalPrice <= 0) {
        console.error("Montant PayPal invalide:", totalPrice);
        return;
    }

    try {
        window.paypal.Buttons({
            style: { 
                layout: 'vertical', 
                color: 'gold', 
                shape: 'rect', 
                label: 'paypal' 
            },
            createOrder: function(data, actions) {
                return actions.order.create({
                    purchase_units: [{
                        amount: { 
                            value: totalPrice.toFixed(2),
                            currency_code: "USD"
                        }
                    }]
                });
            },
            onApprove: function(data, actions) {
                return actions.order.capture().then(async function(details) {
                    // Récupérer l'adresse de livraison
                    const shippingAddress = document.getElementById("shippingAddress")?.value || "Non spécifiée";
                    
                    // Créer la commande
                    await createOrder(details, shippingAddress);
                    
                    alert('Paiement réussi, merci ' + details.payer.name.given_name + ' ! Un reçu a été envoyé à votre email.');
                    cart = [];
                    saveCart();
                });
            },
            onError: function(err) {
                console.error("Erreur PayPal:", err);
                alert("Erreur lors du paiement. Veuillez réessayer.");
            },
            onCancel: function(data) {
                console.log("Paiement annulé");
            }
        }).render('#paypal-button-container');
    } catch (e) {
        console.error("Erreur initialisation PayPal:", e);
    }
}

// Créer une commande dans Firestore
async function createOrder(paymentDetails, shippingAddress) {
    if (!currentUser) return;
    
    try {
        const orderData = {
            userId: currentUser.id,
            customerName: currentUser.name,
            customerEmail: currentUser.email,
            customerPhone: currentUser.phone,
            items: cart,
            totalAmount: calculateTotal(),
            paymentId: paymentDetails.id,
            paymentStatus: 'completed',
            shippingAddress: shippingAddress,
            status: 'processing',
            createdAt: new Date()
        };
        
        if (db) {
            // Mode Firebase
            orderData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const orderRef = await db.collection("orders").add(orderData);
            console.log("Commande créée dans Firestore:", orderRef.id);
            
            // Vider le panier dans Firestore
            const cartsQuery = db.collection("carts").where("userId", "==", currentUser.id);
            const querySnapshot = await cartsQuery.get();
            
            if (!querySnapshot.empty) {
                const cartDoc = querySnapshot.docs[0];
                await cartDoc.ref.update({
                    items: [],
                    totalAmount: 0,
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        } else {
            // Mode démo
            console.log("Commande créée (mode démo):", orderData);
        }
        
        // Envoyer un email de confirmation
        await sendOrderConfirmationEmail(orderData, db ? orderRef.id : 'demo-' + Date.now());
        
    } catch (error) {
        console.error("Erreur création commande:", error);
        alert("Erreur lors de la création de la commande. Veuillez contacter le support.");
    }
}

// Fonction simulée d'envoi d'email
async function sendOrderConfirmationEmail(orderData, orderId) {
    console.log("=== EMAIL DE CONFIRMATION ===");
    console.log("À: ", orderData.customerEmail);
    console.log("Sujet: Confirmation de votre commande Valy la Negra");
    console.log("Contenu:");
    console.log(`Bonjour ${orderData.customerName},`);
    console.log("Merci pour votre commande ! Voici le récapitulatif :");
    console.log("Numéro de commande: ", orderId);
    console.log("Articles:");
    orderData.items.forEach(item => {
        console.log(`- ${item.quantity}x ${item.name} (${item.size}, ${item.color}): $${item.price.toFixed(2)}`);
    });
    console.log("Total: $", orderData.totalAmount.toFixed(2));
    console.log("Adresse de livraison: ", orderData.shippingAddress);
    console.log("================================");
    
    return true;
}

function filterByCategory(category) {
    currentCategory = category;
    applyFilters();
}

window.resetFilters = function() {
    currentCategory = 'all';
    searchTerm = '';
    const searchInput = document.getElementById("searchInput");
    if (searchInput) searchInput.value = '';
    const clearSearch = document.getElementById("clearSearch");
    if (clearSearch) clearSearch.style.display = 'none';
    
    document.querySelectorAll(".category-btn").forEach(b => b.classList.remove("active"));
    const allBtn = document.querySelector('[data-category="all"]');
    if (allBtn) allBtn.classList.add("active");
    
    applyFilters();
}

function toggleCart() {
    const sidebar = document.getElementById("cartSidebar");
    const overlay = document.getElementById("overlay");
    if (sidebar) sidebar.classList.toggle("active");
    if (overlay) overlay.classList.toggle("active");
}

function closeAllPanels() {
    const sidebar = document.getElementById("cartSidebar");
    if (sidebar) sidebar.classList.remove("active");
    
    const overlay = document.getElementById("overlay");
    if (overlay) overlay.classList.remove("active");
    
    closeLightbox();
    closeProductModal();
}

function shareWebsite() {
    const url = window.location.href;
    const text = "Découvrez Valy la Negra - La meilleure boutique en ligne pour tous vos besoins!";
    if (navigator.share) {
        navigator.share({ title: "Valy la Negra", text: text, url: url });
    } else {
        navigator.clipboard.writeText(url).then(() => {
            alert("Lien copié dans le presse-papiers!");
        });
    }
}

// Fonction pour ajouter des produits de test (utile pour le développement)
window.addTestProducts = async function() {
    if (!db) {
        alert("Firebase n'est pas disponible");
        return;
    }
    
    const testProducts = [
        {
            name: "Robe Élégante Été",
            category: "clothing",
            price: 34.99,
            originalPrice: 44.99,
            description: "Robe légère et confortable pour l'été",
            images: ["https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=400&fit=crop"],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        {
            name: "Baskets Sport",
            category: "shoes", 
            price: 59.99,
            originalPrice: 69.99,
            description: "Baskets confortables pour le sport",
            images: ["https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=400&fit=crop"],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }
    ];
    
    try {
        for (const product of testProducts) {
            await db.collection("products").add(product);
        }
        alert("Produits de test ajoutés avec succès!");
    } catch (error) {
        console.error("Erreur ajout produits test:", error);
        alert("Erreur lors de l'ajout des produits test");
    }
}

console.log("Script Valy la Negra chargé avec succès!");
