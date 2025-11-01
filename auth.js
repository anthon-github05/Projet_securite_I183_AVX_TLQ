// Système d'authentification simple avec protection de session
// ATTENTION: En production, utilisez un vrai backend avec JWT ou sessions sécurisées

// Base de données client pour les utilisateurs: IndexedDB
const DB_NAME = 'benzothana_users_db';
const DB_VERSION = 1;
const USERS_STORE = 'users';

let _dbPromise = null;

function openUsersDb() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(USERS_STORE)) {
                db.createObjectStore(USERS_STORE, { keyPath: 'username' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return _dbPromise;
}

async function dbGetUser(username) {
    const db = await openUsersDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(USERS_STORE, 'readonly');
        const store = tx.objectStore(USERS_STORE);
        const req = store.get(username);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}

async function dbPutUser(user) {
    const db = await openUsersDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(USERS_STORE, 'readwrite');
        const store = tx.objectStore(USERS_STORE);
        const req = store.put(user);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
    });
}

async function dbHasAdmin() {
    const db = await openUsersDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(USERS_STORE, 'readonly');
        const store = tx.objectStore(USERS_STORE);
        const req = store.openCursor();
        let found = false;
        req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor) return resolve(found);
            const val = cursor.value;
            if (val && val.role === 'admin') {
                found = true;
                return resolve(true);
            }
            cursor.continue();
        };
        req.onerror = () => reject(req.error);
    });
}

function toHex(buffer) {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromString(str) {
    return new TextEncoder().encode(str);
}

function randomSalt(length = 16) {
    const salt = new Uint8Array(length);
    crypto.getRandomValues(salt);
    return toHex(salt);
}

async function hashPassword(password, saltHex) {
    const data = fromString(saltHex + ':' + password);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return toHex(digest);
}

// Ne crée aucun compte par défaut afin d'éviter d'exposer des identifiants en clair
// Exception contrôlée: création d'un compte admin spécifique si absent
async function ensureDefaultUsers() {
    // Compte elliot.gabiout (admin principal)
    const username1 = 'elliot.gabiout';
    const existing1 = await dbGetUser(username1);
    if (!existing1) {
        const salt1 = randomSalt();
        const password1 = 'md5-0Fg-2i@N';
        const passwordHash1 = await hashPassword(password1, salt1);
        await dbPutUser({ username: username1, passwordHash: passwordHash1, salt: salt1, role: 'admin', email: 'elliot.gabiout@example.com' });
    }
    
    // Compte M.Benzonana (client)
    const username2 = 'M.Benzonana';
    const existing2 = await dbGetUser(username2);
    if (!existing2) {
        const salt2 = randomSalt();
        const password2 = 'CPNV-ST-03';
        const passwordHash2 = await hashPassword(password2, salt2);
        await dbPutUser({ username: username2, passwordHash: passwordHash2, salt: salt2, role: 'client', email: 'M.Benzonana@example.com' });
    }
}

// Système de logging des tentatives de connexion
const LOG_KEY = 'security_logs_benzothana';
const MAX_LOGS = 100;

function addLog(message, type = 'info') {
    let logs = getLogs();
    const timestamp = new Date().toLocaleString('fr-FR', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
    
    logs.push({
        timestamp,
        message,
        type // info, success, error, warning
    });
    
    // Garder seulement les derniers 100 logs
    if (logs.length > MAX_LOGS) {
        logs = logs.slice(-MAX_LOGS);
    }
    
    localStorage.setItem(LOG_KEY, JSON.stringify(logs));
}

function getLogs() {
    try {
        const raw = localStorage.getItem(LOG_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function clearLogs() {
    localStorage.removeItem(LOG_KEY);
}

// Fonction de protection basique contre injection SQL (simulée côté client)
// EN RÉALITÉ: Cette protection doit être faite côté serveur
// SÉCURITÉ: Protection toujours active - aucune possibilité de désactivation

function sanitizeInput(input) {
    // Protection toujours active - aucune variable globale pour bypass
    // Suppression des caractères dangereux obligatoire
    
    // Protection basique: on supprime les caractères dangereux
    let sanitized = input.trim();
    
    // On filtre les caractères spéciaux SQL communs
    const dangerousChars = ["'", '"', ';', '--', '/*', '*/', 'xp_', 'sp_'];
    for (let char of dangerousChars) {
        if (sanitized.includes(char)) {
            // Pas de throw, on va juste logger (faute commune d'étudiant moyen)
            console.log("Tentative d'injection détectée: " + char);
            addLog(`Tentative d'injection SQL détectée: ${char}`, 'warning');
            sanitized = sanitized.replace(char, '');
        }
    }
    
    return sanitized;
}

// Fonction de validation de mot de passe (très basique)
async function validatePassword(username, password) {
    // Sanitize pour éviter les injections
    username = sanitizeInput(username);
    password = sanitizeInput(password);
    
    const user = await dbGetUser(username);
    if (!user) return null;
    const computed = await hashPassword(password, user.salt);
    if (computed === user.passwordHash) {
        return user;
    }
    return null;
}

// Gestion de la connexion
document.addEventListener('DOMContentLoaded', function() {
    // Initialiser la base avec des comptes tests (hachés)
    ensureDefaultUsers();
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorMsg = document.getElementById('errorMessage');
            
            // Validation des champs (protection basique)
            if (!username || !password) {
                errorMsg.textContent = "Veuillez remplir tous les champs";
                return;
            }
            
            // Authentification (comparaison avec hash)
            const user = await validatePassword(username, password);
            
            if (user) {
                // Stockage de la session (localStorage - pas super sécurisé mais ok pour demo)
                // EN PRODUCTION: Utilisez des tokens JWT avec httpOnly cookies
                const sessionData = {
                    username: username,
                    role: user.role,
                    loginTime: Date.now(),
                    // On met un timestamp pour expiration basique
                    expires: Date.now() + (30 * 60 * 1000) // 30 minutes
                };
                
                // Ajout d'une signature basique pour vérifier l'intégrité de la session
                // (ne remplace pas un vrai backend, mais rend la modification plus difficile)
                const sessionString = JSON.stringify(sessionData);
                const sessionHash = await hashPassword(sessionString + user.salt, user.salt);
                sessionData.signature = sessionHash;
                
                localStorage.setItem('session', JSON.stringify(sessionData));
                
                // Logger la connexion réussie
                addLog(`Connexion réussie: ${username} (${user.role})`, 'success');
                
                // Redirection vers le dashboard
                window.location.href = 'dashboard.html';
            } else {
                errorMsg.textContent = "Identifiant ou mot de passe faux";
                // Logger la tentative échouée
                addLog(`Tentative de connexion échouée: ${username}`, 'error');
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const suUsername = document.getElementById('su_username').value.trim();
            const suEmail = document.getElementById('su_email').value.trim();
            const suPassword = document.getElementById('su_password').value;
            const suConfirm = document.getElementById('su_confirm').value;
            const msg = document.getElementById('signupMessage');
            msg.style.color = 'red';
            msg.textContent = '';
            
            if (!suUsername || !suEmail || !suPassword || !suConfirm) {
                msg.textContent = 'Veuillez remplir tous les champs';
                return;
            }
            if (suPassword !== suConfirm) {
                msg.textContent = 'Les mots de passe ne correspondent pas';
                return;
            }
            if (suPassword.length < 6) {
                msg.textContent = 'Le mot de passe doit contenir au moins 6 caractères';
                return;
            }
            const existing = await dbGetUser(suUsername);
            if (existing) {
                msg.textContent = 'Ce nom d\'utilisateur existe déjà';
                return;
            }
            const salt = randomSalt();
            const passwordHash = await hashPassword(suPassword, salt);
            const hasAdmin = await dbHasAdmin();
            const role = hasAdmin ? 'client' : 'admin';
            await dbPutUser({ username: suUsername, passwordHash, salt, role, email: suEmail });
            
            // Logger la création de compte
            addLog(`Nouveau compte créé: ${suUsername} (${role})`, 'success');
            
            msg.style.color = 'green';
            msg.textContent = hasAdmin ? 'Compte créé. Vous pouvez vous connecter.' : 'Compte admin initial créé. Vous pouvez vous connecter.';
            // Reset minimal
            signupForm.reset();
        });
    }
});

// Fonction pour vérifier si la session est valide
async function checkSession() {
    const session = localStorage.getItem('session');
    
    if (!session) {
        return null;
    }
    
    try {
        const sessionData = JSON.parse(session);
        
        // Vérifier l'expiration (protection basique contre sessions éternelles)
        if (Date.now() > sessionData.expires) {
            localStorage.removeItem('session');
            return null;
        }
        
        // Vérifier l'intégrité de la session si une signature existe
        if (sessionData.signature && sessionData.username) {
            // Récupérer l'utilisateur pour obtenir son salt
            const user = await dbGetUser(sessionData.username);
            if (user) {
                // Recréer la session sans la signature pour vérifier
                const sessionCopy = { ...sessionData };
                delete sessionCopy.signature;
                const sessionString = JSON.stringify(sessionCopy);
                const expectedHash = await hashPassword(sessionString + user.salt, user.salt);
                
                // Si la signature ne correspond pas, la session a été modifiée
                if (expectedHash !== sessionData.signature) {
                    console.warn("⚠️ Session modifiée détectée - déconnexion forcée");
                    localStorage.removeItem('session');
                    addLog(`Tentative d'accès avec session modifiée détectée: ${sessionData.username}`, 'error');
                    return null;
                }
            }
        }
        
        return sessionData;
    } catch (e) {
        // Si le parse échoue, on supprime et retourne null
        localStorage.removeItem('session');
        return null;
    }
}

// Fonction pour vérifier les droits d'accès
async function checkAccess(requiredRole) {
    const session = await checkSession();
    
    if (!session) {
        return false;
    }
    
    // Système de droits hiérarchique simple
    const roleLevel = {
        'client': 1,
        'agent': 2,
        'admin': 3
    };
    
    return roleLevel[session.role] >= roleLevel[requiredRole];
}

// Fonction de déconnexion
async function logout() {
    const session = await checkSession();
    if (session) {
        addLog(`Déconnexion: ${session.username}`, 'info');
    }
    localStorage.removeItem('session');
    window.location.href = 'index.html';
}

