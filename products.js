// Carregar produtos em destaque para a página inicial
function loadFeaturedProducts() {
    const featuredContainer = document.querySelector('.product-grid');
    
    if (!featuredContainer) return;
    
    // Limpar o container
    featuredContainer.innerHTML = '';
    
    // Buscar produtos em destaque do Firestore
    db.collection('products')
      .where('featured', '==', true)
      .where('status', '==', 'active')
      .limit(8)
      .get()
      .then(snapshot => {
        if (snapshot.empty) {
          featuredContainer.innerHTML = '<p class="no-products">Nenhum produto em destaque encontrado.</p>';
          return;
        }
        
        snapshot.forEach(doc => {
          const product = doc.data();
          const productCard = createProductCard(doc.id, product);
          featuredContainer.appendChild(productCard);
        });
      })
      .catch(error => {
        console.error('Erro ao carregar produtos em destaque:', error);
        featuredContainer.innerHTML = '<p class="error">Erro ao carregar produtos. Tente novamente mais tarde.</p>';
      });
  }
  
  // Carregar todos os produtos para a página de exploração
  function loadAllProducts(filters = {}) {
    const productsContainer = document.querySelector('.products-container');
    
    if (!productsContainer) return;
    
    // Limpar o container
    productsContainer.innerHTML = '<div class="loading">A carregar produtos...</div>';
    
    // Construir a query com base nos filtros
    let query = db.collection('products').where('status', '==', 'active');
    
    // Aplicar filtros
    if (filters.category && filters.category !== 'todos') {
      query = query.where('category', '==', filters.category);
    }
    
    if (filters.condition && filters.condition !== 'todos') {
      query = query.where('condition', '==', filters.condition);
    }
    
    if (filters.size && filters.size !== 'todos') {
      query = query.where('size', '==', filters.size);
    }
    
    // Correção: Não podemos usar múltiplos operadores de comparação em campos diferentes sem criar índices compostos
    // Vamos ajustar para usar apenas um filtro de preço por vez
    if (filters.minPrice && filters.maxPrice) {
      // Se precisarmos de ambos, precisamos organizar os dados de outra forma
      // Uma solução seria carregar todos os produtos dentro do filtro de minPrice e depois filtrar em memória
      query = query.where('price', '>=', parseFloat(filters.minPrice));
      // Nota: Precisaremos filtrar o maxPrice após obter os resultados
    } else if (filters.minPrice) {
      query = query.where('price', '>=', parseFloat(filters.minPrice));
    } else if (filters.maxPrice) {
      query = query.where('price', '<=', parseFloat(filters.maxPrice));
    }
    
    // Ordenação
    if (filters.sort === 'price-asc') {
      query = query.orderBy('price', 'asc');
    } else if (filters.sort === 'price-desc') {
      query = query.orderBy('price', 'desc');
    } else if (filters.sort === 'newest') {
      query = query.orderBy('createdAt', 'desc');
    } else {
      query = query.orderBy('createdAt', 'desc');
    }
    
    // Executar a query
    query.get()
      .then(snapshot => {
        // Remover indicador de carregamento
        productsContainer.innerHTML = '';
        
        if (snapshot.empty) {
          productsContainer.innerHTML = '<p class="no-products">Nenhum produto encontrado com os filtros selecionados.</p>';
          return;
        }
        
        // Filtrar resultados por maxPrice se necessário
        let results = [];
        snapshot.forEach(doc => {
          const product = doc.data();
          // Aplicar filtro maxPrice em memória se necessário
          if (filters.minPrice && filters.maxPrice && product.price > parseFloat(filters.maxPrice)) {
            return; // Pular este produto
          }
          results.push({ id: doc.id, data: product });
        });
        
        if (results.length === 0) {
          productsContainer.innerHTML = '<p class="no-products">Nenhum produto encontrado com os filtros selecionados.</p>';
          return;
        }
        
        results.forEach(item => {
          const productCard = createProductCard(item.id, item.data);
          productsContainer.appendChild(productCard);
        });
      })
      .catch(error => {
        console.error('Erro ao carregar produtos:', error);
        productsContainer.innerHTML = '<p class="error">Erro ao carregar produtos. Tente novamente mais tarde.</p>';
      });
  }
  
  // Função para criar um card de produto
  function createProductCard(id, product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.id = id;
    
    let statusClass = 'status-used';
    if (product.condition === 'novo') {
      statusClass = 'status-new';
    } else if (product.tradeOption) {
      statusClass = 'status-trade';
    }
    
    let priceDisplay = `R$ ${product.price.toFixed(2)}`;
    if (product.tradeOption) {
      priceDisplay = `Troca por ${product.tradeFor || 'Outros modelos'}`;
    }
    
    card.innerHTML = `
      <div class="product-img" style="background-image: url('${product.images && product.images.length > 0 ? product.images[0] : '/api/placeholder/300/200'}')">
        <span class="product-status ${statusClass}">${product.condition === 'novo' ? 'NOVO' : product.tradeOption ? 'TROCA' : 'USADO'}</span>
      </div>
      <div class="product-info">
        <h3 class="product-title">${product.title}</h3>
        <p class="product-price">${priceDisplay}</p>
        <div class="product-meta">
          <span>Tamanho: ${product.size}</span>
          <span>${product.location}</span>
        </div>
        <a href="product.html?id=${id}" class="view-details">Ver detalhes</a>
        <a href="#" class="chat-now" data-seller="${product.seller}">Conversar com vendedor</a>
      </div>
    `;
    
    // Adicionar evento de chat
    const chatButton = card.querySelector('.chat-now');
    chatButton.addEventListener('click', (e) => {
      e.preventDefault();
      
      const sellerId = chatButton.dataset.seller;
      
      // Verificar se o utilizador está logado
      auth.onAuthStateChanged(user => {
        if (user) {
          // Criar ou abrir uma sala de chat
          createOrOpenChat(user.uid, sellerId, id);
        } else {
          // Redirecionar para página de login
          window.location.href = 'login.html?redirect=product.html?id=' + id;
        }
      });
    });
    
    return card;
  }
  
  // Função para criar ou abrir um chat existente
  function createOrOpenChat(userId, sellerId, productId) {
    // Verificar se já existe um chat para este produto entre estes utilizadores
    db.collection('chats')
      .where('participants', 'array-contains', userId)
      .get()
      .then(snapshot => {
        let existingChat = null;
        
        snapshot.forEach(doc => {
          const chat = doc.data();
          if (chat.participants.includes(sellerId) && chat.productId === productId) {
            existingChat = doc.id;
          }
        });
        
        if (existingChat) {
          // Abrir chat existente
          window.location.href = `chat.html?id=${existingChat}`;
        } else {
          // Criar novo chat
          db.collection('chats').add({
            participants: [userId, sellerId],
            productId: productId,
            createdAt: new Date(),
            lastMessage: {
              text: 'Olá, tenho interesse neste produto.',
              sentBy: userId,
              timestamp: new Date()
            }
          })
          .then(docRef => {
            // Adicionar primeira mensagem
            db.collection('chats').doc(docRef.id).collection('messages').add({
              text: 'Olá, tenho interesse neste produto.',
              sentBy: userId,
              timestamp: new Date(),
              read: false
            })
            .then(() => {
              window.location.href = `chat.html?id=${docRef.id}`;
            });
          })
          .catch(error => {
            console.error('Erro ao criar chat:', error);
            showAlert('Erro ao iniciar conversa. Tente novamente.', 'error');
          });
        }
      })
      .catch(error => {
        console.error('Erro ao verificar chats existentes:', error);
        showAlert('Erro ao iniciar conversa. Tente novamente.', 'error');
      });
  }
  
  // Função para criação de novo anúncio
  function createNewProduct(formData) {
    return new Promise((resolve, reject) => {
      auth.onAuthStateChanged(async (user) => {
        if (!user) {
          reject(new Error('Utilizador não autenticado'));
          return;
        }
        
        try {
          // Verificar se existe um preço válido se não for troca
          const tradeOption = formData.get('tradeOption') === 'true';
          const price = parseFloat(formData.get('price'));
          
          if (!tradeOption && (isNaN(price) || price <= 0)) {
            reject(new Error('O preço deve ser um valor numérico positivo'));
            return;
          }
          
          // Primeiro, fazer upload das imagens
          const imageUrls = await uploadProductImages(formData.get('images'), user.uid);
          
          // Criar objeto do produto
          const product = {
            title: formData.get('title'),
            brand: formData.get('brand'),
            model: formData.get('model'),
            description: formData.get('description'),
            category: formData.get('category'),
            size: formData.get('size'),
            condition: formData.get('condition'),
            price: tradeOption ? 0 : price,
            tradeOption: tradeOption,
            tradeFor: formData.get('tradeFor') || '',
            location: formData.get('location'),
            images: imageUrls,
            seller: user.uid,
            status: 'active',
            featured: false,
            createdAt: new Date()
          };
          
          // Salvar no Firestore
          const docRef = await db.collection('products').add(product);
          
          // Atualizar contagem de anúncios do utilizador
          await db.collection('users').doc(user.uid).update({
            productCount: firebase.firestore.FieldValue.increment(1)
          });
          
          resolve(docRef.id);
        } catch (error) {
          console.error('Erro ao criar produto:', error);
          reject(error);
        }
      });
    });
  }
  
  // Função para upload de imagens
  async function uploadProductImages(images, userId) {
    if (!images || images.length === 0) {
      return [];
    }
    
    const imageUrls = [];
    const promises = [];
    
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const timestamp = new Date().getTime();
      const storageRef = storage.ref(`products/${userId}/${timestamp}_${i}`);
      
      const uploadTask = storageRef.put(image)
        .then(snapshot => snapshot.ref.getDownloadURL())
        .then(url => {
          imageUrls.push(url);
        });
      
      promises.push(uploadTask);
    }
    
    await Promise.all(promises);
    return imageUrls;
  }
  
  // Carregar detalhes de um produto específico
  function loadProductDetails(productId) {
    const productContainer = document.querySelector('.product-details');
    
    if (!productContainer) return;
    
    productContainer.innerHTML = '<div class="loading">A carregar detalhes do produto...</div>';
    
    db.collection('products').doc(productId).get()
      .then(doc => {
        if (!doc.exists) {
          productContainer.innerHTML = '<p class="error">Produto não encontrado.</p>';
          return;
        }
        
        const product = doc.data();
        
        // Buscar informações do vendedor
        db.collection('users').doc(product.seller).get()
          .then(userDoc => {
            const seller = userDoc.exists ? userDoc.data() : { name: 'Utilizador Desconhecido' };
            
            // Renderizar detalhes do produto
            renderProductDetails(productContainer, productId, product, seller);
          })
          .catch(error => {
            console.error('Erro ao carregar informações do vendedor:', error);
            renderProductDetails(productContainer, productId, product, { name: 'Utilizador Desconhecido' });
          });
      })
      .catch(error => {
        console.error('Erro ao carregar detalhes do produto:', error);
        productContainer.innerHTML = '<p class="error">Erro ao carregar detalhes do produto. Tente novamente mais tarde.</p>';
      });
  }
  
  // Renderizar detalhes do produto
  function renderProductDetails(container, productId, product, seller) {
    let statusText = product.condition === 'novo' ? 'NOVO' : 'USADO';
    if (product.tradeOption) {
      statusText = 'TROCA';
    }
    
    let priceDisplay = `R$ ${product.price.toFixed(2)}`;
    if (product.tradeOption) {
      priceDisplay = `Troca por ${product.tradeFor || 'Outros modelos'}`;
    }
    
    // Criar galeria de imagens
    let imagesHTML = '';
    if (product.images && product.images.length > 0) {
      // Imagem principal
      imagesHTML += `
        <div class="main-image">
          <img src="${product.images[0]}" alt="${product.title}">
        </div>
        <div class="thumbnail-gallery">
      `;
      
      // Thumbnails
      product.images.forEach((img, index) => {
        imagesHTML += `<div class="thumbnail${index === 0 ? ' active' : ''}" data-src="${img}"><img src="${img}" alt=""></div>`;
      });
      
      imagesHTML += '</div>';
    } else {
      imagesHTML = `<div class="main-image"><img src="/api/placeholder/600/400" alt="${product.title}"></div>`;
    }
    
    // Verificar se o produto tem data válida
    let formattedDate = 'N/A';
    if (product.createdAt && typeof product.createdAt.toDate === 'function') {
      formattedDate = new Date(product.createdAt.toDate()).toLocaleDateString('pt-PT');
    }
    
    // Verificar se o vendedor tem data válida
    let sellerDate = 'N/A';
    if (seller.createdAt && typeof seller.createdAt.toDate === 'function') {
      sellerDate = new Date(seller.createdAt.toDate()).toLocaleDateString('pt-PT');
    }
    
    container.innerHTML = `
      <div class="product-gallery">
        ${imagesHTML}
      </div>
      <div class="product-info">
        <div class="product-header">
          <h1>${product.title}</h1>
          <span class="product-status status-${product.condition === 'novo' ? 'new' : product.tradeOption ? 'trade' : 'used'}">${statusText}</span>
        </div>
        
        <div class="price-container">
          <span class="price">${priceDisplay}</span>
        </div>
        
        <div class="product-meta">
          <div class="meta-item">
            <span class="label">Marca:</span>
            <span class="value">${product.brand}</span>
          </div>
          <div class="meta-item">
            <span class="label">Modelo:</span>
            <span class="value">${product.model}</span>
          </div>
          <div class="meta-item">
            <span class="label">Tamanho:</span>
            <span class="value">${product.size}</span>
          </div>
          <div class="meta-item">
            <span class="label">Estado:</span>
            <span class="value">${product.condition}</span>
          </div>
          <div class="meta-item">
            <span class="label">Localização:</span>
            <span class="value">${product.location}</span>
          </div>
          <div class="meta-item">
            <span class="label">Publicado:</span>
            <span class="value">${formattedDate}</span>
          </div>
        </div>
        
        <div class="product-description">
          <h3>Descrição</h3>
          <p>${product.description}</p>
        </div>
        
        <div class="seller-info">
          <h3>Informações do Vendedor</h3>
          <div class="seller-profile">
            <div class="seller-avatar"></div>
            <div class="seller-details">
              <h4>${seller.name}</h4>
              <p>Membro desde ${sellerDate}</p>
            </div>
          </div>
          
          <div class="action-buttons">
            <button class="btn btn-primary chat-btn" data-seller="${product.seller}" data-product="${productId}">Conversar com o vendedor</button>
            <button class="btn btn-outline favorite-btn" data-product="${productId}">Adicionar aos favoritos</button>
          </div>
        </div>
      </div>
    `;
    
    // Adicionar evento de thumbnail
    const thumbnails = container.querySelectorAll('.thumbnail');
    const mainImage = container.querySelector('.main-image img');
    
    thumbnails.forEach(thumb => {
      thumb.addEventListener('click', () => {
        // Atualizar imagem principal
        mainImage.src = thumb.dataset.src;
        
        // Atualizar classe ativa
        document.querySelector('.thumbnail.active').classList.remove('active');
        thumb.classList.add('active');
      });
    });
    
    // Adicionar evento ao botão de chat
    const chatButton = container.querySelector('.chat-btn');
    chatButton.addEventListener('click', () => {
      auth.onAuthStateChanged(user => {
        if (user) {
          // Verificar se o usuário não é o vendedor
          if (user.uid === product.seller) {
            showAlert('Não é possível iniciar uma conversa com você mesmo.', 'warning');
            return;
          }
          createOrOpenChat(user.uid, product.seller, productId);
        } else {
          window.location.href = `login.html?redirect=product.html?id=${productId}`;
        }
      });
    });
    
    // Adicionar evento ao botão de favoritos
    const favoriteButton = container.querySelector('.favorite-btn');
    favoriteButton.addEventListener('click', () => {
      auth.onAuthStateChanged(user => {
        if (user) {
          toggleFavorite(user.uid, productId, favoriteButton);
        } else {
          window.location.href = `login.html?redirect=product.html?id=${productId}`;
        }
      });
    });
    
    // Verificar se o produto já está nos favoritos
    auth.onAuthStateChanged(user => {
      if (user) {
        db.collection('users').doc(user.uid).get()
          .then(doc => {
            if (doc.exists && doc.data().favorites && doc.data().favorites.includes(productId)) {
              favoriteButton.classList.add('favorited');
              favoriteButton.textContent = 'Remover dos favoritos';
            }
          });
      }
    });
  }
  
  // Função para adicionar/remover dos favoritos
  function toggleFavorite(userId, productId, button) {
    db.collection('users').doc(userId).get()
      .then(doc => {
        if (!doc.exists) {
          console.error('Documento do utilizador não encontrado');
          return;
        }
        
        const userData = doc.data();
        const favorites = userData.favorites || [];
        const isFavorite = favorites.includes(productId);
        
        if (isFavorite) {
          // Remover dos favoritos
          db.collection('users').doc(userId).update({
            favorites: firebase.firestore.FieldValue.arrayRemove(productId)
          })
          .then(() => {
            button.classList.remove('favorited');
            button.textContent = 'Adicionar aos favoritos';
            showAlert('Produto removido dos favoritos!', 'success');
          })
          .catch(error => {
            console.error('Erro ao remover dos favoritos:', error);
            showAlert('Erro ao remover dos favoritos. Tente novamente.', 'error');
          });
        } else {
          // Adicionar aos favoritos
          db.collection('users').doc(userId).update({
            favorites: firebase.firestore.FieldValue.arrayUnion(productId)
          })
          .then(() => {
            button.classList.add('favorited');
            button.textContent = 'Remover dos favoritos';
            showAlert('Produto adicionado aos favoritos!', 'success');
          })
          .catch(error => {
            console.error('Erro ao adicionar aos favoritos:', error);
            showAlert('Erro ao adicionar aos favoritos. Tente novamente.', 'error');
          });
        }
      })
      .catch(error => {
        console.error('Erro ao verificar favoritos:', error);
        showAlert('Erro ao atualizar favoritos. Tente novamente.', 'error');
      });
  }
  
  // Carregar produtos do utilizador
  function loadUserProducts(userId, container) {
    if (!container) return;
    
    container.innerHTML = '<div class="loading">A carregar os seus produtos...</div>';
    
    db.collection('products')
      .where('seller', '==', userId)
      .orderBy('createdAt', 'desc')
      .get()
      .then(snapshot => {
        container.innerHTML = '';
        
        if (snapshot.empty) {
          container.innerHTML = '<p class="no-products">Ainda não tem produtos anunciados.</p>';
          return;
        }
        
        snapshot.forEach(doc => {
          const product = doc.data();
          const productItem = createUserProductItem(doc.id, product);
          container.appendChild(productItem);
        });
      })
      .catch(error => {
        console.error('Erro ao carregar produtos do utilizador:', error);
        container.innerHTML = '<p class="error">Erro ao carregar os seus produtos. Tente novamente mais tarde.</p>';
      });
  }
  
  // Criar item de produto para a lista do utilizador
  function createUserProductItem(id, product) {
    const item = document.createElement('div');
    item.className = 'user-product-item';
    
    let statusText = product.condition === 'novo' ? 'NOVO' : 'USADO';
    if (product.tradeOption) {
      statusText = 'TROCA';
    }
    
    let priceDisplay = `R$ ${product.price.toFixed(2)}`;
    if (product.tradeOption) {
      priceDisplay = `Troca por ${product.tradeFor || 'Outros modelos'}`;
    }
    
    const statusClass = product.status === 'active' ? 'active-status' : 'inactive-status';
    
    item.innerHTML = `
      <div class="product-thumbnail" style="background-image: url('${product.images && product.images.length > 0 ? product.images[0] : '/api/placeholder/100/100'}')"></div>
      <div class="product-info">
        <h3>${product.title}</h3>
        <p class="product-price">${priceDisplay}</p>
        <div class="product-meta">
          <span class="product-status status-${product.condition === 'novo' ? 'new' : product.tradeOption ? 'trade' : 'used'}">${statusText}</span>
          <span class="product-${statusClass}">${product.status === 'active' ? 'Ativo' : 'Inativo'}</span>
        </div>
      </div>
      <div class="product-actions">
        <a href="product.html?id=${id}" class="btn btn-small">Ver</a>
        <a href="edit-product.html?id=${id}" class="btn btn-small btn-outline">Editar</a>
        <button class="btn btn-small btn-danger delete-product" data-id="${id}">Eliminar</button>
      </div>
    `;
    
    // Adicionar evento de eliminação
    const deleteButton = item.querySelector('.delete-product');
    deleteButton.addEventListener('click', () => {
      if (confirm('Tem a certeza que deseja eliminar este produto?')) {
        deleteProduct(id);
      }
    });
    
    return item;
  }
  
  // Função para eliminar produto
  function deleteProduct(productId) {
    // Obter referência ao produto para guardar o userId
    db.collection('products').doc(productId).get()
      .then(doc => {
        if (!doc.exists) {
          showAlert('Produto não encontrado.', 'error');
          return;
        }
        
        const product = doc.data();
        const userId = product.seller;
        
        // Eliminar o produto
        return db.collection('products').doc(productId).delete()
          .then(() => {
            // Atualizar contagem de produtos do utilizador
            return db.collection('users').doc(userId).update({
              productCount: firebase.firestore.FieldValue.increment(-1)
            });
          })
          .then(() => {
            showAlert('Produto eliminado com sucesso!', 'success');
            
            // Recarregar a lista de produtos se estivermos na página de produtos do utilizador
            const userProductsContainer = document.querySelector('.user-products');
            if (userProductsContainer) {
              loadUserProducts(userId, userProductsContainer);
            }
          });
      })
      .catch(error => {
        console.error('Erro ao eliminar produto:', error);
        showAlert('Erro ao eliminar produto. Tente novamente.', 'error');
      });
  }
  
  // Função para carregar detalhes do produto para edição
  function loadProductForEdit(productId) {
    const form = document.getElementById('edit-product-form');
    
    if (!form) return;
    
    // Mostrar indicador de carregamento
    form.innerHTML = '<div class="loading">A carregar detalhes do produto...</div>';
    
    db.collection('products').doc(productId).get()
      .then(doc => {
        if (!doc.exists) {
          form.innerHTML = '<p class="error">Produto não encontrado.</p>';
          return;
        }
        
        const product = doc.data();
        
        // Verificar se o utilizador atual é o vendedor
        auth.onAuthStateChanged(user => {
          if (!user || user.uid !== product.seller) {
            form.innerHTML = '<p class="error">Você não tem permissão para editar este produto.</p>';
            return;
          }
          
          // Preencher o formulário de edição
          renderEditForm(form, productId, product);
        });
      })
      .catch(error => {
        console.error('Erro ao carregar detalhes do produto:', error);
        form.innerHTML = '<p class="error">Erro ao carregar detalhes do produto. Tente novamente mais tarde.</p>';
      });
  }
  
  // Função para renderizar o formulário de edição
  function renderEditForm(form, productId, product) {
    // Restaurar o HTML do formulário
    form.innerHTML = `
      <div class="form-group">
        <label for="title">Título do Anúncio *</label>
        <input type="text" id="title" name="title" required>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label for="brand">Marca *</label>
          <input type="text" id="brand" name="brand" required>
        </div>
        
        <div class="form-group">
          <label for="model">Modelo *</label>
          <input type="text" id="model" name="model" required>
        </div>
      </div>
      
      <div class="form-group">
        <label for="description">Descrição *</label>
        <textarea id="description" name="description" rows="5" required></textarea>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label for="category">Categoria *</label>
          <select id="category" name="category" required>
            <option value="">Selecione uma categoria</option>
            <option value="camisas">Camisas</option>
            <option value="calcas">Calças</option>
            <option value="calcados">Calçados</option>
            <option value="acessorios">Acessórios</option>
            <option value="outros">Outros</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="size">Tamanho *</label>
          <select id="size" name="size" required>
            <option value="">Selecione um tamanho</option>
            <option value="PP">PP</option>
            <option value="P">P</option>
            <option value="M">M</option>
            <option value="G">G</option>
            <option value="GG">GG</option>
            <option value="XGG">XGG</option>
            <option value="36">36</option>
            <option value="37">37</option>
            <option value="38">38</option>
            <option value="39">39</option>
            <option value="40">40</option>
            <option value="41">41</option>
            <option value="42">42</option>
            <option value="43">43</option>
            <option value="44">44</option>
            <option value="45">45</option>
            <option value="46">46</option>
            <option value="unico">Tamanho Único</option>
          </select>
        </div>
      </div>
      
      <div class="form-row">
        <div class<div class="form-group">
        <label for="condition">Estado *</label>
        <select id="condition" name="condition" required>
          <option value="">Selecione um estado</option>
          <option value="novo">Novo</option>
          <option value="usado">Usado</option>
        </select>
      </div>
    </div>
    
    <div class="form-group">
      <label>Tipo de Venda</label>
      <div class="radio-group">
        <input type="radio" id="sell" name="tradeOption" value="false" checked>
        <label for="sell">Vender</label>
        
        <input type="radio" id="trade" name="tradeOption" value="true">
        <label for="trade">Trocar</label>
      </div>
    </div>
    
    <div class="form-row price-section">
      <div class="form-group">
        <label for="price">Preço (R$) *</label>
        <input type="number" id="price" name="price" min="0" step="0.01" required>
      </div>
      
      <div class="form-group trade-for-group hidden">
        <label for="tradeFor">Trocar Por (modelos de interesse)</label>
        <input type="text" id="tradeFor" name="tradeFor">
      </div>
    </div>
    
    <div class="form-group">
      <label for="location">Localização *</label>
      <input type="text" id="location" name="location" required>
    </div>
    
    <div class="form-group">
      <label>Imagens Atuais</label>
      <div class="current-images-preview"></div>
    </div>
    
    <div class="form-group">
      <label for="images">Adicionar Novas Imagens</label>
      <input type="file" id="images" name="images" multiple accept="image/*">
      <div class="new-images-preview"></div>
    </div>
    
    <div class="form-group product-status">
      <label>Status do Anúncio</label>
      <div class="radio-group">
        <input type="radio" id="active" name="status" value="active" checked>
        <label for="active">Ativo</label>
        
        <input type="radio" id="inactive" name="status" value="inactive">
        <label for="inactive">Inativo</label>
      </div>
    </div>
    
    <div class="form-actions">
      <button type="submit" class="btn btn-primary">Salvar Alterações</button>
      <a href="my-products.html" class="btn btn-outline">Cancelar</a>
    </div>
  `;
  
  // Preencher o formulário com os dados do produto
  form.querySelector('#title').value = product.title || '';
  form.querySelector('#brand').value = product.brand || '';
  form.querySelector('#model').value = product.model || '';
  form.querySelector('#description').value = product.description || '';
  form.querySelector('#category').value = product.category || '';
  form.querySelector('#size').value = product.size || '';
  form.querySelector('#condition').value = product.condition || '';
  form.querySelector('#price').value = product.price || 0;
  form.querySelector('#location').value = product.location || '';
  form.querySelector('#tradeFor').value = product.tradeFor || '';
  
  // Definir o tipo de venda (venda ou troca)
  if (product.tradeOption) {
    form.querySelector('#trade').checked = true;
    form.querySelector('.price-section').classList.add('hidden');
    form.querySelector('.trade-for-group').classList.remove('hidden');
  } else {
    form.querySelector('#sell').checked = true;
    form.querySelector('.price-section').classList.remove('hidden');
    form.querySelector('.trade-for-group').classList.add('hidden');
  }
  
  // Definir o status do produto
  if (product.status === 'inactive') {
    form.querySelector('#inactive').checked = true;
  } else {
    form.querySelector('#active').checked = true;
  }
  
  // Mostrar imagens atuais
  const currentImagesPreview = form.querySelector('.current-images-preview');
  if (product.images && product.images.length > 0) {
    product.images.forEach((imageUrl, index) => {
      const imageContainer = document.createElement('div');
      imageContainer.className = 'image-preview-item';
      imageContainer.innerHTML = `
        <img src="${imageUrl}" alt="Imagem ${index + 1}">
        <button type="button" class="btn-remove-image" data-index="${index}">×</button>
        <input type="hidden" name="existingImages[]" value="${imageUrl}">
      `;
      currentImagesPreview.appendChild(imageContainer);
    });
    
    // Adicionar eventos para remoção de imagens existentes
    const removeButtons = currentImagesPreview.querySelectorAll('.btn-remove-image');
    removeButtons.forEach(button => {
      button.addEventListener('click', () => {
        button.parentElement.remove();
      });
    });
  } else {
    currentImagesPreview.innerHTML = '<p>Nenhuma imagem disponível.</p>';
  }
  
  // Adicionar preview para novas imagens
  const imagesInput = form.querySelector('#images');
  const newImagesPreview = form.querySelector('.new-images-preview');
  
  imagesInput.addEventListener('change', () => {
    newImagesPreview.innerHTML = '';
    
    if (imagesInput.files.length > 0) {
      for (let i = 0; i < imagesInput.files.length; i++) {
        const file = imagesInput.files[i];
        const reader = new FileReader();
        
        reader.onload = (e) => {
          const imageContainer = document.createElement('div');
          imageContainer.className = 'image-preview-item';
          imageContainer.innerHTML = `
            <img src="${e.target.result}" alt="Nova imagem ${i + 1}">
          `;
          newImagesPreview.appendChild(imageContainer);
        };
        
        reader.readAsDataURL(file);
      }
    }
  });
  
  // Adicionar eventos para mostrar/esconder campos de preço/troca
  const sellOption = form.querySelector('#sell');
  const tradeOption = form.querySelector('#trade');
  const priceSection = form.querySelector('.price-section');
  const tradeForGroup = form.querySelector('.trade-for-group');
  
  sellOption.addEventListener('change', () => {
    if (sellOption.checked) {
      priceSection.classList.remove('hidden');
      tradeForGroup.classList.add('hidden');
    }
  });
  
  tradeOption.addEventListener('change', () => {
    if (tradeOption.checked) {
      priceSection.classList.add('hidden');
      tradeForGroup.classList.remove('hidden');
    }
  });
  
  // Adicionar evento de envio do formulário
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Coletar dados do formulário
    const formData = new FormData(form);
    
    // Verificar se existem imagens
    const existingImagesInputs = form.querySelectorAll('input[name="existingImages[]"]');
    const existingImages = Array.from(existingImagesInputs).map(input => input.value);
    
    // Obter novas imagens
    const newImages = formData.getAll('images');
    const hasNewImages = newImages.length > 0 && newImages[0].size > 0;
    
    // Verificar validação de preço para venda
    const tradeOption = formData.get('tradeOption') === 'true';
    const price = parseFloat(formData.get('price'));
    
    if (!tradeOption && (isNaN(price) || price <= 0)) {
      showAlert('O preço deve ser um valor numérico positivo.', 'error');
      return;
    }
    
    // Mostrar indicador de carregamento
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'A salvar...';
    
    // Atualizar produto
    updateProduct(productId, formData, existingImages, hasNewImages)
      .then(() => {
        showAlert('Produto atualizado com sucesso!', 'success');
        setTimeout(() => {
          window.location.href = 'my-products.html';
        }, 1500);
      })
      .catch(error => {
        console.error('Erro ao atualizar produto:', error);
        showAlert(`Erro ao atualizar produto: ${error.message}`, 'error');
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      });
  });
}

// Função para atualizar o produto
async function updateProduct(productId, formData, existingImages, hasNewImages) {
  return new Promise((resolve, reject) => {
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        reject(new Error('Utilizador não autenticado'));
        return;
      }
      
      try {
        // Coletar dados do formulário
        const title = formData.get('title');
        const brand = formData.get('brand');
        const model = formData.get('model');
        const description = formData.get('description');
        const category = formData.get('category');
        const size = formData.get('size');
        const condition = formData.get('condition');
        const tradeOption = formData.get('tradeOption') === 'true';
        const tradeFor = formData.get('tradeFor') || '';
        const price = tradeOption ? 0 : parseFloat(formData.get('price'));
        const location = formData.get('location');
        const status = formData.get('status');
        
        // Verificar se o usuário é o proprietário do produto
        const productRef = db.collection('products').doc(productId);
        const productDoc = await productRef.get();
        
        if (!productDoc.exists || productDoc.data().seller !== user.uid) {
          reject(new Error('Você não tem permissão para editar este produto'));
          return;
        }
        
        // Atualizar imagens se necessário
        let imageUrls = existingImages;
        
        if (hasNewImages) {
          const newImageUrls = await uploadProductImages(formData.getAll('images'), user.uid);
          imageUrls = [...existingImages, ...newImageUrls];
        }
        
        // Atualizar produto no Firestore
        await productRef.update({
          title,
          brand,
          model,
          description,
          category,
          size,
          condition,
          price,
          tradeOption,
          tradeFor,
          location,
          status,
          images: imageUrls,
          updatedAt: new Date()
        });
        
        resolve();
      } catch (error) {
        console.error('Erro ao atualizar produto:', error);
        reject(error);
      }
    });
  });
}

// Função para carregar produtos favoritos do utilizador
function loadUserFavorites(userId, container) {
  if (!container) return;
  
  container.innerHTML = '<div class="loading">A carregar os seus favoritos...</div>';
  
  // Buscar lista de favoritos do utilizador
  db.collection('users').doc(userId).get()
    .then(doc => {
      if (!doc.exists || !doc.data().favorites || doc.data().favorites.length === 0) {
        container.innerHTML = '<p class="no-products">Você ainda não adicionou produtos aos favoritos.</p>';
        return;
      }
      
      const favorites = doc.data().favorites;
      
      // Buscar detalhes de cada produto favorito
      const promises = favorites.map(productId => 
        db.collection('products').doc(productId).get()
      );
      
      Promise.all(promises)
        .then(results => {
          container.innerHTML = '';
          
          const validProducts = results.filter(doc => doc.exists && doc.data().status === 'active');
          
          if (validProducts.length === 0) {
            container.innerHTML = '<p class="no-products">Você ainda não adicionou produtos aos favoritos.</p>';
            return;
          }
          
          validProducts.forEach(doc => {
            const product = doc.data();
            const productCard = createProductCard(doc.id, product);
            container.appendChild(productCard);
          });
        });
    })
    .catch(error => {
      console.error('Erro ao carregar favoritos:', error);
      container.innerHTML = '<p class="error">Erro ao carregar os seus favoritos. Tente novamente mais tarde.</p>';
    });
}

// Função para mostrar alertas
function showAlert(message, type = 'info') {
  const alertsContainer = document.querySelector('.alerts-container') || document.createElement('div');
  
  if (!document.querySelector('.alerts-container')) {
    alertsContainer.className = 'alerts-container';
    document.body.appendChild(alertsContainer);
  }
  
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  
  alertsContainer.appendChild(alert);
  
  // Auto-fechar após alguns segundos
  setTimeout(() => {
    alert.classList.add('fade-out');
    setTimeout(() => {
      alert.remove();
    }, 500);
  }, 3000);
}

// Inicializar funções de acordo com a página atual
document.addEventListener('DOMContentLoaded', () => {
  // Verificar se o Firebase está inicializado
  if (typeof db === 'undefined' || typeof auth === 'undefined' || typeof storage === 'undefined') {
    console.error('Firebase não inicializado. Verifique se os scripts de inicialização foram carregados.');
    return;
  }
  
  // Identificar a página atual pela URL ou algum elemento específico
  const path = window.location.pathname;
  
  // Página inicial
  if (path.includes('index.html') || path === '/' || path.endsWith('/')) {
    loadFeaturedProducts();
  }
  
  // Página de exploração de produtos
  if (path.includes('explore.html')) {
    // Inicializar com filtros vazios
    loadAllProducts();
    
    // Configurar filtros
    const filterForm = document.getElementById('filter-form');
    if (filterForm) {
      filterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = new FormData(filterForm);
        const filters = {
          category: formData.get('category'),
          condition: formData.get('condition'),
          size: formData.get('size'),
          minPrice: formData.get('minPrice'),
          maxPrice: formData.get('maxPrice'),
          sort: formData.get('sort')
        };
        
        loadAllProducts(filters);
      });
    }
  }
  
  // Página de detalhe do produto
  if (path.includes('product.html')) {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');
    
    if (productId) {
      loadProductDetails(productId);
    } else {
      // Redirecionar para a página de exploração se não houver ID
      window.location.href = 'explore.html';
    }
  }
  
  // Página de edição de produto
  if (path.includes('edit-product.html')) {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('id');
    
    if (productId) {
      loadProductForEdit(productId);
    } else {
      // Redirecionar para a página de exploração se não houver ID
      window.location.href = 'my-products.html';
    }
  }
  
  // Página de produtos do utilizador
  if (path.includes('my-products.html')) {
    auth.onAuthStateChanged(user => {
      if (user) {
        const productsContainer = document.querySelector('.user-products');
        if (productsContainer) {
          loadUserProducts(user.uid, productsContainer);
        }
      } else {
        window.location.href = 'login.html?redirect=my-products.html';
      }
    });
  }
  
  // Página de favoritos
  if (path.includes('favorites.html')) {
    auth.onAuthStateChanged(user => {
      if (user) {
        const favoritesContainer = document.querySelector('.favorites-container');
        if (favoritesContainer) {
          loadUserFavorites(user.uid, favoritesContainer);
        }
      } else {
        window.location.href = 'login.html?redirect=favorites.html';
      }
    });
  }
  
  // Formulário de criação de novo produto
  const newProductForm = document.getElementById('new-product-form');
  if (newProductForm) {
    // Mostrar/esconder campos de preço/troca
    const sellOption = newProductForm.querySelector('#sell');
    const tradeOption = newProductForm.querySelector('#trade');
    const priceSection = newProductForm.querySelector('.price-section');
    const tradeForGroup = newProductForm.querySelector('.trade-for-group');
    
    if (sellOption && tradeOption && priceSection && tradeForGroup) {
      sellOption.addEventListener('change', () => {
        if (sellOption.checked) {
          priceSection.classList.remove('hidden');
          tradeForGroup.classList.add('hidden');
        }
      });
      
      tradeOption.addEventListener('change', () => {
        if (tradeOption.checked) {
          priceSection.classList.add('hidden');
          tradeForGroup.classList.remove('hidden');
        }
      });
    }
    
    // Previsualização de imagens
    const imagesInput = newProductForm.querySelector('#images');
    const imagesPreview = newProductForm.querySelector('.images-preview');
    
    if (imagesInput && imagesPreview) {
      imagesInput.addEventListener('change', () => {
        imagesPreview.innerHTML = '';
        
        if (imagesInput.files.length > 0) {
          for (let i = 0; i < imagesInput.files.length; i++) {
            const file = imagesInput.files[i];
            const reader = new FileReader();
            
            reader.onload = (e) => {
              const imageContainer = document.createElement('div');
              imageContainer.className = 'image-preview-item';
              imageContainer.innerHTML = `
                <img src="${e.target.result}" alt="Nova imagem ${i + 1}">
              `;
              imagesPreview.appendChild(imageContainer);
            };
            
            reader.readAsDataURL(file);
          }
        }
      });
    }
    
    // Submissão do formulário
    newProductForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const formData = new FormData(newProductForm);
      
      // Verificar validação de preço para venda
      const tradeOption = formData.get('tradeOption') === 'true';
      const price = parseFloat(formData.get('price'));
      
      if (!tradeOption && (isNaN(price) || price <= 0)) {
        showAlert('O preço deve ser um valor numérico positivo.', 'error');
        return;
      }
      
      // Verificar se há imagens
      const images = formData.getAll('images');
      if (images.length === 0 || images[0].size === 0) {
        showAlert('Adicione pelo menos uma imagem do produto.', 'error');
        return;
      }
      
      // Mostrar indicador de carregamento
      const submitButton = newProductForm.querySelector('button[type="submit"]');
      const originalButtonText = submitButton.textContent;
      submitButton.disabled = true;
      submitButton.textContent = 'A publicar...';
      
      // Criar novo produto
      createNewProduct(formData)
        .then((productId) => {
          showAlert('Produto publicado com sucesso!', 'success');
          setTimeout(() => {
            window.location.href = `product.html?id=${productId}`;
          }, 1500);
        })
        .catch(error => {
          console.error('Erro ao criar produto:', error);
          showAlert(`Erro ao publicar produto: ${error.message}`, 'error');
          submitButton.disabled = false;
          submitButton.textContent = originalButtonText;
        });
    });
  }
});