import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js";
import { setDoc, doc } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    const registerForm = document.getElementById("register-form");
    const errorMessage = document.getElementById("error-message");

    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const nome = document.getElementById("nome").value;
        const apelido = document.getElementById("apelido").value;
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirm-password").value;
        const cidade = document.getElementById("cidade").value;

        // Verifica se as senhas coincidem
        if (password !== confirmPassword) {
            errorMessage.textContent = "As senhas não coincidem.";
            errorMessage.style.display = "block";
            return;
        }

        try {
            // Criar usuário no Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Salvar informações adicionais no Firestore
            await setDoc(doc(db, "usuarios", user.uid), {
                nome: nome,
                apelido: apelido,
                email: email,
                cidade: cidade,
                dataCriacao: new Date()
            });

            // Redirecionar após o registro
            window.location.href = "resaleSneakers.html";
        } catch (error) {
            errorMessage.textContent = error.message;
            errorMessage.style.display = "block";
        }
    });
});
