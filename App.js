const API_BASE = "http://127.0.0.1:8000";
let TOKEN = localStorage.getItem("token") || null;

// Décodage du JWT pour vérifier le rôle admin
function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")));
  } catch (e) {
    return null;
  }
}

// Client HTTP générique sécurisé
async function apiFetch(endpoint, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (TOKEN) headers["Authorization"] = `Bearer ${TOKEN}`;

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  
  if (res.status === 401) {
    logout();
    throw new Error("Session expirée. Veuillez vous reconnecter.");
  }
  if (res.status === 404) return [];

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Erreur serveur");
  return data;
}

/* =========================================================================
   AUTHENTIFICATION (LOGIN / REGISTER)
   ========================================================================= */

document.getElementById("login-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  try {
    const res = await fetch("http://127.0.0.1:8000/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) {
        alert("Email ou mot de passe incorrect.");
      } else {
        alert(data.detail || "Erreur de connexion.");
      }
      return;
    }

    const token = data.access_token || data.token;
    if (!token) throw new Error("Token introuvable dans la réponse.");

    TOKEN = token;
    localStorage.setItem("token", TOKEN);

    enterDashboard();
    
  } catch (err) {
    alert("Erreur de connexion : " + err.message);
  }
});

document.getElementById("register-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("reg-username").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;

  try {
    await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password })
    });
    alert("Compte créé avec succès ! Connectez-vous.");
    toggleAuth(false);
  } catch (err) {
    alert("Erreur lors de l'inscription : " + err.message);
  }
});

window.logout = function() {
  TOKEN = null;
  localStorage.removeItem("token");
  document.getElementById("app-view").classList.add("hidden");
  document.getElementById("auth-view").classList.remove("hidden");
};

function enterDashboard() {
  document.getElementById("auth-view").classList.add("hidden");
  document.getElementById("app-view").classList.remove("hidden");
  switchTab("dashboard");
}

/* =========================================================================
   NAVIGATION DES ONGLETS
   ========================================================================= */

window.switchTab = function(tab) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
  document.getElementById(`tab-${tab}`)?.classList.remove("hidden");

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.remove("bg-teal-500/10", "text-teal-400");
    btn.classList.add("hover:bg-slate-800", "hover:text-white");
  });
  
  const activeBtn = document.getElementById(`nav-${tab}`);
  if (activeBtn) {
    activeBtn.classList.add("bg-teal-500/10", "text-teal-400");
    activeBtn.classList.remove("hover:bg-slate-800", "hover:text-white");
  }

  if (tab === "products") loadProducts();
  if (tab === "customers") loadCustomers();
  if (tab === "orders") {
  loadOrders();
  populateOrderSelectors();
}
if (tab === "dashboard") loadDashboardMetrics();
if (tab === "team") loadTeam();
};

/* =========================================================================
   MODULE PRODUITS
   ========================================================================= */

let allProductsCache = []; // Stocke la liste complète des produits

// Charger les produits depuis le backend
async function loadProducts() {
  const tbody = document.getElementById("products-table");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-slate-400">Chargement...</td></tr>`;

  try {
    const data = await apiFetch("/products");
    allProductsCache = Array.isArray(data) ? data : [];
    renderProductsTable(allProductsCache);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-rose-500">${err.message}</td></tr>`;
  }
}

// Générer les lignes du tableau
function renderProductsTable(list) {
  const tbody = document.getElementById("products-table");
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-slate-400">Aucun produit trouvé.</td></tr>`;
    return;
  }

window.allProductsList = list;

tbody.innerHTML = list.map(p => `
  <tr class="hover:bg-slate-50 border-b border-slate-100 transition">
    <td class="px-6 py-4 font-medium text-teal-600 hover:underline cursor-pointer" onclick="showProductDetails('${p._id}')">
      ${p.nom || "Inconnu"}
    </td>
    <td class="px-6 py-4 text-slate-500">${p.category || p.categorie || "—"}</td>
    <td class="px-6 py-4 text-slate-700 font-semibold">${p.selling_price || p.prix_vente || 0} DH</td>
    <td class="px-6 py-4">
      <span class="px-2.5 py-1 rounded-full text-xs font-bold ${(p.stock_quantity ?? p.stock) <= 5 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-700'}">
        ${p.stock_quantity ?? p.stock ?? 0}
      </span>
    </td>
    <td class="px-6 py-4 text-right space-x-2">
      <button onclick="chargerPourModifier('${p._id}')" class="text-slate-400 hover:text-blue-600 p-1.5 transition" title="Modifier">
        <i class="ph ph-pencil-simple text-lg"></i>
      </button>
      <button onclick="deleteProduct('${p._id}')" class="text-slate-400 hover:text-rose-600 p-1.5 transition" title="Supprimer">
        <i class="ph ph-trash text-lg"></i>
      </button>
    </td>
  </tr>
`).join("");

// Filtrage instantané au clavier
window.filterProducts = function() {
  const query = document.getElementById("product-search")?.value.toLowerCase().trim() || "";
  
  const filtered = allProductsCache.filter(p => {
    const nom = (p.nom || "").toLowerCase();
    const category = (p.category || "").toLowerCase();
    return nom.includes(query) || category.includes(query);
  });

  renderProductsTable(filtered);
};
}
document.getElementById("product-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const editId = document.getElementById("edit-prod-id").value;

  const nomVal = document.getElementById("prod-name").value.trim();
  const catVal = document.getElementById("prod-cat").value.trim();
  const paVal  = parseFloat(document.getElementById("prod-pa").value) || 0;
  const pvVal  = parseFloat(document.getElementById("prod-pv").value) || 0;
const stInput = document.getElementById("prod-stock") || document.querySelector("input[placeholder*='Stock']");
  const stVal = stInput ? parseInt(stInput.value, 10) : 0;
  const payload = {
    nom: nomVal,
    category: catVal,
    categorie: catVal,
    purchase_price: paVal,
    prix_achat: paVal,
    selling_price: pvVal,
    prix_vente: pvVal,
    stock_quantity: stVal,
    stock: stVal
  };

  try {
    if (editId) {
      await apiFetch(`/products/${editId}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      alert("Produit modifié avec succès !");
    } else {
      await apiFetch("/products", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      alert("Produit ajouté avec succès !");
    }

    annulerModification();
    if (typeof loadProducts === "function") loadProducts();
    if (typeof loadDashboardMetrics === "function") loadDashboardMetrics();

  } catch (err) {
    let msg = err.message;
    try {
      if (typeof msg === "object") msg = JSON.stringify(msg);
    } catch (_) {}
    alert("Erreur : " + msg);
  }
});


window.showProductDetails = async function(id) {
  try {
    const p = await apiFetch(`/products/${id}`);
    alert(`Détails du Produit :\n\nNom : ${p.nom}\nCatégorie : ${p.category}\nPrix Achat : ${p.purchase_price} DH\nPrix Vente : ${p.selling_price} DH\nStock : ${p.stock_quantity}`);
  } catch (err) {
    alert("Erreur : " + err.message);
  }
};

window.deleteProduct = async function(id) {
  if (!confirm("Supprimer ce produit ?")) return;
  try {
    await apiFetch(`/products/${id}`, { method: "DELETE" });
    loadProducts();
  } catch (err) {
    alert("Erreur : " + err.message);
  }
};

/* =========================================================================
   MODULE CLIENTS
   ========================================================================= */
let allCustomersCache = []; // Stocke la liste complète reçue du backend

async function loadCustomers() {
  const tbody = document.getElementById("customers-table");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-slate-400">Chargement...</td></tr>`;

  try {
    const data = await apiFetch("/customers");
    allCustomersCache = Array.isArray(data) ? data : (data["les clients"] || []);
    renderCustomersTable(allCustomersCache);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-4 text-center text-rose-500">${err.message}</td></tr>`;
  }
}

// Fonction qui génère le HTML du tableau
function renderCustomersTable(list) {
  const tbody = document.getElementById("customers-table");
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-slate-400">Aucun client trouvé.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(c => `
    <tr class="hover:bg-slate-50 border-b border-slate-100 transition">
      <td class="px-6 py-4 font-medium text-teal-600 hover:underline cursor-pointer" onclick="showCustomerDetails('${c._id}')">
        ${c.full_name || "Inconnu"}
      </td>
      <td class="px-6 py-4 text-slate-500">${c.phone || "—"}</td>
      <td class="px-6 py-4 text-center">
        <button onclick="openCustomerHistory('${c._id}')" class="px-3 py-1 bg-teal-50 text-teal-600 hover:bg-teal-100 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition">
          <i class="ph ph-receipt"></i> Commandes
        </button>
      </td>
      <td class="px-6 py-4 text-right">
        <button onclick="deleteCustomer('${c._id}')" class="text-slate-400 hover:text-rose-600 p-1.5 transition">
          <i class="ph ph-trash text-lg"></i>
        </button>
      </td>
    </tr>
  `).join("");
}

// Filtrage instantané au clavier
window.filterCustomers = function() {
  const query = document.getElementById("customer-search").value.toLowerCase().trim();
  
  const filtered = allCustomersCache.filter(c => {
    const name = (c.full_name || "").toLowerCase();
    const phone = (c.phone || "").toLowerCase();
    return name.includes(query) || phone.includes(query);
  });

  renderCustomersTable(filtered);
};

window.showCustomerDetails = async function(id) {
  try {
    // Exécute la récupération des infos client et le calcul du volume total en parallèle
    const [c, volume] = await Promise.all([
      apiFetch(`/customers/${id}`),
      apiFetch(`/customers/${id}/total_quantite`)
    ]);
    
    const nbrCommandes = c.commandes ? c.commandes.length : 0;
    const totalArticles = volume?.nbr_quantite ?? 0;
    
    alert(
      `Fiche Client :\n\n` +
      `• Nom : ${c.full_name || "—"}\n` +
      `• Téléphone : ${c.phone || "—"}\n` +
      `• Email : ${c.email || "Non renseigné"}\n` +
      `• Adresse : ${c.address || "Non renseignée"}\n` +
      `-----------------------------------------\n` +
      `• Commandes passées : ${nbrCommandes}\n` +
      `• Quantité totale d'articles achetés : ${totalArticles} unité(s)`
    );
  } catch (err) {
    alert("Erreur lors de la récupération des données : " + err.message);
  }
};
document.getElementById("customer-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = {
    full_name: document.getElementById("cust-name").value.trim(),
    phone: document.getElementById("cust-phone").value.trim(),
    email: document.getElementById("cust-email").value.trim() || null,
    address: document.getElementById("cust-address").value.trim() || null,
  };

  try {
    await apiFetch("/customers", { method: "POST", body: JSON.stringify(body) });
    alert("Client ajouté !");
    e.target.reset();
    loadCustomers();
  } catch (err) {
    alert("Erreur : " + err.message);
  }
});

window.openCustomerHistory = async function(id) {
  const modal = document.getElementById("customer-modal");
  if (!modal) return;
  modal.classList.remove("hidden");
  
  const nameEl = document.getElementById("modal-customer-name");
  const statsEl = document.getElementById("modal-customer-stats");
  const tbody = document.getElementById("modal-orders-table");

  if (nameEl) nameEl.textContent = "Chargement...";
  if (statsEl) statsEl.innerHTML = `<p class="text-slate-400 text-sm">Récupération des données...</p>`;
  if (tbody) tbody.innerHTML = `<tr><td colspan="3" class="px-4 py-4 text-center text-slate-400">Chargement...</td></tr>`;

  try {
    // Récupération simultanée des commandes, des produits achetés et de l'ensemble du catalogue
    const [ordersRes, purchasedRes, productsRes] = await Promise.allSettled([
      apiFetch(`/orders/customer/${id}`),
      apiFetch(`/customers/${id}/products`),
      apiFetch(`/products`)
    ]);

    const orders = (ordersRes.status === "fulfilled" && Array.isArray(ordersRes.value)) ? ordersRes.value : [];
    const purchasedData = (purchasedRes.status === "fulfilled" && purchasedRes.value) ? purchasedRes.value : null;
    const products = (productsRes.status === "fulfilled" && Array.isArray(productsRes.value)) ? productsRes.value : [];

    // Création d'une table d'indexation pour associer chaque ID à son nom réel
    const pMap = {};
    products.forEach(p => {
      pMap[String(p._id)] = p.nom;
    });

    if (nameEl) {
      nameEl.textContent = purchasedData?.full_name || "Client";
    }

    // Suppression des doublons d'affichage pour les badges de produits commandés
    const rawProducts = (purchasedData && Array.isArray(purchasedData.produits)) ? purchasedData.produits : [];
    const uniqueNames = [...new Set(rawProducts.map(p => p.nom).filter(Boolean))];

    let productsTagsHtml = "";
    if (uniqueNames.length > 0) {
      const tags = uniqueNames
        .map(nom => `<span class="inline-block px-2.5 py-1 text-xs font-semibold bg-teal-50 text-teal-700 rounded-md border border-teal-100">${nom}</span>`)
        .join(" ");
      
      productsTagsHtml = `
        <div class="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
          <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Produits commandés :</p>
          <div class="flex flex-wrap gap-1.5">${tags}</div>
        </div>
      `;
    } else {
      productsTagsHtml = `<p class="text-xs text-slate-400 mt-1">Aucun produit acheté pour l'instant.</p>`;
    }

    if (statsEl) {
      statsEl.innerHTML = `
        <div class="text-sm text-slate-700 font-medium">
          Total : <span class="font-bold text-slate-900">${orders.length}</span> commande(s).
        </div>
        ${productsTagsHtml}
      `;
    }

    if (!orders.length) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="3" class="px-4 py-6 text-center text-slate-400">Aucune commande enregistrée.</td></tr>`;
      return;
    }

    // Remplacement de l'ID technique par le nom correspondant
    if (tbody) {
      tbody.innerHTML = orders.map(o => {
        const prodId = String(o.id_product || "");
        const productName = pMap[prodId] || `Produit (${prodId.slice(-6)})`;

        return `
          <tr class="border-b border-slate-100 text-sm">
            <td class="px-4 py-2 font-mono text-xs text-slate-400">${String(o._id).slice(-6)}</td>
            <td class="px-4 py-2 text-slate-800 font-medium">${productName}</td>
            <td class="px-4 py-2 font-bold text-slate-900">${o.quantity ?? o.quantite ?? 1}</td>
          </tr>
        `;
      }).join("");
    }

  } catch (err) {
    if (statsEl) statsEl.innerHTML = `<p class="text-rose-500 text-sm">Erreur : ${err.message}</p>`;
    if (tbody) tbody.innerHTML = "";
  }
};

window.deleteCustomer = async function(id) {
  if (!confirm("Supprimer ce client ?")) return;
  try {
    await apiFetch(`/customer/${id}`, { method: "DELETE" });
    loadCustomers();
  } catch (err) {
    alert("Erreur : " + err.message);
  }
};

// Vérification initiale du token au démarrage
if (TOKEN) {
  enterDashboard();
}
/* =========================================================================
   MODULE COMMANDES
   ========================================================================= */

let allOrdersCache = [];

// 1. Remplir les listes déroulantes Clients et Produits dans le formulaire
async function populateOrderSelectors() {
  const custSelect = document.getElementById("order-customer-select");
  const prodSelect = document.getElementById("order-product-select");
  if (!custSelect || !prodSelect) return;

  try {
    const [customersData, productsData] = await Promise.all([
      apiFetch("/customers"),
      apiFetch("/products")
    ]);

    const customers = Array.isArray(customersData) ? customersData : (customersData?.["les clients"] || []);
    const products = Array.isArray(productsData) ? productsData : [];

    custSelect.innerHTML = `<option value="">Sélectionner un client...</option>` +
      customers.map(c => `<option value="${c._id}">${c.full_name || "Inconnu"} (${c.phone || "Sans tel"})</option>`).join("");

    prodSelect.innerHTML = `<option value="">Sélectionner un produit...</option>` +
      products.map(p => `<option value="${p._id}">${p.nom} — Stock: ${p.stock_quantity ?? 0} (${p.selling_price || 0} DH)</option>`).join("");
  } catch (err) {
    console.error("Erreur lors du chargement des sélecteurs de commande :", err);
  }
}

// 2. Charger les commandes
// Dictionnaires de correspondance ID -> Nom
let customerMap = {};
let productMap = {};

async function loadOrders() {
  const tbody = document.getElementById("orders-table");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-slate-400">Chargement...</td></tr>`;

  try {
    // 1. Récupération simultanée des Commandes, Clients et Produits
    const [ordersData, customersData, productsData] = await Promise.all([
      apiFetch("/orders"),
      apiFetch("/customers"),
      apiFetch("/products")
    ]);

    const customers = Array.isArray(customersData) ? customersData : (customersData?.["les clients"] || []);
    const products = Array.isArray(productsData) ? productsData : [];

    // 2. Construction des index pour accès instantané par ID
    customerMap = {};
    customers.forEach(c => {
      customerMap[String(c._id)] = c.full_name || "Client sans nom";
    });

    productMap = {};
    products.forEach(p => {
      productMap[String(p._id)] = p.nom || "Produit sans nom";
    });

    allOrdersCache = Array.isArray(ordersData) ? ordersData : [];
    renderOrdersTable(allOrdersCache);

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-rose-500">${err.message}</td></tr>`;
  }
}

function renderOrdersTable(list) {
  const tbody = document.getElementById("orders-table");
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-slate-400">Aucune commande enregistrée.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(o => {
    // Recherche du nom ou affichage de secours si introuvable
    const clientNom = customerMap[String(o.id_customer)] || `Client (${String(o.id_customer).slice(-6)})`;
    const produitNom = productMap[String(o.id_product)] || `Produit (${String(o.id_product).slice(-6)})`;
    
    // Règle le problème du 'undefined' si le champ est stocké sous 'quantite'
    const qte = o.quantity ?? o.quantite ?? 1;

    return `
      <tr class="hover:bg-slate-50 border-b border-slate-100 transition text-sm">
        <td class="px-6 py-4 font-mono text-xs text-slate-400">#${String(o._id).slice(-6)}</td>
        <td class="px-6 py-4 font-medium text-slate-900">${clientNom}</td>
        <td class="px-6 py-4 text-teal-700 font-semibold">${produitNom}</td>
        <td class="px-6 py-4 text-center">
          <span class="inline-block px-3 py-1 bg-slate-100 text-slate-800 font-bold rounded-full text-xs">
            ${qte}
          </span>
        </td>
        <td class="px-6 py-4 text-right">
          <button onclick="deleteOrder('${o._id}')" class="text-slate-400 hover:text-rose-600 p-1.5 transition" title="Supprimer">
            <i class="ph ph-trash text-lg"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

// Mise à jour de la recherche pour filtrer aussi par nom de client et nom de produit
window.filterOrders = function() {
  const query = document.getElementById("order-search")?.value.toLowerCase().trim() || "";
  
  const filtered = allOrdersCache.filter(o => {
    const clientNom = (customerMap[String(o.id_customer)] || "").toLowerCase();
    const produitNom = (productMap[String(o.id_product)] || "").toLowerCase();
    const ref = String(o._id || "").toLowerCase();

    return clientNom.includes(query) || produitNom.includes(query) || ref.includes(query);
  });

  renderOrdersTable(filtered);
};

// 5. Créer une nouvelle commande (POST /orders)
document.getElementById("order-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = {
    id_customer: document.getElementById("order-customer-select").value,
    id_product: document.getElementById("order-product-select").value,
    quantity: parseInt(document.getElementById("order-quantity").value, 10)
  };

  try {
    await apiFetch("/orders", {
      method: "POST",
      body: JSON.stringify(body)
    });
    alert("Commande créée avec succès !");
    e.target.reset();
    loadOrders();
    populateOrderSelectors(); // Met à jour l'affichage du stock restant
  } catch (err) {
    alert("Erreur lors de la commande : " + err.message);
  }
});

// 6. Supprimer une commande (DELETE /orders/{id})
window.deleteOrder = async function(id) {
  if (!confirm("Voulez-vous annuler / supprimer cette commande ?")) return;
  try {
    await apiFetch(`/orders/${id}`, { method: "DELETE" });
    alert("Commande supprimée !");
    loadOrders();
    populateOrderSelectors();
  } catch (err) {
    alert("Erreur : " + err.message);
  }
};
window.closeCustomerModal = function() {
  const modal = document.getElementById("customer-modal");
  if (modal) {
    modal.classList.add("hidden");
  }
};





document.getElementById("customer-modal")?.addEventListener("click", (e) => {
  if (e.target.id === "customer-modal") {
    closeCustomerModal();
  }
});

async function loadDashboardMetrics() {
  try {
    const [summaryRes, topRes, stockRes, topCustRes] = await Promise.allSettled([
      apiFetch("/analytics/summary"),
      apiFetch("/analytics/top-products"),
      apiFetch("/stock_faible"),
      apiFetch("/customers/stats/top-customer")
    ]);

    const summary = summaryRes.status === "fulfilled" ? summaryRes.value : null;
    const topProducts = (topRes.status === "fulfilled" && Array.isArray(topRes.value)) ? topRes.value : [];
    const lowStock = (stockRes.status === "fulfilled" && Array.isArray(stockRes.value)) ? stockRes.value : [];
    const topCustomer = topCustRes.status === "fulfilled" ? topCustRes.value : null;

    const salesEl = document.getElementById("kpi-sales");
    if (salesEl) salesEl.textContent = `${summary?.total_ventes || 0} DH`;

    const profitEl = document.getElementById("kpi-profit");
    if (profitEl) profitEl.textContent = `${summary?.benefice_total_net || 0} DH`;

    const ordersEl = document.getElementById("kpi-orders");
    if (ordersEl) ordersEl.textContent = summary?.nbr_commande || 0;

    const bestProd = topProducts[0];
    const bestProdName = bestProd?._id?.nom_produit || "Aucun";
    const bestProdQty = bestProd?.quantite_total_vendus || 0;

    const prodNameEl = document.getElementById("top-product-name");
    if (prodNameEl) prodNameEl.textContent = bestProdName;

    const prodQtyEl = document.getElementById("top-product-qty");
    if (prodQtyEl) prodQtyEl.textContent = `${bestProdQty} unités vendues`;

    const custNameEl = document.getElementById("top-customer-name");
    const custOrdersEl = document.getElementById("top-customer-orders");

    if (topCustomer && topCustomer.client) {
      if (custNameEl) custNameEl.textContent = topCustomer.client.full_name || "Client";
      if (custOrdersEl) custOrdersEl.textContent = `${topCustomer.nbr_commande || 0} commandes`;
    } else {
      if (custNameEl) custNameEl.textContent = "Aucun";
      if (custOrdersEl) custOrdersEl.textContent = "0 commande";
    }

    const stockContainer = document.getElementById("low-stock-list");
    if (stockContainer) {
      if (lowStock.length === 0) {
        stockContainer.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">Aucun produit en stock faible.</p>`;
      } else {
        stockContainer.innerHTML = lowStock.map(p => `
          <div class="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm text-xs">
            <span class="font-bold text-slate-800">${p.nom}</span>
            <span class="px-2.5 py-1 bg-rose-50 text-rose-600 rounded-lg font-bold border border-rose-100">
              Reste: ${p.stock_quantity ?? 0}
            </span>
          </div>
        `).join("");
      }
    }

  } catch (err) {
    console.error("Erreur dashboard:", err);
  }
}

async function loadTeam() {
  const tbody = document.getElementById("team-table");
  const countBadge = document.getElementById("team-count");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-6 text-center text-slate-400 text-sm">Chargement...</td></tr>`;

  try {
    const users = await apiFetch("/users");
    if (!users || !Array.isArray(users)) return;

    if (countBadge) countBadge.textContent = `${users.length} admin${users.length > 1 ? "s" : ""}`;

    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-6 text-center text-slate-400 text-sm">Aucun administrateur trouvé.</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => `
      <tr class="hover:bg-slate-50 border-b border-slate-100 transition text-sm">
        <td class="px-6 py-4 font-mono text-xs text-slate-400">#${String(u._id).slice(-6)}</td>
        <td class="px-6 py-4 font-medium text-slate-800">${u.email}</td>
        <td class="px-6 py-4">
          <span class="px-2.5 py-1 bg-teal-50 text-teal-700 text-xs font-bold rounded-lg border border-teal-100">
            Administrateur
          </span>
        </td>
        <td class="px-6 py-4 text-right">
          <button onclick="deleteTeamMember('${u._id}')" class="text-slate-400 hover:text-rose-600 p-1.5 transition" title="Supprimer">
            <i class="ph ph-trash text-lg"></i>
          </button>
        </td>
      </tr>
    `).join("");

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-6 text-center text-rose-500 text-sm">${err.message}</td></tr>`;
  }
}

async function handleCreateTeamMember(e) {
  e.preventDefault();
  const email = document.getElementById("team-email").value.trim();
  const password = document.getElementById("team-password").value;

  try {
    await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    document.getElementById("team-form").reset();
    loadTeam();
  } catch (err) {
    alert("Erreur lors de l'ajout : " + err.message);
  }
}

async function deleteTeamMember(id) {
  if (!confirm("Voulez-vous vraiment supprimer cet administrateur ?")) return;
  try {
    await apiFetch(`/users/${id}`, { method: "DELETE" });
    loadTeam();
  } catch (err) {
    alert("Erreur de suppression : " + err.message);
  }
}
window.chargerPourModifier = function(id, nom, cat, pa, pv, stock) {
  let hidden = document.getElementById("edit-prod-id");
  if (!hidden) {
    hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.id = "edit-prod-id";
    const form = document.getElementById("product-form") || document.querySelector("form");
    if (form) form.appendChild(hidden);
  }
  if (hidden) hidden.value = id || "";

  const setVal = (idOrSelector, val) => {
    const el = document.getElementById(idOrSelector) || document.querySelector(idOrSelector);
    if (el) el.value = (val !== undefined && val !== null && val !== "undefined") ? val : "";
  };

  setVal("prod-name", nom);
  setVal("input[placeholder*='Nom']", nom);

  setVal("prod-cat", cat);
  setVal("input[placeholder*='Catég']", cat);

  setVal("prod-pa", pa);
  setVal("input[placeholder*='Achat']", pa);

  setVal("prod-pv", pv);
  setVal("input[placeholder*='Vente']", pv);

  setVal("prod-stock", stock);
  setVal("input[placeholder*='Stock']", stock);

  const btn = document.getElementById("btn-save-prod") || document.querySelector("#product-form button[type='submit']");
  if (btn) {
    btn.innerText = "Mettre à jour le produit";
    btn.style.backgroundColor = "#2563EB"; 
  }

  const cancelBtn = document.getElementById("btn-cancel-prod");
  if (cancelBtn) cancelBtn.classList.remove("hidden");

  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.annulerModification = function() {
  document.getElementById("edit-prod-id").value = "";
  document.getElementById("product-form").reset();

  const title = document.getElementById("product-form-title");
  if (title) title.innerHTML = '<i class="ph ph-plus-circle text-teal-600 mr-2"></i>Ajouter un Produit';
  
  const btn = document.getElementById("btn-save-prod");
  if (btn) {
    btn.textContent = "Enregistrer le produit";
    btn.className = "flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition";
  }
  
  const cancelBtn = document.getElementById("btn-cancel-prod");
  if (cancelBtn) cancelBtn.classList.add("hidden");
};
window.initDashboard = function() {
  if (typeof loadDashboardMetrics === "function") loadDashboardMetrics();
};