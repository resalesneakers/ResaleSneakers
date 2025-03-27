// Importando Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBa5JgoDsj-sqSbe2hzuJQwA-SFfAyxvBY",
    authDomain: "resalesneakers-e17cb.firebaseapp.com",
    projectId: "resalesneakers-e17cb",
    storageBucket: "resalesneakers-e17cb.firebasestorage.app",
    messagingSenderId: "698715655625",
    appId: "1:698715655625:web:fde7f7a7f2da0037792c18",
    measurementId: "G-WVNMT06HJS"
  };

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Exportar para usar em outros arquivos
export { auth };
