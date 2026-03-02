import React, { useState, useEffect, useMemo } from 'react';
import { 
  Utensils, ClipboardList, ShoppingCart, Truck, 
  LogOut, CheckCircle2, AlertCircle, Package, 
  Store, ShieldAlert, PlusCircle, Settings, 
  Database, Users, History, Layers, Calendar,
  BarChart2, Filter, Search, ChevronDown, Camera, Download, GripVertical, Menu,
  Edit2, Trash2, Save, Eye, EyeOff, ScanLine, MapPin, MapPinOff, ShieldCheck, X
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';

// --- Firebase Setup (您的專屬金鑰) ---
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
  { id: 'p1', category: '蔬果類', name: '高麗菜', unit: '顆', defaultPar: 50, order: 1 },
  { id: 'p2', category: '蔬果類', name: '大白菜', unit: '顆', defaultPar: 30, order: 2 },
  { id: 'p3', category: '蔬果類', name: '金針菇', unit: '包', defaultPar: 100, order: 3 },
  { id: 'p6', category: '肉類', name: '特級雪花牛', unit: '公斤', defaultPar: 20, order: 4 },
  { id: 'p7', category: '肉類', name: '台灣梅花豬', unit: '公斤', defaultPar: 25, order: 5 },
  { id: 'p10', category: '海鮮與火鍋料', name: '大白蝦', unit: '盒', defaultPar: 20, order: 6 },
];

const adminUserSeed = { username: 'admin', password: 'admin123', role: 'admin', branchName: '總管理處' };

const formatCategory = (category) => {
  if (!category) return '';
  return category.replace(/[【】\[\]《》〈〉()]/g, '').trim();
};

const getEffectiveHolidayMode = (modeStr) => {
  if (modeStr === 'holiday') return true;
  if (modeStr === 'weekday') return false;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1); 
  const day = yesterday.getDay();
  return day === 0 || day === 6; 
};

export default function App() {
  const [fbUser, setFbUser] = useState(null);
  const [isReady, setIsReady] = useState(false);
  
  const [usersDb, setUsersDb] = useState([]); 
  const [products, setProducts] = useState([]);
  const [inventoryData, setInventoryData] = useState({}); 
  const [ordersData, setOrdersData] = useState([]);
  
  const [systemConfig, setSystemConfig] = useState({ holidayMode: 'auto', isGPSRequired: false });
  const [systemOptions, setSystemOptions] = useState({ categories: [], units: [] });

  const [user, setUser] = useState(null); 
  const [authMode, setAuthMode] = useState('login'); 
  const [toast, setToast] = useState(null);

  const [showAdminHint, setShowAdminHint] = useState(false);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [secretInput, setSecretInput] = useState('');

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

    const unsubUsers = onSnapshot(usersRef, (snap) => {
      setUsersDb(snap.docs.map(d => d.data()));
    });
    const unsubProducts = onSnapshot(productsRef, (snap) => {
      const data = snap.docs.map(d => d.data());
      data.sort((a, b) => (a.order || 0) - (b.order || 0));
      setProducts(data);
      setIsReady(true);
    });
    // ⭐ 更新：正確儲存整包 inventoryData (包含 settings 與 hiddenCategories)
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
      let config = { holidayMode: 'auto', isGPSRequired: false };
      snap.docs.forEach(d => { 
        if (d.id === 'config') {
          const data = d.data();
          if (data.holidayMode) config.holidayMode = data.holidayMode;
          else if (data.isHolidayMode !== undefined) config.holidayMode = data.isHolidayMode ? 'holiday' : 'weekday';
          
          if (data.isGPSRequired !== undefined) config.isGPSRequired = data.isGPSRequired;
        }
      });
      setSystemConfig(config);
    });

    const optionsRef = doc(db, 'artifacts', appId, 'public', 'data', DB_SYSTEM, 'options');
    const unsubOptions = onSnapshot(optionsRef, (snap) => {
      if (snap.exists()) {
        setSystemOptions(snap.data());
      } else {
        const initOpts = {
          categories: ['蔬果類', '肉類', '海鮮與火鍋料'],
          units: ['顆', '包', '公斤', '盒', '斤', '把']
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
      if (username === 'admin' || usersDb.some(u => u.username === username)) {
        showToast('帳號已存在', 'error'); return;
      }
      const newUser = { username, password, role: 'branch', branchName, lat: '', lng: '' };
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_USERS, username), newUser);
      setUser(newUser);
      showToast('門店註冊成功！');
    } else {
      if (username === 'admin' && password === 'admin123') {
        const adminObj = usersDb.find(u => u.username === 'admin') || adminUserSeed;
        if (!usersDb.some(u => u.username === 'admin')) {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_USERS, 'admin'), adminObj);
        }
        setUser(adminObj);
        showToast('總後台登入成功！');
        return;
      }
      const existingUser = usersDb.find(u => u.username === username && u.password === password);
      if (existingUser) {
        setUser(existingUser);
        showToast('登入成功！');
      } else {
        showToast('帳號或密碼錯誤', 'error');
      }
    }
  };

  const logout = () => { setUser(null); showToast('已登出系統'); };

  const handleLogoClick = () => {
    if (!showAdminHint) setShowSecretModal(true);
    else setShowAdminHint(false);
  };

  const handleSecretSubmit = (e) => {
    e.preventDefault();
    if (secretInput === '0204') { 
      setShowAdminHint(true); setShowSecretModal(false); setSecretInput('');
    } else {
      showToast('解鎖密碼錯誤', 'error'); setSecretInput('');
    }
  };

  // ⭐ 更新：正確讀取各門店的庫存配額設定
  const getBranchInventory = (branchUsername) => {
    const branchDoc = inventoryData[branchUsername] || {};
    const branchSettings = branchDoc.settings || {};
    const isHoliday = getEffectiveHolidayMode(systemConfig.holidayMode);

    return products.map(product => {
      const bSetting = branchSettings[product.id] || {};
      const regularPar = bSetting.parLevel !== undefined ? bSetting.parLevel : product.defaultPar;
      const holidayPar = bSetting.parLevelHoliday !== undefined ? bSetting.parLevelHoliday : regularPar;
      return {
        ...product,
        currentStock: bSetting.currentStock || 0,
        parLevel: regularPar,
        parLevelHoliday: holidayPar,
        activeParLevel: isHoliday ? holidayPar : regularPar
      };
    });
  };

  if (!isReady) {
    return <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div></div>;
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col md:flex-row overflow-hidden font-sans text-slate-800">
      <style dangerouslySetInnerHTML={{__html: `
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}} />

      {toast && <Toast message={toast.message} type={toast.type} />}
      
      {!user ? (
        <div className="flex-1 flex items-center justify-center p-4">
          {showSecretModal && (
            <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm transition-all">
              <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl">
                <h3 className="text-lg font-bold text-slate-800 mb-4 text-center">顯示總部帳號</h3>
                <form onSubmit={handleSecretSubmit}>
                  <input 
                    type="password" value={secretInput} onChange={(e) => setSecretInput(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all mb-4 text-center tracking-widest text-[16px] font-bold"
                    placeholder="請輸入解鎖碼" autoFocus
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => {setShowSecretModal(false); setSecretInput('');}} className="flex-1 py-3.5 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors">取消</button>
                    <button type="submit" className="flex-1 bg-slate-900 text-white font-bold py-3.5 rounded-xl hover:bg-slate-800 transition-colors shadow-md">確認</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 pb-4 relative">
            <div className="bg-slate-900 pt-10 pb-8 px-6 text-center rounded-b-3xl shadow-inner">
              
              <div 
                onClick={handleLogoClick}
                className="mx-auto bg-[#1a2130] w-24 h-24 rounded-[1.25rem] flex items-center justify-center mb-5 border border-white/20 shadow-xl cursor-pointer hover:bg-[#1f293d] active:scale-95 transition-all p-1.5 overflow-hidden"
              >
                <img 
                  src="/logo.png" 
                  alt="一品香 Logo" 
                  className="w-full h-full object-contain mix-blend-screen"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextElementSibling.style.display = 'block';
                  }}
                />
                <Utensils className="text-orange-500 w-10 h-10 hidden" />
              </div>
              
              <h1 className="text-2xl font-bold text-white tracking-wider">一品香 ERP</h1>
              <p className="text-slate-400 mt-2 text-sm">雲端門店營運系統</p>
            </div>
            <div className="p-8">
              {showAdminHint && (
                <div className="mb-6 p-3 bg-blue-50 text-blue-800 rounded-xl border border-blue-100 text-sm flex items-start gap-2 shadow-sm">
                  <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p>總管理處登入：<br/>帳號 <strong>admin</strong> / 密碼 <strong>admin123</strong></p>
                </div>
              )}
              <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">
                {authMode === 'login' ? '系統登入' : '註冊新門店'}
              </h2>
              <form onSubmit={handleAuth} className="space-y-4">
                {authMode === 'register' && (
                  <div><input required name="branchName" type="text" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-[16px]" placeholder="門店名稱 (例如：台北店)" /></div>
                )}
                <div><input required name="username" type="text" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-[16px]" placeholder="帳號" /></div>
                <div><input required name="password" type="password" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-[16px]" placeholder="密碼" /></div>
                <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold py-4 mt-2 rounded-xl transition-all shadow-md shadow-slate-900/20 text-[16px]">
                  {authMode === 'login' ? '登入系統' : '註冊門店'}
                </button>
              </form>
              <div className="mt-8 text-center text-[15px] text-slate-600">
                {authMode === 'login' ? (
                  <button onClick={() => setAuthMode('register')} className="text-orange-600 font-bold hover:underline px-4 py-2">註冊新門店</button>
                ) : (
                  <button onClick={() => setAuthMode('login')} className="text-orange-600 font-bold hover:underline px-4 py-2">返回登入</button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <header className="md:hidden bg-white/90 backdrop-blur-md shadow-sm px-4 py-3.5 flex items-center justify-between z-10 sticky top-0 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${user.role === 'admin' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                {user.role === 'admin' ? <ShieldAlert className="w-5 h-5" /> : <Store className="w-5 h-5" />}
              </div>
              <span className="font-bold text-slate-800 text-[16px]">{user.branchName}</span>
            </div>
            <button onClick={logout} className="p-2.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </header>

          <main className="flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+90px)] md:pb-0 relative scroll-smooth w-full">
            {user.role === 'admin' ? (
              // ⭐ 更新 AdminViews 傳遞參數
              <AdminViews products={products} usersDb={usersDb} inventoryData={inventoryData} ordersData={ordersData} getBranchInventory={getBranchInventory} showToast={showToast} fbUser={fbUser} systemConfig={systemConfig} systemOptions={systemOptions} db={db} appId={appId} />
            ) : (
              <LocationGuard user={user} systemConfig={systemConfig} logout={logout}>
                <BranchViews user={user} fbUser={fbUser} products={products} inventoryData={inventoryData} ordersData={ordersData} branchInventory={getBranchInventory(user.username)} showToast={showToast} systemConfig={systemConfig} db={db} appId={appId} />
              </LocationGuard>
            )}
          </main>

          <aside className="hidden md:flex w-64 bg-slate-900 text-white flex-col flex-shrink-0">
            <div className="p-6 border-b border-slate-800">
              <div className={`flex items-center gap-3 mb-1 ${user.role === 'admin' ? 'text-blue-500' : 'text-orange-500'}`}>
                <Utensils className="w-6 h-6" />
                <span className="font-bold text-xl tracking-wider">一品香 ERP</span>
              </div>
              <p className="text-slate-400 text-sm flex items-center gap-2 mt-2">
                <Store className="w-4 h-4" /> {user.branchName}
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
// ⭐ GPS 定位防護元件
// ==========================================
function LocationGuard({ user, systemConfig, children, logout }) {
  const [status, setStatus] = useState('checking'); 
  const [distance, setDistance] = useState(null);

  useEffect(() => {
    if (!systemConfig?.isGPSRequired) {
      setStatus('passed');
      return;
    }
    if (!user.lat || !user.lng) {
      setStatus('no_coords');
      return;
    }
    setStatus('checking');
    if (!("geolocation" in navigator)) {
      setStatus('error');
      return;
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
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(currentLat * MathPI / 180) * Math.cos(targetLat * MathPI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const dist = Math.round(R * c);

      setDistance(dist);

      if (dist <= 300) { 
        setStatus('passed');
      } else {
        setStatus('failed');
      }
    };
    const error = () => {
      setStatus('error');
    };
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
            <p className="text-slate-500 text-sm mb-8 font-medium">總部已啟動門店定位驗證，請在彈出的提示中點擊<strong className="text-blue-600 ml-1">「允許存取位置」</strong>。</p>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <MapPinOff className="w-12 h-12" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">不在授權範圍內</h2>
            <p className="text-slate-600 text-[15px] mb-8 font-medium leading-relaxed">
              您目前距離門店約 <strong className="text-red-600 text-lg bg-red-50 px-2 py-0.5 rounded-lg">{distance} 公尺</strong>。<br/><span className="text-sm mt-2 block text-slate-400">基於商業機密保護，您必須在店面周圍 300 公尺內才能登入系統。</span>
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-24 h-24 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <AlertCircle className="w-12 h-12" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">無法取得定位</h2>
            <p className="text-slate-600 text-sm mb-6 font-medium">請確認您的手機已開啟 GPS，並在瀏覽器設定中「允許」本網頁存取位置資訊。</p>
            <button onClick={() => window.location.reload()} className="w-full bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold py-3.5 rounded-xl mb-3 transition-all">重新嘗試</button>
          </>
        )}

        {status === 'no_coords' && (
          <>
             <div className="w-24 h-24 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <MapPin className="w-12 h-12" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">尚未綁定座標</h2>
            <p className="text-slate-600 text-sm mb-8 font-medium">系統已開啟 GPS 鎖，但總部尚未在後台設定本店的位置座標，無法進行驗證。請聯絡總管理處。</p>
          </>
        )}
        
        <button onClick={logout} className="w-full bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md">
          <LogOut className="w-5 h-5"/> 安全登出
        </button>
      </div>
    </div>
  );
}


// ==========================================
// 共用元件 (包含截圖預覽 Modal)
// ==========================================
function Toast({ message, type }) {
  const isError = type === 'error';
  return (
    <div className={`fixed top-[env(safe-area-inset-top,16px)] md:top-4 left-1/2 transform -translate-x-1/2 mt-4 md:mt-0 z-[999] flex items-center gap-2 px-6 py-3.5 rounded-full shadow-2xl transition-all animate-bounce w-max max-w-[90vw] ${
      isError ? 'bg-red-600 text-white' : 'bg-slate-800 text-white'
    }`}>
      {isError ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5 text-green-400" />}
      <span className="font-bold text-[15px]">{message}</span>
    </div>
  );
}

function ImageExportModal({ imageUrl, onClose }) {
  if (!imageUrl) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/95 z-[100] flex flex-col items-center justify-center p-6 backdrop-blur-sm animate-in fade-in duration-200">
       <div className="flex items-center gap-2 text-white font-bold mb-6 bg-slate-800 px-5 py-2.5 rounded-full shadow-lg">
         <Download className="w-5 h-5 text-blue-400"/> 
         請對著下方圖片<span className="text-blue-400">長按儲存</span>或分享
       </div>
       <div className="relative w-full max-w-sm max-h-[65vh] overflow-y-auto rounded-2xl shadow-2xl bg-white border-4 border-slate-700">
         <img src={imageUrl} alt="訂單匯出圖片" className="w-full h-auto block" />
       </div>
       <button onClick={onClose} className="mt-8 bg-white/10 hover:bg-white/20 active:scale-95 text-white px-10 py-3.5 rounded-2xl font-bold transition-all border border-white/20">
         關閉視窗
       </button>
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
              <div key={opt.value} onClick={() => { onChange(opt.value); setIsOpen(false); }} className={`px-4 py-3.5 cursor-pointer font-bold text-[16px] transition-colors ${value === opt.value ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                {opt.label}
              </div>
            ))}
          </div>
        </>
      )}
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
  if (status === 'received') {
    return (
      <span className="px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1 border bg-white shadow-sm text-green-600 border-green-200">
        <CheckCircle2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">已核對入庫</span><span className="sm:hidden">已入庫</span>
      </span>
    );
  } else if (status === 'partial') {
    return (
      <span className="px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1 border bg-white shadow-sm text-blue-600 border-blue-200">
        <Package className="w-3.5 h-3.5" /> <span className="hidden sm:inline">部分入庫</span><span className="sm:hidden">部分入庫</span>
      </span>
    );
  } else {
    return (
      <span className="px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1 border bg-white shadow-sm text-orange-500 border-orange-200">
        <Truck className="w-3.5 h-3.5" /> <span className="hidden sm:inline">待進貨</span><span className="sm:hidden">待進貨</span>
      </span>
    );
  }
}

// ==========================================
// 總部後台視圖
// ==========================================
function AdminViews({ products, usersDb, inventoryData, ordersData, getBranchInventory, showToast, fbUser, systemConfig, systemOptions, db, appId }) {
  const [activeTab, setActiveTab] = useState('products');
  const branches = usersDb.filter(u => u.role === 'branch');

  const tabs = [
    { id: 'products', icon: <Database />, label: '商品庫' },
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
        {activeTab === 'products' && <AdminProductManager products={products} showToast={showToast} fbUser={fbUser} systemOptions={systemOptions} db={db} appId={appId} />}
        {/* ⭐ 更新：將 products 與 inventoryData 傳入 AdminQuotaManager 以支援分類開關功能 */}
        {activeTab === 'quotas' && <AdminQuotaManager branches={branches} products={products} inventoryData={inventoryData} getBranchInventory={getBranchInventory} fbUser={fbUser} showToast={showToast} systemConfig={systemConfig} db={db} appId={appId} />}
        {activeTab === 'branches' && <AdminBranchManager branches={branches} showToast={showToast} fbUser={fbUser} db={db} appId={appId} />}
        {activeTab === 'history' && <AdminOrderHistory ordersData={ordersData} branches={branches} showToast={showToast} />}
        {activeTab === 'analytics' && <AdminAnalytics ordersData={ordersData} branches={branches} />}
      </div>
      <BottomNav tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} themeColor="text-blue-600" />
    </>
  );
}

function AdminBranchManager({ branches, showToast, fbUser, db, appId }) {
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ branchName: '', password: '', lat: '', lng: '' });
  const [showPasswords, setShowPasswords] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const startEdit = (b) => {
    setEditId(b.username);
    setEditForm({ branchName: b.branchName, password: b.password, lat: b.lat || '', lng: b.lng || '' });
    setConfirmDeleteId(null);
  };

  const cancelEdit = () => setEditId(null);

  const saveEdit = async () => {
    if(!fbUser) return;
    if (!editForm.branchName || !editForm.password) {
      showToast('店名與密碼不能為空', 'error'); return;
    }
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_USERS, editId), {
      branchName: editForm.branchName,
      password: editForm.password,
      lat: editForm.lat,
      lng: editForm.lng
    });
    showToast('門店資料更新成功！');
    setEditId(null);
  };

  const executeDelete = async (username) => {
    if(!fbUser) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_USERS, username));
    showToast('門店帳號已刪除');
    setConfirmDeleteId(null);
  };

  if (branches.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl mx-4 shadow-sm border border-slate-200">
        <Store className="w-16 h-16 text-slate-200 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-700">目前尚無註冊的門店</h2>
        <p className="text-sm text-slate-500 mt-2">請門店人員透過登入頁面的「註冊新門店」建立帳號</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-2">
        <Users className="w-5 h-5 text-blue-600" />
        <h3 className="font-bold text-slate-800">門店帳號與 GPS 權限管理</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {branches.map(b => {
          const isEditing = editId === b.username;
          const isConfirmDelete = confirmDeleteId === b.username;

          return (
            <div key={b.username} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 flex flex-col gap-4">
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">門店名稱 (對外顯示)</label>
                    <input type="text" value={editForm.branchName} onChange={e => setEditForm({...editForm, branchName: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-[16px] font-bold" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block text-slate-400">登入帳號 (不可改)</label>
                    <input type="text" value={b.username} disabled className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-400 text-[16px] font-bold cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">登入密碼</label>
                    <input type="text" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-[16px] font-bold tracking-wider" />
                  </div>
                  <div className="pt-2 border-t border-slate-100">
                    <label className="text-xs font-bold text-blue-600 mb-2 flex items-center gap-1"><MapPin className="w-3.5 h-3.5"/> 門店 GPS 座標設定</label>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <input type="text" value={editForm.lat} onChange={e => setEditForm({...editForm, lat: e.target.value.trim()})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-[14px]" placeholder="緯度 (Lat)" />
                      </div>
                      <div className="flex-1">
                        <input type="text" value={editForm.lng} onChange={e => setEditForm({...editForm, lng: e.target.value.trim()})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-[14px]" placeholder="經度 (Lng)" />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5 font-medium">提示：請在 Google Map 上對門店按右鍵，即可複製經緯度 (例如: 23.709, 120.543)。</p>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <button onClick={cancelEdit} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">取消</button>
                    <button onClick={saveEdit} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 transition-colors flex justify-center items-center gap-1"><Save className="w-4 h-4"/> 儲存修改</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-50 rounded-2xl text-blue-600 border border-blue-100">
                      <Store className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 text-[18px] tracking-wide">{b.branchName}</h4>
                      <div className="text-[12px] font-bold text-slate-400 mt-0.5">分店權限正常</div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2.5">
                    <div className="flex justify-between items-center text-[15px]">
                      <span className="font-bold text-slate-500">帳號</span>
                      <span className="font-black text-slate-700">{b.username}</span>
                    </div>
                    <div className="flex justify-between items-center text-[15px]">
                      <span className="font-bold text-slate-500">密碼</span>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-700 tracking-wider">
                          {showPasswords[b.username] ? b.password : '••••••'}
                        </span>
                        <button onClick={() => setShowPasswords(prev => ({...prev, [b.username]: !prev[b.username]}))} className="p-1.5 bg-white rounded-lg border border-slate-200 text-slate-400 hover:text-blue-600 shadow-sm transition-colors active:scale-95">
                          {showPasswords[b.username] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-[15px] pt-1 border-t border-slate-200/60">
                      <span className="font-bold text-slate-500 flex items-center gap-1"><MapPin className="w-4 h-4"/> 綁定座標</span>
                      <span className={`font-medium text-[13px] ${b.lat && b.lng ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>
                        {b.lat && b.lng ? `${b.lat}, ${b.lng}` : '尚未設定'}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-1">
                    {isConfirmDelete ? (
                      <>
                        <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl text-sm transition-colors hover:bg-slate-200">保留帳號</button>
                        <button onClick={() => executeDelete(b.username)} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl shadow-md text-sm transition-colors flex justify-center items-center gap-1 hover:bg-red-700"><Trash2 className="w-4 h-4"/> 確定刪除</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(b)} className="flex-1 py-3 bg-slate-800 text-white font-bold rounded-xl shadow-md hover:bg-slate-700 transition-colors flex justify-center items-center gap-1.5 text-sm"><Edit2 className="w-4 h-4"/> 編輯資料</button>
                        <button onClick={() => setConfirmDeleteId(b.username)} className="py-3 px-4 border-2 border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200 font-bold rounded-xl transition-colors flex justify-center items-center"><Trash2 className="w-4 h-4"/></button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminProductManager({ products, showToast, fbUser, systemOptions, db, appId }) {
  const [searchTerm, setSearchTerm] = useState(''); 
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const [editingCategory, setEditingCategory] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(null);

  const [newCatInput, setNewCatInput] = useState('');
  const [newUnitInput, setNewUnitInput] = useState('');

  const handleAddOption = async (type) => {
    if(!fbUser) return;
    const val = type === 'categories' ? newCatInput.trim() : newUnitInput.trim();
    if(!val) return;
    if((systemOptions[type] || []).includes(val)) {
      showToast(`「${val}」已經存在選項中！`, 'error');
      return;
    }
    const updatedOptions = { ...systemOptions, [type]: [...(systemOptions[type] || []), val] };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_SYSTEM, 'options'), updatedOptions);
    type === 'categories' ? setNewCatInput('') : setNewUnitInput('');
    showToast(`成功新增${type === 'categories' ? '分類' : '單位'}：${val}`);
  };

  const handleRemoveOption = async (type, valToRemove) => {
    if(!fbUser) return;
    if(!window.confirm(`確定要刪除選項「${valToRemove}」嗎？這不會刪除原本已經使用該選項的商品。`)) return;
    const updatedOptions = { ...systemOptions, [type]: (systemOptions[type] || []).filter(v => v !== valToRemove) };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_SYSTEM, 'options'), updatedOptions);
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if(!fbUser) return;
    const formData = new FormData(e.target);
    const newName = formData.get('name').trim();

    const isDuplicate = products.some(p => p.name === newName);
    if (isDuplicate) {
      showToast(`商品「${newName}」已經存在，請勿重複輸入！`, 'error');
      return; 
    }

    const id = Date.now().toString();
    const newProduct = {
      id, category: formData.get('category').trim(), name: newName,
      unit: formData.get('unit').trim(), defaultPar: parseFloat(formData.get('defaultPar')) || 0,
      order: products.length 
    };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_PRODUCTS, id), newProduct);
    e.target.reset(); showToast(`成功新增：${newProduct.name}`);
  };

  const executeMove = (dragId, targetId, category) => {
    if (!dragId || dragId === targetId) { setDraggedId(null); setDragOverId(null); return; }
    const categoryItems = products.filter(p => p.category === category);
    const draggedIndex = categoryItems.findIndex(p => p.id === dragId);
    const targetIndex = categoryItems.findIndex(p => p.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;
    const newItems = [...categoryItems];
    const [removed] = newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, removed);

    newItems.forEach((item, index) => {
      updateDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_PRODUCTS, item.id), { order: index });
    });
    setDraggedId(null); setDragOverId(null);
    showToast('分類排序已更新！');
  };

  const handleDragStart = (e, id) => { setDraggedId(id); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e, id) => { e.preventDefault(); setDragOverId(id); };
  const handleDrop = (e, targetId, category) => { e.preventDefault(); executeMove(draggedId, targetId, category); };
  const handleTouchStart = (e, id) => { setDraggedId(id); };
  const handleTouchMove = (e, category) => {
    if (!draggedId) return;
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const targetId = el?.closest('[data-drag-id]')?.getAttribute('data-drag-id');
    if (targetId && targetId !== dragOverId && products.find(p => p.id === targetId)?.category === category) {
      setDragOverId(targetId);
    }
  };
  const handleTouchEnd = (e, category) => {
    if (draggedId && dragOverId && draggedId !== dragOverId) executeMove(draggedId, dragOverId, category);
    else { setDraggedId(null); setDragOverId(null); }
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    const newName = e.target.newCategoryName.value.trim();
    if (!newName || newName === editingCategory) { setEditingCategory(null); return; }
    
    const itemsToUpdate = products.filter(p => p.category === editingCategory);
    for (const item of itemsToUpdate) {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_PRODUCTS, item.id), { category: newName });
    }
    showToast(`分類已更新為：${newName}`);
    setEditingCategory(null);
  };

  const confirmDeleteCategory = async () => {
    const itemsToDelete = products.filter(p => p.category === deletingCategory);
    for (const item of itemsToDelete) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_PRODUCTS, item.id));
    }
    showToast(`已刪除分類：${deletingCategory}`);
    setDeletingCategory(null);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newName = formData.get('name').trim();

    const isDuplicate = products.some(p => p.id !== editingProduct.id && p.name === newName);
    if (isDuplicate) {
      showToast(`商品「${newName}」已經存在，請更換名稱！`, 'error');
      return; 
    }

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', DB_PRODUCTS, editingProduct.id), {
      name: newName,
      unit: formData.get('unit').trim(),
      defaultPar: parseFloat(formData.get('defaultPar')) || 0
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
    const category = product.category;
    if (!groups[category]) groups[category] = [];
    groups[category].push(product);
    return groups;
  }, {});

  return (
    <div className="space-y-6 relative">
      {editingCategory && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Edit2 className="w-5 h-5 text-blue-600"/> 編輯分類名稱</h3>
            <form onSubmit={handleSaveCategory}>
              <input required name="newCategoryName" defaultValue={editingCategory} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none mb-4 text-[16px] font-bold" placeholder="輸入新分類名稱" />
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditingCategory(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors">取消</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-md">儲存修改</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingCategory && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><Trash2 className="w-8 h-8"/></div>
            <h3 className="text-xl font-black text-center text-slate-800 mb-2">刪除分類警告</h3>
            <p className="text-center text-slate-500 font-medium mb-6 leading-relaxed">
              確定要刪除 <strong className="text-slate-700">{deletingCategory}</strong> 嗎？<br/>這將會<span className="text-red-500 font-bold">同步刪除底下所有的商品</span>，且無法復原！
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeletingCategory(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors">取消保留</button>
              <button onClick={confirmDeleteCategory} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-colors shadow-md">確定刪除</button>
            </div>
          </div>
        </div>
      )}

      {editingProduct && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Edit2 className="w-5 h-5 text-blue-600"/> 編輯商品內容</h3>
            <form onSubmit={handleSaveProduct} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">商品名稱</label>
                <input required name="name" defaultValue={editingProduct.name} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-[16px] font-bold" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-500 mb-1 block">單位 (選單)</label>
                  <select required name="unit" defaultValue={editingProduct.unit} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-[16px] font-bold">
                    <option value="" disabled>請選擇</option>
                    {(systemOptions.units || []).map(u => <option key={u} value={u}>{u}</option>)}
                    {!(systemOptions.units || []).includes(editingProduct.unit) && <option value={editingProduct.unit}>{editingProduct.unit}</option>}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-slate-500 mb-1 block">預設配額 (0-100)</label>
                  <select required name="defaultPar" defaultValue={editingProduct.defaultPar} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-[16px] font-bold text-blue-600">
                    <option value="0">0</option>
                    {Array.from({ length: 100 }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-3">
                <button type="button" onClick={() => setEditingProduct(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors">取消</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-md">儲存修改</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingProduct && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-center text-slate-800 mb-3">刪除商品</h3>
            <p className="text-center text-slate-500 font-medium mb-6">
              確定要刪除 <strong className="text-slate-700">{deletingProduct.name}</strong> 嗎？
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeletingProduct(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors">取消</button>
              <button onClick={confirmDeleteProduct} className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-colors shadow-md flex items-center justify-center gap-1"><Trash2 className="w-4 h-4"/> 確定刪除</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <h4 className="font-bold text-slate-700 mb-3 text-[14px] flex items-center gap-1.5"><Layers className="w-4 h-4 text-blue-500"/> 自訂商品分類</h4>
          <div className="flex gap-2 mb-3">
            <input value={newCatInput} onChange={e => setNewCatInput(e.target.value)} type="text" placeholder="輸入新分類名稱..." className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium" />
            <button onClick={() => handleAddOption('categories')} className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold px-4 py-2 rounded-lg transition-colors text-sm">新增</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(systemOptions.categories || []).map(c => (
              <span key={c} className="bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1">
                {c} <button onClick={() => handleRemoveOption('categories', c)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full p-0.5 transition-colors"><X className="w-3 h-3"/></button>
              </span>
            ))}
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <h4 className="font-bold text-slate-700 mb-3 text-[14px] flex items-center gap-1.5"><Package className="w-4 h-4 text-orange-500"/> 自訂計算單位</h4>
          <div className="flex gap-2 mb-3">
            <input value={newUnitInput} onChange={e => setNewUnitInput(e.target.value)} type="text" placeholder="輸入新單位名稱..." className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm font-medium" />
            <button onClick={() => handleAddOption('units')} className="bg-orange-100 hover:bg-orange-200 text-orange-700 font-bold px-4 py-2 rounded-lg transition-colors text-sm">新增</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(systemOptions.units || []).map(u => (
              <span key={u} className="bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1">
                {u} <button onClick={() => handleRemoveOption('units', u)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full p-0.5 transition-colors"><X className="w-3 h-3"/></button>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><PlusCircle className="w-5 h-5 text-blue-600" /> 新增商品 (雲端同步)</h3>
        <form onSubmit={handleAddProduct} className="flex flex-col md:grid md:grid-cols-5 gap-3 items-end">
          
          <div className="col-span-2 md:col-span-1">
            <label className="block text-xs font-bold text-slate-500 mb-1">選擇分類</label>
            <select required name="category" defaultValue="" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-[16px] cursor-pointer">
              <option value="" disabled>請選擇分類</option>
              {(systemOptions.categories || []).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="col-span-2 md:col-span-1">
            <label className="block text-xs font-bold text-slate-500 mb-1">輸入商品名稱</label>
            <input required name="name" type="text" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-[16px]" placeholder="商品名稱" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">選擇單位</label>
            <select required name="unit" defaultValue="" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-[16px] cursor-pointer">
              <option value="" disabled>請選擇單位</option>
              {(systemOptions.units || []).map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">預設安全庫存</label>
            <select required name="defaultPar" defaultValue="0" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-[16px] cursor-pointer">
              <option value="0">0</option>
              {Array.from({ length: 100 }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <button type="submit" className="w-full md:w-auto col-span-2 md:col-span-1 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md shadow-blue-600/20 whitespace-nowrap text-[16px] mt-2 md:mt-0">加入商品庫</button>
        </form>
      </div>
      
      <div className="flex items-center bg-white p-3 rounded-2xl shadow-sm border border-slate-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all mt-6">
        <Search className="w-5 h-5 text-slate-400 mx-2 flex-shrink-0" />
        <input 
          type="text" 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          placeholder="輸入商品名稱快速搜尋..." 
          className="flex-1 outline-none text-[16px] font-bold text-slate-700 bg-transparent"
        />
        {searchTerm && (
          <button type="button" onClick={() => setSearchTerm('')} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {Object.entries(groupedProducts).map(([category, items]) => (
          <div key={category} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            
            <div className="bg-slate-50/80 border-b border-slate-100 px-4 py-2.5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-slate-400" />
                <h3 className="font-black text-slate-800 tracking-wide text-[16px]">{formatCategory(category)}</h3>
                <div className="flex items-center ml-1 border-l border-slate-200 pl-1.5 gap-0.5">
                  <button onClick={() => setEditingCategory(category)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="編輯分類名稱"><Edit2 className="w-4 h-4"/></button>
                  <button onClick={() => setDeletingCategory(category)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="刪除此分類"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>
              <span className="text-[11px] font-bold text-slate-400 hidden sm:flex items-center gap-1"><Menu className="w-3 h-3"/> 拖曳排序</span>
            </div>
            
            <div className="flex-1">
              {items.map(p => (
                <div 
                  key={p.id} 
                  data-drag-id={p.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, p.id)}
                  onDragOver={(e) => handleDragOver(e, p.id)}
                  onDragLeave={() => setDragOverId(null)}
                  onDrop={(e) => handleDrop(e, p.id, category)}
                  onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
                  className={`flex items-stretch border-b border-slate-100 bg-white transition-all overflow-hidden last:border-0
                    ${draggedId === p.id ? 'opacity-40 bg-slate-100 scale-[0.98] shadow-inner' : ''} 
                    ${dragOverId === p.id && draggedId !== p.id ? 'border-t-4 border-t-blue-500' : ''}`
                  }
                >
                  <div 
                    className="w-12 flex items-center justify-center text-slate-400 bg-slate-50 border-r border-slate-100 cursor-grab active:cursor-grabbing active:bg-slate-200 transition-colors"
                    style={{ touchAction: 'none' }} 
                    onTouchStart={(e) => handleTouchStart(e, p.id)}
                    onTouchMove={(e) => handleTouchMove(e, category)}
                    onTouchEnd={(e) => handleTouchEnd(e, category)}
                  >
                    <Menu className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1 px-4 py-3 flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <span className="font-bold text-slate-700 text-[16px]">{p.name}</span>
                       <span className="text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md">{p.unit}</span>
                     </div>
                     <div className="flex items-center gap-2">
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
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ⭐ 更新：加入產品與庫存資料，以支援分類隱藏設定
function AdminQuotaManager({ branches, products, inventoryData, getBranchInventory, fbUser, showToast, systemConfig, db, appId }) {
  const [selectedBranch, setSelectedBranch] = useState(branches.length > 0 ? branches[0].username : '');
  const [activeCategory, setActiveCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState(''); 

  useEffect(() => { if(!selectedBranch && branches.length > 0) setSelectedBranch(branches[0].username); }, [branches, selectedBranch]);

  if (branches.length === 0) return (<div className="text-center py-20 bg-white rounded-3xl mx-4"><Store className="w-16 h-16 text-slate-200 mx-auto mb-4" /><h2 className="text-xl font-bold text-slate-700">目前尚無門店註冊</h2></div>);

  const activeInventory = selectedBranch ? getBranchInventory(selectedBranch) : [];
  const categories = [...new Set(activeInventory.map(i => i.category))];
  
  // 取得目前門店選擇隱藏的分類清單
  const hiddenCategories = inventoryData[selectedBranch]?.hiddenCategories || [];
  const allCategories = [...new Set(products.map(p => p.category))];

  useEffect(() => { 
    if (!activeCategory && categories.length > 0) setActiveCategory(categories[0]); 
  }, [categories, activeCategory]);

  const handleParLevelChange = async (productId, type, newParStr) => {
    if(!fbUser || !selectedBranch) return;
    const newPar = parseFloat(newParStr); 
    if (isNaN(newPar)) return;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', DB_INVENTORY, selectedBranch);
    const field = type === 'holiday' ? 'parLevelHoliday' : 'parLevel';
    await setDoc(docRef, { settings: { [productId]: { [field]: newPar } } }, { merge: true }); 
  };

  const changeHolidayMode = async (mode) => {
    if(!fbUser) return;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', DB_SYSTEM, 'config');
    await setDoc(docRef, { holidayMode: mode }, { merge: true });
    const modeNames = { 'auto': '自動偵測 (依前日切換)', 'weekday': '手動設定 (平日)', 'holiday': '手動設定 (假日)' };
    showToast(`全系統已切換為：${modeNames[mode]}`, 'success');
  };

  const toggleGPSLock = async () => {
    if(!fbUser) return;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', DB_SYSTEM, 'config');
    const newState = !systemConfig.isGPSRequired;
    await setDoc(docRef, { isGPSRequired: newState }, { merge: true });
    showToast(`門店 GPS 驗證機制已${newState ? '開啟' : '關閉'}！`, 'success');
  };

  // ⭐ 新增：處理單一門店分類顯示切換
  const toggleCategoryVisibility = async (cat) => {
    if(!fbUser || !selectedBranch) return;
    let newHidden = [...hiddenCategories];
    if (newHidden.includes(cat)) {
      newHidden = newHidden.filter(c => c !== cat); // 移除隱藏 = 顯示
    } else {
      newHidden.push(cat); // 加入隱藏名單
    }
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', DB_INVENTORY, selectedBranch);
    await setDoc(docRef, { hiddenCategories: newHidden }, { merge: true });
    showToast(`已更新「${formatCategory(cat)}」的顯示設定！`, 'success');
  };

  const branchOptions = branches.map(b => ({ value: b.username, label: b.branchName }));
  const effectiveIsHoliday = getEffectiveHolidayMode(systemConfig.holidayMode);

  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-2xl shadow-sm border flex items-center justify-between transition-colors ${systemConfig.isGPSRequired ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
        <div>
          <h3 className={`font-bold text-lg flex items-center gap-2 ${systemConfig.isGPSRequired ? 'text-red-800' : 'text-slate-800'}`}>
            <ShieldCheck className="w-5 h-5" />
            門店 GPS 定位鎖 (防護機制)
          </h3>
          <p className="text-sm text-slate-500 mt-1">開啟後，門店人員必須在店面半徑 300 公尺內才能操作系統。</p>
        </div>
        <button onClick={toggleGPSLock} className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none shadow-inner ${systemConfig.isGPSRequired ? 'bg-red-500' : 'bg-slate-300'}`}>
          <span className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${systemConfig.isGPSRequired ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
      </div>

      <div className={`p-4 rounded-2xl shadow-sm border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors ${effectiveIsHoliday ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
        <div>
          <h3 className={`font-bold text-lg flex items-center gap-2 ${effectiveIsHoliday ? 'text-orange-800' : 'text-blue-800'}`}><Calendar className="w-5 h-5" />全系統安全庫存：{effectiveIsHoliday ? '假日模式' : '平日模式'}</h3>
          <p className={`text-xs mt-1 font-medium ${effectiveIsHoliday ? 'text-orange-600' : 'text-blue-600'}`}>
            目前設定：{systemConfig.holidayMode === 'auto' ? '系統自動偵測 (依據前日是否為週末)' : '總部手動設定'}
          </p>
        </div>
        <div className="flex bg-slate-200/50 p-1 rounded-xl self-start sm:self-auto shadow-inner border border-slate-300/30">
           <button onClick={() => changeHolidayMode('auto')} className={`px-4 py-2 rounded-lg font-bold text-[13px] transition-all ${systemConfig.holidayMode === 'auto' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>自動偵測</button>
           <button onClick={() => changeHolidayMode('weekday')} className={`px-4 py-2 rounded-lg font-bold text-[13px] transition-all ${systemConfig.holidayMode === 'weekday' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>設為平日</button>
           <button onClick={() => changeHolidayMode('holiday')} className={`px-4 py-2 rounded-lg font-bold text-[13px] transition-all ${systemConfig.holidayMode === 'holiday' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>設為假日</button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-bold text-slate-800"><Settings className="w-5 h-5 text-blue-600" />設定門店安全庫存</div>
        
        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-2">
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500 transition-all flex-1 min-w-[200px] shadow-inner">
             <Search className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
             <input type="text" placeholder="搜尋商品..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent outline-none w-full font-bold text-[15px] text-slate-700" />
             {searchTerm && <button onClick={() => setSearchTerm('')} className="ml-1 text-slate-400 hover:text-slate-600 p-1"><X className="w-4 h-4"/></button>}
          </div>
          <CustomDropdown value={selectedBranch} onChange={setSelectedBranch} options={branchOptions} className="w-full sm:w-auto min-w-[160px]" buttonClassName="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-blue-800 h-full" />
        </div>
      </div>

      {/* ⭐ 新增：門店分類顯示切換控制區塊 */}
      {selectedBranch && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-3">
             <h4 className="font-bold text-slate-800 text-[14px] flex items-center gap-2">
               <Eye className="w-4 h-4 text-blue-600"/> 門店盤點分類顯示
             </h4>
             <span className="text-xs text-slate-500 font-medium">點擊按鈕切換該門店可見的分類</span>
          </div>
          <div className="flex flex-wrap gap-2">
             {allCategories.map(cat => {
                const isHidden = hiddenCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategoryVisibility(cat)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all border flex items-center gap-1.5 ${isHidden ? 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100 shadow-inner' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 shadow-sm'}`}
                  >
                    {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {formatCategory(cat).replace(/[【】\[\]《》〈〉()]/g, '')}
                  </button>
                )
             })}
          </div>
        </div>
      )}

      {!searchTerm ? (
        <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide snap-x">
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)} className={`snap-start px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all shadow-sm border text-[15px] ${activeCategory === cat ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              {formatCategory(cat)}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-sm font-bold text-blue-600 px-2 flex items-center gap-2">
          <Search className="w-4 h-4"/> 正在顯示「{searchTerm}」的搜尋結果...
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="divide-y divide-slate-100">
          {activeInventory.filter(i => searchTerm ? i.name.toLowerCase().includes(searchTerm.toLowerCase()) : i.category === activeCategory).map(item => (
            <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-slate-50 transition-colors gap-3">
              <div><span className="text-[11px] font-bold text-slate-400 block sm:inline sm:mr-2">{formatCategory(item.category)}</span><span className="font-bold text-slate-800 text-lg">{item.name}</span></div>
              <div className="flex items-center gap-2 self-end sm:self-auto mt-1 sm:mt-0">
                <div className="flex items-center bg-slate-50 p-1 rounded-xl border border-slate-200"><span className="text-[10px] font-bold text-slate-500 px-1.5 whitespace-nowrap">平日</span><input type="number" min="0" step="0.5" inputMode="decimal" value={item.parLevel} onChange={(e) => handleParLevelChange(item.id, 'regular', e.target.value)} className="w-14 sm:w-16 px-2 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-center font-black text-blue-700 text-[18px] shadow-inner" /></div>
                <div className="flex items-center bg-orange-50 p-1 rounded-xl border border-orange-200"><span className="text-[10px] font-bold text-orange-600 px-1.5 whitespace-nowrap">假日</span><input type="number" min="0" step="0.5" inputMode="decimal" value={item.parLevelHoliday} onChange={(e) => handleParLevelChange(item.id, 'holiday', e.target.value)} className="w-14 sm:w-16 px-2 py-1.5 bg-white border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-center font-black text-orange-700 text-[18px] shadow-inner" /></div>
                <span className="text-slate-500 font-medium px-1 text-sm w-8 text-left shrink-0">{item.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminOrderHistory({ ordersData, branches }) {
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [exportImgUrl, setExportImgUrl] = useState(null); 

  const branchColors = useMemo(() => {
    const palettes = [
      { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', iconBg: 'bg-blue-100', iconText: 'text-blue-600' },
      { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600' },
      { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', iconBg: 'bg-purple-100', iconText: 'text-purple-600' },
      { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-800', iconBg: 'bg-rose-100', iconText: 'text-rose-600' },
      { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', iconBg: 'bg-amber-100', iconText: 'text-amber-600' },
      { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-800', iconBg: 'bg-teal-100', iconText: 'text-teal-600' },
    ];
    const colorMap = {};
    branches.forEach((b, idx) => { colorMap[b.username] = palettes[idx % palettes.length]; });
    return colorMap;
  }, [branches]);
  const defaultColor = { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-800', iconBg: 'bg-slate-100', iconText: 'text-slate-500' };

  const filteredOrders = useMemo(() => {
    return ordersData.filter(o => {
      if (filterBranch !== 'all' && o.branchUsername !== filterBranch) return false;
      if (filterDate) {
        const orderDate = new Date(o.timestamp);
        const selectedDate = new Date(filterDate);
        if (orderDate.getFullYear() !== selectedDate.getFullYear() || orderDate.getMonth() !== selectedDate.getMonth() || orderDate.getDate() !== selectedDate.getDate()) return false;
      }
      return true;
    });
  }, [ordersData, filterBranch, filterDate]);

  const branchOptions = [{ value: 'all', label: '所有門店' }, ...branches.map(b => ({ value: b.username, label: b.branchName }))];

  const handleExportCard = async (elementId) => {
    if (!window.html2canvas) { showToast('截圖元件載入中，請稍候', 'error'); return; }
    const el = document.getElementById(elementId);
    if (!el) return;

    showToast('正在為您產生圖檔...', 'success');
    setTimeout(async () => {
      try {
        const canvas = await window.html2canvas(el, { 
          scale: 1.5, 
          backgroundColor: '#ffffff',
          useCORS: true
        });
        setExportImgUrl(canvas.toDataURL('image/jpeg', 0.9));
      } catch (err) { showToast('圖片產生失敗，請稍後再試', 'error'); }
    }, 300);
  };

  return (
    <div className="space-y-4">
      {exportImgUrl && <ImageExportModal imageUrl={exportImgUrl} onClose={() => setExportImgUrl(null)} />}

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
        <div className="text-center py-20 bg-white rounded-3xl mx-1"><History className="w-16 h-16 text-slate-200 mx-auto mb-4" /><h2 className="text-xl font-bold text-slate-700">查無相關紀錄</h2></div>
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
                  <div key={category} className="mb-4 last:mb-0">
                    <div id={cardId} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col p-1">
                      
                      <div className={`px-4 py-3 flex justify-between items-start sm:items-center gap-3 border-b ${bColor.bg} ${bColor.border} rounded-t-[1.5rem]`}>
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl shadow-sm border ${bColor.iconBg} ${bColor.border}`}><Store className={`w-5 h-5 ${bColor.iconText}`} /></div>
                          <div>
                            <h3 className={`font-bold text-[16px] sm:text-[17px] tracking-wide ${bColor.text}`}>
                               {order.branchName} <span className="ml-1 opacity-70 text-sm">/ {formatCategory(category)}</span>
                               {isCatReceived && <span className="ml-2 text-xs text-green-600 bg-green-100 px-1.5 py-0.5 rounded border border-green-200 inline-flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3"/> 已入</span>}
                            </h3>
                            <p className={`text-[11px] sm:text-[12px] font-medium mt-0.5 opacity-80 ${bColor.text}`}>{order.date.split(' ')[0]} · 單號: {order.id}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={order.status} />
                          <button data-html2canvas-ignore="true" onClick={() => handleExportCard(cardId)} className="p-2 bg-white rounded-full text-slate-400 hover:text-blue-600 transition-colors shadow-sm border border-slate-200 active:scale-95" title="匯出圖檔">
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-white rounded-b-[1.5rem]">
                        <div className="flex flex-col gap-1">
                          {items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center px-2 py-2 hover:bg-slate-50 rounded-xl transition-colors border-b border-slate-100 last:border-0">
                              <span className="font-bold text-slate-700 text-[16px]">{item.name}</span>
                              <div className="font-black text-[20px] text-slate-800">{item.orderQty} <span className="text-[13px] font-medium text-slate-500">{item.unit}</span></div>
                            </div>
                          ))}
                        </div>
                      </div>

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

function AdminAnalytics({ ordersData, branches }) {
  const [filterBranch, setFilterBranch] = useState('all');
  const [timeRange, setTimeRange] = useState('week'); 

  const analyticsData = useMemo(() => {
    const now = Date.now();
    const timeLimit = timeRange === 'week' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    const validOrders = ordersData.filter(o => {
      if (filterBranch !== 'all' && o.branchUsername !== filterBranch) return false;
      if (now - o.timestamp > timeLimit) return false;
      return true;
    });

    const totals = {};
    validOrders.forEach(o => {
      o.items.forEach(item => {
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
  }, [ordersData, filterBranch, timeRange]);

  const branchOptions = [{ value: 'all', label: '所有門店' }, ...branches.map(b => ({ value: b.username, label: b.branchName }))];
  const timeOptions = [{ value: 'week', label: '近一週' }, { value: 'month', label: '近一個月' }];

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-3 items-center justify-between">
        <h3 className="font-bold text-slate-800 flex items-center gap-2 self-start md:self-auto"><BarChart2 className="w-5 h-5 text-blue-600" /> 叫貨統計分析</h3>
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
                <div key={category} className="bg-slate-50 p-4 md:p-5 rounded-2xl border border-slate-100">
                  <h4 className="font-black text-slate-700 mb-4 flex items-center gap-2 border-b border-slate-200 pb-3 text-[16px]"><Layers className="w-5 h-5 text-blue-500" />{formatCategory(category)}</h4>
                  <div className="space-y-4">
                    {items.map((item, idx) => {
                      const percentage = Math.max(2, (item.qty / maxQty) * 100); 
                      return (
                        <div key={idx} className="flex flex-col gap-1.5">
                          <div className="flex justify-between items-end px-1">
                            <span className="font-bold text-slate-700 text-[15px]">{item.name}</span>
                            <span className="font-black text-blue-600 text-lg">{item.qty} <span className="text-xs text-slate-500 font-medium">{item.unit}</span></span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden shadow-inner"><div className="bg-blue-500 h-2.5 rounded-full transition-all duration-1000 ease-out" style={{ width: `${percentage}%` }}></div></div>
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
function BranchViews({ user, fbUser, products, inventoryData, ordersData, branchInventory, showToast, systemConfig, db, appId }) {
  const [activeTab, setActiveTab] = useState('inventory');
  const branchOrders = useMemo(() => ordersData.filter(o => o.branchUsername === user.username), [ordersData, user.username]);

  const tabs = [
    { id: 'inventory', icon: <ClipboardList />, label: '盤點' },
    { id: 'orders', icon: <ShoppingCart />, label: '叫貨' },
    { id: 'receiving', icon: <Truck />, label: '進貨' }
  ];

  const updateStockCloud = async (productId, newStockValue) => {
    if(!fbUser) return;
    const numValue = parseFloat(newStockValue) || 0; 
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', DB_INVENTORY, user.username);
    await setDoc(docRef, { settings: { [productId]: { currentStock: numValue } } }, { merge: true });
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

  // ⭐ 取得目前登入門店被隱藏的分類清單
  const hiddenCategories = inventoryData[user.username]?.hiddenCategories || [];

  return (
    <>
      <div className="p-3 md:p-8 max-w-4xl mx-auto w-full">
         <div className="hidden md:flex space-x-2 mb-8 bg-slate-200/50 p-1.5 rounded-xl w-max">
           {tabs.map(t => (
             <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-5 py-2.5 rounded-lg font-bold transition-all ${activeTab === t.id ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
               <div className="flex items-center gap-2">{React.cloneElement(t.icon, { className: 'w-4 h-4' })} {t.label}</div>
             </button>
           ))}
        </div>
        {/* ⭐ 將 hiddenCategories 傳入，讓門店看不到被隱藏的分類 */}
        {activeTab === 'inventory' && <BranchInventoryCheck inventory={branchInventory} hiddenCategories={hiddenCategories} updateStockCloud={updateStockCloud} addOrderCloud={addOrderCloud} showToast={showToast} systemConfig={systemConfig} />}
        {activeTab === 'orders' && <BranchOrderManagement purchaseOrders={branchOrders} showToast={showToast} />}
        {activeTab === 'receiving' && <BranchReceivingCheck inventory={branchInventory} updateStockCloud={updateStockCloud} purchaseOrders={branchOrders} updateOrderPartialReceiptCloud={updateOrderPartialReceiptCloud} showToast={showToast} />}
      </div>
      <BottomNav tabs={tabs} activeTab={activeTab} setActiveTab={setActiveTab} themeColor="text-orange-600" />
    </>
  );
}

function BranchInventoryCheck({ inventory, hiddenCategories, updateStockCloud, addOrderCloud, showToast, systemConfig }) {
  const [activeCategory, setActiveCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState(''); 

  // ⭐ 過濾掉總部設定隱藏的分類
  const visibleInventory = useMemo(() => {
    return inventory.filter(i => !hiddenCategories.includes(i.category));
  }, [inventory, hiddenCategories]);

  const categories = [...new Set(visibleInventory.map(i => i.category))];

  useEffect(() => { 
    if ((!activeCategory || !categories.includes(activeCategory)) && categories.length > 0) {
      setActiveCategory(categories[0]); 
    }
  }, [categories, activeCategory]);

  const generatePurchaseOrder = () => {
    const itemsToOrder = visibleInventory
      .filter(item => item.category === activeCategory && item.currentStock < item.activeParLevel)
      .map(item => {
        const diff = item.activeParLevel - item.currentStock;
        const cleanDiff = parseFloat(diff.toFixed(1)); 
        return {
          id: item.id, category: item.category, name: item.name, unit: item.unit, 
          currentStock: item.currentStock, parLevel: item.activeParLevel, orderQty: Math.max(0, cleanDiff)
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
      id: orderId, 
      date: new Date(baseTimestamp).toLocaleString(), 
      status: 'pending', 
      receivedCategories: [], 
      items: itemsToOrder 
    };

    addOrderCloud(newOrder);
    showToast(`已成功產生「${formatCategory(activeCategory)}」叫貨單！`);
  };

  const effectiveIsHoliday = getEffectiveHolidayMode(systemConfig.holidayMode);
  let modeText = '';
  if (systemConfig.holidayMode === 'auto') {
    modeText = effectiveIsHoliday ? '自動偵測 (前日為週末假日)' : '自動偵測 (前日為平日)';
  } else {
    modeText = effectiveIsHoliday ? '總部設定 (假日)' : '總部設定 (平日)';
  }

  return (
    <div className="space-y-4">
      <div className={`px-4 py-3.5 rounded-2xl flex items-center justify-between border shadow-sm ${effectiveIsHoliday ? 'bg-orange-100 border-orange-300' : 'bg-blue-100 border-blue-300'}`}>
         <div className={`flex flex-col font-bold ${effectiveIsHoliday ? 'text-orange-800' : 'text-blue-800'}`}>
           <div className="flex items-center gap-2 text-[15px]"><Calendar className="w-5 h-5 flex-shrink-0" />目前適用：{effectiveIsHoliday ? '假日安全庫存' : '平日安全庫存'}</div>
           <div className={`text-[12px] mt-0.5 ml-7 ${effectiveIsHoliday ? 'text-orange-600' : 'text-blue-600'}`}>{modeText}</div>
         </div>
      </div>
      <div className="flex justify-between items-center sticky top-[60px] md:top-0 z-10 bg-slate-50/95 backdrop-blur-sm pt-2 pb-4 border-b border-slate-100/50">
        <h2 className="text-2xl font-black text-slate-800">盤點點貨</h2>
        <button onClick={generatePurchaseOrder} className="bg-orange-600 hover:bg-orange-700 active:scale-95 text-white px-5 py-3 rounded-2xl font-bold shadow-lg shadow-orange-600/30 flex items-center gap-2 transition-all">
          <ShoppingCart className="w-5 h-5" /><span className="hidden sm:inline">產生叫貨單</span><span className="sm:hidden">叫貨</span>
        </button>
      </div>
      <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide -mx-3 px-3 snap-x">
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)} className={`snap-start px-5 py-3 rounded-xl font-bold whitespace-nowrap transition-all shadow-sm border text-[15px] ${activeCategory === cat ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            {formatCategory(cat)}
          </button>
        ))}
      </div>
      
      <div className="flex items-center bg-white p-3 rounded-2xl shadow-sm border border-slate-200 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100 transition-all mt-2 mb-4 mx-1">
        <Search className="w-5 h-5 text-slate-400 mx-2 flex-shrink-0" />
        <input 
          type="text" 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          placeholder="輸入商品名稱快速搜尋..." 
          className="flex-1 outline-none text-[16px] font-bold text-slate-700 bg-transparent"
        />
        {searchTerm && (
          <button type="button" onClick={() => setSearchTerm('')} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {searchTerm && (
        <div className="text-sm font-bold text-orange-600 px-2 mb-3 flex items-center gap-2">
          <Search className="w-4 h-4"/> 顯示「{searchTerm}」的結果 (點擊商品自動切換叫貨分類)
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-4">
        {visibleInventory.filter(i => searchTerm ? i.name.toLowerCase().includes(searchTerm.toLowerCase()) : i.category === activeCategory).map(item => {
          const isDeficient = item.currentStock < item.activeParLevel;
          return (
            <div 
              key={item.id} 
              onClick={() => setActiveCategory(item.category)}
              className={`p-4 rounded-[1.25rem] border-2 transition-colors flex flex-col justify-between cursor-pointer ${isDeficient ? 'border-orange-200 bg-orange-50/50' : 'border-slate-100 bg-white shadow-sm'} ${searchTerm && activeCategory === item.category ? 'ring-2 ring-orange-400 border-orange-400' : ''}`}
            >
              
              <div className="flex justify-between items-start">
                <div>
                  {searchTerm && <span className="text-[11px] font-bold text-slate-400 block mb-0.5">{formatCategory(item.category)}</span>}
                  <h3 className="text-[18px] font-black text-slate-800">{item.name}</h3>
                  <div className="text-[12px] mt-1 flex gap-1.5 font-medium text-slate-500">
                    安全庫存: <span className="text-blue-600 font-bold">{item.activeParLevel}</span> {item.unit}
                  </div>
                </div>
                {isDeficient && (<span className="text-[11px] font-bold text-red-600 bg-red-100 px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm"><AlertCircle className="w-3.5 h-3.5" /> 需補</span>)}
              </div>
              
              <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
                <span className="text-[13px] font-bold text-slate-400">實有庫存</span>
                <div className="flex items-center gap-2.5">
                  <div className="relative w-24 h-[42px] flex items-center justify-center bg-slate-50 border border-slate-200 rounded-xl shadow-inner active:bg-slate-100 transition-colors">
                    <select
                      value={item.currentStock === 0 && !isDeficient ? '' : item.currentStock}
                      onChange={(e) => {
                        updateStockCloud(item.id, e.target.value);
                        setActiveCategory(item.category); 
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    >
                      {Array.from({ length: 2000 }, (_, i) => {
                         const val = i / 2;
                         return <option key={i} value={val}>{val}</option>;
                      })}
                    </select>
                    <span className="text-[20px] font-black text-orange-600 pointer-events-none">
                      {item.currentStock === 0 && !isDeficient ? '0' : item.currentStock}
                    </span>
                    <ChevronDown className="absolute right-2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                  <span className="text-slate-500 font-bold w-6 text-right text-[15px]">{item.unit}</span>
                </div>
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

  const handleExportCard = async (elementId) => {
    if (!window.html2canvas) { showToast('截圖元件載入中，請稍候', 'error'); return; }
    const el = document.getElementById(elementId);
    if (!el) return;

    showToast('正在為您產生圖檔...', 'success');
    setTimeout(async () => {
      try {
        const canvas = await window.html2canvas(el, { 
          scale: 1.5, 
          backgroundColor: '#ffffff',
          useCORS: true
        });
        setExportImgUrl(canvas.toDataURL('image/jpeg', 0.9));
      } catch (err) { showToast('圖片產生失敗，請稍後再試', 'error'); }
    }, 300);
  };

  if (purchaseOrders.length === 0) {
    return (<div className="text-center py-20 bg-white rounded-3xl mt-4 mx-1"><Package className="w-16 h-16 text-slate-200 mx-auto mb-4" /><h2 className="text-xl font-bold text-slate-700">目前沒有叫貨單</h2><p className="text-sm text-slate-500 mt-2">盤點低於安全庫存即可自動產生</p></div>);
  }

  return (
    <div className="space-y-4 pt-2">
      {exportImgUrl && <ImageExportModal imageUrl={exportImgUrl} onClose={() => setExportImgUrl(null)} />}
      
      <h2 className="text-2xl font-black text-slate-800 mb-4 px-1">叫貨單總覽</h2>
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
                <div key={category} className="mb-4">
                  <div id={cardId} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col p-1">
                    
                    <div className="px-4 py-3 flex justify-between items-start sm:items-center bg-orange-50 border-b border-orange-100 rounded-t-[1.5rem] gap-2">
                      <div>
                        <h3 className="font-black text-[16px] sm:text-[17px] text-slate-800">
                           {order.branchName} 叫貨單: <span className="text-orange-600">{formatCategory(category)}</span>
                           {isCatReceived && <span className="ml-2 text-xs text-green-600 bg-green-100 px-1.5 py-0.5 rounded border border-green-200 inline-flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3"/> 已入</span>}
                        </h3>
                        <p className="text-[11px] sm:text-[12px] font-medium text-slate-500 mt-0.5">{order.date.split(' ')[0]} · 單號: {order.id}</p>
                      </div>
                      <div className="flex items-center gap-2">
                         <StatusBadge status={order.status} />
                         <button 
                           data-html2canvas-ignore="true" 
                           onClick={() => handleExportCard(cardId)} 
                           className="p-2 bg-white rounded-full text-slate-400 hover:text-orange-600 transition-colors shadow-sm border border-slate-200 active:scale-95" 
                           title="匯出圖檔"
                         >
                           <Download className="w-4 h-4" />
                         </button>
                      </div>
                    </div>

                    <div className="p-4 bg-white rounded-b-[1.5rem]">
                       <div className="flex flex-col gap-1">
                          {items.map((item, idx) => {
                            return (
                              <div key={idx} className="flex justify-between items-center px-2 py-2 hover:bg-slate-50 rounded-xl transition-colors border-b border-slate-100 last:border-0">
                                <span className="font-bold text-slate-700 text-[16px]">{item.name}</span>
                                <div className="text-right flex items-center gap-2">
                                   <span className="text-[11px] text-slate-400">叫貨</span>
                                   <span className="font-black text-orange-600 text-[20px] leading-none min-w-[2.5rem] text-right">
                                     {item.orderQty} <span className="text-[13px] font-medium text-slate-500">{item.unit}</span>
                                   </span>
                                </div>
                              </div>
                            );
                          })}
                       </div>
                    </div>

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

function BranchReceivingCheck({ inventory, updateStockCloud, purchaseOrders, updateOrderPartialReceiptCloud, showToast }) {
  const pendingOrders = purchaseOrders.filter(o => o.status !== 'received');

  const handleReceiveCategory = async (order, category, itemsInCategory) => {
    for (const orderItem of itemsInCategory) {
      const invItem = inventory.find(i => i.id === orderItem.id);
      if (invItem) {
        const newTotal = parseFloat(invItem.currentStock) + parseFloat(orderItem.orderQty);
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

  if (pendingOrders.length === 0) return (<div className="text-center py-20 bg-white rounded-3xl mt-4 mx-1"><CheckCircle2 className="w-16 h-16 text-green-300 mx-auto mb-4" /><h2 className="text-xl font-bold text-slate-700">沒有待核對進貨單</h2></div>);

  return (
    <div className="space-y-4 pt-2">
      <h2 className="text-2xl font-black text-slate-800 mb-2 px-1">進貨點收</h2>
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
              <div className="bg-slate-800 text-white p-2.5 rounded-2xl shadow-lg shadow-slate-800/20">
                <Truck className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <div className="text-[12px] font-bold text-slate-400 mb-0.5">進貨點收單</div>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-[22px] font-black text-slate-800 leading-none">{order.id}</h3>
                  <span className="text-[13px] font-bold text-slate-500">{order.date.split(' ')[0]}</span>
                </div>
              </div>
            </div>

            <div className="bg-orange-50/50 border-2 border-orange-100/80 p-3 rounded-[2rem] shadow-sm">
              {pendingCategories.map(([category, items]) => {
                 return (
                   <div key={category} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-3 last:mb-0">
                     <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                       <Layers className="w-4 h-4 text-orange-500" />
                       <h3 className="font-black text-[16px] text-slate-800">{formatCategory(category)}</h3>
                     </div>
                     
                     <div className="p-3.5 bg-white">
                       <div className="flex flex-col gap-1">
                         {items.map((item, idx) => {
                           return (
                             <div key={idx} className="flex justify-between items-center px-1.5 py-2 hover:bg-slate-50 rounded-xl transition-colors border-b border-slate-50 last:border-0">
                               <span className="font-bold text-slate-700 text-[16px]">{item.name}</span>
                               <div className="font-black text-[20px] text-slate-800">
                                 {item.orderQty} <span className="text-[13px] font-medium text-slate-500">{item.unit}</span>
                               </div>
                             </div>
                           );
                         })}
                       </div>
                     </div>

                     <div className="p-3 bg-slate-50 border-t border-slate-100">
                       <button 
                         onClick={() => handleReceiveCategory(order, category, items)}
                         className="w-full bg-orange-600 hover:bg-orange-700 active:scale-95 text-white font-bold py-3 rounded-2xl flex justify-center items-center gap-2 transition-all shadow-sm text-[15px]"
                       >
                         <CheckCircle2 className="w-5 h-5" /> 點收 {formatCategory(category)}
                       </button>
                     </div>
                   </div>
                 );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
