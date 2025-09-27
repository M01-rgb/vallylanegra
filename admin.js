// Configuration et variables globales
const ADMIN_PASSWORD = "valyla2024";
let products = [];
let users = [];
let orders = [];
let carts = [];
let isLoggedIn = false;

// Initialisation
document.addEventListener("DOMContentLoaded", function() {
    console.log("Document chargé, configuration des écouteurs d'événements");
    
    // Vérifier que Firebase est initialisé
    if (typeof firebase === 'undefined') {
        console.error("Firebase n'est pas chargé");
        return;
    }
    
    // Initialiser Firestore
    const db = firebase.firestore();
    window.db = db; // Rendre db global
    
    setupEventListeners();
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
    } else {
        console.log("Mot de passe incorrect");
        alert("Mot de passe incorrect!");
        passwordInput.value = "";
        passwordInput.focus();
    }
}

function logout() {
    localStorage.removeItem("valylanegra-admin-session");
    showLogin();
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
        return;
    }
    
    const productsCol = window.db.collection("products");
    const q = productsCol.orderBy("createdAt", "desc");
    
    q.onSnapshot((snapshot) => {
        products = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        }));
        
        updateStats();
        renderProducts();
    }, (error) => {
        console.error("Erreur chargement produits:", error);
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
        alert("Firestore non initialisé");
        return;
    }
    
    const name = document.getElementById("productName").value;
    const category = document.getElementById("productCategory").value;
    const price = parseFloat(document.getElementById("productPrice").value);
    const originalPrice = parseFloat(document.getElementById("productOriginalPrice").value);
    const description = document.getElementById("productDescription").value;
    
    // Récupérer les URLs des images
    const images = [];
    for (let i = 1; i <= 4; i++) {
        const imageUrl = document.getElementById(`productImage${i}`).value;
        if (imageUrl) images.push(imageUrl);
    }
    
    if (!name || !category || isNaN(price) || isNaN(originalPrice)) {
        alert("Veuillez remplir tous les champs obligatoires");
        return;
    }
    
    try {
        const productData = {
            name,
            category,
            price,
            originalPrice,
            description: description || "",
            images,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await window.db.collection("products").add(productData);
        alert("Produit ajouté avec succès!");
        document.getElementById("productForm").reset();
    } catch (error) {
        console.error("Erreur lors de l'ajout du produit:", error);
        alert("Erreur lors de l'ajout du produit: " + error.message);
    }
}

function renderProducts() {
    const productsList = document.getElementById("productsList");
    if (!productsList) return;
    
    if (products.length === 0) {
        productsList.innerHTML = "<p>Aucun produit trouvé</p>";
        return;
    }
    
    productsList.innerHTML = `
        <h3>Liste des produits (${products.length})</h3>
        <div class="product-grid">
            ${products.map(product => `
                <div class="product-card">
                    ${product.images && product.images.length > 0 ? 
                        `<img src="${product.images[0]}" alt="${product.name}" style="width:100%;height:200px;object-fit:cover;border-radius:0.5rem;">` : 
                        '<div style="width:100%;height:200px;background:#ffe6f2;display:flex;align-items:center;justify-content:center;border-radius:0.5rem;"><i class="fas fa-image" style="font-size:3rem;color:#ff4d94;"></i></div>'
                    }
                    <h3>${product.name}</h3>
                    <p>Catégorie: ${product.category}</p>
                    <p>Prix: $${product.price.toFixed(2)}</p>
                    <p>Prix original: $${product.originalPrice.toFixed(2)}</p>
                    <button class="btn btn-danger" onclick="deleteProduct('${product.id}')">
                        <i class="fas fa-trash"></i> Supprimer
                    </button>
                </div>
            `).join('')}
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
        <h3>Liste des utilisateurs (${users.length})</h3>
        ${users.map(user => `
            <div class="user-card">
                <h3>${user.name || 'Non renseigné'}</h3>
                <p>Email: ${user.email || 'Non renseigné'}</p>
                <p>Téléphone: ${user.phone || 'Non renseigné'}</p>
                <p>Inscrit le: ${formatDate(user.registeredAt)}</p>
                <span class="badge" style="background: ${user.isActive ? '#ff4d94' : '#6b7280'}; color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem;">
                    ${user.isActive ? 'Active' : 'Inactive'}
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
        <h3>Liste des commandes (${orders.length})</h3>
        ${orders.map(order => `
            <div class="order-item">
                <h3>Commande #${order.id.substring(0, 8)}</h3>
                <p>Client: ${order.customerName || 'Non renseigné'}</p>
                <p>Total: $${order.totalAmount ? order.totalAmount.toFixed(2) : '0.00'}</p>
                <p>Statut: ${order.status || 'En attente'}</p>
                <p>Date: ${formatDate(order.createdAt)}</p>
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
        <h3>Paniers actifs (${carts.length})</h3>
        ${carts.map(cart => `
            <div class="cart-item-admin">
                <h3>Panier #${cart.id.substring(0, 8)}</h3>
                <p>Total: $${cart.totalAmount ? cart.totalAmount.toFixed(2) : '0.00'}</p>
                <p>Nombre d'articles: ${cart.items ? cart.items.length : 0}</p>
                <p>Dernière mise à jour: ${formatDate(cart.lastUpdated)}</p>
            </div>
        `).join('')}
    `;
}

function formatDate(dateValue) {
    if (!dateValue) return 'Date inconnue';
    
    try {
        const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
        return date.toLocaleDateString('fr-FR');
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
        alert("Firestore non initialisé");
        return;
    }
    
    if (confirm("Êtes-vous sûr de vouloir supprimer ce produit?")) {
        try {
            await window.db.collection("products").doc(id).delete();
            alert("Produit supprimé avec succès");
        } catch (error) {
            console.error("Erreur lors de la suppression:", error);
            alert("Erreur lors de la suppression du produit: " + error.message);
        }
    }
}

window.viewOrderDetails = function(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    alert(`Détails de la commande #${orderId.substring(0, 8)}\n
Client: ${order.customerName || 'Non renseigné'}
Email: ${order.customerEmail || 'Non renseigné'}
Téléphone: ${order.customerPhone || 'Non renseigné'}
Total: $${order.totalAmount ? order.totalAmount.toFixed(2) : '0.00'}
Statut: ${order.status || 'En attente'}
Adresse: ${order.shippingAddress || 'Non renseignée'}
\nArticles:\n${order.items ? order.items.map(item => `- ${item.quantity}x ${item.name} (${item.size}, ${item.color}): $${item.price ? item.price.toFixed(2) : '0.00'}`).join('\n') : 'Aucun article'}`);
}
