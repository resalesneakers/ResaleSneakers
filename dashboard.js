import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { FaBoxOpen, FaComments, FaClipboardList, FaUserCircle, FaBell, FaHome, FaShoppingCart, FaHeadset } from 'react-icons/fa';

const Dashboard = () => {
  const auth = getAuth();
  const db = getFirestore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    recentOrders: [],
    recentMessages: [],
    totalOrders: 0,
    unreadMessages: 0,
    notifications: [],
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const user = auth.currentUser;
        
        if (!user) {
          return;
        }

        // Buscar pedidos recentes
        const ordersQuery = query(
          collection(db, 'orders'),
          where('userId', '==', user.uid),
          limit(5)
        );
        const ordersSnapshot = await getDocs(ordersQuery);
        const ordersData = ordersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate?.() || new Date()
        }));

        // Buscar mensagens recentes
        const messagesQuery = query(
          collection(db, 'messages'),
          where('userId', '==', user.uid),
          limit(5)
        );
        const messagesSnapshot = await getDocs(messagesQuery);
        const messagesData = messagesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.() || new Date()
        }));

        // Buscar notificações
        const notificationsQuery = query(
          collection(db, 'notifications'),
          where('userId', '==', user.uid),
          where('read', '==', false),
          limit(5)
        );
        const notificationsSnapshot = await getDocs(notificationsQuery);
        const notificationsData = notificationsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.() || new Date()
        }));

        setStats({
          recentOrders: ordersData,
          recentMessages: messagesData,
          totalOrders: ordersData.length,
          unreadMessages: messagesData.filter(msg => !msg.read).length,
          notifications: notificationsData,
        });
      } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [auth, db]);

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Painel Principal</h1>
      
      {/* Welcome Card */}
      <div className="bg-gradient-to-r from-primary to-secondary rounded-lg shadow-lg p-6 mb-8 text-white">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Bem-vindo, {auth.currentUser?.displayName || 'Utilizador'}!</h2>
            <p className="mt-2 opacity-90">Aqui está o resumo da sua atividade recente e recursos disponíveis.</p>
          </div>
          <div className="mt-4 md:mt-0">
            <Link to="/profile" className="bg-white text-primary font-medium px-4 py-2 rounded-md hover:bg-gray-100 transition flex items-center">
              <FaUserCircle className="mr-2" /> Ver Perfil
            </Link>
          </div>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-primary bg-opacity-10 text-primary">
              <FaBoxOpen className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500 font-medium">Total de Compras</p>
              <p className="text-2xl font-semibold text-gray-800">{stats.totalOrders}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-secondary bg-opacity-10 text-secondary">
              <FaComments className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500 font-medium">Mensagens não lidas</p>
              <p className="text-2xl font-semibold text-gray-800">{stats.unreadMessages}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-500 bg-opacity-10 text-green-500">
              <FaClipboardList className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500 font-medium">Última atividade</p>
              <p className="text-2xl font-semibold text-gray-800">
                {stats.recentOrders.length > 0 || stats.recentMessages.length > 0 ? 
                  formatDate(new Date(Math.max(
                    ...(stats.recentOrders.length > 0 ? [stats.recentOrders[0].date] : [0]),
                    ...(stats.recentMessages.length > 0 ? [stats.recentMessages[0].timestamp] : [0])
                  ))) :
                  'Nenhuma'
                }
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-red-500 bg-opacity-10 text-red-500">
              <FaBell className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500 font-medium">Notificações</p>
              <p className="text-2xl font-semibold text-gray-800">{stats.notifications.length}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Quick Access Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Link to="/" className="bg-white shadow rounded-lg p-4 flex flex-col items-center text-center hover:shadow-md transition">
          <div className="p-3 rounded-full bg-gray-100 text-primary mb-2">
            <FaHome className="h-6 w-6" />
          </div>
          <span className="text-sm font-medium text-gray-700">Página Inicial</span>
        </Link>
        
        <Link to="/products" className="bg-white shadow rounded-lg p-4 flex flex-col items-center text-center hover:shadow-md transition">
          <div className="p-3 rounded-full bg-gray-100 text-primary mb-2">
            <FaShoppingCart className="h-6 w-6" />
          </div>
          <span className="text-sm font-medium text-gray-700">Produtos</span>
        </Link>
        
        <Link to="/chat" className="bg-white shadow rounded-lg p-4 flex flex-col items-center text-center hover:shadow-md transition">
          <div className="p-3 rounded-full bg-gray-100 text-primary mb-2">
            <FaHeadset className="h-6 w-6" />
          </div>
          <span className="text-sm font-medium text-gray-700">Suporte</span>
        </Link>
        
        <Link to="/profile" className="bg-white shadow rounded-lg p-4 flex flex-col items-center text-center hover:shadow-md transition">
          <div className="p-3 rounded-full bg-gray-100 text-primary mb-2">
            <FaUserCircle className="h-6 w-6" />
          </div>
          <span className="text-sm font-medium text-gray-700">Perfil</span>
        </Link>
      </div>
      
      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-primary px-4 py-3 text-white">
            <h3 className="font-semibold">Pedidos Recentes</h3>
          </div>
          <div className="p-4">
            {stats.recentOrders.length > 0 ? (
              <ul className="divide-y divide-gray-200">
                {stats.recentOrders.map(order => (
                  <li key={order.id} className="py-3">
                    <div className="flex justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-800">Pedido #{order.id.substring(0, 8)}</p>
                        <p className="text-xs text-gray-500">{formatDate(order.date)}</p>
                      </div>
                      <div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          order.status === 'completed' ? 'bg-green-100 text-green-800' :
                          order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {order.status === 'completed' ? 'Concluído' :
                           order.status === 'processing' ? 'Em Processamento' :
                           'Pendente'}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Não existem pedidos recentes</p>
            )}
            
            <div className="mt-4 text-center">
              <Link to="/orders" className="text-sm font-medium text-primary hover:text-primary-dark">
                Ver todos os pedidos →
              </Link>
            </div>
          </div>
        </div>
        
        {/* Recent Messages */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-secondary px-4 py-3 text-white">
            <h3 className="font-semibold">Mensagens Recentes</h3>
          </div>
          <div className="p-4">
            {stats.recentMessages.length > 0 ? (
              <ul className="divide-y divide-gray-200">
                {stats.recentMessages.map(message => (
                  <li key={message.id} className="py-3">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-500 font-medium">
                            {message.sender?.charAt(0) || 'S'}
                          </span>
                        </div>
                      </div>
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-gray-800">
                          {message.sender || 'Suporte'}
                          {!message.read && (
                            <span className="ml-2 inline-block w-2 h-2 bg-red-500 rounded-full"></span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{message.text}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDate(message.timestamp)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">Não existem mensagens recentes</p>
            )}
            
            <div className="mt-4 text-center">
              <Link to="/chat" className="text-sm font-medium text-secondary hover:text-secondary-dark">
                Ver todas as mensagens →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;