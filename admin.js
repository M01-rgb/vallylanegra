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
    const productsCol = collection(db, "products");
    const q = query(productsCol, orderBy("createdAt", "desc"));
    
    onSnapshot(q, (snapshot) => {
        products = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        }));
        
        updateStats();
        renderProducts();
    });
}

function loadUsers() {
    const usersCol = collection(db, "users");
    const q = query(usersCol, orderBy("registeredAt", "desc"));
    
    onSnapshot(q, (snapshot) => {
        users = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        }));
        
        updateStats();
        renderUsers();
    });
}

function loadOrders() {
    const ordersCol = collection(db, "orders");
    const q = query(ordersCol, orderBy("createdAt", "desc"));
    
    onSnapshot(q, (snapshot) => {
        orders = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        }));
        
        updateStats();
        renderOrders();
    });
}

function loadCarts() {
    const cartsCol = collection(db, "carts");
    const q = query(cartsCol, where("totalAmount", ">", 0));
    
    onSnapshot(q, (snapshot) => {
        carts = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        }));
        
        updateStats();
        renderCarts();
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
        const lastActivity = new Date(user.lastActivity.toDate ? user.lastActivity.toDate() : user.lastActivity);
        const now = new Date();
        return (now - lastActivity) < 24 * 60 * 60 * 1000;
    });
    
    if (activeUsersElem) activeUsersElem.textContent = activeUsers.length;
    if (activeCartsElem) activeCartsElem.textContent = carts.length;
}

async function addProduct() {
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
            description,
            images,
            createdAt: serverTimestamp()
        };
        
        await addDoc(collection(db, "products"), productData);
        alert("Produit ajouté avec succès!");
        document.getElementById("productForm").reset();
    } catch (error) {
        console.error("Erreur lors de l'ajout du produit:", error);
        alert("Erreur lors de l'ajout du produit");
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
                <h3>${user.name}</h3>
                <p>Email: ${user.email}</p>
                <p>Téléphone: ${user.phone}</p>
                <p>Inscrit le: ${new Date(user.registeredAt.toDate ? user.registeredAt.toDate() : user.registeredAt).toLocaleDateString()}</p>
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
                <p>Client: ${order.customerName}</p>
                <p>Total: $${order.totalAmount.toFixed(2)}</p>
                <p>Statut: ${order.status}</p>
                <p>Date: ${new Date(order.createdAt.toDate ? order.createdAt.toDate() : order.createdAt).toLocaleDateString()}</p>
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
                <p>Total: $${cart.totalAmount.toFixed(2)}</p>
                <p>Nombre d'articles: ${cart.items.length}</p>
                <p>Dernière mise à jour: ${new Date(cart.lastUpdated.toDate ? cart.lastUpdated.toDate() : cart.lastUpdated).toLocaleString()}</p>
            </div>
        `).join('')}
    `;
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
    if (confirm("Êtes-vous sûr de vouloir supprimer ce produit?")) {
        try {
            await deleteDoc(doc(db, "products", id));
            alert("Produit supprimé avec succès");
        } catch (error) {
            console.error("Erreur lors de la suppression:", error);
            alert("Erreur lors de la suppression du produit");
        }
    }
}

window.viewOrderDetails = function(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    alert(`Détails de la commande #${orderId.substring(0, 8)}\n
Client: ${order.customerName}
Email: ${order.customerEmail}
Téléphone: ${order.customerPhone}
Total: $${order.totalAmount.toFixed(2)}
Statut: ${order.status}
Adresse: ${order.shippingAddress}
\nArticles:\n${order.items.map(item => `- ${item.quantity}x ${item.name} (${item.size}, ${item.color}): $${item.price.toFixed(2)}`).join('\n')}`);
}