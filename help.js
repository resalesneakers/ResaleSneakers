// Importando módulos do Firebase
import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js';


// Aguardar carregamento do DOM
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar componentes da página de ajuda
    initFAQAccordion();
    initHelpNavigation();
    initContactForm();
    initSearchHelp();
    
    // Verificar estado de autenticação do utilizador
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Se o utilizador estiver autenticado, preencher o email no formulário de contacto
            const emailInput = document.getElementById('email');
            if (emailInput) {
                emailInput.value = user.email;
            }
        }
    });
});

// Inicializar acordeão para perguntas frequentes
function initFAQAccordion() {
    const faqItems = document.querySelectorAll('.faq-item h3');
    
    faqItems.forEach(item => {
        item.addEventListener('click', () => {
            // Toggle da classe active no item clicado
            item.parentElement.classList.toggle('active');
            
            // Fechar outros itens (opcional)
            faqItems.forEach(otherItem => {
                if (otherItem !== item && otherItem.parentElement.classList.contains('active')) {
                    otherItem.parentElement.classList.remove('active');
                }
            });
        });
    });
}

// Inicializar navegação na barra lateral
function initHelpNavigation() {
    const navLinks = document.querySelectorAll('.help-nav a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remover classe active de todos os links
            navLinks.forEach(otherLink => {
                otherLink.classList.remove('active');
            });
            
            // Adicionar classe active ao link clicado
            link.classList.add('active');
            
            // Obter o ID da seção a ser exibida
            const targetId = link.getAttribute('href').substring(1);
            
            // Rolar até a seção correspondente
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                window.scrollTo({
                    top: targetSection.offsetTop - 100,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Inicializar formulário de contacto
function initContactForm() {
    const contactForm = document.getElementById('contactForm');
    
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                // Obter valores do formulário
                const name = document.getElementById('name').value;
                const email = document.getElementById('email').value;
                const subject = document.getElementById('subject').value;
                const message = document.getElementById('message').value;
                
                // Validar formulário
                if (!name || !email || !subject || !message) {
                    showNotification('Por favor, preencha todos os campos', 'error');
                    return;
                }
                
                // Criar botão de loading
                const submitButton = contactForm.querySelector('button[type="submit"]');
                const originalText = submitButton.textContent;
                submitButton.disabled = true;
                submitButton.textContent = 'A enviar...';
                
                // Enviar para o Firestore
                await addDoc(collection(db, 'contactMessages'), {
                    name,
                    email,
                    subject,
                    message,
                    timestamp: serverTimestamp(),
                    status: 'unread'
                });
                
                // Limpar formulário
                contactForm.reset();
                
                // Mostrar mensagem de sucesso
                showNotification('Mensagem enviada com sucesso! Entraremos em contacto brevemente.', 'success');
                
                // Restaurar botão
                submitButton.disabled = false;
                submitButton.textContent = originalText;
                
            } catch (error) {
                console.error('Erro ao enviar mensagem:', error);
                showNotification('Ocorreu um erro ao enviar a mensagem. Por favor, tente novamente.', 'error');
                
                // Restaurar botão em caso de erro
                const submitButton = contactForm.querySelector('button[type="submit"]');
                submitButton.disabled = false;
                submitButton.textContent = 'Enviar Mensagem';
            }
        });
    }
}

// Função para exibir notificação ao utilizador
function showNotification(message, type = 'info') {
    // Verificar se já existe uma notificação
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Criar elemento de notificação
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Adicionar ao corpo do documento
    document.body.appendChild(notification);
    
    // Remover após 5 segundos
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            notification.remove();
        }, 500);
    }, 5000);
}

// Função para pesquisa na ajuda
function initSearchHelp() {
    const searchInput = document.querySelector('.search-help input');
    const searchButton = document.querySelector('.search-btn');
    
    if (searchInput && searchButton) {
        // Função para realizar pesquisa
        const performSearch = () => {
            const searchTerm = searchInput.value.toLowerCase().trim();
            
            if (searchTerm.length < 3) {
                showNotification('Digite pelo menos 3 caracteres para pesquisar', 'info');
                return;
            }
            
            // Obter todos os itens de FAQ
            const faqItems = document.querySelectorAll('.faq-item');
            let resultsFound = 0;
            
            // Remover destaque de pesquisas anteriores
            document.querySelectorAll('.search-highlight').forEach(el => {
                const text = el.textContent;
                el.replaceWith(text);
            });
            
            // Remover classes de resultados anteriores
            faqItems.forEach(item => {
                item.classList.remove('search-result', 'search-hidden');
            });
            
            // Se o termo de pesquisa estiver vazio, retornar ao estado normal
            if (!searchTerm) {
                return;
            }
            
            // Pesquisar em cada item de FAQ
            faqItems.forEach(item => {
                const question = item.querySelector('h3').textContent.toLowerCase();
                const answer = item.querySelector('.faq-answer').textContent.toLowerCase();
                
                if (question.includes(searchTerm) || answer.includes(searchTerm)) {
                    // Marcar como resultado da pesquisa
                    item.classList.add('search-result');
                    resultsFound++;
                    
                    // Expandir o item
                    item.classList.add('active');
                    
                    // Destacar termo de pesquisa
                    highlightSearchTerm(item, searchTerm);
                } else {
                    // Ocultar itens que não correspondem à pesquisa
                    item.classList.add('search-hidden');
                }
            });
            
            // Exibir mensagem com número de resultados
            if (resultsFound > 0) {
                showNotification(`Encontrados ${resultsFound} resultados para "${searchTerm}"`, 'success');
                
                // Rolar até o primeiro resultado
                const firstResult = document.querySelector('.search-result');
                if (firstResult) {
                    window.scrollTo({
                        top: firstResult.offsetTop - 120,
                        behavior: 'smooth'
                    });
                }
            } else {
                showNotification(`Nenhum resultado encontrado para "${searchTerm}"`, 'info');
            }
        };
        
        // Adicionar evento de clique ao botão de pesquisa
        searchButton.addEventListener('click', performSearch);
        
        // Adicionar evento de pressionar Enter no campo de pesquisa
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }
}

// Função para destacar termo de pesquisa no texto
function highlightSearchTerm(element, term) {
    const questionEl = element.querySelector('h3');
    const answerEl = element.querySelector('.faq-answer');
    
    // Função para destacar termo em um nó de texto
    const highlightInNode = (node) => {
        if (node.nodeType === 3) { // Nó de texto
            const text = node.textContent;
            const lowerText = text.toLowerCase();
            const index = lowerText.indexOf(term);
            
            if (index >= 0) {
                // Dividir o nó de texto em 3 partes: antes, termo e depois
                const before = text.substring(0, index);
                const match = text.substring(index, index + term.length);
                const after = text.substring(index + term.length);
                
                // Criar elementos para cada parte
                const beforeNode = document.createTextNode(before);
                const matchNode = document.createElement('span');
                matchNode.className = 'search-highlight';
                matchNode.textContent = match;
                const afterNode = document.createTextNode(after);
                
                // Substituir o nó original com os novos nós
                const parent = node.parentNode;
                parent.insertBefore(beforeNode, node);
                parent.insertBefore(matchNode, node);
                parent.insertBefore(afterNode, node);
                parent.removeChild(node);
                
                return true;
            }
        } else if (node.nodeType === 1) { // Elemento
            // Não percorrer elementos script ou estilos
            if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') {
                return false;
            }
            
            // Percorrer filhos recursivamente
            const childNodes = [...node.childNodes];
            childNodes.forEach(child => highlightInNode(child));
        }
        
        return false;
    };
    
    // Aplicar destacamento nos elementos
    highlightInNode(questionEl);
    highlightInNode(answerEl);
}