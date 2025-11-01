// Logique du dashboard avec protection d'accès - Boutique de Maïs

// Vérification de session au chargement de la page
window.addEventListener('DOMContentLoaded', async function() {
    await checkPageAccess();
    await displayUserInfo();
    displayLogs();
});

// Fonction pour vérifier l'accès à la page
// SÉCURITÉ: Plus aucune variable globale pour bypass - vérification stricte obligatoire
async function checkPageAccess() {
    const session = await checkSession();
    
    // Vérification de session obligatoire - aucune exception
    if (!session) {
        // Pas de session valide, redirection vers la page de connexion
        alert("Session expirée ou invalide. Veuillez vous reconnecter.");
        window.location.href = 'index.html';
        return;
    }
    
    // Affichage selon le rôle de la session
    displayContentByRole(session.role);
}

// Affichage des informations utilisateur
async function displayUserInfo() {
    const session = await checkSession();
    
    if (!session) return;
    
    // Affichage du badge utilisateur
    const badge = document.getElementById('userBadge');
    const roleText = session.role.charAt(0).toUpperCase() + session.role.slice(1);
    badge.textContent = `${session.username} (${roleText})`;
    badge.classList.add('badge-' + session.role);
}

// Affichage du contenu selon le rôle
function displayContentByRole(role) {
    // Contenu pour les vendeurs
    if (role === 'agent' || role === 'admin') {
        document.getElementById('agentContent').style.display = 'block';
    }
    
    // Contenu pour les admins uniquement
    if (role === 'admin') {
        document.getElementById('adminContent').style.display = 'block';
    }
}

// Fonction de recherche de produits (avec protection anti-injection)
async function searchProduct() {
    const searchInput = document.getElementById('searchInput').value;
    const resultsDiv = document.getElementById('searchResults');
    
    // Vérification de session avant recherche
    const session = await checkSession();
    if (!session) {
        alert("Session expirée!");
        await logout();
        return;
    }
    
    // Vérification des droits (tous peuvent chercher) - session déjà vérifiée ci-dessus
    
    // Sanitization de l'input (protection contre injection SQL)
    const sanitizedInput = sanitizeInput(searchInput);
    
    // Simulation de recherche dans la base de données des produits
    // En production: cette requête serait faite côté serveur
    const results = simulateProductSearch(sanitizedInput);
    
    if (results.length > 0) {
        let html = '<div class="results"><strong>Produits trouvés:</strong><ul>';
        results.forEach((product, idx) => {
            html += `<li>
                        <strong>${product.name}</strong> - ${product.price.toFixed(2)}€ - Stock: ${product.stock}
                        <button class="add-cart-btn" data-name="${encodeURIComponent(product.name)}" data-price="${product.price}" data-stock="${product.stock}" onclick="addToCartFromData(this)">Ajouter au panier</button>
                    </li>`;
        });
        html += '</ul></div>';
        resultsDiv.innerHTML = html;
    } else {
        resultsDiv.innerHTML = '<div class="results">Aucun produit trouvé.</div>';
    }
}

// Simulation de recherche de produits (remplace une vraie requête SQL)
function simulateProductSearch(query) {
    // Base de données des produits (simulation)
    const products = [
        { name: "Maïs sucré", type: "sucré", price: 2.50, stock: 50 },
        { name: "Maïs à pop-corn", type: "pop", price: 1.80, stock: 30 },
        { name: "Maïs bio", type: "bio", price: 3.20, stock: 25 },
        { name: "Maïs grillé", type: "grillé", price: 4.00, stock: 15 }
    ];
    
    const results = [];
    
    // Recherche simple (simulation de requête SQL)
    // ATTENTION: C'est ici qu'on aurait une vraie requête SQL en production
    // Exemple de ce qu'on NE devrait PAS faire: "SELECT * FROM products WHERE name LIKE '%" + query + "%'"
    // Bonne pratique: utiliser des requêtes préparées avec placeholders
    
    for (let product of products) {
        if (product.name.toLowerCase().includes(query.toLowerCase()) || 
            product.type.toLowerCase().includes(query.toLowerCase()) || 
            query === '') {
            results.push(product);
        }
    }
    
    return results;
}

// --- Fonctions du panier ---
const CART_KEY = 'cart_items_benzothana';

function getCart() {
    try {
        const raw = localStorage.getItem(CART_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartCount();
}

function addToCart(item) {
    const cart = getCart();
    // Cherche si l'article existe déjà
    const existing = cart.find(ci => ci.name === item.name);
    if (existing) {
        existing.qty = Math.min(existing.qty + (item.qty || 1), item.stock || 9999);
    } else {
        cart.push({ name: item.name, price: Number(item.price), qty: item.qty || 1, stock: item.stock || 9999 });
    }
    saveCart(cart);
    alert(`${item.name} ajouté au panier`);
}

function addToCartFromData(btn) {
    const name = decodeURIComponent(btn.dataset.name);
    const price = parseFloat(btn.dataset.price);
    const stock = parseInt(btn.dataset.stock, 10);
    addToCart({ name, price, stock, qty: 1 });
}

function renderCart() {
    const cart = getCart();
    const container = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotal');
    if (!container || !totalEl) return;

    if (cart.length === 0) {
        container.innerHTML = '<div class="cart-empty">Votre panier est vide.</div>';
        totalEl.textContent = '0.00';
        return;
    }

    let html = '<ul>';
    let total = 0;
    cart.forEach((item, idx) => {
        const itemTotal = item.price * item.qty;
        total += itemTotal;
        html += `<li class="cart-item">
                    <div class="cart-item-info">
                        <strong>${item.name}</strong>
                        <div>${item.price.toFixed(2)}€ x <input type="number" min="1" max="${item.stock}" value="${item.qty}" data-idx="${idx}" onchange="changeQty(this)"></div>
                    </div>
                    <div class="cart-item-actions">
                        <div>${itemTotal.toFixed(2)}€</div>
                        <button onclick="removeFromCart(${idx})">Supprimer</button>
                    </div>
                 </li>`;
    });
    html += '</ul>';
    container.innerHTML = html;
    totalEl.textContent = total.toFixed(2);
}

function updateCartCount() {
    const count = getCart().reduce((s, it) => s + it.qty, 0);
    const el = document.getElementById('cartCount');
    if (el) el.textContent = count;
}

function toggleCart() {
    const modal = document.getElementById('cartModal');
    if (!modal) return;
    if (modal.style.display === 'none' || modal.style.display === '') {
        renderCart();
        modal.style.display = 'block';
    } else {
        modal.style.display = 'none';
    }
}

function removeFromCart(idx) {
    const cart = getCart();
    if (idx < 0 || idx >= cart.length) return;
    cart.splice(idx, 1);
    saveCart(cart);
    renderCart();
}

function changeQty(input) {
    const idx = parseInt(input.dataset.idx, 10);
    let val = parseInt(input.value, 10) || 1;
    const cart = getCart();
    if (!cart[idx]) return;
    val = Math.max(1, Math.min(cart[idx].stock, val));
    cart[idx].qty = val;
    saveCart(cart);
    renderCart();
}

function checkout() {
    const cart = getCart();
    if (cart.length === 0) {
        alert('Panier vide');
        return;
    }
    // Simulation de commande: en production appeler une API
    alert('Commande simulée. Total: ' + document.getElementById('cartTotal').textContent + '€');
    // Vider le panier après commande simulée
    saveCart([]);
    renderCart();
    toggleCart();
}

// Mise à jour du compteur au chargement
window.addEventListener('DOMContentLoaded', updateCartCount);

// Affichage des logs de sécurité
function displayLogs() {
    const logs = getLogs();
    const logsContainer = document.getElementById('logsContainer');
    
    if (!logsContainer) return;
    
    if (logs.length === 0) {
        logsContainer.innerHTML = '<div style="padding:15px;font-size:14px;color:#95a5a6;">Aucun log enregistré</div>';
        return;
    }
    
    let html = '';
    // Afficher les logs du plus récent au plus ancien
    logs.slice().reverse().forEach(log => {
        let color = '#ecf0f1';
        if (log.type === 'success') color = '#2ecc71';
        if (log.type === 'error') color = '#e74c3c';
        if (log.type === 'warning') color = '#f39c12';
        
        html += `<div style="margin-bottom:8px;padding:8px;border-left:3px solid ${color};background:rgba(255,255,255,0.05);">`;
        html += `<span style="color:#95a5a6;font-size:12px;">[${log.timestamp}]</span> `;
        html += `<span style="color:${color};font-weight:bold;">${log.message}</span>`;
        html += `</div>`;
    });
    
    logsContainer.innerHTML = html;
}

// Vérification automatique de session toutes les 30 secondes
setInterval(async function() {
    const session = await checkSession();
    if (!session) {
        alert("Votre session a expiré pour des raisons de sécurité.");
        await logout();
    }
}, 30000);
