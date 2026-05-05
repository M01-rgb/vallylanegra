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
  console.log("🚀 Valy la Negra - Mode LIVE Activé!");
  loadFirestoreProducts();
  loadFirestoreUsers();
  loadCart();
  checkUserRegistration();
  setupEventListeners();
  setupLightbox();
  setupPaymentMethods();
  window.toggleCart = toggleCart;
  window.updateQuantity = updateQuantity;
  window.removeFromCart = removeFromCart;
  window.addToCart = addToCart;
  window.openLightbox = openLightbox;
});

function loadFirestoreProducts() {
  console.log("📦 Chargement des produits depuis Firestore...");
  
  if (!db) {
    console.error("❌ Firestore non initialisé");
    return;
  }
  
  const productsCol = collection(db, "products");
  const q = query(productsCol, orderBy("createdAt", "desc"));
  
  onSnapshot(q, (snapshot) => {
    console.log("🔥 Données produits reçues, nombre:", snapshot.docs.length);
    
    allProducts = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));
    
    products = shuffleArray([...allProducts]);
    filteredProducts = [...products];
    
    console.log(`✅ ${products.length} produits chargés depuis Firestore`);
    applyFilters();
  }, (error) => {
    console.error("❌ Erreur chargement produits:", error);
  });
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
    const savedUser = localStorage.getItem("valylanegra-current-user");
    if (savedUser && savedUser !== 'undefined') {
      currentUser = JSON.parse(savedUser);
    }
    console.log("🛒 Panier chargé:", cart.length, "articles");
  } catch (e) {
    console.error("❌ Erreur chargement panier:", e);
    cart = [];
    currentUser = null;
  }
  updateCartUI();
  
  if (currentUser && currentUser.id) {
    syncCartToFirestore();
  }
}

async function syncCartToFirestore() {
  if (!currentUser || !currentUser.id || !db) return;
  
  try {
    const cartsQuery = query(collection(db, "carts"), where("userId", "==", currentUser.id));
    const querySnapshot = await getDocs(cartsQuery);
    const totalAmount = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    
    if (!querySnapshot.empty) {
      const cartDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, "carts", cartDoc.id), {
        items: cart,
        totalAmount: totalAmount,
        lastUpdated: serverTimestamp()
      });
      console.log("✅ Panier synchronisé avec Firestore");
    } else if (cart.length > 0) {
      await addDoc(collection(db, "carts"), {
        userId: currentUser.id,
        items: cart,
        totalAmount: totalAmount,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      });
      console.log("✅ Panier créé dans Firestore");
    }
  } catch (error) {
    console.error("Erreur synchronisation panier:", error);
  }
}

async function updateUserActivity() {
  if (!currentUser || !currentUser.id || !db) return;
  
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
  if (currentUser && currentUser.id) {
    localStorage.setItem("valylanegra-current-user", JSON.stringify(currentUser));
    updateUserActivity();
    syncCartToFirestore();
  }
  updateCartUI();
}

function checkUserRegistration() {
  if (!currentUser || !currentUser.id) {
    console.log("👤 Utilisateur non enregistré - affichage modal");
    setTimeout(() => {
      const modal = document.getElementById("registrationModal");
      if (modal) modal.classList.add("active");
    }, 500);
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

function setupPaymentMethods() {
  // Les deux méthodes sont directement visibles - Plus besoin de choix
  const paypalSection = document.getElementById('paypal-section');
  const cardSection = document.getElementById('card-section');
  
  // Afficher les deux sections
  if (paypalSection) paypalSection.style.display = 'block';
  if (cardSection) cardSection.style.display = 'block';
  
  // Initialiser PayPal si le panier n'est pas vide
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  if (totalPrice > 0) {
    setTimeout(() => renderPaypalButton(totalPrice), 300);
  }
  
  // Paiement par carte
  const payWithCardBtn = document.getElementById('payWithCard');
  if (payWithCardBtn) {
    payWithCardBtn.addEventListener('click', processCardPayment);
  }
}

function applyFilters() {
  console.log("🔍 Application des filtres...");
  
  if (currentCategory === 'all') {
    filteredProducts = [...products];
  } else {
    filteredProducts = products.filter(product => product.category === currentCategory);
  }
  
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

function openLightbox(productId, imgIndex = 0) {
  const product = products.find(p => p.id === productId);
  if (!product || !product.images || product.images.length === 0) return;
  
  currentProductImages = product.images;
  currentImageIndex = imgIndex;
  const lightboxImg = document.getElementById("lightboxImage");
  const descriptionDiv = document.getElementById("lightboxDescription");
  
  if (!lightboxImg) return;
  
  lightboxImg.src = currentProductImages[currentImageIndex];
  
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
    await syncCartToFirestore();
    
    const modal = document.getElementById("registrationModal");
    if (modal) modal.classList.remove("active");
    showMessage(`Bienvenue ${name} ! 🎉`, 'success');
  } catch (e) {
    console.error("❌ Erreur inscription:", e);
    showMessage("Erreur lors de l'inscription. Réessayez.", 'error');
  }
}

function displayUserName() {
  const nameDisplay = document.getElementById("userNameDisplay");
  if (nameDisplay && currentUser && currentUser.name) {
    nameDisplay.textContent = currentUser.name;
  }
}

function showUserProfile() {
  if (!currentUser || !currentUser.id) {
    showMessage("Veuillez vous inscrire d'abord!", 'error');
    const modal = document.getElementById("registrationModal");
    if (modal) modal.classList.add("active");
    return;
  }
  alert(`👤 ${currentUser.name}\n📧 ${currentUser.email}\n📞 ${currentUser.phone}`);
}

function renderProducts() {
  const grid = document.getElementById("productsGrid");
  if (!grid) {
    console.error("❌ Grille de produits non trouvée");
    return;
  }
  
  if (!filteredProducts || filteredProducts.length === 0) {
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
    const discount = product.originalPrice && product.originalPrice > 0 ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100) : 0;
    const rating = 4.0 + Math.random() * 1.0;
    const reviews = Math.floor(Math.random() * 1000) + 100;
    const firstImage = product.images && product.images.length > 0 ? product.images[0] : "https://images.unsplash.com/photo-1560769684-55015cee73a8?w=400&h=400&fit=crop";
    
    return `
      <div class="product-card" data-category="${product.category}">
        <div class="product-image" onclick="openLightbox('${product.id}')">
          <img src="${firstImage}" alt="${product.name}" class="product-img">
          <div class="product-badge">NOUVEAU</div>
          ${discount > 0 ? `<div class="discount-badge">-${discount}%</div>` : ''}
        </div>
        <div class="product-info">
          <div class="product-name">${escapeHtml(product.name)}</div>
          <div class="product-rating">
            <span class="stars">${"★".repeat(Math.floor(rating))}${"☆".repeat(5 - Math.floor(rating))}</span>
            <span>(${reviews})</span>
          </div>
          <div class="product-price">
            <span class="current-price">$${product.price.toFixed(2)}</span>
            ${product.originalPrice && product.originalPrice > 0 ? `<span class="original-price">$${product.originalPrice.toFixed(2)}</span>` : ''}
          </div>
          <button class="add-to-cart" onclick="addToCart('${product.id}'); event.stopPropagation()">
            <i class="fas fa-shopping-cart"></i> Ajouter
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function addToCart(productId) {
  if (isAddingToCart) return;
  
  const product = products.find((p) => p.id === productId);
  if (!product) {
    showMessage("Produit non trouvé", 'error');
    return;
  }
  
  isAddingToCart = true;
  openProductOptions(product);
}

function openProductOptions(product) {
  const overlay = document.getElementById("overlay");
  if (overlay) overlay.classList.add("active");
  
  const category = product.category || 'default';
  const sizeOptions = SIZE_OPTIONS[category] || SIZE_OPTIONS.default;
  
  let modal = document.createElement("div");
  modal.className = "modal";
  modal.style.display = "flex";
  modal.innerHTML = `
    <div class="modal-content" style="max-width:400px;">
      <h3>Ajouter au panier</h3>
      <img src="${product.images && product.images.length > 0 ? product.images[0] : 'https://images.unsplash.com/photo-1560769684-55015cee73a8?w=120&h=120&fit=crop'}" style="max-width:120px;max-height:120px;border-radius:6px;">
      <p><strong>${escapeHtml(product.name)}</strong></p>
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
  const addressForm = document.getElementById("addressForm");
  const paypalSection = document.getElementById("paypal-section");
  const cardSection = document.getElementById("card-section");

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
    if (addressForm) addressForm.style.display = 'none';
    if (paypalSection) paypalSection.style.display = 'none';
    if (cardSection) cardSection.style.display = 'none';
  } else {
    cartItems.innerHTML = `
      <div class="cart-items-list">
        ${cart.map(item => `
          <div class="cart-item">
            <img src="${item.image}" alt="${item.name}">
            <div class="cart-item-info">
              <div class="cart-item-name">${escapeHtml(item.name)}</div>
              <div style="font-size:0.9em;color:#666;">
                ${item.size ? `Taille/Modèle: <b>${escapeHtml(item.size)}</b>, ` : ''}Couleur: <b>${escapeHtml(item.color)}</b>
              </div>
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
        `).join("")}
      </div>
    `;
    
    if (addressForm) addressForm.style.display = 'block';
    if (paypalSection) paypalSection.style.display = 'block';
    if (cardSection) cardSection.style.display = 'block';
    
    // Recharger PayPal avec le nouveau total
    if (totalPrice > 0) {
      setTimeout(() => renderPaypalButton(totalPrice), 300);
    }
  }
}

function updateQuantity(key, newQuantity) {
  let item = cart.find((i) => i.key === key);
  if (!item) return;
  if (newQuantity <= 0) {
    cart = cart.filter((i) => i.key !== key);
  } else {
    item.quantity = newQuantity;
  }
  saveCart();
}

function removeFromCart(key) {
  cart = cart.filter((i) => i.key !== key);
  saveCart();
}

function validateAddressForm() {
  const name = document.getElementById("shippingName")?.value.trim();
  const address = document.getElementById("shippingAddress")?.value.trim();
  const city = document.getElementById("shippingCity")?.value.trim();
  const zip = document.getElementById("shippingZip")?.value.trim();
  const phone = document.getElementById("shippingPhone")?.value.trim();
  
  const isValid = !!(name && address && city && zip && phone);
  if (!isValid) {
    showMessage("Veuillez remplir tous les champs de l'adresse de livraison", 'error');
  }
  return isValid;
}

function getShippingAddress() {
  const name = document.getElementById("shippingName")?.value.trim();
  const address = document.getElementById("shippingAddress")?.value.trim();
  const city = document.getElementById("shippingCity")?.value.trim();
  const zip = document.getElementById("shippingZip")?.value.trim();
  const phone = document.getElementById("shippingPhone")?.value.trim();
  return { name, address, city, zip, phone, full: `${name}, ${address}, ${city} ${zip}, Tél: ${phone}` };
}

function renderPaypalButton(totalPrice) {
  if (!window.paypal) {
    console.warn("PayPal SDK non chargé");
    showMessage("Système de paiement temporairement indisponible", 'error');
    return;
  }
  
  const container = document.getElementById("paypal-button-container");
  if (!container) return;
  
  container.innerHTML = "";
  
  if (typeof totalPrice !== 'number' || totalPrice <= 0) {
    console.error("❌ Montant PayPal invalide:", totalPrice);
    return;
  }

  try {
    console.log("💰 PayPal LIVE - Montant:", totalPrice.toFixed(2));
    
    window.paypal.Buttons({
      style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' },
      
      createOrder: function(data, actions) {
        console.log("🔄 Création de la commande PayPal LIVE...");
        
        if (!validateAddressForm()) {
          return Promise.reject(new Error("Adresse manquante"));
        }
        
        if (totalPrice <= 0 || isNaN(totalPrice)) {
          showMessage("Erreur: Montant du panier invalide", 'error');
          return Promise.reject(new Error("Montant invalide"));
        }
        
        return actions.order.create({
          purchase_units: [{
            amount: { value: totalPrice.toFixed(2), currency_code: "USD" },
            description: "Achat Valy la Negra"
          }],
          application_context: { shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" }
        }).then(order => {
          console.log("✅ Commande PayPal LIVE créée:", order.id);
          return order;
        }).catch(error => {
          console.error("❌ Erreur création commande PayPal LIVE:", error);
          showMessage("Erreur PayPal: " + (error.message || "Vérifiez vos informations"), 'error');
          throw error;
        });
      },
      
      onApprove: function(data, actions) {
        console.log("✅ Commande LIVE approuvée, capture en cours...");
        
        return actions.order.capture().then(async function(details) {
          console.log("💰 Paiement LIVE réussi:", details);
          
          try {
            await createOrder(details, getShippingAddress());
            showMessage(`🎉 Paiement réussi! Merci ${details.payer.name.given_name}.`, 'success');
            cart = [];
            saveCart();
            setTimeout(() => closeAllPanels(), 2000);
          } catch (error) {
            console.error("❌ Erreur création commande:", error);
            showMessage("Paiement réussi mais erreur d'enregistrement.", 'error');
          }
        }).catch(error => {
          console.error("❌ Erreur capture paiement PayPal LIVE:", error);
          showMessage("Erreur lors du traitement du paiement", 'error');
        });
      },
      
      onCancel: function(data) {
        console.log("❌ Paiement LIVE annulé");
        showMessage("Paiement annulé", 'info');
      },
      
      onError: function(err) {
        console.error("❌ Erreur PayPal LIVE:", err);
        showMessage("Erreur lors du paiement. Réessayez.", 'error');
      },
      
      onClick: function(data, actions) {
        if (!validateAddressForm()) return false;
        if (cart.length === 0) {
          showMessage("Votre panier est vide", 'error');
          return false;
        }
        return true;
      }
      
    }).render('#paypal-button-container').catch(error => {
      console.error("❌ Erreur rendu bouton PayPal LIVE:", error);
    });
  } catch (e) {
    console.error("❌ Erreur initialisation PayPal LIVE:", e);
  }
}

function processCardPayment() {
  if (!validateAddressForm()) return;
  
  const cardNumber = document.getElementById("cardNumber")?.value.trim();
  const cardExpiry = document.getElementById("cardExpiry")?.value.trim();
  const cardCvc = document.getElementById("cardCvc")?.value.trim();
  const cardName = document.getElementById("cardName")?.value.trim();
  
  if (!cardNumber || !cardExpiry || !cardCvc || !cardName) {
    showMessage("Veuillez remplir toutes les informations de la carte", 'error');
    return;
  }
  
  if (cardNumber.replace(/\s/g, '').length < 15) {
    showMessage("Numéro de carte invalide", 'error');
    return;
  }
  
  if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
    showMessage("Format date invalide (MM/AA)", 'error');
    return;
  }
  
  if (cardCvc.length < 3) {
    showMessage("CVC invalide", 'error');
    return;
  }
  
  showMessage("💳 Traitement du paiement par carte...", 'info');
  
  setTimeout(async () => {
    try {
      const paymentDetails = {
        id: 'card_' + Date.now(),
        payer: { payer_id: 'card_payment', name: { given_name: cardName } }
      };
      await createOrder(paymentDetails, getShippingAddress());
      showMessage("💳 Paiement par carte réussi ! Merci pour votre commande.", 'success');
      cart = [];
      saveCart();
      setTimeout(() => closeAllPanels(), 2000);
    } catch (error) {
      console.error("Erreur paiement carte:", error);
      showMessage("Erreur lors du paiement par carte", 'error');
    }
  }, 1500);
}

async function createOrder(paymentDetails, shippingAddress) {
  if (!currentUser || !currentUser.id || !db) {
    throw new Error("Utilisateur non connecté ou base de données indisponible");
  }
  
  try {
    const orderData = {
      userId: currentUser.id,
      customerName: currentUser.name,
      customerEmail: currentUser.email,
      customerPhone: currentUser.phone,
      items: cart.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        size: item.size,
        color: item.color,
        image: item.image
      })),
      totalAmount: cart.reduce((total, item) => total + (item.price * item.quantity), 0),
      paymentId: paymentDetails.id,
      payerId: paymentDetails.payer.payer_id,
      paymentStatus: 'completed',
      shippingAddress: shippingAddress.full,
      status: 'processing',
      paymentMethod: paymentDetails.id.includes('card') ? 'card' : 'paypal',
      createdAt: serverTimestamp(),
      completedAt: serverTimestamp()
    };
    
    const orderRef = await addDoc(collection(db, "orders"), orderData);
    console.log("✅ Commande créée avec ID:", orderRef.id);
    
    await sendOrderConfirmationEmail(orderData);
    
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
    
    return orderRef.id;
  } catch (error) {
    console.error("❌ Erreur création commande:", error);
    throw error;
  }
}

async function sendOrderConfirmationEmail(orderData) {
  console.log("=== EMAIL DE CONFIRMATION ===");
  console.log("À: ", orderData.customerEmail);
  console.log("Sujet: Confirmation de commande Valy la Negra");
  console.log(`Merci ${orderData.customerName} pour votre commande !`);
  console.log("Montant total: $", orderData.totalAmount);
  console.log("Articles: ", orderData.items.length);
  console.log("Adresse de livraison: ", orderData.shippingAddress);
  console.log("Méthode de paiement: ", orderData.paymentMethod);
  console.log("=== FIN EMAIL ===");
  return true;
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

function showMessage(message, type = 'info') {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;
  messageDiv.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
    <span>${message}</span>
  `;
  
  document.body.appendChild(messageDiv);
  
  setTimeout(() => messageDiv.classList.add('show'), 100);
  setTimeout(() => {
    messageDiv.classList.remove('show');
    setTimeout(() => messageDiv.remove(), 300);
  }, 3000);
}

console.log("✅ Valy la Negra - Script complet chargé !");
