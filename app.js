import { initializeApp } from "https://www.gstatic.com";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, query, where, getDocs, deleteDoc, onSnapshot } from "https://www.gstatic.com";

// === КОНФИГУРАЦИЯ FIREBASE (ВСТАВЬ СВОЁ) ===
const firebaseConfig = {
    apiKey: "AIzaSyBKmVYQkiMWVtT2NZVwWiGmDVHeV6QGxRw",
    authDomain: "merzbankes.firebaseapp.com",
    projectId: "merzbankes",
    storageBucket: "merzbankes.firebasestorage.app",
    messagingSenderId: "187194168466",
    appId: "1:187194168466:web:fec1340c2f3800cc1b824b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let currentUser = null;

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
function myAlert(text) {
    document.getElementById('modal-msg').innerText = text;
    document.getElementById('modal-container').classList.remove('hidden');
}
window.closeModal = () => document.getElementById('modal-container').classList.add('hidden');

// === ВХОД И РЕГИСТРАЦИЯ ===
document.getElementById('btn-login').onclick = async () => {
    const nick = document.getElementById('login-nick').value.toLowerCase().trim();
    const pass = document.getElementById('login-pass').value;

    if (!nick || !pass) return myAlert("Заполни поля!");

    const userRef = doc(db, "users", nick);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
        const data = snap.data();
        if (data.isBanned) return myAlert("АККАУНТ ЗАБЛОКИРОВАН");
        if (data.password !== pass) return myAlert("Неверный пароль");
        login(data);
    } else {
        const newUser = {
            nick, password: pass, balance: 0, role: 'standard', 
            isBanned: false, customLimit: 1000, theme: 'yellow'
        };
        await setDoc(userRef, newUser);
        login(newUser);
    }
};

function login(userData) {
    currentUser = userData;
    localStorage.setItem('murz_login', JSON.stringify({n: userData.nick, p: userData.password}));
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-interface').classList.remove('hidden');
    
    // Загрузка локальной авы
    const savedAva = localStorage.getItem('murz_ava_' + userData.nick);
    if (savedAva) document.getElementById('my-ava').src = savedAva;

    initRealtime();
    if(userData.role === 'admin') document.getElementById('nav-admin').classList.remove('hidden');
}

// Авто-вход
window.onload = async () => {
    const saved = localStorage.getItem('murz_login');
    if (saved) {
        const {n, p} = JSON.parse(saved);
        const snap = await getDoc(doc(db, "users", n));
        if (snap.exists() && snap.data().password === p && !snap.data().isBanned) {
            login(snap.data());
        }
    }
};

// === ОБНОВЛЕНИЕ ДАННЫХ (Realtime) ===
function initRealtime() {
    onSnapshot(doc(db, "users", currentUser.nick), (doc) => {
        const data = doc.data();
        if (data.isBanned) location.reload(); // Сразу выкинуть если забанен
        
        currentUser = data;
        renderUI();
    });
}

function renderUI() {
    const balEl = document.getElementById('balance-num');
    balEl.innerText = currentUser.balance;
    balEl.classList.toggle('minus', currentUser.balance < 0);
    
    document.getElementById('my-nick-display').innerText = currentUser.nick;
    document.getElementById('my-role-display').innerText = `Ранг: ${currentUser.role}`;
    
    // Рамки аватарок
    const frame = document.getElementById('ava-frame');
    frame.className = 'avatar-box role-' + currentUser.role;
    document.getElementById('gun-icon').classList.toggle('hidden', currentUser.role !== 'cyborg');
    
    // Тема
    applyTheme(currentUser.theme);
}

function applyTheme(theme) {
    document.body.className = 'theme-' + theme;
    if (currentUser.role === 'cyborg' && theme === 'grey') document.body.classList.add('cyborg-mode');
}

// === ПЕРЕВОДЫ ===
document.getElementById('btn-send').onclick = async () => {
    const target = document.getElementById('target-nick').value.toLowerCase().trim();
    const amount = Number(document.getElementById('transfer-amount').value);
    
    if (target === currentUser.nick) return myAlert("Себе нельзя");
    
    const limits = { standard: 1000, good: 1250, pro: 1500, cyborg: 3500, murz: 10000, admin: 9999999 };
    const myLimit = currentUser.customLimit || limits[currentUser.role];

    if (amount < 1 || amount > myLimit) return myAlert("Лимит: от 1 до " + myLimit);
    if (currentUser.balance < amount && currentUser.role !== 'admin') return myAlert("Мало мурзов");

    const targetRef = doc(db, "users", target);
    const targetSnap = await getDoc(targetRef);

    if (!targetSnap.exists()) return myAlert("Юзер не найден");

    // Обновляем балансы
    await updateDoc(doc(db, "users", currentUser.nick), { balance: currentUser.balance - amount });
    await updateDoc(targetRef, { balance: targetSnap.data().balance + amount });

    // Пишем историю
    await addDoc(collection(db, "history"), {
        from: currentUser.nick, to: target, sum: amount, time: Date.now()
    });

    myAlert("Успешно отправлено!");
};

// === НАСТРОЙКИ (Аватарка) ===
document.getElementById('ava-upload').onchange = (e) => {
    const reader = new FileReader();
    reader.onload = () => {
        localStorage.setItem('murz_ava_' + currentUser.nick, reader.result);
        document.getElementById('my-ava').src = reader.result;
    };
    reader.readAsDataURL(e.target.files[0]);
};

// === ВКЛАДКИ ===
window.showTab = async (name) => {
    document.querySelectorAll('.tab-page').forEach(p => p.classList.add('hidden'));
    document.getElementById('tab-' + name).classList.remove('hidden');
    
    if (name === 'history') loadHistory();
    if (name === 'admin') loadAdminPanel();
};

async function loadHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = 'Загрузка...';
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
    
    const q = query(collection(db, "history"), where("time", ">", threeDaysAgo));
    const snap = await getDocs(q);
    
    list.innerHTML = "";
    snap.forEach(doc => {
        const d = doc.data();
        if (d.from === currentUser.nick || d.to === currentUser.nick) {
            const div = document.createElement('div');
            div.className = 'hist-item';
            const type = d.from === currentUser.nick ? 'ОТПРАВЛЕНО' : 'ПОЛУЧЕНО';
            div.innerHTML = `<span>${type} ${d.sum}</span> <span>${d.from === currentUser.nick ? d.to : d.from}</span>`;
            list.appendChild(div);
        }
    });
}

// === АДМИН ПАНЕЛЬ ===
async function loadAdminPanel() {
    const list = document.getElementById('admin-user-list');
    list.innerHTML = "Загрузка...";
    const snap = await getDocs(collection(db, "users"));
    
    list.innerHTML = "";
    snap.forEach(uDoc => {
        const u = uDoc.data();
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <b>${u.nick}</b> (Бал: ${u.balance})<br>
            <button onclick="adminChangeBalance('${u.nick}')">Баланс</button>
            <button onclick="adminSetRole('${u.nick}')">Роль</button>
            <button onclick="adminBan('${u.nick}', ${u.isBanned})">${u.isBanned ? 'Разбан' : 'Бан'}</button>
            <button style="background:red" onclick="adminDelete('${u.nick}')">Удалить</button>
        `;
        list.appendChild(div);
    });
}

// Глобальные функции для кнопок админа
window.adminChangeBalance = async (n) => {
    const val = prompt("Новый баланс:");
    if (val !== null) await updateDoc(doc(db, "users", n), { balance: Number(val) });
    loadAdminPanel();
};

window.adminSetRole = async (n) => {
    const r = prompt("Роль (standard, good, pro, cyborg, murz, admin):");
    if (r) await updateDoc(doc(db, "users", n), { role: r });
    loadAdminPanel();
};

window.adminBan = async (n, stat) => {
    await updateDoc(doc(db, "users", n), { isBanned: !stat });
    loadAdminPanel();
};

window.adminDelete = async (n) => {
    if(confirm("Удалить навсегда?")) await deleteDoc(doc(db, "users", n));
    loadAdminPanel();
};

document.getElementById('btn-logout').onclick = () => {
    localStorage.removeItem('murz_login');
    location.reload();
};
