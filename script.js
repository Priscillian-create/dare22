// ===================================================================
// 1. INITIALIZATION & CONFIGURATION
// ===================================================================

// Initialize Supabase with your configuration
const supabaseUrl = 'https://qgayglybnnrhobcvftrs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnYXlnbHlibm5yaG9iY3ZmdHJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2ODQ5ODMsImV4cCI6MjA3ODI2MDk4M30.dqiEe-v1cro5N4tuawu7Y1x5klSyjINsLHd9-V40QjQ';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Core data structures
const sections = ['grill', 'wholesale', 'building', 'food'];
const sectionNames = {
    'grill': 'Grill',
    'wholesale': 'Wholesale',
    'building': 'Building Material',
    'food': 'Food Supplies'
};

// Initialize empty data containers
const inventory = { 'grill': [], 'wholesale': [], 'building': [], 'food': [] };
const carts = { 'grill': [], 'wholesale': [], 'building': [], 'food': [] };
const suppliers = { 'grill': [], 'wholesale': [], 'building': [], 'food': [] };
const purchaseOrders = { 'grill': [], 'wholesale': [], 'building': [], 'food': [] };

// Initialize summary data with default values
const salesData = {
    'grill': { totalSales: 0, totalTransactions: 0, avgTransaction: 0, topItem: '-', dailySales: 0, dailyTransactions: 0, profit: 0, profitMargin: 0 },
    'wholesale': { totalSales: 0, totalTransactions: 0, avgTransaction: 0, topItem: '-', dailySales: 0, dailyTransactions: 0, profit: 0, profitMargin: 0 },
    'building': { totalSales: 0, totalTransactions: 0, avgTransaction: 0, topItem: '-', dailySales: 0, dailyTransactions: 0, profit: 0, profitMargin: 0 },
    'food': { totalSales: 0, totalTransactions: 0, avgTransaction: 0, topItem: '-', dailySales: 0, dailyTransactions: 0, profit: 0, profitMargin: 0 }
};
const purchaseData = {
    'grill': { totalPurchases: 0, totalTransactions: 0, avgTransaction: 0, topSupplier: '-', dailyPurchases: 0, dailyTransactions: 0 },
    'wholesale': { totalPurchases: 0, totalTransactions: 0, avgTransaction: 0, topSupplier: '-', dailyPurchases: 0, dailyTransactions: 0 },
    'building': { totalPurchases: 0, totalTransactions: 0, avgTransaction: 0, topSupplier: '-', dailyPurchases: 0, dailyTransactions: 0 },
    'food': { totalPurchases: 0, totalTransactions: 0, avgTransaction: 0, topSupplier: '-', dailyPurchases: 0, dailyTransactions: 0 }
};
const userData = {
    'grill': { transactions: 0, sales: 0, purchases: 0 },
    'wholesale': { transactions: 0, sales: 0, purchases: 0 },
    'building': { transactions: 0, sales: 0, purchases: 0 },
    'food': { transactions: 0, sales: 0, purchases: 0 }
};

// State management
let currentSection = 'grill';
let currentView = 'pos';
let currentFilter = 'all';
let currentUser = null;


// ===================================================================
// 2. HELPER FUNCTIONS & LOCAL STORAGE
// ===================================================================

// Generate unique ID for offline records
function generateOfflineId() {
    return 'offline_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Local Storage helpers
function saveToLocalStorage(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } 
    catch (e) { console.error('Error saving to localStorage:', e); }
}

function loadFromLocalStorage(key, defaultValue = null) {
    try { const data = localStorage.getItem(key); return data ? JSON.parse(data) : defaultValue; } 
    catch (e) { console.error('Error loading from localStorage:', e); return defaultValue; }
}

// Load all data from localStorage on startup
function loadDataFromLocalStorage() {
    sections.forEach(section => {
        inventory[section] = loadFromLocalStorage(`inventory_${section}`, []);
        carts[section] = loadFromLocalStorage(`cart_${section}`, []);
        suppliers[section] = loadFromLocalStorage(`suppliers_${section}`, []);
        purchaseOrders[section] = loadFromLocalStorage(`purchaseOrders_${section}`, []);
        salesData[section] = loadFromLocalStorage(`salesData_${section}`, salesData[section]);
        purchaseData[section] = loadFromLocalStorage(`purchaseData_${section}`, purchaseData[section]);
        userData[section] = loadFromLocalStorage(`userData_${section}`, userData[section]);
    });
}

// Product status helpers
function isExpired(expiryDate) {
    if (!expiryDate) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    return expiry < today;
}

function isExpiringSoon(expiryDate) {
    if (!expiryDate) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffTime > 0 && diffDays <= 7;
}

function getProductStatus(item) {
    if (isExpired(item.expiry_date)) return 'expired';
    if (isExpiringSoon(item.expiry_date)) return 'expiring-soon';
    if (item.stock === 0) return 'out-of-stock';
    if (item.stock < 10) return 'low-stock';
    return 'in-stock';
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
}

// --- CRITICAL FIX: Data Cleaning for Supabase ---
function cleanDataForSupabase(table, data) {
    let cleaned = { ...data };
    delete cleaned.isOffline;
    delete cleaned.timestamp;
    delete cleaned.userId;

    if (table === 'inventory') {
        const { section, name, price, cost, stock, expiry_date, description, status, created_by, created_at, updated_by, updated_at, deleted, deleted_at } = cleaned;
        cleaned = { section, name, price, cost, stock, expiry_date, description, status, created_by, created_at, updated_by, updated_at, deleted, deleted_at };
    } else if (table === 'sales') {
        const { user_id, user_email, section, items, subtotal, total, totalCost, totalProfit, profitMargin, payment_method, customer_name, customer_phone, timestamp } = cleaned;
        cleaned = { user_id, user_email, section, items, subtotal, total, totalCost, totalProfit, profitMargin, payment_method, customer_name, customer_phone, timestamp };
    } else if (table === 'sales_data') {
        const { id, totalSales, totalTransactions, avgTransaction, dailySales, dailyTransactions } = cleaned;
        cleaned = { id, totalsales: totalSales, totaltransactions: totalTransactions, avgtransactions: avgTransaction, dailysales: dailySales, dailytransactions: dailyTransactions };
    } else if (table === 'purchase_data') {
        const { id, totalPurchases, totalTransactions, avgTransaction, topSupplier, dailyPurchases, dailyTransactions } = cleaned;
        cleaned = { id, totalpurchases: totalPurchases, totaltransactions: totalTransactions, avgtransaction: avgTransaction, topsupplier: topSupplier, dailypurchases: dailyPurchases, dailytransactions: dailyTransactions };
    } else if (table === 'user_data') {
        const { id, transactions, sales, purchases } = cleaned;
        cleaned = { id, transactions, sales, purchases };
    }
    // Add cleaning for other tables (suppliers, purchase_orders) as needed
    return cleaned;
}


// ===================================================================
// 3. SUPABASE INTERACTION
// ===================================================================

async function saveDataToSupabase(table, data, id = null) {
    const dataWithMetadata = {
        ...data,
        created_by: currentUser?.id || 'offline_user',
        updated_by: currentUser?.id || 'offline_user',
        updated_at: new Date().toISOString(),
    };

    // Save to localStorage immediately for offline access and responsive UI
    const localKey = `${table}_${id || 'new'}`;
    saveToLocalStorage(localKey, dataWithMetadata);

    // Update local state immediately
    if (table === 'inventory') {
        if (!id) {
            id = generateOfflineId();
            dataWithMetadata.id = id;
            dataWithMetadata.isOffline = true;
            inventory[data.section].push(dataWithMetadata);
        } else {
            const index = inventory[data.section].findIndex(item => item.id === id);
            if (index !== -1) inventory[data.section][index] = { ...inventory[data.section][index], ...dataWithMetadata };
        }
        saveToLocalStorage(`inventory_${data.section}`, inventory[data.section]);
        loadInventoryTable(data.section);
        updateDepartmentStats(data.section);
    }
    // ... add local state updates for other tables as needed

    // If online, try to sync with Supabase
    if (navigator.onLine) {
        try {
            let dataForSupabase = cleanDataForSupabase(table, dataWithMetadata);
            if (!id || id.startsWith('offline_')) delete dataForSupabase.id; // Let Supabase generate ID

            let result;
            if (id && !id.startsWith('offline_')) {
                const { data: res, error } = await supabase.from(table).update(dataForSupabase).eq('id', id).select();
                if (error) throw error; result = res[0];
            } else {
                const { data: res, error } = await supabase.from(table).insert(dataForSupabase).select();
                if (error) throw error; result = res[0];
            }
            console.log(`Successfully saved to ${table}:`, result);
            return result;
        } catch (error) {
            console.error(`Error saving to ${table}:`, error);
            showNotification(`Error saving to ${table}. Changes saved locally.`, 'warning');
            // Store for later sync
            const pendingChanges = loadFromLocalStorage('pendingChanges', {});
            if (!pendingChanges[table]) pendingChanges[table] = { new: [] };
            if (id && !id.startsWith('offline_')) pendingChanges[table][id] = dataWithMetadata;
            else pendingChanges[table].new.push(dataWithMetadata);
            saveToLocalStorage('pendingChanges', pendingChanges);
            return { id };
        }
    } else {
        // Store for later sync when offline
        const pendingChanges = loadFromLocalStorage('pendingChanges', {});
        if (!pendingChanges[table]) pendingChanges[table] = { new: [] };
        if (id && !id.startsWith('offline_')) pendingChanges[table][id] = dataWithMetadata;
        else pendingChanges[table].new.push(dataWithMetadata);
        saveToLocalStorage('pendingChanges', pendingChanges);
        return { id };
    }
}

async function syncPendingChanges() {
    if (!navigator.onLine) return;
    const pendingChanges = loadFromLocalStorage('pendingChanges', {});
    if (Object.keys(pendingChanges).length === 0) return;

    console.log('Syncing pending changes...');
    const syncStatus = document.getElementById('syncStatus'); if (syncStatus) syncStatus.classList.add('show');

    const promises = [];
    Object.keys(pendingChanges).forEach(table => {
        // Sync new records
        if (pendingChanges[table].new?.length > 0) {
            pendingChanges[table].new.forEach(data => {
                let dataForSupabase = cleanDataForSupabase(table, data);
                delete dataForSupabase.id; // Supabase will create it
                promises.push(supabase.from(table).insert(dataForSupabase).select());
            });
        }
        // Sync updated records
        Object.keys(pendingChanges[table]).forEach(id => {
            if (id !== 'new' && pendingChanges[table][id]) {
                const data = pendingChanges[table][id];
                let dataForSupabase = cleanDataForSupabase(table, data);
                promises.push(supabase.from(table).update(dataForSupabase).eq('id', id).select());
            }
        });
    });

    try {
        await Promise.all(promises);
        localStorage.removeItem('pendingChanges');
        if (syncStatus) syncStatus.classList.remove('show');
        showNotification('All changes synced successfully!', 'success');
        loadDataFromSupabase(); // Refresh data from server
    } catch (error) {
        console.error('Error syncing changes:', error);
        if (syncStatus) syncStatus.classList.remove('show');
        showNotification('Error syncing changes. Will try again later.', 'error');
    }
}

async function loadDataFromSupabase() {
    if (!navigator.onLine) { console.log('Offline mode, skipping Supabase load.'); return; }
    console.log('Loading data from Supabase...');

    sections.forEach(section => {
        // Load Inventory
        supabase.from('inventory').select('*').eq('section', section).eq('deleted', false).then(({ data, error }) => {
            if (error) { console.error(`Error loading ${section} inventory:`, error); showNotification(`Error loading ${section} inventory. Using local data.`, 'warning'); return; }
            inventory[section] = data || [];
            saveToLocalStorage(`inventory_${section}`, inventory[section]);
            loadInventoryTable(section);
            updateDepartmentStats(section);
        });
        // Load Suppliers
        supabase.from('suppliers').select('*').eq('section', section).eq('deleted', false).then(({ data, error }) => {
            if (error) { console.error(`Error loading ${section} suppliers:`, error); return; }
            suppliers[section] = data || [];
            saveToLocalStorage(`suppliers_${section}`, suppliers[section]);
            loadSuppliersTable(section);
        });
        // Load Purchase Orders
        supabase.from('purchase_orders').select('*').eq('section', section).eq('deleted', false).then(({ data, error }) => {
            if (error) { console.error(`Error loading ${section} purchase orders:`, error); return; }
            purchaseOrders[section] = data || [];
            saveToLocalStorage(`purchaseOrders_${section}`, purchaseOrders[section]);
            loadPurchaseOrdersTable(section);
        });

        // Load summary data (sales, purchase, user)
        supabase.from('sales_data').select('*').eq('id', section).single().then(({ data, error }) => {
            if (error && error.code !== 'PGRST116') { console.error(`Error loading ${section} sales data:`, error); return; }
            if (data) {
                salesData[section] = { totalSales: data.totalsales || 0, totalTransactions: data.totaltransactions || 0, avgTransaction: data.avgtransactions || 0, topItem: '-', dailySales: data.dailysales || 0, dailyTransactions: data.dailytransactions || 0, profit: 0, profitMargin: 0 };
                saveToLocalStorage(`salesData_${section}`, salesData[section]);
                updateReports(section);
            }
        });
        supabase.from('purchase_data').select('*').eq('id', section).single().then(({ data, error }) => {
            if (error && error.code !== 'PGRST116') { console.error(`Error loading ${section} purchase data:`, error); return; }
            if (data) {
                purchaseData[section] = { totalPurchases: data.totalpurchases || 0, totalTransactions: data.totaltransactions || 0, avgTransaction: data.avgtransaction || 0, topSupplier: data.topsupplier || '-', dailyPurchases: data.dailypurchases || 0, dailyTransactions: data.dailytransactions || 0 };
                saveToLocalStorage(`purchaseData_${section}`, purchaseData[section]);
                updatePurchaseReports(section);
            }
        });
        supabase.from('user_data').select('*').eq('id', section).single().then(({ data, error }) => {
            if (error && error.code !== 'PGRST116') { console.error(`Error loading ${section} user data:`, error); return; }
            if (data) {
                userData[section] = { transactions: data.transactions || 0, sales: data.sales || 0, purchases: data.purchases || 0 };
                saveToLocalStorage(`userData_${section}`, userData[section]);
                updateUserStats(section);
            }
        });
    });
    updateTotalInventory();
}


// ===================================================================
// 4. AUTHENTICATION & APP INITIALIZATION
// ===================================================================

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
        currentUser = session.user;
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        updateUserInfo(session.user);
        initializeApp(); // Initialize UI with local data first
        loadDataFromSupabase(); // Then fetch fresh data from server
        window.addEventListener('online', handleOnlineStatus);
        window.addEventListener('offline', handleOfflineStatus);
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }
});

// Update user info in the UI
function updateUserInfo(user) {
    const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Admin User';
    const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase();
    const userNameEl = document.getElementById('userName'); if (userNameEl) userNameEl.textContent = displayName;
    const userAvatarEl = document.getElementById('userAvatar'); if (userAvatarEl) userAvatarEl.textContent = initials;
}

// Handle online/offline status
function handleOnlineStatus() {
    const offlineIndicator = document.getElementById('offlineIndicator'); if (offlineIndicator) offlineIndicator.classList.remove('show');
    showNotification('Connection restored. Syncing data...', 'info');
    syncPendingChanges();
}

function handleOfflineStatus() {
    const offlineIndicator = document.getElementById('offlineIndicator'); if (offlineIndicator) offlineIndicator.classList.add('show');
    showNotification('You\'re now offline. Changes will be saved locally.', 'warning');
}

// Main app initialization
function initializeApp() {
    // Load data from localStorage first for a fast UI
    loadDataFromLocalStorage();

    // Set initial view
    showSection(currentSection);
    showView(currentView);

    // Load initial UI components for the current section
    loadInventoryTable(currentSection);
    updateCart(currentSection);
    updateReports(currentSection);
    updateUserStats(currentSection);
    updateDepartmentStats(currentSection);
    updateCategoryInventorySummary(currentSection);
    updateTotalInventory();

    // Initialize POS search
    initializePOSSearch(currentSection);
}

// Initialize POS search functionality
function initializePOSSearch(section) {
    const searchInput = document.getElementById(`${section}-search`);
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filterInventory(section, this.value);
        });
    }
}

// DOM Content Loaded event listener
document.addEventListener('DOMContentLoaded', function() {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            currentUser = session.user;
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';
            updateUserInfo(session.user);
            initializeApp();
            loadDataFromSupabase();
        } else {
            document.getElementById('loginScreen').style.display = 'flex';
            document.getElementById('mainApp').style.display = 'none';
        }
    });

    // Setup global event delegation
    setupEventDelegation();
});


// ===================================================================
// 5. UI UPDATE FUNCTIONS
// ===================================================================

function updateCart(section) {
    const cartItemsEl = document.getElementById(`${section}-cart-items`);
    const cartTotalEl = document.getElementById(`${section}-cart-total`);
    const cartCountEl = document.getElementById(`${section}-cart-count`);

    if (!cartItemsEl || !cartTotalEl || !cartCountEl) return;

    cartItemsEl.innerHTML = '';
    let total = 0;
    let itemCount = 0;

    carts[section].forEach(item => {
        total += item.total;
        itemCount += item.quantity;
        const itemEl = document.createElement('div');
        itemEl.className = 'cart-item';
        itemEl.innerHTML = `
            <span>${item.name} (x${item.quantity})</span>
            <span>₦${item.total.toFixed(2)}</span>
        `;
        cartItemsEl.appendChild(itemEl);
    });

    cartTotalEl.textContent = `₦${total.toFixed(2)}`;
    cartCountEl.textContent = itemCount;
}

function loadInventoryTable(section) {
    const tableBody = document.getElementById(`${section}-inventory-table-body`);
    if (!tableBody) { console.error(`Table body not found for section: ${section}`); return; }

    tableBody.innerHTML = '';
    let filteredInventory = inventory[section];

    if (currentFilter !== 'all') {
        filteredInventory = inventory[section].filter(item => getProductStatus(item) === currentFilter);
    }

    if (filteredInventory.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center">No items found.</td></tr>`;
        return;
    }

    filteredInventory.forEach(item => {
        const status = getProductStatus(item);
        const row = document.createElement('tr');
        row.className = `inventory-row status-${status}`;
        row.innerHTML = `
            <td>${item.name}</td>
            <td>₦${item.price.toFixed(2)}</td>
            <td>${item.stock}</td>
            <td>${formatDate(item.expiry_date)}</td>
            <td><span class="status-badge ${status}">${status.replace('-', ' ')}</span></td>
            <td class="actions">
                <button class="btn-small add-to-cart-btn" data-section="${section}" data-id="${item.id}">Add to Cart</button>
                <button class="btn-small edit-item-btn" data-section="${section}" data-id="${item.id}">Edit</button>
                <button class="btn-small delete-item-btn" data-section="${section}" data-id="${item.id}">Delete</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function loadSuppliersTable(section) {
    const tableBody = document.getElementById(`${section}-suppliers-table-body`);
    if (!tableBody) return;
    tableBody.innerHTML = '';
    if (suppliers[section].length === 0) { tableBody.innerHTML = `<tr><td colspan="4" class="text-center">No suppliers found.</td></tr>`; return; }
    suppliers[section].forEach(supplier => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${supplier.name}</td>
            <td>${supplier.phone || 'N/A'}</td>
            <td>${supplier.email || 'N/A'}</td>
            <td class="actions">
                <button class="btn-small edit-supplier-btn" data-section="${section}" data-id="${supplier.id}">Edit</button>
                <button class="btn-small delete-supplier-btn" data-section="${section}" data-id="${supplier.id}">Delete</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function loadPurchaseOrdersTable(section) {
    const tableBody = document.getElementById(`${section}-purchase-orders-table-body`);
    if (!tableBody) return;
    tableBody.innerHTML = '';
    if (purchaseOrders[section].length === 0) { tableBody.innerHTML = `<tr><td colspan="6" class="text-center">No purchase orders found.</td></tr>`; return; }
    purchaseOrders[section].forEach(order => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${order.orderNumber}</td>
            <td>${order.supplierName}</td>
            <td>${order.productName}</td>
            <td>${order.quantity}</td>
            <td>₦${order.total.toFixed(2)}</td>
            <td><span class="status-badge ${order.status}">${order.status}</span></td>
            <td class="actions">
                ${order.status === 'pending' ? `<button class="btn-small receive-order-btn" data-section="${section}" data-id="${order.id}">Receive</button>` : ''}
                <button class="btn-small edit-order-btn" data-section="${section}" data-id="${order.id}">Edit</button>
                <button class="btn-small delete-order-btn" data-section="${section}" data-id="${order.id}">Delete</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function updateReports(section) {
    const data = salesData[section];
    const reportCards = document.querySelectorAll(`#${section}-reports .report-card`);
    if (reportCards.length > 0) reportCards[0].querySelector('h3').textContent = `₦${data.totalSales.toFixed(2)}`;
    if (reportCards.length > 1) reportCards[1].querySelector('h3').textContent = data.totalTransactions;
    if (reportCards.length > 2) reportCards[2].querySelector('h3').textContent = `₦${data.avgTransaction.toFixed(2)}`;
    if (reportCards.length > 3) reportCards[3].querySelector('h3').textContent = `₦${data.profit.toFixed(2)}`;
}

function updatePurchaseReports(section) {
    const data = purchaseData[section];
    const reportCards = document.querySelectorAll(`#${section}-purchase-reports .report-card`);
    if (reportCards.length > 0) reportCards[0].querySelector('h3').textContent = `₦${data.totalPurchases.toFixed(2)}`;
    if (reportCards.length > 1) reportCards[1].querySelector('h3').textContent = data.totalTransactions;
    if (reportCards.length > 2) reportCards[2].querySelector('h3').textContent = `₦${data.avgTransaction.toFixed(2)}`;
}

function updateUserStats(section) {
    const data = userData[section];
    const profileStats = document.querySelectorAll(`#${section}-profile-stats .stat-value`);
    if (profileStats.length > 0) profileStats[0].textContent = data.transactions;
    if (profileStats.length > 1) profileStats[1].textContent = `₦${data.sales.toFixed(2)}`;
    if (profileStats.length > 2) profileStats[2].textContent = `₦${data.purchases.toFixed(2)}`;
}

function updateDepartmentStats(section) {
    const totalProducts = inventory[section].length;
    const totalValue = inventory[section].reduce((sum, item) => sum + (item.price * item.stock), 0);
    const lowStock = inventory[section].filter(item => item.stock < 10 && item.stock > 0).length;
    const outOfStock = inventory[section].filter(item => item.stock === 0).length;

    const statsCards = document.querySelectorAll(`#${section}-stats .stat-card`);
    if (statsCards.length > 0) statsCards[0].querySelector('h3').textContent = totalProducts;
    if (statsCards.length > 1) statsCards[1].querySelector('h3').textContent = `₦${totalValue.toFixed(2)}`;
    if (statsCards.length > 2) statsCards[2].querySelector('h3').textContent = lowStock;
    if (statsCards.length > 3) statsCards[3].querySelector('h3').textContent = outOfStock;
}

function updateCategoryInventorySummary(section) {
    let totalProducts = inventory[section].length;
    let totalValue = inventory[section].reduce((sum, item) => sum + (item.price * item.stock), 0);
    let totalCost = inventory[section].reduce((sum, item) => sum + ((item.cost || 0) * item.stock), 0);
    let totalProfit = totalValue - totalCost;
    let profitMargin = totalValue > 0 ? (totalProfit / totalValue) * 100 : 0;
    let lowStockCount = inventory[section].filter(item => getProductStatus(item) === 'low-stock').length;
    let expiringSoonCount = inventory[section].filter(item => getProductStatus(item) === 'expiring-soon').length;
    let expiredCount = inventory[section].filter(item => getProductStatus(item) === 'expired').length;

    const updateEl = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    updateEl(`${section}-total-products`, totalProducts);
    updateEl(`${section}-total-value`, `₦${totalValue.toFixed(2)}`);
    updateEl(`${section}-total-cost`, `₦${totalCost.toFixed(2)}`);
    updateEl(`${section}-total-profit`, `₦${totalProfit.toFixed(2)}`);
    updateEl(`${section}-profit-margin`, `${profitMargin.toFixed(1)}%`);
    updateEl(`${section}-low-stock-count`, lowStockCount);
    updateEl(`${section}-expiring-soon-count`, expiringSoonCount);
    updateEl(`${section}-expired-count`, expiredCount);
}

function updateTotalInventory() {
    const tableBody = document.getElementById('total-inventory-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    let allItems = [];
    sections.forEach(section => {
        inventory[section].forEach(item => {
            allItems.push({ ...item, section: sectionNames[section] });
        });
    });
    if (allItems.length === 0) { tableBody.innerHTML = `<tr><td colspan="6" class="text-center">No items in inventory.</td></tr>`; return; }
    allItems.forEach(item => {
        const status = getProductStatus(item);
        const row = document.createElement('tr');
        row.className = `inventory-row status-${status}`;
        row.innerHTML = `
            <td>${item.section}</td>
            <td>${item.name}</td>
            <td>₦${item.price.toFixed(2)}</td>
            <td>${item.stock}</td>
            <td>${formatDate(item.expiry_date)}</td>
            <td><span class="status-badge ${status}">${status.replace('-', ' ')}</span></td>
        `;
        tableBody.appendChild(row);
    });
}


// ===================================================================
// 6. EVENT HANDLERS & MODALS
// ===================================================================

// Setup event delegation for dynamic content
function setupEventDelegation() {
    document.addEventListener('click', function(e) {
        const target = e.target;
        const section = target.getAttribute('data-section');
        const id = target.getAttribute('data-id');

        // --- Modal Triggers ---
        if (target.classList.contains('js-add-item-btn')) showAddItemModal(section);
        if (target.classList.contains('js-add-supplier-btn')) showAddSupplierModal(section);
        if (target.classList.contains('js-add-purchase-order-btn')) showAddPurchaseOrderModal(section);

        // --- Table Actions ---
        if (target.classList.contains('add-to-cart-btn')) {
            const item = inventory[section].find(invItem => invItem.id === id);
            if (item) addToCart(section, item);
        }
        if (target.classList.contains('edit-item-btn')) editInventoryItem(section, id);
        if (target.classList.contains('delete-item-btn')) deleteInventoryItem(section, id);
        if (target.classList.contains('edit-supplier-btn')) editSupplier(section, id);
        if (target.classList.contains('delete-supplier-btn')) deleteSupplier(section, id);
        if (target.classList.contains('receive-order-btn')) receivePurchaseOrder(section, id);
        if (target.classList.contains('edit-order-btn')) editPurchaseOrder(section, id);
        if (target.classList.contains('delete-order-btn')) deletePurchaseOrder(section, id);

        // --- POS Actions ---
        if (target.classList.contains('js-checkout-btn')) processCheckout(section);

        // --- Filter Buttons ---
        if (target.classList.contains('filter-btn')) {
            document.querySelectorAll(`[data-section="${section}"].filter-btn`).forEach(btn => btn.classList.remove('active'));
            target.classList.add('active');
            currentFilter = target.getAttribute('data-filter');
            loadInventoryTable(section);
        }

        // --- Modal Closes ---
        if (target.classList.contains('js-modal-close')) {
            const modalId = target.getAttribute('data-target') || target.closest('.modal').id;
            closeModal(modalId);
        }
    });
}

// --- Auth Forms ---
document.getElementById('emailLoginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('email-login-error');
    const loginBtn = document.getElementById('emailLoginBtn');

    loginBtn.disabled = true; loginBtn.textContent = 'Signing In...';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { if (errorEl) errorEl.textContent = error.message; }
    loginBtn.disabled = false; loginBtn.textContent = 'Sign In';
});

document.getElementById('logoutBtn')?.addEventListener('click', () => supabase.auth.signOut());

document.getElementById('forgotPasswordLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) modal.classList.add('active');
});

// --- Modal Confirm Buttons ---
document.querySelector('.js-add-item-confirm-btn')?.addEventListener('click', addNewItem);
document.querySelector('.js-add-supplier-confirm-btn')?.addEventListener('click', addNewSupplier);
document.querySelector('.js-add-purchase-order-confirm-btn')?.addEventListener('click', addNewPurchaseOrder);
document.querySelector('.js-reset-password-btn')?.addEventListener('click', resetPassword);

// --- Search ---
document.getElementById('total-inventory-search')?.addEventListener('input', (e) => filterTotalInventory(e.target.value));


// ===================================================================
// 7. CORE APPLICATION LOGIC (ACTIONS)
// ===================================================================

function showSection(section) {
    document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
    const sectionEl = document.getElementById(`${section}-section`);
    if (sectionEl) sectionEl.style.display = 'block';
    currentSection = section;
}

function showView(view) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    const viewEl = document.getElementById(`${currentSection}-${view}`);
    if (viewEl) viewEl.style.display = 'block';
    currentView = view;
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function filterInventory(section, searchTerm) {
    const rows = document.querySelectorAll(`#${section}-inventory-table-body tr`);
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm.toLowerCase()) ? '' : 'none';
    });
}

function filterTotalInventory(searchTerm) {
    const rows = document.querySelectorAll('#total-inventory-table-body tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm.toLowerCase()) ? '' : 'none';
    });
}

// --- Cart Logic ---
function addToCart(section, item) {
    const existingItem = carts[section].find(cartItem => cartItem.id === item.id);
    if (existingItem) {
        existingItem.quantity++;
        existingItem.total = existingItem.price * existingItem.quantity;
    } else {
        carts[section].push({ ...item, quantity: 1, total: item.price });
    }
    saveToLocalStorage(`cart_${section}`, carts[section]);
    updateCart(section);
}

// --- Item CRUD ---
function showAddItemModal(section) {
    const modal = document.getElementById('addItemModal');
    if (!modal) return;
    modal.setAttribute('data-section', section);
    modal.querySelector('h3').textContent = `Add New Item to ${sectionNames[section]}`;
    modal.querySelector('#itemSection').value = section;
    modal.classList.add('active');
}

async function addNewItem() {
    const modal = document.getElementById('addItemModal');
    const section = modal.getAttribute('data-section');
    const name = document.getElementById('itemName').value;
    const price = parseFloat(document.getElementById('itemPrice').value);
    const cost = parseFloat(document.getElementById('itemCost').value) || 0;
    const stock = parseInt(document.getElementById('itemStock').value) || 0;
    const expiry_date = document.getElementById('itemExpiry').value;

    if (!name || isNaN(price)) { showNotification('Please fill in all required fields.', 'error'); return; }

    const newItem = { section, name, price, cost, stock, expiry_date, description: '', status: 'in-stock', deleted: false };
    await saveDataToSupabase('inventory', newItem);
    closeModal('addItemModal');
    modal.reset();
    showNotification('Item added successfully!', 'success');
}

function editInventoryItem(section, itemId) {
    const item = inventory[section].find(i => i.id === itemId);
    if (!item) return;
    const modal = document.getElementById('addItemModal');
    if (!modal) return;
    modal.querySelector('h3').textContent = `Edit Item`;
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemPrice').value = item.price;
    document.getElementById('itemCost').value = item.cost || 0;
    document.getElementById('itemStock').value = item.stock;
    document.getElementById('itemExpiry').value = item.expiry_date || '';
    modal.setAttribute('data-section', section);
    modal.setAttribute('data-id', itemId);
    modal.classList.add('active');
    
    // Change confirm button to update
    const confirmBtn = modal.querySelector('.js-add-item-confirm-btn');
    confirmBtn.textContent = 'Update Item';
    confirmBtn.onclick = () => updateInventoryItem(section, itemId);
}

async function updateInventoryItem(section, itemId) {
    const item = inventory[section].find(i => i.id === itemId);
    if (!item) return;
    item.name = document.getElementById('itemName').value;
    item.price = parseFloat(document.getElementById('itemPrice').value);
    item.cost = parseFloat(document.getElementById('itemCost').value) || 0;
    item.stock = parseInt(document.getElementById('itemStock').value) || 0;
    item.expiry_date = document.getElementById('itemExpiry').value;
    
    await saveDataToSupabase('inventory', item, itemId);
    closeModal('addItemModal');
    showNotification('Item updated successfully!', 'success');
    
    // Reset button
    const modal = document.getElementById('addItemModal');
    const confirmBtn = modal.querySelector('.js-add-item-confirm-btn');
    confirmBtn.textContent = 'Add Item';
    confirmBtn.onclick = addNewItem;
    modal.reset();
}

async function deleteInventoryItem(section, itemId) {
    if (!confirm('Are you sure you want to delete this item? This cannot be undone.')) return;
    // Soft delete
    const item = inventory[section].find(i => i.id === itemId);
    if (item) {
        item.deleted = true;
        item.deleted_at = new Date().toISOString();
        await saveDataToSupabase('inventory', item, itemId);
        showNotification('Item deleted.', 'info');
    }
}

// --- Supplier CRUD ---
function showAddSupplierModal(section) {
    const modal = document.getElementById('addSupplierModal');
    if (!modal) return;
    modal.setAttribute('data-section', section);
    modal.querySelector('h3').textContent = `Add New Supplier to ${sectionNames[section]}`;
    document.getElementById('supplierSection').value = section;
    modal.classList.add('active');
}

async function addNewSupplier() {
    const modal = document.getElementById('addSupplierModal');
    const section = modal.getAttribute('data-section');
    const name = document.getElementById('supplierName').value;
    const phone = document.getElementById('supplierPhone').value;
    const email = document.getElementById('supplierEmail').value;
    const address = document.getElementById('supplierAddress').value;

    if (!name) { showNotification('Supplier name is required.', 'error'); return; }

    const newSupplier = { section, name, phone, email, address, products: [], deleted: false };
    await saveDataToSupabase('suppliers', newSupplier);
    closeModal('addSupplierModal');
    modal.reset();
    showNotification('Supplier added successfully!', 'success');
}

// --- Purchase Order CRUD ---
function showAddPurchaseOrderModal(section) {
    const modal = document.getElementById('addPurchaseOrderModal');
    if (!modal) return;
    modal.setAttribute('data-section', section);
    modal.querySelector('h3').textContent = `Create Purchase Order for ${sectionNames[section]}`;
    document.getElementById('poSection').value = section;
    // Populate supplier dropdown
    const supplierSelect = document.getElementById('poSupplier');
    supplierSelect.innerHTML = '<option value="">Select Supplier</option>';
    suppliers[section].forEach(s => {
        supplierSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
    });
    modal.classList.add('active');
}

async function addNewPurchaseOrder() {
    const modal = document.getElementById('addPurchaseOrderModal');
    const section = modal.getAttribute('data-section');
    const supplierId = document.getElementById('poSupplier').value;
    const supplierName = suppliers[section].find(s => s.id === supplierId)?.name || 'Unknown';
    const orderNumber = `PO-${Date.now()}`;
    const productId = document.getElementById('poProduct').value;
    const productName = inventory[section].find(i => i.id === productId)?.name || 'Unknown Product';
    const quantity = parseInt(document.getElementById('poQuantity').value);
    const cost = parseFloat(document.getElementById('poCost').value);
    const total = quantity * cost;

    if (!supplierId || !productId || !quantity || !cost) { showNotification('Please fill all fields.', 'error'); return; }

    const newOrder = { section, orderNumber, supplierId, supplierName, productId, productName, quantity, cost, total, status: 'pending', deleted: false };
    await saveDataToSupabase('purchase_orders', newOrder);
    closeModal('addPurchaseOrderModal');
    modal.reset();
    showNotification('Purchase order created!', 'success');
}

// --- Checkout Logic ---
function processCheckout(section) {
    if (carts[section].length === 0) { showNotification('Your cart is empty.', 'warning'); return; }
    const modal = document.getElementById('checkoutModal');
    if (!modal) return;
    modal.setAttribute('data-section', section);
    // Display cart summary in modal
    const summaryEl = document.getElementById('checkout-summary');
    const total = carts[section].reduce((sum, item) => sum + item.total, 0);
    summaryEl.innerHTML = carts[section].map(item => `<div>${item.name} x${item.quantity}: ₦${item.total.toFixed(2)}</div>`).join('');
    summaryEl.innerHTML += `<hr><div><strong>Total: ₦${total.toFixed(2)}</strong></div>`;
    modal.classList.add('active');
}

async function completeCheckout() {
    const modal = document.getElementById('checkoutModal');
    const section = modal.getAttribute('data-section');
    const paymentMethod = document.getElementById('payment-method').value;
    const customerName = document.getElementById('customer-name').value;
    const customerPhone = document.getElementById('customer-phone').value;

    if (!paymentMethod) { showNotification('Please select a payment method.', 'error'); return; }

    const items = carts[section];
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const totalCost = items.reduce((sum, item) => sum + ((inventory[section].find(i => i.id === item.id)?.cost || 0) * item.quantity), 0);
    const total = subtotal;
    const totalProfit = total - totalCost;
    const profitMargin = total > 0 ? (totalProfit / total) * 100 : 0;

    const saleData = {
        user_id: currentUser?.id,
        user_email: currentUser?.email,
        section, items, subtotal, total, totalCost, totalProfit, profitMargin,
        payment_method: paymentMethod, customer_name: customerName, customer_phone: customerPhone,
        timestamp: new Date().toISOString()
    };

    // Save sale record
    await saveDataToSupabase('sales', saleData);

    // Update inventory stock
    for (const cartItem of items) {
        const inventoryItem = inventory[section].find(i => i.id === cartItem.id);
        if (inventoryItem) {
            inventoryItem.stock -= cartItem.quantity;
            await saveDataToSupabase('inventory', inventoryItem, inventoryItem.id);
        }
    }

    // Update summary data
    salesData[section].totalSales += total;
    salesData[section].totalTransactions += 1;
    salesData[section].avgTransaction = salesData[section].totalSales / salesData[section].totalTransactions;
    salesData[section].profit += totalProfit;
    salesData[section].profitMargin = salesData[section].totalSales > 0 ? (salesData[section].profit / salesData[section].totalSales) * 100 : 0;
    await saveDataToSupabase('sales_data', salesData[section], section);

    userData[section].transactions += 1;
    userData[section].sales += total;
    await saveDataToSupabase('user_data', userData[section], section);

    // Clear cart and update UI
    carts[section] = [];
    saveToLocalStorage(`cart_${section}`, []);
    updateCart(section);
    loadInventoryTable(section);
    updateReports(section);
    updateUserStats(section);
    updateDepartmentStats(section);

    closeModal('checkoutModal');
    modal.reset();
    showNotification('Checkout successful!', 'success');
}

async function resetPassword() {
    const email = document.getElementById('reset-email').value;
    if (!email) { showNotification('Please enter your email address.', 'error'); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) { showNotification(`Error: ${error.message}`, 'error'); }
    else { showNotification('Password reset link sent! Check your email.', 'success'); closeModal('forgotPasswordModal'); }
}


// ===================================================================
// 8. SERVICE WORKER FOR PWA
// ===================================================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('ServiceWorker registration successful:', reg.scope))
            .catch(err => console.log('ServiceWorker registration failed:', err));
    });
}