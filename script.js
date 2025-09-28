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
  hair: ["Petit", "Moyen", "Grand", "Familial"],
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
  setupPaymentSystem();
  window.toggleCart = toggleCart;
});

function setupPaymentSystem() {
  console.log("💳 Configuration du système de paiement...");
  
  // Gestion des méthodes de paiement
  document.querySelectorAll('input[name="payment"]').forEach(radio => {
    radio.addEventListener('change', function() {
      const method = this.value;
      showPaymentMethod(method);
    });
  });

  // Bouton paiement carte
  const payWithCardBtn = document.getElementById('payWithCard');
  if (payWithCardBtn) {
    payWithCardBtn.addEventListener('click', processCardPayment);
  }

  // Bouton paiement à la livraison
  const payWithCashBtn = document.getElementById('payWithCash');
  if (payWithCashBtn) {
    payWithCashBtn.addEventListener('click', processCashPayment);
  }
}

function showPaymentMethod(method) {
  console.log(`🎯 Méthode de paiement sélectionnée: ${method}`);
  
  // Masquer toutes les sections
  document.getElementById('paypal-section').style.display = 'none';
  document.getElementById('card-section').style.display = 'none';
  document.getElementById('cash-section').style.display = 'none';
  
  // Afficher la section sélectionnée
  switch(method) {
    case 'paypal':
      document.getElementById('paypal-section').style.display = 'block';
      initializePayPal();
      break;
    case 'card':
      document.getElementById('card-section').style.display = 'block';
      break;
    case 'cash':
      document.getElementById('cash-section').style.display = 'block';
      break;
  }
}

function initializePayPal() {
  console.log("🔄 Initialisation PayPal...");
  
  const container = document.getElementById("paypal-button-container");
  if (!container) {
    console.error("❌ Conteneur PayPal non trouvé");
    return;
  }
  
  container.innerHTML = "";
  
  const totalPrice = calculateTotal();
  if (totalPrice <= 0) {
    console.warn("⚠️ Montant PayPal invalide:", totalPrice);
    return;
  }

  try {
    if (!window.paypal) {
      console.error("❌ PayPal SDK non chargé");
      showMessage("PayPal n'est pas disponible pour le moment", "error");
      return;
    }

    window.paypal.Buttons({
      style: { 
        layout: 'vertical', 
        color: 'gold', 
        shape: 'rect', 
        label: 'paypal',
        height: 45
      },
      
      createOrder: function(data, actions) {
        console.log("💰 Création de commande PayPal...");
        return actions.order.create({
          purchase_units: [{
            amount: { 
              value: totalPrice.toFixed(2),
              currency_code: "USD"
            },
            description: "Achat Valy la Negra"
          }],
          application_context: {
            shipping_preference: "NO_SHIPPING"
          }
        }).catch(error => {
          console.error("❌ Erreur création commande PayPal:", error);
          showMessage("Erreur lors de la création de la commande PayPal", "error");
          throw error;
        });
      },

      onApprove: function(data, actions) {
        console.log("✅ Paiement PayPal approuvé:", data);
        showMessage("Traitement du paiement en cours...", "info");
        
        return actions.order.capture().then(async function(details) {
          console.log("💰 Paiement PayPal réussi:", details);
          
          // Vérifier l'adresse de livraison
          if (!validateShippingAddress()) {
            showMessage("Veuillez compléter l'adresse de livraison", "error");
            return;
          }
          
          await processSuccessfulPayment(details, 'paypal');
          showMessage(`Paiement réussi! Merci ${details.payer.name.given_name} !`, "success");
          
        }).catch(error => {
          console.error("❌ Erreur capture PayPal:", error);
          handlePaymentError(error, 'paypal');
        });
      },

      onError: function(err) {
        console.error("❌ Erreur PayPal:", err);
        handlePaymentError(err, 'paypal');
      },

      onCancel: function(data) {
        console.log("❌ Paiement PayPal annulé:", data);
        showMessage("Paiement annulé", "info");
      },

      onClick: function(data, actions) {
        console.log("🖱️ Clic sur bouton PayPal");
        // Vérifier les prérequis avant paiement
        if (cart.length === 0) {
          showMessage("Votre panier est vide", "error");
          return actions.reject();
        }
        
        if (!validateShippingAddress()) {
          showMessage("Veuillez compléter l'adresse de livraison", "error");
          return actions.reject();
        }
        
        console.log("✅ Prérequis PayPal validés");
        return actions.resolve();
      }

    }).render('#paypal-button-container').catch(error => {
      console.error("❌ Erreur rendu bouton PayPal:", error);
      showMessage("Erreur d'initialisation PayPal", "error");
    });
    
  } catch (error) {
    console.error("❌ Erreur initialisation PayPal:", error);
    showMessage("Erreur de configuration PayPal", "error");
  }
}

function validateShippingAddress() {
  const name = document.getElementById('shippingName')?.value.trim();
  const address = document.getElementById('shippingAddress')?.value.trim();
  const city = document.getElementById('shippingCity')?.value.trim();
  const zip = document.getElementById('shippingZip')?.value.trim();
  const phone = document.getElementById('shippingPhone')?.value.trim();
  
  if (!name || !address || !city || !zip || !phone) {
    return false;
  }
  
  return true;
}

async function processCardPayment() {
  console.log("💳 Traitement paiement carte...");
  
  const cardBtn = document.getElementById('payWithCard');
  const originalText = cardBtn.innerHTML;
  
  try {
    // Validation des champs carte
    const cardNumber = document.getElementById('cardNumber').value.trim();
    const cardExpiry = document.getElementById('cardExpiry').value.trim();
    const cardCvc = document.getElementById('cardCvc').value.trim();
    const cardName = document.getElementById('cardName').value.trim();
    
    if (!cardNumber || !cardExpiry || !cardCvc || !cardName) {
      showMessage("Veuillez remplir tous les champs de la carte", "error");
      return;
    }
    
    if (!validateShippingAddress()) {
      showMessage("Veuillez compléter l'adresse de livraison", "error");
      return;
    }
    
    // Simulation de paiement carte
    cardBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Traitement...';
    cardBtn.disabled = true;
    
    // Simuler un délai de traitement
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simuler un paiement réussi (dans la réalité, utiliser Stripe ou autre processeur)
    const mockPaymentDetails = {
      id: 'card_' + Date.now(),
      status: 'completed'
    };
    
    await processSuccessfulPayment(mockPaymentDetails, 'card');
    showMessage("Paiement par carte réussi!", "success");
    
  } catch (error) {
    console.error("❌ Erreur paiement carte:", error);
    handlePaymentError(error, 'card');
  } finally {
    cardBtn.innerHTML = originalText;
    cardBtn.disabled = false;
  }
}

async function processCashPayment() {
  console.log("💵 Traitement paiement à la livraison...");
  
  const cashBtn = document.getElementById('payWithCash');
  const originalText = cashBtn.innerHTML;
  
  try {
    if (!validateShippingAddress()) {
      showMessage("Veuillez compléter l'adresse de livraison", "error");
      return;
    }
    
    cashBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Confirmation...';
    cashBtn.disabled = true;
    
    // Simulation de traitement
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockPaymentDetails = {
      id: 'cash_' + Date.now(),
      status: 'pending'
    };
    
    await processSuccessfulPayment(mockPaymentDetails, 'cash');
    showMessage("Commande confirmée! Paiement à la livraison.", "success");
    
  } catch (error) {
    console.error("❌ Erreur paiement livraison:", error);
    handlePaymentError(error, 'cash');
  } finally {
    cashBtn.innerHTML = originalText;
    cashBtn.disabled = false;
  }
}

async function processSuccessfulPayment(paymentDetails, method) {
  console.log(`✅ Paiement ${method} réussi:`, paymentDetails);
  
  try {
    // Récupérer l'adresse de livraison
    const shippingInfo = {
      name: document.getElementById('shippingName').value,
      address: document.getElementById('shippingAddress').value,
      city: document.getElementById('shippingCity').value,
      zip: document.getElementById('shippingZip').value,
      phone: document.getElementById('shippingPhone').value
    };
    
    // Créer la commande
    const orderData = {
      userId: currentUser?.id,
      customerName: currentUser?.name || shippingInfo.name,
      customerEmail: currentUser?.email,
      customerPhone: currentUser?.phone || shippingInfo.phone,
      items: cart,
      totalAmount: calculateTotal(),
      paymentId: paymentDetails.id,
      paymentMethod: method,
      paymentStatus: method === 'cash' ? 'pending' : 'completed',
      shippingAddress: shippingInfo,
      status: method === 'cash' ? 'confirmed' : 'processing',
      createdAt: serverTimestamp()
    };
    
    // Sauvegarder la commande dans Firestore
    if (db) {
      await addDoc(collection(db, "orders"), orderData);
      console.log("📦 Commande sauvegardée dans Firestore");
    }
    
    // Envoyer email de confirmation
    await sendOrderConfirmationEmail(orderData);
    
    // Vider le panier
    cart = [];
    saveCart();
    
    // Fermer le panier
    toggleCart();
    
    // Réinitialiser les formulaires
    resetPaymentForms();
    
    console.log("🎉 Processus de commande terminé avec succès");
    
  } catch (error) {
    console.error("❌ Erreur traitement commande:", error);
    throw error;
  }
}

function handlePaymentError(error, method) {
  console.error(`❌ Erreur paiement ${method}:`, error);
  
  let errorMessage = "Erreur lors du paiement";
  
  if (error.message) {
    errorMessage = error.message;
  } else if (error.details) {
    errorMessage = error.details;
  }
  
  showMessage(errorMessage, "error");
  
  // Réactiver les boutons si nécessaire
  const cardBtn = document.getElementById('payWithCard');
  const cashBtn = document.getElementById('payWithCash');
  
  if (cardBtn) {
    cardBtn.innerHTML = '<i class="fas fa-credit-card"></i> Payer avec carte';
    cardBtn.disabled = false;
  }
  
  if (cashBtn) {
    cashBtn.innerHTML = '<i class="fas fa-check"></i> Confirmer la commande';
    cashBtn.disabled = false;
  }
}

function resetPaymentForms() {
  // Réinitialiser l'adresse
  document.getElementById('shippingName').value = '';
  document.getElementById('shippingAddress').value = '';
  document.getElementById('shippingCity').value = '';
  document.getElementById('shippingZip').value = '';
  document.getElementById('shippingPhone').value = '';
  
  // Réinitialiser la carte
  document.getElementById('cardNumber').value = '';
  document.getElementById('cardExpiry').value = '';
  document.getElementById('cardCvc').value = '';
  document.getElementById('cardName').value = '';
  
  // Remettre PayPal par défaut
  document.querySelector('input[value="paypal"]').checked = true;
  showPaymentMethod('paypal');
}

// Le reste de votre code existant reste inchangé...
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
        totalAmount: calculateTotal(),
        lastUpdated: serverTimestamp()
      });
    } else {
      // Créer un nouveau panier
      await addDoc(collection(db, "carts"), {
        userId: currentUser.id,
        items: cart,
        totalAmount: calculateTotal(),
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

function calculateTotal() {
  return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
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
  const totalPrice = calculateTotal();

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
    // Cacher les formulaires de paiement
    document.getElementById('addressForm').style.display = 'none';
    document.querySelector('.payment-options').style.display = 'none';
    document.getElementById('paypal-section').style.display = 'none';
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
    
    // Afficher les formulaires de paiement
    document.getElementById('addressForm').style.display = 'block';
    document.querySelector('.payment-options').style.display = 'block';
    
    // Réinitialiser PayPal
    initializePayPal();
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

window.removeFrom
