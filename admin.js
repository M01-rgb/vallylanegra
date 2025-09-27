// Configuration et variables globales
const ADMIN_PASSWORD = "valyla2024";
let products = [];
let users = [];
let orders = [];
let carts = [];
let isLoggedIn = false;

// Catégories disponibles pour les produits
const PRODUCT_CATEGORIES = [
    'all', 'clothing', 'shoes', 'electronics', 'home', 'sports', 'beauty',
    'bags', 'jewelry', 'accessories', 'beauty', 'home-decor', 'kitchen',
    'toys', 'books', 'health', 'fitness', 'automotive', 'garden'
];

// Noms affichés pour les catégories
const CATEGORY_LABELS = {
    'all': 'Toutes les catégories',
    'clothing': '👕 Vêtements',
    'shoes': '👟 Chaussures',
    'electronics': '📱 Électronique',
    'home': '🏠 Maison',
    'sports': '⚽ Sports',
    'beauty': '💄 Beauté',
    'bags': '👜 Sacs',
    'jewelry': '💎 Bijoux',
    'accessories': '👓 Accessoires',
    'home-decor': '🖼️ Décoration Maison',
    'kitchen': '🍳 Cuisine',
    'toys': '🧸 Jouets',
    'books': '📚 Livres',
    'health': '💊 Santé',
    'fitness': '💪 Fitness',
    'automotive': '🚗 Auto',
    'garden': '🌿 Jardin'
};

// Initialisation
document.addEventListener("DOMContentLoaded", function() {
    console.log("Document chargé, configuration des écouteurs d'événements");
    
    // Vérifier que Firebase est initialisé
    if (typeof firebase === 'undefined') {
        console.error("Firebase n'est pas chargé");
        showMessage("Firebase n'est pas chargé. Vérifiez la configuration.", "error");
        return;
    }
    
    // Initialiser Firestore
    const db = firebase.firestore();
    window.db = db; // Rendre db global
    
    setupEventListeners();
    setupCategorySelect();
    checkAdminSession();
});

function setupEventListeners() {
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", function(e) {
            console.log("Formulaire de connexion soumis");
            e.preventDefault();
            login();
        });
    } else {
        console.error("Formulaire de connexion non trouvé");
    }
    
    const productForm = document.getElementById("productForm");
    if (productForm) {
        productForm.addEventListener("submit", function(e) {
            e.preventDefault();
            addProduct();
        });
    }
}

function setupCategorySelect() {
    const categorySelect = document.getElementById("productCategory");
    if (!categorySelect) return;
    
    // Vider le select
    categorySelect.innerHTML = '';
    
    // Ajouter l'option par défaut
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '📂 Sélectionner une catégorie';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    categorySelect.appendChild(defaultOption);
    
    // Ajouter toutes les catégories
    PRODUCT_CATEGORIES.filter(cat => cat !== 'all').forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = CATEGORY_LABELS[category] || category;
        categorySelect.appendChild(option);
    });
    
    console.log("✅ Sélecteur de catégories initialisé");
}

function checkAdminSession() {
    const adminSession = localStorage.getItem("valylanegra-admin-session");
    if (adminSession) {
        try {
            const sessionData = JSON.parse(adminSession);
            const now = new Date().getTime();
            // Vérifier si la session est encore valide (24 heures)
            if (now - sessionData.timestamp < 24 * 60 * 60 * 1000) {
                showDashboard();
                loadData();
                return;
            } else {
                // Session expirée
                localStorage.removeItem("valylanegra-admin-session");
                showMessage("Session expirée, veuillez vous reconnecter", "info");
            }
        } catch (e) {
            console.error("Erreur parsing session:", e);
            localStorage.removeItem("valylanegra-admin-session");
        }
    }
    showLogin();
}

function login() {
    console.log("Fonction de connexion appelée");
    const passwordInput = document.getElementById("adminPassword");
    if (!passwordInput) {
        console.error("Champ de mot de passe non trouvé");
        return;
    }
    
    const password = passwordInput.value;
    console.log("Mot de passe saisi:", password);
    
    if (password === ADMIN_PASSWORD) {
        console.log("Mot de passe correct");
        // Enregistrer la session
        localStorage.setItem("valylanegra-admin-session", JSON.stringify({
            timestamp: new Date().getTime(),
            isAdmin: true,
        }));
        
        showDashboard();
        loadData();
        showMessage("Connexion réussie! ✅", "success");
    } else {
        console.log("Mot de passe incorrect");
        showMessage("Mot de passe incorrect! ❌", "error");
        passwordInput.value = "";
        passwordInput.focus();
    }
}

function logout() {
    localStorage.removeItem("valylanegra-admin-session");
    showLogin();
    showMessage("Déconnexion réussie", "info");
}

function showLogin() {
    const adminLogin = document.getElementById("adminLogin");
    const adminDashboard = document.getElementById("adminDashboard");
    
    if (adminLogin) adminLogin.style.display = "flex";
    if (adminDashboard) adminDashboard.style.display = "none";
    
    isLoggedIn = false;
}

function showDashboard() {
    const adminLogin = document.getElementById("adminLogin");
    const adminDashboard = document.getElementById("adminDashboard");
    
    if (adminLogin) adminLogin.style.display = "none";
    if (adminDashboard) adminDashboard.style.display = "block";
    
    isLoggedIn = true;
}

function loadData() {
    loadProducts();
    loadUsers();
    loadOrders();
    loadCarts();
}

function loadProducts() {
    if (!window.db) {
        console.error("Firestore non initialisé");
        showMessage("Erreur de connexion à la base de données", "error");
        return;
    }
    
    console.log("📦 Chargement des produits...");
    
    const productsCol = window.db.collection("products");
    const q = productsCol.orderBy("createdAt", "desc");
    
    q.onSnapshot((snapshot) => {
        products = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        }));
        
        console.log(`✅ ${products.length} produits chargés`);
        updateStats();
        renderProducts();
    }, (error) => {
        console.error("Erreur chargement produits:", error);
        showMessage("Erreur lors du chargement des produits", "error");
    });
}

function loadUsers() {
    if (!window.db) {
        console.error("Firestore non initialisé");
        return;
    }
    
    const usersCol = window.db.collection("users");
    const q = usersCol.orderBy("registeredAt", "desc");
    
    q.onSnapshot((snapshot) => {
        users = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        }));
        
        console.log(`👥 ${users.length} utilisateurs chargés`);
        updateStats();
        renderUsers();
    }, (error) => {
        console.error("Erreur chargement utilisateurs:", error);
    });
}

function loadOrders() {
    if (!window.db) {
        console.error("Firestore non initialisé");
        return;
    }
    
    const ordersCol = window.db.collection("orders");
    const q = ordersCol.orderBy("createdAt", "desc");
    
    q.onSnapshot((snapshot) => {
        orders = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        }));
        
        console.log(`📦 ${orders.length} commandes chargées`);
        updateStats();
        renderOrders();
    }, (error) => {
        console.error("Erreur chargement commandes:", error);
    });
}

function loadCarts() {
    if (!window.db) {
        console.error("Firestore non initialisé");
        return;
    }
    
    const cartsCol = window.db.collection("carts");
    const q = cartsCol.where("totalAmount", ">", 0);
    
    q.onSnapshot((snapshot) => {
        carts = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        }));
        
        console.log(`🛒 ${carts.length} paniers chargés`);
        updateStats();
        renderCarts();
    }, (error) => {
        console.error("Erreur chargement paniers:", error);
    });
}

function updateStats() {
    const totalProductsElem = document.getElementById("totalProducts");
    const totalUsersElem = document.getElementById("totalUsers");
    const activeUsersElem = document.getElementById("activeUsers");
    const activeCartsElem = document.getElementById("activeCarts");
    
    if (totalProductsElem) totalProductsElem.textContent = products.length;
    if (totalUsersElem) totalUsersElem.textContent = users.length;
    
    // Utilisateurs actifs (ayant eu une activité dans les dernières 24h)
    const activeUsers = users.filter(user => {
        if (!user.lastActivity) return false;
        try {
            const lastActivity = user.lastActivity.toDate ? user.lastActivity.toDate() : new Date(user.lastActivity);
            const now = new Date();
            return (now - lastActivity) < 24 * 60 * 60 * 1000;
        } catch (e) {
            return false;
        }
    });
    
    if (activeUsersElem) activeUsersElem.textContent = activeUsers.length;
    if (activeCartsElem) activeCartsElem.textContent = carts.length;
}

async function addProduct() {
    if (!window.db) {
        showMessage("Firestore non initialisé", "error");
        return;
    }
    
    // Récupérer les valeurs du formulaire
    const name = document.getElementById("productName").value.trim();
    const category = document.getElementById("productCategory").value;
    const price = parseFloat(document.getElementById("productPrice").value);
    const originalPrice = parseFloat(document.getElementById("productOriginalPrice").value) || price;
    const description = document.getElementById("productDescription").value.trim();
    
    // Récupérer les URLs des images
    const images = [];
    for (let i = 1; i <= 4; i++) {
        const imageInput = document.getElementById(`productImage${i}`);
        if (imageInput && imageInput.value.trim()) {
            images.push(imageInput.value.trim());
        }
    }
    
    // Validation
    if (!name) {
        showMessage("Veuillez entrer un nom de produit", "error");
        return;
    }
    
    if (!category) {
        showMessage("Veuillez sélectionner une catégorie", "error");
        return;
    }
    
    if (isNaN(price) || price <= 0) {
        showMessage("Veuillez entrer un prix valide", "error");
        return;
    }
    
    if (images.length === 0) {
        showMessage("Veuillez ajouter au moins une image", "error");
        return;
    }
    
    try {
        // Préparer les données du produit
        const productData = {
            name: name,
            category: category,
            price: price,
            originalPrice: originalPrice > price ? originalPrice : price,
            description: description || "Produit de qualité Valy la Negra",
            images: images,
            inStock: true,
            featured: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Afficher un indicateur de chargement
        const submitBtn = document.querySelector('#productForm button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ajout en cours...';
        submitBtn.disabled = true;
        
        // Ajouter le produit à Firestore
        await window.db.collection("products").add(productData);
        
        // Réinitialiser le formulaire
        document.getElementById("productForm").reset();
        
        // Réinitialiser les aperçus d'images
        for (let i = 1; i <= 4; i++) {
            const preview = document.getElementById(`imagePreview${i}`);
            if (preview) preview.innerHTML = `<div class="image-preview-placeholder">Image ${i}</div>`;
        }
        
        // Restaurer le bouton
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        
        showMessage("✅ Produit ajouté avec succès! Il apparaîtra sur le site immédiatement.", "success");
        
    } catch (error) {
        console.error("Erreur ajout produit:", error);
        showMessage("❌ Erreur lors de l'ajout: " + error.message, "error");
        
        // Restaurer le bouton en cas d'erreur
        const submitBtn = document.querySelector('#productForm button[type="submit"]');
        submitBtn.innerHTML = '<i class="fas fa-plus"></i> Ajouter le produit';
        submitBtn.disabled = false;
    }
}

function renderProducts() {
    const productsList = document.getElementById("productsList");
    if (!productsList) return;
    
    if (products.length === 0) {
        productsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open" style="font-size:3rem;color:#ccc;margin-bottom:1rem;"></i>
                <h3>Aucun produit en ligne</h3>
                <p>Commencez par ajouter votre premier produit</p>
                <button onclick="showSection('addProduct')" class="btn-primary" style="margin-top:1rem;">
                    <i class="fas fa-plus"></i> Ajouter un produit
                </button>
            </div>
        `;
        return;
    }
    
    // Grouper les produits par catégorie
    const productsByCategory = {};
    products.forEach(product => {
        if (!productsByCategory[product.category]) {
            productsByCategory[product.category] = [];
        }
        productsByCategory[product.category].push(product);
    });
    
    let html = `
        <div class="section-header">
            <h3>📦 Produits en ligne (${products.length})</h3>
            <div class="category-filters">
                <button class="filter-btn active" data-category="all">Tous</button>
                ${Object.keys(productsByCategory).map(category => `
                    <button class="filter-btn" data-category="${category}">
                        ${CATEGORY_LABELS[category] || category} (${productsByCategory[category].length})
                    </button>
                `).join('')}
            </div>
        </div>
    `;
    
    // Afficher tous les produits par défaut
    html += '<div class="products-grid-admin" id="allProducts">';
    html += products.map(product => createProductCard(product)).join('');
    html += '</div>';
    
    // Ajouter des sections par catégorie
    Object.keys(productsByCategory).forEach(category => {
        html += `
            <div class="category-section" id="category-${category}" style="display: none;">
                <h4>${CATEGORY_LABELS[category] || category} (${productsByCategory[category].length})</h4>
                <div class="products-grid-admin">
                    ${productsByCategory[category].map(product => createProductCard(product)).join('')}
                </div>
            </div>
        `;
    });
    
    productsList.innerHTML = html;
    
    // Ajouter les événements de filtre
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const category = this.dataset.category;
            
            // Mettre à jour les boutons actifs
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Afficher/masquer les sections
            if (category === 'all') {
                document.getElementById('allProducts').style.display = 'grid';
                document.querySelectorAll('.category-section').forEach(section => {
                    section.style.display = 'none';
                });
            } else {
                document.getElementById('allProducts').style.display = 'none';
                document.querySelectorAll('.category-section').forEach(section => {
                    section.style.display = 'none';
                });
                document.getElementById(`category-${category}`).style.display = 'block';
            }
        });
    });
}

function createProductCard(product) {
    const discount = product.originalPrice > product.price ? 
        Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0;
    
    return `
        <div class="product-card-admin" data-category="${product.category}">
            <div class="product-image-admin">
                ${product.images && product.images.length > 0 ? 
                    `<img src="${product.images[0]}" alt="${product.name}" onclick="previewProduct('${product.id}')">` : 
                    '<div class="no-image"><i class="fas fa-image"></i></div>'
                }
                <div class="product-actions">
                    <button class="btn-small btn-primary" onclick="editProduct('${product.id}')" title="Modifier">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-small btn-danger" onclick="deleteProduct('${product.id}')" title="Supprimer">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                ${discount > 0 ? `<div class="discount-badge">-${discount}%</div>` : ''}
            </div>
            <div class="product-info-admin">
                <h4>${product.name}</h4>
                <div class="product-meta">
                    <span class="category-badge">${CATEGORY_LABELS[product.category] || product.category}</span>
                    <span class="stock-badge ${product.inStock ? 'in-stock' : 'out-of-stock'}">
                        ${product.inStock ? 'En stock' : 'Rupture'}
                    </span>
                </div>
                <div class="product-price-admin">
                    <span class="current-price">$${product.price.toFixed(2)}</span>
                    ${discount > 0 ? `<span class="original-price">$${product.originalPrice.toFixed(2)}</span>` : ''}
                </div>
                <p class="product-description-admin">${product.description || 'Aucune description'}</p>
                <div class="product-stats">
                    <small><i class="fas fa-images"></i> ${product.images ? product.images.length : 0} images</small>
                    <small><i class="fas fa-calendar"></i> ${formatDate(product.createdAt)}</small>
                </div>
            </div>
        </div>
    `;
}

function renderUsers() {
    const usersList = document.getElementById("usersList");
    if (!usersList) return;
    
    if (users.length === 0) {
        usersList.innerHTML = "<p>Aucun utilisateur trouvé</p>";
        return;
    }
    
    usersList.innerHTML = `
        <h3>👥 Liste des utilisateurs (${users.length})</h3>
        ${users.map(user => `
            <div class="user-card">
                <h3>${user.name || 'Non renseigné'}</h3>
                <p><i class="fas fa-envelope"></i> Email: ${user.email || 'Non renseigné'}</p>
                <p><i class="fas fa-phone"></i> Téléphone: ${user.phone || 'Non renseigné'}</p>
                <p><i class="fas fa-calendar"></i> Inscrit le: ${formatDate(user.registeredAt)}</p>
                <span class="badge ${user.isActive ? 'active' : 'inactive'}">
                    ${user.isActive ? '🟢 Active' : '🔴 Inactive'}
                </span>
            </div>
        `).join('')}
    `;
}

function renderOrders() {
    const ordersList = document.getElementById("ordersList");
    if (!ordersList) return;
    
    if (orders.length === 0) {
        ordersList.innerHTML = "<p>Aucune commande trouvée</p>";
        return;
    }
    
    ordersList.innerHTML = `
        <h3>📦 Liste des commandes (${orders.length})</h3>
        ${orders.map(order => `
            <div class="order-item">
                <h3>Commande #${order.id.substring(0, 8)}</h3>
                <p><i class="fas fa-user"></i> Client: ${order.customerName || 'Non renseigné'}</p>
                <p><i class="fas fa-dollar-sign"></i> Total: $${order.totalAmount ? order.totalAmount.toFixed(2) : '0.00'}</p>
                <p><i class="fas fa-info-circle"></i> Statut: ${order.status || 'En attente'}</p>
                <p><i class="fas fa-calendar"></i> Date: ${formatDate(order.createdAt)}</p>
                <button class="btn btn-primary" onclick="viewOrderDetails('${order.id}')">
                    <i class="fas fa-eye"></i> Voir les détails
                </button>
            </div>
        `).join('')}
    `;
}

function renderCarts() {
    const cartsList = document.getElementById("cartsList");
    if (!cartsList) return;
    
    if (carts.length === 0) {
        cartsList.innerHTML = "<p>Aucun panier actif</p>";
        return;
    }
    
    cartsList.innerHTML = `
        <h3>🛒 Paniers actifs (${carts.length})</h3>
        ${carts.map(cart => `
            <div class="cart-item-admin">
                <h3>Panier #${cart.id.substring(0, 8)}</h3>
                <p><i class="fas fa-dollar-sign"></i> Total: $${cart.totalAmount ? cart.totalAmount.toFixed(2) : '0.00'}</p>
                <p><i class="fas fa-cube"></i> Articles: ${cart.items ? cart.items.length : 0}</p>
                <p><i class="fas fa-clock"></i> Dernière mise à jour: ${formatDate(cart.lastUpdated)}</p>
            </div>
        `).join('')}
    `;
}

function formatDate(dateValue) {
    if (!dateValue) return 'Date inconnue';
    
    try {
        const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
        return date.toLocaleDateString('fr-FR') + ' à ' + date.toLocaleTimeString('fr-FR');
    } catch (e) {
        return 'Date invalide';
    }
}

window.showSection = function(sectionName) {
    // Masquer toutes les sections
    const sections = document.querySelectorAll(".admin-section");
    sections.forEach(function(section) {
        section.classList.remove("active");
    });
    
    // Désactiver tous les boutons
    const buttons = document.querySelectorAll(".sidebar-btn");
    buttons.forEach(function(btn) {
        btn.classList.remove("active");
    });
    
    // Activer la section demandée
    const targetSection = document.getElementById(sectionName + "Section");
    if (targetSection) targetSection.classList.add("active");
    
    // Activer le bouton cliqué
    event.target.classList.add("active");
    
    // Recharger les données si nécessaire
    if (sectionName === "dashboard") updateStats();
    if (sectionName === "products") renderProducts();
    if (sectionName === "users") renderUsers();
    if (sectionName === "orders") renderOrders();
    if (sectionName === "carts") renderCarts();
}

// Fonctions pour la gestion des produits
window.deleteProduct = async function(id) {
    if (!window.db) {
        showMessage("Firestore non initialisé", "error");
        return;
    }
    
    if (confirm("Êtes-vous sûr de vouloir supprimer ce produit? Cette action est irréversible.")) {
        try {
            await window.db.collection("products").doc(id).delete();
            showMessage("✅ Produit supprimé avec succès", "success");
        } catch (error) {
            console.error("Erreur lors de la suppression:", error);
            showMessage("❌ Erreur lors de la suppression: " + error.message, "error");
        }
    }
}

window.previewProduct = function(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const imagesHTML = product.images && product.images.length > 0 ? 
        product.images.map(img => `<img src="${img}" style="max-width:200px;margin:5px;border-radius:8px;">`).join('') : 
        '<p>Aucune image</p>';
    
    showMessage(`
        <strong>${product.name}</strong><br>
        Catégorie: ${CATEGORY_LABELS[product.category] || product.category}<br>
        Prix: $${product.price.toFixed(2)}<br>
        ${product.originalPrice > product.price ? `Ancien prix: $${product.originalPrice.toFixed(2)}<br>` : ''}
        <div style="margin-top:10px;">${imagesHTML}</div>
    `, "info", 5000);
}

window.viewOrderDetails = function(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    const itemsHTML = order.items ? order.items.map(item => 
        `- ${item.quantity}x ${item.name} (${item.size}, ${item.color}): $${item.price ? item.price.toFixed(2) : '0.00'}`
    ).join('<br>') : 'Aucun article';
    
    alert(`Détails de la commande #${orderId.substring(0, 8)}\n
Client: ${order.customerName || 'Non renseigné'}
Email: ${order.customerEmail || 'Non renseigné'}
Téléphone: ${order.customerPhone || 'Non renseigné'}
Total: $${order.totalAmount ? order.totalAmount.toFixed(2) : '0.00'}
Statut: ${order.status || 'En attente'}
Adresse: ${order.shippingAddress || 'Non renseignée'}

Articles:
${itemsHTML}`);
}

// Fonction d'affichage des messages améliorée
function showMessage(message, type = "info", duration = 3000) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = `
        <i class="fas fa-${getMessageIcon(type)}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        messageDiv.classList.remove('show');
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 300);
    }, duration);
}

function getMessageIcon(type) {
    const icons = {
        'success': 'check-circle',
        'error': 'exclamation-circle',
        'warning': 'exclamation-triangle',
        'info': 'info-circle'
    };
    return icons[type] || 'info-circle';
}

// Gestion des aperçus d'images
document.addEventListener('input', function(e) {
    if (e.target.id && e.target.id.startsWith('productImage')) {
        const index = e.target.id.replace('productImage', '');
        const preview = document.getElementById('imagePreview' + index);
        if (preview && e.target.value.trim()) {
            preview.innerHTML = `<img src="${e.target.value}" alt="Preview" style="max-width:100px;max-height:100px;border-radius:4px;">`;
        } else if (preview) {
            preview.innerHTML = `<div class="image-preview-placeholder">Image ${index}</div>`;
        }
    }
});

console.log("✅ Admin Valy la Negra prêt !");
