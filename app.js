// ПРОВЕРКА ЗАПУСКА
alert("Мурз.банк: Скрипт запущен!");

window.onerror = function(msg, url, line) {
    alert("КРИТИЧЕСКАЯ ОШИБКА: " + msg + "\nСтрока: " + line);
};

import { initializeApp } from "https://www.gstatic.com";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, query, where, getDocs, deleteDoc, onSnapshot } from "https://www.gstatic.com";

const firebaseConfig = {
    apiKey: "AIzaSyBKmVYQkiMWvTt2NZVwWiGmDVHeV6QGXrw",
    authDomain: "merzbankes.firebaseapp.com",
    projectId: "merzbankes",
    storageBucket: "merzbankes.firebasestorage.app",
    messagingSenderId: "187194168466",
    appId: "1:187194168466:web:fec1340c2f3800cc1b824b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
let currentUser = null;

// Показ окон на экране
function myAlert(text) {
    const modal = document.getElementById('modal-container');
    const msg = document.getElementById('modal-msg');
    if (modal && msg) {
        msg.innerText = text;
        modal.classList.remove('hidden');
    } else { alert(text); }
}

// ЛОГИКА ВХОДА
async function handleAuth() {
    const nick = document.getElementById('login-nick').value.toLowerCase().trim();
    const pass = document.getElementById('login-pass').value;

    if (!nick || !pass) return myAlert("Введи ник и пароль!");

    try {
        const userRef = doc(db, "users", nick);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
            const data = snap.data();
            if (data.isBanned) return myAlert("АККАУНТ ЗАБЛОКИРОВАН");
            if (data.password !== pass) return myAlert("Неверный пароль!");
            login(data);
        } else {
            const newUser = {
                nick: nick, password: pass, balance: 0, role: 'standard',
                isBanned: false, customLimit: 1000, theme: 'yellow'
            };
            await setDoc(userRef, newUser);
            login(newUser);
        }
    } catch (e) {
        myAlert("Ошибка Firebase: " + e.message);
    }
}

function login(userData) {
    currentUser = userData;
    localStorage.setItem('murz_login', JSON.stringify({n: userData.nick, p: userData.password}));
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-interface').classList.remove('hidden');
    
    // Подгрузка авы из памяти телефона
    const savedAva = localStorage.getItem('murz_ava_' + userData.nick);
    if (savedAva) document.getElementById('my-ava').src = savedAva;

    initRealtime();
    if(userData.role === 'admin') document.getElementById('nav-admin').classList.remove('hidden');
}

// ПОДПИСКА НА ОБНОВЛЕНИЯ (Чтобы баланс менялся сам)
function initRealtime() {
    onSnapshot(doc(db, "users", currentUser.nick), (docSnap) => {
        if (docSnap.exists()) {
            currentUser = docSnap.data();
            renderUI();
        }
    });
}

function renderUI() {
    const balEl = document.getElementById('balance-num');
    balEl.innerText = currentUser.balance;
    balEl.classList.toggle('minus', currentUser.balance < 0);
    
    document.getElementById('my-nick-display').innerText = currentUser.nick;
    document.getElementById('my-role-display').innerText = `Ранг: ${currentUser.role}`;
    document.getElementById('ava-frame').className = 'avatar-box role-' + currentUser.role;
    document.body.className = 'theme-' + currentUser.theme;
}

// Ивенты кнопок
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-login');
    if(btn) btn.onclick = handleAuth;
});

window.closeModal = () => document.getElementById('modal-container').classList.add('hidden');

