// Adicione esta linha no TOPO ABSOLUTO do arquivo
import 'react-native-gesture-handler'; 

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert, Platform, Modal, ActivityIndicator, ScrollView, TouchableWithoutFeedback, Animated, Dimensions } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';

// IMPORTAÇÃO DO BANCO DE DADOS
import { supabase } from './src/services/supabase';

// ESTADO GLOBAL
import { create } from 'zustand'; 

if (Platform.OS === 'web') {
  const style = document.createElement('style');
  style.textContent = `
    input::-ms-reveal,
    input::-ms-clear {
      display: none;
    }
    input::-webkit-credentials-auto-fill-button {
      visibility: hidden;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
}

// ----------------------
// STATE (Zustand)
// ----------------------
const useStore = create((set) => ({
  isLoggedIn: false,
  setAuthState: (status) => set({ isLoggedIn: status }),
  isFetchingLojas: true,
  setIsFetchingLojas: (status) => set({ isFetchingLojas: status }),
  lojas: [],
  lojaAtiva: null,
  setLojas: (lojas) => set({ lojas }),
  setLojaAtiva: (loja) => set({ lojaAtiva: loja }),

  products: [],
  setProducts: (products) => set({ products }),
  addProduct: (product) => set((state) => ({ products: [...state.products, product] })),
  updateStock: (id, qty) => set((state) => ({
    products: state.products.map(p => p.id === id ? { ...p, estoque: p.estoque + qty } : p)
  }))
}));

// ----------------------
// SCREENS
// ----------------------

const LoginScreen = ({ navigation }) => { 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // NOVO: Estado unificado para a notificação
  const [notification, setNotification] = useState({ visible: false, message: '', type: 'success' });

  // NOVO: Função para exibir o banner
  const showBanner = (message, type) => {
    setNotification({ visible: true, message, type });
    setTimeout(() => {
      setNotification({ visible: false, message: '', type: 'success' });
    }, 3000);
  };

  const handleLogin = async () => {
    // Validação de campos vazios
    if (!email || !password) {
      showBanner("Preencha e-mail e senha.", "error");
      return;
    }

    setLoading(true);
    
    // Tentativa de login no Supabase
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      let errorMessage = error.message;
      
      // Traduzindo os erros mais comuns de login para português
      if (errorMessage.includes("Invalid login credentials")) {
        errorMessage = "E-mail ou senha incorretos.";
      } else if (errorMessage.toLowerCase().includes("invalid email")) {
        errorMessage = "Formato de e-mail inválido.";
      } else if (errorMessage.includes("Email not confirmed")) {
         errorMessage = "Por favor, confirme seu e-mail antes de entrar.";
      }

      showBanner(errorMessage, "error");
      setLoading(false);
      return; // Para a execução aqui se der erro
    }
    
    // Se der sucesso, não precisamos de banner porque o app 
    // vai pular para o Dashboard instantaneamente!
    setLoading(false);
  };

  return (
    <View style={styles.loginContainer}>
      
      {/* NOVO: Notificação Dinâmica (Fundo 50% opacidade e Texto Escuro) */}
      {notification.visible && (
        <View style={[
          styles.topNotification, 
          { backgroundColor: notification.type === 'error' ? 'rgba(244, 67, 54, 0.5)' : 'rgba(76, 175, 80, 0.5)' }
        ]}>
          <Text style={[
            styles.topNotificationText,
            { color: notification.type === 'error' ? '#7f1d1d' : '#14532d' }
          ]}>
            {notification.message}
          </Text>
        </View>
      )}

      <Text style={styles.logoText}>STOCKLY</Text>

      <TextInput 
        placeholder="E-mail" 
        placeholderTextColor="#999"
        style={styles.input} 
        onChangeText={setEmail} 
        value={email}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      
      <View style={styles.passwordContainer}>
        <TextInput 
          placeholder="Senha" 
          placeholderTextColor="#999"
          style={styles.passwordInput} 
          onChangeText={setPassword} 
          value={password}
          secureTextEntry={!showPassword} 
        />
        <TouchableOpacity 
          style={styles.eyeIcon} 
          onPress={() => setShowPassword(!showPassword)}
        >
          <Ionicons name={showPassword ? "eye-off" : "eye"} size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} disabled={loading}>
        <Text style={styles.primaryButtonText}>{loading ? "Entrando..." : "Login"}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('SignUp')} disabled={loading}>
        <Text style={styles.secondaryButtonText}>Cadastrar-se</Text>
      </TouchableOpacity>
    </View>
  );
};

const SignUpScreen = ({ navigation }) => {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmaSenha, setShowConfirmaSenha] = useState(false);
  
  // NOVO: Estado unificado para controlar todas as notificações (Sucesso e Erro)
  const [notification, setNotification] = useState({ visible: false, message: '', type: 'success' });

  // Função auxiliar para exibir o banner e escondê-lo automaticamente
  const showBanner = (message, type) => {
    setNotification({ visible: true, message, type });
    // Esconde a notificação após 3 segundos
    setTimeout(() => {
      setNotification({ visible: false, message: '', type: 'success' });
    }, 3000);
  };

  const handleCadastro = async () => {
    // 1. Validação de campos vazios
    if (!nome || !email || !senha) {
      showBanner("Preencha todos os campos.", "error");
      return;
    }

    // 2. Validação RÁPIDA de formato de e-mail (Não gasta requisição do Supabase!)
    // Verifica se tem texto, uma "@", mais texto, um "." e mais texto no final
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showBanner("Email inválido.", "error");
      return;
    }
    
    // 3. Validação de senhas iguais
    if (senha !== confirmaSenha) {
      showBanner("As senhas não coincidem.", "error");
      return;
    }
    
    setLoading(true);
    
    // 4. Envio para o Supabase
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: senha,
    });
    
    // 5. Tratamento de erros que vierem do banco
    if (error) {
      let errorMessage = error.message;
      
      // Traduzindo os erros para português (usando toLowerCase para ser mais flexível)
      if (errorMessage.includes("Password should be at least 6 characters")) {
        errorMessage = "A senha deve ter no mínimo 6 caracteres.";
      } else if (errorMessage.includes("User already registered")) {
        errorMessage = "Este e-mail já está cadastrado no sistema.";
      } else if (errorMessage.toLowerCase().includes("invalid email") || errorMessage.toLowerCase().includes("format")) {
        errorMessage = "Email inválido.";
      }

      showBanner(errorMessage, "error");
      setLoading(false);
      return;
    }
    
    // 6. Sucesso (Cria o perfil e redireciona)
    if (data.user) {
      const { error: profileError } = await supabase
        .from('perfis')
        .insert([{ id: data.user.id, nome: nome }]);
      if (profileError) console.log("Erro ao salvar perfil:", profileError);
    }
    
    setLoading(false);
    showBanner("Conta criada com sucesso!", "success");
    
    // Aguarda 2 segundos e manda pro login
    setTimeout(() => {
      navigation.navigate('Login');
    }, 2000); 
  };

  return (
    <View style={styles.loginContainer}>
      
      {/* NOVO: Notificação Dinâmica (Fundo 50% e Texto Escuro) */}
      {notification.visible && (
        <View style={[
          styles.topNotification, 
          { backgroundColor: notification.type === 'error' ? 'rgba(244, 67, 54, 0.5)' : 'rgba(76, 175, 80, 0.5)' }
        ]}>
          <Text style={[
            styles.topNotificationText,
            // NOVO: Cor da letra dinâmica e escura para dar contraste
            { color: notification.type === 'error' ? '#7f1d1d' : '#14532d' }
          ]}>
            {notification.message}
          </Text>
        </View>
      )}

      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={28} color="#333" />
      </TouchableOpacity>

      <Text style={styles.logoText}>CRIAR CONTA</Text>

      <TextInput placeholder="Nome" placeholderTextColor="#999" style={styles.input} onChangeText={setNome} value={nome} />
      <TextInput placeholder="E-mail" placeholderTextColor="#999" style={styles.input} onChangeText={setEmail} value={email} keyboardType="email-address" autoCapitalize="none" />
      
      <View style={styles.passwordContainer}>
        <TextInput 
          placeholder="Senha" 
          placeholderTextColor="#999"
          style={styles.passwordInput} 
          onChangeText={setSenha} 
          value={senha} 
          secureTextEntry={!showSenha} 
        />
        <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowSenha(!showSenha)}>
          <Ionicons name={showSenha ? "eye-off" : "eye"} size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.passwordContainer}>
        <TextInput 
          placeholder="Confirmar Senha" 
          placeholderTextColor="#999"
          style={styles.passwordInput} 
          onChangeText={setConfirmaSenha} 
          value={confirmaSenha} 
          secureTextEntry={!showConfirmaSenha} 
        />
        <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowConfirmaSenha(!showConfirmaSenha)}>
          <Ionicons name={showConfirmaSenha ? "eye-off" : "eye"} size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleCadastro} disabled={loading}>
        <Text style={styles.primaryButtonText}>{loading ? "Aguarde..." : "Cadastrar"}</Text>
      </TouchableOpacity>
    </View>
  );
};

const EmptyScreen = () => {
  const lojaAtiva = useStore(state => state.lojaAtiva);
  const isFetchingLojas = useStore(state => state.isFetchingLojas);
  
  const products = useStore(state => state.products);
  const setProducts = useStore(state => state.setProducts);
  const addProduct = useStore(state => state.addProduct);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // --- NOVOS ESTADOS PARA PESQUISA E FILTRO ---
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('alpha-asc'); // Ordenação padrão: A-Z
  const [modalSortVisible, setModalSortVisible] = useState(false);

  // Estados do Formulário
  const [modalVisible, setModalVisible] = useState(false);
  const [nome, setNome] = useState('');
  const [sku, setSku] = useState('');
  const [precoCusto, setPrecoCusto] = useState('');
  const [precoVenda, setPrecoVenda] = useState('');
  const [estoqueAtual, setEstoqueAtual] = useState('');
  const [estoqueMinimo, setEstoqueMinimo] = useState('');
  const [loading, setLoading] = useState(false);

  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const SEARCH_BAR_HEIGHT = 65; // Altura total da barra (48 + paddings)
  const scrollYClamped = Animated.diffClamp(scrollY, 0, SEARCH_BAR_HEIGHT);
  const searchBarTranslateY = scrollYClamped.interpolate({
    inputRange: [0, SEARCH_BAR_HEIGHT],
    outputRange: [0, -SEARCH_BAR_HEIGHT], // Empurra a barra para cima
  });

  const [produtoEditando, setProdutoEditando] = useState(null);
  const [modalApagarProdutoVisible, setModalApagarProdutoVisible] = useState(false);

  // --- LÓGICA DE FILTRAGEM E ORDENAÇÃO INSTANTÂNEA ---
  const getProcessedProducts = () => {
    // 1. Primeiro filtramos pelo que foi digitado (Pesquisa por Nome ou SKU)
    let filtered = products.filter(p => {
      const term = searchQuery.toLowerCase();
      const nomeMatch = p.nome.toLowerCase().includes(term);
      const skuMatch = p.sku_barcode && p.sku_barcode.toLowerCase().includes(term);
      return nomeMatch || skuMatch;
    });

    // 2. Depois ordenamos a lista filtrada com base na opção selecionada
    return filtered.sort((a, b) => {
      switch (sortOption) {
        case 'qty-desc': return b.estoque_atual - a.estoque_atual;
        case 'qty-asc': return a.estoque_atual - b.estoque_atual;
        case 'price-desc': return b.preco_venda - a.preco_venda;
        case 'price-asc': return a.preco_venda - b.preco_venda;
        case 'time-new': return a.id > b.id ? -1 : 1; // Mais novo primeiro
        case 'time-old': return a.id < b.id ? -1 : 1; // Mais antigo primeiro
        case 'alpha-desc': return b.nome.localeCompare(a.nome);
        case 'alpha-asc': 
        default: return a.nome.localeCompare(b.nome);
      }
    });
  };

  const processedProducts = getProcessedProducts(); // Lista final que vai para a tela

  // Opções do Modal de Filtro
  const sortOptionsList = [
    { id: 'alpha-asc', label: 'Ordem alfabética (A-Z)' },
    { id: 'alpha-desc', label: 'Ordem alfabética (Z-A)' },
    { id: 'qty-desc', label: 'Quantidade (Maior p/ menor)' },
    { id: 'qty-asc', label: 'Quantidade (Menor p/ maior)' },
    { id: 'price-desc', label: 'Preço (Maior p/ menor)' },
    { id: 'price-asc', label: 'Preço (Menor p/ maior)' },
    { id: 'time-new', label: 'Mais recentes' },
    { id: 'time-old', label: 'Mais antigos' },
  ];

  const abrirModalNovo = () => {
    setProdutoEditando(null); 
    setNome(''); setSku(''); setPrecoCusto(''); setPrecoVenda(''); setEstoqueAtual(''); setEstoqueMinimo('');
    abrirModal();
  };

  const abrirModalEdicao = (produto) => {
    setProdutoEditando(produto); 
    setNome(produto.nome);
    setSku(produto.sku_barcode && produto.sku_barcode.startsWith('INT-') ? '' : produto.sku_barcode);
    setPrecoCusto(Number(produto.preco_custo).toFixed(2).replace('.', ','));
    setPrecoVenda(Number(produto.preco_venda).toFixed(2).replace('.', ','));
    setEstoqueAtual(produto.estoque_atual.toString());
    setEstoqueMinimo(produto.estoque_minimo ? produto.estoque_minimo.toString() : '');
    abrirModal();
  };

  const abrirModal = () => {
    setModalVisible(true);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0.5, duration: 300, useNativeDriver: true })
    ]).start();
  };

  const fecharModal = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: Dimensions.get('window').height, duration: 300, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true })
    ]).start(() => setModalVisible(false));
  };

  useEffect(() => {
    if (lojaAtiva) {
      const carregarProdutos = async () => {
        setLoadingProducts(true);
        const { data, error } = await supabase
          .from('produtos')
          .select('*')
          .eq('loja_id', lojaAtiva.id)
          .order('nome', { ascending: true }); // Apenas o fetch base

        if (data) setProducts(data);
        setLoadingProducts(false);
      };
      carregarProdutos();
    }
  }, [lojaAtiva]);

  const handleSalvarProduto = async () => {
    if (!nome || !precoCusto || !precoVenda || !estoqueAtual) {
      Alert.alert("Atenção", "Preencha os campos obrigatórios (*).");
      return;
    }
    setLoading(true);
    try {
      const custoNum = parseFloat(precoCusto.replace(',', '.'));
      const vendaNum = parseFloat(precoVenda.replace(',', '.'));
      const atualNum = parseInt(estoqueAtual, 10);
      const minNum = estoqueMinimo ? parseInt(estoqueMinimo, 10) : 5;
      const skuFinal = sku.trim() === '' ? `INT-${Date.now()}` : sku.trim();

      if (produtoEditando) {
        const { data, error } = await supabase.from('produtos').update({
            nome: nome, sku_barcode: skuFinal, preco_custo: custoNum, preco_venda: vendaNum, estoque_atual: atualNum, estoque_minimo: minNum
          }).eq('id', produtoEditando.id).select().single();
        if (error) throw error;
        setProducts(products.map(p => p.id === produtoEditando.id ? data : p));
      } else {
        const { data, error } = await supabase.from('produtos').insert([{
            loja_id: lojaAtiva.id, nome: nome, sku_barcode: skuFinal, preco_custo: custoNum, preco_venda: vendaNum, estoque_atual: atualNum, estoque_minimo: minNum
          }]).select().single();
        if (error) throw error;
        addProduct(data);
      }
      fecharModal();
    } catch (error) {
      Alert.alert("Erro ao salvar", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApagarProduto = () => setModalApagarProdutoVisible(true);

  const confirmarApagarProduto = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.from('produtos').delete().eq('id', produtoEditando.id);
      if (error) throw error;
      setProducts(products.filter(p => p.id !== produtoEditando.id));
      setModalApagarProdutoVisible(false);
      fecharModal(); 
    } catch (error) {
      Alert.alert("Erro ao apagar", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAjusteEstoque = async (produto, mudanca) => {
    const novoEstoque = produto.estoque_atual + mudanca;
    if (novoEstoque < 0) return; 
    setProducts(products.map(p => p.id === produto.id ? { ...p, estoque_atual: novoEstoque } : p));
    try {
      const { error } = await supabase.from('produtos').update({ estoque_atual: novoEstoque }).eq('id', produto.id);
      if (error) throw error;
    } catch (error) {
      setProducts(products.map(p => p.id === produto.id ? { ...p, estoque_atual: produto.estoque_atual } : p));
      Alert.alert("Erro", "Não foi possível sincronizar o estoque.");
    }
  };

  if (isFetchingLojas) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}><ActivityIndicator size="large" color="#007AFF" /></View>;
  }

  if (lojaAtiva) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f5f5f5', overflow: 'hidden' }}>
        
        {/* --- NOVA BARRA DE PESQUISA E BOTÃO DE FILTRO --- */}
        <Animated.View style={{ 
          position: 'absolute', 
          top: 0, left: 0, right: 0, 
          zIndex: 10,       // <-- Garante que fique na frente na Web/iOS
          elevation: 10,    // <-- Garante que vença a sombra dos produtos no Android
          backgroundColor: 'transparent', 
          transform: [{ translateY: searchBarTranslateY }],
          flexDirection: 'row', alignItems: 'center', 
          paddingHorizontal: 15, 
          paddingTop: 16,       // <-- 16px em cima
          paddingBottom: 16     // <-- 16px embaixo para centralizar perfeitamente
        }}>
          
          <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 8, alignItems: 'center', paddingHorizontal: 10, height: 48 }}>
            <Ionicons name="search" size={20} color="#64748b" />
            <TextInput 
              placeholder="Pesquisar produto ou SKU..." 
              placeholderTextColor="#94a3b8"
              value={searchQuery} 
              onChangeText={setSearchQuery} 
              style={{ flex: 1, paddingLeft: 10, color: '#333', height: '100%' }} 
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity 
            style={{ marginLeft: 10, backgroundColor: '#007AFF', width: 48, height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center' }} 
            onPress={() => setModalSortVisible(true)}
          >
            <Ionicons name="filter" size={22} color="#fff" />
          </TouchableOpacity>
          
        </Animated.View>

        <View style={{ flex: 1 }}>
          {loadingProducts ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          ) : products.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
              <Ionicons name="storefront-outline" size={64} color="#007AFF" />
              <Text style={{ marginTop: 20, fontSize: 18, color: '#333', textAlign: 'center', fontWeight: 'bold' }}>Seu estoque está pronto!</Text>
              <Text style={{ marginTop: 10, fontSize: 16, color: '#666', textAlign: 'center' }}>Adicione produtos para visualizá-los aqui.</Text>
            </View>
          ) : processedProducts.length === 0 ? (
            // Mensagem caso a pesquisa não encontre nada
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
              <Ionicons name="search-outline" size={48} color="#ccc" />
              <Text style={{ marginTop: 10, fontSize: 16, color: '#999', textAlign: 'center' }}>Nenhum produto encontrado para "{searchQuery}".</Text>
            </View>
          ) : (
            <Animated.FlatList
              data={processedProducts}
              keyExtractor={(item) => item.id.toString()}
              scrollEventThrottle={16} 
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                { useNativeDriver: true }
              )}
              contentContainerStyle={{ 
                paddingTop: SEARCH_BAR_HEIGHT + 16, 
                paddingHorizontal: 15, 
                paddingBottom: 15 
              }}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  activeOpacity={0.7} 
                  onPress={() => abrirModalEdicao(item)} 
                  style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}
                >
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>{item.nome}</Text>
                    {item.sku_barcode && !item.sku_barcode.startsWith('INT-') ? <Text style={{ fontSize: 12, color: '#888' }}>SKU: {item.sku_barcode}</Text> : null}
                    <Text style={{ fontSize: 14, color: '#007AFF', marginTop: 5, fontWeight: '500' }}>R$ {Number(item.preco_venda).toFixed(2).replace('.', ',')}</Text>
                  </View>

                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: '#666', marginBottom: 5 }}>Estoque</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 8, padding: 4 }}>
                      <TouchableOpacity onPress={() => handleAjusteEstoque(item, -1)} style={{ width: 32, height: 32, backgroundColor: '#fff', borderRadius: 6, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, elevation: 1 }}>
                        <Ionicons name="remove" size={20} color="#d9534f" />
                      </TouchableOpacity>
                      <Text style={{ fontSize: 18, fontWeight: 'bold', color: item.estoque_atual <= item.estoque_minimo ? '#d9534f' : '#4CAF50', width: 45, textAlign: 'center' }}>{item.estoque_atual}</Text>
                      <TouchableOpacity onPress={() => handleAjusteEstoque(item, 1)} style={{ width: 32, height: 32, backgroundColor: '#fff', borderRadius: 6, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, elevation: 1 }}>
                        <Ionicons name="add" size={20} color="#007AFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>

        {/* MODAL DE ORDENAÇÃO */}
        <Modal visible={modalSortVisible} transparent={true} animationType="fade">
          <TouchableOpacity 
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
            activeOpacity={1}
            onPress={() => setModalSortVisible(false)} // Fecha se clicar fora
          >
            <View style={{ backgroundColor: '#fff', borderRadius: 12, width: '85%', overflow: 'hidden' }}>
              <View style={{ padding: 20, backgroundColor: '#f8f9fa', borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="funnel-outline" size={22} color="#333" style={{ marginRight: 10 }} />
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>Ordenar por</Text>
              </View>
              
              <View style={{ paddingBottom: 10 }}>
                {sortOptionsList.map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 15,
                      paddingHorizontal: 20,
                      borderBottomWidth: 1,
                      borderColor: '#f0f0f0',
                      backgroundColor: sortOption === option.id ? '#e6f2ff' : '#fff'
                    }}
                    onPress={() => {
                      setSortOption(option.id);
                      setModalSortVisible(false);
                    }}
                  >
                    <Text style={{ fontSize: 15, color: sortOption === option.id ? '#007AFF' : '#555', fontWeight: sortOption === option.id ? 'bold' : '500' }}>
                      {option.label}
                    </Text>
                    {sortOption === option.id && <Ionicons name="checkmark" size={20} color="#007AFF" />}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* (MANTEVE O BOTÃO DE ADICIONAR E OS OUTROS MODAIS IGUAIS...) */}
        <View style={{ height: Platform.OS === 'android' ? 90 : 70, paddingBottom: Platform.OS === 'android' ? 20 : 0, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center', flexDirection: 'row' }}>
          <TouchableOpacity style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginTop: -40, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 }} onPress={abrirModalNovo}>
            <Ionicons name="add" size={32} color="#fff" />
          </TouchableOpacity>
        </View>

        <Modal visible={modalVisible} transparent={true} animationType="none">
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <TouchableWithoutFeedback onPress={fecharModal}>
              <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#000', opacity: fadeAnim }} />
            </TouchableWithoutFeedback>
            <Animated.View style={{ width: '100%', backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', transform: [{ translateY: slideAnim }] }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                
                {/* TÍTULO À ESQUERDA */}
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333' }}>
                  {produtoEditando ? "Editar Produto" : "Novo Produto"}
                </Text>
                
                {/* ÍCONES À DIREITA */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  
                  {/* Ícone de Código de Barras (Aparece tanto na criação quanto na edição) */}
                  <TouchableOpacity 
                    onPress={() => Alert.alert("Scanner", "Em breve a câmera abrirá aqui!")} 
                    style={{ padding: 5, marginRight: produtoEditando ? 15 : 0 }}
                  >
                    <Ionicons name="barcode-outline" size={28} color="#007AFF" />
                  </TouchableOpacity>

                  {/* Ícone de Lixeira (Só aparece se estiver editando) */}
                  {produtoEditando && (
                    <TouchableOpacity onPress={handleApagarProduto} style={{ padding: 5 }}>
                      <Ionicons name="trash-outline" size={24} color="#d9534f" />
                    </TouchableOpacity>
                  )}
                  
                </View>

              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <TextInput placeholder="Nome do Produto *" placeholderTextColor="#999" value={nome} onChangeText={setNome} style={styles.input} />
                <TextInput placeholder="Código de Barras / SKU (Opcional)" placeholderTextColor="#999" value={sku} onChangeText={setSku} style={styles.input} keyboardType="numeric" />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <TextInput placeholder="Custo (R$) *" placeholderTextColor="#999" value={precoCusto} onChangeText={setPrecoCusto} style={[styles.input, { width: '48%' }]} keyboardType="numeric" />
                  <TextInput placeholder="Venda (R$) *" placeholderTextColor="#999" value={precoVenda} onChangeText={setPrecoVenda} style={[styles.input, { width: '48%' }]} keyboardType="numeric" />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <TextInput placeholder="Estoque Inicial *" placeholderTextColor="#999" value={estoqueAtual} onChangeText={setEstoqueAtual} style={[styles.input, { width: '48%' }]} keyboardType="numeric" />
                  <TextInput placeholder="Estoque Mín." placeholderTextColor="#999" value={estoqueMinimo} onChangeText={setEstoqueMinimo} style={[styles.input, { width: '48%' }]} keyboardType="numeric" />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingBottom: 20 }}>
                  <TouchableOpacity onPress={fecharModal} style={{ flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 8, marginRight: 10 }} disabled={loading}>
                    <Text style={{ color: '#555', fontWeight: 'bold' }}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSalvarProduto} disabled={loading} style={{ flex: 1, backgroundColor: '#007AFF', paddingVertical: 12, alignItems: 'center', borderRadius: 8 }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>{loading ? "Salvando..." : (produtoEditando ? "Atualizar" : "Salvar")}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </Animated.View>
          </View>
        </Modal>

        <Modal visible={modalApagarProdutoVisible} transparent={true} animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 12, width: '85%', overflow: 'hidden' }}>
              <View style={{ padding: 20, backgroundColor: '#f8f9fa', borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="warning" size={22} color="#d9534f" style={{ marginRight: 10 }} />
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>Apagar Produto?</Text>
              </View>
              <View style={{ padding: 20 }}>
                <Text style={{ fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 20, lineHeight: 22 }}>
                  Tem certeza que deseja apagar <Text style={{ fontWeight: 'bold', color: '#333' }}>{produtoEditando?.nome}</Text>? 
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <TouchableOpacity onPress={() => setModalApagarProdutoVisible(false)} style={{ flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 8, marginRight: 10 }} disabled={loading}>
                    <Text style={{ color: '#555', fontWeight: 'bold' }}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={confirmarApagarProduto} disabled={loading} style={{ flex: 1, backgroundColor: '#d9534f', paddingVertical: 12, alignItems: 'center', borderRadius: 8 }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>{loading ? "Apagando..." : "Sim, apagar"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>

      </View>
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f5f5f5' }}>
      <Ionicons name="folder-open-outline" size={64} color="#ccc" />
      <Text style={{ marginTop: 20, fontSize: 18, color: '#666', textAlign: 'center', fontWeight: 'bold' }}>Nenhum estoque selecionado.</Text>
      <Text style={{ marginTop: 10, fontSize: 14, color: '#999', textAlign: 'center' }}>Abra o menu lateral para criar um novo estoque ou acessar um existente.</Text>
    </View>
  );
};

// ----------------------
// NAVIGATION (MENU LATERAL)
// ----------------------

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

const CustomDrawerContent = (props) => {
  // Estados do Modal de Criar
  const [modalVisible, setModalVisible] = useState(false);
  const [nomeEstoque, setNomeEstoque] = useState('');
  const [loading, setLoading] = useState(false);
  

  // NOVO: Estados para o Menu Flutuante (Opções) e Renomear
  const [estoqueOpcoes, setEstoqueOpcoes] = useState(null); // Guarda qual estoque foi clicado
  const [modalOpcoesVisible, setModalOpcoesVisible] = useState(false);
  const [modalRenomearVisible, setModalRenomearVisible] = useState(false);
  const [modalApagarVisible, setModalApagarVisible] = useState(false);
  const [novoNome, setNovoNome] = useState('');

  // Estados Globais
  const lojas = useStore(state => state.lojas);
  const setLojas = useStore(state => state.setLojas);
  const lojaAtiva = useStore(state => state.lojaAtiva);
  const setLojaAtiva = useStore(state => state.setLojaAtiva);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert("Erro ao sair", error.message);
    else {
      useStore.setState({ lojas: [], lojaAtiva: null, products: [], isFetchingLojas: true });
    }
  };

  const handleCriarEstoque = async () => {
    if (nomeEstoque.trim() === '') {
      Alert.alert("Atenção", "Dê um nome ao seu novo estoque!");
      return;
    }
    if (lojas.length >= 3) {
      Alert.alert("Limite atingido", "Você só pode criar até 3 estoques diferentes.");
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // NOVO: Calcula a próxima ordem (maior ordem atual + 1)
      const proximaOrdem = lojas.length > 0 ? Math.max(...lojas.map(l => l.ordem || 0)) + 1 : 1;

      const { data, error } = await supabase
        .from('lojas')
        .insert([{ nome: nomeEstoque, dono_id: user.id, ordem: proximaOrdem }]) // <--- NOVO: Insere a ordem
        .select()
        .single();
        
      if (error) throw error;

      // NOVO: Adiciona a nova loja e reordena a lista localmente
      const novasLojas = [...lojas, data].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      setLojas(novasLojas);
      setLojaAtiva(data); 

      setModalVisible(false);
      setNomeEstoque('');
      props.navigation.closeDrawer();
    } catch (error) {
      Alert.alert("Erro", error.message);
    } finally {
      setLoading(false);
    }
  };

  // NOVO: Função para Renomear
  const handleRenomear = async () => {
    if (novoNome.trim() === '') return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lojas')
        .update({ nome: novoNome })
        .eq('id', estoqueOpcoes.id)
        .select()
        .single();
        
      if (error) throw error;

      // Atualiza a lista na tela
      const novasLojas = lojas.map(l => l.id === estoqueOpcoes.id ? data : l);
      setLojas(novasLojas);
      
      // Se ele renomeou o estoque que está aberto agora, atualiza o cabeçalho também
      if (lojaAtiva?.id === estoqueOpcoes.id) {
        setLojaAtiva(data);
      }

      setModalRenomearVisible(false);
    } catch (error) {
      Alert.alert("Erro", error.message);
    } finally {
      setLoading(false);
    }
  };

  // NOVO: Função para Apagar (Agora limpa os produtos primeiro!)
  const handleApagar = async () => {
    setLoading(true);
    try {
      // 1. A MÁGICA: Apaga todos os produtos dessa loja primeiro para o Supabase não bloquear!
      await supabase.from('produtos').delete().eq('loja_id', estoqueOpcoes.id);
      
      // 2. Agora sim, apaga a loja tranquilamente
      const { error } = await supabase.from('lojas').delete().eq('id', estoqueOpcoes.id);
      if (error) throw error;

      // 3. Atualiza a lista lateral
      const novasLojas = lojas.filter(l => l.id !== estoqueOpcoes.id);
      setLojas(novasLojas);
      
      // 4. Se a loja apagada era a que estava aberta na tela, joga o usuário para outra loja
      if (lojaAtiva?.id === estoqueOpcoes.id) {
        setLojaAtiva(novasLojas.length > 0 ? novasLojas[0] : null);
      }
      
      setModalApagarVisible(false); // Fecha a janela
    } catch (error) {
      Alert.alert("Erro ao apagar", error.message);
    } finally {
      setLoading(false);
    }
  };

  // NOVO: Função para mover o estoque para cima ou para baixo
  const moverEstoque = async (direcao) => {
    if (!estoqueOpcoes) return;

    // Encontra o índice do estoque atual
    const indexAtual = lojas.findIndex(l => l.id === estoqueOpcoes.id);
    
    // Calcula o índice do alvo com base na direção
    const indexAlvo = direcao === 'cima' ? indexAtual - 1 : indexAtual + 1;

    // Verifica se o movimento é válido (não pode subir o primeiro nem descer o último)
    if (indexAlvo < 0 || indexAlvo >= lojas.length) return;

    const lojaAlvo = lojas[indexAlvo];

    setLoading(true);
    try {
      // 1. Troca a 'ordem' no banco de dados
      // Precisamos fazer duas atualizações. 
      // Para evitar conflitos, uma boa prática é usar os IDs.
      const ordemAtual = estoqueOpcoes.ordem || indexAtual; // Fallback caso seja null
      const ordemAlvo = lojaAlvo.ordem || indexAlvo;

      // Atualiza o estoque que foi clicado
      const { error: err1 } = await supabase
        .from('lojas')
        .update({ ordem: ordemAlvo })
        .eq('id', estoqueOpcoes.id);
      if (err1) throw err1;

      // Atualiza o estoque que vai trocar de lugar
      const { error: err2 } = await supabase
        .from('lojas')
        .update({ ordem: ordemAtual })
        .eq('id', lojaAlvo.id);
      if (err2) throw err2;

      // 2. Atualiza a lista localmente
      const novasLojas = [...lojas];
      
      // Atualiza os valores localmente antes de ordenar
      novasLojas[indexAtual] = { ...estoqueOpcoes, ordem: ordemAlvo };
      novasLojas[indexAlvo] = { ...lojaAlvo, ordem: ordemAtual };

      // Ordena a lista com a nova ordem
      novasLojas.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      
      setLojas(novasLojas);
      setModalOpcoesVisible(false); // Fecha o menu após a ação

    } catch (error) {
      Alert.alert("Erro ao reordenar", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      
      {/* 1. Modal Original: Criar Estoque */}
      <Modal visible={modalVisible} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', padding: 20, borderRadius: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#333' }}>Novo Estoque</Text>
            <TextInput placeholder="Ex: Loja Centro..." placeholderTextColor="#999" value={nomeEstoque} onChangeText={setNomeEstoque} style={styles.input} />
            {/* BOTÕES PADRONIZADOS: NOVO ESTOQUE */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
              <TouchableOpacity 
                onPress={() => setModalVisible(false)} 
                style={{ flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 8, marginRight: 10 }} 
                disabled={loading}
              >
                <Text style={{ color: '#555', fontWeight: 'bold' }}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={handleCriarEstoque} 
                disabled={loading} 
                style={{ flex: 1, backgroundColor: '#007AFF', paddingVertical: 12, alignItems: 'center', borderRadius: 8 }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>{loading ? "Salvando..." : "Criar"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 2. NOVO: Modal do Menu Flutuante (Opções) */}
      <Modal visible={modalOpcoesVisible} transparent={true} animationType="fade">
        <TouchableOpacity 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }} 
          activeOpacity={1} 
          onPress={() => setModalOpcoesVisible(false)}
        >
          <TouchableWithoutFeedback>
            <View style={{ backgroundColor: '#fff', borderRadius: 12, width: '75%', overflow: 'hidden' }}>
              <View style={{ padding: 20, backgroundColor: '#f8f9fa', borderBottomWidth: 1, borderColor: '#eee' }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333', textAlign: 'center' }}>
                  {estoqueOpcoes?.nome}
                </Text>
              </View>
              
              {/* Oculta 'Mover para cima' se já for o primeiro */}
              {lojas.findIndex(l => l.id === estoqueOpcoes?.id) > 0 && (
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderColor: '#eee' }}
                  onPress={() => moverEstoque('cima')}
                  disabled={loading}
                >
                  <View style={{ width: 30, alignItems: 'center' }}>
                    <Ionicons name="arrow-up" size={20} color="#555" />
                  </View>
                  <Text style={{ flex: 1, textAlign: 'center', fontSize: 16, color: '#555', fontWeight: 'bold' }}>
                    {loading ? "Movendo..." : "Mover para cima"}
                  </Text>
                  <View style={{ width: 30 }} />
                </TouchableOpacity>
              )}

              {/* Oculta 'Mover para baixo' se já for o último */}
              {lojas.findIndex(l => l.id === estoqueOpcoes?.id) < lojas.length - 1 && (
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderColor: '#eee' }}
                  onPress={() => moverEstoque('baixo')}
                  disabled={loading}
                >
                  <View style={{ width: 30, alignItems: 'center' }}>
                    <Ionicons name="arrow-down" size={20} color="#555" />
                  </View>
                  <Text style={{ flex: 1, textAlign: 'center', fontSize: 16, color: '#555', fontWeight: 'bold' }}>
                    {loading ? "Movendo..." : "Mover para baixo"}
                  </Text>
                  <View style={{ width: 30 }} />
                </TouchableOpacity>
              )}

              {/* Botões originais: Renomear e Apagar */}
              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderColor: '#eee' }}
                onPress={() => {
                  setNovoNome(estoqueOpcoes?.nome || '');
                  setModalOpcoesVisible(false);
                  setTimeout(() => setModalRenomearVisible(true), 100);
                }}
              >
                <View style={{ width: 30, alignItems: 'center' }}>
                  <Ionicons name="pencil" size={20} color="#007AFF" />
                </View>
                <Text style={{ flex: 1, textAlign: 'center', fontSize: 16, color: '#007AFF', fontWeight: 'bold' }}>
                  Renomear estoque
                </Text>
                <View style={{ width: 30 }} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', padding: 18 }}
                onPress={() => {
                  setModalOpcoesVisible(false);
                  setTimeout(() => setModalApagarVisible(true), 100);
                }}
              >
                <View style={{ width: 30, alignItems: 'center' }}>
                  <Ionicons name="trash" size={20} color="#d9534f" />
                </View>
                <Text style={{ flex: 1, textAlign: 'center', fontSize: 16, color: '#d9534f', fontWeight: 'bold' }}>
                  Apagar estoque
                </Text>
                <View style={{ width: 30 }} />
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* 3. NOVO: Modal de Renomear Estoque */}
      <Modal visible={modalRenomearVisible} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', padding: 20, borderRadius: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#333' }}>Renomear Estoque</Text>
            <TextInput value={novoNome} onChangeText={setNovoNome} style={styles.input} />
            {/* BOTÕES PADRONIZADOS: RENOMEAR ESTOQUE */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
              <TouchableOpacity 
                onPress={() => setModalRenomearVisible(false)} 
                style={{ flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 8, marginRight: 10 }} 
                disabled={loading}
              >
                <Text style={{ color: '#555', fontWeight: 'bold' }}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={handleRenomear} 
                disabled={loading} 
                style={{ flex: 1, backgroundColor: '#007AFF', paddingVertical: 12, alignItems: 'center', borderRadius: 8 }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>{loading ? "Salvando..." : "Salvar"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 4. Modal de Confirmar Exclusão */}
      <Modal visible={modalApagarVisible} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          
          {/* Caixa branca com overflow:hidden para a faixa cinza não vazar as bordas arredondadas */}
          <View style={{ backgroundColor: '#fff', borderRadius: 12, width: '85%', overflow: 'hidden' }}>
            
            {/* CABEÇALHO CINZA (Igual ao de Opções) */}
            <View style={{ padding: 20, backgroundColor: '#f8f9fa', borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="warning" size={22} color="#d9534f" style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>Apagar Estoque?</Text>
            </View>
            
            {/* CORPO DO MODAL (Texto e Botões) */}
            <View style={{ padding: 20 }}>
              <Text style={{ fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 20, lineHeight: 22 }}>
                Tem certeza que deseja apagar <Text style={{ fontWeight: 'bold', color: '#333' }}>{estoqueOpcoes?.nome}</Text>? Todos os produtos cadastrados nele também serão apagados para sempre.
              </Text>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <TouchableOpacity 
                  onPress={() => setModalApagarVisible(false)} 
                  style={{ flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 8, marginRight: 10 }} 
                  disabled={loading}
                >
                  <Text style={{ color: '#555', fontWeight: 'bold' }}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={handleApagar} 
                  disabled={loading} 
                  style={{ flex: 1, backgroundColor: '#d9534f', paddingVertical: 12, alignItems: 'center', borderRadius: 8 }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>{loading ? "Apagando..." : "Sim, apagar"}</Text>
                </TouchableOpacity>
              </View>
            </View>

          </View>
        </View>
      </Modal>

      <DrawerContentScrollView {...props}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 10 }} onPress={() => setModalVisible(true)}>
          <Ionicons name="add-circle" size={26} color="#007AFF" style={{ marginRight: 15 }} />
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#007AFF' }}>Criar estoque</Text>
        </TouchableOpacity>

        <View style={{ height: 1, backgroundColor: '#eee', marginHorizontal: 20, marginBottom: 10 }} />

        {/* --- LISTA DINÂMICA DE ESTOQUES (AGORA COM OS TRÊS PONTINHOS) --- */}
        <View style={{ paddingHorizontal: 10 }}>
          {lojas.length === 0 ? (
            <Text style={{ textAlign: 'center', color: '#999', marginTop: 10, fontSize: 14 }}>Você ainda não possui estoques.</Text>
          ) : (
            lojas.map((loja) => {
              const isActive = lojaAtiva && lojaAtiva.id === loja.id;
              
              return (
                // 1. O fundo azul e o arredondamento agora ficam na View "pai" que engloba tudo!
                <View 
                  key={loja.id} 
                  style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    marginBottom: 5,
                    backgroundColor: isActive ? '#e6f2ff' : 'transparent',
                    borderRadius: 8,
                  }}
                >
                  
                  {/* 2. Área de Selecionar o Estoque (Ocupa o espaço da esquerda) */}
                  <TouchableOpacity 
                    style={{ 
                      flex: 1, 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      paddingVertical: 12,
                      paddingLeft: 10,
                    }} 
                    onPress={() => {
                      setLojaAtiva(loja);
                      props.navigation.closeDrawer();
                    }}
                  >
                    <Ionicons name={isActive ? "storefront" : "storefront-outline"} size={22} color={isActive ? "#007AFF" : "#555"} style={{ marginRight: 15 }} />
                    <Text style={{ fontSize: 15, fontWeight: isActive ? 'bold' : '500', color: isActive ? '#007AFF' : '#555' }} numberOfLines={1}>
                      {loja.nome}
                    </Text>
                  </TouchableOpacity>

                  {/* 3. Botão dos 3 pontinhos (Agora dentro do fundo azul) */}
                  <TouchableOpacity 
                    style={{ padding: 12, paddingRight: 15 }} 
                    onPress={() => {
                      setEstoqueOpcoes(loja); // Avisa pro estado qual loja foi clicada
                      setModalOpcoesVisible(true); // Abre o menu flutuante
                    }}
                  >
                    {/* Cor dinâmica: Azul se estiver ativo, cinza se não estiver */}
                    <Ionicons 
                      name="ellipsis-vertical" 
                      size={20} 
                      color={isActive ? "#007AFF" : "#888"} 
                    />
                  </TouchableOpacity>
                  
                </View>
              )
            })
          )}
        </View>
      </DrawerContentScrollView>
      
      <View style={{ paddingBottom: Platform.OS === 'android' ? 40 : 20 }}>
        <View style={{ height: 1, backgroundColor: '#eee', marginHorizontal: 20, marginBottom: 10 }} />
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 }} onPress={() => Alert.alert("Configurações", "Em breve!")}>
          <Ionicons name="settings-outline" size={22} color="#555" style={{ marginRight: 15 }} />
          <Text style={{ fontSize: 14, fontWeight: '500', color: '#555' }}>Configurações</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 }} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#d9534f" style={{ marginRight: 15 }} />
          <Text style={{ fontSize: 14, fontWeight: '500', color: '#d9534f' }}>Desconectar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const MainAppDrawer = () => {
  const setLojas = useStore(state => state.setLojas);
  // NOVO: Precisamos puxar a lojaAtiva aqui também para o cabeçalho saber o nome!
  const lojaAtiva = useStore(state => state.lojaAtiva); 
  const setLojaAtiva = useStore(state => state.setLojaAtiva);
  const setIsFetchingLojas = useStore(state => state.setIsFetchingLojas);

  useEffect(() => {
    const carregarLojas = async () => {
      setIsFetchingLojas(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('lojas')
          .select('*')
          .eq('dono_id', user.id)
          .order('ordem', { ascending: true }); // <--- NOVO: Ordena pela coluna 'ordem'

        if (data) {
          setLojas(data);
          if (data.length > 0) {
            setLojaAtiva(data[0]);
          }
        }
      }
      setIsFetchingLojas(false);
    };
    carregarLojas();
  }, []);

  return (
    <Drawer.Navigator 
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerTintColor: '#333',
        drawerActiveTintColor: '#007AFF',
        headerTitleAlign: 'left', // NOVO: Garante que o título fique colado no menu lateral (três traços)
        drawerItemStyle: {
          borderRadius: 8,
        }
      }}
    >
      <Drawer.Screen 
        name="Home" 
        component={EmptyScreen} 
        options={{ 
          // NOVO: Substitui o 'Stockly' pelo nome do Estoque (ou deixa vazio se não tiver nenhum)
          title: lojaAtiva ? lojaAtiva.nome : '', 
          
          // NOVO: Coloca a logo "STOCKLY" no canto direito da barra com a "fonte" do login!
          headerRight: () => (
            <Text style={{ marginRight: 20, fontSize: 18, fontWeight: 'bold', color: '#007AFF', letterSpacing: 2 }}>
              STOCKLY
            </Text>
          ),
          
          drawerItemStyle: { display: 'none' } 
        }} 
      />
    </Drawer.Navigator>
  );
};

const AuthNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="SignUp" component={SignUpScreen} />
  </Stack.Navigator>
);

export default function App() {
  const isLoggedIn = useStore(state => state.isLoggedIn);
  const setAuthState = useStore(state => state.setAuthState);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState(!!session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthState(!!session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isLoggedIn ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : (
          <Stack.Screen name="MainApp" component={MainAppDrawer} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ----------------------
// STYLES
// ----------------------
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  loginContainer: { flex: 1, justifyContent: 'center', padding: 30, backgroundColor: '#fff' },
  logoText: { fontSize: 36, fontWeight: 'bold', textAlign: 'center', marginBottom: 40, letterSpacing: 2, color: '#007AFF' },
  primaryButton: { backgroundColor: '#007AFF', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  primaryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  secondaryButton: { padding: 15, alignItems: 'center', marginTop: 10 },
  secondaryButtonText: { color: '#007AFF', fontWeight: '600' },
  backButton: { position: 'absolute', top: 50, left: 20, padding: 10, zIndex: 10 },
  title: { fontSize: 24, fontWeight: 'bold' },
  subtitle: { marginTop: 20, fontWeight: 'bold' },
  item: { padding: 15, borderBottomWidth: 1, borderColor: '#eee' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 15, marginBottom: 15, backgroundColor: '#fafafa', color: '#333' },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 15, backgroundColor: '#fafafa' },
  passwordInput: { flex: 1, padding: 15, color: '#333' },
  eyeIcon: { padding: 15 },
  button: { backgroundColor: '#ddd', padding: 15, marginTop: 10, alignItems: 'center', borderRadius: 8 },
  buttonText: { fontWeight: 'bold' },
  topNotification: { position: 'absolute', top: 40, left: 20, right: 20, backgroundColor: '#4CAF50', padding: 15, borderRadius: 8, alignItems: 'center', zIndex: 100, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  topNotificationText: {color: '#fff', fontWeight: 'bold', fontSize: 16,}
});