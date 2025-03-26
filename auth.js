import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCsRg3FzdM1ZB17iuaSuuvbl9fsaiMzJhY",
    authDomain: "edvanio-resalesneakers.firebaseapp.com",
    projectId: "edvanio-resalesneakers",
    storageBucket: "edvanio-resalesneakers.firebasestorage.app",
    messagingSenderId: "230344571013",
    appId: "1:230344571013:web:178c51421c292cdd2d11ec",
    measurementId: "G-G56LDE0TCV"
  };


  
// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Função de Login
const login = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("Login bem-sucedido", userCredential.user);
  } catch (error) {
    console.error("Erro ao fazer login", error.message);
  }
};

// Função de Cadastro
const register = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log("Conta criada com sucesso", userCredential.user);
  } catch (error) {
    console.error("Erro ao criar conta", error.message);
  }
};

// Adicionando eventos aos botões
if (document.getElementById("loginBtn")) {
  document.getElementById("loginBtn").addEventListener("click", () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    login(email, password);
  });
}

if (document.getElementById("registerBtn")) {
  document.getElementById("registerBtn").addEventListener("click", () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    register(email, password);
  });
  firebase.auth().onAuthStateChanged(user => {
    if (user) {
        // Usuário está autenticado, redireciona para a página inicial
        window.location.href = "resaleSneakers.html";
    }
});
}
