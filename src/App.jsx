import React, { useState, useEffect, useMemo } from 'react';
import { 
  Utensils, ClipboardList, ShoppingCart, Truck, 
  LogOut, CheckCircle2, AlertCircle, Package, 
  Store, ShieldAlert, PlusCircle, Settings, 
  Database, Users, History, Layers, Calendar,
  BarChart2, Search, ChevronDown, ChevronUp, Download, Menu,
  Edit2, Trash2, Save, Eye, EyeOff, ScanLine, MapPin, MapPinOff, ShieldCheck, X, Camera,
  BellRing
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';

// --- Firebase Setup (已內建您的專屬金鑰) ---
const firebaseConfig = {
  apiKey: "AIzaSyAc0LGsLeEBcJ3fOj08NwAWbZL0d3GKHrA",
  authDomain: "ypxerp.firebaseapp.com",
  projectId: "ypxerp",
  storageBucket: "ypxerp.firebasestorage.app",
  messagingSenderId: "684981995411",
  appId: "1:684981995411:web:a32310ced01fc8ca964a66",
  measurementId: "G-MFJ8WW5707"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'hotpot-erp-system';

// Paths
const DB_USERS = 'hotpot_users';
const DB_PRODUCTS = 'hotpot_products';
const DB_INVENTORY = 'hotpot_inventory';
const DB_ORDERS = 'hotpot_orders';
const DB_SYSTEM = 'hotpot_system';

// --- Initial Master Data (Used for Seeding) ---
const initialProducts = [
  { id: 'p1', category: '蔬果類', name: '高麗菜', unit: '顆', defaultPar: 50, defaultReorderQty: 1, defaultReorderUnit: '件', order: 1 },
  { id: 'p2', category: '蔬果類', name: '大白菜', unit: '顆', defaultPar: 30, order: 2 },
  { id: 'p3', category: '蔬果類', name: '金針菇', unit: '包', defaultPar: 100, order: 3 },
  { id: 'p6', category: '肉類', name: '特級雪花牛', unit: '公斤', defaultPar: 20, order: 4 },
  { id: 'p7', category: '肉類', name: '台灣梅花豬', unit: '公斤', defaultPar: 25, order: 5 },
  { id: 'p10', category: '海鮮與火鍋料', name: '大白蝦', unit: '盒', defaultPar: 20, order: 6 },
];

const adminUserSeed = { username: 'admin', password: 'admin123', role: 'admin', branchName: '總管理處' };

const formatCategory = (category) => {
  if (!category) return '';
  if (category.includes('蔬果')) return `【${category}】`;
  if (category.includes('肉')) return `[${category}]`;
  if (category.includes('海鮮') || category.includes('火鍋料')) return `《${category}》`;
  if (category.includes('飲')) return `〈${category}〉`;
  return `(${category})`;
};

// Frontend Image Compression Tool
const compressImage = (file, maxWidth = 600, quality = 0.5) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = error => reject(error);
    };
    reader.onerror = error => reject(error);
  });
};

const getEffectiveHolidayMode = (modeStr) => {
  if (modeStr === 'holiday') return true;
  if (modeStr === 'weekday') return false;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1); 
  const day = yesterday.getDay();
  return day === 0 || day === 6; 
};

function getSortedCategories(products, categoryOrderArr, systemCategories = []) {
  const uniqueCats = [...new Set([...products.map(p => p.category), ...systemCategories])].filter(Boolean);
  const orderArr = categoryOrderArr || [];
  return uniqueCats.sort((a, b) => {
    const idxA = orderArr.indexOf(a);
    const idxB = orderArr.indexOf(b);
    if (idxA === -1 && idxB === -1) return 0;
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });
}

export default function App() {
  const [fbUser, setFbUser] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [isSystemLoaded, setIsSystemLoaded] = useState(false); 
  
  const [usersDb, setUsersDb] = useState([]); 
  const [products, setProducts] = useState([]);
  const [inventoryData, setInventoryData] = useState({}); 
  const [ordersData, setOrdersData] = useState([]);
  const [systemConfig, setSystemConfig] = useState({ 
    holidayMode: 'auto', 
    categoryOrder: [], 
    isGPSRequired: false,
    permissions: { manager: {}, crew: {} } 
  });
  const [systemOptions, setSystemOptions] = useState({ categories: [], units: [], reorderUnits: [] });

  const [user, setUser] = useState(null); 
  const [authMode, setAuthMode] = useState('login'); 
  const [loginRole, setLoginRole] = useState('manager'); 
  const [toast, setToast] = useState(null);

  const [showAdminHint, setShowAdminHint] = useState(false);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [secretInput, setSecretInput] = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ⭐ 升級版：注入全新強大的截圖引擎 html-to-image (並保留 html2canvas 備用)
  useEffect(() => {
    if (!document.getElementById('html-to-image-script')) {
      const script1 = document.createElement('script');
      script1.id = 'html-to-image-script';
      script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js';
      script1.async = true;
      document.head.appendChild(script1);
    }
    if (!document.getElementById('html2canvas-script')) {
      const script2 = document.createElement('script');
      script2.id = 'html2canvas-script';
      script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      script2.async = true;
      document.head.appendChild(script2);
    }

    const initAuth = async () => {
      try { await signInAnonymously(auth); } catch (err) { console.error('Auth Error:', err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => { setFbUser(u); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!fbUser) return;
    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', DB_USERS);
    const productsRef = collection(db, 'artifacts', appId, 'public', 'data', DB_PRODUCTS);
    const inventoryRef = collection(db, 'artifacts', appId, 'public', 'data', DB_INVENTORY);
    const ordersRef = collection(db, 'artifacts', appId, 'public', 'data', DB_ORDERS);
    const systemRef = collection(db, 'artifacts', appId, 'public', 'data', DB_SYSTEM);

    const unsubUsers = onSnapshot(usersRef, (snap) => setUsersDb(snap.docs.map(d => d.data())));
    const unsubProducts = onSnapshot(productsRef, (snap) => {
      const data = snap.docs.map(d => d.data());
      data.sort((a, b) => (a.order || 0) - (b.order || 0));
      setProducts(data);
      setIsReady(true);
    });
    const unsubInventory = onSnapshot(inventoryRef, (snap) => {
      const data = {};
      snap.docs.forEach(d => { data[d.id] = d.data(); });
      setInventoryData(data);
    });
    const unsubOrders = onSnapshot(ordersRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrdersData(data.sort((a, b) => b.timestamp - a.timestamp));
    });
    const unsubSystem = onSnapshot(systemRef, (snap) => {
      let config = { 
        holidayMode: 'auto', 
        categoryOrder: [], 
        isGPSRequired: false,
        permissions: { manager: { editProducts: false, editQuotas: false }, crew: { editProducts: false, editQuotas: false } }
      };
      snap.docs.forEach(d => { 
        if (d.id === 'config') {
          const data = d.data();
          if (data.holidayMode) config.holidayMode = data.holidayMode;
          else if (data.isHolidayMode !== undefined) config.holidayMode = data.isHolidayMode ? 'holiday' : 'weekday';
          if (data.categoryOrder) config.categoryOrder = data.categoryOrder;
          if (data.isGPSRequired !== undefined) config.isGPSRequired = data.isGPSRequired;
          if (data.permissions) config.permissions = { ...config.permissions, ...data.permissions }; 
        }
      });
      setSystemConfig(config);
      setIsSystemLoaded(true); 
    });

    const optionsRef = doc(db, 'artifacts', appId, 'public', 'data', DB_SYSTEM, 'options');
    const unsubOptions = onSnapshot(optionsRef, (snap) => {
      if (snap.exists()) {
        setSystemOptions(snap.data());
      } else {
        const initOpts = {
          categories: ['蔬果類', '肉類', '海鮮與火鍋料'],
          units: ['顆', '包', '公斤', '盒', '斤', '把'],
          reorderUnits: ['箱', '件', '袋', '籃'] 
        };
        setDoc(optionsRef, initOpts);
        setSystemOptions(initOpts);
      }
    });

    return () => { unsubUsers(); unsubProducts(); unsubInventory(); unsubOrders(); unsubSystem(); unsubOptions(); };
  }, [fbUser]);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!fbUser) { showToast('雲端連線中，請稍候', 'error'); return; }
    const formData = new FormData(e.target);
    const username = formData.get('username').trim();
    const password = formData.get('password').trim();
    const branchName = formData.get('branchName')?.trim();

    if (products.length === 0 && username === 'admin') {
      initialProducts.forEach(async (p) => {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_PRODUCTS, p.id.toString()), p);
      });
    }

    if (authMode === 'register') {
      if (loginRole === 'admin') {
        showToast('為保護系統安全，總公司帳號無法在此直接註冊', 'error'); return;
      }
      if (username === 'admin' || usersDb.some(u => u.username === username)) {
        showToast('帳號已存在', 'error'); return;
      }
      const newUser = { username, password, role: loginRole, branchName, lat: '', lng: '' };
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_USERS, username), newUser);
      setUser(newUser);
      showToast(`${loginRole === 'manager' ? '店長' : '組員'}帳號註冊成功！`);
    } else {
      if (loginRole === 'admin' && username === 'admin' && password === 'admin123') {
        const adminObj = usersDb.find(u => u.username === 'admin') || adminUserSeed;
        if (!usersDb.some(u => u.username === 'admin')) {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_USERS, 'admin'), adminObj);
        }
        setUser(adminObj);
        showToast('總管理處登入成功！');
        return;
      }
      
      const existingUser = usersDb.find(u => 
        u.username === username && 
        u.password === password && 
        (u.role === loginRole || (loginRole === 'manager' && u.role === 'branch'))
      );

      if (existingUser) {
        setUser({ ...existingUser, role: loginRole }); 
        showToast(`${loginRole === 'manager' ? '店長' : '組員'}登入成功！`);
      } else {
        showToast('帳號、密碼或職級錯誤，請重試', 'error');
      }
    }
  };

  const logout = () => { setUser(null); showToast('已登出系統'); };

  const handleSecretSubmit = (e) => {
    e.preventDefault();
    if (secretInput === '0204') { 
      setShowAdminHint(true); setShowSecretModal(false); setSecretInput('');
    } else {
      showToast('解鎖密碼錯誤', 'error'); setSecretInput('');
    }
  };

  const getBranchInventory = (branchNameKey) => {
    const branchDoc = inventoryData[branchNameKey] || {};
    const branchSettings = branchDoc.settings || {};
    const isHoliday = getEffectiveHolidayMode(systemConfig.holidayMode);
    return products.map(product => {
      const bSetting = branchSettings[product.id] || {};
      const regularPar = (bSetting.parLevel !== undefined && bSetting.parLevel !== '') ? bSetting.parLevel : product.defaultPar;
      const holidayPar = (bSetting.parLevelHoliday !== undefined && bSetting.parLevelHoliday !== '') ? bSetting.parLevelHoliday : regularPar;
      return {
        ...product,
        currentStock: (bSetting.currentStock !== undefined && bSetting.currentStock !== null) ? bSetting.currentStock : '',
        parLevel: regularPar,
        parLevelHoliday: holidayPar,
        activeParLevel: isHoliday ? holidayPar : regularPar,
        reorderQty: (bSetting.reorderQty !== undefined && bSetting.reorderQty !== null) ? bSetting.reorderQty : (product.defaultReorderQty || ''),
        reorderUnit: (bSetting.reorderUnit !== undefined && bSetting.reorderUnit !== null) ? bSetting.reorderUnit : (product.defaultReorderUnit || '')
      };
    });
  };

  const resolveOrderIssueCloud = async (orderId, category, note) => {
    if (!fbUser) return;
    const order = ordersData.find(o => o.id === orderId);
    if (!order || !order.issues) return;
    
    const newIssues = order.issues.map(iss => {
      if (iss.category === category) {
        return { ...iss, resolved: true, resolveNote: note, resolvedAt: Date.now() };
      }
      return iss;
    });

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_ORDERS, orderId), { issues: newIssues });
    showToast('異常已成功標記為已解決！', 'success');
  };

  if (!isReady || !isSystemLoaded) return <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>;

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col md:flex-row overflow-hidden font-sans text-slate-800">
      <style dangerouslySetInnerHTML={{__html: `
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .vertical-text { writing-mode: vertical-rl; text-orientation: upright; letter-spacing: 2px; }
      `}} />

      {toast && <Toast message={toast.message} type={toast.type} />}
      
      {!user ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 pb-4 relative">
            <div className="bg-slate-900 pt-10 pb-8 px-6 text-center rounded-b-3xl shadow-inner">
              <div 
                onClick={() => { if(!showAdminHint) setShowSecretModal(true); else setShowAdminHint(false); }}
                className="mx-auto bg-[#1a2130] w-24 h-24 rounded-[1.25rem] flex items-center justify-center mb-5 border border-white/20 shadow-xl cursor-pointer hover:bg-[#1f293d] active:scale-95 transition-all p-1.5 overflow-hidden"
              >
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain mix-blend-screen" onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'block'; }} />
                <Utensils className="text-orange-500 w-10 h-10 hidden" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-wider">一品香火鍋 ERP</h1>
              <p className="text-slate-400 mt-2 text-sm">雲端門店營運系統</p>
            </div>
            <div className="p-8">
              {showAdminHint && (
                <div className="mb-6 p-3 bg-blue-50 text-blue-800 rounded-xl border border-blue-100 text-sm flex items-start gap-2 shadow-sm">
                  <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p>總管理處登入：<br/>帳號 <strong>admin</strong> / 密碼 <strong>admin123</strong><br/>(需先將職級切換為總公司)</p>
                </div>
              )}
              
              <h2 className="text-xl font-bold text-slate-800 mb-4 text-center">
                {authMode === 'login' ? '系統登入' : '註冊新帳號'}
              </h2>

              <div className="flex bg-slate-100 p-1.5 rounded-xl mb-6 shadow-inner">
                <button type="button" onClick={() => setLoginRole('admin')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex justify-center items-center gap-1 ${loginRole === 'admin' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  <ShieldAlert className="w-4 h-4"/> 總公司
                </button>
                <button type="button" onClick={() => setLoginRole('manager')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex justify-center items-center gap-1 ${loginRole === 'manager' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  <Store className="w-4 h-4"/> 店長
                </button>
                <button type="button" onClick={() => setLoginRole('crew')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex justify-center items-center gap-1 ${loginRole === 'crew' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  <Users className="w-4 h-4"/> 組員
                </button>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                {authMode === 'register' && loginRole !== 'admin' && (
                  <div><input required name="branchName" type="text" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-[16px]" placeholder="所屬門店名稱 (例如：斗六店)" /></div>
                )}
                <div><input required name="username" type="text" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-[16px]" placeholder="個人帳號" /></div>
                <div><input required name="password" type="password" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-[16px]" placeholder="密碼" /></div>
                <button type="submit" className={`w-full active:scale-95 text-white font-bold py-4 mt-2 rounded-xl transition-all shadow-md text-[16px] ${loginRole === 'admin' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20' : loginRole === 'manager' ? 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/20' : 'bg-green-600 hover:bg-green-700 shadow-green-600/20'}`}>
                  {authMode === 'login' ? '登入系統' : '註冊帳號'}
                </button>
              </form>
              <div className="mt-8 text-center text-[15px] text-slate-600">
                {authMode === 'login' ? (
                  <button onClick={() => setAuthMode('register')} className="text-orange-600 font-bold hover:underline px-4 py-2">註冊新帳號</button>
                ) : (
                  <button onClick={() => setAuthMode('login')} className="text-orange-600 font-bold hover:underline px-4 py-2">返回登入</button>
                )}
              </div>
            </div>
          </div>
          {showSecretModal && (
            <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm transition-all">
              <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl">
                <h3 className="text-lg font-bold text-slate-800 mb-4 text-center">顯示總部帳號</h3>
                <form onSubmit={handleSecretSubmit}>
                  <input type="password" value={secretInput} onChange={(e) => setSecretInput(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none mb-4 text-center tracking-widest text-[16px] font-bold" placeholder="請輸入解鎖碼" autoFocus />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => {setShowSecretModal(false); setSecretInput('');}} className="flex-1 py-3.5 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors">取消</button>
                    <button type="submit" className="flex-1 bg-slate-900 text-white font-bold py-3.5 rounded-xl hover:bg-slate-800 shadow-md">確認</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <header className="md:hidden bg-white/90 backdrop-blur-md shadow-sm px-4 py-3.5 flex items-center justify-between z-10 sticky top-0 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${user.role === 'admin' ? 'bg-blue-100 text-blue-600' : user.role === 'manager' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                {user.role === 'admin' ? <ShieldAlert className="w-5 h-5" /> : user.role === 'manager' ? <Store className="w-5 h-5" /> : <Users className="w-5 h-5" />}
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-slate-800 text-[15px] leading-tight">{user.branchName}</span>
                <span className="text-[11px] font-bold text-slate-400">{user.role === 'admin' ? '總管理處' : user.role === 'manager' ? '店長權限' : '組員權限'}</span>
              </div>
            </div>
            <button onClick={logout} className="p-2.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </header>

          <main className="flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+90px)] md:pb-0 relative scroll-smooth w-full">
            {user.role === 'admin' ? (
              <AdminViews products={products} usersDb={usersDb} inventoryData={inventoryData} ordersData={ordersData} getBranchInventory={getBranchInventory} showToast={showToast} fbUser={fbUser} systemConfig={systemConfig} systemOptions={systemOptions} db={db} appId={appId} resolveOrderIssueCloud={resolveOrderIssueCloud} />
            ) : (
              <LocationGuard user={user} systemConfig={systemConfig} logout={logout}>
                <BranchViews user={user} fbUser={fbUser} products={products} inventoryData={inventoryData} ordersData={ordersData} branchInventory={getBranchInventory(user.branchName || user.username)} showToast={showToast} systemConfig={systemConfig} systemOptions={systemOptions} db={db} appId={appId} resolveOrderIssueCloud={resolveOrderIssueCloud} />
              </LocationGuard>
            )}
          </main>

          <aside className="hidden md:flex w-64 bg-slate-900 text-white flex-col flex-shrink-0">
            <div className="p-6 border-b border-slate-800">
              <div className={`flex items-center gap-3 mb-1 ${user.role === 'admin' ? 'text-blue-500' : user.role === 'manager' ? 'text-orange-500' : 'text-green-500'}`}>
                <Utensils className="w-6 h-6" />
                <span className="font-bold text-xl tracking-wider">一品香 ERP</span>
              </div>
              <p className="text-slate-400 text-sm flex items-center gap-2 mt-2 font-medium">
                {user.role === 'admin' ? <ShieldAlert className="w-4 h-4" /> : user.role === 'manager' ? <Store className="w-4 h-4" /> : <Users className="w-4 h-4" />} 
                {user.branchName} ({user.role === 'admin' ? '總部' : user.role === 'manager' ? '店長' : '組員'})
              </p>
            </div>
            <div className="p-4 mt-auto border-t border-slate-800">
              <button onClick={logout} className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors w-full p-2 rounded-lg hover:bg-slate-800">
                <LogOut className="w-5 h-5" /> <span>登出系統</span>
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

// ==========================================
// 共用元件與 GPS 定位防護
// ==========================================
function LocationGuard({ user, systemConfig, children, logout }) {
  const [status, setStatus] = useState('checking'); 
  const [distance, setDistance] = useState(null);

  useEffect(() => {
    if (!systemConfig?.isGPSRequired) {
      setStatus('passed'); return;
    }
    if (!user.lat || !user.lng) {
      setStatus('no_coords'); return;
    }
    setStatus('checking');
    if (!("geolocation" in navigator)) {
      setStatus('error'); return;
    }
    const success = (position) => {
      const currentLat = position.coords.latitude;
      const currentLng = position.coords.longitude;
      const targetLat = parseFloat(user.lat);
      const targetLng = parseFloat(user.lng);
      const R = 6371e3; 
      const MathPI = Math.PI;
      const dLat = (targetLat - currentLat) * MathPI / 180;
      const dLon = (targetLng - currentLng) * MathPI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(currentLat * MathPI / 180) * Math.cos(targetLat * MathPI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const dist = Math.round(R * c);

      setDistance(dist);
      if (dist <= 300) setStatus('passed');
      else setStatus('failed');
    };
    const error = () => setStatus('error');
    navigator.geolocation.getCurrentPosition(success, error, { enableHighAccuracy: true, timeout: 10000 });
  }, [systemConfig?.isGPSRequired, user]);

  if (status === 'passed') return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/95 flex flex-col items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
      <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm text-center shadow-2xl border border-slate-100">
        {status === 'checking' && (
          <>
            <div className="w-24 h-24 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner relative">
              <ScanLine className="w-10 h-10 animate-pulse absolute" />
              <div className="w-full h-full rounded-full border-4 border-blue-200 border-t-blue-500 animate-spin"></div>
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">安全定位掃描中</h2>
            <p className="text-slate-500 text-sm mb-8 font-medium">請在彈出的提示中點擊<strong className="text-blue-600 ml-1">允許存取位置</strong>。</p>
          </>
        )}
        {status === 'failed' && (
          <>
            <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner"><MapPinOff className="w-12 h-12" /></div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">不在授權範圍內</h2>
            <p className="text-slate-600 text-[15px] mb-8 font-medium leading-relaxed">您目前距離門店約 <strong className="text-red-600 text-lg bg-red-50 px-2 py-0.5 rounded-lg">{distance} 公尺</strong>。<br/><span className="text-sm mt-2 block text-slate-400">必須在店面周圍 300 公尺內才能登入。</span></p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-24 h-24 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner"><AlertCircle className="w-12 h-12" /></div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">無法取得定位</h2>
            <p className="text-slate-600 text-sm mb-6 font-medium">請確認手機已開啟 GPS，並「允許」本網頁存取位置。</p>
            <button onClick={() => window.location.reload()} className="w-full bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold py-3.5 rounded-xl mb-3 transition-all">重新嘗試</button>
          </>
        )}
        {status === 'no_coords' && (
          <>
            <div className="w-24 h-24 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner"><MapPin className="w-12 h-12" /></div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">尚未綁定座標</h2>
            <p className="text-slate-600 text-sm mb-8 font-medium">總部尚未在後台設定您的位置座標，請聯絡總管理處。</p>
          </>
        )}
        <button onClick={logout} className="w-full bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"><LogOut className="w-5 h-5"/> 安全登出</button>
      </div>
    </div>
  );
}

function Toast({ message, type }) {
  const isError = type === 'error';
  return (
    <div className={`fixed top-[env(safe-area-inset-top,16px)] md:top-4 left-1/2 transform -translate-x-1/2 mt-4 md:mt-0 z-[999] flex items-center gap-2 px-6 py-3.5 rounded-full shadow-2xl transition-all animate-bounce w-max max-w-[90vw] ${isError ? 'bg-red-600 text-white' : 'bg-slate-800 text-white'}`}>
      {isError ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5 text-green-400" />}
      <span className="font-bold text-[15px]">{message}</span>
    </div>
  );
}

function CustomDropdown({ value, onChange, options, className = "", buttonClassName = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value) || options[0];
  return (
    <div className={`relative ${className}`}>
      <button type="button" onClick={() => setIsOpen(!isOpen)} className={`flex items-center justify-between w-full outline-none focus:ring-2 focus:ring-blue-500 transition-all gap-3 text-[16px] ${buttonClassName}`}>
        <span className="truncate">{selectedOption?.label}</span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : 'text-slate-400'}`} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-y-auto max-h-60 py-1">
            {options.map(opt => (
              <div key={opt.value} onClick={() => { onChange(opt.value); setIsOpen(false); }} className={`px-4 py-3.5 cursor-pointer font-bold text-[16px] transition-colors ${value === opt.value ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>{opt.label}</div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ImageExportModal({ imageUrl, onClose }) {
  if (!imageUrl) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/95 z-[100] flex flex-col items-center justify-center p-6 backdrop-blur-sm animate-in fade-in duration-200">
       <div className="flex items-center gap-2 text-white font-bold mb-6 bg-slate-800 px-5 py-2.5 rounded-full shadow-lg">
         <Download className="w-5 h-5 text-blue-400"/> 請對著下方圖片<span className="text-blue-400">長按儲存</span>或分享
       </div>
       <div className="relative w-full max-w-sm max-h-[65vh] overflow-y-auto rounded-2xl shadow-2xl bg-white border-4 border-slate-700">
         <img src={imageUrl} alt="匯出圖片" className="w-full h-auto block" />
       </div>
       <button onClick={onClose} className="mt-8 bg-white/10 hover:bg-white/20 active:scale-95 text-white px-10 py-3.5 rounded-2xl font-bold transition-all border border-white/20">關閉視窗</button>
    </div>
  );
}

function BottomNav({ tabs, activeTab, setActiveTab, themeColor }) {
  return (
    <nav className="fixed bottom-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-200 flex justify-around items-center md:hidden z-20 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)]">
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center justify-center w-full pt-3 pb-3 transition-colors ${isActive ? themeColor : 'text-slate-400 hover:text-slate-600'}`}>
            <div className={`mb-1 transition-transform ${isActive ? 'scale-110' : ''}`}>{React.cloneElement(tab.icon, { className: 'w-6 h-6' })}</div>
            <span className="text-[11px] font-bold">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  );
}

function StatusBadge({ status }) {
  if (status === 'received') return <span className="px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1 border bg-white shadow-sm text-green-600 border-green-200"><CheckCircle2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">已核對入庫</span><span className="sm:hidden">已入庫</span></span>;
  if (status === 'partial') return <span className="px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1 border bg-white shadow-sm text-blue-600 border-blue-200"><Package className="w-3.5 h-3.5" /> <span className="hidden sm:inline">部分入庫</span><span className="sm:hidden">部分入庫</span></span>;
  return <span className="px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1 border bg-white shadow-sm text-orange-500 border-orange-200"><Truck className="w-3.5 h-3.5" /> <span className="hidden sm:inline">待進貨</span><span className="sm:hidden">待進貨</span></span>;
}

// ==========================================
// 總部後台視圖
// ==========================================
function AdminViews({ products, usersDb, inventoryData, ordersData, getBranchInventory, showToast, fbUser, systemConfig, systemOptions, db, appId, resolveOrderIssueCloud }) {
  const [activeTab, setActiveTab] = useState('products');
  const branches = usersDb.filter(u => u.role !== 'admin'); 

  const tabs = [
    { id: 'products', icon: <Database />, label: '商品庫' },
    { id: 'categories', icon: <Layers />, label: '分類排序' },
    { id: 'quotas', icon: <Settings />, label: '安全庫存' },
    { id: 'branches', icon: <Users />, label: '門店帳號' },
    { id: 'history', icon: <History />, label: '紀錄' },
    { id: 'analytics', icon: <BarChart2 />, label: '統計' }
  ];

  return (
    <>
      <div className="p-3 md:p-8 max-w-4xl mx-auto w-full">
        <div className="hidden md:flex space-x-2 mb-8 bg-slate-200/50 p-1.5 rounded-xl w-max">
           {tabs.map(t => (
             <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-5 py-2.5 rounded-lg font-bold transition-all ${activeTab === t.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
               <div className="flex items-center gap-2">{React.cloneElement(t.icon, { className: 'w-4 h-4' })} {t.label}</div>
             </button>
           ))}
        </div>
        {activeTab === 'products' && <AdminProductManager products={products} showToast={showToast} fbUser={fbUser} systemOptions={systemOptions} systemConfig={systemConfig} db={db} appId={appId} />}
        {activeTab === 'categories' && <AdminCategoryManager products={products} systemConfig={systemConfig} showToast={showToast} fbUser={fbUser} db={db} appId={appId} />}
        {activeTab === 'quotas' && <AdminQuotaManager branches={branches} products={products} inventoryData={inventoryData} getBranchInventory={getBranchInventory} fbUser={fbUser} showToast={showToast} systemConfig={systemConfig} systemOptions={systemOptions} db={db} appId={appId} />}
        {activeTab === 'branches' && <AdminBranchManager branches={branches} showToast={showToast} fbUser={fbUser} db={db} appId={appId} systemConfig={systemConfig} />}
        {activeTab === 'history' && <AdminOrderHistory ordersData={ordersData} branches={branches} showToast={showToast} resolveOrderIssueCloud={resolveOrderIssueCloud} />}
        {activeTab === 'analytics' && <AdminAnalytics ordersData={ordersData} branches={branches} />}
      </div>
      <BottomNav tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} themeColor="text-blue-600" />
    </>
  );
}

function AdminCategoryManager({ products, systemConfig, showToast, fbUser, db, appId }) {
  const categories = getSortedCategories(products, systemConfig.categoryOrder);
  const [draggedCat, setDraggedCat] = useState(null);
  const [dragOverCat, setDragOverCat] = useState(null);
  const [editingCat, setEditingCat] = useState(null);
  const [deletingCat, setDeletingCat] = useState(null);

  const saveOrder = async (newArr) => {
    if(!fbUser) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_SYSTEM, 'config'), { categoryOrder: newArr });
  };

  const handleMove = (dragCat, targetCat) => {
    if (!dragCat || dragCat === targetCat) return;
    const newArr = [...categories];
    const dragIdx = newArr.indexOf(dragCat);
    const targetIdx = newArr.indexOf(targetCat);
    if (dragIdx === -1 || targetIdx === -1) return;
    newArr.splice(dragIdx, 1);
    newArr.splice(targetIdx, 0, dragCat);
    saveOrder(newArr);
    setDraggedCat(null); setDragOverCat(null);
    showToast('分類排序已更新');
  };

  const handleDragStart = (e, cat) => setDraggedCat(cat);
  const handleDragOver = (e, cat) => { e.preventDefault(); setDragOverCat(cat); };
  const handleDrop = (e, targetCat) => { e.preventDefault(); handleMove(draggedCat, targetCat); };
  const handleTouchStart = (e, cat) => setDraggedCat(cat);
  const handleTouchMove = (e) => {
    if (!draggedCat) return;
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const targetCat = el?.closest('[data-cat-id]')?.getAttribute('data-cat-id');
    if (targetCat && targetCat !== dragOverCat) setDragOverCat(targetCat);
  };
  const handleTouchEnd = () => {
    if (draggedCat && dragOverCat && draggedCat !== dragOverCat) handleMove(draggedCat, dragOverCat);
    else { setDraggedCat(null); setDragOverCat(null); }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    const newName = e.target.newName.value.trim();
    if (!newName || newName === editingCat) { setEditingCat(null); return; }
    
    const items = products.filter(p => p.category === editingCat);
    for (const item of items) {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_PRODUCTS, item.id), { category: newName });
    }
    const newArr = categories.map(c => c === editingCat ? newName : c);
    await saveOrder(newArr);
    showToast(`分類已更新為：${newName}`);
    setEditingCat(null);
  };

  const confirmDelete = async () => {
    const items = products.filter(p => p.category === deletingCat);
    for (const item of items) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_PRODUCTS, item.id));
    }
    const newArr = categories.filter(c => c !== deletingCat);
    await saveOrder(newArr);
    showToast(`已刪除分類及底下所有商品`);
    setDeletingCat(null);
  };

  return (
    <div className="space-y-4">
      {editingCat && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Edit2 className="w-5 h-5 text-blue-600"/> 編輯分類名稱</h3>
            <form onSubmit={handleSaveEdit}>
              <input required name="newName" defaultValue={editingCat} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none mb-4 text-[16px] font-bold" />
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditingCat(null)} className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-xl">取消</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-md">儲存修改</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {deletingCat && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 className="w-8 h-8"/></div>
            <h3 className="text-xl font-black text-center text-slate-800 mb-2">刪除分類警告</h3>
            <p className="text-center text-slate-500 font-medium mb-6 leading-relaxed">
              確定要刪除 <strong className="text-slate-700">{deletingCat}</strong> 嗎？<br/>這將會<span className="text-red-500 font-bold">同步刪除底下所有的商品</span>！
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeletingCat(null)} className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-xl">取消保留</button>
              <button onClick={confirmDelete} className="flex-1 bg-red-600 text-white font-bold py-3.5 rounded-xl shadow-md">確定刪除</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-200">
        <div className="flex items-center gap-2 mb-4 px-2">
          <Layers className="w-5 h-5 text-blue-600" />
          <h3 className="font-black text-slate-800 text-[18px]">拖曳調整分類排序</h3>
        </div>
        <div className="divide-y divide-slate-100 bg-slate-50/50 rounded-[1.5rem] border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 bg-slate-100 text-slate-500 text-xs font-bold text-center tracking-widest">分類名稱</div>
          {categories.map(cat => (
            <div 
              key={cat} data-cat-id={cat} draggable onDragStart={(e) => handleDragStart(e, cat)} onDragOver={(e) => handleDragOver(e, cat)} onDrop={(e) => handleDrop(e, cat)} onDragEnd={() => {setDraggedCat(null); setDragOverCat(null);}}
              className={`flex items-stretch bg-white transition-all overflow-hidden ${draggedCat === cat ? 'opacity-40 bg-slate-50 scale-[0.98]' : ''} ${dragOverCat === cat && draggedCat !== cat ? 'border-t-4 border-t-blue-500' : ''}`}
            >
              <div className="w-16 flex items-center justify-center text-slate-400 bg-slate-50 cursor-grab active:cursor-grabbing border-r border-slate-100" style={{ touchAction: 'none' }} onTouchStart={(e) => handleTouchStart(e, cat)} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}><Menu className="w-6 h-6" /></div>
              <div className="flex-1 px-5 py-4 flex items-center justify-between">
                <span className="font-bold text-slate-700 text-[17px]">{formatCategory(cat)}</span>
                <div className="flex items-center gap-2">
                   <button onClick={() => setEditingCat(cat)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-xl transition-colors"><Edit2 className="w-4 h-4"/></button>
                   <button onClick={() => setDeletingCat(cat)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 rounded-xl transition-colors"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>
            </div>
          ))}
          {categories.length === 0 && <div className="p-8 text-center text-slate-400 font-bold">尚無分類資料</div>}
        </div>
      </div>
    </div>
  );
}

function AdminProductManager({ products, showToast, fbUser, systemOptions, systemConfig, db, appId }) {
  const [searchTerm, setSearchTerm] = useState(''); 
  const [activeCategoryFilter, setActiveCategoryFilter] = useState(''); 
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(null);
  
  const [newCatInput, setNewCatInput] = useState(''); 
  
  const [newUnitInput, setNewUnitInput] = useState('');
  const [newUnitCategory, setNewUnitCategory] = useState('通用'); 
  
  const [newReorderUnitInput, setNewReorderUnitInput] = useState('');
  const [newReorderUnitCategory, setNewReorderUnitCategory] = useState('通用');

  const [addProductCat, setAddProductCat] = useState(''); 

  const categories = getSortedCategories(products, systemConfig.categoryOrder, systemOptions.categories);

  const handleAddCategory = async () => {
    if(!fbUser) return;
    const val = newCatInput.trim();
    if(!val) return;
    if((systemOptions.categories || []).includes(val)) {
      showToast(`「${val}」已經存在選項中！`, 'error'); return;
    }
    const updatedOptions = { ...systemOptions, categories: [...(systemOptions.categories || []), val] };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_SYSTEM, 'options'), updatedOptions);
    setNewCatInput('');
    showToast(`成功新增分類：${val}`);
  };

  const handleRemoveCategory = async (valToRemove) => {
    if(!fbUser) return;
    if(!window.confirm(`確定要刪除分類選項「${valToRemove}」嗎？已經使用該分類的商品不會受到影響。`)) return;
    const updatedOptions = { ...systemOptions, categories: (systemOptions.categories || []).filter(v => v !== valToRemove) };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_SYSTEM, 'options'), updatedOptions);
  };

  const handleAddUnit = async () => {
    if(!fbUser) return;
    const val = newUnitInput.trim();
    if(!val) return;
    const newUnitObj = { name: val, category: newUnitCategory };
    const exists = (systemOptions.units || []).some(u => {
      if (typeof u === 'string') return u === val && newUnitCategory === '通用';
      return u.name === val && u.category === newUnitCategory;
    });
    
    if(exists) { showToast(`「${val}」已經存在於該分類中！`, 'error'); return; }
    
    const updatedOptions = { ...systemOptions, units: [...(systemOptions.units || []), newUnitObj] };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_SYSTEM, 'options'), updatedOptions);
    setNewUnitInput('');
    showToast(`成功新增盤點單位：${val} (${formatCategory(newUnitCategory)})`);
  };

  const handleRemoveUnit = async (uToRemove) => {
    if(!fbUser) return;
    if(!window.confirm(`確定要刪除該單位選項嗎？`)) return;
    const updatedOptions = { 
      ...systemOptions, 
      units: (systemOptions.units || []).filter(u => {
        if (typeof u === 'string' && typeof uToRemove === 'string') return u !== uToRemove;
        if (typeof u === 'object' && typeof uToRemove === 'object') return u.name !== uToRemove.name || u.category !== uToRemove.category;
        if (typeof u === 'string' && typeof uToRemove === 'object') return u !== uToRemove.name;
        if (typeof u === 'object' && typeof uToRemove === 'string') return u.name !== uToRemove;
        return true;
      }) 
    };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_SYSTEM, 'options'), updatedOptions);
  };

  const handleAddReorderUnit = async () => {
    if(!fbUser) return;
    const val = newReorderUnitInput.trim();
    if(!val) return;
    const newUnitObj = { name: val, category: newReorderUnitCategory };
    const exists = (systemOptions.reorderUnits || []).some(u => {
      if (typeof u === 'string') return u === val && newReorderUnitCategory === '通用';
      return u.name === val && u.category === newReorderUnitCategory;
    });
    if(exists) { showToast(`「${val}」已經存在！`, 'error'); return; }
    
    const updatedOptions = { ...systemOptions, reorderUnits: [...(systemOptions.reorderUnits || []), newUnitObj] };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_SYSTEM, 'options'), updatedOptions);
    setNewReorderUnitInput('');
    showToast(`成功新增叫貨單位：${val}`);
  };

  const handleRemoveReorderUnit = async (uToRemove) => {
    if(!fbUser) return;
    if(!window.confirm(`確定要刪除該叫貨單位選項嗎？`)) return;
    const updatedOptions = { 
      ...systemOptions, 
      reorderUnits: (systemOptions.reorderUnits || []).filter(u => {
        if (typeof u === 'string' && typeof uToRemove === 'string') return u !== uToRemove;
        if (typeof u === 'object' && typeof uToRemove === 'object') return u.name !== uToRemove.name || u.category !== uToRemove.category;
        if (typeof u === 'string' && typeof uToRemove === 'object') return u !== uToRemove.name;
        if (typeof u === 'object' && typeof uToRemove === 'string') return u.name !== uToRemove;
        return true;
      }) 
    };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_SYSTEM, 'options'), updatedOptions);
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if(!fbUser) return;
    const formData = new FormData(e.target);
    const newName = formData.get('name').trim();
    if (products.some(p => p.name === newName)) {
      showToast(`商品「${newName}」已經存在，請勿重複輸入！`, 'error'); return; 
    }
    const id = Date.now().toString();
    const newProduct = {
      id, category: addProductCat, name: newName,
      unit: formData.get('unit').trim(), 
      defaultPar: parseFloat(formData.get('defaultPar')) || 0,
      defaultReorderQty: parseFloat(formData.get('defaultReorderQty')) || 0,
      defaultReorderUnit: formData.get('defaultReorderUnit') || '',
      order: products.length 
    };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_PRODUCTS, id), newProduct);
    e.target.name.value = '';
    e.target.defaultReorderQty.value = '';
    showToast(`成功新增：${newProduct.name}`);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newName = formData.get('name').trim();
    const newCategory = formData.get('category').trim(); 

    if (products.some(p => p.id !== editingProduct.id && p.name === newName)) {
      showToast(`商品「${newName}」已經存在，請更換名稱！`, 'error'); return; 
    }
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_PRODUCTS, editingProduct.id), {
      name: newName, 
      category: newCategory, 
      unit: formData.get('unit').trim(), 
      defaultPar: parseFloat(formData.get('defaultPar')) || 0,
      defaultReorderQty: parseFloat(formData.get('defaultReorderQty')) || 0,
      defaultReorderUnit: formData.get('defaultReorderUnit') || ''
    });
    showToast(`商品已更新：${newName}`);
    setEditingProduct(null);
  };

  const confirmDeleteProduct = async () => {
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_PRODUCTS, deletingProduct.id));
    showToast(`已刪除商品：${deletingProduct.name}`);
    setDeletingProduct(null);
  };

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategory = activeCategoryFilter ? p.category === activeCategoryFilter : true;
    return matchSearch && matchCategory;
  });
  
  const groupedProducts = filteredProducts.reduce((groups, product) => {
    if (!groups[product.category]) groups[product.category] = [];
    groups[product.category].push(product);
    return groups;
  }, {});

  const availableAddUnits = (systemOptions.units || []).filter(u => {
    const uCat = typeof u === 'string' ? '通用' : u.category;
    return uCat === '通用' || uCat === addProductCat;
  });

  const availableReorderUnits = (systemOptions.reorderUnits || []).filter(u => {
    const uCat = typeof u === 'string' ? '通用' : u.category;
    return uCat === '通用' || uCat === addProductCat;
  });

  return (
    <div className="space-y-6 relative">
      {editingProduct && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Edit2 className="w-5 h-5 text-blue-600"/> 編輯商品內容</h3>
            <form onSubmit={handleSaveProduct} className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-bold text-blue-500 mb-1 block">所屬分類 (可轉移)</label>
                  <select required name="category" value={editingProduct.category} onChange={(e) => setEditingProduct({...editingProduct, category: e.target.value})} className="w-full px-3 py-3 bg-blue-50 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-[15px] font-bold text-blue-700 shadow-inner">
                    {categories.map(c => <option key={c} value={c}>{formatCategory(c)}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-500 mb-1 block">商品名稱</label>
                  <input required name="name" defaultValue={editingProduct.name} className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-[15px] font-bold text-slate-800 shadow-inner" />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-500 mb-1 block">盤點單位</label>
                  <select required name="unit" defaultValue={editingProduct.unit} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-[16px] font-bold">
                    <option value="" disabled>請選擇</option>
                    {(systemOptions.units || []).filter(u => {
                       const uCat = typeof u === 'string' ? '通用' : u.category;
                       return uCat === '通用' || uCat === editingProduct.category;
                    }).map((u, i) => {
                       const uName = typeof u === 'string' ? u : u.name;
                       return <option key={i} value={uName}>{uName}</option>;
                    })}
                    {!((systemOptions.units || []).some(u => (typeof u === 'string' ? u : u.name) === editingProduct.unit)) && <option value={editingProduct.unit}>{editingProduct.unit}</option>}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-500 mb-1 block">預設安全庫存</label>
                  <select required name="defaultPar" defaultValue={editingProduct.defaultPar} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-[16px] font-bold text-blue-600">
                    <option value="0">0</option>
                    {Array.from({ length: 100 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <div className="flex-1">
                  <label className="text-xs font-bold text-indigo-500 mb-1 block">預設固定叫貨量</label>
                  <input name="defaultReorderQty" type="number" min="0" step="0.5" defaultValue={editingProduct.defaultReorderQty || ''} className="w-full px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-[16px] font-bold text-indigo-700" placeholder="選填" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-indigo-500 mb-1 block">預設叫貨單位</label>
                  <select name="defaultReorderUnit" defaultValue={editingProduct.defaultReorderUnit || ''} className="w-full px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-[16px] font-bold text-indigo-700">
                    <option value="">同盤點單位</option>
                    {(systemOptions.reorderUnits || []).filter(u => {
                       const uCat = typeof u === 'string' ? '通用' : u.category;
                       return uCat === '通用' || uCat === editingProduct.category;
                    }).map((u, i) => {
                       const uName = typeof u === 'string' ? u : u.name;
                       return <option key={`ru-${i}`} value={uName}>{uName}</option>;
                    })}
                    {editingProduct.defaultReorderUnit && !(systemOptions.reorderUnits || []).some(u => (typeof u === 'string' ? u : u.name) === editingProduct.defaultReorderUnit) && <option value={editingProduct.defaultReorderUnit}>{editingProduct.defaultReorderUnit}</option>}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-3"><button type="button" onClick={() => setEditingProduct(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors">取消</button><button type="submit" className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-md">儲存修改</button></div>
            </form>
          </div>
        </div>
      )}
      
      {deletingProduct && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-xl font-black text-center text-slate-800 mb-3">刪除商品</h3>
            <p className="text-center text-slate-500 font-medium mb-6">確定要刪除 <strong className="text-slate-700">{deletingProduct.name}</strong> 嗎？</p>
            <div className="flex gap-2"><button onClick={() => setDeletingProduct(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors">取消</button><button onClick={confirmDeleteProduct} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-colors shadow-md flex items-center justify-center gap-1"><Trash2 className="w-4 h-4"/> 確定刪除</button></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 flex flex-col">
          <h4 className="font-bold text-slate-800 mb-4 text-[15px] flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-500"/> 自訂商品分類
          </h4>
          <div className="flex gap-2 mb-3">
            <input 
              value={newCatInput} onChange={e => setNewCatInput(e.target.value)} 
              type="text" placeholder="輸入新分類..." 
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold shadow-inner" 
            />
            <button onClick={handleAddCategory} className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold px-4 py-2 rounded-xl transition-colors shadow-sm text-sm">新增</button>
          </div>
          <div className="flex flex-wrap gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 flex-1 content-start">
            {(systemOptions.categories || []).map((c, i) => (
              <span key={i} className="bg-white border border-slate-200 text-slate-700 text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                {formatCategory(c)}<button onClick={() => handleRemoveCategory(c)} className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full p-0.5 transition-colors"><X className="w-3 h-3"/></button>
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 flex flex-col">
          <h4 className="font-bold text-slate-800 mb-4 text-[15px] flex items-center gap-2">
            <Package className="w-5 h-5 text-orange-500"/> 自訂盤點單位
          </h4>
          <div className="flex flex-col xl:flex-row gap-2 mb-3">
            <select value={newUnitCategory} onChange={e => setNewUnitCategory(e.target.value)} className="w-full xl:w-24 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-xs font-bold text-slate-700">
              <option value="通用">通用</option>
              {categories.map(c => <option key={c} value={c}>{formatCategory(c)}</option>)}
            </select>
            <div className="flex gap-2 flex-1">
              <input value={newUnitInput} onChange={e => setNewUnitInput(e.target.value)} type="text" placeholder="如: 顆..." className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold shadow-inner" />
              <button onClick={handleAddUnit} className="bg-orange-100 hover:bg-orange-200 text-orange-700 font-bold px-4 py-2 rounded-xl transition-colors shadow-sm text-sm">新增</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 flex-1 content-start">
            {(systemOptions.units || []).map((u, i) => {
               const uName = typeof u === 'string' ? u : u.name;
               const uCat = typeof u === 'string' ? '通用' : u.category;
               return (
                 <span key={i} className="bg-white border border-slate-200 text-slate-700 text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                   {uName}<span className={`text-[9px] px-1 rounded ${uCat === '通用' ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>{formatCategory(uCat) || '通用'}</span>
                   <button onClick={() => handleRemoveUnit(u)} className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full p-0.5"><X className="w-3 h-3"/></button>
                 </span>
               );
            })}
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 flex flex-col">
          <h4 className="font-bold text-slate-800 mb-4 text-[15px] flex items-center gap-2">
            <Truck className="w-5 h-5 text-indigo-500"/> 自訂叫貨單位
          </h4>
          <div className="flex flex-col xl:flex-row gap-2 mb-3">
            <select value={newReorderUnitCategory} onChange={e => setNewReorderUnitCategory(e.target.value)} className="w-full xl:w-24 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-slate-700">
              <option value="通用">通用</option>
              {categories.map(c => <option key={c} value={c}>{formatCategory(c)}</option>)}
            </select>
            <div className="flex gap-2 flex-1">
              <input value={newReorderUnitInput} onChange={e => setNewReorderUnitInput(e.target.value)} type="text" placeholder="如: 箱..." className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold shadow-inner" />
              <button onClick={handleAddReorderUnit} className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold px-4 py-2 rounded-xl transition-colors shadow-sm text-sm">新增</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 flex-1 content-start">
            {(systemOptions.reorderUnits || []).map((u, i) => {
               const uName = typeof u === 'string' ? u : u.name;
               const uCat = typeof u === 'string' ? '通用' : u.category;
               return (
                 <span key={`ru-${i}`} className="bg-white border border-slate-200 text-slate-700 text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                   {uName}<span className={`text-[9px] px-1 rounded ${uCat === '通用' ? 'bg-slate-100 text-slate-500' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>{formatCategory(uCat) || '通用'}</span>
                   <button onClick={() => handleRemoveReorderUnit(u)} className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full p-0.5"><X className="w-3 h-3"/></button>
                 </span>
               );
            })}
          </div>
        </div>

      </div>

      <div className="bg-white p-5 sm:p-8 rounded-3xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-6 text-lg flex items-center gap-2">
          <PlusCircle className="w-6 h-6 text-blue-600" /> 新增商品 (雲端同步)
        </h3>
        
        <form onSubmit={handleAddProduct} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4 items-end">
          
          <div className="sm:col-span-1 md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">1. 選擇分類</label>
            <select required name="category" value={addProductCat} onChange={e => setAddProductCat(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-[16px] font-bold text-slate-700 shadow-inner">
              <option value="" disabled>請先選擇分類...</option>
              {categories.map(c => <option key={c} value={c}>{formatCategory(c)}</option>)}
            </select>
          </div>
          
          <div className="sm:col-span-1 md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">2. 商品名稱</label>
            <input required name="name" type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-[16px] font-bold text-slate-800 shadow-inner" placeholder="例如: 高麗菜" />
          </div>
          
          <div className="sm:col-span-1 md:col-span-1">
            <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">3. 盤點單位</label>
            <select required name="unit" defaultValue="" className={`w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-[16px] font-bold shadow-inner ${!addProductCat ? 'bg-slate-100 text-slate-400' : 'bg-slate-50 text-blue-700'}`}>
              <option value="" disabled>{addProductCat ? '選單位' : '選分類'}</option>
              {availableAddUnits.map((u, i) => {
                 const uName = typeof u === 'string' ? u : u.name;
                 return <option key={i} value={uName}>{uName}</option>;
              })}
            </select>
          </div>
          
          <div className="sm:col-span-1 md:col-span-1">
            <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">4. 安全庫存</label>
            <select required name="defaultPar" defaultValue="0" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-[16px] font-bold shadow-inner text-blue-700">
              <option value="0">0</option>
              {Array.from({ length: 100 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          
          <div className="sm:col-span-1 md:col-span-2">
            <label className="block text-xs font-bold text-indigo-500 mb-1.5 ml-1">5. 預設固定叫貨量 (選填)</label>
            <input name="defaultReorderQty" type="number" min="0" step="0.5" className="w-full px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-[16px] font-bold text-indigo-800 shadow-inner placeholder-indigo-300" placeholder="低於安全值叫貨數量" />
          </div>
          
          <div className="sm:col-span-1 md:col-span-2">
            <label className="block text-xs font-bold text-indigo-500 mb-1.5 ml-1">6. 預設叫貨單位 (選填)</label>
            <select name="defaultReorderUnit" defaultValue="" className="w-full px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-[16px] font-bold text-indigo-800 shadow-inner">
              <option value="">同盤點單位</option>
              {availableReorderUnits.map((u, i) => {
                 const uName = typeof u === 'string' ? u : u.name;
                 return <option key={`ru-${i}`} value={uName}>{uName}</option>;
              })}
            </select>
          </div>

          <div className="sm:col-span-2 md:col-span-2">
             <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md shadow-blue-600/20 whitespace-nowrap text-[16px] h-[50px] flex justify-center items-center">
               加入商品庫
             </button>
          </div>
        </form>
      </div>
      
      <div className="flex items-center bg-white p-3 rounded-2xl shadow-sm border border-slate-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all mt-6">
        <Search className="w-5 h-5 text-slate-400 mx-2 flex-shrink-0" />
        <input 
          type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} 
          placeholder="輸入商品名稱快速搜尋..." 
          className="flex-1 outline-none text-[16px] font-bold text-slate-700 bg-transparent"
        />
        {searchTerm && (
          <button type="button" onClick={() => setSearchTerm('')} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"><X className="w-4 h-4" /></button>
        )}
      </div>

      <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide snap-x mt-4">
        <button 
          onClick={() => setActiveCategoryFilter('')} 
          className={`snap-start px-5 py-3 rounded-[1rem] font-bold whitespace-nowrap transition-all shadow-sm border text-[15px] ${activeCategoryFilter === '' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
        >
          全部商品
        </button>
        {categories.map(cat => (
          <button 
            key={cat} 
            onClick={() => setActiveCategoryFilter(cat)} 
            className={`snap-start px-5 py-3 rounded-[1rem] font-bold whitespace-nowrap transition-all shadow-sm border text-[15px] ${activeCategoryFilter === cat ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            {formatCategory(cat)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {Object.entries(groupedProducts).map(([category, items]) => (
          <div key={category} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-slate-50/80 border-b border-slate-100 px-4 py-2.5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-slate-400" />
                <h3 className="font-black text-slate-800 tracking-wide text-[16px]">{formatCategory(category)}</h3>
              </div>
            </div>
            <div className="flex-1">
              {items.map(p => (
                <div key={p.id} className="flex items-stretch border-b border-slate-100 bg-white transition-all overflow-hidden last:border-0 hover:bg-slate-50">
                  <div className="flex-1 px-4 py-3 flex flex-col justify-center">
                     <div className="flex items-center gap-2 mb-1">
                       <span className="font-bold text-slate-700 text-[16px]">{p.name}</span>
                       <span className="text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md">{p.unit}</span>
                     </div>
                     {p.defaultReorderQty > 0 && (
                       <span className="text-[11px] font-bold text-indigo-600">
                         預設叫貨: {p.defaultReorderQty} {p.defaultReorderUnit || p.unit}
                       </span>
                     )}
                  </div>
                  <div className="flex items-center gap-2 pr-3">
                     <div className="flex items-center gap-1.5 mr-1">
                       <span className="text-[11px] text-slate-400 hidden sm:inline">安全庫存</span>
                       <span className="font-black text-blue-600 text-lg">{p.defaultPar}</span>
                     </div>
                     <div className="flex items-center border-l border-slate-100 pl-1.5 gap-0.5">
                        <button onClick={() => setEditingProduct(p)} className="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-xl transition-colors"><Edit2 className="w-4 h-4"/></button>
                        <button onClick={() => setDeletingProduct(p)} className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded-xl transition-colors"><Trash2 className="w-4 h-4"/></button>
                     </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminBranchManager({ branches, showToast, fbUser, db, appId, systemConfig }) {
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ branchName: '', password: '', lat: '', lng: '', role: 'manager' });
  const [showPasswords, setShowPasswords] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const togglePermission = async (role, field) => {
    if (!fbUser) return;
    const currentPerms = systemConfig.permissions || { manager: {}, crew: {} };
    const newPerms = {
      ...currentPerms,
      [role]: {
        ...(currentPerms[role] || {}),
        [field]: !(currentPerms[role]?.[field])
      }
    };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_SYSTEM, 'config'), { permissions: newPerms }, { merge: true });
    showToast(`已${newPerms[role][field] ? '開啟' : '關閉'}權限！`);
  };

  const getPerm = (role, field) => systemConfig?.permissions?.[role]?.[field] || false;

  const ToggleBtn = ({ role, field }) => {
    const hasPerm = getPerm(role, field);
    return (
      <button type="button" onClick={() => togglePermission(role, field)} className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none shadow-inner ${hasPerm ? 'bg-green-500' : 'bg-slate-300'}`}>
        <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${hasPerm ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    );
  };

  const startEdit = (b) => {
    setEditId(b.username);
    setEditForm({ 
      branchName: b.branchName, password: b.password, 
      lat: b.lat || '', lng: b.lng || '', 
      role: b.role === 'branch' ? 'manager' : (b.role || 'manager') 
    });
    setConfirmDeleteId(null);
  };
  const cancelEdit = () => setEditId(null);
  const saveEdit = async () => {
    if(!fbUser) return;
    if (!editForm.branchName || !editForm.password) { showToast('店名與密碼不能為空', 'error'); return; }
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_USERS, editId), {
      branchName: editForm.branchName, password: editForm.password, lat: editForm.lat, lng: editForm.lng, role: editForm.role
    });
    showToast('門店資料與權限更新成功！');
    setEditId(null);
  };
  const executeDelete = async (username) => {
    if(!fbUser) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_USERS, username));
    showToast('門店帳號已刪除');
    setConfirmDeleteId(null);
  };

  return (
    <div className="space-y-6">
      
      <div className="bg-white p-5 sm:p-6 rounded-[2rem] shadow-sm border border-slate-200">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-6 h-6 text-blue-600" />
          <h3 className="font-bold text-slate-800 text-[18px]">門店職級權限開放設定</h3>
        </div>
        <p className="text-sm text-slate-500 mb-5 font-medium">開啟後，該職級的門店人員將可於前台看見對應的管理分頁。</p>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 shadow-inner">
             <h4 className="font-bold text-orange-800 mb-4 flex items-center gap-2"><Store className="w-5 h-5"/> 店長 (Manager)</h4>
             <div className="space-y-3">
                <div className="flex justify-between items-center bg-white p-3.5 rounded-xl shadow-sm border border-orange-100/50">
                   <span className="text-sm font-bold text-slate-700">允許新增/編輯商品庫</span>
                   <ToggleBtn role="manager" field="editProducts" />
                </div>
                <div className="flex justify-between items-center bg-white p-3.5 rounded-xl shadow-sm border border-orange-100/50">
                   <span className="text-sm font-bold text-slate-700">允許設定各門店安全庫存</span>
                   <ToggleBtn role="manager" field="editQuotas" />
                </div>
             </div>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-2xl p-5 shadow-inner">
             <h4 className="font-bold text-green-800 mb-4 flex items-center gap-2"><Users className="w-5 h-5"/> 組員 (Crew)</h4>
             <div className="space-y-3">
                <div className="flex justify-between items-center bg-white p-3.5 rounded-xl shadow-sm border border-green-100/50">
                   <span className="text-sm font-bold text-slate-700">允許新增/編輯商品庫</span>
                   <ToggleBtn role="crew" field="editProducts" />
                </div>
                <div className="flex justify-between items-center bg-white p-3.5 rounded-xl shadow-sm border border-green-100/50">
                   <span className="text-sm font-bold text-slate-700">允許設定各門店安全庫存</span>
                   <ToggleBtn role="crew" field="editQuotas" />
                </div>
             </div>
          </div>
        </div>
      </div>

      {branches.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl mx-1 shadow-sm border border-slate-200"><Store className="w-16 h-16 text-slate-200 mx-auto mb-4" /><h2 className="text-xl font-bold text-slate-700">目前尚無註冊的門店</h2></div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-800">門店帳號管理</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {branches.map(b => {
              const currentRole = b.role === 'branch' ? 'manager' : (b.role || 'manager');
              return (
                <div key={b.username} className={`bg-white p-5 rounded-[2rem] shadow-sm border-2 flex flex-col gap-4 transition-colors ${currentRole === 'manager' ? 'border-orange-100' : 'border-green-100'}`}>
                  {editId === b.username ? (
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="text-xs font-bold text-slate-500 mb-1 block">職級權限 (店長可叫貨)</label>
                          <select value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})} className="w-full px-3 py-3 bg-blue-50 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-[15px] font-bold text-blue-800">
                            <option value="manager">⭐ 店長</option>
                            <option value="crew">👤 組員</option>
                          </select>
                        </div>
                        <div className="flex-1">
                          <label className="text-xs font-bold text-slate-500 mb-1 block">隸屬門店名稱</label>
                          <input type="text" value={editForm.branchName} onChange={e => setEditForm({...editForm, branchName: e.target.value})} className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-[15px] font-bold" />
                        </div>
                      </div>
                      <div><label className="text-xs font-bold text-slate-500 mb-1 block text-slate-400">登入帳號 (不可改)</label><input type="text" value={b.username} disabled className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-400 text-[16px] font-bold cursor-not-allowed" /></div>
                      <div><label className="text-xs font-bold text-slate-500 mb-1 block">登入密碼</label><input type="text" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-[16px] font-bold" /></div>
                      <div className="pt-2 border-t border-slate-100">
                        <label className="text-xs font-bold text-blue-600 mb-2 flex items-center gap-1"><MapPin className="w-3.5 h-3.5"/> 門店 GPS 座標設定</label>
                        <div className="flex gap-3">
                          <div className="flex-1"><input type="text" value={editForm.lat} onChange={e => setEditForm({...editForm, lat: e.target.value.trim()})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-[14px]" placeholder="緯度 (Lat)" /></div>
                          <div className="flex-1"><input type="text" value={editForm.lng} onChange={e => setEditForm({...editForm, lng: e.target.value.trim()})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-[14px]" placeholder="經度 (Lng)" /></div>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2"><button onClick={cancelEdit} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl">取消</button><button onClick={saveEdit} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-md">儲存修改</button></div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-2xl ${currentRole === 'manager' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>
                           {currentRole === 'manager' ? <Store className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                        </div>
                        <div>
                          <h4 className="font-black text-slate-800 text-[18px]">{b.branchName}</h4>
                          <div className="text-[12px] font-bold text-slate-400 mt-0.5 flex items-center gap-1.5">
                             <span className={`px-2 py-0.5 rounded text-white ${currentRole === 'manager' ? 'bg-orange-500' : 'bg-green-500'}`}>
                               {currentRole === 'manager' ? '店長' : '組員'}
                             </span>
                             分店權限正常
                          </div>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                        <div className="flex justify-between items-center text-[15px]"><span className="font-bold text-slate-500">帳號</span><span className="font-black text-slate-700">{b.username}</span></div>
                        <div className="flex justify-between items-center text-[15px]"><span className="font-bold text-slate-500">密碼</span><div className="flex items-center gap-2"><span className="font-black text-slate-700">{showPasswords[b.username] ? b.password : '••••••'}</span><button onClick={() => setShowPasswords(p => ({...p, [b.username]: !p[b.username]}))} className="p-1.5 bg-white rounded-lg border border-slate-200 text-slate-400 shadow-sm">{showPasswords[b.username] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></div>
                        <div className="flex justify-between items-center text-[15px] pt-1 border-t border-slate-200/60"><span className="font-bold text-slate-500 flex items-center gap-1"><MapPin className="w-4 h-4"/> 綁定座標</span><span className={`font-medium text-[13px] ${b.lat && b.lng ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>{b.lat && b.lng ? `${b.lat}, ${b.lng}` : '尚未設定'}</span></div>
                      </div>
                      <div className="flex gap-2">
                        {confirmDeleteId === b.username ? (
                          <><button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-3 bg-slate-100 font-bold rounded-xl text-sm">取消</button><button onClick={() => executeDelete(b.username)} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl text-sm">確定刪除</button></>
                        ) : (
                          <><button onClick={() => startEdit(b)} className="flex-1 py-3 bg-slate-800 text-white font-bold rounded-xl text-sm">編輯資料與權限</button><button onClick={() => setConfirmDeleteId(b.username)} className="py-3 px-4 border-2 border-red-100 text-red-500 rounded-xl"><Trash2 className="w-4 h-4"/></button></>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminQuotaManager({ branches, getBranchInventory, fbUser, showToast, systemConfig, products, inventoryData, systemOptions, db, appId, isBranchUser = false }) {
  const uniqueBranchNames = useMemo(() => [...new Set(branches.map(b => b.branchName))].filter(Boolean), [branches]);
  const [selectedBranch, setSelectedBranch] = useState(uniqueBranchNames.length > 0 ? uniqueBranchNames[0] : '');
  const [activeCategory, setActiveCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState(''); 

  const [newReorderUnitInput, setNewReorderUnitInput] = useState('');
  const [newReorderUnitCategory, setNewReorderUnitCategory] = useState('通用');

  const [announcementText, setAnnouncementText] = useState('');

  useEffect(() => { 
    if(!selectedBranch && uniqueBranchNames.length > 0) setSelectedBranch(uniqueBranchNames[0]); 
  }, [uniqueBranchNames, selectedBranch]);

  useEffect(() => {
    setAnnouncementText(inventoryData[selectedBranch]?.announcement || '');
  }, [selectedBranch, inventoryData]);

  if (uniqueBranchNames.length === 0) return (<div className="text-center py-20 bg-white rounded-3xl mx-4"><Store className="w-16 h-16 text-slate-200 mx-auto mb-4" /><h2 className="text-xl font-bold text-slate-700">目前尚無門店註冊</h2></div>);
  
  const activeInventory = selectedBranch ? getBranchInventory(selectedBranch) : [];
  const categories = getSortedCategories(products, systemConfig.categoryOrder);
  const hiddenCategories = inventoryData[selectedBranch]?.hiddenCategories || [];
  
  useEffect(() => { if (!activeCategory && categories.length > 0) setActiveCategory(categories[0]); }, [categories, activeCategory]);

  const handleParLevelChange = async (productId, type, newParStr) => {
    if(!fbUser || !selectedBranch) return;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', DB_INVENTORY, selectedBranch);
    
    if (type === 'reorderUnit') {
      await setDoc(docRef, { settings: { [productId]: { reorderUnit: newParStr } } }, { merge: true });
      return;
    }

    const newPar = newParStr === '' ? null : parseFloat(newParStr); 
    if (newPar !== null && isNaN(newPar)) return;
    const field = type === 'holiday' ? 'parLevelHoliday' : type === 'reorderQty' ? 'reorderQty' : 'parLevel';
    await setDoc(docRef, { settings: { [productId]: { [field]: newPar } } }, { merge: true }); 
  };

  const changeHolidayMode = async (mode) => {
    if(!fbUser) return;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_SYSTEM, 'config'), { holidayMode: mode }, { merge: true });
    showToast(`全系統已切換為：${mode === 'auto' ? '自動偵測' : mode === 'holiday' ? '手動假日' : '手動平日'}`, 'success');
  };

  const toggleGPSLock = async () => {
    if(!fbUser) return;
    const newState = !systemConfig.isGPSRequired;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_SYSTEM, 'config'), { isGPSRequired: newState }, { merge: true });
    showToast(`門店 GPS 驗證機制已${newState ? '開啟' : '關閉'}！`, 'success');
  };

  const toggleCategoryVisibility = async (cat) => {
    if(!fbUser || !selectedBranch) return;
    let newHidden = [...hiddenCategories];
    if (newHidden.includes(cat)) newHidden = newHidden.filter(c => c !== cat); 
    else newHidden.push(cat); 
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_INVENTORY, selectedBranch), { hiddenCategories: newHidden }, { merge: true });
    showToast(`已更新「${formatCategory(cat)}」的顯示設定！`, 'success');
  };

  const handleAddReorderUnit = async () => {
    if(!fbUser) return;
    const val = newReorderUnitInput.trim();
    if(!val) return;
    const newUnitObj = { name: val, category: newReorderUnitCategory };
    const exists = (systemOptions.reorderUnits || []).some(u => {
      if (typeof u === 'string') return u === val && newReorderUnitCategory === '通用';
      return u.name === val && u.category === newReorderUnitCategory;
    });
    if(exists) { showToast(`「${val}」已經存在！`, 'error'); return; }
    
    const updatedOptions = { ...systemOptions, reorderUnits: [...(systemOptions.reorderUnits || []), newUnitObj] };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_SYSTEM, 'options'), updatedOptions);
    setNewReorderUnitInput('');
    showToast(`成功新增叫貨單位：${val}`);
  };

  const handleRemoveReorderUnit = async (uToRemove) => {
    if(!fbUser) return;
    if(!window.confirm(`確定要刪除該叫貨單位選項嗎？`)) return;
    const updatedOptions = { 
      ...systemOptions, 
      reorderUnits: (systemOptions.reorderUnits || []).filter(u => {
        if (typeof u === 'string' && typeof uToRemove === 'string') return u !== uToRemove;
        if (typeof u === 'object' && typeof uToRemove === 'object') return u.name !== uToRemove.name || u.category !== uToRemove.category;
        if (typeof u === 'string' && typeof uToRemove === 'object') return u !== uToRemove.name;
        if (typeof u === 'object' && typeof uToRemove === 'string') return u.name !== uToRemove;
        return true;
      }) 
    };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_SYSTEM, 'options'), updatedOptions);
  };

  const saveAnnouncement = async () => {
    if (!fbUser || !selectedBranch) return;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', DB_INVENTORY, selectedBranch);
    await setDoc(docRef, { announcement: announcementText }, { merge: true });
    showToast('公告已成功發佈！', 'success');
  };

  const branchOptions = uniqueBranchNames.map(name => ({ value: name, label: name }));

  return (
    <div className="space-y-4">
      {!isBranchUser && (
        <>
          <div className={`p-4 rounded-2xl shadow-sm border flex items-center justify-between transition-colors ${systemConfig.isGPSRequired ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
            <div>
              <h3 className={`font-bold text-lg flex items-center gap-2 ${systemConfig.isGPSRequired ? 'text-red-800' : 'text-slate-800'}`}>
                <ShieldCheck className="w-5 h-5" /> 門店 GPS 定位鎖
              </h3>
              <p className="text-sm text-slate-500 mt-1">開啟後，門店人員必須在店面半徑 300 公尺內才能操作系統。</p>
            </div>
            <button onClick={toggleGPSLock} className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none shadow-inner ${systemConfig.isGPSRequired ? 'bg-red-500' : 'bg-slate-300'}`}>
              <span className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${systemConfig.isGPSRequired ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className={`p-4 rounded-2xl shadow-sm border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${getEffectiveHolidayMode(systemConfig.holidayMode) ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
            <div><h3 className={`font-bold text-lg flex items-center gap-2 ${getEffectiveHolidayMode(systemConfig.holidayMode) ? 'text-orange-800' : 'text-blue-800'}`}><Calendar className="w-5 h-5" />全系統安全庫存：{getEffectiveHolidayMode(systemConfig.holidayMode) ? '假日模式' : '平日模式'}</h3><p className={`text-xs mt-1 font-medium ${getEffectiveHolidayMode(systemConfig.holidayMode) ? 'text-orange-600' : 'text-blue-600'}`}>目前設定：{systemConfig.holidayMode === 'auto' ? '自動偵測' : '手動設定'}</p></div>
            <div className="flex bg-white/50 p-1 rounded-xl self-start sm:self-auto shadow-inner border border-slate-200/50">
               <button onClick={() => changeHolidayMode('auto')} className={`px-4 py-2 rounded-lg font-bold text-[13px] transition-all ${systemConfig.holidayMode === 'auto' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>自動偵測</button>
               <button onClick={() => changeHolidayMode('weekday')} className={`px-4 py-2 rounded-lg font-bold text-[13px] transition-all ${systemConfig.holidayMode === 'weekday' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>設為平日</button>
               <button onClick={() => changeHolidayMode('holiday')} className={`px-4 py-2 rounded-lg font-bold text-[13px] transition-all ${systemConfig.holidayMode === 'holiday' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500'}`}>設為假日</button>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-bold text-slate-800"><Settings className="w-5 h-5 text-blue-600" />設定門店安全庫存</div>
            <CustomDropdown value={selectedBranch} onChange={setSelectedBranch} options={branchOptions} className="w-full md:w-auto min-w-[160px]" buttonClassName="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-blue-800 h-full" />
          </div>

          {selectedBranch && (
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-4">
              <h4 className="font-bold text-slate-800 text-[14px] flex items-center gap-2 mb-2">
                <BellRing className="w-4 h-4 text-orange-500"/> 門店專屬公告欄
              </h4>
              <p className="text-xs text-slate-500 font-medium mb-3">此公告將顯示在該門店人員的「每日盤點」畫面最頂端。</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <textarea
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  placeholder="輸入要顯示給該門店的公告事項 (例如：今日高麗菜缺貨，請改推白菜...)"
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-[15px] font-bold text-slate-700 shadow-inner resize-none min-h-[60px]"
                />
                <button onClick={saveAnnouncement} className="bg-orange-100 hover:bg-orange-200 active:scale-95 text-orange-700 font-bold px-6 py-3 rounded-xl transition-all shadow-sm text-sm sm:w-auto flex items-center justify-center gap-2 border border-orange-200">
                  發佈公告
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {isBranchUser && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 font-bold text-slate-800">
             <Settings className="w-5 h-5 text-blue-600" />
             本店安全庫存與配額設定
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">此處設定的數字將直接成為您每日盤點的補貨標準。</p>
        </div>
      )}

      {selectedBranch && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-3">
             <h4 className="font-bold text-slate-800 text-[14px] flex items-center gap-2"><Eye className="w-4 h-4 text-blue-600"/> 門店盤點分類顯示</h4>
             <span className="text-xs text-slate-500 font-medium">點擊按鈕切換該門店可見的分類</span>
          </div>
          <div className="flex flex-wrap gap-2">
             {categories.map(cat => {
                const isHidden = hiddenCategories.includes(cat);
                return (
                  <button key={cat} onClick={() => toggleCategoryVisibility(cat)} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all border flex items-center gap-1.5 ${isHidden ? 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 shadow-inner' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 shadow-sm'}`}>
                    {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />} {formatCategory(cat)}
                  </button>
                )
             })}
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-3">
           <h4 className="font-bold text-slate-800 text-[14px] flex items-center gap-2"><Truck className="w-4 h-4 text-indigo-600"/> 自訂叫貨單位</h4>
           <span className="text-xs text-slate-500 font-medium hidden sm:inline">新增好的單位可供下方商品設定使用</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <select value={newReorderUnitCategory} onChange={e => setNewReorderUnitCategory(e.target.value)} className="w-full sm:w-32 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-slate-700 shadow-inner">
            <option value="通用">通用</option>
            {categories.map(c => <option key={c} value={c}>{formatCategory(c)}</option>)}
          </select>
          <div className="flex gap-2 flex-1">
            <input value={newReorderUnitInput} onChange={e => setNewReorderUnitInput(e.target.value)} type="text" placeholder="如: 箱、袋..." className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold shadow-inner" />
            <button onClick={handleAddReorderUnit} className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold px-4 py-2 rounded-xl transition-colors shadow-sm text-sm whitespace-nowrap">新增</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 min-h-[48px] content-start">
          {(systemOptions.reorderUnits || []).length === 0 && <span className="text-xs text-slate-400 mt-1">目前沒有設定任何叫貨單位...</span>}
          {(systemOptions.reorderUnits || []).map((u, i) => {
             const uName = typeof u === 'string' ? u : u.name;
             const uCat = typeof u === 'string' ? '通用' : u.category;
             return (
               <span key={`ru-quota-${i}`} className="bg-white border border-slate-200 text-slate-700 text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                 {uName}<span className={`text-[9px] px-1 rounded ${uCat === '通用' ? 'bg-slate-100 text-slate-500' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>{formatCategory(uCat) || '通用'}</span>
                 <button onClick={() => handleRemoveReorderUnit(u)} className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full p-0.5 transition-colors"><X className="w-3 h-3"/></button>
               </span>
             );
          })}
        </div>
      </div>

      <div className="flex items-center bg-white p-3 rounded-2xl shadow-sm border border-slate-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
        <Search className="w-5 h-5 text-slate-400 mx-2 flex-shrink-0" />
        <input 
          type="text" 
          placeholder="輸入商品名稱快速搜尋..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          className="flex-1 outline-none text-[16px] font-bold text-slate-700 bg-transparent" 
        />
        {searchTerm && (
          <button type="button" onClick={() => setSearchTerm('')} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {!searchTerm ? (
        <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide snap-x">
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)} className={`snap-start px-5 py-3 rounded-[1rem] font-bold whitespace-nowrap transition-all shadow-sm border text-[15px] ${activeCategory === cat ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}>{formatCategory(cat)}</button>
          ))}
        </div>
      ) : (
        <div className="text-sm font-bold text-blue-600 px-2 flex items-center gap-2"><Search className="w-4 h-4"/> 正在顯示「{searchTerm}」的搜尋結果...</div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="divide-y divide-slate-100">
          {activeInventory.filter(i => searchTerm ? i.name.toLowerCase().includes(searchTerm.toLowerCase()) : i.category === activeCategory).map(item => {
            const availableReorderUnits = (systemOptions.reorderUnits || []).filter(u => {
              const uCat = typeof u === 'string' ? '通用' : u.category;
              return uCat === '通用' || uCat === item.category;
            });

            return (
              <div key={item.id} className="flex flex-col xl:flex-row xl:items-center justify-between p-5 gap-4 hover:bg-slate-50 transition-colors">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block sm:inline sm:mr-2">{formatCategory(item.category)}</span>
                  <span className="font-bold text-slate-800 text-[18px]">{item.name}</span>
                </div>
                <div className="flex flex-col gap-2 self-end xl:self-auto w-full xl:w-auto">
                  <div className="flex items-center justify-end gap-2">
                    <div className="flex items-center bg-slate-50 p-1.5 rounded-xl border border-slate-200"><span className="text-[11px] font-bold text-slate-500 px-2 whitespace-nowrap">平日安全</span><input type="number" min="0" step="0.5" inputMode="decimal" value={item.parLevel} onChange={(e) => handleParLevelChange(item.id, 'regular', e.target.value)} className="w-16 sm:w-20 px-2 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-center font-black text-blue-700 text-[18px] shadow-inner" /></div>
                    <div className="flex items-center bg-orange-50 p-1.5 rounded-xl border border-orange-200"><span className="text-[11px] font-bold text-orange-600 px-2 whitespace-nowrap">假日安全</span><input type="number" min="0" step="0.5" inputMode="decimal" value={item.parLevelHoliday} onChange={(e) => handleParLevelChange(item.id, 'holiday', e.target.value)} className="w-16 sm:w-20 px-2 py-1.5 bg-white border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-center font-black text-orange-700 text-[18px] shadow-inner" /></div>
                    <span className="text-slate-500 font-bold px-1 text-sm shrink-0 w-8">{item.unit}</span>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <div className="flex items-center bg-indigo-50 p-1.5 rounded-xl border border-indigo-200 shadow-sm">
                      <span className="text-[11px] font-bold text-indigo-700 px-2 whitespace-nowrap">低於安全值，固定叫貨：</span>
                      <input 
                        type="number" min="0" step="0.5" inputMode="decimal" 
                        placeholder={item.defaultReorderQty ? `${item.defaultReorderQty}` : "補差額"} 
                        value={item.reorderQty || ''} 
                        onChange={(e) => handleParLevelChange(item.id, 'reorderQty', e.target.value)} 
                        className="w-20 sm:w-24 px-2 py-1.5 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-center font-black text-indigo-700 text-[16px] shadow-inner" 
                      />
                      <select 
                        value={item.reorderUnit || ''} 
                        onChange={(e) => handleParLevelChange(item.id, 'reorderUnit', e.target.value)} 
                        className="w-20 sm:w-24 ml-1 px-1 py-1.5 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-center font-bold text-indigo-600 text-[14px] shadow-inner cursor-pointer"
                      >
                        <option value="">{item.defaultReorderUnit || item.unit}</option>
                        {availableReorderUnits.map((u, i) => {
                           const uName = typeof u === 'string' ? u : u.name;
                           return <option key={i} value={uName}>{uName}</option>;
                        })}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AdminOrderHistory({ ordersData, branches, showToast, resolveOrderIssueCloud }) {
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [exportImgUrl, setExportImgUrl] = useState(null); 
  
  const [resolvingIssue, setResolvingIssue] = useState(null);
  const [resolveNote, setResolveNote] = useState('');

  const branchColors = useMemo(() => {
    const palettes = [
      { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', iconBg: 'bg-blue-100', iconText: 'text-blue-600' },
      { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600' },
      { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', iconBg: 'bg-purple-100', iconText: 'text-purple-600' },
      { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', iconBg: 'bg-rose-100', iconText: 'text-rose-600' },
      { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', iconBg: 'bg-amber-100', iconText: 'text-amber-600' },
      { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-800', iconBg: 'bg-teal-100', iconText: 'text-teal-600' },
      { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-800', iconBg: 'bg-pink-100', iconText: 'text-pink-600' },
      { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800', iconBg: 'bg-indigo-100', iconText: 'text-indigo-600' },
    ];
    const colorMap = {};
    branches.forEach((b, idx) => { colorMap[b.username] = palettes[idx % palettes.length]; });
    return colorMap;
  }, [branches]);
  const defaultColor = { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-800', iconBg: 'bg-slate-100', iconText: 'text-slate-500' };

  const filteredOrders = useMemo(() => {
    return ordersData.filter(o => {
      if (filterBranch !== 'all' && o.branchName !== filterBranch) return false;
      if (filterDate) {
        const orderDate = new Date(o.timestamp);
        const selectedDate = new Date(filterDate);
        if (orderDate.getFullYear() !== selectedDate.getFullYear() || orderDate.getMonth() !== selectedDate.getMonth() || orderDate.getDate() !== selectedDate.getDate()) return false;
      }
      return true;
    });
  }, [ordersData, filterBranch, filterDate]);

  const uniqueBranchNames = useMemo(() => [...new Set(branches.map(b => b.branchName))].filter(Boolean), [branches]);
  const branchOptions = [{ value: 'all', label: '所有門店' }, ...uniqueBranchNames.map(name => ({ value: name, label: name }))];

  // ⭐ 全新強大的截圖引擎 (支援 html-to-image)
  const handleExportCard = async (elementId) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    showToast('正在處理圖檔，請稍候...', 'success');
    
    setTimeout(async () => {
      try {
        // 首選：現代化 htmlToImage 引擎 (絕不崩潰)
        if (window.htmlToImage) {
          const dataUrl = await window.htmlToImage.toJpeg(el, { 
            quality: 0.9, 
            backgroundColor: '#ffffff',
            pixelRatio: 2,
            filter: (node) => (node.getAttribute ? node.getAttribute('data-export-ignore') !== 'true' : true)
          });
          setExportImgUrl(dataUrl);
          return;
        }
        
        // 備用：舊版 html2canvas
        if (window.html2canvas) {
          const canvas = await window.html2canvas(el, { 
            scale: 2, 
            backgroundColor: '#ffffff', 
            useCORS: true, 
            logging: false,
            ignoreElements: (node) => node.getAttribute && node.getAttribute('data-export-ignore') === 'true'
          });
          setExportImgUrl(canvas.toDataURL('image/jpeg', 0.9));
          return;
        }
        
        showToast('截圖元件載入中，請稍候', 'error');
      } catch (err) {
        console.error('Image Export Error:', err);
        showToast('圖片產生失敗，請直接使用手機螢幕截圖', 'error');
      }
    }, 600);
  };

  return (
    <div className="space-y-4 relative">
      {exportImgUrl && <ImageExportModal imageUrl={exportImgUrl} onClose={() => setExportImgUrl(null)} />}
      
      {resolvingIssue && (
        <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><CheckCircle2 className="w-6 h-6 text-green-500"/> 標記為「已解決」</h3>
            <p className="text-sm text-slate-500 mb-3 font-medium">請輸入處理結果 (例如：廠商下期扣款、已於下午補送新品)：</p>
            <textarea
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none mb-6 text-[15px] font-medium resize-none h-28 shadow-inner"
              placeholder="處理備註 (選填)..."
            />
            <div className="flex gap-3">
              <button onClick={() => {setResolvingIssue(null); setResolveNote('');}} className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors">取消</button>
              <button onClick={() => { resolveOrderIssueCloud(resolvingIssue.orderId, resolvingIssue.category, resolveNote); setResolvingIssue(null); setResolveNote(''); }} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-2xl shadow-md transition-colors flex items-center justify-center gap-2 active:scale-95"><CheckCircle2 className="w-5 h-5"/>確認結案</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-3 items-center justify-between">
        <h3 className="font-bold text-slate-800 flex items-center gap-2 self-start md:self-auto"><Search className="w-5 h-5 text-blue-600" /> 紀錄查詢</h3>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
          <CustomDropdown value={filterBranch} onChange={setFilterBranch} options={branchOptions} className="w-full sm:flex-1 md:flex-none min-w-[140px]" buttonClassName="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700" />
          <div className="flex w-full gap-2">
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="flex-1 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-[16px] text-slate-700 focus:ring-2 focus:ring-blue-500" />
            {(filterBranch !== 'all' || filterDate) && (<button onClick={() => {setFilterBranch('all'); setFilterDate('');}} className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors text-sm font-bold whitespace-nowrap">清除</button>)}
          </div>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-slate-200 mx-1"><History className="w-16 h-16 text-slate-200 mx-auto mb-4" /><h2 className="text-xl font-bold text-slate-700">查無相關叫貨紀錄</h2></div>
      ) : (
        filteredOrders.map(order => {
          const bColor = branchColors[order.branchUsername] || defaultColor;
          const groupedByCategory = order.items.reduce((acc, item) => {
            if (!acc[item.category]) acc[item.category] = [];
            acc[item.category].push(item);
            return acc;
          }, {});

          return (
            <div key={order.id} className="mb-8 border-b-2 border-slate-100 pb-8 last:border-0 last:pb-0">
              {Object.entries(groupedByCategory).map(([category, items]) => {
                const cardId = `admin-export-${order.id}-${category}`;
                const isCatReceived = (order.receivedCategories || []).includes(category);
                
                return (
                  <div key={category} id={cardId} className="bg-[#fffdf8] border-2 border-[#fde6ca] rounded-[1.5rem] p-5 mb-4 shadow-sm relative">
                     <button data-export-ignore="true" onClick={() => handleExportCard(cardId)} className="absolute top-4 right-4 p-2 bg-white rounded-full text-slate-400 hover:text-orange-600 transition-colors shadow-sm border border-slate-200 active:scale-95"><Download className="w-4 h-4" /></button>
                     
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-orange-100/50 pb-3 pr-12 gap-2">
                       <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl shadow-sm border ${bColor.iconBg} ${bColor.border}`}><Store className={`w-5 h-5 ${bColor.iconText}`} /></div>
                          <div>
                            <h3 className={`font-bold text-[18px] tracking-wide ${bColor.text}`}>{order.branchName} 叫貨單: <span className="text-orange-600">{formatCategory(category)}</span></h3>
                            <p className={`text-[12px] font-bold mt-1 opacity-80 ${bColor.text}`}>{order.date.split(' ')[0]} · 單號: {order.id}</p>
                          </div>
                       </div>
                       <StatusBadge status={isCatReceived ? 'received' : order.status} />
                     </div>

                     <div className="space-y-3">
                       {items.map((item, idx) => (
                         <div key={idx} className="flex justify-between items-center px-1 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                           <span className="font-bold text-slate-700 text-[17px]">{item.name}</span>
                           <div className="flex items-baseline gap-2">
                             <span className="text-[12px] text-slate-400 font-bold">叫貨</span>
                             <span className="text-[26px] font-black text-orange-600 leading-none">
                               {item.actualQty !== undefined && item.actualQty !== item.orderQty ? (
                                 <><span className="line-through text-slate-300 text-[16px] mr-1.5">{item.orderQty}</span><span className="text-red-600">{item.actualQty}</span></>
                               ) : item.orderQty}
                             </span>
                             <span className="text-[14px] font-bold text-slate-500 w-8">{item.unit}</span>
                           </div>
                         </div>
                       ))}
                     </div>
                     
                     {order.issues && order.issues.some(iss => iss.category === category) && (() => {
                       const issue = order.issues.find(iss => iss.category === category);
                       const isResolved = issue.resolved;

                       return (
                         <div className={`mt-4 border rounded-2xl p-4 flex flex-col sm:flex-row gap-4 relative shadow-inner ${isResolved ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-100'}`}>
                            <div className={`absolute -top-3 left-4 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1 ${isResolved ? 'bg-green-500' : 'bg-red-500'}`}>
                               {isResolved ? <CheckCircle2 className="w-3.5 h-3.5"/> : <AlertCircle className="w-3.5 h-3.5"/>}
                               {isResolved ? '異常已結案' : '點收異常'}
                            </div>
                            
                            <div className="flex-1 mt-2 sm:mt-0">
                               <p className={`text-[15px] font-bold whitespace-pre-wrap ${isResolved ? 'text-green-800' : 'text-red-800'}`}>{issue.reason}</p>
                               {isResolved && issue.resolveNote && (
                                 <div className="mt-2.5 p-2.5 bg-white/60 rounded-xl border border-green-200/60 text-sm text-green-700 font-medium">
                                   <span className="font-bold mr-1">處理結果：</span>{issue.resolveNote}
                                 </div>
                               )}
                            </div>

                            <div className="flex flex-col sm:items-end gap-3 shrink-0">
                              {issue.photo && (
                                 <img 
                                   src={issue.photo} alt="異常佐證" 
                                   className="h-24 w-24 object-cover rounded-xl border-2 border-white shadow-sm cursor-pointer hover:opacity-80 transition-opacity" 
                                   onClick={() => window.open(issue.photo)} 
                                   title="點擊可放大檢視"
                                 />
                              )}
                              {!isResolved && (
                                <button data-export-ignore="true" onClick={() => setResolvingIssue({orderId: order.id, category})} className="px-4 py-2 bg-green-600 hover:bg-green-700 active:scale-95 text-white text-sm font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 w-full sm:w-auto">
                                  <CheckCircle2 className="w-4 h-4"/> 標記為已解決
                                </button>
                              )}
                            </div>
                         </div>
                       );
                     })()}

                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}

function AdminAnalytics({ ordersData, branches }) {
  const [filterBranch, setFilterBranch] = useState('all');
  const [timeRange, setTimeRange] = useState('week'); 
  
  const timeOptions = [
    { value: 'week', label: '近一週' },
    { value: 'month', label: '近一個月' }
  ];
  
  const uniqueBranchNames = useMemo(() => [...new Set(branches.map(b => b.branchName))].filter(Boolean), [branches]);
  const branchOptions = [{ value: 'all', label: '所有門店' }, ...uniqueBranchNames.map(name => ({ value: name, label: name }))];

  const analyticsData = useMemo(() => {
    const now = Date.now();
    const timeLimit = timeRange === 'week' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    const validOrders = ordersData.filter(o => {
      if (filterBranch !== 'all' && o.branchName !== filterBranch) return false;
      if (now - o.timestamp > timeLimit) return false;
      return true;
    });
    const totals = {};
    validOrders.forEach(o => { o.items.forEach(item => { if (!totals[item.id]) totals[item.id] = { name: item.name, category: item.category, unit: item.unit, qty: 0 }; totals[item.id].qty += Number(item.orderQty); }); });
    const grouped = {};
    Object.values(totals).forEach(item => { if (!grouped[item.category]) grouped[item.category] = []; grouped[item.category].push(item); });
    Object.keys(grouped).forEach(cat => { grouped[cat].sort((a, b) => b.qty - a.qty); });
    return grouped;
  }, [ordersData, filterBranch, timeRange]);

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-3 items-center justify-between">
        <h3 className="font-bold text-slate-800 flex items-center gap-2"><BarChart2 className="w-5 h-5 text-blue-600" /> 叫貨統計分析</h3>
        <div className="flex w-full md:w-auto gap-2">
          <CustomDropdown value={filterBranch} onChange={setFilterBranch} options={branchOptions} className="flex-1 min-w-[120px]" buttonClassName="px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700" />
          <CustomDropdown value={timeRange} onChange={setTimeRange} options={timeOptions} className="flex-1 min-w-[100px]" buttonClassName="px-3 py-3 bg-blue-50 border border-blue-200 rounded-xl font-bold text-blue-800" />
        </div>
      </div>
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-4 md:p-8">
        {Object.keys(analyticsData).length === 0 ? (
          <div className="text-center py-10"><BarChart2 className="w-12 h-12 text-slate-200 mx-auto mb-3" /><p className="text-slate-500 font-medium">該區間內尚無叫貨數據</p></div>
        ) : (
          <div className="space-y-6">
            {Object.entries(analyticsData).map(([category, items]) => {
              const maxQty = Math.max(...items.map(d => d.qty));
              return (
                <div key={category} className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100">
                  <h4 className="font-black text-slate-700 mb-4 flex items-center gap-2 border-b border-slate-200 pb-3 text-[16px]"><Layers className="w-5 h-5 text-blue-500" />{formatCategory(category)}</h4>
                  <div className="space-y-4">
                    {items.map((item, idx) => {
                      const percentage = Math.max(2, (item.qty / maxQty) * 100); 
                      return (
                        <div key={idx} className="flex flex-col gap-1.5">
                          <div className="flex justify-between items-end px-1"><span className="font-bold text-slate-700 text-[15px]">{item.name}</span><span className="font-black text-blue-600 text-lg">{item.qty} <span className="text-xs text-slate-500">{item.unit}</span></span></div>
                          <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden"><div className="bg-blue-500 h-2.5 rounded-full transition-all duration-1000 ease-out" style={{ width: `${percentage}%` }}></div></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 門店視圖 (Branch Views)
// ==========================================
function BranchViews({ user, fbUser, products, inventoryData, ordersData, branchInventory, showToast, systemConfig, systemOptions, db, appId, resolveOrderIssueCloud }) {
  const [activeTab, setActiveTab] = useState('inventory');
  
  const isManager = user.role === 'manager' || user.role === 'branch'; 

  const actualRole = user.role === 'branch' ? 'manager' : user.role;
  const canEditProducts = systemConfig?.permissions?.[actualRole]?.editProducts;
  const canEditQuotas = systemConfig?.permissions?.[actualRole]?.editQuotas;
  
  const branchOrders = useMemo(() => {
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - 2);
    limitDate.setHours(0, 0, 0, 0);
    const limitTime = limitDate.getTime();

    return ordersData.filter(o => {
      if (o.branchName !== user.branchName) return false;
      const hasUnresolvedIssue = o.issues && o.issues.some(iss => !iss.resolved);
      if (hasUnresolvedIssue) return true;
      return o.status !== 'received' || o.timestamp >= limitTime;
    });
  }, [ordersData, user.branchName]);

  useEffect(() => {
    if (!fbUser || !user?.branchName) return;
    
    const todayStr = (() => {
      const today = new Date();
      return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    })();

    const branchDoc = inventoryData[user.branchName] || {};
    
    if (branchDoc.lastResetDate !== todayStr) {
      const currentSettings = branchDoc.settings || {};
      const newSettings = {};
      let needsReset = false;

      Object.keys(currentSettings).forEach(k => {
        if (currentSettings[k].currentStock !== '') {
          newSettings[k] = { currentStock: '' }; 
          needsReset = true;
        }
      });

      const docRef = doc(db, 'artifacts', appId, 'public', 'data', DB_INVENTORY, user.branchName);
      
      setDoc(docRef, {
        settings: newSettings,
        lastResetDate: todayStr
      }, { merge: true }).then(() => {
        if (needsReset) {
          showToast('已跨日換日，今日商品盤點數量已自動歸零！', 'success');
        }
      });
    }
  }, [fbUser, user?.branchName, inventoryData[user?.branchName]?.lastResetDate, db, appId]);

  const tabs = [
    { id: 'inventory', icon: <ClipboardList />, label: '盤點' },
    ...(isManager ? [{ id: 'orders', icon: <ShoppingCart />, label: '叫貨' }] : []),
    { id: 'receiving', icon: <Truck />, label: '進貨' },
    ...(canEditQuotas ? [{ id: 'quotas', icon: <Settings />, label: '配額' }] : []),
    ...(canEditProducts ? [{ id: 'products', icon: <Database />, label: '商品' }] : [])
  ];

  const updateStockCloud = async (productId, newStockValue) => {
    if(!fbUser) return;
    const valueToSave = newStockValue === '' ? '' : parseFloat(newStockValue); 
    if (valueToSave !== '' && isNaN(valueToSave)) return;

    const todayStr = (() => {
      const today = new Date();
      return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    })();

    const docRef = doc(db, 'artifacts', appId, 'public', 'data', DB_INVENTORY, user.branchName);
    await setDoc(docRef, { 
      settings: { [productId]: { currentStock: valueToSave } },
      lastResetDate: todayStr
    }, { merge: true });
  };

  const addOrderCloud = async (newOrderData) => {
    if(!fbUser) return;
    const orderDoc = { ...newOrderData, branchUsername: user.username, branchName: user.branchName, timestamp: Date.now() };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_ORDERS, newOrderData.id), orderDoc);
  };

  const updateOrderPartialReceiptCloud = async (orderId, receivedCategories, newStatus, newItems = null, newIssues = null) => {
    if(!fbUser) return;
    const updatePayload = { 
      receivedCategories, 
      status: newStatus 
    };
    if (newItems) updatePayload.items = newItems;
    if (newIssues) updatePayload.issues = newIssues;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_ORDERS, orderId), updatePayload);
  };

  const branchData = inventoryData[user.branchName] || {};
  const hiddenCategories = branchData.hiddenCategories || [];

  return (
    <>
      <div className="p-3 md:p-8 max-w-4xl mx-auto w-full">
         <div className="hidden md:flex space-x-2 mb-8 bg-slate-200/50 p-1.5 rounded-xl w-max">
           {tabs.map(t => (
             <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-5 py-2.5 rounded-lg font-bold transition-all ${activeTab === t.id ? (isManager ? 'bg-white text-orange-600 shadow-sm' : 'bg-white text-green-600 shadow-sm') : 'text-slate-500 hover:text-slate-700'}`}>
               <div className="flex items-center gap-2">{React.cloneElement(t.icon, { className: 'w-4 h-4' })} {t.label}</div>
             </button>
           ))}
        </div>
        
        {activeTab === 'inventory' && <BranchInventoryCheck inventory={branchInventory} hiddenCategories={hiddenCategories} updateStockCloud={updateStockCloud} addOrderCloud={addOrderCloud} showToast={showToast} systemConfig={systemConfig} products={products} systemOptions={systemOptions} isManager={isManager} branchData={branchData} />}
        {activeTab === 'orders' && isManager && <BranchOrderManagement purchaseOrders={branchOrders} showToast={showToast} />}
        {activeTab === 'receiving' && <BranchReceivingCheck inventory={branchInventory} updateStockCloud={updateStockCloud} purchaseOrders={branchOrders} updateOrderPartialReceiptCloud={updateOrderPartialReceiptCloud} showToast={showToast} resolveOrderIssueCloud={resolveOrderIssueCloud} />}
        
        {activeTab === 'quotas' && canEditQuotas && (
          <AdminQuotaManager branches={[{username: user.username, branchName: user.branchName}]} getBranchInventory={getBranchInventory} fbUser={fbUser} showToast={showToast} systemConfig={systemConfig} products={products} inventoryData={inventoryData} systemOptions={systemOptions} db={db} appId={appId} isBranchUser={true} />
        )}
        {activeTab === 'products' && canEditProducts && (
          <AdminProductManager products={products} showToast={showToast} fbUser={fbUser} systemOptions={systemOptions} systemConfig={systemConfig} db={db} appId={appId} />
        )}
      </div>
      <BottomNav tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} themeColor={isManager ? 'text-orange-600' : 'text-green-600'} />
    </>
  );
}

function BranchInventoryCheck({ inventory, hiddenCategories, updateStockCloud, addOrderCloud, showToast, systemConfig, products, systemOptions, isManager, branchData }) {
  const [activeCategory, setActiveCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState(''); 
  
  const announcement = branchData?.announcement;

  const visibleInventory = useMemo(() => {
    return inventory.filter(i => !hiddenCategories.includes(i.category));
  }, [inventory, hiddenCategories]);

  const categories = getSortedCategories(products, systemConfig.categoryOrder, systemOptions.categories).filter(c => !hiddenCategories.includes(c));

  useEffect(() => { 
    if ((!activeCategory || !categories.includes(activeCategory)) && categories.length > 0) {
      setActiveCategory(categories[0]); 
    }
  }, [categories, activeCategory]);

  const generatePurchaseOrder = () => {
    if (!isManager) { showToast('僅限店長操作叫貨功能！', 'error'); return; }

    const itemsToOrder = visibleInventory
      .filter(item => {
        const stockNum = parseFloat(item.currentStock) || 0;
        return stockNum < item.activeParLevel;
      })
      .map(item => {
        const stockNum = parseFloat(item.currentStock) || 0;
        const diff = item.activeParLevel - stockNum;
        
        const finalOrderQty = item.reorderQty && item.reorderQty > 0 
          ? parseFloat(item.reorderQty) 
          : parseFloat(diff.toFixed(1)); 
          
        const finalUnit = item.reorderQty && item.reorderQty > 0 && item.reorderUnit
          ? item.reorderUnit
          : item.unit;
        
        return {
          id: item.id, category: item.category, name: item.name, 
          unit: finalUnit, 
          currentStock: stockNum, parLevel: item.activeParLevel, 
          orderQty: Math.max(0, finalOrderQty)
        };
      });

    if (itemsToOrder.length === 0) { 
      showToast(`「${formatCategory(activeCategory)}」庫存充足，達到安全庫存！`, 'success'); 
      return; 
    }
    
    const baseTimestamp = Date.now();
    const baseIdStr = baseTimestamp.toString().slice(-6);
    const cleanCategory = activeCategory.replace(/[【】\[\]《》〈〉()]/g, '');
    const orderId = `PO-${cleanCategory}-${baseIdStr}`; 

    const newOrder = { 
      id: orderId, date: new Date(baseTimestamp).toLocaleString(), status: 'pending', receivedCategories: [], items: itemsToOrder 
    };

    addOrderCloud(newOrder);
    showToast(`已成功產生「${formatCategory(activeCategory)}」叫貨單！`);
  };

  const effectiveIsHoliday = getEffectiveHolidayMode(systemConfig.holidayMode);
  let modeText = systemConfig.holidayMode === 'auto' 
    ? (effectiveIsHoliday ? '自動偵測 (前日為週末假日)' : '自動偵測 (前日為平日)')
    : (effectiveIsHoliday ? '總部設定 (假日)' : '總部設定 (平日)');

  return (
    <div className="space-y-4">
      {announcement && (
        <div className="bg-gradient-to-r from-amber-100 to-orange-100 border-l-[6px] border-orange-500 p-5 rounded-2xl shadow-md mb-6 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-10">
            <BellRing className="w-24 h-24 text-orange-800" />
          </div>
          <div className="flex items-start gap-4 relative z-10">
            <div className="bg-orange-500 text-white p-2.5 rounded-xl shadow-sm mt-0.5 animate-pulse">
              <BellRing className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-black text-orange-900 text-[18px] mb-1.5 tracking-widest">總管理處公告</h3>
              <p className="text-orange-900 font-bold whitespace-pre-wrap leading-relaxed text-[16px]">{announcement}</p>
            </div>
          </div>
        </div>
      )}

      <div className={`px-4 py-3.5 rounded-[1.5rem] flex items-center justify-between shadow-sm ${effectiveIsHoliday ? 'bg-orange-100 border-2 border-orange-200' : 'bg-blue-50 border-2 border-blue-200'}`}>
         <div className={`flex flex-col font-bold ${effectiveIsHoliday ? 'text-orange-800' : 'text-blue-800'}`}>
           <div className="flex items-center gap-2 text-[15px]"><Calendar className="w-5 h-5 flex-shrink-0" />目前適用：{effectiveIsHoliday ? '假日安全庫存' : '平日安全庫存'}</div>
           <div className={`text-[12px] mt-0.5 ml-7 opacity-80`}>{modeText}</div>
         </div>
      </div>
      
      <div className="flex justify-between items-center sticky top-[60px] md:top-0 z-10 bg-slate-50/95 backdrop-blur-md pt-2 pb-4 border-b border-slate-200/50">
        <h2 className="text-[24px] font-black text-slate-800 tracking-wide">每日盤點</h2>
        {isManager ? (
          <button onClick={generatePurchaseOrder} className="bg-orange-600 hover:bg-orange-700 active:scale-95 text-white px-5 py-3 rounded-2xl font-bold shadow-lg shadow-orange-600/30 flex items-center gap-2 transition-all text-[15px]">
            <ShoppingCart className="w-5 h-5" /><span className="hidden sm:inline">送出叫貨單</span><span className="sm:hidden">叫貨</span>
          </button>
        ) : (
          <div className="bg-slate-200 text-slate-500 px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4"/> <span className="hidden sm:inline">叫貨由店長負責</span><span className="sm:hidden">僅開放盤點</span>
          </div>
        )}
      </div>

      <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide -mx-3 px-3 snap-x">
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)} className={`snap-start px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-all shadow-sm border text-[16px] ${activeCategory === cat ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            {formatCategory(cat)}
          </button>
        ))}
      </div>
      
      <div className="flex items-center bg-white p-3 rounded-2xl shadow-sm border border-slate-200 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100 transition-all mt-2 mb-4 mx-1">
        <Search className="w-5 h-5 text-slate-400 mx-2 flex-shrink-0" />
        <input 
          type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} 
          placeholder="輸入商品名稱快速搜尋..." 
          className="flex-1 outline-none text-[16px] font-bold text-slate-700 bg-transparent"
        />
        {searchTerm && (
          <button type="button" onClick={() => setSearchTerm('')} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"><X className="w-4 h-4" /></button>
        )}
      </div>

      {searchTerm && (
        <div className="text-sm font-bold text-orange-600 px-2 mb-3 flex items-center gap-2">
          <Search className="w-4 h-4"/> 顯示「{searchTerm}」的結果 (點擊切換分類)
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
        {visibleInventory.filter(i => searchTerm ? i.name.toLowerCase().includes(searchTerm.toLowerCase()) : i.category === activeCategory).map(item => {
          const stockNum = parseFloat(item.currentStock) || 0;
          const isDeficient = stockNum < item.activeParLevel;
          return (
            <div 
              key={item.id} 
              onClick={() => setActiveCategory(item.category)}
              className={`p-5 rounded-[1.8rem] border-2 transition-colors relative shadow-sm cursor-pointer ${isDeficient ? 'bg-[#fffbf0] border-orange-200' : 'bg-white border-slate-100'} ${searchTerm && activeCategory === item.category ? 'ring-2 ring-orange-400 border-orange-400' : ''}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  {searchTerm && <span className="text-[11px] font-bold text-slate-400 block mb-0.5">{formatCategory(item.category)}</span>}
                  <h3 className="text-[20px] font-black text-slate-800 tracking-wide">{item.name}</h3>
                  <div className="text-[13px] mt-1 font-bold text-slate-500">
                    安全庫存: <span className="text-blue-600 text-[15px]">{item.activeParLevel}</span> {item.unit}
                  </div>
                </div>
                {isDeficient && (
                  <div className="bg-red-100 text-red-600 px-3 py-1.5 rounded-xl text-[12px] font-black flex items-center gap-1 border border-red-200/50 shadow-sm">
                    <AlertCircle className="w-4 h-4" /> 
                    {item.reorderQty > 0 ? `將叫貨 ${item.reorderQty}${item.reorderUnit || item.unit}` : '需補差額'}
                  </div>
                )}
              </div>
              
              <div className="mt-4 bg-white border border-slate-200 rounded-[1.2rem] flex items-center p-2.5 shadow-inner relative focus-within:ring-2 focus-within:ring-orange-400 focus-within:border-orange-400 transition-all">
                <div className="flex flex-col items-center justify-center text-[11px] text-slate-400 font-black leading-[1.2] w-6 select-none ml-1">
                  <span>實</span><span>有</span><span>庫</span><span>存</span>
                </div>
                <div className="flex-1 relative flex items-center justify-center h-[46px] px-2">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    inputMode="decimal"
                    value={item.currentStock}
                    onChange={(e) => { 
                      updateStockCloud(item.id, e.target.value); 
                      setActiveCategory(item.category); 
                    }}
                    className="w-full h-full bg-transparent text-center text-[28px] font-black text-orange-600 outline-none placeholder-slate-300"
                    placeholder="數量"
                  />
                </div>
                <div className="w-8 text-center text-[15px] font-bold text-slate-500 select-none mr-1">{item.unit}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}

function BranchOrderManagement({ purchaseOrders, showToast }) {
  const [exportImgUrl, setExportImgUrl] = useState(null); 

  // ⭐ 全新升級：更強大防錯的截圖輸出引擎
  const handleExportCard = async (elementId) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    showToast('正在處理圖檔，請稍候...', 'success');
    
    setTimeout(async () => {
      try {
        if (window.htmlToImage) {
          const dataUrl = await window.htmlToImage.toJpeg(el, { 
            quality: 0.9, 
            backgroundColor: '#ffffff',
            pixelRatio: 2,
            filter: (node) => (node.getAttribute ? node.getAttribute('data-export-ignore') !== 'true' : true)
          });
          setExportImgUrl(dataUrl);
          return;
        }
        
        if (window.html2canvas) {
          const canvas = await window.html2canvas(el, { 
            scale: 2, 
            backgroundColor: '#ffffff', 
            useCORS: true, 
            logging: false,
            ignoreElements: (node) => node.getAttribute && node.getAttribute('data-export-ignore') === 'true'
          });
          setExportImgUrl(canvas.toDataURL('image/jpeg', 0.9));
          return;
        }
        
        showToast('截圖元件載入中，請稍候', 'error');
      } catch (err) {
        console.error('Image Export Error:', err);
        showToast('圖片產生失敗，請直接使用手機截圖', 'error');
      }
    }, 600);
  };

  if (purchaseOrders.length === 0) {
    return (<div className="text-center py-20 bg-white rounded-3xl mt-4 mx-1 shadow-sm border border-slate-100"><Package className="w-16 h-16 text-slate-200 mx-auto mb-4" /><h2 className="text-xl font-bold text-slate-700">目前沒有叫貨單</h2><p className="text-sm text-slate-500 mt-2">盤點低於安全庫存即可自動產生</p></div>);
  }

  return (
    <div className="space-y-4 pt-2">
      {exportImgUrl && <ImageExportModal imageUrl={exportImgUrl} onClose={() => setExportImgUrl(null)} />}
      
      <h2 className="text-[24px] font-black text-slate-800 mb-4 px-1">叫貨單總覽</h2>
      {purchaseOrders.map(order => {
        const groupedByCategory = order.items.reduce((acc, item) => {
          if (!acc[item.category]) acc[item.category] = [];
          acc[item.category].push(item);
          return acc;
        }, {});

        return (
          <div key={order.id} className="mb-6 border-b-2 border-slate-100 pb-6 last:border-0 last:pb-0">
            {Object.entries(groupedByCategory).map(([category, items]) => {
              const isCatReceived = (order.receivedCategories || []).includes(category);
              const cardId = `branch-export-${order.id}-${category}`;

              return (
                <div key={category} id={cardId} className="bg-[#fffdf8] border-2 border-[#fde6ca] rounded-[1.5rem] p-5 mb-4 shadow-sm relative">
                   <button data-export-ignore="true" onClick={() => handleExportCard(cardId)} className="absolute top-4 right-4 p-2 bg-white rounded-full text-slate-400 hover:text-orange-600 transition-colors shadow-sm border border-slate-200 active:scale-95"><Download className="w-4 h-4" /></button>
                   
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-orange-100/50 pb-3 pr-12 gap-2">
                     <div>
                       <h3 className="text-[18px] font-black text-slate-800 tracking-wide">叫貨單: <span className="text-orange-600">{formatCategory(category)}</span></h3>
                       <p className="text-[12px] font-bold text-slate-500 mt-1">{order.date.split(' ')[0]} · 單號: {order.id}</p>
                     </div>
                     <StatusBadge status={isCatReceived ? 'received' : order.status} />
                   </div>

                   <div className="space-y-3">
                     {items.map((item, idx) => (
                       <div key={idx} className="flex justify-between items-center px-1 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                         <span className="font-bold text-slate-700 text-[17px]">{item.name}</span>
                         <div className="flex items-baseline gap-2">
                           <span className="text-[12px] text-slate-400 font-bold">叫貨</span>
                           <span className="text-[26px] font-black text-orange-600 leading-none">
                             {item.actualQty !== undefined && item.actualQty !== item.orderQty ? (
                               <><span className="line-through text-slate-300 text-[16px] mr-1.5">{item.orderQty}</span><span className="text-red-600">{item.actualQty}</span></>
                             ) : item.orderQty}
                           </span>
                           <span className="text-[14px] font-bold text-slate-500 w-8">{item.unit}</span>
                         </div>
                       </div>
                     ))}
                   </div>
                   
                   {order.issues && order.issues.some(iss => iss.category === category) && (() => {
                     const issue = order.issues.find(iss => iss.category === category);
                     const isResolved = issue.resolved;

                     return (
                       <div className={`mt-4 border rounded-2xl p-4 flex flex-col sm:flex-row gap-4 relative shadow-inner ${isResolved ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-100'}`}>
                          <div className={`absolute -top-3 left-4 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1 ${isResolved ? 'bg-green-500' : 'bg-red-500'}`}>
                             {isResolved ? <CheckCircle2 className="w-3.5 h-3.5"/> : <AlertCircle className="w-3.5 h-3.5"/>}
                             {isResolved ? '異常已結案' : '點收異常'}
                          </div>
                          
                          <div className="flex-1 mt-2 sm:mt-0">
                             <p className={`text-[15px] font-bold whitespace-pre-wrap ${isResolved ? 'text-green-800' : 'text-red-800'}`}>{issue.reason}</p>
                             {isResolved && issue.resolveNote && (
                               <div className="mt-2.5 p-2.5 bg-white/60 rounded-xl border border-green-200/60 text-sm text-green-700 font-medium">
                                 <span className="font-bold mr-1">處理結果：</span>{issue.resolveNote}
                               </div>
                             )}
                          </div>
                          
                          <div className="flex flex-col sm:items-end gap-3 shrink-0">
                            {issue.photo && (
                               <img 
                                 src={issue.photo} alt="異常佐證" 
                                 className="h-24 w-24 object-cover rounded-xl border-2 border-white shadow-sm cursor-pointer hover:opacity-80 transition-opacity" 
                                 onClick={() => window.open(issue.photo)} 
                               />
                            )}
                          </div>
                       </div>
                     );
                   })()}
                   
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function BranchReceivingCheck({ inventory, updateStockCloud, purchaseOrders, updateOrderPartialReceiptCloud, showToast, resolveOrderIssueCloud }) {
  const pendingOrders = purchaseOrders.filter(o => o.status !== 'received');
  
  const ordersWithIssues = purchaseOrders.filter(o => o.issues && o.issues.some(iss => !iss.resolved));

  const [reportingOrder, setReportingOrder] = useState(null);
  const [reportingCategory, setReportingCategory] = useState(null);
  const [reportingItems, setReportingItems] = useState([]);
  const [abnormalReason, setAbnormalReason] = useState('');
  const [abnormalPhoto, setAbnormalPhoto] = useState(null);
  const [actualQtys, setActualQtys] = useState({});
  const [isCompressing, setIsCompressing] = useState(false);

  const [resolvingIssue, setResolvingIssue] = useState(null);
  const [resolveNote, setResolveNote] = useState('');

  const openAbnormalReport = (order, category, items) => {
    setReportingOrder(order);
    setReportingCategory(category);
    setReportingItems(items);
    setAbnormalReason('');
    setAbnormalPhoto(null);
    const qtys = {};
    items.forEach(i => { qtys[i.id] = i.orderQty; });
    setActualQtys(qtys);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsCompressing(true);
    try {
      const compressedBase64 = await compressImage(file, 600, 0.5);
      setAbnormalPhoto(compressedBase64);
    } catch(err) {
      showToast('圖片處理失敗', 'error');
    }
    setIsCompressing(false);
  };

  const submitAbnormalReport = async () => {
    if (!abnormalReason.trim()) { showToast('請填寫異常原因說明', 'error'); return; }

    for (const orderItem of reportingItems) {
      const invItem = inventory.find(i => i.id === orderItem.id);
      if (invItem) {
        const actualVal = actualQtys[orderItem.id];
        const actualAdd = (actualVal === '' || actualVal === undefined) ? 0 : parseFloat(actualVal);
        const current = parseFloat(invItem.currentStock) || 0;
        await updateStockCloud(orderItem.id, current + actualAdd);
      }
    }

    const newItemsList = reportingOrder.items.map(item => {
      if (item.category === reportingCategory) {
         const actualVal = actualQtys[item.id];
         return { ...item, actualQty: (actualVal === '' || actualVal === undefined) ? 0 : parseFloat(actualVal) };
      }
      return item;
    });

    const issue = {
      category: reportingCategory,
      reason: abnormalReason,
      photo: abnormalPhoto || null, 
      timestamp: Date.now(),
      resolved: false
    };
    const currentIssues = reportingOrder.issues || [];
    const newIssues = [...currentIssues, issue];

    const currentReceived = reportingOrder.receivedCategories || [];
    const updatedReceived = [...currentReceived, reportingCategory];
    const allCategoriesInOrder = [...new Set(reportingOrder.items.map(i => i.category))];
    const isFullyReceived = allCategoriesInOrder.every(cat => updatedReceived.includes(cat));
    const newStatus = isFullyReceived ? 'received' : 'partial';

    await updateOrderPartialReceiptCloud(reportingOrder.id, updatedReceived, newStatus, newItemsList, newIssues);
    showToast(`已回報異常並完成點收 ${formatCategory(reportingCategory)}！`);
    
    setReportingOrder(null);
  };

  const handleReceiveCategory = async (order, category, itemsInCategory) => {
    for (const orderItem of itemsInCategory) {
      const invItem = inventory.find(i => i.id === orderItem.id);
      if (invItem) {
        const current = parseFloat(invItem.currentStock) || 0;
        const newTotal = current + parseFloat(orderItem.orderQty);
        await updateStockCloud(orderItem.id, newTotal);
      }
    }
    const currentReceived = order.receivedCategories || [];
    const updatedReceived = [...currentReceived, category];
    const allCategoriesInOrder = [...new Set(order.items.map(i => i.category))];
    const isFullyReceived = allCategoriesInOrder.every(cat => updatedReceived.includes(cat));
    const newStatus = isFullyReceived ? 'received' : 'partial';

    await updateOrderPartialReceiptCloud(order.id, updatedReceived, newStatus, null, null);
    showToast(`${formatCategory(category)} 已確認入庫！`);
  };

  if (pendingOrders.length === 0 && ordersWithIssues.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl mt-4 mx-1 shadow-sm border border-slate-100">
        <CheckCircle2 className="w-16 h-16 text-green-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-700">目前沒有待處理的項目</h2>
        <p className="text-sm text-slate-500 mt-2">進貨與異常已全部結案</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2 relative">
      
      {reportingOrder && (
        <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-red-100 flex justify-between items-center bg-red-50 text-red-700">
               <h3 className="font-bold text-lg flex items-center gap-2"><AlertCircle className="w-5 h-5"/> 異常回報：{formatCategory(reportingCategory)}</h3>
               <button onClick={() => setReportingOrder(null)} className="p-1.5 hover:bg-red-100 rounded-full transition-colors"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="p-5 overflow-y-auto space-y-6">
               <div>
                 <label className="block text-[15px] font-black text-slate-800 mb-3">1. 實際到貨數量 <span className="text-xs text-red-500 font-bold ml-1">(少貨請直接修改)</span></label>
                 <div className="space-y-2">
                   {reportingItems.map(item => (
                     <div key={item.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-200">
                        <div className="flex flex-col">
                           <span className="font-bold text-slate-800 text-[16px]">{item.name}</span>
                           <span className="text-xs font-bold text-slate-400">叫貨：{item.orderQty}</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <input 
                             type="number" min="0" step="0.5" inputMode="decimal"
                             value={actualQtys[item.id] !== undefined ? actualQtys[item.id] : item.orderQty}
                             onChange={(e) => setActualQtys({...actualQtys, [item.id]: e.target.value})}
                             className="w-[72px] h-[42px] px-2 border-2 border-slate-300 rounded-xl text-center font-black text-lg text-red-600 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none shadow-inner bg-white transition-all"
                           />
                           <span className="text-[15px] font-bold text-slate-500 w-6">{item.unit}</span>
                        </div>
                     </div>
                   ))}
                 </div>
               </div>

               <div>
                 <label className="block text-[15px] font-black text-slate-800 mb-3">2. 異常原因說明 <span className="text-xs text-red-500 font-bold ml-1">(必填)</span></label>
                 <textarea 
                   value={abnormalReason} onChange={e => setAbnormalReason(e.target.value)}
                   className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none min-h-[100px] text-[15px] font-medium placeholder-slate-400 shadow-inner resize-none"
                   placeholder="例如：高麗菜有2顆爛掉、送貨司機態度不佳..."
                 />
               </div>

               <div>
                 <label className="block text-[15px] font-black text-slate-800 mb-3">3. 拍照佐證 <span className="text-xs text-slate-400 font-bold ml-1">(選填)</span></label>
                 {abnormalPhoto ? (
                   <div className="relative inline-block border-4 border-slate-100 rounded-2xl p-1 shadow-sm">
                     <img src={abnormalPhoto} alt="異常照片" className="h-40 w-auto object-contain rounded-xl" />
                     <button onClick={() => setAbnormalPhoto(null)} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1.5 shadow-lg hover:bg-red-600 transition-transform active:scale-95"><X className="w-4 h-4"/></button>
                   </div>
                 ) : (
                   <label className="cursor-pointer bg-slate-50 hover:bg-slate-100 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center py-8 transition-colors active:bg-slate-200">
                     <Camera className="w-10 h-10 text-slate-400 mb-3" />
                     <span className="text-[15px] font-bold text-slate-500">點擊開啟相機或上傳照片</span>
                     <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
                   </label>
                 )}
               </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button onClick={() => setReportingOrder(null)} className="w-1/3 py-3.5 bg-white border-2 border-slate-200 text-slate-600 font-bold rounded-2xl shadow-sm active:scale-95 transition-all">取消</button>
              <button onClick={submitAbnormalReport} className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl shadow-md flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100" disabled={!abnormalReason || isCompressing}>
                {isCompressing ? '相片處理中...' : <><AlertCircle className="w-5 h-5"/> 確認異常並點收</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {resolvingIssue && (
        <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><CheckCircle2 className="w-6 h-6 text-green-500"/> 標記為「已解決」</h3>
            <p className="text-sm text-slate-500 mb-3 font-medium">請輸入處理結果 (例如：廠商已補退款、補送新品)：</p>
            <textarea
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none mb-6 text-[15px] font-medium resize-none h-28 shadow-inner"
              placeholder="處理備註 (選填)..."
            />
            <div className="flex gap-3">
              <button onClick={() => {setResolvingIssue(null); setResolveNote('');}} className="flex-1 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors">取消</button>
              <button onClick={() => { resolveOrderIssueCloud(resolvingIssue.orderId, resolvingIssue.category, resolveNote); setResolvingIssue(null); setResolveNote(''); }} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-2xl shadow-md transition-colors flex items-center justify-center gap-2 active:scale-95"><CheckCircle2 className="w-5 h-5"/>確認結案</button>
            </div>
          </div>
        </div>
      )}

      {ordersWithIssues.length > 0 && (
        <div className="mb-8">
          <h2 className="text-[24px] font-black text-slate-800 mb-2 px-1 flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-red-500" /> 異常待結案
          </h2>
          <p className="text-xs font-medium text-slate-500 mb-4 px-1">若問題已處理完畢，請點擊綠色按鈕標記為已解決。</p>
          
          {ordersWithIssues.map(order => {
             const unresolvedIssues = order.issues.filter(iss => !iss.resolved);
             if (unresolvedIssues.length === 0) return null;

             return (
               <div key={`issue-${order.id}`} className="mb-6 bg-white rounded-3xl shadow-sm border border-red-100 overflow-hidden">
                 <div className="p-4 bg-red-50 border-b border-red-100 flex justify-between items-center">
                   <h3 className="font-black text-lg text-red-800 flex items-center gap-2">
                     <Truck className="w-5 h-5 text-red-500" /> 單號：{order.id}
                   </h3>
                   <span className="text-xs font-bold text-red-600/70">{order.date.split(' ')[0]}</span>
                 </div>
                 <div className="p-4 bg-white space-y-4">
                   {unresolvedIssues.map((issue, idx) => (
                     <div key={idx} className="border border-red-100 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 relative shadow-inner bg-slate-50">
                        <div className="absolute -top-3 left-4 bg-red-500 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1">
                           <AlertCircle className="w-3.5 h-3.5"/> {formatCategory(issue.category)} 異常
                        </div>
                        <div className="flex-1 mt-2 sm:mt-0">
                           <p className="text-[15px] text-red-800 font-bold whitespace-pre-wrap">{issue.reason}</p>
                        </div>
                        <div className="flex flex-col sm:items-end gap-3 shrink-0">
                          {issue.photo && (
                             <img src={issue.photo} alt="異常佐證" className="h-20 w-20 object-cover rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:opacity-80 transition-opacity" onClick={() => window.open(issue.photo)} />
                          )}
                          <button data-export-ignore="true" onClick={() => setResolvingIssue({orderId: order.id, category: issue.category})} className="px-4 py-2 bg-green-600 hover:bg-green-700 active:scale-95 text-white text-sm font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 w-full sm:w-auto">
                            <CheckCircle2 className="w-4 h-4"/> 標記為已解決
                          </button>
                        </div>
                     </div>
                   ))}
                 </div>
               </div>
             );
          })}
        </div>
      )}

      {pendingOrders.length > 0 && (
        <div className={`${ordersWithIssues.length > 0 ? 'pt-6 border-t-2 border-slate-200 border-dashed' : ''}`}>
          <h2 className="text-[24px] font-black text-slate-800 mb-2 px-1">進貨點收</h2>
          <p className="text-xs font-medium text-slate-500 mb-6 px-1">請依分類核對，廠商分批到貨時可直接「點收單一分類」。</p>
          
          {pendingOrders.map(order => {
            const groupedByCategory = order.items.reduce((acc, item) => {
              if (!acc[item.category]) acc[item.category] = [];
              acc[item.category].push(item);
              return acc;
            }, {});

            const pendingCategories = Object.entries(groupedByCategory).filter(
              ([category]) => !(order.receivedCategories || []).includes(category)
            );

            if (pendingCategories.length === 0) return null;

            return (
              <div key={order.id} className="mb-12 relative">
                <div className="flex items-center gap-3 mb-3 px-1">
                  <div className="bg-slate-800 text-white p-2.5 rounded-2xl shadow-lg shadow-slate-800/20"><Truck className="w-6 h-6 text-orange-400" /></div>
                  <div>
                    <div className="text-[12px] font-bold text-slate-400 mb-0.5">進貨點收單</div>
                    <div className="flex items-baseline gap-2"><h3 className="text-[22px] font-black text-slate-800 leading-none">{order.id}</h3><span className="text-[13px] font-bold text-slate-500">{order.date.split(' ')[0]}</span></div>
                  </div>
                </div>

                <div className="bg-[#fffdf8] border-2 border-[#fde6ca] p-3 rounded-[2rem] shadow-sm">
                  {pendingCategories.map(([category, items]) => (
                     <div key={category} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-3 last:mb-0">
                       <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                         <Layers className="w-4 h-4 text-orange-500" />
                         <h3 className="font-black text-[16px] text-slate-800">{formatCategory(category)}</h3>
                       </div>
                       <div className="p-3.5 bg-white">
                         <div className="flex flex-col gap-1">
                           {items.map((item, idx) => (
                             <div key={idx} className="flex justify-between items-center px-1.5 py-2 hover:bg-slate-50 rounded-xl transition-colors border-b border-slate-50 last:border-0">
                               <span className="font-bold text-slate-700 text-[16px]">{item.name}</span>
                               <div className="font-black text-[20px] text-slate-800">{item.orderQty} <span className="text-[13px] font-medium text-slate-500">{item.unit}</span></div>
                             </div>
                           ))}
                         </div>
                       </div>
                       
                       <div className="p-3 bg-slate-50 border-t border-slate-100 flex gap-2">
                         <button onClick={() => openAbnormalReport(order, category, items)} className="px-4 py-3 bg-red-50 hover:bg-red-100 active:scale-95 text-red-600 font-bold rounded-2xl flex items-center justify-center gap-1.5 transition-all shadow-sm border border-red-100 text-[14px]">
                           <AlertCircle className="w-4 h-4" /> 異常
                         </button>
                         <button onClick={() => handleReceiveCategory(order, category, items)} className="flex-1 bg-orange-600 hover:bg-orange-700 active:scale-95 text-white font-bold py-3 rounded-2xl flex justify-center items-center gap-2 transition-all shadow-sm text-[15px]">
                           <CheckCircle2 className="w-5 h-5" /> 正常點收
                         </button>
                       </div>
                       
                     </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
