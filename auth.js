import { auth } from "./firebase-config.js";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Função de login com email e senha
function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
}

// Função de login com Google
function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
}

// Evento de login no formulário
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');
    const googleBtn = document.getElementById('google-login');

    // Login com Email/Senha
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        login(email, password)
            .then(() => {
                window.location.href = "resaleSneakers.html"; // Redireciona
            })
            .catch(error => {
                errorMessage.textContent = error.message;
                errorMessage.style.display = 'block';
            });
    });

    // Login com Google
    googleBtn.addEventListener('click', function() {
        loginWithGoogle()
            .then(() => {
                window.location.href = "resaleSneakers.html"; // Redireciona
            })
            .catch(error => {
                errorMessage.textContent = error.message;
                errorMessage.style.display = 'block';
            });
    });
});

