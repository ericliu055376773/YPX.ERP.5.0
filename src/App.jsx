import React, { useState, useEffect, useMemo } from 'react';
import { 
  Utensils, ClipboardList, ShoppingCart, Truck, 
  LogOut, CheckCircle2, AlertCircle, Package, 
  Store, ShieldAlert, PlusCircle, Settings, 
  Database, Users, History, Layers, Calendar,
  BarChart2, Search, ChevronDown, ChevronUp, Download, Menu,
  Edit2, Trash2, Save, Eye, EyeOff, ScanLine, MapPin, MapPinOff, ShieldCheck, X, Bell,
  Camera, MessageSquare, AlertTriangle, Copy
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, updateDoc, deleteDoc, deleteField } from 'firebase/firestore';

// --- Firebase Setup ---
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

// --- Initial Master Data ---
const initialProducts = [
  { id: 'p1', category: '蔬果類', name: '高麗菜', unit: '顆', defaultPar: 50, defaultReorderQty: 1, defaultReorderUnit: '件', order: 1 },
  { id: 'p2', category: '蔬果類', name: '大白菜', unit: '顆', defaultPar: 30, order: 2 },
  { id: 'p3', category: '蔬果類', name: '金針菇', unit: '包', defaultPar: 100, order: 3 },
  { id: 'p6', category: '肉類', name: '特級雪花牛', unit: '公斤', defaultPar: 20, order: 4 },
  { id: 'p7', category: '肉類', name: '台灣梅花豬', unit: '公斤', defaultPar: 25, order: 5 },
  { id: 'p10', category: '海鮮與火鍋料', name: '大白蝦', unit: '盒', defaultPar: 20, order: 6 },
];

const adminUserSeed = { username: 'yan', password: 'yan0204', role: 'admin', branchName: '總管理處' };

const formatCategory = (category) => category ? category.replace(/[【】\[\]《》〈〉()]/g, '').trim() : '';

// 智能判斷前日
const getEffectiveHolidayMode = (modeStr) => {
  if (modeStr === 'holiday') return true;
  if (modeStr === 'weekday') return false;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1); 
  const day = yesterday.getDay();
  return day === 0 || day === 6; 
};

// 取得依照設定排序的分類陣列
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
  const [systemConfig, setSystemConfig] = useState({ holidayMode: 'auto', categoryOrder: [], isGPSRequired: false });
  const [systemOptions, setSystemOptions] = useState({ categories: [], units: [], reorderUnits: [] });

  const [user, setUser] = useState(null); 
  const [authMode, setAuthMode] = useState('login'); 
  const [loginRole, setLoginRole] = useState('manager'); 
  const [toast, setToast] = useState(null);

  const [showAdminHint, setShowAdminHint] = useState(false);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [secretInput, setSecretInput] = useState('');
  const [secretStep, setSecretStep] = useState(1); 

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!document.getElementById('html2canvas-script')) {
      const script = document.createElement('script');
      script.id = 'html2canvas-script';
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      script.async = true;
      document.head.appendChild(script);
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
      let config = { holidayMode: 'auto', categoryOrder: [], isGPSRequired: false };
      snap.docs.forEach(d => { 
        if (d.id === 'config') {
          const data = d.data();
          if (data.holidayMode) config.holidayMode = data.holidayMode;
          else if (data.isHolidayMode !== undefined) config.holidayMode = data.isHolidayMode ? 'holiday' : 'weekday';
          if (data.categoryOrder) config.categoryOrder = data.categoryOrder;
          if (data.isGPSRequired !== undefined) config.isGPSRequired = data.isGPSRequired;
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
          reorderUnits: ['箱', '件', '袋', '籃'] // 初始化加入叫貨單位
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

    if (products.length === 0 && username === 'yan') {
      initialProducts.forEach(async (p) => {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_PRODUCTS, p.id.toString()), p);
      });
    }

    if (authMode === 'register') {
      if (loginRole === 'admin') {
        showToast('為保護系統安全，總公司帳號無法在此直接註冊', 'error'); return;
      }
      if (username === 'yan' || usersDb.some(u => u.username === username)) {
        showToast('帳號已存在', 'error'); return;
      }
      const newUser = { username, password, role: loginRole, branchName, lat: '', lng: '' };
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_USERS, username), newUser);
      setUser(newUser);
      showToast(`點貨人員帳號註冊成功！`);
    } else {
      if (loginRole === 'admin' && username === 'yan' && password === 'yan0204') {
        const adminObj = usersDb.find(u => u.username === 'yan') || adminUserSeed;
        if (!usersDb.some(u => u.username === 'yan')) {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_USERS, 'yan'), adminObj);
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
        showToast(`點貨人員登入成功！`);
      } else {
        showToast('帳號、密碼或職級錯誤，請重試', 'error');
      }
    }
  };

  const logout = () => { setUser(null); showToast('已登出系統'); };

  const handleSecretSubmit = (e) => {
    e.preventDefault();
    if (secretStep === 1) {
      if (secretInput === '1021') {
        setSecretStep(2);
        setSecretInput('');
      } else {
        showToast('第一階段解鎖密碼錯誤', 'error'); 
        setSecretInput('');
        setSecretStep(1);
        setShowSecretModal(false);
      }
    } else if (secretStep === 2) {
      if (secretInput === '0204') { 
        setShowAdminHint(true); 
        setShowSecretModal(false); 
        setSecretInput('');
        setSecretStep(1);
      } else {
        showToast('第二階段解鎖密碼錯誤', 'error'); 
        setSecretInput('');
        setSecretStep(1);
        setShowSecretModal(false);
      }
    }
  };

  //  取得指定門店的庫存 (完美結合總部商品預設值與門店自訂設定)
  const getBranchInventory = (branchNameKey) => {
    const branchDoc = inventoryData[branchNameKey] || {};
    const branchSettings = branchDoc.settings || {};
    const isHoliday = getEffectiveHolidayMode(systemConfig.holidayMode);
    return products.map(product => {
      const bSetting = branchSettings[product.id] || {};
      const regularPar = (bSetting.parLevel !== undefined && bSetting.parLevel !== '') ? bSetting.parLevel : product.defaultPar;
      const holidayPar = (bSetting.parLevelHoliday !== undefined && bSetting.parLevelHoliday !== '') ? bSetting.parLevelHoliday : (product.defaultParHoliday !== undefined ? product.defaultParHoliday : regularPar);
      return {
        ...product,
        //  支援空字串，讓輸入框能被完全刪除清空
        currentStock: (bSetting.currentStock !== undefined && bSetting.currentStock !== null) ? bSetting.currentStock : '',
        parLevel: regularPar,
        parLevelHoliday: holidayPar,
        activeParLevel: isHoliday ? holidayPar : regularPar,
        reorderQty: (bSetting.reorderQty !== undefined && bSetting.reorderQty !== null) ? bSetting.reorderQty : (product.defaultReorderQty || 0),
        reorderUnit: (bSetting.reorderUnit !== undefined && bSetting.reorderUnit !== null) ? bSetting.reorderUnit : (product.defaultReorderUnit || '')
      };
    });
  };

  if (!isReady || !isSystemLoaded) return <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>;

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col md:flex-row overflow-hidden font-sans text-slate-800">
      <style dangerouslySetInnerHTML={{__html: `
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .vertical-text { writing-mode: vertical-rl; text-orientation: upright; letter-spacing: 2px; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
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
              <h1 className="text-2xl font-bold text-white tracking-wider">一品香 ERP</h1>
              <p className="text-slate-400 mt-2 text-sm">雲端門店營運系統</p>
            </div>
            <div className="p-8">
              {showAdminHint && (
                <div className="mb-6 p-3 bg-blue-50 text-blue-800 rounded-xl border border-blue-100 text-sm flex items-start gap-2 shadow-sm">
                  <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p>總管理處登入：<br/>帳號 <strong>yan</strong> / 密碼 <strong>yan0204</strong><br/>(需先將職級切換為總公司)</p>
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
                  <Store className="w-4 h-4"/> 點貨人員
                </button>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                {authMode === 'register' && loginRole !== 'admin' && (
                  <div><input required name="branchName" type="text" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-[16px]" placeholder="所屬門店名稱 (例如：斗六店)" /></div>
                )}
                <div><input required name="username" type="text" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-[16px]" placeholder="個人帳號" /></div>
                <div><input required name="password" type="password" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-[16px]" placeholder="密碼" /></div>
                <button type="submit" className={`w-full active:scale-95 text-white font-bold py-4 mt-2 rounded-xl transition-all shadow-md text-[16px] ${loginRole === 'admin' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20' : 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/20'}`}>
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
                <h3 className="text-lg font-bold text-slate-800 mb-4 text-center">顯示總部帳號 ({secretStep}/2)</h3>
                <form onSubmit={handleSecretSubmit}>
                  <input type="password" value={secretInput} onChange={(e) => setSecretInput(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none mb-4 text-center tracking-widest text-[16px] font-bold" placeholder="請輸入解鎖碼" autoFocus />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => {setShowSecretModal(false); setSecretInput(''); setSecretStep(1);}} className="flex-1 py-3.5 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors">取消</button>
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
              <div className={`p-2 rounded-xl ${user.role === 'admin' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                {user.role === 'admin' ? <ShieldAlert className="w-5 h-5" /> : <Store className="w-5 h-5" />}
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-slate-800 text-[15px] leading-tight">{user.branchName}</span>
                <span className="text-[11px] font-bold text-slate-400">{user.role === 'admin' ? '總管理處' : '點貨人員'}</span>
              </div>
            </div>
            <button onClick={logout} className="p-2.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </header>

          <main className="flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+90px)] md:pb-0 relative scroll-smooth w-full">
            {user.role === 'admin' ? (
              <AdminViews products={products} usersDb={usersDb} inventoryData={inventoryData} ordersData={ordersData} getBranchInventory={getBranchInventory} showToast={showToast} fbUser={fbUser} systemConfig={systemConfig} systemOptions={systemOptions} db={db} appId={appId} />
            ) : (
              <LocationGuard user={user} systemConfig={systemConfig} logout={logout}>
                <BranchViews user={user} fbUser={fbUser} products={products} inventoryData={inventoryData} ordersData={ordersData} branchInventory={getBranchInventory(user.branchName || user.username)} showToast={showToast} systemConfig={systemConfig} systemOptions={systemOptions} db={db} appId={appId} />
              </LocationGuard>
            )}
          </main>

          <aside className="hidden md:flex w-64 bg-slate-900 text-white flex-col flex-shrink-0">
            <div className="p-6 border-b border-slate-800">
              <div className={`flex items-center gap-3 mb-1 ${user.role === 'admin' ? 'text-blue-500' : 'text-orange-500'}`}>
                <Utensils className="w-6 h-6" />
                <span className="font-bold text-xl tracking-wider">一品香 ERP</span>
              </div>
              <p className="text-slate-400 text-sm flex items-center gap-2 mt-2 font-medium">
                {user.role === 'admin' ? <ShieldAlert className="w-4 h-4" /> : <Store className="w-4 h-4" />} 
                {user.branchName} ({user.role === 'admin' ? '總部' : '點貨人員'})
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

function ImageExportModal({ imageUrl, onClose, fallbackText }) {
  if (!imageUrl && !fallbackText) return null;

  const handleCopyText = async () => {
    if (!fallbackText) return;
    try {
      await navigator.clipboard.writeText(fallbackText);
      alert('已成功複製叫貨內容！您可以直接貼上到 LINE');
    } catch (err) {
      // 若瀏覽器阻擋 Clipboard API，提供傳統 textarea 讓使用者手動複製
      const textArea = document.createElement("textarea");
      textArea.value = fallbackText;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        alert('已成功複製叫貨內容！您可以直接貼上到 LINE');
      } catch (e) {
        alert('複製失敗，請手動選取下方文字複製。');
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 z-[100] flex flex-col items-center justify-center p-6 backdrop-blur-sm animate-in fade-in duration-200">
       
       {imageUrl ? (
         <>
           <div className="flex items-center gap-2 text-white font-bold mb-6 bg-slate-800 px-5 py-2.5 rounded-full shadow-lg">
             <Download className="w-5 h-5 text-blue-400"/> 請對著下方圖片<span className="text-blue-400">長按儲存</span>或分享
           </div>
           <div className="relative w-full max-w-sm max-h-[65vh] overflow-y-auto rounded-2xl shadow-2xl bg-white border-4 border-slate-700">
             {/* 加上 WebkitTouchCallout 讓 iOS 手機可以正常長按叫出儲存選單 */}
             <img src={imageUrl} alt="匯出圖片" className="w-full h-auto block" style={{ WebkitTouchCallout: 'default', pointerEvents: 'auto' }} />
           </div>
         </>
       ) : (
         <>
           <div className="flex items-center gap-2 text-white font-bold mb-6 bg-red-600 px-5 py-2.5 rounded-full shadow-lg text-sm text-center">
             <AlertTriangle className="w-5 h-5 text-white"/> 瀏覽器限制截圖，請改用「複製文字」
           </div>
           <div className="w-full max-w-sm bg-white rounded-2xl p-4 shadow-2xl mb-4 overflow-y-auto max-h-[50vh]">
             <pre className="text-[13px] font-bold text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">{fallbackText}</pre>
           </div>
           <button onClick={handleCopyText} className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white w-full max-w-sm py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg mb-2">
             <Copy className="w-5 h-5" /> 點擊複製所有內容
           </button>
         </>
       )}
       
       <button onClick={onClose} className="mt-4 bg-white/10 hover:bg-white/20 active:scale-95 text-white px-10 py-3.5 rounded-2xl font-bold transition-all border border-white/20 w-full max-w-sm">關閉視窗</button>
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
function AdminViews({ products, usersDb, inventoryData, ordersData, getBranchInventory, showToast, fbUser, systemConfig, systemOptions, db, appId }) {
  const [activeTab, setActiveTab] = useState('products');
  const branches = usersDb.filter(u => u.role !== 'admin'); // 列出店長與組員

  const tabs = [
    { id: 'products', icon: <Database />, label: '商品庫' },
    { id: 'categories', icon: <Layers />, label: '分類排序' },
    { id: 'quotas', icon: <Settings />, label: '安全庫存' },
    { id: 'branches', icon: <Users />, label: '門店帳號' },
    { id: 'history', icon: <History />, label: '進貨紀錄' },
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
        {activeTab === 'branches' && <AdminBranchManager branches={branches} showToast={showToast} fbUser={fbUser} db={db} appId={appId} />}
        {activeTab === 'history' && <AdminOrderHistory ordersData={ordersData} branches={branches} showToast={showToast} />}
        {activeTab === 'analytics' && <AdminAnalytics ordersData={ordersData} branches={branches} products={products} systemConfig={systemConfig} />}
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
  const [editingProduct, setEditingProduct] = useState(null);
  const [editReorderMode, setEditReorderMode] = useState('diff'); 
  const [deletingProduct, setDeletingProduct] = useState(null);
  
  const [newCatInput, setNewCatInput] = useState(''); 
  
  const [newUnitInput, setNewUnitInput] = useState('');
  
  const [newReorderUnitInput, setNewReorderUnitInput] = useState('');

  const [addProductCat, setAddProductCat] = useState(''); 
  const [addReorderMode, setAddReorderMode] = useState('diff'); 

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

    const exists = (systemOptions.units || []).some(u => {
      if (typeof u === 'string') return u === val;
      return u.name === val;
    });
    
    if(exists) { showToast(`「${val}」已經存在！`, 'error'); return; }
    
    const updatedOptions = { ...systemOptions, units: [...(systemOptions.units || []), val] };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_SYSTEM, 'options'), updatedOptions);
    setNewUnitInput('');
    showToast(`成功新增盤點單位：${val}`);
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
        if (typeof u === 'object' && typeof uToRemove === 'string') return u.name !== uToRemove.name;
        return true;
      }) 
    };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_SYSTEM, 'options'), updatedOptions);
  };

  const handleAddReorderUnit = async () => {
    if(!fbUser) return;
    const val = newReorderUnitInput.trim();
    if(!val) return;

    const exists = (systemOptions.reorderUnits || []).some(u => {
      if (typeof u === 'string') return u === val;
      return u.name === val;
    });
    if(exists) { showToast(`「${val}」已經存在！`, 'error'); return; }
    
    const updatedOptions = { ...systemOptions, reorderUnits: [...(systemOptions.reorderUnits || []), val] };
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
        if (typeof u === 'object' && typeof uToRemove === 'string') return u.name !== uToRemove.name;
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
      defaultParHoliday: parseFloat(formData.get('defaultParHoliday')) || 0,
      defaultReorderQty: addReorderMode === 'fixed' ? (parseFloat(formData.get('defaultReorderQty')) || 0) : 0,
      defaultReorderUnit: addReorderMode === 'fixed' ? (formData.get('defaultReorderUnit') || '') : '',
      includeInUseQty: formData.get('includeInUseQty') === 'on',
      order: products.length 
    };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_PRODUCTS, id), newProduct);
    e.target.name.value = '';
    if(e.target.defaultReorderQty) e.target.defaultReorderQty.value = '';
    setAddReorderMode('diff'); 
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
      defaultParHoliday: parseFloat(formData.get('defaultParHoliday')) || 0,
      defaultReorderQty: editReorderMode === 'fixed' ? (parseFloat(formData.get('defaultReorderQty')) || 0) : 0,
      defaultReorderUnit: editReorderMode === 'fixed' ? (formData.get('defaultReorderUnit') || '') : '',
      includeInUseQty: formData.get('includeInUseQty') === 'on'
    });
    showToast(`商品已更新：${newName}`);
    setEditingProduct(null);
  };

  const confirmDeleteProduct = async () => {
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_PRODUCTS, deletingProduct.id));
    showToast(`已刪除商品：${deletingProduct.name}`);
    setDeletingProduct(null);
  };

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
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
                  <label className="text-xs font-bold text-blue-500 mb-1 block">平日安全庫存</label>
                  <select required name="defaultPar" defaultValue={editingProduct.defaultPar} className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-[16px] font-bold text-blue-700 shadow-inner">
                    <option value="0">0</option>
                    {Array.from({ length: 100 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-orange-500 mb-1 block">假日安全庫存</label>
                  <select required name="defaultParHoliday" defaultValue={editingProduct.defaultParHoliday !== undefined ? editingProduct.defaultParHoliday : editingProduct.defaultPar} className="w-full px-3 py-3 bg-orange-50 border border-orange-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-[16px] font-bold text-orange-700 shadow-inner">
                    <option value="0">0</option>
                    {Array.from({ length: 100 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-500 mb-1 block">盤點單位</label>
                  <select required name="unit" defaultValue={editingProduct.unit} className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-[16px] font-bold shadow-inner text-slate-700">
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
              </div>

              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <div className="flex-1">
                  <label className="text-xs font-bold text-indigo-500 mb-1 block">低於安全值，叫貨邏輯</label>
                  <select value={editReorderMode} onChange={e => setEditReorderMode(e.target.value)} className="w-full px-3 py-3 bg-indigo-50 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-[15px] font-bold text-indigo-800 shadow-inner">
                    <option value="diff">補齊差額 (安全 - 實有)</option>
                    <option value="fixed">每次固定叫貨數量</option>
                  </select>
                </div>
                
                {editReorderMode === 'fixed' && (
                  <>
                    <div className="flex-1">
                      <label className="text-xs font-bold text-indigo-500 mb-1 block">每次固定叫貨量</label>
                      <input name="defaultReorderQty" type="number" min="0" step="0.5" defaultValue={editingProduct.defaultReorderQty || ''} className="w-full px-3 py-3 bg-indigo-50 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-[15px] font-bold text-indigo-700" placeholder="數量" />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-bold text-indigo-500 mb-1 block">叫貨單位</label>
                      <select name="defaultReorderUnit" defaultValue={editingProduct.defaultReorderUnit || ''} className="w-full px-3 py-3 bg-indigo-50 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-[15px] font-bold text-indigo-700">
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
                  </>
                )}
              </div>

              <div className="pt-2 mt-1 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer p-2.5 bg-slate-50 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors">
                  <input type="checkbox" name="includeInUseQty" defaultChecked={editingProduct.includeInUseQty} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                  <span className="text-[14px] font-bold text-slate-700">標示：盤點需加總「已拆封/使用中」數量</span>
                </label>
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
          <div className="flex gap-2 mb-3">
            <input value={newUnitInput} onChange={e => setNewUnitInput(e.target.value)} type="text" placeholder="如: 顆..." className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold shadow-inner" />
            <button onClick={handleAddUnit} className="bg-orange-100 hover:bg-orange-200 text-orange-700 font-bold px-4 py-2 rounded-xl transition-colors shadow-sm text-sm">新增</button>
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
          <div className="flex gap-2 mb-3">
            <input value={newReorderUnitInput} onChange={e => setNewReorderUnitInput(e.target.value)} type="text" placeholder="如: 箱..." className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold shadow-inner" />
            <button onClick={handleAddReorderUnit} className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold px-4 py-2 rounded-xl transition-colors shadow-sm text-sm">新增</button>
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
          
          <div className="sm:col-span-1 md:col-span-4">
            <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">2. 商品名稱</label>
            <input required name="name" type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-[16px] font-bold text-slate-800 shadow-inner" placeholder="例如: 高麗菜" />
          </div>
          
          <div className="sm:col-span-1 md:col-span-2">
            <label className="block text-xs font-bold text-blue-500 mb-1.5 ml-1">3. 平日安全庫存</label>
            <select required name="defaultPar" defaultValue="0" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-[16px] font-bold shadow-inner text-blue-700">
              <option value="0">0</option>
              {Array.from({ length: 100 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          
          <div className="sm:col-span-1 md:col-span-2">
            <label className="block text-xs font-bold text-orange-500 mb-1.5 ml-1">4. 假日安全庫存</label>
            <select required name="defaultParHoliday" defaultValue="0" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-[16px] font-bold shadow-inner text-orange-700">
              <option value="0">0</option>
              {Array.from({ length: 100 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div className="sm:col-span-1 md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">5. 盤點單位</label>
            <select required name="unit" defaultValue="" className={`w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-[16px] font-bold shadow-inner ${!addProductCat ? 'bg-slate-100 text-slate-400' : 'bg-slate-50 text-slate-700'}`}>
              <option value="" disabled>{addProductCat ? '選單位' : '選分類'}</option>
              {availableAddUnits.map((u, i) => {
                 const uName = typeof u === 'string' ? u : u.name;
                 return <option key={i} value={uName}>{uName}</option>;
              })}
            </select>
          </div>
          
          <div className="sm:col-span-1 md:col-span-2">
            <label className="block text-xs font-bold text-indigo-500 mb-1.5 ml-1">6. 低於安全值，叫貨邏輯</label>
            <select value={addReorderMode} onChange={e => setAddReorderMode(e.target.value)} className="w-full px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-[16px] font-bold text-indigo-800 shadow-inner cursor-pointer">
              <option value="diff">自動補齊差額 (安全 - 實有)</option>
              <option value="fixed">每次固定叫貨數量</option>
            </select>
          </div>

          {addReorderMode === 'fixed' ? (
            <>
              <div className="sm:col-span-1 md:col-span-2">
                <label className="block text-xs font-bold text-indigo-500 mb-1.5 ml-1">7. 固定叫貨數量</label>
                <input name="defaultReorderQty" type="number" min="0" step="0.5" className="w-full px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-[16px] font-bold text-indigo-800 shadow-inner placeholder-indigo-300" placeholder="例如: 1" />
              </div>
              
              <div className="sm:col-span-1 md:col-span-2">
                <label className="block text-xs font-bold text-indigo-500 mb-1.5 ml-1">8. 固定叫貨單位</label>
                <select name="defaultReorderUnit" defaultValue="" className="w-full px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-[16px] font-bold text-indigo-800 shadow-inner">
                  <option value="">同盤點單位</option>
                  {availableReorderUnits.map((u, i) => {
                     const uName = typeof u === 'string' ? u : u.name;
                     return <option key={`ru-${i}`} value={uName}>{uName}</option>;
                  })}
                </select>
              </div>
            </>
          ) : (
             <div className="sm:col-span-1 md:col-span-4 flex items-center px-4 h-[50px]">
                <span className="text-sm font-bold text-slate-400">系統將自動計算差額 (青江菜模式)</span>
             </div>
          )}
          
          <div className="sm:col-span-1 md:col-span-4 flex items-center h-[50px]">
             <label className="flex items-center gap-2 cursor-pointer px-2">
               <input type="checkbox" name="includeInUseQty" className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
               <span className="text-[15px] font-bold text-slate-700">顯示標示：盤點需加總「已拆封/使用中」數量</span>
             </label>
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
                     <div className="flex items-center gap-2 flex-wrap mb-1">
                       <span className="font-bold text-slate-700 text-[16px]">{p.name}</span>
                       <span className="text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md">{p.unit}</span>
                       {p.includeInUseQty && (
                         <span className="text-[10px] bg-purple-50 text-purple-600 border border-purple-200 px-1.5 py-0.5 rounded-md font-bold shadow-sm whitespace-nowrap">含使用中</span>
                       )}
                     </div>
                     {p.defaultReorderQty > 0 && (
                       <span className="text-[11px] font-bold text-indigo-600">
                         預設邏輯: 每次固定叫 {p.defaultReorderQty} {p.defaultReorderUnit || p.unit}
                       </span>
                     )}
                  </div>
                  <div className="flex items-center gap-4 pr-3">
                     <div className="flex flex-col items-end gap-0.5 mr-1">
                       <div className="flex items-center gap-1.5">
                         <span className="text-[10px] font-bold text-slate-400">平日</span>
                         <span className="font-black text-blue-600 text-[16px] leading-none">{p.defaultPar}</span>
                       </div>
                       <div className="flex items-center gap-1.5">
                         <span className="text-[10px] font-bold text-slate-400">假日</span>
                         <span className="font-black text-orange-500 text-[16px] leading-none">{p.defaultParHoliday !== undefined ? p.defaultParHoliday : p.defaultPar}</span>
                       </div>
                     </div>
                     <div className="flex items-center border-l border-slate-100 pl-2 gap-0.5">
                        <button onClick={() => { setEditingProduct(p); setEditReorderMode(p.defaultReorderQty > 0 ? 'fixed' : 'diff'); }} className="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-xl transition-colors"><Edit2 className="w-4 h-4"/></button>
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

function AdminBranchManager({ branches, showToast, fbUser, db, appId }) {
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ branchName: '', password: '', lat: '', lng: '', role: 'manager' });
  const [showPasswords, setShowPasswords] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

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

  if (branches.length === 0) return <div className="text-center py-20 bg-white rounded-3xl mx-4 shadow-sm border border-slate-200"><Store className="w-16 h-16 text-slate-200 mx-auto mb-4" /><h2 className="text-xl font-bold text-slate-700">目前尚無註冊的門店</h2></div>;

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-2">
        <Users className="w-5 h-5 text-blue-600" />
        <h3 className="font-bold text-slate-800">門店帳號與權限 (職級) 管理</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {branches.map(b => {
          const currentRole = b.role === 'branch' ? 'manager' : (b.role || 'manager');
          return (
            <div key={b.username} className={`bg-white p-5 rounded-[2rem] shadow-sm border-2 flex flex-col gap-4 transition-colors border-orange-100`}>
              {editId === b.username ? (
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-bold text-slate-500 mb-1 block">職級權限</label>
                      <select value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})} className="w-full px-3 py-3 bg-blue-50 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-[15px] font-bold text-blue-800">
                        <option value="manager"> 點貨人員</option>
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
                    <div className={`p-3 rounded-2xl bg-orange-50 text-orange-600`}>
                       <Store className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 text-[18px]">{b.branchName}</h4>
                      <div className="text-[12px] font-bold text-slate-400 mt-0.5 flex items-center gap-1.5">
                         <span className={`px-2 py-0.5 rounded text-white bg-orange-500`}>
                           點貨人員
                         </span>
                         分店權限正常
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex justify-between items-center text-[15px]"><span className="font-bold text-slate-500">帳號</span><span className="font-black text-slate-700">{b.username}</span></div>
                    <div className="flex justify-between items-center text-[15px]"><span className="font-bold text-slate-500">密碼</span><div className="flex items-center gap-2"><span className="font-black text-slate-700">{showPasswords[b.username] ? b.password : ''}</span><button onClick={() => setShowPasswords(p => ({...p, [b.username]: !p[b.username]}))} className="p-1.5 bg-white rounded-lg border border-slate-200 text-slate-400 shadow-sm">{showPasswords[b.username] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div></div>
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
  );
}

function AdminQuotaManager({ branches, getBranchInventory, fbUser, showToast, systemConfig, products, inventoryData, systemOptions, db, appId }) {
  const uniqueBranchNames = useMemo(() => [...new Set(branches.map(b => b.branchName))].filter(Boolean), [branches]);
  const [selectedBranch, setSelectedBranch] = useState(uniqueBranchNames.length > 0 ? uniqueBranchNames[0] : '');
  const [activeCategory, setActiveCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState(''); 
  const [announcementInput, setAnnouncementInput] = useState('');

  useEffect(() => { 
    if(!selectedBranch && uniqueBranchNames.length > 0) setSelectedBranch(uniqueBranchNames[0]); 
  }, [uniqueBranchNames, selectedBranch]);
  
  useEffect(() => {
    if(selectedBranch && inventoryData[selectedBranch]?.announcement) {
        setAnnouncementInput(inventoryData[selectedBranch].announcement);
    } else {
        setAnnouncementInput('');
    }
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

  const saveAnnouncement = async () => {
      if(!fbUser || !selectedBranch) return;
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_INVENTORY, selectedBranch), { announcement: announcementInput }, { merge: true });
      showToast(`已發布 ${selectedBranch} 專屬公告！`, 'success');
  };

  const branchOptions = uniqueBranchNames.map(name => ({ value: name, label: name }));
  const effectiveIsHoliday = getEffectiveHolidayMode(systemConfig.holidayMode);

  return (
    <div className="space-y-4">
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

      <div className={`p-4 rounded-2xl shadow-sm border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${effectiveIsHoliday ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
        <div><h3 className={`font-bold text-lg flex items-center gap-2 ${effectiveIsHoliday ? 'text-orange-800' : 'text-blue-800'}`}><Calendar className="w-5 h-5" />全系統安全庫存：{effectiveIsHoliday ? '假日模式' : '平日模式'}</h3><p className={`text-xs mt-1 font-medium ${effectiveIsHoliday ? 'text-orange-600' : 'text-blue-600'}`}>目前設定：{systemConfig.holidayMode === 'auto' ? '自動偵測' : '手動設定'}</p></div>
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
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
          <h4 className="font-bold text-orange-600 mb-2 flex items-center gap-2 text-[16px]">
            <Bell className="w-5 h-5"/> 門店專屬公告欄
          </h4>
          <p className="text-xs text-slate-500 font-medium mb-3">此公告將顯示在該門店人員的「每日盤點」畫面最頂端。</p>
          <div className="flex flex-col gap-3">
            <textarea 
              rows="5"
              value={announcementInput} 
              onChange={(e) => setAnnouncementInput(e.target.value)} 
              placeholder={`輸入要顯示給 ${selectedBranch} 的公告內容...\n(支援多行輸入，請使用「空白鍵」來對齊文字)`}
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-[14px] font-bold text-slate-700 shadow-inner font-mono whitespace-pre resize-y"
            />
            <button 
              onClick={saveAnnouncement} 
              className="bg-orange-100 hover:bg-orange-200 text-orange-700 font-bold px-6 py-3.5 rounded-xl transition-colors shadow-sm whitespace-nowrap active:scale-95 self-end"
            >
              發佈公告
            </button>
          </div>
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
                    <div className="flex items-center bg-indigo-50 p-1.5 rounded-xl border border-indigo-200 shadow-sm gap-1">
                      <span className="text-[11px] font-bold text-indigo-700 pl-2 pr-1 whitespace-nowrap">叫貨邏輯：</span>
                      
                      <select 
                        value={parseFloat(item.reorderQty) > 0 ? 'fixed' : 'diff'} 
                        onChange={(e) => {
                          if (e.target.value === 'diff') {
                            handleParLevelChange(item.id, 'reorderQty', '0');
                          } else {
                            handleParLevelChange(item.id, 'reorderQty', item.defaultReorderQty > 0 ? item.defaultReorderQty : '1');
                          }
                        }} 
                        className="px-2 py-1.5 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-center font-bold text-indigo-700 text-[13px] shadow-inner cursor-pointer"
                      >
                        <option value="diff">補齊差額</option>
                        <option value="fixed">固定數量</option>
                      </select>

                      {parseFloat(item.reorderQty) > 0 ? (
                        <div className="flex items-center ml-1 gap-1">
                          <input 
                            type="number" min="0" step="0.5" inputMode="decimal" 
                            placeholder="數量" 
                            value={item.reorderQty || ''} 
                            onChange={(e) => handleParLevelChange(item.id, 'reorderQty', e.target.value)} 
                            className="w-14 sm:w-16 px-1 py-1.5 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-center font-black text-indigo-700 text-[15px] shadow-inner" 
                          />
                          <select 
                            value={item.reorderUnit || ''} 
                            onChange={(e) => handleParLevelChange(item.id, 'reorderUnit', e.target.value)} 
                            className="w-16 sm:w-20 px-1 py-1.5 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-center font-bold text-indigo-600 text-[13px] shadow-inner cursor-pointer"
                          >
                            <option value="">{item.defaultReorderUnit || item.unit}</option>
                            {availableReorderUnits.map((u, i) => {
                               const uName = typeof u === 'string' ? u : u.name;
                               return <option key={i} value={uName}>{uName}</option>;
                            })}
                          </select>
                        </div>
                      ) : (
                         <span className="text-[11px] font-bold text-slate-500 px-2 whitespace-nowrap">
                           自動算 (安全 - 實有)
                         </span>
                      )}
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

function AdminOrderHistory({ ordersData, branches }) {
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [exportImgUrl, setExportImgUrl] = useState(null); 
  const [exportFallbackText, setExportFallbackText] = useState(''); // 新增：用於複製純文字
  
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
    const filtered = ordersData.filter(o => {
      if (filterBranch !== 'all' && o.branchName !== filterBranch) return false;
      if (filterDate) {
        const orderDate = new Date(o.timestamp);
        const selectedDate = new Date(filterDate);
        if (orderDate.getFullYear() !== selectedDate.getFullYear() || orderDate.getMonth() !== selectedDate.getMonth() || orderDate.getDate() !== selectedDate.getDate()) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      const aAbnormal = a.abnormalCategories ? Object.keys(a.abnormalCategories).length > 0 : false;
      const bAbnormal = b.abnormalCategories ? Object.keys(b.abnormalCategories).length > 0 : false;
      if (aAbnormal && !bAbnormal) return -1;
      if (!aAbnormal && bAbnormal) return 1;
      return 0; 
    });
  }, [ordersData, filterBranch, filterDate]);

  const uniqueBranchNames = useMemo(() => [...new Set(branches.map(b => b.branchName))].filter(Boolean), [branches]);
  const branchOptions = [{ value: 'all', label: '所有門店' }, ...uniqueBranchNames.map(name => ({ value: name, label: name }))];

  const handleExportCard = async (elementId, orderInfo, categoryStr, itemsList, showToast) => {
    // 預先準備好純文字格式，作為截圖失敗的備案
    let fallbackStr = `【${orderInfo.branchName} 叫貨單】\n分類：${formatCategory(categoryStr)}\n日期：${orderInfo.date.split(' ')[0]}\n--------------------\n`;
    itemsList.forEach(item => {
      fallbackStr += `${item.name}： ${item.orderQty} ${item.unit}\n`;
    });
    setExportFallbackText(fallbackStr);

    if (!window.html2canvas) { showToast('截圖元件載入中，請稍候', 'error'); return; }
    const el = document.getElementById(elementId);
    if (!el) { showToast('找不到該單據卡片', 'error'); return; }
    
    showToast('正在為您產生圖檔...', 'success');
    
    setTimeout(async () => {
      try { 
        // 加入更完整的參數，解決 LINE WebView 截圖問題
        const canvas = await window.html2canvas(el, { 
          scale: window.devicePixelRatio > 1 ? 2 : 1, 
          backgroundColor: '#ffffff', 
          useCORS: true, 
          allowTaint: true, 
          logging: false,
          foreignObjectRendering: false, // 避免 SVG 導致的問題
          removeContainer: true
        }); 
        setExportImgUrl(canvas.toDataURL('image/jpeg', 0.9)); 
      } catch (err) { 
        // 截圖失敗時，依然跳出 Modal，但只顯示複製文字的選項
        setExportImgUrl(null); // 確保是 null
        showToast(`截圖被阻擋，已為您轉換為「純文字」格式`, 'error'); 
      }
    }, 500); 
  };

  return (
    <div className="space-y-4">
      {(exportImgUrl || exportFallbackText) && <ImageExportModal imageUrl={exportImgUrl} fallbackText={exportFallbackText} onClose={() => {setExportImgUrl(null); setExportFallbackText('');}} />}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-3 items-center justify-between">
        <h3 className="font-bold text-slate-800 flex items-center gap-2 self-start md:self-auto"><Search className="w-5 h-5 text-blue-600" /> 進貨紀錄查詢</h3>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
          <CustomDropdown value={filterBranch} onChange={setFilterBranch} options={branchOptions} className="w-full sm:flex-1 md:flex-none min-w-[140px]" buttonClassName="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700" />
          <div className="flex w-full gap-2">
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="flex-1 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-[16px] text-slate-700 focus:ring-2 focus:ring-blue-500" />
            {(filterBranch !== 'all' || filterDate) && (<button onClick={() => {setFilterBranch('all'); setFilterDate('');}} className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors text-sm font-bold whitespace-nowrap">清除</button>)}
          </div>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-slate-200 mx-1"><History className="w-16 h-16 text-slate-200 mx-auto mb-4" /><h2 className="text-xl font-bold text-slate-700">查無相關進貨紀錄</h2></div>
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
              {Object.entries(groupedByCategory).sort(([catA], [catB]) => {
                 const aIsAb = order.abnormalCategories?.[catA];
                 const bIsAb = order.abnormalCategories?.[catB];
                 if(aIsAb && !bIsAb) return -1;
                 if(!aIsAb && bIsAb) return 1;
                 return 0;
              }).map(([category, items], catIdx) => {
                const safeOrderId = order.id.replace(/[^a-zA-Z0-9-]/g, '');
                const cardId = `admin-export-${safeOrderId}-cat-${catIdx}`;
                const isCatReceived = (order.receivedCategories || []).includes(category);
                const isAbnormal = !!order.abnormalCategories?.[category];
                
                return (
                  <div key={category} id={cardId} className={`border-2 rounded-[1.5rem] p-5 mb-4 shadow-sm relative transition-colors ${isAbnormal ? 'bg-[#fff5f5] border-red-300 ring-2 ring-red-100' : 'bg-[#fffdf8] border-[#fde6ca]'}`}>
                     <button data-html2canvas-ignore="true" onClick={() => handleExportCard(cardId, order, category, items, window.showToast)} className="absolute top-4 right-4 p-2 bg-white rounded-full text-slate-400 hover:text-orange-600 transition-colors shadow-sm border border-slate-200 active:scale-95"><Download className="w-4 h-4" /></button>
                     
                     <div className={`flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b pb-3 pr-12 gap-2 ${isAbnormal ? 'border-red-200' : 'border-orange-100/50'}`}>
                       <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl shadow-sm border ${isAbnormal ? 'bg-red-100 border-red-300 text-red-600' : `${bColor.iconBg} ${bColor.border} ${bColor.iconText}`}`}><Store className={`w-5 h-5`} /></div>
                          <div>
                            <h3 className={`font-bold text-[18px] tracking-wide ${isAbnormal ? 'text-red-700' : bColor.text}`}>{order.branchName} 叫貨單: <span className={isAbnormal ? "text-red-600" : "text-orange-600"}>{formatCategory(category)}</span></h3>
                            <p className={`text-[12px] font-bold mt-1 opacity-80 ${isAbnormal ? 'text-red-500' : bColor.text}`}>{order.date.split(' ')[0]}  單號: {order.id}</p>
                          </div>
                       </div>
                       <div className="flex gap-2 items-center">
                         {isAbnormal && (
                           <span className="bg-red-500 text-white px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 shadow-sm"><AlertTriangle className="w-3.5 h-3.5"/> 異常通報</span>
                         )}
                         <StatusBadge status={isCatReceived ? 'received' : order.status} />
                       </div>
                     </div>

                     {isAbnormal && (
                       <div className="mb-4 p-3.5 bg-red-50 rounded-2xl border border-red-100 shadow-inner">
                          <h4 className="font-bold text-red-700 text-[13px] mb-1.5 flex items-center gap-1"><MessageSquare className="w-4 h-4"/> 門店異常備註：</h4>
                          <p className="text-red-900 text-[15px] mb-3 bg-white p-2.5 rounded-xl border border-red-100 font-bold leading-relaxed">{order.abnormalCategories[category].remark || '無填寫說明'}</p>
                          {order.abnormalCategories[category].photo && (
                            <img src={order.abnormalCategories[category].photo} alt="異常照片" className="w-full max-w-[200px] h-auto rounded-xl border-2 border-red-200 object-contain shadow-sm" />
                          )}
                       </div>
                     )}

                     <div className="space-y-3">
                       {items.map((item, idx) => (
                         <div key={idx} className={`flex justify-between items-center px-1 border-b pb-2 last:border-0 last:pb-0 ${isAbnormal ? 'border-red-100' : 'border-slate-100'}`}>
                           <span className="font-bold text-slate-700 text-[17px]">{item.name}</span>
                           <div className="flex items-baseline gap-2">
                             <span className="text-[12px] text-slate-400 font-bold">叫貨</span>
                             <span className={`text-[26px] font-black leading-none ${isAbnormal ? 'text-red-600' : 'text-orange-600'}`}>{item.orderQty}</span>
                             <span className="text-[14px] font-bold text-slate-500 w-8">{item.unit}</span>
                           </div>
                         </div>
                       ))}
                     </div>
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

function AdminAnalytics({ ordersData, branches, products, systemConfig }) {
  const [filterBranch, setFilterBranch] = useState('all');
  const [timeRange, setTimeRange] = useState('week'); 
  const [filterCategory, setFilterCategory] = useState('all'); 
  
  const timeOptions = [
    { value: 'week', label: '最近 7 天' },
    { value: 'month', label: '最近 30 天' }
  ];

  const uniqueBranchNames = useMemo(() => [...new Set(branches.map(b => b.branchName))].filter(Boolean), [branches]);
  const branchOptions = [{ value: 'all', label: '所有門店' }, ...uniqueBranchNames.map(name => ({ value: name, label: name }))];

  const categories = useMemo(() => getSortedCategories(products, systemConfig?.categoryOrder), [products, systemConfig]);
  const categoryOptions = [{ value: 'all', label: '所有分類' }, ...categories.map(c => ({ value: c, label: formatCategory(c) }))];

  const analyticsData = useMemo(() => {
    const now = Date.now();
    const timeLimit = timeRange === 'week' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    const validOrders = ordersData.filter(o => {
      if (filterBranch !== 'all' && o.branchName !== filterBranch) return false;
      if (now - o.timestamp > timeLimit) return false;
      return true;
    });
    const totals = {};
    validOrders.forEach(o => { 
      o.items.forEach(item => { 
        if (filterCategory !== 'all' && item.category !== filterCategory) return;
        if (!totals[item.id]) totals[item.id] = { name: item.name, category: item.category, unit: item.unit, qty: 0 }; 
        totals[item.id].qty += Number(item.orderQty); 
      }); 
    });
    const grouped = {};
    Object.values(totals).forEach(item => { 
      if (!grouped[item.category]) grouped[item.category] = []; 
      grouped[item.category].push(item); 
    });
    Object.keys(grouped).forEach(cat => { grouped[cat].sort((a, b) => b.qty - a.qty); });
    return grouped;
  }, [ordersData, filterBranch, timeRange, filterCategory]);

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-3 items-center justify-between">
        <h3 className="font-bold text-slate-800 flex items-center gap-2"><BarChart2 className="w-5 h-5 text-blue-600" /> 叫貨統計分析</h3>
        <div className="flex w-full md:w-auto gap-2">
          <CustomDropdown value={filterBranch} onChange={setFilterBranch} options={branchOptions} className="flex-1 min-w-[120px]" buttonClassName="px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700" />
          <CustomDropdown value={timeRange} onChange={setTimeRange} options={timeOptions} className="flex-1 min-w-[100px]" buttonClassName="px-3 py-3 bg-blue-50 border border-blue-200 rounded-xl font-bold text-blue-800" />
        </div>
      </div>
      
      <div className="bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
        <div className="font-bold text-slate-600 text-[15px] flex items-center gap-2">
          <Layers className="w-5 h-5 text-orange-500" /> 商品分類篩選
        </div>
        <CustomDropdown 
          value={filterCategory} 
          onChange={setFilterCategory} 
          options={categoryOptions} 
          className="w-auto min-w-[140px]" 
          buttonClassName="px-4 py-2.5 bg-orange-50 border border-orange-200 rounded-xl font-bold text-orange-800 text-[14px]" 
        />
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
function BranchViews({ user, fbUser, products, inventoryData, ordersData, branchInventory, showToast, systemConfig, systemOptions, db, appId }) {
  const [activeTab, setActiveTab] = useState('inventory');
  
  const isManager = user.role === 'manager' || user.role === 'branch'; 
  const branchOrders = useMemo(() => ordersData.filter(o => o.branchName === user.branchName), [ordersData, user.branchName]);

  const tabs = [
    { id: 'inventory', icon: <ClipboardList />, label: '盤點' },
    ...(isManager ? [{ id: 'orders', icon: <ShoppingCart />, label: '叫貨' }] : []),
    { id: 'receiving', icon: <Truck />, label: '進貨' }
  ];

  const updateStockCloud = async (productId, newStockValue) => {
    if(!fbUser) return;
    const valueToSave = newStockValue === '' ? '' : parseFloat(newStockValue); 
    if (valueToSave !== '' && isNaN(valueToSave)) return;

    const docRef = doc(db, 'artifacts', appId, 'public', 'data', DB_INVENTORY, user.branchName);
    await setDoc(docRef, { settings: { [productId]: { currentStock: valueToSave } } }, { merge: true });
  };

  const addOrderCloud = async (newOrderData) => {
    if(!fbUser) return;
    const orderDoc = { ...newOrderData, branchUsername: user.username, branchName: user.branchName, timestamp: Date.now() };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_ORDERS, newOrderData.id), orderDoc);
  };

  const updateOrderPartialReceiptCloud = async (orderId, receivedCategories, newStatus) => {
    if(!fbUser) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_ORDERS, orderId), { 
      receivedCategories, 
      status: newStatus 
    });
  };

  const reportAbnormalCloud = async (orderId, category, data) => {
    if(!fbUser) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_ORDERS, orderId), { 
      [`abnormalCategories.${category}`]: data 
    });
  };

  const resolveAbnormalCloud = async (orderId, category) => {
    if(!fbUser) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_ORDERS, orderId), { 
      [`abnormalCategories.${category}`]: deleteField() 
    });
  };

  const hiddenCategories = inventoryData[user.branchName]?.hiddenCategories || [];
  const branchAnnouncement = inventoryData[user.branchName]?.announcement || '';

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
        {activeTab === 'inventory' && <BranchInventoryCheck inventory={branchInventory} hiddenCategories={hiddenCategories} updateStockCloud={updateStockCloud} addOrderCloud={addOrderCloud} showToast={showToast} systemConfig={systemConfig} products={products} systemOptions={systemOptions} isManager={isManager} branchAnnouncement={branchAnnouncement} />}
        {activeTab === 'orders' && isManager && <BranchOrderManagement purchaseOrders={branchOrders} showToast={showToast} />}
        {activeTab === 'receiving' && <BranchReceivingCheck inventory={branchInventory} updateStockCloud={updateStockCloud} purchaseOrders={branchOrders} updateOrderPartialReceiptCloud={updateOrderPartialReceiptCloud} reportAbnormalCloud={reportAbnormalCloud} resolveAbnormalCloud={resolveAbnormalCloud} showToast={showToast} />}
      </div>
      <BottomNav tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} themeColor={isManager ? 'text-orange-600' : 'text-green-600'} />
    </>
  );
}

function BranchInventoryCheck({ inventory, hiddenCategories, updateStockCloud, addOrderCloud, showToast, systemConfig, products, systemOptions, isManager, branchAnnouncement }) {
  const [activeCategory, setActiveCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState(''); 
  const [errorItemId, setErrorItemId] = useState(null); 

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
    if (!isManager) { showToast('僅限點貨人員操作叫貨功能！', 'error'); return; }

    const currentCategoryItems = visibleInventory.filter(item => item.category === activeCategory);

    const uninventoriedItem = currentCategoryItems.find(item => item.currentStock === '' || item.currentStock === undefined || item.currentStock === null);

    if (uninventoriedItem) {
      showToast(`還有商品未點貨到！請確認【${uninventoriedItem.name}】數量`, 'error');
      setErrorItemId(uninventoriedItem.id);
      
      setTimeout(() => {
        const el = document.getElementById(`item-${uninventoriedItem.id}`);
        if (el) {
          const y = el.getBoundingClientRect().top + window.scrollY - 120;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }, 100);

      setTimeout(() => setErrorItemId(null), 3000);
      return; 
    }

    const itemsToOrder = currentCategoryItems
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
      {branchAnnouncement && (
        <div className="bg-[#fffbf0] border-2 border-orange-200 rounded-[1.5rem] p-4 flex items-start gap-3 shadow-sm">
          <Bell className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 overflow-x-auto">
            <h4 className="text-orange-800 font-bold text-sm mb-2">總部最新公告</h4>
            <div className="bg-white/60 rounded-xl p-3 border border-orange-100/50">
              <pre className="text-slate-700 font-bold font-mono text-[14px] whitespace-pre-wrap leading-relaxed">
                {branchAnnouncement}
              </pre>
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
            <ShieldAlert className="w-4 h-4"/> <span className="hidden sm:inline">叫貨由點貨人員負責</span><span className="sm:hidden">僅開放盤點</span>
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
          const isDeficient = stockNum < item.activeParLevel && item.currentStock !== ''; 
          return (
            <div 
              id={`item-${item.id}`}
              key={item.id} 
              onClick={() => setActiveCategory(item.category)}
              className={`p-5 rounded-[1.8rem] border-2 transition-colors relative shadow-sm cursor-pointer ${errorItemId === item.id ? 'ring-4 ring-red-500 border-red-500 bg-red-50 animate-shake z-10' : isDeficient ? 'bg-[#fffbf0] border-orange-200' : 'bg-white border-slate-100'} ${searchTerm && activeCategory === item.category ? 'ring-2 ring-orange-400 border-orange-400' : ''}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  {searchTerm && <span className="text-[11px] font-bold text-slate-400 block mb-0.5">{formatCategory(item.category)}</span>}
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                     <h3 className="text-[20px] font-black text-slate-800 tracking-wide m-0 leading-tight">{item.name}</h3>
                     {item.includeInUseQty && (
                        <span className="bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-lg text-[11px] font-black tracking-wider whitespace-nowrap shadow-sm">
                          + 含使用中
                        </span>
                     )}
                  </div>
                  <div className="text-[13px] font-bold text-slate-500">
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
              
              <div className={`mt-4 bg-white border rounded-[1.2rem] flex items-center p-2.5 shadow-inner relative transition-all ${errorItemId === item.id ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200 focus-within:ring-2 focus-within:ring-orange-400 focus-within:border-orange-400'}`}>
                <div className={`flex flex-col items-center justify-center text-[11px] font-black leading-[1.2] w-6 select-none ml-1 ${errorItemId === item.id ? 'text-red-500' : 'text-slate-400'}`}>
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
                      if(errorItemId === item.id) setErrorItemId(null); 
                    }}
                    className="w-full h-full bg-transparent text-center text-[28px] font-black text-orange-600 outline-none placeholder-slate-300"
                    placeholder="數量"
                  />
                </div>
                <div className={`w-8 text-center text-[15px] font-bold select-none mr-1 ${errorItemId === item.id ? 'text-red-500' : 'text-slate-500'}`}>{item.unit}</div>
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
  const [exportFallbackText, setExportFallbackText] = useState(''); // 新增：用於複製純文字

  const handleExportCard = async (elementId, orderInfo, categoryStr, itemsList) => {
    // 預先準備好純文字格式，作為截圖失敗的備案
    let fallbackStr = `【${orderInfo.branchName} 叫貨單】\n分類：${formatCategory(categoryStr)}\n日期：${orderInfo.date.split(' ')[0]}\n--------------------\n`;
    itemsList.forEach(item => {
      fallbackStr += `${item.name}： ${item.orderQty} ${item.unit}\n`;
    });
    setExportFallbackText(fallbackStr);

    if (!window.html2canvas) { showToast('截圖元件載入中，請稍候', 'error'); return; }
    const el = document.getElementById(elementId);
    if (!el) { showToast('找不到該單據卡片', 'error'); return; }
    
    showToast('正在為您產生圖檔...', 'success');
    
    setTimeout(async () => {
      try { 
        // 加入更完整的參數，解決 LINE WebView 截圖問題
        const canvas = await window.html2canvas(el, { 
          scale: window.devicePixelRatio > 1 ? 2 : 1, 
          backgroundColor: '#ffffff', 
          useCORS: true, 
          allowTaint: true,
          logging: false,
          foreignObjectRendering: false, // 避免 SVG 導致的問題
          removeContainer: true
        }); 
        setExportImgUrl(canvas.toDataURL('image/jpeg', 0.9)); 
      } catch (err) { 
        // 截圖失敗時，依然跳出 Modal，但只顯示複製文字的選項
        setExportImgUrl(null); // 確保是 null
        showToast(`截圖被阻擋，已為您轉換為「純文字」格式`, 'error'); 
      }
    }, 500); 
  };

  if (purchaseOrders.length === 0) {
    return (<div className="text-center py-20 bg-white rounded-3xl mt-4 mx-1 shadow-sm border border-slate-100"><Package className="w-16 h-16 text-slate-200 mx-auto mb-4" /><h2 className="text-xl font-bold text-slate-700">目前沒有叫貨單</h2><p className="text-sm text-slate-500 mt-2">盤點低於安全庫存即可自動產生</p></div>);
  }

  return (
    <div className="space-y-4 pt-2">
      {(exportImgUrl || exportFallbackText) && <ImageExportModal imageUrl={exportImgUrl} fallbackText={exportFallbackText} onClose={() => {setExportImgUrl(null); setExportFallbackText('');}} />}
      <h2 className="text-[24px] font-black text-slate-800 mb-4 px-1">叫貨單總覽</h2>
      {purchaseOrders.map(order => {
        const groupedByCategory = order.items.reduce((acc, item) => {
          if (!acc[item.category]) acc[item.category] = [];
          acc[item.category].push(item);
          return acc;
        }, {});

        return (
          <div key={order.id} className="mb-6 border-b-2 border-slate-100 pb-6 last:border-0 last:pb-0">
            {Object.entries(groupedByCategory).map(([category, items], catIdx) => {
              const isCatReceived = (order.receivedCategories || []).includes(category);
              const safeOrderId = order.id.replace(/[^a-zA-Z0-9-]/g, '');
              const cardId = `branch-export-${safeOrderId}-cat-${catIdx}`;

              return (
                <div key={category} id={cardId} className="bg-[#fffdf8] border-2 border-[#fde6ca] rounded-[1.5rem] p-5 mb-4 shadow-sm relative">
                   <button data-html2canvas-ignore="true" onClick={() => handleExportCard(cardId, order, category, items)} className="absolute top-4 right-4 p-2 bg-white rounded-full text-slate-400 hover:text-orange-600 transition-colors shadow-sm border border-slate-200 active:scale-95"><Download className="w-4 h-4" /></button>
                   
                   <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-orange-100/50 pb-3 pr-12 gap-2">
                     <div>
                       <h3 className="text-[18px] font-black text-slate-800 tracking-wide">叫貨單: <span className="text-orange-600">{formatCategory(category)}</span></h3>
                       <p className="text-[12px] font-bold text-slate-500 mt-1">{order.date.split(' ')[0]}  單號: {order.id}</p>
                     </div>
                     <StatusBadge status={isCatReceived ? 'received' : order.status} />
                   </div>

                   <div className="space-y-3">
                     {items.map((item, idx) => (
                       <div key={idx} className="flex justify-between items-center px-1 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                         <span className="font-bold text-slate-700 text-[17px]">{item.name}</span>
                         <div className="flex items-baseline gap-2">
                           <span className="text-[12px] text-slate-400 font-bold">叫貨</span>
                           <span className="text-[26px] font-black text-orange-600 leading-none">{item.orderQty}</span>
                           <span className="text-[14px] font-bold text-slate-500 w-8">{item.unit}</span>
                         </div>
                       </div>
                     ))}
                   </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function BranchReceivingCheck({ inventory, updateStockCloud, purchaseOrders, updateOrderPartialReceiptCloud, reportAbnormalCloud, resolveAbnormalCloud, showToast }) {
  const [reportingCat, setReportingCat] = useState(null); 
  const [abnormalRemark, setAbnormalRemark] = useState('');
  const [abnormalPhoto, setAbnormalPhoto] = useState(null);

  const pendingOrders = purchaseOrders.filter(o => o.status !== 'received');

  // 將包含異常的訂單置頂
  const sortedPendingOrders = useMemo(() => {
    return [...pendingOrders].sort((a, b) => {
      const aAbnormal = a.abnormalCategories ? Object.keys(a.abnormalCategories).length > 0 : false;
      const bAbnormal = b.abnormalCategories ? Object.keys(b.abnormalCategories).length > 0 : false;
      if (aAbnormal && !bAbnormal) return -1;
      if (!aAbnormal && bAbnormal) return 1;
      return 0; // 若狀態相同，保留原本由新到舊的排序
    });
  }, [pendingOrders]);

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

    await updateOrderPartialReceiptCloud(order.id, updatedReceived, newStatus);
    showToast(`${formatCategory(category)} 已確認入庫！`);
  };

  const submitAbnormal = async () => {
    if (!reportingCat) return;
    await reportAbnormalCloud(reportingCat.order.id, reportingCat.category, {
      remark: abnormalRemark,
      photo: abnormalPhoto,
      timestamp: Date.now()
    });
    showToast(`${formatCategory(reportingCat.category)} 已回報異常，訂單已置頂！`, 'error');
    closeAbnormalModal();
  };

  const closeAbnormalModal = () => {
    setReportingCat(null);
    setAbnormalRemark('');
    setAbnormalPhoto(null);
  };

  if (pendingOrders.length === 0) return (<div className="text-center py-20 bg-white rounded-3xl mt-4 mx-1"><CheckCircle2 className="w-16 h-16 text-green-300 mx-auto mb-4" /><h2 className="text-xl font-bold text-slate-700">沒有待核對進貨單</h2></div>);

  return (
    <div className="space-y-4 pt-2">
      {/* 異常回報 Modal */}
      {reportingCat && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-xl font-black text-red-600 mb-2 flex items-center gap-2"><AlertTriangle className="w-6 h-6"/> 點收異常回報</h3>
            <p className="text-[15px] font-bold text-slate-600 mb-5 border-b border-slate-100 pb-3">單號分類：<span className="text-orange-600">{formatCategory(reportingCat.category)}</span></p>
            <div className="space-y-4">
              <div>
                <label className="text-[13px] font-bold text-slate-500 mb-1.5 block">異常狀況說明 (可輸入缺貨/數量不符...)</label>
                <textarea value={abnormalRemark} onChange={e => setAbnormalRemark(e.target.value)} rows="3" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-[16px] font-bold text-slate-800 shadow-inner resize-none" placeholder="例如：高麗菜少送兩箱..."></textarea>
              </div>
              <div>
                <label className="text-[13px] font-bold text-slate-500 mb-1.5 block flex items-center gap-1"><Camera className="w-4 h-4"/> 拍照存證 (選填)</label>
                <input type="file" accept="image/*" capture="environment" onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => setAbnormalPhoto(e.target.result);
                    reader.readAsDataURL(file);
                  }
                }} className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-red-50 file:text-red-700 hover:file:bg-red-100 cursor-pointer transition-colors" />
                {abnormalPhoto && <img src={abnormalPhoto} alt="預覽" className="mt-3 w-full h-40 object-contain rounded-xl border border-slate-200 bg-slate-50 shadow-inner" />}
              </div>
              <div className="flex gap-2 pt-3 mt-2 border-t border-slate-100">
                <button onClick={closeAbnormalModal} className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 font-bold rounded-xl transition-all">取消</button>
                <button onClick={submitAbnormal} className="flex-1 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold py-3.5 rounded-xl shadow-md transition-all">確認回報</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <h2 className="text-[24px] font-black text-slate-800 mb-2 px-1">進貨點收</h2>
      <p className="text-xs font-medium text-slate-500 mb-6 px-1">請依分類核對，廠商分批到貨時可直接「點收單一分類」。</p>
      
      {sortedPendingOrders.map(order => {
        const groupedByCategory = order.items.reduce((acc, item) => {
          if (!acc[item.category]) acc[item.category] = [];
          acc[item.category].push(item);
          return acc;
        }, {});

        const pendingCategories = Object.entries(groupedByCategory).filter(
          ([category]) => !(order.receivedCategories || []).includes(category)
        );

        if (pendingCategories.length === 0) return null;
        
        const hasAnyAbnormal = order.abnormalCategories && Object.keys(order.abnormalCategories).length > 0;

        return (
          <div key={order.id} className="mb-12 relative">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-3">
                <div className={`text-white p-2.5 rounded-2xl shadow-lg ${hasAnyAbnormal ? 'bg-red-600 shadow-red-600/20' : 'bg-slate-800 shadow-slate-800/20'}`}>
                  {hasAnyAbnormal ? <AlertTriangle className="w-6 h-6 text-white" /> : <Truck className="w-6 h-6 text-orange-400" />}
                </div>
                <div>
                  <div className="text-[12px] font-bold text-slate-400 mb-0.5">{hasAnyAbnormal ? '有異常點收單 (已置頂)' : '進貨點收單'}</div>
                  <div className="flex items-baseline gap-2"><h3 className={`text-[22px] font-black leading-none ${hasAnyAbnormal ? 'text-red-600' : 'text-slate-800'}`}>{order.id}</h3><span className="text-[13px] font-bold text-slate-500">{order.date.split(' ')[0]}</span></div>
                </div>
              </div>
            </div>

            <div className={`border-2 p-3 rounded-[2rem] shadow-sm ${hasAnyAbnormal ? 'bg-[#fff5f5] border-red-200' : 'bg-[#fffdf8] border-[#fde6ca]'}`}>
              {pendingCategories.map(([category, items]) => {
                 const abnormalData = order.abnormalCategories?.[category];
                 const isAbnormal = !!abnormalData;
                 
                 return (
                   <div key={category} className={`rounded-3xl shadow-sm border overflow-hidden mb-3 last:mb-0 transition-colors ${isAbnormal ? 'bg-white border-red-300 ring-2 ring-red-100' : 'bg-white border-slate-200'}`}>
                     <div className={`p-3.5 flex items-center justify-between border-b ${isAbnormal ? 'bg-red-50/50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                       <div className="flex items-center gap-2">
                         <Layers className={`w-4 h-4 ${isAbnormal ? 'text-red-500' : 'text-orange-500'}`} />
                         <h3 className={`font-black text-[16px] ${isAbnormal ? 'text-red-700' : 'text-slate-800'}`}>{formatCategory(category)}</h3>
                       </div>
                       {isAbnormal && <span className="bg-red-500 text-white px-2 py-0.5 rounded text-[11px] font-bold animate-pulse">異常處理中</span>}
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
                     
                     {isAbnormal && (
                       <div className="px-3.5 py-3 bg-red-50/30 border-t border-red-100">
                         <h4 className="font-bold text-red-700 text-[13px] mb-1.5 flex items-center gap-1"><MessageSquare className="w-4 h-4"/> 異常備註：</h4>
                         <p className="text-red-900 text-[15px] font-bold mb-2 bg-white p-2.5 rounded-xl border border-red-100 leading-relaxed">{abnormalData.remark || '無備註'}</p>
                         {abnormalData.photo && <img src={abnormalData.photo} alt="異常照片" className="w-full max-w-[200px] h-auto rounded-xl border border-red-200 object-contain shadow-sm mt-2" />}
                       </div>
                     )}

                     <div className={`p-3 border-t flex gap-2 ${isAbnormal ? 'bg-red-50/50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                       {isAbnormal ? (
                         <button onClick={() => resolveAbnormalCloud(order.id, category)} className="w-full bg-green-500 hover:bg-green-600 active:scale-95 text-white font-bold py-3.5 rounded-2xl flex justify-center items-center gap-2 transition-all shadow-md text-[15px]">
                           <CheckCircle2 className="w-5 h-5" /> 點貨正常 (已修復)
                         </button>
                       ) : (
                         <>
                           <button onClick={() => setReportingCat({ order, category })} className="w-1/3 bg-red-50 hover:bg-red-100 active:scale-95 text-red-600 font-bold py-3.5 rounded-2xl flex justify-center items-center gap-1.5 transition-all shadow-sm border border-red-200 text-[14px]">
                             <AlertTriangle className="w-4 h-4" /> 異常
                           </button>
                           <button onClick={() => handleReceiveCategory(order, category, items)} className="w-2/3 bg-orange-600 hover:bg-orange-700 active:scale-95 text-white font-bold py-3.5 rounded-2xl flex justify-center items-center gap-2 transition-all shadow-sm text-[15px]">
                             <CheckCircle2 className="w-5 h-5" /> 點收 {formatCategory(category)}
                           </button>
                         </>
                       )}
                     </div>
                   </div>
                 );
              }).sort((a, b) => {
                 const catA = a.key;
                 const catB = b.key;
                 const aIsAb = order.abnormalCategories?.[catA];
                 const bIsAb = order.abnormalCategories?.[catB];
                 if(aIsAb && !bIsAb) return -1;
                 if(!aIsAb && bIsAb) return 1;
                 return 0;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
