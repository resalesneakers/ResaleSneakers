// profile.js - Gestão do perfil do utilizador
import { auth, db, storage } from './firebase.js';

document.addEventListener('DOMContentLoaded', function() {
    // Verificar se o utilizador está autenticado
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // Obter referência para elementos do perfil
            const profileForm = document.getElementById('profile-form');
            const profileName = document.getElementById('profile-name');
            const profileEmail = document.getElementById('profile-email');
            const profilePhone = document.getElementById('profile-phone');
            const profileLocation = document.getElementById('profile-location');
            const profileBio = document.getElementById('profile-bio');
            const profileImage = document.getElementById('profile-image');
            const imageUpload = document.getElementById('image-upload');
            
            // Carregar dados do utilizador
            loadUserProfile(user, profileName, profileEmail, profilePhone, profileLocation, profileBio, profileImage);
            
            // Configurar upload de imagem de perfil
            if (imageUpload) {
                imageUpload.addEventListener('change', function(e) {
                    uploadProfileImage(user.uid, e.target.files[0], profileImage);
                });
            }
            
            // Configurar submissão do formulário de perfil
            if (profileForm) {
                profileForm.addEventListener('submit', function(e) {
                    e.preventDefault();
                    updateUserProfile(user.uid, {
                        name: profileName.value,
                        phone: profilePhone.value,
                        location: profileLocation.value,
                        bio: profileBio.value
                    });
                });
            }
            
            // Carregar histórico de transações do utilizador
            loadUserTransactions(user.uid);
            
            // Carregar itens favoritos
            loadUserFavorites(user.uid);
        } else {
            // Redirecionar para login se não estiver autenticado
            window.location.href = 'login.html';
        }
    });
});

/**
 * Carrega os dados do perfil do utilizador
 */
async function loadUserProfile(user, nameElem, emailElem, phoneElem, locationElem, bioElem, imageElem) {
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            
            // Preencher os campos de perfil
            if (nameElem) nameElem.value = userData.name || user.displayName || '';
            if (emailElem) emailElem.value = user.email || '';
            if (phoneElem) phoneElem.value = userData.phone || '';
            if (locationElem) locationElem.value = userData.location || '';
            if (bioElem) bioElem.value = userData.bio || '';
            
            // Carregar imagem de perfil
            if (imageElem && userData.profileImageUrl) {
                imageElem.src = userData.profileImageUrl;
            } else if (imageElem) {
                imageElem.src = 'assets/default-profile.png';
            }
        }
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        showNotification('Erro ao carregar dados do perfil', 'error');
    }
}

/**
 * Atualiza os dados do perfil do utilizador
 */
async function updateUserProfile(userId, profileData) {
    try {
        await db.collection('users').doc(userId).update(profileData);
        showNotification('Perfil atualizado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        showNotification('Erro ao atualizar perfil. Tente novamente.', 'error');
    }
}

/**
 * Faz upload da imagem de perfil
 */
async function uploadProfileImage(userId, file, imageElement) {
    if (!file) return;
    
    // Validar tipo de ficheiro
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        showNotification('Por favor, utilize apenas imagens JPG, PNG, GIF ou WEBP', 'error');
        return;
    }
    
    // Validar tamanho (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
        showNotification('A imagem deve ter no máximo 2MB', 'error');
        return;
    }
    
    try {
        // Mostrar indicador de progresso
        showNotification('A carregar imagem...', 'info');
        
        // Criar referência para o ficheiro no Storage
        const fileRef = storage.ref(`profile-images/${userId}/${file.name}`);
        
        // Fazer upload do ficheiro
        const uploadTask = fileRef.put(file);
        
        // Monitorizar progresso do upload
        uploadTask.on('state_changed', 
            // Progresso
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log(`Upload: ${progress.toFixed(2)}%`);
            },
            // Erro
            (error) => {
                console.error('Erro no upload:', error);
                showNotification('Erro ao carregar imagem', 'error');
            },
            // Completado
            async () => {
                // Obter URL de download
                const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                
                // Atualizar URL da imagem no documento do utilizador
                await db.collection('users').doc(userId).update({
                    profileImageUrl: downloadURL
                });
                
                // Atualizar imagem na interface
                if (imageElement) {
                    imageElement.src = downloadURL;
                }
                
                showNotification('Imagem de perfil atualizada!', 'success');
            }
        );
    } catch (error) {
        console.error('Erro ao fazer upload da imagem:', error);
        showNotification('Erro ao processar imagem', 'error');
    }
}

/**
 * Carrega o histórico de transações do utilizador
 */
async function loadUserTransactions(userId) {
    const transactionsContainer = document.getElementById('user-transactions');
    if (!transactionsContainer) return;
    
    try {
        // Buscar transações onde o utilizador é o vendedor
        const sellerTransactions = await db.collection('transactions')
            .where('sellerId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
            
        // Buscar transações onde o utilizador é o comprador
        const buyerTransactions = await db.collection('transactions')
            .where('buyerId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
            
        // Combinar e ordenar os resultados
        const allTransactions = [
            ...sellerTransactions.docs.map(doc => ({id: doc.id, ...doc.data(), role: 'vendedor'})),
            ...buyerTransactions.docs.map(doc => ({id: doc.id, ...doc.data(), role: 'comprador'}))
        ].sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());
        
        // Renderizar transações
        if (allTransactions.length === 0) {
            transactionsContainer.innerHTML = `
                <div class="empty-state">
                    <p>Ainda não tem transações. Comece a vender ou comprar calçados!</p>
                </div>
            `;
        } else {
            transactionsContainer.innerHTML = allTransactions.map(transaction => `
                <div class="transaction-card">
                    <div class="transaction-header">
                        <span class="transaction-type ${transaction.type}">
                            ${transaction.type === 'sale' ? 'Venda' : 'Troca'}
                        </span>
                        <span class="transaction-date">
                            ${transaction.createdAt.toDate().toLocaleDateString('pt-PT')}
                        </span>
                    </div>
                    <div class="transaction-details">
                        <div class="product-info">
                            <h4>${transaction.productName}</h4>
                            <p>${transaction.type === 'sale' ? `${transaction.price}€` : 'Troca'}</p>
                        </div>
                        <div class="transaction-status ${transaction.status}">
                            ${getStatusText(transaction.status)}
                        </div>
                    </div>
                    <div class="transaction-footer">
                        <span>Você como ${transaction.role}</span>
                        <a href="transaction-details.html?id=${transaction.id}" class="btn-link">Ver detalhes</a>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Erro ao carregar transações:', error);
        transactionsContainer.innerHTML = `
            <div class="error-state">
                <p>Ocorreu um erro ao carregar as transações. Tente novamente mais tarde.</p>
            </div>
        `;
    }
}

/**
 * Carrega os itens favoritos do utilizador
 */
async function loadUserFavorites(userId) {
    const favoritesContainer = document.getElementById('user-favorites');
    if (!favoritesContainer) return;
    
    try {
        // Buscar IDs dos produtos favoritos
        const userDoc = await db.collection('users').doc(userId).get();
        const favorites = userDoc.data()?.favorites || [];
        
        if (favorites.length === 0) {
            favoritesContainer.innerHTML = `
                <div class="empty-state">
                    <p>Não tem calçados favoritos. Explore a plataforma e adicione itens aos favoritos!</p>
                </div>
            `;
            return;
        }
        
        // Buscar detalhes dos produtos favoritos
        const favProductsPromises = favorites.map(productId => 
            db.collection('products').doc(productId).get()
        );
        
        const favProductsSnapshots = await Promise.all(favProductsPromises);
        const favProducts = favProductsSnapshots
            .filter(doc => doc.exists)
            .map(doc => ({id: doc.id, ...doc.data()}));
        
        // Renderizar favoritos
        favoritesContainer.innerHTML = favProducts.map(product => `
            <div class="product-card">
                <div class="product-img">
                    <img src="${product.imageUrl || 'assets/placeholder-shoe.png'}" alt="${product.title}">
                    <span class="product-status status-${product.condition.toLowerCase()}">
                        ${getConditionText(product.condition)}
                    </span>
                </div>
                <div class="product-info">
                    <h3 class="product-title">${product.title}</h3>
                    <p class="product-price">
                        ${product.tradeOption ? 'Troca disponível' : `${product.price}€`}
                    </p>
                    <div class="product-meta">
                        <span>Tamanho: ${product.size}</span>
                        <span>${product.location}</span>
                    </div>
                    <div class="product-actions">
                        <a href="product-details.html?id=${product.id}" class="btn-link">Ver detalhes</a>
                        <button class="btn-icon remove-favorite" data-id="${product.id}">
                            <i class="fas fa-heart"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Configurar botões de remover favoritos
        document.querySelectorAll('.remove-favorite').forEach(button => {
            button.addEventListener('click', () => {
                removeFromFavorites(userId, button.dataset.id);
            });
        });
    } catch (error) {
        console.error('Erro ao carregar favoritos:', error);
        favoritesContainer.innerHTML = `
            <div class="error-state">
                <p>Ocorreu um erro ao carregar os favoritos. Tente novamente mais tarde.</p>
            </div>
        `;
    }
}

/**
 * Remove um produto dos favoritos
 */
async function removeFromFavorites(userId, productId) {
    try {
        const userRef = db.collection('users').doc(userId);
        
        // Atualizar array de favoritos usando arrayRemove
        await userRef.update({
            favorites: firebase.firestore.FieldValue.arrayRemove(productId)
        });
        
        // Recarregar favoritos
        loadUserFavorites(userId);
        showNotification('Removido dos favoritos', 'success');
    } catch (error) {
        console.error('Erro ao remover dos favoritos:', error);
        showNotification('Erro ao remover dos favoritos', 'error');
    }
}

/**
 * Obtém o texto do status de transação
 */
function getStatusText(status) {
    const statusMap = {
        'pending': 'Pendente',
        'accepted': 'Aceite',
        'in_progress': 'Em Progresso',
        'completed': 'Concluída',
        'canceled': 'Cancelada'
    };
    return statusMap[status] || status;
}

/**
 * Obtém o texto do estado do calçado
 */
function getConditionText(condition) {
    const conditionMap = {
        'NEW': 'NOVO',
        'LIKE_NEW': 'COMO NOVO',
        'GOOD': 'BOM',
        'USED': 'USADO',
        'WELL_USED': 'MUITO USADO'
    };
    return conditionMap[condition] || condition;
}

/**
 * Exibe uma notificação na interface
 */
function showNotification(message, type = 'info') {
    // Verificar se o container de notificações existe
    let notifContainer = document.getElementById('notification-container');
    
    // Se não existir, criar
    if (!notifContainer) {
        notifContainer = document.createElement('div');
        notifContainer.id = 'notification-container';
        document.body.appendChild(notifContainer);
    }
    
    // Criar elemento de notificação
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Adicionar ao container
    notifContainer.appendChild(notification);
    
    // Remover após 3 segundos
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

export { 
    updateUserProfile, 
    uploadProfileImage, 
    loadUserTransactions, 
    loadUserFavorites, 
    removeFromFavorites 
};