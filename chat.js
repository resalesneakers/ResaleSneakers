// Chat.js - Sistema de chat para ResaleSneakers (Português de Portugal)
import { auth, db, storage } from './firebase.js';

document.addEventListener('DOMContentLoaded', () => {
    // Referências aos elementos do DOM
    const chatContainer = document.getElementById('chat-container');
    const messagesList = document.getElementById('messages-list');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const chatList = document.getElementById('chat-list');
    const backButton = document.getElementById('back-to-chats');
    const imageUpload = document.getElementById('image-upload');
    const chatHeader = document.getElementById('chat-header');
    
    // Estado atual
    let currentChatId = null;
    let currentUserId = null;
    let currentReceiverId = null;
    let messagesListener = null;
    
    // Verifica se o utilizador está autenticado
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUserId = user.uid;
            loadChatList();
            setupUIForLoggedInUser();
        } else {
            promptUserToLogin();
        }
    });
    
    // Carregar a lista de conversas do utilizador
    function loadChatList() {
        db.collection('chats')
            .where('participants', 'array-contains', currentUserId)
            .orderBy('lastMessageTime', 'desc')
            .onSnapshot(snapshot => {
                chatList.innerHTML = '';
                
                if (snapshot.empty) {
                    chatList.innerHTML = `
                        <div class="no-chats">
                            <p>Ainda não tem conversas.</p>
                            <p>Procure por calçado e inicie uma conversa com o vendedor.</p>
                        </div>
                    `;
                    return;
                }
                
                snapshot.forEach(doc => {
                    const chatData = doc.data();
                    const otherUser = chatData.participants.find(id => id !== currentUserId);
                    
                    // Obter informações do outro utilizador
                    db.collection('users').doc(otherUser).get().then(userDoc => {
                        if (userDoc.exists) {
                            const userData = userDoc.data();
                            
                            // Criar elemento de lista de chat
                            const chatItem = document.createElement('div');
                            chatItem.className = 'chat-item';
                            chatItem.dataset.chatId = doc.id;
                            chatItem.dataset.receiverId = otherUser;
                            
                            // Determinar o estado de leitura da mensagem
                            const unreadClass = chatData.unreadBy && chatData.unreadBy.includes(currentUserId) 
                                ? 'unread' : '';
                            
                            // Formato da data da última mensagem
                            const lastDate = chatData.lastMessageTime ? formatDateTimePT(chatData.lastMessageTime.toDate()) : '';
                            
                            chatItem.innerHTML = `
                                <div class="chat-avatar">
                                    <img src="${userData.profilePicture || '/api/placeholder/50/50'}" alt="${userData.displayName || 'Utilizador'}">
                                </div>
                                <div class="chat-info">
                                    <div class="chat-name">${userData.displayName || 'Utilizador'}</div>
                                    <div class="chat-last-message ${unreadClass}">
                                        ${chatData.lastMessage ? chatData.lastMessage.substring(0, 30) + (chatData.lastMessage.length > 30 ? '...' : '') : 'Inicie uma conversa...'}
                                    </div>
                                </div>
                                <div class="chat-time">${lastDate}</div>
                            `;
                            
                            // Adicionar evento de clique
                            chatItem.addEventListener('click', () => {
                                openChat(doc.id, otherUser, userData);
                            });
                            
                            chatList.appendChild(chatItem);
                        }
                    }).catch(error => {
                        console.error("Erro ao obter informações do utilizador:", error);
                    });
                });
            });
    }
    
    // Abrir uma conversa específica
    function openChat(chatId, receiverId, receiverData) {
        // Limpar o estado atual
        if (messagesListener) {
            messagesListener();
        }
        
        currentChatId = chatId;
        currentReceiverId = receiverId;
        
        // Exibir a área de chat e ocultar a lista
        document.getElementById('chats-list-container').classList.add('hidden');
        chatContainer.classList.remove('hidden');
        
        // Configurar cabeçalho do chat
        chatHeader.innerHTML = `
            <div class="user-avatar">
                <img src="${receiverData.profilePicture || '/api/placeholder/50/50'}" alt="${receiverData.displayName || 'Utilizador'}">
            </div>
            <div class="user-info">
                <div class="user-name">${receiverData.displayName || 'Utilizador'}</div>
                <div class="user-status">${receiverData.isOnline ? 'Online agora' : 'Offline'}</div>
            </div>
            <div class="product-info" id="chat-product-info"></div>
        `;
        
        // Carregar informações do produto se existirem
        loadProductInfo(chatId);
        
        // Limpar a lista de mensagens
        messagesList.innerHTML = '';
        
        // Marcar conversa como lida
        db.collection('chats').doc(chatId).update({
            unreadBy: firebase.firestore.FieldValue.arrayRemove(currentUserId)
        }).catch(error => {
            console.error("Erro ao atualizar estado de leitura:", error);
        });
        
        // Carregar e monitorar mensagens
        messagesListener = db.collection('chats')
            .doc(chatId)
            .collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot(snapshot => {
                let shouldScroll = false;
                
                // Determinar se devemos fazer scroll automático
                if (messagesList.scrollTop + messagesList.clientHeight >= messagesList.scrollHeight - 100) {
                    shouldScroll = true;
                }
                
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const messageData = change.doc.data();
                        addMessageToUI(messageData);
                    }
                });
                
                if (shouldScroll) {
                    scrollToBottom();
                }
            });
    }
    
    // Adicionar uma mensagem à UI
    function addMessageToUI(messageData) {
        const messageEl = document.createElement('div');
        const isCurrentUser = messageData.senderId === currentUserId;
        
        messageEl.className = `message ${isCurrentUser ? 'sender' : 'receiver'}`;
        
        // Formato da data/hora
        const timestamp = messageData.timestamp ? formatDateTimePT(messageData.timestamp.toDate()) : '';
        
        // Conteúdo da mensagem baseado no tipo
        let messageContent = '';
        
        if (messageData.type === 'text') {
            messageContent = `<div class="message-text">${messageData.text}</div>`;
        } else if (messageData.type === 'image') {
            messageContent = `
                <div class="message-image">
                    <img src="${messageData.imageUrl}" alt="Imagem partilhada">
                </div>
            `;
        } else if (messageData.type === 'offer') {
            messageContent = `
                <div class="message-offer">
                    <div class="offer-title">
                        ${isCurrentUser ? 'Fez uma proposta' : 'Recebeu uma proposta'}
                    </div>
                    <div class="offer-amount">${messageData.offerAmount} €</div>
                    <div class="offer-for">Para: ${messageData.productName}</div>
                    ${!isCurrentUser ? `
                        <div class="offer-actions">
                            <button class="btn btn-accept" data-offer-id="${messageData.id}">Aceitar</button>
                            <button class="btn btn-reject" data-offer-id="${messageData.id}">Recusar</button>
                        </div>
                    ` : ''}
                </div>
            `;
        } else if (messageData.type === 'trade') {
            messageContent = `
                <div class="message-trade">
                    <div class="trade-title">
                        ${isCurrentUser ? 'Propôs uma troca' : 'Recebeu uma proposta de troca'}
                    </div>
                    <div class="trade-products">
                        <div class="trade-product">
                            <img src="${messageData.offerProductImage || '/api/placeholder/80/80'}" alt="${messageData.offerProductName}">
                            <span>${messageData.offerProductName}</span>
                        </div>
                        <div class="trade-arrow">↔️</div>
                        <div class="trade-product">
                            <img src="${messageData.requestProductImage || '/api/placeholder/80/80'}" alt="${messageData.requestProductName}">
                            <span>${messageData.requestProductName}</span>
                        </div>
                    </div>
                    ${!isCurrentUser ? `
                        <div class="trade-actions">
                            <button class="btn btn-accept" data-trade-id="${messageData.id}">Aceitar</button>
                            <button class="btn btn-reject" data-trade-id="${messageData.id}">Recusar</button>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        messageEl.innerHTML = `
            ${messageContent}
            <div class="message-time">${timestamp}</div>
        `;
        
        // Adicionar ao DOM
        messagesList.appendChild(messageEl);
        
        // Adicionar ouvintes de eventos para botões de oferta/troca
        if ((messageData.type === 'offer' || messageData.type === 'trade') && !isCurrentUser) {
            const acceptBtn = messageEl.querySelector('.btn-accept');
            const rejectBtn = messageEl.querySelector('.btn-reject');
            
            if (acceptBtn && rejectBtn) {
                acceptBtn.addEventListener('click', () => handleOfferResponse(messageData, true));
                rejectBtn.addEventListener('click', () => handleOfferResponse(messageData, false));
            }
        }
    }
    
    // Carregar informações do produto associado à conversa
    function loadProductInfo(chatId) {
        db.collection('chats').doc(chatId).get().then(doc => {
            if (doc.exists && doc.data().productId) {
                const productId = doc.data().productId;
                
                db.collection('products').doc(productId).get().then(productDoc => {
                    if (productDoc.exists) {
                        const productData = productDoc.data();
                        
                        document.getElementById('chat-product-info').innerHTML = `
                            <div class="chat-product">
                                <img src="${productData.images && productData.images[0] ? productData.images[0] : '/api/placeholder/50/50'}" alt="${productData.title}">
                                <div>
                                    <div class="product-title">${productData.title}</div>
                                    <div class="product-price">
                                        ${productData.isForTrade ? 'Para troca' : productData.price + ' €'}
                                    </div>
                                </div>
                            </div>
                        `;
                        
                        // Adicionar botões de oferta se o produto estiver à venda
                        if (!productData.isForTrade && productData.sellerId !== currentUserId) {
                            const offerBtn = document.createElement('button');
                            offerBtn.className = 'btn btn-offer';
                            offerBtn.textContent = 'Fazer proposta';
                            offerBtn.addEventListener('click', () => showOfferModal(productData));
                            
                            document.getElementById('chat-product-info').appendChild(offerBtn);
                        }
                        
                        // Adicionar botão de proposta de troca
                        if (productData.sellerId !== currentUserId) {
                            const tradeBtn = document.createElement('button');
                            tradeBtn.className = 'btn btn-trade';
                            tradeBtn.textContent = 'Propor troca';
                            tradeBtn.addEventListener('click', () => showTradeModal(productData));
                            
                            document.getElementById('chat-product-info').appendChild(tradeBtn);
                        }
                    }
                }).catch(error => {
                    console.error("Erro ao carregar informações do produto:", error);
                });
            }
        }).catch(error => {
            console.error("Erro ao carregar informações da conversa:", error);
        });
    }
    
    // Enviar uma mensagem de texto
    function sendTextMessage() {
        const messageText = messageInput.value.trim();
        
        if (messageText === '' || !currentChatId) return;
        
        const newMessage = {
            type: 'text',
            text: messageText,
            senderId: currentUserId,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Adicionar à coleção de mensagens
        db.collection('chats')
            .doc(currentChatId)
            .collection('messages')
            .add(newMessage)
            .then(() => {
                // Atualizar informações da conversa
                updateChatLastMessage(messageText);
                
                // Limpar o campo de entrada
                messageInput.value = '';
                messageInput.focus();
            })
            .catch(error => {
                console.error("Erro ao enviar mensagem:", error);
                alert("Não foi possível enviar a mensagem. Tente novamente.");
            });
    }
    
    // Enviar uma imagem
    function sendImage(file) {
        if (!file || !currentChatId) return;
        
        // Mostrar indicador de carregamento
        const loadingEl = document.createElement('div');
        loadingEl.className = 'message sender loading';
        loadingEl.innerHTML = '<div class="loading-spinner"></div><div>A carregar imagem...</div>';
        messagesList.appendChild(loadingEl);
        scrollToBottom();
        
        // Referência ao Storage com caminho único
        const storageRef = storage.ref().child(`chat_images/${currentChatId}/${Date.now()}_${file.name}`);
        
        // Carregar o ficheiro
        storageRef.put(file).then(snapshot => {
            return snapshot.ref.getDownloadURL();
        }).then(downloadURL => {
            // Remover indicador de carregamento
            messagesList.removeChild(loadingEl);
            
            // Criar mensagem com imagem
            const newMessage = {
                type: 'image',
                imageUrl: downloadURL,
                senderId: currentUserId,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Adicionar à coleção de mensagens
            return db.collection('chats')
                .doc(currentChatId)
                .collection('messages')
                .add(newMessage);
        }).then(() => {
            // Atualizar informações da conversa
            updateChatLastMessage('📷 Imagem');
            scrollToBottom();
        }).catch(error => {
            console.error("Erro ao enviar imagem:", error);
            // Remover indicador de carregamento e mostrar erro
            messagesList.removeChild(loadingEl);
            alert("Não foi possível enviar a imagem. Tente novamente.");
        });
    }
    
    // Enviar uma proposta
    function sendOffer(productData, offerAmount) {
        if (!currentChatId || !productData) return;
        
        const newMessage = {
            type: 'offer',
            offerAmount: offerAmount,
            productId: productData.id,
            productName: productData.title,
            status: 'pending',
            senderId: currentUserId,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Adicionar à coleção de mensagens
        db.collection('chats')
            .doc(currentChatId)
            .collection('messages')
            .add(newMessage)
            .then(docRef => {
                // Atualizar com o ID da mensagem para referência futura
                return docRef.update({
                    id: docRef.id
                });
            })
            .then(() => {
                // Atualizar informações da conversa
                updateChatLastMessage(`Proposta: ${offerAmount} € para ${productData.title}`);
            })
            .catch(error => {
                console.error("Erro ao enviar proposta:", error);
                alert("Não foi possível enviar a proposta. Tente novamente.");
            });
    }
    
    // Enviar uma proposta de troca
    function sendTradeProposal(theirProduct, yourProduct) {
        if (!currentChatId || !theirProduct || !yourProduct) return;
        
        const newMessage = {
            type: 'trade',
            offerProductId: yourProduct.id,
            offerProductName: yourProduct.title,
            offerProductImage: yourProduct.images && yourProduct.images[0],
            requestProductId: theirProduct.id,
            requestProductName: theirProduct.title,
            requestProductImage: theirProduct.images && theirProduct.images[0],
            status: 'pending',
            senderId: currentUserId,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Adicionar à coleção de mensagens
        db.collection('chats')
            .doc(currentChatId)
            .collection('messages')
            .add(newMessage)
            .then(docRef => {
                // Atualizar com o ID da mensagem para referência futura
                return docRef.update({
                    id: docRef.id
                });
            })
            .then(() => {
                // Atualizar informações da conversa
                updateChatLastMessage(`Proposta de troca: ${yourProduct.title} ↔️ ${theirProduct.title}`);
            })
            .catch(error => {
                console.error("Erro ao enviar proposta de troca:", error);
                alert("Não foi possível enviar a proposta de troca. Tente novamente.");
            });
    }
    
    // Processar resposta a uma oferta ou proposta de troca
    function handleOfferResponse(messageData, isAccepted) {
        const status = isAccepted ? 'accepted' : 'rejected';
        const messageId = messageData.id;
        
        // Atualizar estado da oferta
        db.collection('chats')
            .doc(currentChatId)
            .collection('messages')
            .doc(messageId)
            .update({
                status: status,
                responseTimestamp: firebase.firestore.FieldValue.serverTimestamp()
            })
            .then(() => {
                // Adicionar mensagem do sistema
                const responseMessage = {
                    type: 'text',
                    text: isAccepted ? 
                        (messageData.type === 'offer' ? `Proposta de ${messageData.offerAmount} € aceite.` : `Proposta de troca aceite.`) : 
                        (messageData.type === 'offer' ? `Proposta de ${messageData.offerAmount} € recusada.` : `Proposta de troca recusada.`),
                    senderId: 'system',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                return db.collection('chats')
                    .doc(currentChatId)
                    .collection('messages')
                    .add(responseMessage);
            })
            .then(() => {
                // Se aceite e for uma oferta, atualizar estado do produto
                if (isAccepted && messageData.type === 'offer') {
                    // Aqui poderá ser implementada a lógica para marcar o produto como vendido
                    // ou iniciar o processo de pagamento
                }
                
                // Se aceite e for uma troca, atualizar estado dos produtos
                if (isAccepted && messageData.type === 'trade') {
                    // Aqui poderá ser implementada a lógica para marcar os produtos como trocados
                }
            })
            .catch(error => {
                console.error("Erro ao processar resposta à proposta:", error);
                alert("Ocorreu um erro ao processar a sua resposta. Tente novamente.");
            });
    }
    
    // Atualizar informações da conversa após nova mensagem
    function updateChatLastMessage(message) {
        db.collection('chats').doc(currentChatId).update({
            lastMessage: message,
            lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
            // Marcar como não lida para o destinatário
            unreadBy: [currentReceiverId]
        }).catch(error => {
            console.error("Erro ao atualizar informações da conversa:", error);
        });
    }
    
    // Exibir modal para fazer uma proposta
    function showOfferModal(productData) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-modal">&times;</span>
                <h3>Fazer proposta para ${productData.title}</h3>
                <div class="offer-product-info">
                    <img src="${productData.images && productData.images[0] ? productData.images[0] : '/api/placeholder/100/100'}" alt="${productData.title}">
                    <div>
                        <div class="product-title">${productData.title}</div>
                        <div class="product-price">Preço anunciado: ${productData.price} €</div>
                    </div>
                </div>
                <div class="form-group">
                    <label for="offer-amount">Valor da sua proposta (€):</label>
                    <input type="number" id="offer-amount" min="1" value="${Math.floor(productData.price * 0.9)}">
                </div>
                <button id="submit-offer" class="btn btn-primary">Enviar proposta</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Lidar com o fecho do modal
        const closeModal = () => {
            document.body.removeChild(modal);
        };
        
        modal.querySelector('.close-modal').addEventListener('click', closeModal);
        
        // Fechar ao clicar fora do modal
        modal.addEventListener('click', event => {
            if (event.target === modal) {
                closeModal();
            }
        });
        
        // Submeter proposta
        modal.querySelector('#submit-offer').addEventListener('click', () => {
            const offerAmount = parseFloat(document.getElementById('offer-amount').value);
            
            if (isNaN(offerAmount) || offerAmount <= 0) {
                alert("Por favor, introduza um valor válido.");
                return;
            }
            
            sendOffer(productData, offerAmount);
            closeModal();
        });
    }
    
    // Exibir modal para propor uma troca
    function showTradeModal(theirProduct) {
        // Primeiro precisamos obter os produtos do utilizador atual
        db.collection('products')
            .where('sellerId', '==', currentUserId)
            .get()
            .then(snapshot => {
                if (snapshot.empty) {
                    alert("Não tem produtos disponíveis para troca. Anuncie um produto primeiro.");
                    return;
                }
                
                const userProducts = [];
                snapshot.forEach(doc => {
                    userProducts.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                
                // Criar modal para seleção do produto
                const modal = document.createElement('div');
                modal.className = 'modal';
                modal.innerHTML = `
                    <div class="modal-content">
                        <span class="close-modal">&times;</span>
                        <h3>Propor troca com ${theirProduct.title}</h3>
                        <div class="trade-product-container">
                            <div class="trade-side">
                                <h4>O seu produto:</h4>
                                <select id="your-product-select">
                                    <option value="">Selecione um produto...</option>
                                    ${userProducts.map(product => 
                                        `<option value="${product.id}">${product.title} - ${product.isForTrade ? 'Para troca' : product.price + ' €'}</option>`
                                    ).join('')}
                                </select>
                            </div>
                            <div class="trade-arrow">↔️</div>
                            <div class="trade-side">
                                <h4>Produto deles:</h4>
                                <div class="target-product">
                                    <img src="${theirProduct.images && theirProduct.images[0] ? theirProduct.images[0] : '/api/placeholder/100/100'}" alt="${theirProduct.title}">
                                    <div>
                                        <div class="product-title">${theirProduct.title}</div>
                                        <div class="product-price">${theirProduct.isForTrade ? 'Para troca' : theirProduct.price + ' €'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button id="submit-trade" class="btn btn-primary" disabled>Propor troca</button>
                    </div>
                `;
                
                document.body.appendChild(modal);
                
                // Lidar com o fecho do modal
                const closeModal = () => {
                    document.body.removeChild(modal);
                };
                
                modal.querySelector('.close-modal').addEventListener('click', closeModal);
                
                // Fechar ao clicar fora do modal
                modal.addEventListener('click', event => {
                    if (event.target === modal) {
                        closeModal();
                    }
                });
                
                // Ativar/desativar botão com base na seleção
                const selectElement = modal.querySelector('#your-product-select');
                const submitButton = modal.querySelector('#submit-trade');
                
                selectElement.addEventListener('change', () => {
                    submitButton.disabled = !selectElement.value;
                });
                
                // Submeter proposta de troca
                submitButton.addEventListener('click', () => {
                    const selectedProductId = selectElement.value;
                    if (!selectedProductId) {
                        alert("Por favor, selecione um produto para troca.");
                        return;
                    }
                    
                    const selectedProduct = userProducts.find(p => p.id === selectedProductId);
                    if (!selectedProduct) {
                        alert("Erro ao encontrar o produto selecionado.");
                        return;
                    }
                    
                    sendTradeProposal(theirProduct, selectedProduct);
                    closeModal();
                });
            })
            .catch(error => {
                console.error("Erro ao carregar produtos do utilizador:", error);
                alert("Não foi possível carregar os seus produtos. Tente novamente.");
            });
    }
    
    // Configurar UI para utilizador autenticado
    function setupUIForLoggedInUser() {
        // Exibir a interface principal
        document.getElementById('chat-main-container').classList.remove('hidden');
        document.getElementById('login-prompt').classList.add('hidden');
        
        // Adicionar ouvintes de eventos
        sendButton.addEventListener('click', sendTextMessage);
        
        messageInput.addEventListener('keypress', event => {
            if (event.key === 'Enter') {
                sendTextMessage();
            }
        });
        
        backButton.addEventListener('click', () => {
            // Voltar para a lista de conversas
            chatContainer.classList.add('hidden');
            document.getElementById('chats-list-container').classList.remove('hidden');
            
            // Limpar estado atual
            if (messagesListener) {
                messagesListener();
                messagesListener = null;
            }
            currentChatId = null;
            currentReceiverId = null;
        });
        
        // Configurar upload de imagem
        imageUpload.addEventListener('change', event => {
            const file = event.target.files[0];
            if (file) {
                sendImage(file);
                // Limpar o input para permitir selecionar o mesmo ficheiro novamente
                imageUpload.value = '';
            }
        });
    }
    
    // Solicitar login caso o utilizador não esteja autenticado
    function promptUserToLogin() {
        document.getElementById('chat-main-container').classList.add('hidden');
        document.getElementById('login-prompt').classList.remove('hidden');
        
        document.getElementById('login-button').addEventListener('click', () => {
            window.location.href = 'login.html?redirect=chat.html';
        });
        
        document.getElementById('register-button').addEventListener('click', () => {
            window.location.href = 'register.html?redirect=chat.html';
        });
    }
    
    // Funções auxiliares
    
    // Formatar data e hora em português de Portugal
    function formatDateTimePT(date) {
        if (!date) return '';
        
        const now = new Date();
        const diff = now - date;
        const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        // Hoje, exibe apenas a hora
        if (diffDays === 0) {
            return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
        }
        
        // Ontem
        if (diffDays === 1) {
            return 'Ontem';
        }
        
        // Menos de 7 dias, exibe o nome do dia
        if (diffDays < 7) {
            const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
            return days[date.getDay()];
        }
        
        // Mais de 7 dias, exibe data completa
        return date.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    
    // Rolar para o fundo da lista de mensagens
    function scrollToBottom() {
        messagesList.scrollTop = messagesList.scrollHeight;
    }
});