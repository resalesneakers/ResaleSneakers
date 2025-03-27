// firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';


// Configuração do Firebase (substitua com suas credenciais)
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
const db = getFirestore(app);

async function listarUsuarios() {
  const querySnapshot = await getDocs(collection(db, "users"));
  querySnapshot.forEach((doc) => {
    console.log(doc.id, " => ", doc.data());
  });
}
async function listarProdutos() {
  const querySnapshot = await getDocs(collection(db, "products"));
  querySnapshot.forEach((doc) => {
    console.log(doc.id, " => ", doc.data());
  });
}
listarProdutos();


// Função de registro
export const registerUser = async (email, password, additionalInfo) => {
  try {
    // Criar usuário
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Salvar informações adicionais no Firestore
    await setDoc(doc(db, 'users', user.uid), {
      email: user.email,
      ...additionalInfo,
      createdAt: new Date()
    });

    return user;
  } catch (error) {
    console.error("Erro no registro:", error);
    throw error;
  }
};

// Função de login
export const loginUser = (email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};

// Função de logout
export const logoutUser = () => {
  return signOut(auth);
};

// Observador de estado de autenticação
export const onAuthChanged = (callback) => {
  return onAuthStateChanged(auth, callback);
};

// Verificar usuário atual
export const getCurrentUser = () => {
  return auth.currentUser;
};