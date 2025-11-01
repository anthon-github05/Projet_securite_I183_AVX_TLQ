// Logique de la page admin avec protection stricte

// Vérification de session au chargement
window.addEventListener('DOMContentLoaded', async function() {
    await checkAdminAccess();
    await displayUserInfo();
    displayLogs();
});

// Fonction pour vérifier l'accès admin
// SÉCURITÉ: Plus aucune variable globale pour bypass - protection stricte
async function checkAdminAccess() {
    // Vérification de session obligatoire
    const session = await checkSession();
    
    if (!session) {
        alert("Session expirée ou invalide.");
        window.location.href = 'index.html';
        return;
    }
    
    // Vérification du rôle admin (protection stricte)
    if (session.role !== 'admin') {
        alert("❌ Accès refusé: Cette page est réservée aux administrateurs.");
        window.location.href = 'dashboard.html';
        return;
    }
    
    // Log de l'accès admin (bonne pratique pour audit)
    console.log("Accès admin autorisé pour: " + session.username);
    addLog(`Accès à la page admin: ${session.username}`, 'info');
}

// Affichage des informations utilisateur
async function displayUserInfo() {
    const session = await checkSession();
    
    if (!session) return;
    
    const badge = document.getElementById('userBadge');
    const isHiddenAdmin = session.username === 'elliot.gabiout' && session.role === 'admin';
    if (isHiddenAdmin) {
        badge.textContent = `${session.username}`;
        badge.classList.add('badge-client');
    } else {
        badge.textContent = `${session.username} (Admin)`;
        badge.classList.add('badge-admin');
    }
}

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
