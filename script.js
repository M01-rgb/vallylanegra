import { 
  collection, 
  addDoc, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  getDocs,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const db = window.firebaseDB;

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
  hair: ["10pouces", "12pouces", "14pouces", "16pouces", "18pouces","20pouces","22pouces"], 
  default: ["Unique", "Standard", "Personnalisé"]
};

const COLORS = ["Blanc", "Noir", "Rouge", "Bleu", "Vert", "Jaune", "Rose", "Violet", "Orange", "Gris", "Marron", "Beige"];

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Valy la Negra - Démarrage...");
  loadFirestoreProducts();
  loadFirestoreUsers();
  loadCart();
  checkUserRegistration();
  setupEventListeners();
  setupLightbox();
  window.toggleCart = toggleCart;
});

function loadFirestoreProducts() {
  console.log("📦 Chargement des produits depuis Firestore...");
  
  if (!db) {
    console.error("❌ Firestore non initialisé");
    showDemoProducts();
    return;
  }
  
  const productsCol = collection(db, "products");
  const q = query(productsCol, orderBy("createdAt", "desc"));
  
  onSnapshot(q, (snapshot) => {
    console.log("🔥 Données produits reçues");
    
    allProducts = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));
    
    // Mélanger aléatoirement les produits
    products = shuffleArray([...allProducts]);
    
    console.log(`✅ ${products.length} produits chargés`);
    
    // Appliquer les filtres actuels (recherche et catégorie)
    applyFilters();
  }, (error) => {
    console.error("❌ Erreur chargement produits:", error);
    showDemoProducts();
  });
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function showDemoProducts() {
  console.log("🔄 Affichage des produits de démonstration");
  products = [];
  renderProducts();
}

function loadFirestoreUsers() {
  if (!db) return;
  
  const usersCol = collection(db, "users");
  onSnapshot(usersCol, (snapshot) => {
    users = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));
    console.log(`👥 ${users.length} utilisateurs chargés`);
  });
}

function loadCart() {
  try {
    cart = JSON.parse(localStorage.getItem("valylanegra-cart")) || [];
    currentUser = JSON.parse(localStorage.getItem("valylanegra-current-user"));
    console.log("🛒 Panier chargé:", cart.length, "articles");
  } catch (e) {
    console.error("❌ Erreur chargement panier:", e);
    cart = [];
  }
  updateCartUI();
  
  // Synchroniser le panier avec Firestore si l'utilisateur est connecté
  if (currentUser) {
    syncCartToFirestore();
  }
}

// Synchroniser le panier avec Firestore
async function syncCartToFirestore() {
  if (!currentUser || !db) return;
  
  try {
    // Vérifier si l'utilisateur a déjà un panier
    const cartsQuery = query(collection(db, "carts"), where("userId", "==", currentUser.id));
    const querySnapshot = await getDocs(cartsQuery);
    
    if (!querySnapshot.empty) {
      // Mettre à jour le panier existant
      const cartDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, "carts", cartDoc.id), {
        items: cart,
        totalAmount: cart.reduce((total, item) => total + (item.price * item.quantity), 0),
        lastUpdated: serverTimestamp()
      });
    } else {
      // Créer un nouveau panier
      await addDoc(collection(db, "carts"), {
        userId: currentUser.id,
        items: cart,
        totalAmount: cart.reduce((total, item) => total + (item.price * item.quantity), 0),
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      });
    }
  } catch (error) {
    console.error("Erreur synchronisation panier:", error);
  }
}

// Mettre à jour l'activité de l'utilisateur
async function updateUserActivity() {
  if (!currentUser || !db) return;
  
  try {
    const userRef = doc(db, "users", currentUser.id);
    await updateDoc(userRef, {
      lastActivity: serverTimestamp()
    });
  } catch (error) {
    console.error("Erreur mise à jour activité:", error);
  }
}

function saveCart() {
  localStorage.setItem("valylanegra-cart", JSON.stringify(cart));
  if (currentUser) {
    localStorage.setItem("valylanegra-current-user", JSON.stringify(currentUser));
    updateUserActivity();
    syncCartToFirestore();
  }
  updateCartUI();
}

function checkUserRegistration() {
  if (!currentUser) {
    console.log("👤 Utilisateur non enregistré - affichage modal");
    setTimeout(() => {
      const modal = document.getElementById("registrationModal");
      if (modal) modal.classList.add("active");
    }, 1000);
  } else {
    displayUserName();
  }
}

function setupEventListeners() {
  console.log("🎯 Configuration des événements...");
  
  const registrationForm = document.getElementById("registrationForm");
  if (registrationForm) {
    registrationForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("userName").value.trim();
      const email = document.getElementById("userEmail").value.trim();
      const phone = document.getElementById("userPhone").value.trim();
      if (name && email && phone) {
        await registerUser(name, email, phone);
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
      console.log("📂 Catégorie sélectionnée:", currentCategory);
      applyFilters();
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
      if (clearSearch) clearSearch.style.display = 'none';
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
}

function applyFilters() {
  console.log("🔍 Application des filtres...");
  
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
  
  console.log(`📊 ${filteredProducts.length} produits après filtrage`);
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
  
  if (!lightboxImg) return;
  
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
  
  document.getElementById("productLightbox").style.display = "block";
  const overlay = document.getElementById("overlay");
  if (overlay) overlay.classList.add("active");
}

function closeLightbox() {
  document.getElementById("productLightbox").style.display = "none";
  const overlay = document.getElementById("overlay");
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
    registeredAt: serverTimestamp(),
    isActive: true,
    lastActivity: serverTimestamp(),
  };
  
  try {
    const ref = await addDoc(collection(db, "users"), newUser);
    newUser.id = ref.id;
    currentUser = newUser;
    saveCart();
    displayUserName();
    
    // Créer un panier Firestore pour le nouvel utilisateur
    await syncCartToFirestore();
    
    document.getElementById("registrationModal").classList.remove("active");
    showMessage(`Bienvenue ${name} ! 🎉`, 'success');
  } catch (e) {
    console.error("❌ Erreur inscription:", e);
    showMessage("Erreur lors de l'inscription. Réessayez.", 'error');
  }
}

function displayUserName() {
  const nameDisplay = document.getElementById("userNameDisplay");
  if (nameDisplay) {
    const name = currentUser && currentUser.name ? currentUser.name : "Valy la Negra";
    nameDisplay.textContent = name;
  }
}

function showUserProfile() {
  if (!currentUser) {
    showMessage("Veuillez vous inscrire d'abord!", 'error');
    return;
  }
  alert(`Bienvenue ${currentUser.name}\nEmail : ${currentUser.email}\nTéléphone : ${currentUser.phone}`);
}

function renderProducts() {
  const grid = document.getElementById("productsGrid");
  if (!grid) {
    console.error("❌ Grille de produits non trouvée");
    return;
  }
  
  if (filteredProducts.length === 0) {
    grid.innerHTML = `
      <div class="no-products">
        <i class="fas fa-search" style="font-size:3rem;color:#ff4d94;"></i>
        <h3>${products.length === 0 ? 'Aucun produit disponible' : 'Aucun produit trouvé'}</h3>
        <p>${products.length === 0 ? 
          'Les produits ajoutés via la page admin apparaîtront ici.' : 
          'Aucun produit ne correspond à votre recherche.'
        }</p>
      </div>
    `;
    return;
  }
  
  grid.innerHTML = filteredProducts.map(product => {
    const discount = product.originalPrice > 0 ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0;
    const rating = 4.0 + Math.random() * 1.0;
    const reviews = Math.floor(Math.random() * 1000) + 100;
    const firstImage = product.images && product.images.length > 0 ? product.images[0] : "https://images.unsplash.com/photo-1560769684-55015cee73a8?w=400&h=400&fit=crop&text=Image+Manquante";
    
    return `
      <div class="product-card" data-category="${product.category}">
        <div class="product-image" onclick="openLightbox('${product.id}')">
          <img src="${firstImage}" alt="${product.name}" class="product-img">
          <div class="product-badge">NOUVEAU</div>
          ${discount > 0 ? `<div class="discount-badge">-${discount}%</div>` : ''}
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
            <i class="fas fa-shopping-cart"></i> Ajouter
          </button>
        </div>
      </div>
    `;
  }).join("");
}

window.addToCart = function(productId) {
  if (isAddingToCart) return;
  
  const product = products.find((p) => p.id === productId);
  if (!product) {
    showMessage("Produit non trouvé", 'error');
    return;
  }
  
  isAddingToCart = true;
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
      <h3>Ajouter au panier</h3>
      <img src="${product.images && product.images.length > 0 ? product.images[0] : 'https://images.unsplash.com/photo-1560769684-55015cee73a8?w=120&h=120&fit=crop'}" style="max-width:120px;max-height:120px;border-radius:6px;">
      <p><strong>${product.name}</strong></p>
      <form id="optionsForm">
        <label for="cartSize">Taille/Modèle :</label>
        <select id="cartSize" name="size" required>
          <option value="">Sélectionner</option>
          ${sizeOptions.map(s => `<option value="${s}">${s}</option>`).join("")}
        </select>
        <label for="cartColor" style="margin-top:1rem;">Couleur :</label>
        <select id="cartColor" name="color" required>
          <option value="">Sélectionner</option>
          ${COLORS.map(c => `<option value="${c}">${c}</option>`).join("")}
        </select>
        <label for="cartQty" style="margin-top:1rem;">Quantité :</label>
        <input type="number" id="cartQty" name="qty" min="1" value="1" style="width:60px;">
        <button type="submit" id="submitOptions" style="margin-top:1rem;background:#ff4d94;color:white;">Ajouter au panier</button>
        <button type="button" id="closeOptions" style="margin-top:0.5rem;">Annuler</button>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  
  const closeOptions = document.getElementById("closeOptions");
  if (closeOptions) {
    closeOptions.onclick = () => {
      modal.remove(); 
      if (overlay) overlay.classList.remove("active");
      isAddingToCart = false;
    };
  }
  
  const optionsForm = document.getElementById("optionsForm");
  if (optionsForm) {
    optionsForm.onsubmit = function(e) {
      e.preventDefault();
      const form = e.target;
      const submitBtn = document.getElementById("submitOptions");
      if (submitBtn) submitBtn.disabled = true;
      
      const size = form.elements.size.value;
      const color = form.elements.color.value;
      const qty = parseInt(form.elements.qty.value) || 1;
      
      addProductToCart(product, size, color, qty);
      
      modal.remove();
      if (overlay) overlay.classList.remove("active");
      isAddingToCart = false;
    };
  }
}

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
  showCartNotification(`${product.name} ajouté au panier!`);
}

function showCartNotification(message) {
  const notification = document.createElement("div");
  notification.className = "cart-notification";
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add("show");
  }, 10);
  
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 2000);
}

function updateCartUI() {
  const cartCount = document.getElementById("cartCount");
  const cartItems = document.getElementById("cartItems");
  const cartTotal = document.getElementById("cartTotal");

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (cartCount) cartCount.textContent = totalItems;
  if (cartTotal) cartTotal.textContent = totalPrice.toFixed(2);

  if (!cartItems) return;

  if (cart.length === 0) {
    cartItems.innerHTML = `
      <div class="empty-cart">
        <i class="fas fa-shopping-cart"></i>
        <p>Votre panier est vide</p>
      </div>
    `;
    const paypalDiv = document.getElementById("paypal-button-container");
    if (paypalDiv) paypalDiv.innerHTML = '';
    const addressForm = document.getElementById("addressForm");
    if (addressForm) addressForm.style.display = 'none';
  } else {
    cartItems.innerHTML = cart.map(item => `
      <div class="cart-item">
        <img src="${item.image}" alt="${item.name}">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div style="font-size:0.9em;color:#666;">${item.size ? `Taille/Modèle: <b>${item.size}</b>, ` : ''}Couleur: <b>${item.color}</b></div>
          <div class="cart-item-price">$${item.price.toFixed(2)}</div>
          <div class="quantity-controls">
            <button class="quantity-btn" onclick="updateQuantity('${item.key}', ${item.quantity - 1})">-</button>
            <span>${item.quantity}</span>
            <button class="quantity-btn" onclick="updateQuantity('${item.key}', ${item.quantity + 1})">+</button>
            <button class="quantity-btn" onclick="removeFromCart('${item.key}')" style="margin-left: 1rem; color: #ff3366;">
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
            <label for="shippingAddress">Adresse complète</label>
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
  cart = cart.filter((i) => i.key !== key);
  saveCart();
};

function renderPaypalButton(totalPrice) {
  if (!window.paypal) {
    console.warn("PayPal SDK non chargé");
    return;
  }
  
  const container = document.getElementById("paypal-button-container");
  if (!container) return;
  
  container.innerHTML = "";
  
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
        console.log("🔄 Création de la commande PayPal...");
        return actions.order.create({
          purchase_units: [{
            amount: { 
              value: totalPrice.toFixed(2),
              currency_code: "USD"
            }
          }]
        }).catch(error => {
          console.error("❌ Erreur création commande PayPal:", error);
          showMessage("Erreur lors de la création de la commande", 'error');
          throw error;
        });
      },
      onApprove: function(data, actions) {
        console.log("✅ Commande approuvée, capture en cours...");
        return actions.order.capture().then(async function(details) {
          console.log("💰 Paiement réussi:", details);
          const shippingAddress = document.getElementById("shippingAddress")?.value || "Non spécifiée";
          await createOrder(details, shippingAddress);
          
          showMessage(`Paiement réussi, merci ${details.payer.name.given_name} !`, 'success');
          cart = [];
          saveCart();
        }).catch(error => {
          console.error("❌ Erreur capture paiement PayPal:", error);
          showMessage("Erreur lors du traitement du paiement", 'error');
        });
      },
      onCancel: function(data) {
        console.log("❌ Paiement annulé par l'utilisateur");
        showMessage("Paiement annulé", 'info');
      },
      onError: function(err) {
        console.error("❌ Erreur PayPal:", err);
        showMessage("Erreur lors du processus de paiement", 'error');
      },
      onClick: function() {
        // Vérifier que l'adresse est remplie avant de permettre le paiement
        const shippingAddress = document.getElementById("shippingAddress")?.value;
        if (!shippingAddress || shippingAddress.trim() === '') {
          showMessage("Veuillez remplir votre adresse de livraison", 'error');
          return false; // Empêcher l'ouverture de PayPal
        }
        return true;
      }
    }).render('#paypal-button-container').catch(error => {
      console.error("❌ Erreur rendu bouton PayPal:", error);
      showMessage("Erreur d'initialisation du paiement", 'error');
    });
  } catch (e) {
    console.error("❌ Erreur initialisation PayPal:", e);
    showMessage("Système de paiement temporairement indisponible", 'error');
  }
}

// Créer une commande dans Firestore
async function createOrder(paymentDetails, shippingAddress) {
  if (!currentUser || !db) return;
  
  try {
    const orderData = {
      userId: currentUser.id,
      customerName: currentUser.name,
      customerEmail: currentUser.email,
      customerPhone: currentUser.phone,
      items: cart,
      totalAmount: cart.reduce((total, item) => total + (item.price * item.quantity), 0),
      paymentId: paymentDetails.id,
      paymentStatus: 'completed',
      shippingAddress: shippingAddress,
      status: 'processing',
      createdAt: serverTimestamp()
    };
    
    await addDoc(collection(db, "orders"), orderData);
    await sendOrderConfirmationEmail(orderData);
    
    // Vider le panier dans Firestore
    const cartsQuery = query(collection(db, "carts"), where("userId", "==", currentUser.id));
    const querySnapshot = await getDocs(cartsQuery);
    
    if (!querySnapshot.empty) {
      const cartDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, "carts", cartDoc.id), {
        items: [],
        totalAmount: 0,
        lastUpdated: serverTimestamp()
      });
    }
    
    console.log("✅ Commande créée avec succès");
  } catch (error) {
    console.error("❌ Erreur création commande:", error);
    showMessage("Erreur lors de l'enregistrement de la commande", 'error');
  }
}

// Fonction simulée d'envoi d'email
async function sendOrderConfirmationEmail(orderData) {
  console.log("=== EMAIL DE CONFIRMATION ===");
  console.log("À: ", orderData.customerEmail);
  console.log("Sujet: Confirmation de commande Valy la Negra");
  console.log("Merci pour votre commande !");
  return true;
}

function filterByCategory(category) {
  currentCategory = category;
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
  const overlay = document.getElementById("overlay");
  const lightbox = document.getElementById("productLightbox");
  
  if (sidebar) sidebar.classList.remove("active");
  if (overlay) overlay.classList.remove("active");
  if (lightbox) lightbox.style.display = "none";
}

function shareWebsite() {
  const url = window.location.href;
  const text = "Découvrez Valy la Negra - La meilleure boutique en ligne!";
  if (navigator.share) {
    navigator.share({ title: "Valy la Negra", text: text, url: url });
  } else {
    navigator.clipboard.writeText(url).then(() => {
      showMessage("Lien copié dans le presse-papiers!", 'success');
    });
  }
}

// Fonction d'affichage des messages
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

console.log("✅ Script Valy la Negra prêt !");
