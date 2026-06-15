import 'react-native-gesture-handler'; 

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert, Platform, Modal, ActivityIndicator, ScrollView, TouchableWithoutFeedback, Animated, Dimensions, Keyboard, Switch } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LineChart } from 'react-native-chart-kit';

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
  unreadNotifCount: 0,
  setUnreadNotifCount: (action) => set((state) => ({ 
    unreadNotifCount: typeof action === 'function' ? action(state.unreadNotifCount) : action 
  })),
  isFetchingLojas: true,
  setIsFetchingLojas: (status) => set({ isFetchingLojas: status }),
  
  lojas: [], 
  lojasMembro: [], 
  
  lojaAtiva: null,
  permissoesAtivas: null,
  setLojas: (lojas) => set({ lojas }),
  setLojasMembro: (lojas) => set({ lojasMembro: lojas }), 
  setLojaAtiva: (loja) => set({ lojaAtiva: loja, carrinhoGlobal: [] }),
  setPermissoesAtivas: (perms) => set({ permissoesAtivas: perms }),
  produtoParaEditarId: null,
  setProdutoParaEditarId: (id) => set({ produtoParaEditarId: id }),

  globalAutoFilter: null,
  setGlobalAutoFilter: (filter) => set({ globalAutoFilter: filter }),

  products: [],
  setProducts: (products) => set({ products }),
  addProduct: (product) => set((state) => ({ products: [...state.products, product] })),
  updateStock: (id, qty) => set((state) => ({
    products: state.products.map(p => p.id === id ? { ...p, estoque: p.estoque + qty } : p)
  })),
  carrinhoGlobal: [],
  setCarrinhoGlobal: (action) => set((state) => ({
    carrinhoGlobal: typeof action === 'function' ? action(state.carrinhoGlobal) : action
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

  const [notification, setNotification] = useState({ visible: false, message: '', type: 'success' });

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
      
      if (errorMessage.includes("Invalid login credentials")) {
        errorMessage = "E-mail ou senha incorretos.";
      } else if (errorMessage.toLowerCase().includes("invalid email")) {
        errorMessage = "Formato de e-mail inválido.";
      } else if (errorMessage.includes("Email not confirmed")) {
         errorMessage = "Por favor, confirme seu e-mail antes de entrar.";
      }

      showBanner(errorMessage, "error");
      setLoading(false);
      return;
    }
    
    setLoading(false);
  };

  return (
    <View style={styles.loginContainer}>
      
      {/* Notificação Dinâmica (Fundo 50% opacidade e Texto Escuro) */}
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
        .insert([{ id: data.user.id, nome: nome, email: email }]);
      if (profileError) console.log("Erro ao salvar perfil:", profileError);
    }
    
    setLoading(false);
    showBanner("Conta criada com sucesso!", "success");
    
    setTimeout(() => {
      navigation.navigate('Login');
    }, 2000); 
  };

  return (
    <View style={styles.loginContainer}>
      
      {/* Notificação Dinâmica (Fundo 50% e Texto Escuro) */}
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

const EmptyScreen = ({ navigation }) => {
  const lojaAtiva = useStore(state => state.lojaAtiva);
  const permissoesAtivas = useStore(state => state.permissoesAtivas);
  const isFetchingLojas = useStore(state => state.isFetchingLojas);
  
  const products = useStore(state => state.products);
  const setProducts = useStore(state => state.setProducts);
  const addProduct = useStore(state => state.addProduct);
  const carrinhoGlobal = useStore(state => state.carrinhoGlobal);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const globalAutoFilter = useStore(state => state.globalAutoFilter);
  const setGlobalAutoFilter = useStore(state => state.setGlobalAutoFilter);

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
  const [notificarMinimo, setNotificarMinimo] = useState(false);
  const [notificarMovimentacao, setNotificarMovimentacao] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [notification, setNotification] = useState({ visible: false, message: '', type: 'success' });
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const [editingStockId, setEditingStockId] = useState(null);
  const [tempStockValue, setTempStockValue] = useState('');
  const unreadNotifCount = useStore(state => state.unreadNotifCount);
  const setUnreadNotifCount = useStore(state => state.setUnreadNotifCount);
  const [meuId, setMeuId] = useState(null);

  // =========================================================================
  // CARREGAMENTO CENTRALIZADO (Produtos + Notificações num único take)
  // =========================================================================
  useEffect(() => {
    if (lojaAtiva) {
      const inicializarLoja = async () => {
        // 1. Reseta a UI instantaneamente
        scrollY.setValue(0);
        setSearchQuery('');
        
        const needsFullScreenLoad = products.length === 0 || (products[0] && products[0].loja_id !== lojaAtiva.id);
        
        if (needsFullScreenLoad) {
          setLoadingProducts(true);
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (user) setMeuId(user.id);

        const promiseNotificacoes = supabase
          .from('notificacoes')
          .select('*', { count: 'exact', head: true })
          .eq('loja_id', lojaAtiva.id)
          .eq('lida', false);

        const promiseProdutos = supabase
          .from('produtos')
          .select('*')
          .eq('loja_id', lojaAtiva.id)
          .eq('ativo', true)
          .order('nome', { ascending: true });

        const [resNotificacoes, resProdutos] = await Promise.all([promiseNotificacoes, promiseProdutos]);

        if (resNotificacoes.count !== null) setUnreadNotifCount(resNotificacoes.count);
        if (resProdutos.data) setProducts(resProdutos.data);

        if (needsFullScreenLoad) {
          setLoadingProducts(false);
        }
      };

      inicializarLoja();
    }
  }, [lojaAtiva]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        Animated.timing(keyboardOffset, {
          toValue: -100, 
          duration: 250, 
          useNativeDriver: true,
        }).start();
      }
    );
    
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        Animated.timing(keyboardOffset, {
          toValue: 0, 
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const { produtoParaEditarId, setProdutoParaEditarId } = useStore();

  useEffect(() => {
    // Se existir um ID vindo da ponte e a lista de produtos já estiver carregada
    if (produtoParaEditarId && products.length > 0) {
      const prod = products.find(p => p.id === produtoParaEditarId);
      if (prod) {
        abrirModalEdicao(prod);
        setProdutoParaEditarId(null);
      }
    }
  }, [produtoParaEditarId, products]);

  const showBanner = (message, type) => {
    setNotification({ visible: true, message, type });
    setTimeout(() => {
      setNotification({ visible: false, message: '', type: 'success' });
    }, 3000);
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert("Permissão negada", "Precisamos de acesso à câmera para ler os códigos de barras.");
        return;
      }
    }
    setIsScanning(true);
  };

  const handleBarcodeScanned = ({ type, data }) => {
    setIsScanning(false);
    setSku(data); 
    
    showBanner(`Código lido: ${data}`, "success"); 
  };

  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const SEARCH_BAR_HEIGHT = 65; // Altura total da barra (48 + paddings)
  const scrollYClamped = Animated.diffClamp(scrollY, 0, SEARCH_BAR_HEIGHT);
  const searchBarTranslateY = scrollYClamped.interpolate({
    inputRange: [0, SEARCH_BAR_HEIGHT],
    outputRange: [0, -SEARCH_BAR_HEIGHT],
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

    if (globalAutoFilter === 'critico') {
      filtered = filtered.filter(p => p.estoque_atual <= p.estoque_minimo && p.estoque_minimo > 0);
    }

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
    if (!permissoesAtivas?.adicionar) {
      showBanner("Sem permissão para adicionar produtos.", "error");
      return;
    }
    setProdutoEditando(null); 
    setNome(''); setSku(''); setPrecoCusto(''); setPrecoVenda(''); setEstoqueAtual(''); setEstoqueMinimo('');
    setNotificarMinimo(false); setNotificarMovimentacao(false); // Limpa as chaves
    abrirModal();
  };

  const abrirModalEdicao = (produto) => {
    if (!permissoesAtivas?.editar) {
      showBanner("Sem permissão para editar produtos.", "error");
      return;
    }
    setProdutoEditando(produto); 
    setNome(produto.nome);
    setSku(produto.sku_barcode && produto.sku_barcode.startsWith('INT-') ? '' : produto.sku_barcode);
    setPrecoCusto(Number(produto.preco_custo).toFixed(2).replace('.', ','));
    setPrecoVenda(Number(produto.preco_venda).toFixed(2).replace('.', ','));
    setEstoqueAtual(produto.estoque_atual.toString());
    setEstoqueMinimo(produto.estoque_minimo ? produto.estoque_minimo.toString() : '');
    setNotificarMinimo(produto.notificar_minimo || false); // Puxa do banco
    setNotificarMovimentacao(produto.notificar_movimentacao || false); // Puxa do banco
    abrirModal();
  };

  const abrirModal = () => {
    setModalVisible(true);
  };

  const fecharModal = () => {
    setModalVisible(false);
  };

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
            nome: nome, sku_barcode: skuFinal, preco_custo: custoNum, preco_venda: vendaNum, estoque_atual: atualNum, estoque_minimo: minNum, notificar_minimo: notificarMinimo, notificar_movimentacao: notificarMovimentacao
          }).eq('id', produtoEditando.id).select().single();
        if (error) throw error;
        
        const diferenca = atualNum - produtoEditando.estoque_atual;
        if (diferenca !== 0) {
          // 1. Registra a movimentação
          await supabase.from('movimentacoes').insert([{
            produto_id: produtoEditando.id,
            usuario_id: meuId,
            tipo: diferenca > 0 ? 'ENTRADA' : 'SAIDA',
            quantidade: Math.abs(diferenca),
            preco_custo_hist: custoNum,
            preco_venda_hist: vendaNum,
            is_venda: false,
            observacao: 'Edição na ficha do produto'
          }]);

          const notificacoes = [];

          if (notificarMovimentacao) {
            notificacoes.push({
              loja_id: lojaAtiva.id,
              produto_id: produtoEditando.id,
              mensagem: `Movimentação: ${diferenca > 0 ? '+' : '-'}${Math.abs(diferenca)} unidade(s) de ${nome}.`,
              tipo: 'movimentacao'
            });
          }

          if (notificarMinimo && diferenca < 0 && atualNum <= minNum) {
            notificacoes.push({
              loja_id: lojaAtiva.id,
              produto_id: produtoEditando.id,
              mensagem: `Atenção: O estoque de ${nome} chegou a ${atualNum} (Mínimo: ${minNum}).`,
              tipo: 'alerta_minimo'
            });
          }

          if (notificacoes.length > 0) {
            await supabase.from('notificacoes').insert(notificacoes);
            setUnreadNotifCount(prev => prev + notificacoes.length);
          }
        }
        setProducts(products.map(p => p.id === produtoEditando.id ? data : p));

      } else {
        
        // 1. Busca se esse SKU já existe nesta loja (ativo ou inativo)
        const { data: produtoExistente, error: errorBusca } = await supabase
          .from('produtos')
          .select('*')
          .eq('loja_id', lojaAtiva.id)
          .eq('sku_barcode', skuFinal)
          .maybeSingle();

        if (errorBusca) throw errorBusca;

        if (produtoExistente) {
          if (produtoExistente.ativo) {
            // Se o produto já está ativo, impede a duplicidade
            Alert.alert("Atenção", "Este código de barras já pertence a um produto ativo: " + produtoExistente.nome);
            setLoading(false);
            return;
          } else {
            const { data: ressuscitado, error: errorRessuscitar } = await supabase
              .from('produtos')
              .update({
                nome: nome,
                preco_custo: custoNum,
                preco_venda: vendaNum,
                estoque_atual: atualNum,
                estoque_minimo: minNum,
                ativo: true,
                notificar_minimo: notificarMinimo,
                notificar_movimentacao: notificarMovimentacao
              })
              .eq('id', produtoExistente.id)
              .select()
              .single();

            if (errorRessuscitar) throw errorRessuscitar;

            // Registra a volta no histórico
            if (atualNum > 0) {
              await supabase.from('movimentacoes').insert([{
                produto_id: ressuscitado.id,
                usuario_id: meuId,
                tipo: 'ENTRADA',
                quantidade: atualNum,
                preco_custo_hist: custoNum,
                preco_venda_hist: vendaNum,
                is_venda: false,
                observacao: 'Reativação no catálogo'
              }]);
            }
            addProduct(ressuscitado);
          }
        } else {
          // PRODUTO REALMENTE NOVO (Nunca existiu no banco)
          const { data, error } = await supabase.from('produtos').insert([{
              loja_id: lojaAtiva.id, nome: nome, sku_barcode: skuFinal, preco_custo: custoNum, preco_venda: vendaNum, estoque_atual: atualNum, estoque_minimo: minNum, ativo: true, notificar_minimo: notificarMinimo, notificar_movimentacao: notificarMovimentacao
            }]).select().single();
          if (error) throw error;
          
          if (atualNum > 0) {
            await supabase.from('movimentacoes').insert([{
              produto_id: data.id,
              usuario_id: meuId,
              tipo: 'ENTRADA',
              quantidade: atualNum,
              preco_custo_hist: custoNum,
              preco_venda_hist: vendaNum,
              is_venda: false,
              observacao: 'Cadastro inicial'
            }]);
          }
          addProduct(data);
        }
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
      if (produtoEditando.estoque_atual > 0) {
        await supabase.from('movimentacoes').insert([{
          produto_id: produtoEditando.id,
          usuario_id: meuId,
          tipo: 'SAIDA',
          quantidade: produtoEditando.estoque_atual, // Zera tudo que sobrou
          preco_custo_hist: produtoEditando.preco_custo,
          preco_venda_hist: produtoEditando.preco_venda,
          is_venda: false,
          observacao: 'Baixa por exclusão'
        }]);
      }

      const { error } = await supabase
        .from('produtos')
        .update({ ativo: false, estoque_atual: 0 })
        .eq('id', produtoEditando.id);
        
      if (error) throw error;

      // 3. Remove o produto da tela (estado local) para dar a sensação de que foi apagado
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
    if (!permissoesAtivas?.quantidades) {
      showBanner("Sem permissão para alterar o estoque.", "error");
      return;
    }
    const novoEstoque = produto.estoque_atual + mudanca;
    if (novoEstoque < 0) return;
    
    // Atualiza a tela instantaneamente
    setProducts(products.map(p => p.id === produto.id ? { ...p, estoque_atual: novoEstoque } : p));
    
    try {
      // 1. Atualiza o estoque na tabela 'produtos'
      const { error: errorProduto } = await supabase.from('produtos').update({ estoque_atual: novoEstoque }).eq('id', produto.id);
      if (errorProduto) throw errorProduto;

      // 2. Salva o log na tabela 'movimentacoes'
      const { error: errorMov } = await supabase.from('movimentacoes').insert([{
        produto_id: produto.id,
        usuario_id: meuId,
        tipo: mudanca > 0 ? 'ENTRADA' : 'SAIDA',
        quantidade: Math.abs(mudanca), 
        preco_custo_hist: produto.preco_custo,
        preco_venda_hist: produto.preco_venda,
        is_venda: false,
        observacao: 'Ajuste rápido (Botões)'
      }]);
      if (errorMov) throw errorMov;

      const notificacoes = [];

      if (produto.notificar_movimentacao) {
        notificacoes.push({
          loja_id: lojaAtiva.id,
          produto_id: produto.id,
          mensagem: `Movimentação: ${mudanca > 0 ? '+' : '-'}${Math.abs(mudanca)} unidade(s) de ${produto.nome}.`,
          tipo: 'movimentacao'
        });
      }

      if (produto.notificar_minimo && mudanca < 0 && novoEstoque <= produto.estoque_minimo) {
        notificacoes.push({
          loja_id: lojaAtiva.id,
          produto_id: produto.id,
          mensagem: `Atenção: O estoque de ${produto.nome} chegou a ${novoEstoque} (Mínimo: ${produto.estoque_minimo}).`,
          tipo: 'alerta_minimo'
        });
      }

      // Se alguma regra foi ativada, envia para o banco de dados
      if (notificacoes.length > 0) {
        const { error: errorNotif } = await supabase.from('notificacoes').insert(notificacoes);
        if (errorNotif) console.log("Erro ao gerar notificação:", errorNotif);
        else setUnreadNotifCount(prev => prev + notificacoes.length);
      }

    } catch (error) {
      // Se der erro, desfaz a alteração na tela
      setProducts(products.map(p => p.id === produto.id ? { ...p, estoque_atual: produto.estoque_atual } : p));
      Alert.alert("Erro Supabase", error.message || "Não foi possível sincronizar.");
    }
  };

  const handleSalvarEstoqueInline = async (produto) => {
    // 1. Fecha o campo de digitação
    setEditingStockId(null); 
    
    // 2. Converte o que foi digitado para número
    const novoEstoque = parseInt(tempStockValue, 10);

    // 3. Valida se o número é válido ou se nada mudou
    if (isNaN(novoEstoque) || novoEstoque < 0 || novoEstoque === produto.estoque_atual) {
      return; 
    }

    const diferenca = novoEstoque - produto.estoque_atual;

    // Atualiza a tela instantaneamente
    setProducts(products.map(p => p.id === produto.id ? { ...p, estoque_atual: novoEstoque } : p));

    try {
      // 1. Atualiza na tabela produtos
      const { error: errorProduto } = await supabase.from('produtos').update({ estoque_atual: novoEstoque }).eq('id', produto.id);
      if (errorProduto) throw errorProduto;

      // 2. Salva o log na tabela movimentacoes
      await supabase.from('movimentacoes').insert([{
        produto_id: produto.id,
        usuario_id: meuId,
        tipo: diferenca > 0 ? 'ENTRADA' : 'SAIDA',
        quantidade: Math.abs(diferenca),
        preco_custo_hist: produto.preco_custo,
        preco_venda_hist: produto.preco_venda,
        is_venda: false,
        observacao: 'Edição direta na lista'
      }]);

      // 3. Motor de Notificações
      const notificacoes = [];
      
      if (produto.notificar_movimentacao) {
        notificacoes.push({ loja_id: lojaAtiva.id, produto_id: produto.id, mensagem: `Movimentação: ${diferenca > 0 ? '+' : '-'}${Math.abs(diferenca)} unidade(s) de ${produto.nome}.`, tipo: 'movimentacao' });
      }

      if (produto.notificar_minimo && diferenca < 0 && novoEstoque <= produto.estoque_minimo) {
        notificacoes.push({ loja_id: lojaAtiva.id, produto_id: produto.id, mensagem: `Atenção: O estoque de ${produto.nome} chegou a ${novoEstoque} (Mínimo: ${produto.estoque_minimo}).`, tipo: 'alerta_minimo' });
      }

      if (notificacoes.length > 0) {
        await supabase.from('notificacoes').insert(notificacoes);
        setUnreadNotifCount(prev => prev + notificacoes.length);
      }

    } catch (error) {
      setProducts(products.map(p => p.id === produto.id ? { ...p, estoque_atual: produto.estoque_atual } : p));
      Alert.alert("Erro Supabase", error.message);
    }
  };

  if (isFetchingLojas) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}><ActivityIndicator size="large" color="#007AFF" /></View>;
  }

  if (lojaAtiva) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
        
        
{/* --- NOTIFICAÇÃO VISUAL DO BANNER --- */}
        {notification.visible && (
          <View style={[
            styles.topNotification, 
            { 
              backgroundColor: notification.type === 'error' ? 'rgba(244, 67, 54, 0.9)' : 'rgba(76, 175, 80, 0.9)', 
              zIndex: 999, 
              top: 20 
            }
          ]}>
            <Text style={[
              styles.topNotificationText,
              { color: '#fff' }
            ]}>
              {notification.message}
            </Text>
          </View>
        )}
        {/* ------------------------------------------ */}

        {/* --- BARRA DE PESQUISA FIXA NO TOPO --- */}
        <View style={{ 
          position: 'absolute',
          top: 0, left: 0, right: 0, 
          paddingHorizontal: 15, 
          paddingTop: 15, 
          paddingBottom: 10, 
          backgroundColor: 'transparent',
          zIndex: 10 
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
          </View>
        </View>
        {/* -------------------------------------- */}

        <View style={{ flex: 1 }}>
          {loadingProducts ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#007AFF" /></View>
          ) : products.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
              <Ionicons name="storefront-outline" size={64} color="#007AFF" />
              <Text style={{ marginTop: 20, fontSize: 18, color: '#333', textAlign: 'center', fontWeight: 'bold' }}>Seu estoque está pronto!</Text>
            </View>
          ) : processedProducts.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
              <Ionicons name="search-outline" size={48} color="#ccc" />
              <Text style={{ marginTop: 10, fontSize: 16, color: '#999', textAlign: 'center' }}>Nenhum produto encontrado para "{searchQuery}".</Text>
            </View>
          ) : (
            
            <FlatList
              data={processedProducts}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 15, paddingTop: 75 }}
              ListHeaderComponent={
                globalAutoFilter === 'critico' ? (
                  <View style={{ backgroundColor: '#fff5f5', padding: 15, marginBottom: 15, borderRadius: 8, borderWidth: 1, borderColor: '#feb2b2', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Ionicons name="warning" size={20} color="#e53e3e" style={{ marginRight: 8 }} />
                      <Text style={{ color: '#c53030', fontWeight: 'bold', fontSize: 13, flex: 1 }}>Filtrando estoque crítico</Text>
                    </View>
                    <TouchableOpacity onPress={() => setGlobalAutoFilter(null)} style={{ backgroundColor: '#e53e3e', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Limpar</Text>
                    </TouchableOpacity>
                  </View>
                ) : null
              }
              
              renderItem={({ item }) => (
                <TouchableOpacity 
                  activeOpacity={!permissoesAtivas?.editar ? 1 : 0.7} 
                  onPress={() => {
                    if (permissoesAtivas?.editar) abrirModalEdicao(item);
                  }} 
                  style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}
                >
                  {/* ... conteúdo do produto ... */}
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>{item.nome}</Text>
                    {item.sku_barcode && !item.sku_barcode.startsWith('INT-') ? <Text style={{ fontSize: 12, color: '#888' }}>SKU: {item.sku_barcode}</Text> : null}
                    <Text style={{ fontSize: 14, color: '#007AFF', marginTop: 5, fontWeight: '500' }}>R$ {Number(item.preco_venda).toFixed(2).replace('.', ',')}</Text>
                  </View>

                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: '#666', marginBottom: 5 }}>Estoque</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 8, padding: 4 }}>
                      <TouchableOpacity 
                        activeOpacity={!permissoesAtivas?.quantidades ? 1 : 0.2}
                        onPress={() => {
                          if (permissoesAtivas?.quantidades) handleAjusteEstoque(item, -1);
                        }} 
                        style={{ width: 32, height: 32, backgroundColor: !permissoesAtivas?.quantidades ? '#f0f0f0' : '#fff', borderRadius: 6, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, elevation: 1 }}
                      >
                        <Ionicons name="remove" size={20} color={!permissoesAtivas?.quantidades ? '#ccc' : '#d9534f'} />
                      </TouchableOpacity>
                      {editingStockId === item.id ? (
                        <TextInput
                          style={{ width: 45, textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: '#333', backgroundColor: '#e2e8f0', borderRadius: 4, padding: 0, height: 32 }}
                          value={tempStockValue}
                          onChangeText={setTempStockValue}
                          keyboardType="numeric"
                          autoFocus={true} // Já abre o teclado automaticamente
                          selectTextOnFocus={true}
                          onBlur={() => handleSalvarEstoqueInline(item)} // O onBlur será o único responsável por salvar
                          onSubmitEditing={() => Keyboard.dismiss()} // O Enter apenas fecha o teclado (o que vai acionar o onBlur automaticamente)
                        />
                      ) : (
                        <TouchableOpacity 
                          activeOpacity={!permissoesAtivas?.quantidades ? 1 : 0.2}
                          onPress={() => { 
                            if (permissoesAtivas?.quantidades) {
                              setEditingStockId(item.id); 
                              setTempStockValue(item.estoque_atual.toString()); 
                            }
                          }}
                        >
                          <Text style={{ fontSize: 18, fontWeight: 'bold', color: item.estoque_atual <= item.estoque_minimo ? '#d9534f' : '#4CAF50', width: 45, textAlign: 'center' }}>
                            {item.estoque_atual}
                          </Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity 
                        activeOpacity={!permissoesAtivas?.quantidades ? 1 : 0.2}
                        onPress={() => {
                          if (permissoesAtivas?.quantidades) handleAjusteEstoque(item, 1);
                        }} 
                        style={{ width: 32, height: 32, backgroundColor: !permissoesAtivas?.quantidades ? '#f0f0f0' : '#fff', borderRadius: 6, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, elevation: 1 }}
                      >
                        <Ionicons name="add" size={20} color={!permissoesAtivas?.quantidades ? '#ccc' : '#007AFF'} />
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

        {/* BARRA INFERIOR (MENU) */}
        <View style={{ height: Platform.OS === 'android' ? 90 : 70, paddingBottom: Platform.OS === 'android' ? 20 : 0, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#e0e0e0', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
          
          {/* 1. Botão de Equipe (Acessos) */}
          <TouchableOpacity onPress={() => navigation.navigate('Equipe')} style={{ width: 60, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="people-outline" size={28} color="#555" />
            <Text style={{ fontSize: 10, color: '#555', marginTop: 2, fontWeight: 'bold' }}>Equipe</Text>
          </TouchableOpacity>

          {/* 2. Botão de Vender (Caixa) */}
          <TouchableOpacity 
            disabled={permissoesAtivas?.caixa === false}
            onPress={() => navigation.navigate('PDV')} 
            style={{ width: 60, alignItems: 'center', justifyContent: 'center', opacity: permissoesAtivas?.caixa === false ? 0.4 : 1 }}
          >
            <View>
              <Ionicons name="cart-outline" size={28} color="#555" />
              {useStore.getState().carrinhoGlobal.length > 0 && (
                <View style={{ position: 'absolute', top: -4, right: -8, backgroundColor: '#4CAF50', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, zIndex: 10, borderWidth: 1.5, borderColor: '#fff' }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
                    {useStore.getState().carrinhoGlobal.reduce((acc, item) => acc + item.quantidade, 0)}
                  </Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 10, color: '#555', marginTop: 2, fontWeight: 'bold' }}>Caixa</Text>
          </TouchableOpacity>

          {/* 3. Botão de Adicionar Produto (Centralizado) */}
          <TouchableOpacity 
            disabled={permissoesAtivas?.adicionar === false}
            style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: permissoesAtivas?.adicionar === false ? '#9ec5f2' : '#007AFF', justifyContent: 'center', alignItems: 'center', marginTop: -40, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 }} 
            onPress={abrirModalNovo}
          >
            <Ionicons name="add" size={32} color={permissoesAtivas?.adicionar === false ? '#eaf3ff' : '#fff'} />
          </TouchableOpacity>

          {/* 4. Botão de Dashboard */}
          <TouchableOpacity 
            disabled={permissoesAtivas?.painel === false}
            onPress={() => navigation.navigate('Dashboard')} 
            style={{ width: 60, alignItems: 'center', justifyContent: 'center', opacity: permissoesAtivas?.painel === false ? 0.4 : 1 }}
          >
            <Ionicons name="stats-chart-outline" size={28} color="#555" />
            <Text style={{ fontSize: 10, color: '#555', marginTop: 2, fontWeight: 'bold' }}>Relatórios</Text>
          </TouchableOpacity>

          {/* 5. Botão de Histórico */}
          <TouchableOpacity onPress={() => navigation.navigate('Movimentacoes')} style={{ width: 60, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="time-outline" size={28} color="#555" />
            <Text style={{ fontSize: 10, color: '#555', marginTop: 2, fontWeight: 'bold' }}>Histórico</Text>
          </TouchableOpacity>
        </View>

        {/* MODAL FLUTUANTE: NOVO / EDITAR PRODUTO */}
        <Modal visible={modalVisible} transparent={true} animationType="fade"> 
          
          {/* Fundo escuro clicável para fechar */}
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={fecharModal} 
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          >
            
            {/* TouchableWithoutFeedback impede que o clique dentro da janela feche o modal */}
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <Animated.View style={{ 
                width: '90%', 
                backgroundColor: '#fff',
                borderRadius: 15, 
                padding: 20, 
                maxHeight: Dimensions.get('window').height * 0.85, 
                elevation: 10,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 5 },
                shadowOpacity: 0.3,
                shadowRadius: 10,
                transform: [{ translateY: keyboardOffset }] 
              }}>
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333' }}>
                    {produtoEditando ? "Editar Produto" : "Novo Produto"}
                  </Text>
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={openScanner} style={{ padding: 5, marginRight: produtoEditando ? 15 : 0 }}>
                      <Ionicons name="barcode-outline" size={28} color="#007AFF" />
                    </TouchableOpacity>

                    {produtoEditando && (
                      <TouchableOpacity onPress={handleApagarProduto} style={{ padding: 5 }}>
                        <Ionicons name="trash-outline" size={24} color="#d9534f" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={fecharModal} style={{ marginLeft: 15 }}>
                      <Ionicons name="close" size={28} color="#999" />
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <TextInput placeholder="Nome do Produto *" placeholderTextColor="#999" value={nome} onChangeText={setNome} style={styles.input} />
                  <TextInput placeholder="Código de Barras / SKU" placeholderTextColor="#999" value={sku} onChangeText={setSku} style={styles.input} keyboardType="numeric" />
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TextInput placeholder="Custo (R$)" placeholderTextColor="#999" value={precoCusto} onChangeText={setPrecoCusto} style={[styles.input, { width: '48%' }]} keyboardType="numeric" />
                    <TextInput placeholder="Venda (R$)" placeholderTextColor="#999" value={precoVenda} onChangeText={setPrecoVenda} style={[styles.input, { width: '48%' }]} keyboardType="numeric" />
                  </View>
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TextInput 
                      placeholder="Estoque Atual" 
                      placeholderTextColor="#999" 
                      value={estoqueAtual} 
                      onChangeText={setEstoqueAtual} 
                      editable={!produtoEditando || permissoesAtivas?.quantidades}
                      style={[
                        styles.input, 
                        { width: '48%' },
                        (produtoEditando && !permissoesAtivas?.quantidades) && { backgroundColor: '#e2e8f0', color: '#94a3b8' }
                      ]} 
                      keyboardType="numeric" 
                    />
                    <TextInput placeholder="Estoque Mín." placeholderTextColor="#999" value={estoqueMinimo} onChangeText={setEstoqueMinimo} style={[styles.input, { width: '48%' }]} keyboardType="numeric" />
                  </View>

                  <View style={{ marginTop: 10, padding: 15, backgroundColor: '#f8f9fa', borderRadius: 8, borderWidth: 1, borderColor: '#eee' }}>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#555', marginBottom: 10 }}>Alertas para este produto:</Text>
                    
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                      <Text style={{ fontSize: 14, color: '#333', flex: 1 }}>Avisar quando atingir o estoque mínimo</Text>
                      <Switch value={notificarMinimo} onValueChange={setNotificarMinimo} trackColor={{ false: "#d9d9d9", true: "#b3d4ff" }} thumbColor={notificarMinimo ? "#007AFF" : "#f4f3f4"} />
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 14, color: '#333', flex: 1 }}>Avisar sobre qualquer entrada ou saída</Text>
                      <Switch value={notificarMovimentacao} onValueChange={setNotificarMovimentacao} trackColor={{ false: "#d9d9d9", true: "#b3d4ff" }} thumbColor={notificarMovimentacao ? "#007AFF" : "#f4f3f4"} />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 }}>
                    <TouchableOpacity onPress={fecharModal} style={{ flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 8, marginRight: 10 }}>
                      <Text style={{ color: '#555', fontWeight: 'bold' }}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleSalvarProduto} style={{ flex: 1, backgroundColor: '#007AFF', paddingVertical: 12, alignItems: 'center', borderRadius: 8 }}>
                      <Text style={{ color: '#fff', fontWeight: 'bold' }}>{loading ? "Salvando..." : "Salvar"}</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>

              </Animated.View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
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
        {/* --- MODAL DA CÂMERA EM TELA CHEIA --- */}
        <Modal visible={isScanning} animationType="slide" transparent={false}>
          <View style={{ flex: 1, backgroundColor: '#000' }}>
            
            {/* Cabeçalho do Scanner */}
            <View style={{ paddingTop: Platform.OS === 'android' ? 40 : 50, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#000' }}>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>Escaneie o Código</Text>
              <TouchableOpacity onPress={() => setIsScanning(false)} style={{ padding: 5 }}>
                <Ionicons name="close" size={32} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {/* Visor da Câmera */}
            <View style={{ flex: 1 }}>
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                onBarcodeScanned={isScanning ? handleBarcodeScanned : undefined}
                barcodeScannerSettings={{
                  barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "qr"],
                }}
              />
              
              {/* Mira visual para orientar o usuário */}
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
                <View style={{ width: 250, height: 150, borderWidth: 3, borderColor: '#007AFF', borderRadius: 10, backgroundColor: 'transparent' }} />
                <Text style={{ color: '#fff', marginTop: 30, backgroundColor: 'rgba(0,0,0,0.7)', padding: 10, borderRadius: 8, fontSize: 16 }}>
                  Alinhe o código na marcação acima
                </Text>
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
  const [modalSairVisible, setModalSairVisible] = useState(false);
  const [nomeEstoque, setNomeEstoque] = useState('');
  const [loading, setLoading] = useState(false);
  

  const [estoqueOpcoes, setEstoqueOpcoes] = useState(null); // Guarda qual estoque foi clicado
  const [modalOpcoesVisible, setModalOpcoesVisible] = useState(false);
  const [modalRenomearVisible, setModalRenomearVisible] = useState(false);
  const [modalApagarVisible, setModalApagarVisible] = useState(false);
  const [novoNome, setNovoNome] = useState('');

  // Estados Globais
  const lojas = useStore(state => state.lojas);
  const lojasMembro = useStore(state => state.lojasMembro);
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
      
      const proximaOrdem = lojas.length > 0 ? Math.max(...lojas.map(l => l.ordem || 0)) + 1 : 1;

      const { data, error } = await supabase
        .from('lojas')
        .insert([{ nome: nomeEstoque, dono_id: user.id, ordem: proximaOrdem }])
        .select()
        .single();
        
      if (error) throw error;

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

  const handleApagar = async () => {
    setLoading(true);
    try {
      await supabase.from('produtos').delete().eq('loja_id', estoqueOpcoes.id);
      
      // 2. Agora sim, apaga a loja tranquilamente
      const { error } = await supabase.from('lojas').delete().eq('id', estoqueOpcoes.id);
      if (error) throw error;

      // 3. Atualiza a lista lateral
      const novasLojas = lojas.filter(l => l.id !== estoqueOpcoes.id);
      setLojas(novasLojas);
      
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

  // Função para desenhar cada item da lista de forma limpa
    const renderItemLoja = (loja, eDono) => {
    const isActive = lojaAtiva && lojaAtiva.id === loja.id;
    return (
      <View key={loja.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5, backgroundColor: isActive ? '#e6f2ff' : 'transparent', borderRadius: 8, overflow: 'hidden' }}>
        <TouchableOpacity 
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingLeft: 10 }} 
          onPress={() => { setLojaAtiva(loja); props.navigation.closeDrawer(); }}
        >
          <Ionicons name={isActive ? "storefront" : "storefront-outline"} size={22} color={isActive ? "#007AFF" : "#555"} style={{ marginRight: 15 }} />
          <Text style={{ fontSize: 15, fontWeight: isActive ? 'bold' : '500', color: isActive ? '#007AFF' : '#555' }} numberOfLines={1}>
            {loja.nome}
          </Text>
        </TouchableOpacity>

        {/* AGORA MOSTRA PARA TODOS, mas passamos se é dono ou não para o modal */}
        <TouchableOpacity 
          style={{ padding: 12, paddingRight: 15 }} 
          onPress={() => { 
            setEstoqueOpcoes({...loja, eDono}); // Guardamos se é dono no estado
            setModalOpcoesVisible(true); 
          }}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={isActive ? "#007AFF" : "#888"} />
        </TouchableOpacity>
      </View>
    );
  };

  const handleSairDoEstoque = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Remove apenas a entrada do usuário na tabela equipe para essa loja
      const { error } = await supabase
        .from('equipe')
        .delete()
        .eq('loja_id', estoqueOpcoes.id)
        .eq('usuario_id', user.id);

      if (error) throw error;

      // Atualiza a lista lateral removendo essa loja dos compartilhados
      const novasCompartilhadas = lojasMembro.filter(l => l.id !== estoqueOpcoes.id);
      useStore.getState().setLojasMembro(novasCompartilhadas);

      // Se saiu da loja que estava aberta, tenta abrir uma loja própria ou limpa a tela
      if (lojaAtiva?.id === estoqueOpcoes.id) {
        setLojaAtiva(lojas.length > 0 ? lojas[0] : (novasCompartilhadas.length > 0 ? novasCompartilhadas[0] : null));
      }

      setModalSairVisible(false);
      Alert.alert("Sucesso", "Você saiu do estoque compartilhado.");
    } catch (error) {
      Alert.alert("Erro ao sair", error.message);
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

      {/* 2. Modal do Menu Flutuante (Opções) */}
      <Modal visible={modalOpcoesVisible} transparent={true} animationType="fade">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setModalOpcoesVisible(false)}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, width: '75%', overflow: 'hidden' }}>
            <View style={{ padding: 20, backgroundColor: '#f8f9fa', borderBottomWidth: 1, borderColor: '#eee' }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333', textAlign: 'center' }}>{estoqueOpcoes?.nome}</Text>
            </View>
            
            {estoqueOpcoes?.eDono ? (
              // OPÇÕES PARA O DONO
              <>
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderBottomWidth: 1, borderColor: '#f0f0f0' }} 
                  onPress={() => { setNovoNome(estoqueOpcoes?.nome); setModalOpcoesVisible(false); setTimeout(() => setModalRenomearVisible(true), 100); }}
                >
                  <Ionicons name="pencil" size={22} color="#007AFF" style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 16, color: '#007AFF', fontWeight: '500' }}>Renomear estoque</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18 }} 
                  onPress={() => { setModalOpcoesVisible(false); setTimeout(() => setModalApagarVisible(true), 100); }}
                >
                  <Ionicons name="trash" size={22} color="#d9534f" style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: 16, color: '#d9534f', fontWeight: '500' }}>Apagar estoque</Text>
                </TouchableOpacity>
              </>
            ) : (
              // OPÇÃO PARA O MEMBRO CONVIDADO
              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18 }} 
                onPress={() => {
                  setModalOpcoesVisible(false);
                  setTimeout(() => setModalSairVisible(true), 100);
                }}
              >
                <Ionicons name="log-out-outline" size={22} color="#d9534f" style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 16, color: '#d9534f', fontWeight: '500' }}>Sair do estoque</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 3. Modal de Renomear Estoque */}
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

      {/* 5. Modal de Confirmar Saída */}
      <Modal visible={modalSairVisible} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, width: '85%', overflow: 'hidden' }}>
            
            <View style={{ padding: 20, backgroundColor: '#f8f9fa', borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="log-out-outline" size={24} color="#d9534f" style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>Sair do Estoque?</Text>
            </View>
            
            <View style={{ padding: 20 }}>
              <Text style={{ fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 20, lineHeight: 22 }}>
                Tem certeza que deseja sair do estoque <Text style={{ fontWeight: 'bold', color: '#333' }}>{estoqueOpcoes?.nome}</Text>? Você perderá o acesso aos produtos e precisará de um novo convite para voltar.
              </Text>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <TouchableOpacity 
                  onPress={() => setModalSairVisible(false)} 
                  style={{ flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 8, marginRight: 10 }} 
                  disabled={loading}
                >
                  <Text style={{ color: '#555', fontWeight: 'bold' }}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={handleSairDoEstoque} 
                  disabled={loading} 
                  style={{ flex: 1, backgroundColor: '#d9534f', paddingVertical: 12, alignItems: 'center', borderRadius: 8 }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>{loading ? "Saindo..." : "Sim, sair"}</Text>
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

        {/* --- LISTA DINÂMICA DE ESTOQUES --- */}
        <View style={{ paddingHorizontal: 10 }}>
          
          {/* SEÇÃO: MEUS ESTOQUES */}
          <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#999', marginLeft: 10, marginTop: 10, marginBottom: 5 }}>MEUS ESTOQUES</Text>
          {(!lojas || lojas.length === 0) ? (
            <Text style={{ marginLeft: 10, color: '#ccc', fontSize: 13, marginBottom: 15 }}>Nenhum estoque criado.</Text>
          ) : (
            lojas.map((loja) => renderItemLoja(loja, true)) 
          )}

          <View style={{ height: 1, backgroundColor: '#eee', marginHorizontal: 10, marginVertical: 10 }} />

          {/* SEÇÃO: COMPARTILHADOS COMIGO */}
          <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#999', marginLeft: 10, marginTop: 5, marginBottom: 5 }}>COMPARTILHADOS</Text>
          {(!lojasMembro || lojasMembro.length === 0) ? (
            <Text style={{ marginLeft: 10, color: '#ccc', fontSize: 13 }}>Nenhum estoque compartilhado.</Text>
          ) : (
            lojasMembro.map((loja) => renderItemLoja(loja, false))
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

// ----------------------
// SCREEN: EQUIPE E PERMISSÕES (RBAC Granular)
// ----------------------
const EquipeScreen = ({ navigation }) => {
  const lojaAtiva = useStore(state => state.lojaAtiva);
  const permissoesAtivas = useStore(state => state.permissoesAtivas);
  const [meuId, setMeuId] = useState(null);
  const [equipe, setEquipe] = useState([]);
  const [emailConvite, setEmailConvite] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [notification, setNotification] = useState({ visible: false, message: '', type: 'success' });
  const [modalRemoverVisible, setModalRemoverVisible] = useState(false);
  const [membroParaRemover, setMembroParaRemover] = useState(null);

  // Estados do Modal de Permissões
  const [modalPermissoesVisible, setModalPermissoesVisible] = useState(false);
  const [membroSelecionado, setMembroSelecionado] = useState(null);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [perms, setPerms] = useState({
    quantidades: false, adicionar: false, editar: false, gerenciar: false, gerenciar_avisos: false, gerenciar_tarefas: false
  });

  const showBanner = (message, type = 'success') => {
    setNotification({ visible: true, message, type });
    setTimeout(() => setNotification({ visible: false, message: '', type: 'success' }), 3000);
  };

  const carregarEquipe = async () => {
    setLoadingList(true);
    try {
      // 1. Busca os membros colaboradores na tabela 'equipe'
      const { data: equipeData, error: errorEquipe } = await supabase
        .from('equipe')
        .select('*')
        .eq('loja_id', lojaAtiva.id);

      if (errorEquipe) throw errorEquipe;

      // 2. Prepara a lista de IDs para buscar os nomes (Membros + Dono)
      const idsUsuarios = (equipeData || []).map(m => m.usuario_id);
      if (!idsUsuarios.includes(lojaAtiva.dono_id)) {
        idsUsuarios.push(lojaAtiva.dono_id);
      }

      // 3. Busca todos os perfis
      const { data: perfisData, error: errorPerfis } = await supabase
        .from('perfis')
        .select('id, nome, email')
        .in('id', idsUsuarios);

      if (errorPerfis) throw errorPerfis;

      const listaFinal = [];

      // 4. Adiciona o Dono no topo (O Dono tem todas as permissões virtuais)
      const perfilDono = perfisData.find(p => p.id === lojaAtiva.dono_id);
      if (perfilDono) {
        listaFinal.push({
          id: 'owner_row',
          usuario_id: lojaAtiva.dono_id,
          isOwner: true,
          perm_editar_quantidades: true,
          perm_adicionar_produto: true,
          perm_editar_produto: true,
          perm_gerenciar_membros: true,
          perfis: perfilDono
        });
      }

      // 5. Adiciona os demais membros
      // 5. Ordena e adiciona os demais membros
      if (equipeData) {
        // Filtra apenas quem não é o dono
        let outrosMembros = equipeData.filter(m => m.usuario_id !== lojaAtiva.dono_id);
        
        // Ordena a lista: Gerentes primeiro, depois ordem alfabética
        outrosMembros.sort((a, b) => {
          if (a.perm_gerenciar_membros && !b.perm_gerenciar_membros) return -1;
          if (!a.perm_gerenciar_membros && b.perm_gerenciar_membros) return 1;
          
          // 2º Critério: Desempate por Ordem Alfabética
          const perfilA = perfisData.find(p => p.id === a.usuario_id)?.nome || '';
          const perfilB = perfisData.find(p => p.id === b.usuario_id)?.nome || '';
          return perfilA.localeCompare(perfilB);
        });

        // Adiciona a lista ordenada na lista final da tela
        outrosMembros.forEach(membro => {
          const perfil = perfisData.find(p => p.id === membro.usuario_id);
          listaFinal.push({ ...membro, perfis: perfil || { nome: 'Usuário Desconhecido', email: '' } });
        });
      }

      setEquipe(listaFinal);
    } catch (error) {
      console.log("Erro ao carregar equipe:", error);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    const buscarMeuId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setMeuId(user.id);
    };
    
    buscarMeuId();
    if (lojaAtiva) carregarEquipe();
  }, [lojaAtiva]);

  const handleConvidar = async () => {
    if (!emailConvite) return;
    setLoading(true);

    try {
      const { data: perfil, error: erroPerfil } = await supabase.from('perfis').select('id, nome').eq('email', emailConvite.toLowerCase().trim()).maybeSingle();
      if (erroPerfil) throw erroPerfil;
      
      if (!perfil) { 
        showBanner("Usuário não encontrado. Peça para criar uma conta.", "error"); 
        setLoading(false); 
        return; 
      }

      const jaExiste = equipe.some(membro => membro.usuario_id === perfil.id);
      if (jaExiste) { 
        showBanner("Esta pessoa já faz parte da equipe.", "error"); 
        setLoading(false); 
        return; 
      }

      const { error: erroInsert } = await supabase.from('equipe').insert([{
        loja_id: lojaAtiva.id,
        usuario_id: perfil.id,
        perm_editar_quantidades: false,
        perm_adicionar_produto: false,
        perm_editar_produto: false,
        perm_gerenciar_membros: false
      }]);

      if (erroInsert) throw erroInsert;

      showBanner(`${perfil.nome} foi adicionado(a) à equipe!`, "success");
      setEmailConvite('');
      await carregarEquipe();
    } catch (error) {
      showBanner(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoverMembro = (membroId, nome) => {
    setMembroParaRemover({ id: membroId, nome });
    setModalRemoverVisible(true);
  };

  const confirmarRemocao = async () => {
    if (!membroParaRemover) return;
    setLoading(true);
    try {
      await supabase.from('equipe').delete().eq('id', membroParaRemover.id);
      await carregarEquipe();
      setModalRemoverVisible(false);
      showBanner(`${membroParaRemover.nome} foi removido(a).`, "success");
    } catch (error) {
      showBanner("Erro ao remover membro.", "error");
    } finally {
      setLoading(false);
      setMembroParaRemover(null);
    }
  };

  // --- FUNÇÕES DO MODAL DE PERMISSÕES ---
  const abrirModalPermissoes = (membro) => {
    setMembroSelecionado(membro);
    setPerms({
      quantidades: membro.perm_editar_quantidades || false,
      adicionar: membro.perm_adicionar_produto || false,
      editar: membro.perm_editar_produto || false,
      gerenciar: membro.perm_gerenciar_membros || false,
      gerenciar_avisos: membro.perm_gerenciar_avisos || false,
      gerenciar_tarefas: membro.perm_gerenciar_tarefas || false,
      caixa: membro.perm_acessar_caixa !== false,
      painel: membro.perm_acessar_painel !== false
    });
    setModalPermissoesVisible(true);
  };

  const salvarPermissoes = async () => {
    setLoadingPerms(true);
    try {
      const { error } = await supabase
        .from('equipe')
        .update({
          perm_editar_quantidades: perms.quantidades,
          perm_adicionar_produto: perms.adicionar,
          perm_editar_produto: perms.editar,
          perm_gerenciar_membros: perms.gerenciar,
          perm_gerenciar_avisos: perms.gerenciar_avisos,
          perm_gerenciar_tarefas: perms.gerenciar_tarefas,
          perm_acessar_caixa: perms.caixa,
          perm_acessar_painel: perms.painel
        })
        .eq('id', membroSelecionado.id);

      if (error) throw error;

      setModalPermissoesVisible(false);
      await carregarEquipe();
    } catch (error) {
      Alert.alert("Erro", "Não foi possível salvar as permissões.");
    } finally {
      setLoadingPerms(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      {/* NOTIFICAÇÃO VISUAL DO BANNER */}
      {notification.visible && (
        <View style={[
          styles.topNotification, 
          { 
            backgroundColor: notification.type === 'error' ? 'rgba(244, 67, 54, 0.9)' : 'rgba(76, 175, 80, 0.9)', 
            zIndex: 999, 
            top: 20,
            position: 'absolute', left: 20, right: 20, padding: 15, borderRadius: 8, alignItems: 'center'
          }
        ]}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
            {notification.message}
          </Text>
        </View>
      )}
      <View style={{ paddingTop: Platform.OS === 'android' ? 40 : 50, paddingBottom: 15, paddingHorizontal: 20, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#eee' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 15 }}>
          <Ionicons name="arrow-back" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333' }}>Equipe do Estoque</Text>
      </View>

      {/* SÓ MOSTRA SE TIVER PERMISSÃO */}
      {permissoesAtivas?.gerenciar && (
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 5, backgroundColor: 'transparent' }}>
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#888', marginBottom: 15, textTransform: 'uppercase' }}>Adicionar Membro</Text>
          
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            
            {/* Input no mesmo estilo da barra de pesquisa de produtos */}
            <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 8, alignItems: 'center', paddingHorizontal: 10, height: 48 }}>
              <Ionicons name="mail" size={20} color="#64748b" />
              <TextInput 
                placeholder="E-mail do usuário..." 
                placeholderTextColor="#94a3b8" 
                value={emailConvite} 
                onChangeText={setEmailConvite} 
                style={{ flex: 1, paddingLeft: 10, color: '#333', height: '100%' }} 
                keyboardType="email-address" 
                autoCapitalize="none" 
              />
              {/* Botão de limpar (X) que aparece quando há texto */}
              {emailConvite.length > 0 && (
                <TouchableOpacity onPress={() => setEmailConvite('')}>
                  <Ionicons name="close-circle" size={20} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Botão de Enviar no formato quadrado para combinar */}
            <TouchableOpacity 
              onPress={handleConvidar} 
              disabled={loading || !emailConvite} 
              style={{ 
                marginLeft: 10, 
                backgroundColor: (loading || !emailConvite) ? '#a0cbfc' : '#007AFF', 
                width: 48, 
                height: 48, 
                borderRadius: 8, 
                justifyContent: 'center', 
                alignItems: 'center' 
              }}
            >
              {loading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={20} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Removemos o paddingHorizontal da View principal para a linha poder esticar mais */}
      <View style={{ flex: 1 }}>
        
        {/* Container fixo do Título + Degradê */}
        <View style={{ zIndex: 1 }}>
          <View style={{ backgroundColor: '#f5f5f5', paddingTop: 15, paddingBottom: 0 }}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#888', marginHorizontal: 20, textTransform: 'uppercase' }}>
              Membros Atuais
            </Text>
          </View>
          
          {/* O DEGRADÊ (FADE): Fica posicionado em absoluto para cair por cima da lista */}
          <LinearGradient
            colors={['#f5f5f5', 'rgba(245,245,245,0)']}
            style={{ height: 20, width: '100%', position: 'absolute', bottom: -20 }}
            pointerEvents="none"
          />
        </View>

        {/* Devolvemos o paddingHorizontal 20 apenas para a área da lista */}
        <View style={{ flex: 1, paddingHorizontal: 20 }}>
        
        {loadingList ? (
          <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 20 }} />
        ) : equipe.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', paddingTop: '30%' }}>
            <Ionicons name="people-outline" size={48} color="#ccc" />
            <Text style={{ color: '#999', marginTop: 10, fontSize: 15 }}>Apenas você tem acesso a esse estoque.</Text>
          </View>
        ) : (
          <FlatList
            data={equipe}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 20, paddingBottom: 20 }}
            renderItem={({ item }) => {
              const souEu = item.usuario_id === meuId; 
              const souDono = lojaAtiva?.dono_id === meuId;
              
              // 1. Define se o item da lista é um Gerente
              const isGerente = !item.isOwner && item.perm_gerenciar_membros;

              // 2. Cores dinâmicas (Amarelo = Dono, Verde = Gerente, Azul = Membro Comum)
              const corDestaque = item.isOwner ? '#ffc107' : (isGerente ? '#28a745' : '#007AFF');
              const fundoDestaque = item.isOwner ? '#fff3cd' : (isGerente ? '#e8f5e9' : '#f0f7ff');
              
              // 3. Lógica do Círculo da Foto
              const fundoIcone = souEu ? corDestaque : (item.isOwner ? '#fff3cd' : (isGerente ? '#e8f5e9' : '#e6f2ff'));
              const corTextoIcone = souEu ? '#fff' : corDestaque;

              // Trava de hierarquia para os botões de edição
              const possoEditar = permissoesAtivas?.gerenciar && !item.isOwner && !souEu && (souDono || !item.perm_gerenciar_membros);

              return (
                <TouchableOpacity 
                  activeOpacity={possoEditar ? 0.6 : 1}
                  onPress={() => possoEditar && abrirModalPermissoes(item)}
                  style={{ 
                    backgroundColor: souEu ? fundoDestaque : '#fff', // Fica verde se "Você" for gerente
                    padding: 15, 
                    borderRadius: 10, 
                    marginBottom: 10, 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    shadowColor: '#000', 
                    shadowOffset: { width: 0, height: 1 }, 
                    shadowOpacity: 0.05, 
                    elevation: 1, 
                    borderWidth: 1, 
                    borderColor: item.isOwner ? '#ffc107' : (souEu ? corDestaque : '#eee') 
                  }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: fundoIcone, justifyContent: 'center', alignItems: 'center', marginRight: 15 }}>
                    <Text style={{ color: corTextoIcone, fontWeight: 'bold', fontSize: 16 }}>
                      {item.perfis?.nome ? item.perfis.nome.charAt(0).toUpperCase() : '?'}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>
                      {item.perfis?.nome || 'Usuário'} 
                      {item.isOwner && <Text style={{ fontSize: 12, color: '#ffc107' }}> (Dono)</Text>}
                      
                      {/* Rótulo de Gerente: Agora aparece para todos, inclusive para "Você" */}
                      {isGerente && <Text style={{ fontSize: 12, color: '#28a745' }}> (Gerente)</Text>}
                      
                      {souEu && <Text style={{ fontSize: 12, color: corDestaque }}> (Você)</Text>}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#888' }}>{item.perfis?.email}</Text>
                  </View>
                  
                  {possoEditar && (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="settings-outline" size={22} color="#007AFF" style={{ marginRight: 15 }} />
                      <TouchableOpacity onPress={() => handleRemoverMembro(item.id, item.perfis?.nome)} style={{ padding: 5 }}>
                        <Ionicons name="trash-outline" size={22} color="#d9534f" />
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              )
            }}
          />
        )}
        {/* MODAL PADRONIZADO: REMOVER DA EQUIPE */}
        <Modal visible={modalRemoverVisible} transparent={true} animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 12, width: '85%', overflow: 'hidden' }}>
              <View style={{ padding: 20, backgroundColor: '#f8f9fa', borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="warning" size={22} color="#d9534f" style={{ marginRight: 10 }} />
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>Remover da Equipe?</Text>
              </View>
              <View style={{ padding: 20 }}>
                <Text style={{ fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 20, lineHeight: 22 }}>
                  Tem certeza que deseja remover <Text style={{ fontWeight: 'bold', color: '#333' }}>{membroParaRemover?.nome}</Text> do estoque?
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <TouchableOpacity onPress={() => setModalRemoverVisible(false)} style={{ flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 8, marginRight: 10 }} disabled={loading}>
                    <Text style={{ color: '#555', fontWeight: 'bold' }}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={confirmarRemocao} disabled={loading} style={{ flex: 1, backgroundColor: '#d9534f', paddingVertical: 12, alignItems: 'center', borderRadius: 8 }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>{loading ? "Removendo..." : "Sim, remover"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      </View>

      {/* --- MODAL DE PERMISSÕES --- */}
      <Modal visible={modalPermissoesVisible} transparent={true} animationType="fade">
        {/* Transformamos o fundo escuro em um botão que fecha o modal */}
        <TouchableOpacity 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          activeOpacity={1}
          onPress={() => setModalPermissoesVisible(false)}
        >
          {/* Protegemos a caixa branca para não fechar se clicar dentro dela */}
          <TouchableWithoutFeedback>
            <View style={{ backgroundColor: '#fff', borderRadius: 15, width: '90%', padding: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 }}>
              
              {/* HEADER DO MODAL CORRIGIDO */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333' }}>Editar Permissões</Text>
                  <Text style={{ fontSize: 14, color: '#888' }}>{membroSelecionado?.perfis?.nome}</Text>
                </View>
                <TouchableOpacity onPress={() => setModalPermissoesVisible(false)}>
                  <Ionicons name="close" size={28} color="#999" />
                </TouchableOpacity>
              </View>

              {/* Configuração dos Switches */}
              <View style={{ marginBottom: 25 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#eee' }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ fontSize: 15, color: '#333', fontWeight: '500' }}>Editar Quantidades</Text>
                    <Text style={{ fontSize: 12, color: '#888' }}>Permite usar os botões + e - no estoque.</Text>
                  </View>
                  <Switch value={perms.quantidades} onValueChange={(val) => setPerms({...perms, quantidades: val})} trackColor={{ false: "#d9d9d9", true: "#b3d4ff" }} thumbColor={perms.quantidades ? "#007AFF" : "#f4f3f4"} />
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#eee' }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ fontSize: 15, color: '#333', fontWeight: '500' }}>Adicionar Produtos</Text>
                    <Text style={{ fontSize: 12, color: '#888' }}>Permite criar novos produtos no sistema.</Text>
                  </View>
                  <Switch value={perms.adicionar} onValueChange={(val) => setPerms({...perms, adicionar: val})} trackColor={{ false: "#d9d9d9", true: "#b3d4ff" }} thumbColor={perms.adicionar ? "#007AFF" : "#f4f3f4"} />
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#eee' }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ fontSize: 15, color: '#333', fontWeight: '500' }}>Editar Produtos</Text>
                    <Text style={{ fontSize: 12, color: '#888' }}>Permite alterar preços, nomes e alertas.</Text>
                  </View>
                  <Switch value={perms.editar} onValueChange={(val) => setPerms({...perms, editar: val})} trackColor={{ false: "#d9d9d9", true: "#b3d4ff" }} thumbColor={perms.editar ? "#007AFF" : "#f4f3f4"} />
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#eee' }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ fontSize: 15, color: '#333', fontWeight: '500' }}>Gerenciar Avisos</Text>
                    <Text style={{ fontSize: 12, color: '#888' }}>Permite apagar notificações da loja.</Text>
                  </View>
                  <Switch value={perms.gerenciar_avisos} onValueChange={(val) => setPerms({...perms, gerenciar_avisos: val})} trackColor={{ false: "#d9d9d9", true: "#b3d4ff" }} thumbColor={perms.gerenciar_avisos ? "#007AFF" : "#f4f3f4"} />
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#eee' }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ fontSize: 15, color: '#333', fontWeight: '500' }}>Gerenciar Tarefas</Text>
                    <Text style={{ fontSize: 12, color: '#888' }}>Permite criar, editar datas e apagar tarefas.</Text>
                  </View>
                  <Switch value={perms.gerenciar_tarefas} onValueChange={(val) => setPerms({...perms, gerenciar_tarefas: val})} trackColor={{ false: "#d9d9d9", true: "#b3d4ff" }} thumbColor={perms.gerenciar_tarefas ? "#007AFF" : "#f4f3f4"} />
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#eee' }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ fontSize: 15, color: '#333', fontWeight: '500' }}>Gerenciar Membros</Text>
                    <Text style={{ fontSize: 12, color: '#888' }}>Permite convidar e alterar acessos da equipe.</Text>
                  </View>
                  <Switch value={perms.gerenciar} onValueChange={(val) => setPerms({...perms, gerenciar: val})} trackColor={{ false: "#d9d9d9", true: "#b3d4ff" }} thumbColor={perms.gerenciar ? "#007AFF" : "#f4f3f4"} />
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#eee' }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ fontSize: 15, color: '#333', fontWeight: '500' }}>Acessar Caixa</Text>
                    <Text style={{ fontSize: 12, color: '#888' }}>Permite abrir o Caixa e realizar vendas.</Text>
                  </View>
                  <Switch value={perms.caixa} onValueChange={(val) => setPerms({...perms, caixa: val})} trackColor={{ false: "#d9d9d9", true: "#b3d4ff" }} thumbColor={perms.caixa ? "#007AFF" : "#f4f3f4"} />
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ fontSize: 15, color: '#333', fontWeight: '500' }}>Acessar Relatórios</Text>
                    <Text style={{ fontSize: 12, color: '#888' }}>Permite ver gráficos e relatórios da loja.</Text>
                  </View>
                  <Switch value={perms.painel} onValueChange={(val) => setPerms({...perms, painel: val})} trackColor={{ false: "#d9d9d9", true: "#b3d4ff" }} thumbColor={perms.painel ? "#007AFF" : "#f4f3f4"} />
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <TouchableOpacity onPress={() => setModalPermissoesVisible(false)} style={{ flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 8, marginRight: 10 }} disabled={loadingPerms}>
                  <Text style={{ color: '#555', fontWeight: 'bold' }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={salvarPermissoes} disabled={loadingPerms} style={{ flex: 1, backgroundColor: '#007AFF', paddingVertical: 12, alignItems: 'center', borderRadius: 8 }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>{loadingPerms ? "Salvando..." : "Salvar"}</Text>
                </TouchableOpacity>
              </View>

            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

    </View>
    </View>
  );
};

// ----------------------
// SCREEN: NOTIFICAÇÕES & AFAZERES
// ----------------------
const TarefasScreen = ({ navigation }) => {
  const lojaAtiva = useStore(state => state.lojaAtiva);
  const permissoesAtivas = useStore(state => state.permissoesAtivas);
  const setUnreadNotifCount = useStore(state => state.setUnreadNotifCount);
  const { setProdutoParaEditarId } = useStore();
  const products = useStore(state => state.products);
  const setProducts = useStore(state => state.setProducts);

  // --- ESTADOS: AVISOS (Originais) ---
  const [notificacoes, setNotificacoes] = useState([]);
  const [loadingAvisos, setLoadingAvisos] = useState(true);
  const [selecionando, setSelecionando] = useState(false);
  const [selecionados, setSelecionados] = useState([]);
  const [modalConfirmarVisible, setModalConfirmarVisible] = useState(false);
  const [modalAcaoUnicaVisible, setModalAcaoUnicaVisible] = useState(false);
  const [notifFocada, setNotifFocada] = useState(null);

  // --- ESTADOS: AFAZERES (Novos) ---
  const [abaAtiva, setAbaAtiva] = useState('afazeres'); // 'avisos' ou 'afazeres'
  const [lembretes, setLembretes] = useState([]);
  const [loadingLembretes, setLoadingLembretes] = useState(true);
  const [novoLembrete, setNovoLembrete] = useState('');
  const [dataLimite, setDataLimite] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [criandoLembrete, setCriandoLembrete] = useState(false);
  const [lembreteEditandoData, setLembreteEditandoData] = useState(null);
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [modalProdutosVisible, setModalProdutosVisible] = useState(false);
  const [listaProdutos, setListaProdutos] = useState([]);
  const [modalAjusteVisible, setModalAjusteVisible] = useState(false);
  const [produtoParaAjuste, setProdutoParaAjuste] = useState(null);
  const [novaQuantidade, setNovaQuantidade] = useState(0);
  const [atualizandoEstoque, setAtualizandoEstoque] = useState(false);

  const [notification, setNotification] = useState({ visible: false, message: '', type: 'success' });
  const [modalConfirmarLimpeza, setModalConfirmarLimpeza] = useState(false);
  
  const showBanner = (message, type = 'success') => {
    setNotification({ visible: true, message, type });
    setTimeout(() => setNotification({ visible: false, message: '', type: 'success' }), 3000);
  };

  // === LÓGICA DE AVISOS ===
  const carregarNotificacoes = async () => {
    setLoadingAvisos(true);
    const { data } = await supabase
      .from('notificacoes')
      .select('id, mensagem, tipo, lida, created_at')
      .eq('loja_id', lojaAtiva.id)
      .order('created_at', { ascending: false });

    if (data) {
      setNotificacoes(data);
      const naoLidas = data.filter(n => !n.lida).map(n => n.id);
      
      if (permissoesAtivas?.gerenciar_avisos && naoLidas.length > 0 && !selecionando) {
        await supabase.from('notificacoes').update({ lida: true }).in('id', naoLidas);
        setUnreadNotifCount(0);
      } else {
        setUnreadNotifCount(naoLidas.length);
      }
    }
    setLoadingAvisos(false);
  };

  const toggleSelecao = (id) => {
    if (selecionados.includes(id)) setSelecionados(selecionados.filter(item => item !== id));
    else setSelecionados([...selecionados, id]);
  };

  const handleApagarSelecionadas = async () => {
    try {
      let novasNotificacoes = [];
      if (selecionando) {
        await supabase.from('notificacoes').delete().in('id', selecionados);
        novasNotificacoes = notificacoes.filter(n => !selecionados.includes(n.id));
      } else if (notifFocada) {
        await supabase.from('notificacoes').delete().eq('id', notifFocada.id);
        novasNotificacoes = notificacoes.filter(n => n.id !== notifFocada.id);
      } else {
        await supabase.from('notificacoes').delete().eq('loja_id', lojaAtiva.id);
        novasNotificacoes = [];
      }
      setNotificacoes(novasNotificacoes);
      setUnreadNotifCount(novasNotificacoes.filter(n => !n.lida).length);
      sairModoSelecao();
      setNotifFocada(null);
      setModalConfirmarVisible(false);
      setModalAcaoUnicaVisible(false);
    } catch (error) {
      Alert.alert("Erro", "Não foi possível apagar os avisos.");
    }
  };

  const handleMarcarComoLida = async (lidaStatus) => {
    const ids = selecionando ? selecionados : [notifFocada.id];
    await supabase.from('notificacoes').update({ lida: lidaStatus }).in('id', ids);
    const novasNotificacoes = notificacoes.map(n => ids.includes(n.id) ? { ...n, lida: lidaStatus } : n);
    setNotificacoes(novasNotificacoes);
    setUnreadNotifCount(novasNotificacoes.filter(n => !n.lida).length);
    sairModoSelecao();
    setModalAcaoUnicaVisible(false);
  };

  const sairModoSelecao = () => {
    setSelecionando(false);
    setSelecionados([]);
  };

  // === LÓGICA DE AFAZERES ===
  const carregarLembretes = async () => {
    setLoadingLembretes(true);
    const { data: lembretesData } = await supabase
      .from('lembretes')
      .select('*')
      .eq('loja_id', lojaAtiva.id);

    if (lembretesData) {
      // 1. BUSCA DE NOMES
      const ids = [...new Set(lembretesData.map(l => l.concluido_por_id).filter(id => id))];
      const prodIds = [...new Set(lembretesData.map(l => l.produto_id).filter(id => id))];
      
      let produtosMap = {};
      if (prodIds.length > 0) {
        const { data: prods } = await supabase.from('produtos').select('id, nome').in('id', prodIds);
        if (prods) prods.forEach(p => { produtosMap[p.id] = p.nome });
      }

      let perfisMap = {};
      if (ids.length > 0) {
        const { data: perfis } = await supabase.from('perfis').select('id, nome').in('id', ids);
        if (perfis) perfis.forEach(p => { perfisMap[p.id] = p.nome });
      }

      // 2. RADAR DE PRIORIDADES E MAPEAMENTO
      const alertasGerados = [];
      const atualizacoesPrioridade = [];
      
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const lembretesComNomes = lembretesData.map(l => {
        if (!l.concluido && l.data_limite) {
          const limite = new Date(l.data_limite);

          if (!isNaN(limite.getTime())) {
            limite.setHours(0, 0, 0, 0);
            const diffDias = Math.ceil((limite.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
            
            // Nova Hierarquia de Níveis:
            let nivelAtual = 1; 
            if (diffDias < 0) nivelAtual = 4;      // ATRASADA (Nível Crítico)
            else if (diffDias === 0) nivelAtual = 3; // VENCE HOJE (Nível Urgente)
            else if (diffDias <= 2) nivelAtual = 2;  // ATENÇÃO (1 ou 2 dias)

            const nivelNotificado = l.prioridade_notificada || 1;

            // Dispara apenas se a urgência aumentou
            if (nivelAtual > nivelNotificado) {
              let urgenciaStr = "";
              
              if (nivelAtual === 4) {
                urgenciaStr = "está ATRASADA";
              } else if (nivelAtual === 3) {
                urgenciaStr = "vence HOJE";
              } else {
                urgenciaStr = `entrou em estado de ATENÇÃO (vence em ${diffDias} ${diffDias === 1 ? 'dia' : 'dias'})`;
              }
              
              alertasGerados.push({
                loja_id: lojaAtiva.id,
                mensagem: `Urgência: A tarefa "${l.texto}" ${urgenciaStr}!`,
                tipo: 'alerta_tarefa'
              });

              atualizacoesPrioridade.push({
                id: l.id,
                prioridade_notificada: nivelAtual
              });
            }
          }
        }

        return {
          ...l,
          nome_concluido_por: l.concluido_por_id ? perfisMap[l.concluido_por_id] : null,
          nome_produto: l.produto_id ? produtosMap[l.produto_id] : null
        };
      });

      // 3. DISPARO DE AVISOS NO BANCO
      if (alertasGerados.length > 0) {
        await supabase.from('notificacoes').insert(alertasGerados);
        setUnreadNotifCount(prev => prev + alertasGerados.length);
        
        for (const atualizacao of atualizacoesPrioridade) {
          await supabase.from('lembretes')
            .update({ prioridade_notificada: atualizacao.prioridade_notificada })
            .eq('id', atualizacao.id);
        }
      }

      // 4. ORDENAÇÃO INTELIGENTE
      const lembretesOrdenados = lembretesComNomes.sort((a, b) => {
        if (a.concluido && !b.concluido) return 1;
        if (!a.concluido && b.concluido) return -1;

        if (!a.concluido && !b.concluido) {
          if (a.data_limite && !b.data_limite) return -1; 
          if (!a.data_limite && b.data_limite) return 1;  

          if (a.data_limite && b.data_limite) {
            const dataA = new Date(a.data_limite); dataA.setHours(0, 0, 0, 0);
            const dataB = new Date(b.data_limite); dataB.setHours(0, 0, 0, 0);
            
            if (dataA.getTime() !== dataB.getTime()) {
              return dataA.getTime() - dataB.getTime();
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setLembretes(lembretesOrdenados);
    }
    setLoadingLembretes(false);
  };

  // Abre apenas o modal de confirmação
  const handleLimparConcluidas = () => {
    setModalConfirmarLimpeza(true);
  };

  // Executa a limpeza de fato após a confirmação
  const executarLimpezaDefinitiva = async () => {
    setModalConfirmarLimpeza(false);
    
    const { error } = await supabase
      .from('lembretes')
      .delete()
      .eq('loja_id', lojaAtiva.id)
      .eq('concluido', true);

    if (!error) {
      showBanner("Tarefas concluídas removidas!", "success");
      carregarLembretes();
    } else {
      showBanner("Erro ao limpar tarefas.", "error");
    }
  };

  // AGORA SIM, a função de abrir o modal no lugar certo (fora do carregarLembretes)
  const abrirModalProdutos = async () => {
    const { data } = await supabase.from('produtos').select('id, nome').eq('loja_id', lojaAtiva.id).order('nome');
    if (data) setListaProdutos(data);
    setModalProdutosVisible(true);
  };

  const handleCriarLembreteRapido = async () => {
    if (!novoLembrete.trim()) return;
    setCriandoLembrete(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('lembretes').insert([{
      loja_id: lojaAtiva.id,
      texto: novoLembrete.trim(),
      criador_id: user.id,
      data_limite: dataLimite ? dataLimite.toISOString() : null,
      produto_id: produtoSelecionado ? produtoSelecionado.id : null
    }]);

    if (!error) {
      setNovoLembrete('');
      setDataLimite(null);
      setProdutoSelecionado(null);
      carregarLembretes();
    } else {
      console.log("ERRO AO CRIAR TAREFA:", error);
      Alert.alert("Erro", "Não foi possível criar a tarefa.");
    }
    setCriandoLembrete(false);
  };

  const onChangeDate = async (event, selectedDate) => {
    setShowDatePicker(false);
    
    if (event.type === 'dismissed' || !selectedDate) {
      setLembreteEditandoData(null); 
      return;
    }

    // Cenário A: Editando a data de uma tarefa que já existe
    if (lembreteEditandoData) {
      const tarefaId = lembreteEditandoData.id;
      
      setLembretes(lembretes.map(l => l.id === tarefaId ? { ...l, data_limite: selectedDate.toISOString() } : l));
      
      // Salva no Supabase E reseta o radar de notificações!
      const { error } = await supabase
        .from('lembretes')
        .update({ 
          data_limite: selectedDate.toISOString(),
          prioridade_notificada: 1 
        })
        .eq('id', tarefaId);

      if (error) {
        Alert.alert("Erro", "Não foi possível atualizar o prazo.");
        carregarLembretes();
      } else {
        carregarLembretes(); 
      }
      
      setLembreteEditandoData(null); // Limpa o estado após o sucesso
    } 
    // Cenário B: Definindo a data para um NOVO lembrete
    else {
      setDataLimite(selectedDate);
    }
  };

  // Função para calcular a cor da borda automaticamente baseada na data limite
  const getCorPrioridadeAutomatica = (dataLimite, concluido) => {
    if (concluido) return '#eee'; // Concluído fica neutro
    if (!dataLimite) return '#e2e8f0'; // Sem prazo fica com a cor padrão do card

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const prazo = new Date(dataLimite);
    prazo.setHours(0, 0, 0, 0);

    const diffTime = prazo - hoje;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Converte milissegundos para dias

    if (diffDays < 0) return '#d9534f'; // Vermelho: Atrasado
    if (diffDays === 0) return '#ff3b30'; // Vermelho Forte: É para hoje!
    if (diffDays <= 2) return '#ffc107'; // Amarelo: Faltam 1 ou 2 dias
    return '#4CAF50'; // Verde: Faltam 3 dias ou mais
  };

  // Função para verificar se a data limite é estritamente anterior a hoje (ignorando horas)
  const isAtrasado = (dataLimite, concluido) => {
    if (concluido || !dataLimite) return false;
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const prazo = new Date(dataLimite);
    prazo.setHours(0, 0, 0, 0); // Zera o relógio do prazo
    
    return prazo < hoje;
  };

  const toggleConcluido = async (tarefa) => {
    const { data: { user } } = await supabase.auth.getUser();
    const novoStatus = !tarefa.concluido;
    
    // Se estiver a marcar como concluído, guarda o seu ID. Se estiver a desmarcar, limpa o ID.
    const concluidoPor = novoStatus ? user.id : null;

    // Atualiza o estado local para ser instantâneo
    setLembretes(lembretes.map(l => l.id === tarefa.id ? { 
      ...l, 
      concluido: novoStatus, 
      concluido_por_id: concluidoPor 
    } : l));
    
    // Envia para o banco de dados
    await supabase.from('lembretes').update({ 
      concluido: novoStatus,
      concluido_por_id: concluidoPor
    }).eq('id', tarefa.id);
    
    // Recarrega para puxar os nomes atualizados dos perfis
    carregarLembretes();
  };

  const apagarLembrete = async (id) => {
    setLembretes(lembretes.filter(l => l.id !== id));
    await supabase.from('lembretes').delete().eq('id', id);
  };

  useEffect(() => {
    carregarNotificacoes();
    carregarLembretes();
  }, [lojaAtiva]);

  const abrirAjusteRapido = async (produtoId) => {
    // Busca os dados frescos e as configurações de notificação do produto
    const { data, error } = await supabase
      .from('produtos')
      .select('id, nome, estoque_atual, estoque_minimo, notificar_minimo, notificar_movimentacao')
      .eq('id', produtoId)
      .single();

    if (error) console.log("Erro ao buscar produto:", error);

    if (data) {
      setProdutoParaAjuste(data);
      setNovaQuantidade(data.estoque_atual || 0);
      setModalAjusteVisible(true);
    }
  };

  const salvarAjusteEstoque = async () => {
    // Validação: Se não mudou nada, só fecha a janela
    if (novaQuantidade === produtoParaAjuste.estoque_atual) {
      setModalAjusteVisible(false);
      return;
    }

    setAtualizandoEstoque(true);
    const diferenca = novaQuantidade - produtoParaAjuste.estoque_atual;
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('produtos')
      .update({ estoque_atual: novaQuantidade })
      .eq('id', produtoParaAjuste.id);

    if (!error) {
      // REGISTRA NO HISTÓRICO!
      await supabase.from('movimentacoes').insert([{
        produto_id: produtoParaAjuste.id,
        usuario_id: user.id,
        tipo: diferenca > 0 ? 'ENTRADA' : 'SAIDA',
        quantidade: Math.abs(diferenca),
        preco_custo_hist: produtoParaAjuste.preco_custo,
        preco_venda_hist: produtoParaAjuste.preco_venda,
        is_venda: false,
        observacao: 'Ajuste via aba de Tarefas'
      }]);

      // --- DISPARO DE NOTIFICAÇÕES (ALARMES) ---
      const alertas = [];
      
      // 1. Verifica se tem Alerta de Movimentação ligado
      if (produtoParaAjuste.notificar_movimentacao) {
        alertas.push({
          loja_id: lojaAtiva.id,
          mensagem: `Ajuste manual: ${diferenca > 0 ? 'Entrada' : 'Saída'} de ${Math.abs(diferenca)} unid. de ${produtoParaAjuste.nome}.`,
          tipo: 'movimentacao',
        });
      }

      // 2. Verifica se tem Alerta de Estoque Mínimo ligado e se atingiu o limite
      if (produtoParaAjuste.notificar_minimo && novaQuantidade <= (produtoParaAjuste.estoque_minimo || 0)) {
        alertas.push({
          loja_id: lojaAtiva.id,
          mensagem: `Atenção: O estoque de ${produtoParaAjuste.nome} chegou a ${novaQuantidade} (Mínimo: ${produtoParaAjuste.estoque_minimo}).`,
          tipo: 'alerta_minimo',
        });
      }

      // Se houver algum alerta gerado, envia para a tabela de notificações
      if (alertas.length > 0) {
        await supabase.from('notificacoes').insert(alertas);
        
        setUnreadNotifCount(prev => prev + alertas.length);
      }
      // ------------------------------------------

      showBanner("Estoque atualizado!", "success");
      setModalAjusteVisible(false);
      carregarLembretes();
      setProducts(products.map(p => p.id === produtoParaAjuste.id ? { ...p, estoque_atual: novaQuantidade } : p));
    } else {
      showBanner("Não foi possível atualizar o estoque.", "error");
    }
    setAtualizandoEstoque(false);
  };

  // Calcula quantas tarefas estão concluídas para mostrar no botão
  const qtdConcluidas = lembretes.filter(l => l.concluido).length;

  // Função para dar identidade visual a cada tipo de aviso
  const getVisualAviso = (tipo) => {
    switch (tipo) {
      case 'alerta_tarefa': 
        return { icone: 'alarm-outline', corIcone: '#ef4444', corFundo: '#fee2e2' }; // Vermelho (Urgência/Tempo)
      case 'alerta_minimo': 
        return { icone: 'warning-outline', corIcone: '#f59e0b', corFundo: '#fef3c7' }; // Amarelo (Atenção/Estoque Baixo)
      case 'movimentacao': 
        return { icone: 'swap-horizontal-outline', corIcone: '#3b82f6', corFundo: '#dbeafe' }; // Azul (Ajustes de Estoque)
      default: 
        return { icone: 'notifications-outline', corIcone: '#64748b', corFundo: '#f1f5f9' }; // Cinza (Padrão)
    }
  };
  
  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      
      {/* NOTIFICAÇÃO VISUAL DO BANNER */}
      {notification.visible && (
        <View style={[
          styles.topNotification, 
          { 
            backgroundColor: notification.type === 'error' ? 'rgba(244, 67, 54, 0.9)' : 'rgba(76, 175, 80, 0.9)', 
            zIndex: 999, 
            top: 20,
            position: 'absolute', left: 20, right: 20, padding: 15, borderRadius: 8, alignItems: 'center'
          }
        ]}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
            {notification.message}
          </Text>
        </View>
      )}

      {/* CABEÇALHO DINÂMICO */}
      <View style={{ paddingTop: Platform.OS === 'android' ? 40 : 50, paddingBottom: 15, paddingHorizontal: 20, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: '#eee' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => selecionando ? sairModoSelecao() : navigation.goBack()} style={{ marginRight: 15 }}>
            <Ionicons name={selecionando ? "close" : "arrow-back"} size={28} color="#333" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333' }}>
            {selecionando ? `${selecionados.length} selecionados` : (abaAtiva === 'avisos' ? "Avisos" : "Tarefas")}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {!selecionando ? (
            <>
              {abaAtiva === 'avisos' && permissoesAtivas?.gerenciar_avisos && (
                <TouchableOpacity onPress={() => setSelecionando(true)} style={{ marginRight: 15 }}>
                  <Text style={{ color: '#007AFF', fontWeight: 'bold' }}>Selecionar</Text>
                </TouchableOpacity>
              )}
              {abaAtiva === 'avisos' && permissoesAtivas?.gerenciar_avisos && notificacoes.length > 0 && (
                <TouchableOpacity onPress={() => { setNotifFocada(null); setModalConfirmarVisible(true); }}>
                  <Ionicons name="trash-outline" size={24} color="#d9534f" />
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => handleMarcarComoLida(true)} style={{ marginRight: 20 }} disabled={selecionados.length === 0}>
                <Ionicons name="mail-open-outline" size={24} color={selecionados.length === 0 ? "#ccc" : "#007AFF"} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleMarcarComoLida(false)} style={{ marginRight: 20 }} disabled={selecionados.length === 0}>
                <Ionicons name="mail-unread-outline" size={24} color={selecionados.length === 0 ? "#ccc" : "#007AFF"} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setModalConfirmarVisible(true)} disabled={selecionados.length === 0}>
                <Ionicons name="trash-outline" size={24} color={selecionados.length === 0 ? "#ccc" : "#d9534f"} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* === CONTEÚDO DA ABA: AVISOS === */}
      {abaAtiva === 'avisos' && (
        loadingAvisos ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#007AFF" /></View>
        ) : notificacoes.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', padding: 20, paddingTop: '40%' }}>
            <Ionicons name="notifications-off-outline" size={64} color="#ccc" />
            <Text style={{ marginTop: 20, fontSize: 18, color: '#666', fontWeight: 'bold' }}>Nenhum aviso por aqui.</Text>
            <Text style={{ marginTop: 10, fontSize: 14, color: '#999', textAlign: 'center' }}>Quando produtos atingirem o estoque mínimo ou forem movimentados, você será avisado aqui.</Text>
          </View>
        ) : (
          <FlatList
            data={notificacoes}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ padding: 15 }}
            renderItem={({ item }) => {
              const isSelected = selecionados.includes(item.id);
              const isMinimo = item.tipo === 'alerta_minimo';
              return (
                <TouchableOpacity 
                  activeOpacity={0.7}
                  onPress={() => {
                    if (selecionando) toggleSelecao(item.id);
                    else if (permissoesAtivas?.gerenciar_avisos) {
                      setNotifFocada(item);
                      setModalAcaoUnicaVisible(true);
                    }
                  }}
                  style={{
                    backgroundColor: isSelected ? '#e6f2ff' : (item.lida ? '#fff' : '#f0f7ff'), 
                    padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', 
                    borderWidth: 1, borderColor: isSelected ? '#007AFF' : (item.lida ? '#eee' : '#b3d4ff'), elevation: 2
                  }}
                >
                  {selecionando && (
                    <View style={{ marginRight: 10 }}>
                      <Ionicons name={isSelected ? "checkbox" : "square-outline"} size={24} color={isSelected ? "#007AFF" : "#ccc"} />
                    </View>
                  )}
                  
                  {/* O ícone e a cor de fundo agora mudam de acordo com o tipo da notificação */}
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: getVisualAviso(item.tipo).corFundo, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    <Ionicons name={getVisualAviso(item.tipo).icone} size={20} color={getVisualAviso(item.tipo).corIcone} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: '#333', fontWeight: item.lida ? 'normal' : 'bold' }}>{item.mensagem}</Text>
                  </View>
                  {!item.lida && !selecionando && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#007AFF' }} />}
                </TouchableOpacity>
              );
            }}
          />
        )
      )}

      {/* === CONTEÚDO DA ABA: AFAZERES === */}
      {abaAtiva === 'afazeres' && (
        <View style={{ flex: 1 }}>
          
          {/* 1. BARRA DE CRIAR RÁPIDA (Protegida) */}
          {permissoesAtivas?.gerenciar_tarefas && (
            <View style={{ paddingHorizontal: 20, paddingTop: 15, paddingBottom: 5, zIndex: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 8, alignItems: 'center', paddingHorizontal: 10, height: 48 }}>
                  <Ionicons name="add-circle-outline" size={22} color="#64748b" />
                  <TextInput
                    placeholder="Adicione uma tarefa..."
                    placeholderTextColor="#94a3b8"
                    value={novoLembrete}
                    onChangeText={setNovoLembrete}
                    style={{ flex: 1, paddingLeft: 10, color: '#333', height: '100%' }}
                    onSubmitEditing={handleCriarLembreteRapido}
                  />

                  {/* BOTÃO DE VINCULAR PRODUTO */}
                  <TouchableOpacity onPress={abrirModalProdutos} style={{ paddingHorizontal: 5 }}>
                    <Ionicons name="cube" size={22} color={produtoSelecionado ? "#007AFF" : "#94a3b8"} />
                  </TouchableOpacity>

                  {/* BOTÃO DO CALENDÁRIO */}
                  <TouchableOpacity onPress={() => setShowDatePicker(true)} style={{ paddingHorizontal: 5 }}>
                    <Ionicons name="calendar" size={22} color={dataLimite ? "#007AFF" : "#94a3b8"} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={handleCriarLembreteRapido}
                  disabled={criandoLembrete || !novoLembrete}
                  style={{ marginLeft: 10, backgroundColor: (criandoLembrete || !novoLembrete) ? '#a0cbfc' : '#007AFF', width: 48, height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center' }}
                >
                  {criandoLembrete ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={20} color="#fff" />}
                </TouchableOpacity>
              </View>
              
              {/* TEXTO AVISANDO O PRODUTO E A DATA ESCOLHIDA ANTES DE ENVIAR */}
              {produtoSelecionado && (
                <Text style={{ color: '#007AFF', fontSize: 12, marginTop: 5, marginLeft: 5, fontWeight: 'bold' }}>
                  <Ionicons name="cube" size={12} /> Produto: {produtoSelecionado.nome}
                  <Text onPress={() => setProdutoSelecionado(null)} style={{ color: '#d9534f' }}> (Remover)</Text>
                </Text>
              )}
              {dataLimite && (
                <Text style={{ color: '#007AFF', fontSize: 12, marginTop: 5, marginLeft: 5, fontWeight: 'bold' }}>
                  <Ionicons name="calendar" size={12} /> Prazo: {dataLimite.toLocaleDateString('pt-BR')} 
                  <Text onPress={() => setDataLimite(null)} style={{ color: '#d9534f' }}> (Remover)</Text>
                </Text>
              )}

              {/* O MODAL DO CALENDÁRIO INVISÍVEL */}
              {showDatePicker && (
                <DateTimePicker
                  value={dataLimite || new Date()}
                  mode="date"
                  display="default"
                  onChange={onChangeDate}
                />
              )}

              {/* EFEITO DEGRADÊ (FUMAÇA) */}
              <LinearGradient
                colors={['#f5f5f5', 'rgba(245, 245, 245, 0)']}
                style={{ position: 'absolute', left: 0, right: 0, bottom: -20, height: 20, zIndex: 10 }}
                pointerEvents="none"
              />
            </View>
          )}

          {/* LISTA DE TAREFAS */}
          {loadingLembretes ? (
             <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 20 }} />
          ) : lembretes.length === 0 ? (
             <View style={{ flex: 1, alignItems: 'center', padding: 20, paddingTop: '30%' }}>
               <Ionicons name="checkmark-done-circle-outline" size={64} color="#ccc" />
               <Text style={{ marginTop: 20, fontSize: 16, color: '#666', fontWeight: 'bold' }}>Tudo limpo por aqui!</Text>
               <Text style={{ marginTop: 10, fontSize: 14, color: '#999', textAlign: 'center' }}>Adicione tarefas acima para a sua equipe.</Text>
             </View>
          ) : (
             <FlatList
               data={lembretes}
               keyExtractor={item => item.id.toString()}
               contentContainerStyle={{ padding: 15, paddingBottom: 100 }}
               
               // 2. BOTÃO DE LIMPAR (Protegido)
               ListFooterComponent={() => {
                 if (qtdConcluidas === 0 || !permissoesAtivas?.gerenciar_tarefas) return null; 
                 
                 return (
                   <TouchableOpacity 
                     onPress={handleLimparConcluidas}
                     style={{ marginTop: 20, marginBottom: 10, padding: 15, backgroundColor: '#fff', borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#fca5a5', borderStyle: 'dashed' }}
                   >
                     <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>
                       <Ionicons name="trash-bin-outline" size={16} /> Limpar {qtdConcluidas} {qtdConcluidas === 1 ? 'tarefa concluída' : 'tarefas concluídas'}
                     </Text>
                   </TouchableOpacity>
                 );
               }}

               renderItem={({ item }) => (
                  <View style={{ backgroundColor: item.concluido ? '#f8f9fa' : '#fff', padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: item.concluido ? '#eee' : '#e2e8f0', elevation: item.concluido ? 0 : 1, borderLeftWidth: item.concluido ? 1 : 4, borderLeftColor: getCorPrioridadeAutomatica(item.data_limite, item.concluido) }}>
                     
                     {/* CHECKBOX (Livre para todos clicarem) */}
                     <TouchableOpacity onPress={() => toggleConcluido(item)} style={{ marginRight: 15 }}>
                        <Ionicons name={item.concluido ? "checkmark-circle" : "ellipse-outline"} size={28} color={item.concluido ? "#4CAF50" : "#ccc"} />
                     </TouchableOpacity>

                     <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, color: item.concluido ? '#999' : '#333', textDecorationLine: item.concluido ? 'line-through' : 'none', fontWeight: item.concluido ? 'normal' : '500' }}>{item.texto}</Text>
                        
                        {/* 3. PRAZO CLICÁVEL (Protegido) */}
                        <TouchableOpacity 
                          onPress={() => {
                            if (permissoesAtivas?.gerenciar_tarefas) {
                              setLembreteEditandoData(item);
                              setShowDatePicker(true);
                            } else {
                              showBanner("Sem permissão para alterar prazos.", "error");
                            }
                          }}
                          style={{ marginTop: 4 }}
                          activeOpacity={permissoesAtivas?.gerenciar_tarefas ? 0.2 : 1}
                        >
                          <Text style={{ fontSize: 12, color: (!item.data_limite || item.concluido) ? '#94a3b8' : getCorPrioridadeAutomatica(item.data_limite, item.concluido), fontWeight: 'bold' }}>
                            <Ionicons name="calendar-outline" size={12} /> Prazo: {item.data_limite ? new Date(item.data_limite).toLocaleDateString('pt-BR') : "Não definido"}
                            {isAtrasado(item.data_limite, item.concluido) && " (Atrasado)"}
                          </Text>
                        </TouchableOpacity>

                        {/* ETIQUETA DO PRODUTO (Protegida pela permissão de quantidades) */}
                        {item.produto_id && item.nome_produto && (
                          <TouchableOpacity 
                            onPress={() => {
                              if (permissoesAtivas?.quantidades) {
                                abrirAjusteRapido(item.produto_id);
                              } else {
                                showBanner("Sem permissão para alterar o estoque.", "error");
                              }
                            }} 
                            style={{ 
                              marginTop: 8, 
                              backgroundColor: item.concluido ? '#f8f9fa' : '#f0f7ff', 
                              paddingVertical: 4, 
                              paddingHorizontal: 8, 
                              borderRadius: 6, 
                              alignSelf: 'flex-start', 
                              flexDirection: 'row', 
                              alignItems: 'center', 
                              borderWidth: 1, 
                              borderColor: item.concluido ? '#eee' : '#cce4ff' 
                            }}
                            activeOpacity={permissoesAtivas?.quantidades ? 0.2 : 1}
                          >
                            <Ionicons name="cube-outline" size={14} color={item.concluido ? '#999' : '#007AFF'} style={{ marginRight: 4 }} />
                            <Text style={{ fontSize: 12, color: item.concluido ? '#999' : '#007AFF', fontWeight: '600' }}>{item.nome_produto}</Text>
                          </TouchableOpacity>
                        )}

                        {/* EXIBE QUEM CONCLUIU */}
                        {item.concluido && item.nome_concluido_por && (
                            <Text style={{ fontSize: 11, color: '#4CAF50', marginTop: 4, fontStyle: 'italic' }}>
                              <Ionicons name="checkmark-done" size={12} /> Feito por: {item.nome_concluido_por}
                            </Text>
                        )}
                     </View>

                     {/* 4. LIXEIRA (Protegida) */}
                     {permissoesAtivas?.gerenciar_tarefas && (
                       <TouchableOpacity onPress={() => apagarLembrete(item.id)} style={{ padding: 5 }}>
                          <Ionicons name="trash-outline" size={22} color="#d9534f" />
                       </TouchableOpacity>
                     )}
                  </View>
               )}
             />
          )}
        </View>
      )}

      {/* MODAL DE CONFIRMAR APAGAR AVISOS (Mantido intacto) */}
      <Modal visible={modalConfirmarVisible} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, width: '85%', overflow: 'hidden' }}>
            <View style={{ padding: 20, backgroundColor: '#f8f9fa', borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="warning" size={22} color="#d9534f" style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>Apagar Avisos?</Text>
            </View>
            <View style={{ padding: 20 }}>
              <Text style={{ fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 20 }}>
                {selecionando 
                  ? `Deseja apagar os ${selecionados.length} avisos selecionados?` 
                  : notifFocada 
                    ? "Deseja apagar este aviso?"
                    : "Deseja limpar todas as notificações da sua caixa de entrada?"}
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <TouchableOpacity onPress={() => setModalConfirmarVisible(false)} style={{ flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 8, marginRight: 10 }}>
                  <Text style={{ color: '#555', fontWeight: 'bold' }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleApagarSelecionadas} style={{ flex: 1, backgroundColor: '#d9534f', paddingVertical: 12, alignItems: 'center', borderRadius: 8 }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Sim, apagar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DE AÇÃO ÚNICA AVISOS (Mantido intacto) */}
      <Modal visible={modalAcaoUnicaVisible} transparent={true} animationType="fade">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setModalAcaoUnicaVisible(false)}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, width: '80%', overflow: 'hidden' }}>
            <TouchableOpacity onPress={() => handleMarcarComoLida(!notifFocada?.lida)} style={{ padding: 18, borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name={notifFocada?.lida ? "mail-unread-outline" : "mail-open-outline"} size={22} color="#007AFF" style={{ marginRight: 15 }} />
              <Text style={{ fontSize: 16, color: '#333' }}>{notifFocada?.lida ? "Marcar como não lida" : "Marcar como lida"}</Text>
            </TouchableOpacity>
            
            {permissoesAtivas?.gerenciar_avisos && (
              <TouchableOpacity onPress={() => {
                setModalAcaoUnicaVisible(false);
                setTimeout(() => setModalConfirmarVisible(true), 150);
              }} style={{ padding: 18, flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="trash-outline" size={22} color="#d9534f" style={{ marginRight: 15 }} />
                <Text style={{ fontSize: 16, color: '#d9534f' }}>Apagar aviso</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL DE SELEÇÃO DE PRODUTOS */}
      <Modal visible={modalProdutosVisible} transparent={true} animationType="fade">
        <TouchableOpacity 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          activeOpacity={1}
          onPress={() => setModalProdutosVisible(false)}
        >
          <TouchableWithoutFeedback>
            <View style={{ backgroundColor: '#fff', borderRadius: 15, width: '90%', padding: 20, maxHeight: '80%', shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333' }}>Vincular Produto</Text>
                <TouchableOpacity onPress={() => setModalProdutosVisible(false)}>
                  <Ionicons name="close" size={28} color="#999" />
                </TouchableOpacity>
              </View>

              {listaProdutos.length === 0 ? (
                <ActivityIndicator size="large" color="#007AFF" style={{ marginVertical: 30 }} />
              ) : (
                <FlatList
                  data={listaProdutos}
                  keyExtractor={item => item.id.toString()}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={{ padding: 15, borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', alignItems: 'center' }}
                      onPress={() => {
                        setProdutoSelecionado(item);
                        setModalProdutosVisible(false);
                      }}
                    >
                      <Ionicons name="cube-outline" size={20} color="#64748b" style={{ marginRight: 10 }} />
                      <Text style={{ fontSize: 16, color: '#333' }}>{item.nome}</Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* MODAL DE AJUSTE RÁPIDO DE ESTOQUE */}
      <Modal visible={modalAjusteVisible} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 15, width: '85%', padding: 20, alignItems: 'center', elevation: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 5 }}>Ajuste de Estoque</Text>
            <Text style={{ fontSize: 16, color: '#666', marginBottom: 20 }}>{produtoParaAjuste?.nome}</Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 25 }}>
              <TouchableOpacity 
                onPress={() => setNovaQuantidade(prev => Math.max(0, prev - 1))}
                style={{ backgroundColor: '#f1f5f9', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' }}
              >
                <Ionicons name="remove" size={24} color="#333" />
              </TouchableOpacity>

              <TextInput 
                keyboardType="numeric"
                value={String(novaQuantidade)}
                onChangeText={(txt) => setNovaQuantidade(Number(txt.replace(/[^0-9]/g, '')))}
                style={{ fontSize: 32, fontWeight: 'bold', marginHorizontal: 30, color: '#007AFF', textAlign: 'center', width: 80 }}
                selectTextOnFocus={true}
              />

              <TouchableOpacity 
                onPress={() => setNovaQuantidade(prev => prev + 1)}
                style={{ backgroundColor: '#f1f5f9', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' }}
              >
                <Ionicons name="add" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {/* BOTÕES NO PADRÃO DO APP */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 10 }}>
              <TouchableOpacity 
                onPress={() => setModalAjusteVisible(false)}
                style={{ flex: 1, backgroundColor: '#e2e8f0', padding: 15, borderRadius: 8, alignItems: 'center', marginRight: 10 }}
              >
                <Text style={{ color: '#64748b', fontWeight: 'bold', fontSize: 16 }}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={salvarAjusteEstoque}
                disabled={atualizandoEstoque}
                style={{ flex: 1, backgroundColor: '#007AFF', padding: 15, borderRadius: 8, alignItems: 'center' }}
              >
                {atualizandoEstoque ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Confirmar</Text>}
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (PADRÃO DO APP) */}
      <Modal visible={modalConfirmarLimpeza} transparent={true} animationType="fade">
        <TouchableOpacity 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          activeOpacity={1}
          onPress={() => setModalConfirmarLimpeza(false)}
        >
          <TouchableWithoutFeedback>
            <View style={{ backgroundColor: '#fff', borderRadius: 15, width: '85%', padding: 25, elevation: 10 }}>
              
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <View style={{ backgroundColor: '#fee2e2', padding: 15, borderRadius: 50, marginBottom: 15 }}>
                  <Ionicons name="trash" size={30} color="#ef4444" />
                </View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333', textAlign: 'center' }}>Limpar Tarefas</Text>
                <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 10, lineHeight: 20 }}>
                  Tem certeza que deseja apagar permanentemente todas as tarefas concluídas? Esta ação não pode ser desfeita.
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                <TouchableOpacity 
                  onPress={() => setModalConfirmarLimpeza(false)}
                  style={{ flex: 1, backgroundColor: '#e2e8f0', padding: 15, borderRadius: 8, alignItems: 'center', marginRight: 10 }}
                >
                  <Text style={{ color: '#64748b', fontWeight: 'bold' }}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={executarLimpezaDefinitiva}
                  style={{ flex: 1, backgroundColor: '#ef4444', padding: 15, borderRadius: 8, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Limpar</Text>
                </TouchableOpacity>
              </View>

            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

    </View>
  );
};

// ----------------------
// SCREEN: HISTÓRICO DE MOVIMENTAÇÕES
// ----------------------

const NotificacoesScreen = ({ navigation }) => {
  const lojaAtiva = useStore(state => state.lojaAtiva);
  const permissoesAtivas = useStore(state => state.permissoesAtivas);
  const setUnreadNotifCount = useStore(state => state.setUnreadNotifCount);
  const { setProdutoParaEditarId } = useStore();
  const products = useStore(state => state.products);
  const setProducts = useStore(state => state.setProducts);

  // --- ESTADOS: AVISOS (Originais) ---
  const [notificacoes, setNotificacoes] = useState([]);
  const [loadingAvisos, setLoadingAvisos] = useState(true);
  const [selecionando, setSelecionando] = useState(false);
  const [selecionados, setSelecionados] = useState([]);
  const [modalConfirmarVisible, setModalConfirmarVisible] = useState(false);
  const [modalAcaoUnicaVisible, setModalAcaoUnicaVisible] = useState(false);
  const [notifFocada, setNotifFocada] = useState(null);

  // --- ESTADOS: AFAZERES (Novos) ---
  const [abaAtiva, setAbaAtiva] = useState('avisos'); // 'avisos' ou 'afazeres'
  const [lembretes, setLembretes] = useState([]);
  const [loadingLembretes, setLoadingLembretes] = useState(true);
  const [novoLembrete, setNovoLembrete] = useState('');
  const [dataLimite, setDataLimite] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [criandoLembrete, setCriandoLembrete] = useState(false);
  const [lembreteEditandoData, setLembreteEditandoData] = useState(null);
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [modalProdutosVisible, setModalProdutosVisible] = useState(false);
  const [listaProdutos, setListaProdutos] = useState([]);
  const [modalAjusteVisible, setModalAjusteVisible] = useState(false);
  const [produtoParaAjuste, setProdutoParaAjuste] = useState(null);
  const [novaQuantidade, setNovaQuantidade] = useState(0);
  const [atualizandoEstoque, setAtualizandoEstoque] = useState(false);

  const [notification, setNotification] = useState({ visible: false, message: '', type: 'success' });
  const [modalConfirmarLimpeza, setModalConfirmarLimpeza] = useState(false);
  
  const showBanner = (message, type = 'success') => {
    setNotification({ visible: true, message, type });
    setTimeout(() => setNotification({ visible: false, message: '', type: 'success' }), 3000);
  };

  // === LÓGICA DE AVISOS ===
  const carregarNotificacoes = async () => {
    setLoadingAvisos(true);
    const { data } = await supabase
      .from('notificacoes')
      .select('id, mensagem, tipo, lida, created_at')
      .eq('loja_id', lojaAtiva.id)
      .order('created_at', { ascending: false });

    if (data) {
      setNotificacoes(data);
      const naoLidas = data.filter(n => !n.lida).map(n => n.id);
      
      if (permissoesAtivas?.gerenciar_avisos && naoLidas.length > 0 && !selecionando) {
        await supabase.from('notificacoes').update({ lida: true }).in('id', naoLidas);
        setUnreadNotifCount(0);
      } else {
        setUnreadNotifCount(naoLidas.length);
      }
    }
    setLoadingAvisos(false);
  };

  const toggleSelecao = (id) => {
    if (selecionados.includes(id)) setSelecionados(selecionados.filter(item => item !== id));
    else setSelecionados([...selecionados, id]);
  };

  const handleApagarSelecionadas = async () => {
    try {
      let novasNotificacoes = [];
      if (selecionando) {
        await supabase.from('notificacoes').delete().in('id', selecionados);
        novasNotificacoes = notificacoes.filter(n => !selecionados.includes(n.id));
      } else if (notifFocada) {
        await supabase.from('notificacoes').delete().eq('id', notifFocada.id);
        novasNotificacoes = notificacoes.filter(n => n.id !== notifFocada.id);
      } else {
        await supabase.from('notificacoes').delete().eq('loja_id', lojaAtiva.id);
        novasNotificacoes = [];
      }
      setNotificacoes(novasNotificacoes);
      setUnreadNotifCount(novasNotificacoes.filter(n => !n.lida).length);
      sairModoSelecao();
      setNotifFocada(null);
      setModalConfirmarVisible(false);
      setModalAcaoUnicaVisible(false);
    } catch (error) {
      Alert.alert("Erro", "Não foi possível apagar os avisos.");
    }
  };

  const handleMarcarComoLida = async (lidaStatus) => {
    const ids = selecionando ? selecionados : [notifFocada.id];
    await supabase.from('notificacoes').update({ lida: lidaStatus }).in('id', ids);
    const novasNotificacoes = notificacoes.map(n => ids.includes(n.id) ? { ...n, lida: lidaStatus } : n);
    setNotificacoes(novasNotificacoes);
    setUnreadNotifCount(novasNotificacoes.filter(n => !n.lida).length);
    sairModoSelecao();
    setModalAcaoUnicaVisible(false);
  };

  const sairModoSelecao = () => {
    setSelecionando(false);
    setSelecionados([]);
  };

  // === LÓGICA DE AFAZERES ===
  const carregarLembretes = async () => {
    setLoadingLembretes(true);
    const { data: lembretesData } = await supabase
      .from('lembretes')
      .select('*')
      .eq('loja_id', lojaAtiva.id);

    if (lembretesData) {
      // 1. BUSCA DE NOMES
      const ids = [...new Set(lembretesData.map(l => l.concluido_por_id).filter(id => id))];
      const prodIds = [...new Set(lembretesData.map(l => l.produto_id).filter(id => id))];
      
      let produtosMap = {};
      if (prodIds.length > 0) {
        const { data: prods } = await supabase.from('produtos').select('id, nome').in('id', prodIds);
        if (prods) prods.forEach(p => { produtosMap[p.id] = p.nome });
      }

      let perfisMap = {};
      if (ids.length > 0) {
        const { data: perfis } = await supabase.from('perfis').select('id, nome').in('id', ids);
        if (perfis) perfis.forEach(p => { perfisMap[p.id] = p.nome });
      }

      // 2. RADAR DE PRIORIDADES E MAPEAMENTO
      const alertasGerados = [];
      const atualizacoesPrioridade = [];
      
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const lembretesComNomes = lembretesData.map(l => {
        if (!l.concluido && l.data_limite) {
          const limite = new Date(l.data_limite);

          if (!isNaN(limite.getTime())) {
            limite.setHours(0, 0, 0, 0);
            const diffDias = Math.ceil((limite.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
            
            // Nova Hierarquia de Níveis:
            let nivelAtual = 1; 
            if (diffDias < 0) nivelAtual = 4;      // ATRASADA (Nível Crítico)
            else if (diffDias === 0) nivelAtual = 3; // VENCE HOJE (Nível Urgente)
            else if (diffDias <= 2) nivelAtual = 2;  // ATENÇÃO (1 ou 2 dias)

            const nivelNotificado = l.prioridade_notificada || 1;

            // Dispara apenas se a urgência aumentou
            if (nivelAtual > nivelNotificado) {
              let urgenciaStr = "";
              
              if (nivelAtual === 4) {
                urgenciaStr = "está ATRASADA";
              } else if (nivelAtual === 3) {
                urgenciaStr = "vence HOJE";
              } else {
                urgenciaStr = `entrou em estado de ATENÇÃO (vence em ${diffDias} ${diffDias === 1 ? 'dia' : 'dias'})`;
              }
              
              alertasGerados.push({
                loja_id: lojaAtiva.id,
                mensagem: `Urgência: A tarefa "${l.texto}" ${urgenciaStr}!`,
                tipo: 'alerta_tarefa'
              });

              atualizacoesPrioridade.push({
                id: l.id,
                prioridade_notificada: nivelAtual
              });
            }
          }
        }

        return {
          ...l,
          nome_concluido_por: l.concluido_por_id ? perfisMap[l.concluido_por_id] : null,
          nome_produto: l.produto_id ? produtosMap[l.produto_id] : null
        };
      });

      // 3. DISPARO DE AVISOS NO BANCO
      if (alertasGerados.length > 0) {
        await supabase.from('notificacoes').insert(alertasGerados);
        setUnreadNotifCount(prev => prev + alertasGerados.length);
        
        for (const atualizacao of atualizacoesPrioridade) {
          await supabase.from('lembretes')
            .update({ prioridade_notificada: atualizacao.prioridade_notificada })
            .eq('id', atualizacao.id);
        }
      }

      // 4. ORDENAÇÃO INTELIGENTE
      const lembretesOrdenados = lembretesComNomes.sort((a, b) => {
        if (a.concluido && !b.concluido) return 1;
        if (!a.concluido && b.concluido) return -1;

        if (!a.concluido && !b.concluido) {
          if (a.data_limite && !b.data_limite) return -1; 
          if (!a.data_limite && b.data_limite) return 1;  

          if (a.data_limite && b.data_limite) {
            const dataA = new Date(a.data_limite); dataA.setHours(0, 0, 0, 0);
            const dataB = new Date(b.data_limite); dataB.setHours(0, 0, 0, 0);
            
            if (dataA.getTime() !== dataB.getTime()) {
              return dataA.getTime() - dataB.getTime();
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setLembretes(lembretesOrdenados);
    }
    setLoadingLembretes(false);
  };

  // Abre apenas o modal de confirmação
  const handleLimparConcluidas = () => {
    setModalConfirmarLimpeza(true);
  };

  // Executa a limpeza de fato após a confirmação
  const executarLimpezaDefinitiva = async () => {
    setModalConfirmarLimpeza(false);
    
    const { error } = await supabase
      .from('lembretes')
      .delete()
      .eq('loja_id', lojaAtiva.id)
      .eq('concluido', true);

    if (!error) {
      showBanner("Tarefas concluídas removidas!", "success");
      carregarLembretes();
    } else {
      showBanner("Erro ao limpar tarefas.", "error");
    }
  };

  // AGORA SIM, a função de abrir o modal no lugar certo (fora do carregarLembretes)
  const abrirModalProdutos = async () => {
    const { data } = await supabase.from('produtos').select('id, nome').eq('loja_id', lojaAtiva.id).order('nome');
    if (data) setListaProdutos(data);
    setModalProdutosVisible(true);
  };

  const handleCriarLembreteRapido = async () => {
    if (!novoLembrete.trim()) return;
    setCriandoLembrete(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('lembretes').insert([{
      loja_id: lojaAtiva.id,
      texto: novoLembrete.trim(),
      criador_id: user.id,
      data_limite: dataLimite ? dataLimite.toISOString() : null,
      produto_id: produtoSelecionado ? produtoSelecionado.id : null
    }]);

    if (!error) {
      setNovoLembrete('');
      setDataLimite(null);
      setProdutoSelecionado(null);
      carregarLembretes();
    } else {
      console.log("ERRO AO CRIAR TAREFA:", error);
      Alert.alert("Erro", "Não foi possível criar a tarefa.");
    }
    setCriandoLembrete(false);
  };

  const onChangeDate = async (event, selectedDate) => {
    setShowDatePicker(false);
    
    if (event.type === 'dismissed' || !selectedDate) {
      setLembreteEditandoData(null); 
      return;
    }

    // Cenário A: Editando a data de uma tarefa que já existe
    if (lembreteEditandoData) {
      const tarefaId = lembreteEditandoData.id;
      
      setLembretes(lembretes.map(l => l.id === tarefaId ? { ...l, data_limite: selectedDate.toISOString() } : l));
      
      // Salva no Supabase E reseta o radar de notificações!
      const { error } = await supabase
        .from('lembretes')
        .update({ 
          data_limite: selectedDate.toISOString(),
          prioridade_notificada: 1 
        })
        .eq('id', tarefaId);

      if (error) {
        Alert.alert("Erro", "Não foi possível atualizar o prazo.");
        carregarLembretes();
      } else {
        carregarLembretes(); 
      }
      
      setLembreteEditandoData(null); // Limpa o estado após o sucesso
    } 
    // Cenário B: Definindo a data para um NOVO lembrete
    else {
      setDataLimite(selectedDate);
    }
  };

  // Função para calcular a cor da borda automaticamente baseada na data limite
  const getCorPrioridadeAutomatica = (dataLimite, concluido) => {
    if (concluido) return '#eee'; // Concluído fica neutro
    if (!dataLimite) return '#e2e8f0'; // Sem prazo fica com a cor padrão do card

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const prazo = new Date(dataLimite);
    prazo.setHours(0, 0, 0, 0);

    const diffTime = prazo - hoje;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Converte milissegundos para dias

    if (diffDays < 0) return '#d9534f'; // Vermelho: Atrasado
    if (diffDays === 0) return '#ff3b30'; // Vermelho Forte: É para hoje!
    if (diffDays <= 2) return '#ffc107'; // Amarelo: Faltam 1 ou 2 dias
    return '#4CAF50'; // Verde: Faltam 3 dias ou mais
  };

  // Função para verificar se a data limite é estritamente anterior a hoje (ignorando horas)
  const isAtrasado = (dataLimite, concluido) => {
    if (concluido || !dataLimite) return false;
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const prazo = new Date(dataLimite);
    prazo.setHours(0, 0, 0, 0); // Zera o relógio do prazo
    
    return prazo < hoje;
  };

  const toggleConcluido = async (tarefa) => {
    const { data: { user } } = await supabase.auth.getUser();
    const novoStatus = !tarefa.concluido;
    
    // Se estiver a marcar como concluído, guarda o seu ID. Se estiver a desmarcar, limpa o ID.
    const concluidoPor = novoStatus ? user.id : null;

    // Atualiza o estado local para ser instantâneo
    setLembretes(lembretes.map(l => l.id === tarefa.id ? { 
      ...l, 
      concluido: novoStatus, 
      concluido_por_id: concluidoPor 
    } : l));
    
    // Envia para o banco de dados
    await supabase.from('lembretes').update({ 
      concluido: novoStatus,
      concluido_por_id: concluidoPor
    }).eq('id', tarefa.id);
    
    // Recarrega para puxar os nomes atualizados dos perfis
    carregarLembretes();
  };

  const apagarLembrete = async (id) => {
    setLembretes(lembretes.filter(l => l.id !== id));
    await supabase.from('lembretes').delete().eq('id', id);
  };

  useEffect(() => {
    carregarNotificacoes();
    carregarLembretes();
  }, [lojaAtiva]);

  const abrirAjusteRapido = async (produtoId) => {
    // Busca os dados frescos e as configurações de notificação do produto
    const { data, error } = await supabase
      .from('produtos')
      .select('id, nome, estoque_atual, estoque_minimo, notificar_minimo, notificar_movimentacao')
      .eq('id', produtoId)
      .single();

    if (error) console.log("Erro ao buscar produto:", error);

    if (data) {
      setProdutoParaAjuste(data);
      setNovaQuantidade(data.estoque_atual || 0);
      setModalAjusteVisible(true);
    }
  };

  const salvarAjusteEstoque = async () => {
    // Validação: Se não mudou nada, só fecha a janela
    if (novaQuantidade === produtoParaAjuste.estoque_atual) {
      setModalAjusteVisible(false);
      return;
    }

    setAtualizandoEstoque(true);
    const diferenca = novaQuantidade - produtoParaAjuste.estoque_atual;
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('produtos')
      .update({ estoque_atual: novaQuantidade })
      .eq('id', produtoParaAjuste.id);

    if (!error) {
      // REGISTRA NO HISTÓRICO!
      await supabase.from('movimentacoes').insert([{
        produto_id: produtoParaAjuste.id,
        usuario_id: user.id,
        tipo: diferenca > 0 ? 'ENTRADA' : 'SAIDA',
        quantidade: Math.abs(diferenca),
        preco_custo_hist: produtoParaAjuste.preco_custo,
        preco_venda_hist: produtoParaAjuste.preco_venda,
        is_venda: false,
        observacao: 'Ajuste via aba de Tarefas'
      }]);

      // --- DISPARO DE NOTIFICAÇÕES (ALARMES) ---
      const alertas = [];
      
      // 1. Verifica se tem Alerta de Movimentação ligado
      if (produtoParaAjuste.notificar_movimentacao) {
        alertas.push({
          loja_id: lojaAtiva.id,
          mensagem: `Ajuste manual: ${diferenca > 0 ? 'Entrada' : 'Saída'} de ${Math.abs(diferenca)} unid. de ${produtoParaAjuste.nome}.`,
          tipo: 'movimentacao',
        });
      }

      // 2. Verifica se tem Alerta de Estoque Mínimo ligado e se atingiu o limite
      if (produtoParaAjuste.notificar_minimo && novaQuantidade <= (produtoParaAjuste.estoque_minimo || 0)) {
        alertas.push({
          loja_id: lojaAtiva.id,
          mensagem: `Atenção: O estoque de ${produtoParaAjuste.nome} chegou a ${novaQuantidade} (Mínimo: ${produtoParaAjuste.estoque_minimo}).`,
          tipo: 'alerta_minimo',
        });
      }

      // Se houver algum alerta gerado, envia para a tabela de notificações
      if (alertas.length > 0) {
        await supabase.from('notificacoes').insert(alertas);
        
        setUnreadNotifCount(prev => prev + alertas.length);
      }
      // ------------------------------------------

      showBanner("Estoque atualizado!", "success");
      setModalAjusteVisible(false);
      carregarLembretes();
      setProducts(products.map(p => p.id === produtoParaAjuste.id ? { ...p, estoque_atual: novaQuantidade } : p));
    } else {
      showBanner("Não foi possível atualizar o estoque.", "error");
    }
    setAtualizandoEstoque(false);
  };

  // Calcula quantas tarefas estão concluídas para mostrar no botão
  const qtdConcluidas = lembretes.filter(l => l.concluido).length;

  // Função para dar identidade visual a cada tipo de aviso
  const getVisualAviso = (tipo) => {
    switch (tipo) {
      case 'alerta_tarefa': 
        return { icone: 'alarm-outline', corIcone: '#ef4444', corFundo: '#fee2e2' }; // Vermelho (Urgência/Tempo)
      case 'alerta_minimo': 
        return { icone: 'warning-outline', corIcone: '#f59e0b', corFundo: '#fef3c7' }; // Amarelo (Atenção/Estoque Baixo)
      case 'movimentacao': 
        return { icone: 'swap-horizontal-outline', corIcone: '#3b82f6', corFundo: '#dbeafe' }; // Azul (Ajustes de Estoque)
      default: 
        return { icone: 'notifications-outline', corIcone: '#64748b', corFundo: '#f1f5f9' }; // Cinza (Padrão)
    }
  };
  
  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      
      {/* NOTIFICAÇÃO VISUAL DO BANNER */}
      {notification.visible && (
        <View style={[
          styles.topNotification, 
          { 
            backgroundColor: notification.type === 'error' ? 'rgba(244, 67, 54, 0.9)' : 'rgba(76, 175, 80, 0.9)', 
            zIndex: 999, 
            top: 20,
            position: 'absolute', left: 20, right: 20, padding: 15, borderRadius: 8, alignItems: 'center'
          }
        ]}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
            {notification.message}
          </Text>
        </View>
      )}

      {/* CABEÇALHO DINÂMICO */}
      <View style={{ paddingTop: Platform.OS === 'android' ? 40 : 50, paddingBottom: 15, paddingHorizontal: 20, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: '#eee' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => selecionando ? sairModoSelecao() : navigation.goBack()} style={{ marginRight: 15 }}>
            <Ionicons name={selecionando ? "close" : "arrow-back"} size={28} color="#333" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333' }}>
            {selecionando ? `${selecionados.length} selecionados` : (abaAtiva === 'avisos' ? "Avisos" : "Tarefas")}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {!selecionando ? (
            <>
              {abaAtiva === 'avisos' && permissoesAtivas?.gerenciar_avisos && (
                <TouchableOpacity onPress={() => setSelecionando(true)} style={{ marginRight: 15 }}>
                  <Text style={{ color: '#007AFF', fontWeight: 'bold' }}>Selecionar</Text>
                </TouchableOpacity>
              )}
              {abaAtiva === 'avisos' && permissoesAtivas?.gerenciar_avisos && notificacoes.length > 0 && (
                <TouchableOpacity onPress={() => { setNotifFocada(null); setModalConfirmarVisible(true); }}>
                  <Ionicons name="trash-outline" size={24} color="#d9534f" />
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => handleMarcarComoLida(true)} style={{ marginRight: 20 }} disabled={selecionados.length === 0}>
                <Ionicons name="mail-open-outline" size={24} color={selecionados.length === 0 ? "#ccc" : "#007AFF"} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleMarcarComoLida(false)} style={{ marginRight: 20 }} disabled={selecionados.length === 0}>
                <Ionicons name="mail-unread-outline" size={24} color={selecionados.length === 0 ? "#ccc" : "#007AFF"} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setModalConfirmarVisible(true)} disabled={selecionados.length === 0}>
                <Ionicons name="trash-outline" size={24} color={selecionados.length === 0 ? "#ccc" : "#d9534f"} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* === CONTEÚDO DA ABA: AVISOS === */}
      {abaAtiva === 'avisos' && (
        loadingAvisos ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#007AFF" /></View>
        ) : notificacoes.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', padding: 20, paddingTop: '40%' }}>
            <Ionicons name="notifications-off-outline" size={64} color="#ccc" />
            <Text style={{ marginTop: 20, fontSize: 18, color: '#666', fontWeight: 'bold' }}>Nenhum aviso por aqui.</Text>
            <Text style={{ marginTop: 10, fontSize: 14, color: '#999', textAlign: 'center' }}>Quando produtos atingirem o estoque mínimo ou forem movimentados, você será avisado aqui.</Text>
          </View>
        ) : (
          <FlatList
            data={notificacoes}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ padding: 15 }}
            renderItem={({ item }) => {
              const isSelected = selecionados.includes(item.id);
              const isMinimo = item.tipo === 'alerta_minimo';
              return (
                <TouchableOpacity 
                  activeOpacity={0.7}
                  onPress={() => {
                    if (selecionando) toggleSelecao(item.id);
                    else if (permissoesAtivas?.gerenciar_avisos) {
                      setNotifFocada(item);
                      setModalAcaoUnicaVisible(true);
                    }
                  }}
                  style={{
                    backgroundColor: isSelected ? '#e6f2ff' : (item.lida ? '#fff' : '#f0f7ff'), 
                    padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', 
                    borderWidth: 1, borderColor: isSelected ? '#007AFF' : (item.lida ? '#eee' : '#b3d4ff'), elevation: 2
                  }}
                >
                  {selecionando && (
                    <View style={{ marginRight: 10 }}>
                      <Ionicons name={isSelected ? "checkbox" : "square-outline"} size={24} color={isSelected ? "#007AFF" : "#ccc"} />
                    </View>
                  )}
                  
                  {/* O ícone e a cor de fundo agora mudam de acordo com o tipo da notificação */}
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: getVisualAviso(item.tipo).corFundo, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    <Ionicons name={getVisualAviso(item.tipo).icone} size={20} color={getVisualAviso(item.tipo).corIcone} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: '#333', fontWeight: item.lida ? 'normal' : 'bold' }}>{item.mensagem}</Text>
                  </View>
                  {!item.lida && !selecionando && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#007AFF' }} />}
                </TouchableOpacity>
              );
            }}
          />
        )
      )}

      {/* === CONTEÚDO DA ABA: AFAZERES === */}
      {abaAtiva === 'afazeres' && (
        <View style={{ flex: 1 }}>
          
          {/* 1. BARRA DE CRIAR RÁPIDA (Protegida) */}
          {permissoesAtivas?.gerenciar_tarefas && (
            <View style={{ paddingHorizontal: 20, paddingTop: 15, paddingBottom: 5, zIndex: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 8, alignItems: 'center', paddingHorizontal: 10, height: 48 }}>
                  <Ionicons name="add-circle-outline" size={22} color="#64748b" />
                  <TextInput
                    placeholder="Adicione uma tarefa..."
                    placeholderTextColor="#94a3b8"
                    value={novoLembrete}
                    onChangeText={setNovoLembrete}
                    style={{ flex: 1, paddingLeft: 10, color: '#333', height: '100%' }}
                    onSubmitEditing={handleCriarLembreteRapido}
                  />

                  {/* BOTÃO DE VINCULAR PRODUTO */}
                  <TouchableOpacity onPress={abrirModalProdutos} style={{ paddingHorizontal: 5 }}>
                    <Ionicons name="cube" size={22} color={produtoSelecionado ? "#007AFF" : "#94a3b8"} />
                  </TouchableOpacity>

                  {/* BOTÃO DO CALENDÁRIO */}
                  <TouchableOpacity onPress={() => setShowDatePicker(true)} style={{ paddingHorizontal: 5 }}>
                    <Ionicons name="calendar" size={22} color={dataLimite ? "#007AFF" : "#94a3b8"} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={handleCriarLembreteRapido}
                  disabled={criandoLembrete || !novoLembrete}
                  style={{ marginLeft: 10, backgroundColor: (criandoLembrete || !novoLembrete) ? '#a0cbfc' : '#007AFF', width: 48, height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center' }}
                >
                  {criandoLembrete ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={20} color="#fff" />}
                </TouchableOpacity>
              </View>
              
              {/* TEXTO AVISANDO O PRODUTO E A DATA ESCOLHIDA ANTES DE ENVIAR */}
              {produtoSelecionado && (
                <Text style={{ color: '#007AFF', fontSize: 12, marginTop: 5, marginLeft: 5, fontWeight: 'bold' }}>
                  <Ionicons name="cube" size={12} /> Produto: {produtoSelecionado.nome}
                  <Text onPress={() => setProdutoSelecionado(null)} style={{ color: '#d9534f' }}> (Remover)</Text>
                </Text>
              )}
              {dataLimite && (
                <Text style={{ color: '#007AFF', fontSize: 12, marginTop: 5, marginLeft: 5, fontWeight: 'bold' }}>
                  <Ionicons name="calendar" size={12} /> Prazo: {dataLimite.toLocaleDateString('pt-BR')} 
                  <Text onPress={() => setDataLimite(null)} style={{ color: '#d9534f' }}> (Remover)</Text>
                </Text>
              )}

              {/* O MODAL DO CALENDÁRIO INVISÍVEL */}
              {showDatePicker && (
                <DateTimePicker
                  value={dataLimite || new Date()}
                  mode="date"
                  display="default"
                  onChange={onChangeDate}
                />
              )}

              {/* EFEITO DEGRADÊ (FUMAÇA) */}
              <LinearGradient
                colors={['#f5f5f5', 'rgba(245, 245, 245, 0)']}
                style={{ position: 'absolute', left: 0, right: 0, bottom: -20, height: 20, zIndex: 10 }}
                pointerEvents="none"
              />
            </View>
          )}

          {/* LISTA DE TAREFAS */}
          {loadingLembretes ? (
             <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 20 }} />
          ) : lembretes.length === 0 ? (
             <View style={{ flex: 1, alignItems: 'center', padding: 20, paddingTop: '30%' }}>
               <Ionicons name="checkmark-done-circle-outline" size={64} color="#ccc" />
               <Text style={{ marginTop: 20, fontSize: 16, color: '#666', fontWeight: 'bold' }}>Tudo limpo por aqui!</Text>
               <Text style={{ marginTop: 10, fontSize: 14, color: '#999', textAlign: 'center' }}>Adicione tarefas acima para a sua equipe.</Text>
             </View>
          ) : (
             <FlatList
               data={lembretes}
               keyExtractor={item => item.id.toString()}
               contentContainerStyle={{ padding: 15, paddingBottom: 100 }}
               
               // 2. BOTÃO DE LIMPAR (Protegido)
               ListFooterComponent={() => {
                 if (qtdConcluidas === 0 || !permissoesAtivas?.gerenciar_tarefas) return null; 
                 
                 return (
                   <TouchableOpacity 
                     onPress={handleLimparConcluidas}
                     style={{ marginTop: 20, marginBottom: 10, padding: 15, backgroundColor: '#fff', borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#fca5a5', borderStyle: 'dashed' }}
                   >
                     <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>
                       <Ionicons name="trash-bin-outline" size={16} /> Limpar {qtdConcluidas} {qtdConcluidas === 1 ? 'tarefa concluída' : 'tarefas concluídas'}
                     </Text>
                   </TouchableOpacity>
                 );
               }}

               renderItem={({ item }) => (
                  <View style={{ backgroundColor: item.concluido ? '#f8f9fa' : '#fff', padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: item.concluido ? '#eee' : '#e2e8f0', elevation: item.concluido ? 0 : 1, borderLeftWidth: item.concluido ? 1 : 4, borderLeftColor: getCorPrioridadeAutomatica(item.data_limite, item.concluido) }}>
                     
                     {/* CHECKBOX (Livre para todos clicarem) */}
                     <TouchableOpacity onPress={() => toggleConcluido(item)} style={{ marginRight: 15 }}>
                        <Ionicons name={item.concluido ? "checkmark-circle" : "ellipse-outline"} size={28} color={item.concluido ? "#4CAF50" : "#ccc"} />
                     </TouchableOpacity>

                     <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, color: item.concluido ? '#999' : '#333', textDecorationLine: item.concluido ? 'line-through' : 'none', fontWeight: item.concluido ? 'normal' : '500' }}>{item.texto}</Text>
                        
                        {/* 3. PRAZO CLICÁVEL (Protegido) */}
                        <TouchableOpacity 
                          onPress={() => {
                            if (permissoesAtivas?.gerenciar_tarefas) {
                              setLembreteEditandoData(item);
                              setShowDatePicker(true);
                            } else {
                              showBanner("Sem permissão para alterar prazos.", "error");
                            }
                          }}
                          style={{ marginTop: 4 }}
                          activeOpacity={permissoesAtivas?.gerenciar_tarefas ? 0.2 : 1}
                        >
                          <Text style={{ fontSize: 12, color: (!item.data_limite || item.concluido) ? '#94a3b8' : getCorPrioridadeAutomatica(item.data_limite, item.concluido), fontWeight: 'bold' }}>
                            <Ionicons name="calendar-outline" size={12} /> Prazo: {item.data_limite ? new Date(item.data_limite).toLocaleDateString('pt-BR') : "Não definido"}
                            {isAtrasado(item.data_limite, item.concluido) && " (Atrasado)"}
                          </Text>
                        </TouchableOpacity>

                        {/* ETIQUETA DO PRODUTO (Protegida pela permissão de quantidades) */}
                        {item.produto_id && item.nome_produto && (
                          <TouchableOpacity 
                            onPress={() => {
                              if (permissoesAtivas?.quantidades) {
                                abrirAjusteRapido(item.produto_id);
                              } else {
                                showBanner("Sem permissão para alterar o estoque.", "error");
                              }
                            }} 
                            style={{ 
                              marginTop: 8, 
                              backgroundColor: item.concluido ? '#f8f9fa' : '#f0f7ff', 
                              paddingVertical: 4, 
                              paddingHorizontal: 8, 
                              borderRadius: 6, 
                              alignSelf: 'flex-start', 
                              flexDirection: 'row', 
                              alignItems: 'center', 
                              borderWidth: 1, 
                              borderColor: item.concluido ? '#eee' : '#cce4ff' 
                            }}
                            activeOpacity={permissoesAtivas?.quantidades ? 0.2 : 1}
                          >
                            <Ionicons name="cube-outline" size={14} color={item.concluido ? '#999' : '#007AFF'} style={{ marginRight: 4 }} />
                            <Text style={{ fontSize: 12, color: item.concluido ? '#999' : '#007AFF', fontWeight: '600' }}>{item.nome_produto}</Text>
                          </TouchableOpacity>
                        )}

                        {/* EXIBE QUEM CONCLUIU */}
                        {item.concluido && item.nome_concluido_por && (
                            <Text style={{ fontSize: 11, color: '#4CAF50', marginTop: 4, fontStyle: 'italic' }}>
                              <Ionicons name="checkmark-done" size={12} /> Feito por: {item.nome_concluido_por}
                            </Text>
                        )}
                     </View>

                     {/* 4. LIXEIRA (Protegida) */}
                     {permissoesAtivas?.gerenciar_tarefas && (
                       <TouchableOpacity onPress={() => apagarLembrete(item.id)} style={{ padding: 5 }}>
                          <Ionicons name="trash-outline" size={22} color="#d9534f" />
                       </TouchableOpacity>
                     )}
                  </View>
               )}
             />
          )}
        </View>
      )}

      {/* MODAL DE CONFIRMAR APAGAR AVISOS (Mantido intacto) */}
      <Modal visible={modalConfirmarVisible} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, width: '85%', overflow: 'hidden' }}>
            <View style={{ padding: 20, backgroundColor: '#f8f9fa', borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="warning" size={22} color="#d9534f" style={{ marginRight: 10 }} />
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>Apagar Avisos?</Text>
            </View>
            <View style={{ padding: 20 }}>
              <Text style={{ fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 20 }}>
                {selecionando 
                  ? `Deseja apagar os ${selecionados.length} avisos selecionados?` 
                  : notifFocada 
                    ? "Deseja apagar este aviso?"
                    : "Deseja limpar todas as notificações da sua caixa de entrada?"}
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <TouchableOpacity onPress={() => setModalConfirmarVisible(false)} style={{ flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 8, marginRight: 10 }}>
                  <Text style={{ color: '#555', fontWeight: 'bold' }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleApagarSelecionadas} style={{ flex: 1, backgroundColor: '#d9534f', paddingVertical: 12, alignItems: 'center', borderRadius: 8 }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Sim, apagar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DE AÇÃO ÚNICA AVISOS (Mantido intacto) */}
      <Modal visible={modalAcaoUnicaVisible} transparent={true} animationType="fade">
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setModalAcaoUnicaVisible(false)}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, width: '80%', overflow: 'hidden' }}>
            <TouchableOpacity onPress={() => handleMarcarComoLida(!notifFocada?.lida)} style={{ padding: 18, borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name={notifFocada?.lida ? "mail-unread-outline" : "mail-open-outline"} size={22} color="#007AFF" style={{ marginRight: 15 }} />
              <Text style={{ fontSize: 16, color: '#333' }}>{notifFocada?.lida ? "Marcar como não lida" : "Marcar como lida"}</Text>
            </TouchableOpacity>
            
            {permissoesAtivas?.gerenciar_avisos && (
              <TouchableOpacity onPress={() => {
                setModalAcaoUnicaVisible(false);
                setTimeout(() => setModalConfirmarVisible(true), 150);
              }} style={{ padding: 18, flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="trash-outline" size={22} color="#d9534f" style={{ marginRight: 15 }} />
                <Text style={{ fontSize: 16, color: '#d9534f' }}>Apagar aviso</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL DE SELEÇÃO DE PRODUTOS */}
      <Modal visible={modalProdutosVisible} transparent={true} animationType="fade">
        <TouchableOpacity 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          activeOpacity={1}
          onPress={() => setModalProdutosVisible(false)}
        >
          <TouchableWithoutFeedback>
            <View style={{ backgroundColor: '#fff', borderRadius: 15, width: '90%', padding: 20, maxHeight: '80%', shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333' }}>Vincular Produto</Text>
                <TouchableOpacity onPress={() => setModalProdutosVisible(false)}>
                  <Ionicons name="close" size={28} color="#999" />
                </TouchableOpacity>
              </View>

              {listaProdutos.length === 0 ? (
                <ActivityIndicator size="large" color="#007AFF" style={{ marginVertical: 30 }} />
              ) : (
                <FlatList
                  data={listaProdutos}
                  keyExtractor={item => item.id.toString()}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={{ padding: 15, borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', alignItems: 'center' }}
                      onPress={() => {
                        setProdutoSelecionado(item);
                        setModalProdutosVisible(false);
                      }}
                    >
                      <Ionicons name="cube-outline" size={20} color="#64748b" style={{ marginRight: 10 }} />
                      <Text style={{ fontSize: 16, color: '#333' }}>{item.nome}</Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* MODAL DE AJUSTE RÁPIDO DE ESTOQUE */}
      <Modal visible={modalAjusteVisible} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 15, width: '85%', padding: 20, alignItems: 'center', elevation: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 5 }}>Ajuste de Estoque</Text>
            <Text style={{ fontSize: 16, color: '#666', marginBottom: 20 }}>{produtoParaAjuste?.nome}</Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 25 }}>
              <TouchableOpacity 
                onPress={() => setNovaQuantidade(prev => Math.max(0, prev - 1))}
                style={{ backgroundColor: '#f1f5f9', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' }}
              >
                <Ionicons name="remove" size={24} color="#333" />
              </TouchableOpacity>

              <TextInput 
                keyboardType="numeric"
                value={String(novaQuantidade)}
                onChangeText={(txt) => setNovaQuantidade(Number(txt.replace(/[^0-9]/g, '')))}
                style={{ fontSize: 32, fontWeight: 'bold', marginHorizontal: 30, color: '#007AFF', textAlign: 'center', width: 80 }}
                selectTextOnFocus={true}
              />

              <TouchableOpacity 
                onPress={() => setNovaQuantidade(prev => prev + 1)}
                style={{ backgroundColor: '#f1f5f9', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' }}
              >
                <Ionicons name="add" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {/* BOTÕES NO PADRÃO DO APP */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 10 }}>
              <TouchableOpacity 
                onPress={() => setModalAjusteVisible(false)}
                style={{ flex: 1, backgroundColor: '#e2e8f0', padding: 15, borderRadius: 8, alignItems: 'center', marginRight: 10 }}
              >
                <Text style={{ color: '#64748b', fontWeight: 'bold', fontSize: 16 }}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={salvarAjusteEstoque}
                disabled={atualizandoEstoque}
                style={{ flex: 1, backgroundColor: '#007AFF', padding: 15, borderRadius: 8, alignItems: 'center' }}
              >
                {atualizandoEstoque ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Confirmar</Text>}
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (PADRÃO DO APP) */}
      <Modal visible={modalConfirmarLimpeza} transparent={true} animationType="fade">
        <TouchableOpacity 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          activeOpacity={1}
          onPress={() => setModalConfirmarLimpeza(false)}
        >
          <TouchableWithoutFeedback>
            <View style={{ backgroundColor: '#fff', borderRadius: 15, width: '85%', padding: 25, elevation: 10 }}>
              
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <View style={{ backgroundColor: '#fee2e2', padding: 15, borderRadius: 50, marginBottom: 15 }}>
                  <Ionicons name="trash" size={30} color="#ef4444" />
                </View>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#333', textAlign: 'center' }}>Limpar Tarefas</Text>
                <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 10, lineHeight: 20 }}>
                  Tem certeza que deseja apagar permanentemente todas as tarefas concluídas? Esta ação não pode ser desfeita.
                </Text>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                <TouchableOpacity 
                  onPress={() => setModalConfirmarLimpeza(false)}
                  style={{ flex: 1, backgroundColor: '#e2e8f0', padding: 15, borderRadius: 8, alignItems: 'center', marginRight: 10 }}
                >
                  <Text style={{ color: '#64748b', fontWeight: 'bold' }}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={executarLimpezaDefinitiva}
                  style={{ flex: 1, backgroundColor: '#ef4444', padding: 15, borderRadius: 8, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Limpar</Text>
                </TouchableOpacity>
              </View>

            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

    </View>
  );
};

// ----------------------
// SCREEN: HISTÓRICO DE MOVIMENTAÇÕES
// ----------------------
const MovimentacoesScreen = ({ navigation }) => {
  const lojaAtiva = useStore(state => state.lojaAtiva);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregarHistorico = async () => {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('movimentacoes')
        .select(`
          id, tipo, quantidade, observacao, criado_em,
          produtos!inner(nome, loja_id),
          perfis(nome) 
        `)
        .eq('produtos.loja_id', lojaAtiva.id)
        .order('criado_em', { ascending: false })
        .limit(100);

      if (error) {
        console.error("ERRO NO HISTÓRICO:", error.message);
        Alert.alert("Erro ao carregar", "O banco recusou a busca. Verifique se as tabelas estão ligadas.");
      }

      if (data) {
        setMovimentacoes(data);
      }
      setLoading(false);
    };
    carregarHistorico();
  }, [lojaAtiva]);

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      {/* Cabeçalho da Tela */}
      <View style={{ paddingTop: Platform.OS === 'android' ? 40 : 50, paddingBottom: 15, paddingHorizontal: 20, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#eee' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 15 }}>
          <Ionicons name="arrow-back" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333' }}>Histórico da Loja</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#007AFF" /></View>
      ) : movimentacoes.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', paddingTop: '50%', paddingHorizontal: 20 }}>
          <Ionicons name="document-text-outline" size={64} color="#ccc" />
          <Text style={{ marginTop: 20, fontSize: 16, color: '#999', textAlign: 'center' }}>Nenhuma movimentação registrada ainda.</Text>
        </View>
      ) : (
        <FlatList
          data={movimentacoes}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 15 }}
          initialNumToRender={12}    
          maxToRenderPerBatch={8}      
          windowSize={5}           
          removeClippedSubviews={true}
          renderItem={({ item }) => {
            const isEntrada = item.tipo === 'ENTRADA';
            const dataFormatada = new Date(item.criado_em).toLocaleDateString('pt-BR');
            const horaFormatada = new Date(item.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            return (
              <View style={{ backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 }}>
                
                {/* Ícone de Entrada (Verde) ou Saída (Vermelho) */}
                <View style={{ width: 45, height: 45, borderRadius: 22.5, backgroundColor: isEntrada ? '#e8f5e9' : '#ffebee', justifyContent: 'center', alignItems: 'center', marginRight: 15 }}>
                  <Ionicons name={isEntrada ? "arrow-down" : "arrow-up"} size={24} color={isEntrada ? "#4CAF50" : "#d9534f"} />
                </View>

                {/* Detalhes do Produto */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>{item.produtos.nome}</Text>
                  <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{dataFormatada} às {horaFormatada}</Text>
                  <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Motivo: {item.observacao}</Text>
                  <Text style={{ fontSize: 12, color: '#666', fontWeight: 'bold', marginTop: 2 }}>
                    Por: {item.perfis?.[0]?.nome || item.perfis?.nome || 'Sistema'}
                  </Text>
                </View>

                {/* Quantidade */}
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: isEntrada ? '#4CAF50' : '#d9534f' }}>
                    {isEntrada ? "+" : "-"}{item.quantidade}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
};

const MainAppDrawer = () => {
  const setLojas = useStore(state => state.setLojas);
  const setLojasMembro = useStore(state => state.setLojasMembro);
  const lojaAtiva = useStore(state => state.lojaAtiva); 
  const setLojaAtiva = useStore(state => state.setLojaAtiva);
  const setIsFetchingLojas = useStore(state => state.setIsFetchingLojas);
  const setPermissoesAtivas = useStore(state => state.setPermissoesAtivas);

  useEffect(() => {
    const fetchPermissoes = async () => {
      if (!lojaAtiva) return;
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (lojaAtiva.dono_id === user.id) {
        setPermissoesAtivas({
          quantidades: true, adicionar: true, editar: true, gerenciar: true, 
          gerenciar_avisos: true, gerenciar_tarefas: true, caixa: true, painel: true
        });
      } else {
        const { data } = await supabase
          .from('equipe')
          // Puxa a nova coluna do banco
          .select('perm_editar_quantidades, perm_adicionar_produto, perm_editar_produto, perm_gerenciar_membros, perm_gerenciar_avisos, perm_gerenciar_tarefas, perm_acessar_caixa, perm_acessar_painel') 
          .eq('loja_id', lojaAtiva.id)
          .eq('usuario_id', user.id)
          .maybeSingle();
          
        if (data) {
          setPermissoesAtivas({
            quantidades: data.perm_editar_quantidades,
            adicionar: data.perm_adicionar_produto,
            editar: data.perm_editar_produto,
            gerenciar: data.perm_gerenciar_membros,
            gerenciar_avisos: data.perm_gerenciar_avisos,
            gerenciar_tarefas: data.perm_gerenciar_tarefas,
            caixa: data.perm_acessar_caixa !== false,
            painel: data.perm_acessar_painel !== false
          });
        }
      }
    };
    fetchPermissoes();
  }, [lojaAtiva]);

  useEffect(() => {
    const carregarTudo = async () => {
      setIsFetchingLojas(true);
      
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        
        if (user) {
          // 1. Busca estoques que EU CRIEI
          const { data: minhasLojas, error: errLojas } = await supabase
            .from('lojas')
            .select('*')
            .eq('dono_id', user.id)
            .order('ordem', { ascending: true });

          if (errLojas) throw errLojas;

          // 2. Busca IDs dos estoques onde SOU MEMBRO
          const { data: participacoes, error: errEquipe } = await supabase
            .from('equipe')
            .select('loja_id')
            .eq('usuario_id', user.id);

          if (errEquipe) throw errEquipe;

          let estoquesCompartilhados = [];
          if (participacoes && participacoes.length > 0) {
            const ids = participacoes.map(p => p.loja_id);
            const { data: compartilhadas, error: errCompartilhadas } = await supabase
              .from('lojas')
              .select('*')
              .in('id', ids);
              
            if (errCompartilhadas) throw errCompartilhadas;
            estoquesCompartilhados = compartilhadas || [];
          }

          // 3. Salva no estado global
          setLojas(minhasLojas || []);
          setLojasMembro(estoquesCompartilhados);

          // Define a loja ativa inicial
          if (minhasLojas && minhasLojas.length > 0) setLojaAtiva(minhasLojas[0]);
          else if (estoquesCompartilhados.length > 0) setLojaAtiva(estoquesCompartilhados[0]);
          else setLojaAtiva(null);
        }
      } catch (error) {
        console.log("Erro crítico ao carregar menu:", error);
        Alert.alert("Erro de Sincronização", error.message);
      } finally {
        setIsFetchingLojas(false);
      }
    };
    carregarTudo();
  }, []);

  return (
    <Drawer.Navigator 
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerTintColor: '#333',
        drawerActiveTintColor: '#007AFF',
        headerTitleAlign: 'left',
        drawerItemStyle: { borderRadius: 8 }
      }}
    >
      <Drawer.Screen 
        name="Home" 
        component={EmptyScreen} 
        options={({ navigation }) => ({ 
          title: lojaAtiva ? lojaAtiva.nome : '', 
          headerRight: () => {
            const unreadNotifCount = useStore(state => state.unreadNotifCount);
            return (
              <View style={{ flexDirection: 'row', marginRight: 15, alignItems: 'center' }}>
                <TouchableOpacity onPress={() => navigation.navigate('Tarefas')} style={{ marginRight: 20 }}>
                  <Ionicons name="clipboard-outline" size={26} color="#007AFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.navigate('Notificacoes')} style={{ marginRight: 5 }}>
                  <View>
                    <Ionicons name="notifications-outline" size={26} color="#007AFF" />
                    {unreadNotifCount > 0 && (
                      <View style={{ position: 'absolute', top: -4, right: -6, backgroundColor: '#d9534f', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 1, borderColor: '#fff' }}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            );
          },
          drawerItemStyle: { display: 'none' } 
        })} 
      />
    </Drawer.Navigator>
  );
};

const TimeSpanDropdown = ({ options, value, onSelect, fullWidth, color = '#007AFF' }) => {
  const [open, setOpen] = useState(false);
  const buttonRef = React.useRef(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0, width: 0 });

  const handleOpen = () => {
    buttonRef.current?.measure((fx, fy, width, height, px, py) => {
      setDropdownPos({ top: py + height + 5, right: Dimensions.get('window').width - px - width, width });
      setOpen(true);
    });
  };

  return (
    <View style={{ zIndex: 100, width: fullWidth ? '100%' : 'auto' }}>
      <TouchableOpacity 
        ref={buttonRef}
        onPress={handleOpen}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: fullWidth ? 'space-between' : 'flex-start', backgroundColor: color, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 }}
      >
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13, marginRight: fullWidth ? 0 : 6 }}>{value}</Text>
        <Ionicons name="chevron-down" size={16} color="#fff" />
      </TouchableOpacity>
      
      <Modal visible={open} transparent={true} animationType="fade">
        <TouchableOpacity 
          style={{ flex: 1 }} 
          activeOpacity={1} 
          onPress={() => setOpen(false)}
        >
          <View style={{ position: 'absolute', top: dropdownPos.top, right: dropdownPos.right, width: Math.max(dropdownPos.width, 120), backgroundColor: '#fff', borderRadius: 12, padding: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 }}>
            {options.map((opt) => (
              <TouchableOpacity 
                key={opt} 
                onPress={() => { onSelect(opt); setOpen(false); }}
                style={{ paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8, backgroundColor: value === opt ? color + '1A' : '#fff' }}
              >
                <Text style={{ color: value === opt ? color : '#4a5568', fontWeight: value === opt ? 'bold' : 'normal', fontSize: 13, textAlign: fullWidth ? 'left' : 'right' }}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const DashboardScreen = ({ navigation }) => {
  const lojaAtiva = useStore(state => state.lojaAtiva);
  const products = useStore(state => state.products);
  const meuId = useStore(state => state.session?.user?.id);
  const setGlobalAutoFilter = useStore(state => state.setGlobalAutoFilter);
  
  // =================== STATES DA TELA ===================
  // 1. Resumo Principal
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesTotal, setSalesTotal] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [salesTotalPrev, setSalesTotalPrev] = useState(0);
  const [filter, setFilter] = useState('7 Dias');
  const [showGrowthTooltip, setShowGrowthTooltip] = useState(false);
  const [showTicketTooltip, setShowTicketTooltip] = useState(false);

  // Pivot Inteligência
  const [intelFilter, setIntelFilter] = useState('30 Dias');
  const [intelTimeMode, setIntelTimeMode] = useState('corridos');
  const [intelSelectedMonth, setIntelSelectedMonth] = useState(new Date().getMonth());
  const [intelSelectedYear, setIntelSelectedYear] = useState(new Date().getFullYear());
  const [intelTimeSpan, setIntelTimeSpan] = useState('Mês');
  const [intelStats, setIntelStats] = useState([]);
  const [intelTotals, setIntelTotals] = useState({ receita: 0, lucro: 0, bestDay: '' });
  const [bestDayMetric, setBestDayMetric] = useState('Receita');
  const [intelInsights, setIntelInsights] = useState([]);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelSelectedProduct, setIntelSelectedProduct] = useState(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [intelSearch, setIntelSearch] = useState('');

  const openIntelModal = () => {
    setShowProductModal(true);
  };

  const closeIntelModal = () => {
    setShowProductModal(false);
    setIntelSearch('');
  };

  const tooltipAnim = useRef(new Animated.Value(0)).current;
  const ticketAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(tooltipAnim, {
      toValue: showGrowthTooltip ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showGrowthTooltip]);

  useEffect(() => {
    Animated.timing(ticketAnim, {
      toValue: showTicketTooltip ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showTicketTooltip]);
  
  const [activeIntelTooltip, setActiveIntelTooltip] = useState(null);
  const animUnidades = useRef(new Animated.Value(0)).current;
  const animMargem = useRef(new Animated.Value(0)).current;
  const animReceita = useRef(new Animated.Value(0)).current;
  const animLucro = useRef(new Animated.Value(0)).current;
  const animCapital = useRef(new Animated.Value(0)).current;
  const animRoi = useRef(new Animated.Value(0)).current;

  const animProdUnidades = useRef(new Animated.Value(0)).current;
  const animProdMargem = useRef(new Animated.Value(0)).current;
  const animProdReceita = useRef(new Animated.Value(0)).current;
  const animProdLucro = useRef(new Animated.Value(0)).current;
  const animProdCapital = useRef(new Animated.Value(0)).current;
  const animProdRoi = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animUnidades, { toValue: activeIntelTooltip === 'unidades' ? 1 : 0, duration: 200, useNativeDriver: true }).start();
    Animated.timing(animMargem, { toValue: activeIntelTooltip === 'margem' ? 1 : 0, duration: 200, useNativeDriver: true }).start();
    Animated.timing(animReceita, { toValue: activeIntelTooltip === 'receita' ? 1 : 0, duration: 200, useNativeDriver: true }).start();
    Animated.timing(animLucro, { toValue: activeIntelTooltip === 'lucro' ? 1 : 0, duration: 200, useNativeDriver: true }).start();
    Animated.timing(animCapital, { toValue: activeIntelTooltip === 'capital' ? 1 : 0, duration: 200, useNativeDriver: true }).start();
    Animated.timing(animRoi, { toValue: activeIntelTooltip === 'roi' ? 1 : 0, duration: 200, useNativeDriver: true }).start();

    Animated.timing(animProdUnidades, { toValue: activeIntelTooltip === 'prod_unidades' ? 1 : 0, duration: 200, useNativeDriver: true }).start();
    Animated.timing(animProdMargem, { toValue: activeIntelTooltip === 'prod_margem' ? 1 : 0, duration: 200, useNativeDriver: true }).start();
    Animated.timing(animProdReceita, { toValue: activeIntelTooltip === 'prod_receita' ? 1 : 0, duration: 200, useNativeDriver: true }).start();
    Animated.timing(animProdLucro, { toValue: activeIntelTooltip === 'prod_lucro' ? 1 : 0, duration: 200, useNativeDriver: true }).start();
    Animated.timing(animProdCapital, { toValue: activeIntelTooltip === 'prod_capital' ? 1 : 0, duration: 200, useNativeDriver: true }).start();
    Animated.timing(animProdRoi, { toValue: activeIntelTooltip === 'prod_roi' ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [activeIntelTooltip]);
  // 2. Gráfico Mensal e Top 5
  const [timeSpan, setTimeSpan] = useState('30 Dias');
  const [chartTimeMode, setChartTimeMode] = useState('corridos');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [chartMetric, setChartMetric] = useState('Receita');
  const [chartData, setChartData] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  
  // 3. Raio-X Diário
  const [dailyDate, setDailyDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dailyData, setDailyData] = useState([]);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyTotal, setDailyTotal] = useState({ receita: 0, lucro: 0 });
  const [showAllDaily, setShowAllDaily] = useState(false);

  // Helpers
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const filters = ['Hoje', '7 Dias', '30 Dias', 'Ano', 'Tudo'];
  
  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // Cálculos do Estoque Atual
  const totalInvestido = products.reduce((acc, p) => acc + (parseFloat(p.preco_custo || 0) * (p.estoque_atual || 0)), 0);
  const valorBruto = products.reduce((acc, p) => acc + (parseFloat(p.preco_venda || 0) * (p.estoque_atual || 0)), 0);
  const lucroProjetado = valorBruto - totalInvestido;
  const margemGeral = valorBruto > 0 ? ((lucroProjetado / valorBruto) * 100).toFixed(1) : 0;
  const estoqueCritico = products.filter(p => p.estoque_atual <= p.estoque_minimo && p.estoque_minimo > 0);

  // =================== EFEITOS (BUSCAS) ===================

  // Efeito 1: Resumo Superior (Vendas Realizadas + Comparativo)
  useEffect(() => {
    const carregarVendas = async () => {
      setSalesLoading(true);
      try {
        const hoje = new Date();
        let dataLimiteAtual = new Date();
        let dataInicioAnterior = new Date();
        let dataFimAnterior = new Date();
        let precisaComparativo = filter !== 'Tudo';

        if (filter === 'Hoje') {
          dataLimiteAtual.setHours(0,0,0,0);
          dataInicioAnterior.setDate(hoje.getDate() - 1);
          dataInicioAnterior.setHours(0,0,0,0);
          dataFimAnterior.setDate(hoje.getDate() - 1);
          dataFimAnterior.setHours(23,59,59,999);
        } else if (filter === '7 Dias') {
          dataLimiteAtual.setDate(hoje.getDate() - 7);
          dataInicioAnterior.setDate(hoje.getDate() - 14);
          dataFimAnterior.setDate(hoje.getDate() - 7);
        } else if (filter === '30 Dias') {
          dataLimiteAtual.setDate(hoje.getDate() - 30);
          dataInicioAnterior.setDate(hoje.getDate() - 60);
          dataFimAnterior.setDate(hoje.getDate() - 30);
        } else if (filter === 'Ano') {
          dataLimiteAtual.setFullYear(hoje.getFullYear() - 1);
          dataInicioAnterior.setFullYear(hoje.getFullYear() - 2);
          dataFimAnterior.setFullYear(hoje.getFullYear() - 1);
        }

        let queryAtual = supabase.from('movimentacoes').select('quantidade, preco_venda_hist, preco_custo_hist, produtos!inner(id, nome, loja_id)').eq('is_venda', true).eq('produtos.loja_id', lojaAtiva.id);
        if (precisaComparativo) queryAtual = queryAtual.gte('criado_em', dataLimiteAtual.toISOString());

        const { data: dataAtual, error: errAtual } = await queryAtual;
        if (errAtual) throw errAtual;

        let totalAtual = 0;
        let countAtual = 0;

        if (dataAtual) {
          dataAtual.forEach(mov => {
            const qtd = mov.quantidade || 0;
            const venda = mov.preco_venda_hist || 0;

            totalAtual += (qtd * venda);
            countAtual += qtd;
          });
        }

        setSalesTotal(totalAtual);
        setSalesCount(countAtual);

        // Busca o comparativo se não for 'Tudo'
        if (precisaComparativo) {
          const { data: dataPrev } = await supabase.from('movimentacoes').select('quantidade, preco_venda_hist, produtos!inner(loja_id)')
            .eq('is_venda', true).eq('produtos.loja_id', lojaAtiva.id)
            .gte('criado_em', dataInicioAnterior.toISOString())
            .lt('criado_em', dataFimAnterior.toISOString());
            
          let totalPrev = 0;
          if (dataPrev) {
            dataPrev.forEach(mov => { totalPrev += (mov.quantidade * (mov.preco_venda_hist || 0)); });
          }
          setSalesTotalPrev(totalPrev);
        } else {
          setSalesTotalPrev(0);
        }

      } catch (err) {
        console.log("Erro carregar resumo:", err.message);
      } finally {
        setSalesLoading(false);
      }
    };
    if (lojaAtiva) carregarVendas();
  }, [lojaAtiva, filter]);

  useEffect(() => {
    const carregarIntel = async () => {
      setIntelLoading(true);
      try {
        let dateStart, dateEnd;
        if (intelTimeMode === 'calendario') {
          const q = Math.floor(intelSelectedMonth / 3) + 1;
          const s = Math.floor(intelSelectedMonth / 6) + 1;
          if (intelFilter === 'Mês') {
            dateStart = new Date(intelSelectedYear, intelSelectedMonth, 1);
            dateEnd = new Date(intelSelectedYear, intelSelectedMonth + 1, 0, 23, 59, 59);
          } else if (intelFilter === 'Trimestre') {
            dateStart = new Date(intelSelectedYear, (q - 1) * 3, 1);
            dateEnd = new Date(intelSelectedYear, q * 3, 0, 23, 59, 59);
          } else if (intelFilter === 'Semestre') {
            dateStart = new Date(intelSelectedYear, (s - 1) * 6, 1);
            dateEnd = new Date(intelSelectedYear, s * 6, 0, 23, 59, 59);
          } else {
            dateStart = new Date(intelSelectedYear, 0, 1);
            dateEnd = new Date(intelSelectedYear, 12, 0, 23, 59, 59);
          }
        } else {
          const hoje = new Date();
          dateEnd = new Date();
          dateStart = new Date();
          if (intelFilter === '7 Dias') {
            dateStart.setDate(hoje.getDate() - 6);
          } else if (intelFilter === '30 Dias') {
            dateStart.setDate(hoje.getDate() - 29);
          } else if (intelFilter === 'Ano') {
            dateStart.setFullYear(hoje.getFullYear() - 1);
          } else {
            dateStart = new Date(2000, 0, 1);
          }
          dateStart.setHours(0,0,0,0);
        }

        let query = supabase.from('movimentacoes').select('quantidade, preco_venda_hist, preco_custo_hist, criado_em, produtos!inner(id, nome, loja_id, estoque_atual)').eq('is_venda', true).eq('produtos.loja_id', lojaAtiva.id);
        if (intelTimeMode === 'calendario' || intelFilter !== 'Tudo') {
          query = query.gte('criado_em', dateStart.toISOString()).lte('criado_em', dateEnd.toISOString());
        }

        const { data, error } = await query;
        if (error) throw error;

        // Opção B: Buscar o valor total do estoque atual da loja
        const { data: todosProd, error: errProd } = await supabase.from('produtos').select('estoque_atual, preco_custo').eq('loja_id', lojaAtiva.id).eq('ativo', true);
        if (errProd) throw errProd;

        let totalEstoqueAtualValor = 0;
        if (todosProd) {
          todosProd.forEach(p => {
            totalEstoqueAtualValor += (p.estoque_atual || 0) * (p.preco_custo || 0);
          });
        }

        let totalR = 0;
        let totalL = 0;
        let totalQtdVendida = 0;
        let totalCustoVendido = 0;
        let diasStats = {};
        let pStats = {};

        if (data) {
          data.forEach(mov => {
            const qtd = mov.quantidade || 0;
            const venda = mov.preco_venda_hist || 0;
            const custo = mov.preco_custo_hist || 0;
            const pid = mov.produtos.id;
            const pnome = mov.produtos.nome;

            const rec = qtd * venda;
            const luc = qtd * (venda - custo);
            const totalCustoItem = qtd * custo;

            totalR += rec;
            totalL += luc;
            totalQtdVendida += qtd;
            totalCustoVendido += totalCustoItem;

            const diaDaSemana = new Date(mov.criado_em).toLocaleDateString('pt-BR', { weekday: 'long' });
            if (!diasStats[diaDaSemana]) diasStats[diaDaSemana] = { receita: 0, lucro: 0, qtd: 0 };
            diasStats[diaDaSemana].receita += rec;
            diasStats[diaDaSemana].lucro += luc;
            diasStats[diaDaSemana].qtd += qtd;

            const estoqueAtual = mov.produtos.estoque_atual || 0;
            if (!pStats[pid]) pStats[pid] = { id: pid, nome: pnome, receita: 0, lucro: 0, qtd: 0, custo: 0, estoqueAtual: estoqueAtual, custoUnitario: custo };
            pStats[pid].receita += rec;
            pStats[pid].lucro += luc;
            pStats[pid].qtd += qtd;
            pStats[pid].custo += totalCustoItem;
          });
        }

        let bestDayReceita = '-';
        let bestDayLucro = '-';
        let bestDayQtd = '-';
        if (Object.keys(diasStats).length > 0) {
           const days = Object.keys(diasStats);
           const bReceita = days.reduce((a, b) => diasStats[a].receita > diasStats[b].receita ? a : b);
           const bLucro = days.reduce((a, b) => diasStats[a].lucro > diasStats[b].lucro ? a : b);
           const bQtd = days.reduce((a, b) => diasStats[a].qtd > diasStats[b].qtd ? a : b);
           
           bestDayReceita = bReceita.charAt(0).toUpperCase() + bReceita.slice(1);
           bestDayLucro = bLucro.charAt(0).toUpperCase() + bLucro.slice(1);
           bestDayQtd = bQtd.charAt(0).toUpperCase() + bQtd.slice(1);
        }

        const investimentoTotalLoja = totalEstoqueAtualValor + totalCustoVendido;
        const rentabilidadeGeral = investimentoTotalLoja > 0 ? (totalL / investimentoTotalLoja) * 100 : 0;
        const margemMedia = totalR > 0 ? (totalL / totalR) * 100 : 0;

        setIntelTotals({ 
          receita: totalR, 
          lucro: totalL, 
          qtdTotal: totalQtdVendida,
          investimentoTotal: investimentoTotalLoja,
          rentabilidadeGeral: rentabilidadeGeral,
          margemMedia: margemMedia,
          bestDay: { Receita: bestDayReceita, Lucro: bestDayLucro, 'Unidades Vendidas': bestDayQtd }
        });

        let arrStats = Object.values(pStats).map(p => {
          p.margem = p.receita > 0 ? ((p.lucro / p.receita) * 100) : 0;
          p.investimento = (p.qtd + p.estoqueAtual) * p.custoUnitario;
          p.rentabilidade = p.investimento > 0 ? ((p.lucro / p.investimento) * 100) : 0;
          return p;
        });

        const newInsights = [];
        if (arrStats.length > 0) {
          const boasMargens = arrStats.filter(p => p.margem >= 30);
          if (boasMargens.length > 0) {
            const estrela = boasMargens.sort((a,b) => b.qtd - a.qtd)[0];
            newInsights.push({ id: 'estrela', tipo: 'Estrela', titulo: '🌟 A Estrela da Loja', produto: estrela.nome, descricao: `Rentabilidade de ${estrela.margem.toFixed(0)}% e alta saída.`, cor: '#38a169', bg: '#f0fff4' });
          }
          const baixasMargens = arrStats.filter(p => p.margem < 15);
          if (baixasMargens.length > 0) {
            const falso = baixasMargens.sort((a,b) => b.qtd - a.qtd)[0];
            newInsights.push({ id: 'falso', tipo: 'Alerta', titulo: '⚠️ O Falso Campeão', produto: falso.nome, descricao: `Vende muito, mas margem de apenas ${falso.margem.toFixed(0)}%.`, cor: '#e53e3e', bg: '#fff5f5' });
          }
          const avgQtd = arrStats.reduce((acc, p) => acc + p.qtd, 0) / (arrStats.length || 1);
          const poucoGiro = arrStats.filter(p => p.qtd < avgQtd && p.margem > 40);
          if (poucoGiro.length > 0) {
            const ouro = poucoGiro.sort((a,b) => b.margem - a.margem)[0];
            newInsights.push({ id: 'ouro', tipo: 'Ouro', titulo: '🐢 Ouro Escondido', produto: ouro.nome, descricao: `Margem de ${ouro.margem.toFixed(0)}%, mas girou pouco.`, cor: '#d69e2e', bg: '#fffff0' });
          }
        }
        setIntelInsights(newInsights);
        setIntelStats(arrStats);
      } catch (err) {
        console.log("Erro Intel:", err.message);
      } finally {
        setIntelLoading(false);
      }
    };
    if (lojaAtiva) carregarIntel();
  }, [lojaAtiva, intelFilter, intelTimeMode, intelSelectedMonth, intelSelectedYear]);

  const seedDashboardData = async () => {
    if (!lojaAtiva) return;
    try {
      setIntelLoading(true);
      
      const { data: prods } = await supabase.from('produtos').select('*').eq('loja_id', lojaAtiva.id);
      if (!prods || prods.length === 0) {
        Alert.alert("Aviso", "Adicione produtos antes de gerar o histórico.");
        return;
      }
      const pIds = prods.map(p => p.id);

      await supabase.from('movimentacoes').delete().in('produto_id', pIds);

      const novasMovimentacoes = [];
      const agora = new Date();
      const me = await supabase.auth.getUser();
      const uid = me?.data?.user?.id;

      prods.forEach(p => {
        const dtEntrada = new Date();
        dtEntrada.setDate(agora.getDate() - 180);
        
        novasMovimentacoes.push({
          produto_id: p.id,
          usuario_id: uid,
          tipo: 'ENTRADA',
          quantidade: 500,
          preco_custo_hist: p.preco_custo || 10,
          preco_venda_hist: p.preco_venda || 20,
          is_venda: false,
          observacao: 'Seed Inicial',
          criado_em: dtEntrada.toISOString()
        });

        const numVendas = Math.floor(Math.random() * 30) + 15;
        for (let i = 0; i < numVendas; i++) {
          const diasAtras = Math.floor(Math.random() * 180);
          const dtVenda = new Date();
          dtVenda.setDate(agora.getDate() - diasAtras);
          
          novasMovimentacoes.push({
            produto_id: p.id,
            usuario_id: uid,
            tipo: 'SAIDA',
            quantidade: Math.floor(Math.random() * 5) + 1,
            preco_custo_hist: p.preco_custo || 10,
            preco_venda_hist: p.preco_venda || 20,
            is_venda: true,
            observacao: 'Venda Seed',
            criado_em: dtVenda.toISOString()
          });
        }
      });

      const { error: errInsert } = await supabase.from('movimentacoes').insert(novasMovimentacoes);
      if (errInsert) throw errInsert;

      Alert.alert("Sucesso", "Histórico de 6 meses gerado com sucesso!");
      setIntelFilter('Tudo'); // forçar re-render na aba de inteligência
    } catch (e) {
      Alert.alert("Erro", e.message);
    } finally {
      setIntelLoading(false);
    }
  };


  // Efeito 2: Gráfico Mensal e Top 5 Produtos
  useEffect(() => {
    const carregarGraficoERanking = async () => {
      setChartLoading(true);
      try {
        let dateStart, dateEnd, dataPoints;
        const now = new Date();
        const q = Math.floor(selectedMonth / 3) + 1;
        const s = Math.floor(selectedMonth / 6) + 1;

        if (chartTimeMode === 'calendario') {
          if (timeSpan === 'Mês') {
            dateStart = new Date(selectedYear, selectedMonth, 1);
            dateEnd = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);
            dataPoints = dateEnd.getDate();
          } else if (timeSpan === 'Trimestre') {
            dateStart = new Date(selectedYear, (q - 1) * 3, 1);
            dateEnd = new Date(selectedYear, q * 3, 0, 23, 59, 59);
            dataPoints = 3;
          } else if (timeSpan === 'Semestre') {
            dateStart = new Date(selectedYear, (s - 1) * 6, 1);
            dateEnd = new Date(selectedYear, s * 6, 0, 23, 59, 59);
            dataPoints = 6;
          } else {
            dateStart = new Date(selectedYear, 0, 1);
            dateEnd = new Date(selectedYear, 12, 0, 23, 59, 59);
            dataPoints = 12;
          }
        } else {
          dateEnd = new Date();
          dateStart = new Date();
          if (timeSpan === '7 Dias') {
            dateStart.setDate(now.getDate() - 6);
            dataPoints = 7;
          } else if (timeSpan === '30 Dias') {
            dateStart.setDate(now.getDate() - 29);
            dataPoints = 30;
          } else { // Ano (365)
            dateStart.setDate(now.getDate() - 364);
            dataPoints = 12;
          }
          dateStart.setHours(0, 0, 0, 0);
        }

        const { data, error } = await supabase
          .from('movimentacoes')
          .select('produto_id, quantidade, preco_venda_hist, preco_custo_hist, criado_em, produtos!inner(id, nome, loja_id, estoque_atual)')
          .eq('is_venda', true)
          .eq('produtos.loja_id', lojaAtiva.id)
          .gte('criado_em', dateStart.toISOString())
          .lte('criado_em', dateEnd.toISOString());

        if (error) throw error;

        const aggregated = Array(dataPoints).fill(0);
        const marginMap = {};
        const productStats = {};

        if (data) {
          data.forEach(mov => {
            const date = new Date(mov.criado_em);
            let idx = 0;
            if (chartTimeMode === 'calendario') {
              if (timeSpan === 'Mês') {
                idx = date.getDate() - 1;
              } else if (timeSpan === 'Trimestre') {
                idx = date.getMonth() - ((q - 1) * 3);
              } else if (timeSpan === 'Semestre') {
                idx = date.getMonth() - ((s - 1) * 6);
              } else {
                idx = date.getMonth();
              }
            } else {
              if (timeSpan === '7 Dias' || timeSpan === '30 Dias') {
                const startOfDateStart = new Date(dateStart);
                startOfDateStart.setHours(0,0,0,0);
                const startOfDate = new Date(date);
                startOfDate.setHours(0,0,0,0);
                const diffTime = startOfDate - startOfDateStart;
                idx = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                if (idx < 0) idx = 0;
                if (idx >= dataPoints) idx = dataPoints - 1;
              } else {
                const monthDiff = (date.getFullYear() - dateStart.getFullYear()) * 12 + (date.getMonth() - dateStart.getMonth());
                idx = monthDiff;
                if (idx < 0) idx = 0;
                if (idx >= 12) idx = 11;
              }
            }

            const qtd = mov.quantidade || 0;
            const venda = mov.preco_venda_hist || 0;
            const custo = mov.preco_custo_hist || 0;
            const pId = mov.produtos.id;
            const pNome = mov.produtos.nome;

            if (chartMetric === 'Receita') aggregated[idx] += (qtd * venda);
            else if (chartMetric === 'Lucro') aggregated[idx] += (qtd * (venda - custo));
            else if (chartMetric === 'Itens') aggregated[idx] += qtd;
            else if (chartMetric === 'Rentabilidade') {
              if (!marginMap[idx]) marginMap[idx] = { l: 0, c: 0 };
              marginMap[idx].l += (qtd * (venda - custo));
              marginMap[idx].c += (qtd * custo);
            }

            if (!productStats[pId]) {
              productStats[pId] = { 
                id: pId, 
                nome: pNome, 
                receita: 0, 
                lucro: 0, 
                qtd: 0, 
                custoVendido: 0, 
                estoqueAtual: mov.produtos?.estoque_atual || 0,
                ultimoCusto: custo 
              };
            }
            productStats[pId].receita += (qtd * venda);
            productStats[pId].lucro += (qtd * (venda - custo));
            productStats[pId].custoVendido += (qtd * custo);
            productStats[pId].qtd += qtd;
          });

          if (chartMetric === 'Rentabilidade') {
            for (let i = 0; i < dataPoints; i++) {
              if (marginMap[i] && marginMap[i].c > 0) {
                aggregated[i] = (marginMap[i].l / marginMap[i].c) * 100;
              }
            }
          }
        }

        const monthsShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        let labels = [];
        if (chartTimeMode === 'calendario') {
          if (timeSpan === 'Mês') {
            labels = Array(dataPoints).fill(0).map((_, i) => {
              const day = i + 1;
              if (day === 1 || day === dataPoints || (day % 5 === 0 && (dataPoints - day) > 2)) return day.toString();
              return '';
            });
          } else if (timeSpan === 'Trimestre') {
            const startM = (q - 1) * 3;
            labels = [monthsShort[startM], monthsShort[startM+1], monthsShort[startM+2]];
          } else if (timeSpan === 'Semestre') {
            const startM = (s - 1) * 6;
            labels = Array(6).fill(0).map((_, i) => monthsShort[startM + i]);
          } else {
            labels = monthsShort;
          }
        } else {
          labels = Array(dataPoints).fill(0).map((_, i) => {
            const d = new Date(dateStart);
            if (timeSpan === '7 Dias' || timeSpan === '30 Dias') {
              d.setDate(d.getDate() + i);
              const day = i + 1;
              if (timeSpan === '7 Dias' || day === 1 || day === dataPoints || (day % 5 === 0 && (dataPoints - day) > 2)) {
                return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}`;
              }
              return '';
            } else {
              d.setMonth(d.getMonth() + i);
              return monthsShort[d.getMonth()];
            }
          });
        }

        if (aggregated.some(val => val > 0)) {
          setChartData({
            labels,
            datasets: [{
              data: aggregated,
              color: (o = 1) => {
                if (chartMetric === 'Lucro') return `rgba(40,167,69,${o})`;
                if (chartMetric === 'Itens') return `rgba(142,68,173,${o})`;
                if (chartMetric === 'Rentabilidade') return `rgba(214,158,46,${o})`;
                return `rgba(0,122,255,${o})`;
              },
              strokeWidth: 3
            }]
          });
        } else {
          setChartData(null);
        }

        let sortField = 'receita';
        if (chartMetric === 'Lucro') sortField = 'lucro';
        if (chartMetric === 'Itens') sortField = 'qtd';
        if (chartMetric === 'Rentabilidade') sortField = 'rentabilidade';

        const rankingArray = Object.values(productStats).map(p => {
          p.margem = p.receita > 0 ? parseFloat(((p.lucro / p.receita) * 100).toFixed(1)) : 0;
          const investimento = p.custoVendido + (p.estoqueAtual * p.ultimoCusto);
          p.rentabilidade = investimento > 0 ? ((p.lucro / investimento) * 100) : 0;
          return p;
        }).sort((a, b) => b[sortField] - a[sortField]).slice(0, 5);
        setTopProducts(rankingArray);

      } catch (err) {
        console.log("Erro gráfico:", err.message);
      } finally {
        setChartLoading(false);
      }
    };
    if (lojaAtiva) carregarGraficoERanking();
  }, [lojaAtiva, selectedMonth, selectedYear, chartMetric, timeSpan, chartTimeMode]);

  // Efeito 3: Raio-X Diário
  useEffect(() => {
    const carregarRaioX = async () => {
      setDailyLoading(true);
      try {
        const start = new Date(dailyDate); start.setHours(0,0,0,0);
        const end = new Date(dailyDate); end.setHours(23,59,59,999);

        const { data, error } = await supabase
          .from('movimentacoes')
          .select('id, quantidade, preco_venda_hist, preco_custo_hist, criado_em, produtos!inner(nome, loja_id)')
          .eq('is_venda', true)
          .eq('produtos.loja_id', lojaAtiva.id)
          .gte('criado_em', start.toISOString())
          .lte('criado_em', end.toISOString())
          .order('criado_em', { ascending: false });

        if (error) throw error;

        let dReceita = 0;
        let dLucro = 0;
        if (data) {
          data.forEach(mov => {
            const r = mov.quantidade * (mov.preco_venda_hist || 0);
            const l = mov.quantidade * ((mov.preco_venda_hist || 0) - (mov.preco_custo_hist || 0));
            dReceita += r;
            dLucro += l;
          });
        }
        setDailyData(data || []);
        setDailyTotal({ receita: dReceita, lucro: dLucro });
      } catch (err) {
        console.log("Erro Raio-X:", err.message);
      } finally {
        setDailyLoading(false);
      }
    };
    if (lojaAtiva) carregarRaioX();
  }, [lojaAtiva, dailyDate]);

  const renderDailyItem = (mov) => {
    const dataHora = new Date(mov.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const nome = mov.produtos?.nome || 'Desconhecido';
    const totalVenda = mov.quantidade * (mov.preco_venda_hist || 0);
    const lucroVenda = mov.quantidade * ((mov.preco_venda_hist || 0) - (mov.preco_custo_hist || 0));
    return (
      <View key={mov.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f0f4f8' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '600', color: '#2d3748' }}>{nome}</Text>
          <Text style={{ fontSize: 12, color: '#a0aec0' }}>{dataHora} • {mov.quantidade} unidade(s)</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontWeight: 'bold', color: '#2d3748' }}>{formatCurrency(totalVenda)}</Text>
          <Text style={{ fontSize: 11, color: '#38a169', fontWeight: '600' }}>Lucro: {formatCurrency(lucroVenda)}</Text>
        </View>
      </View>
    );
  };

  const crescimento = salesTotalPrev > 0 ? (((salesTotal - salesTotalPrev) / salesTotalPrev) * 100).toFixed(1) : 0;
  const ticketMedio = salesCount > 0 ? salesTotal / salesCount : 0;
  const metricColor = chartMetric === 'Lucro' ? '#28a745' : chartMetric === 'Itens' ? '#8e44ad' : chartMetric === 'Rentabilidade' ? '#d69e2e' : '#007AFF';
  const intelPeriodLabel = intelTimeMode === 'calendario' 
    ? (intelFilter === 'Mês' ? `${months[intelSelectedMonth]} ${intelSelectedYear}` :
       intelFilter === 'Trimestre' ? `${Math.floor(intelSelectedMonth/3)+1}º Tri de ${intelSelectedYear}` :
       intelFilter === 'Semestre' ? `${Math.floor(intelSelectedMonth/6)+1}º Sem de ${intelSelectedYear}` :
       `Ano de ${intelSelectedYear}`)
    : intelFilter;

  return (
    <View 
      style={{ flex: 1, backgroundColor: '#f0f4f8' }}
      onStartShouldSetResponder={() => {
        if (showGrowthTooltip) setShowGrowthTooltip(false);
        if (showTicketTooltip) setShowTicketTooltip(false);
        if (activeIntelTooltip) setActiveIntelTooltip(null);
        return false;
      }}
    >
      <View style={{ paddingTop: Platform.OS === 'android' ? 40 : 50, paddingBottom: 15, paddingHorizontal: 20, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#e0e5ea' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 15 }}>
          <Ionicons name="arrow-back" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1a202c' }}>Dashboard Financeiro</Text>
      </View>

      <ScrollView 
        contentContainerStyle={{ padding: 20 }}
        onScrollBeginDrag={() => { 
          if (showGrowthTooltip) setShowGrowthTooltip(false);
          if (showTicketTooltip) setShowTicketTooltip(false);
          if (activeIntelTooltip) setActiveIntelTooltip(null);
        }}
        scrollEventThrottle={16}
      >
        
        <LinearGradient
          colors={['#007AFF', '#0056b3']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#007AFF', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8, zIndex: 100 }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <Text style={{ color: '#e6f2ff', fontSize: 16, fontWeight: '600' }}>Vendas Realizadas</Text>
            <Ionicons name="cart" size={24} color="#fff" />
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20, marginHorizontal: -5 }}>
            {filters.map(f => (
              <TouchableOpacity
                key={f}
                onPress={() => { setFilter(f); setShowGrowthTooltip(false); setShowTicketTooltip(false); }}
                style={{
                  backgroundColor: filter === f ? '#fff' : 'rgba(255,255,255,0.2)',
                  paddingHorizontal: 15,
                  paddingVertical: 6,
                  borderRadius: 20,
                  marginHorizontal: 5
                }}
              >
                <Text style={{ color: filter === f ? '#007AFF' : '#fff', fontWeight: 'bold', fontSize: 12 }}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={{ minHeight: 110, justifyContent: 'center' }}>
            {salesLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View>
                <Text style={{ color: '#fff', fontSize: 36, fontWeight: 'bold' }}>{formatCurrency(salesTotal)}</Text>
                
                <View style={{ zIndex: 10 }}>
                  <View style={{ flexDirection: 'row', marginTop: 8, alignItems: 'center', zIndex: 10 }}>
                    <View style={{ position: 'relative', zIndex: 30 }}>
                      <TouchableOpacity onPress={() => { setShowTicketTooltip(!showTicketTooltip); setShowGrowthTooltip(false); }} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginRight: 10 }}>
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold', marginRight: 4 }}>
                          Ticket Médio: {formatCurrency(ticketMedio)}
                        </Text>
                        <Ionicons name="information-circle-outline" size={14} color="#fff" />
                      </TouchableOpacity>
                      
                      <Animated.View style={{ opacity: ticketAnim, transform: [{ translateY: ticketAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }], pointerEvents: showTicketTooltip ? 'auto' : 'none', position: 'absolute', top: 35, left: 0, width: 220, zIndex: 100, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 6 }}>
                        <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e0' }}>
                          <Text style={{ color: '#2d3748', fontSize: 12, lineHeight: 18 }}>
                            <Text style={{ fontWeight: 'bold', color: '#007AFF' }}>Ticket Médio</Text> é o valor financeiro médio gasto em cada venda. Indica quanto, em média, a sua loja lucrou por transação neste período.
                          </Text>
                        </View>
                        <View style={{ position: 'absolute', top: -6, left: 24, width: 12, height: 12, backgroundColor: '#fff', transform: [{ rotate: '45deg' }], borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#cbd5e0' }} />
                      </Animated.View>
                    </View>
                    
                    {filter !== 'Tudo' && salesTotalPrev > 0 && (
                      <View style={{ position: 'relative', zIndex: 20 }}>
                        <TouchableOpacity onPress={() => { setShowGrowthTooltip(!showGrowthTooltip); setShowTicketTooltip(false); }} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: crescimento >= 0 ? 'rgba(76, 175, 80, 0.8)' : 'rgba(244, 67, 54, 0.8)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                          <Ionicons name={crescimento >= 0 ? "trending-up" : "trending-down"} size={14} color="#fff" style={{ marginRight: 4 }} />
                          <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
                            {crescimento >= 0 ? '+' : ''}{crescimento}%
                          </Text>
                        </TouchableOpacity>

                        <Animated.View style={{ opacity: tooltipAnim, transform: [{ translateY: tooltipAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }], pointerEvents: showGrowthTooltip ? 'auto' : 'none', position: 'absolute', top: 35, left: '50%', marginLeft: -100, width: 200, zIndex: 100, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 6 }}>
                          <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e0' }}>
                            <Text style={{ color: '#2d3748', fontSize: 12, lineHeight: 18, textAlign: 'center' }}>
                              <Text style={{ fontWeight: 'bold', color: crescimento >= 0 ? '#38a169' : '#e53e3e' }}>{crescimento >= 0 ? 'Aumento' : 'Queda'} nas vendas</Text> em relação {filter === 'Hoje' ? 'a ontem.' : filter === '7 Dias' ? 'à semana passada.' : filter === '30 Dias' ? 'ao mês passado.' : 'ao ano passado.'}
                            </Text>
                          </View>
                          <View style={{ position: 'absolute', top: -6, left: 94, width: 12, height: 12, backgroundColor: '#fff', transform: [{ rotate: '45deg' }], borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#cbd5e0' }} />
                        </Animated.View>
                      </View>
                    )}
                  </View>
                </View>

                <Text style={{ color: '#b3d9ff', fontSize: 13, marginTop: 10 }}>{salesCount} unidade(s) vendidas no período</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
            <Ionicons name="bar-chart" size={24} color={metricColor} style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1a202c' }}>Evolução do Negócio</Text>
          </View>
          
          <View style={{ flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 20, padding: 3, marginBottom: 15 }}>
            <TouchableOpacity onPress={() => { setChartTimeMode('corridos'); setTimeSpan('30 Dias'); }} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 18, backgroundColor: chartTimeMode === 'corridos' ? '#fff' : 'transparent', shadowColor: chartTimeMode === 'corridos' ? '#000' : 'transparent', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1, elevation: chartTimeMode === 'corridos' ? 1 : 0 }}>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: chartTimeMode === 'corridos' ? '#2d3748' : '#718096' }}>Corridos</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setChartTimeMode('calendario'); setTimeSpan('Mês'); }} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 18, backgroundColor: chartTimeMode === 'calendario' ? '#fff' : 'transparent', shadowColor: chartTimeMode === 'calendario' ? '#000' : 'transparent', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1, elevation: chartTimeMode === 'calendario' ? 1 : 0 }}>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: chartTimeMode === 'calendario' ? '#2d3748' : '#718096' }}>Calendário</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, gap: 10 }}>
            <View style={{ flex: 1 }}>
              <TimeSpanDropdown 
                fullWidth={true}
                color={metricColor}
                options={chartTimeMode === 'calendario' ? ['Mês', 'Trimestre', 'Semestre', 'Ano'] : ['7 Dias', '30 Dias', 'Ano (365)']}
                value={timeSpan}
                onSelect={(ts) => {
                  setTimeSpan(ts);
                  if (chartTimeMode === 'calendario') {
                    setSelectedMonth(new Date().getMonth());
                    setSelectedYear(new Date().getFullYear());
                  }
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TimeSpanDropdown 
                fullWidth={true}
                color={metricColor}
                options={['Receita', 'Lucro', 'Rentabilidade', 'Itens']}
                value={chartMetric}
                onSelect={(metric) => setChartMetric(metric)}
              />
            </View>
          </View>

          {chartTimeMode === 'calendario' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f4f8', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 15, justifyContent: 'space-between' }}>
              <TouchableOpacity onPress={() => {
                const step = timeSpan === 'Trimestre' ? 3 : timeSpan === 'Semestre' ? 6 : timeSpan === 'Ano' ? 12 : 1;
                let newMonth = selectedMonth - step;
                let newYear = selectedYear;
                if (newMonth < 0) {
                  newYear -= Math.ceil(Math.abs(newMonth) / 12) || 1;
                  newMonth = 12 + (newMonth % 12);
                  if (newMonth === 12) newMonth = 0;
                }
                setSelectedMonth(newMonth);
                setSelectedYear(newYear);
              }} style={{ padding: 5 }}>
                <Ionicons name="chevron-back" size={20} color={metricColor} />
              </TouchableOpacity>
              
              <Text style={{ fontSize: 15, fontWeight: 'bold', color: metricColor, textAlign: 'center', flex: 1 }}>
                {timeSpan === 'Mês' ? `${months[selectedMonth]} ${selectedYear}` :
                 timeSpan === 'Trimestre' ? `${Math.floor(selectedMonth/3)+1}º Tri de ${selectedYear}` :
                 timeSpan === 'Semestre' ? `${Math.floor(selectedMonth/6)+1}º Sem de ${selectedYear}` :
                 `Ano de ${selectedYear}`}
              </Text>
              
              <TouchableOpacity onPress={() => {
                const step = timeSpan === 'Trimestre' ? 3 : timeSpan === 'Semestre' ? 6 : timeSpan === 'Ano' ? 12 : 1;
                let newMonth = selectedMonth + step;
                let newYear = selectedYear;
                if (newMonth > 11) {
                  newYear += Math.floor(newMonth / 12);
                  newMonth = newMonth % 12;
                }
                setSelectedMonth(newMonth);
                setSelectedYear(newYear);
              }} style={{ padding: 5 }}>
                <Ionicons name="chevron-forward" size={20} color={metricColor} />
              </TouchableOpacity>
            </View>
          )}

          <View style={{ alignItems: 'center', minHeight: 236, justifyContent: 'center' }}>
            {chartLoading ? (
              <ActivityIndicator size="large" color="#007AFF" />
            ) : chartData ? (
              <LineChart
                data={chartData}
                width={Dimensions.get("window").width - 80}
                height={220}
                withDots={false}
                withInnerLines={false}
                withOuterLines={false}
                yAxisLabel={chartMetric === 'Itens' || chartMetric === 'Rentabilidade' ? '' : 'R$ '}
                yAxisSuffix={chartMetric === 'Itens' ? ' un' : chartMetric === 'Rentabilidade' ? '%' : ''}
                chartConfig={{
                  backgroundColor: "#fff",
                  backgroundGradientFrom: "#fff",
                  backgroundGradientTo: "#fff",
                  decimalPlaces: chartMetric === 'Itens' ? 0 : 0,
                  color: (o = 1) => `rgba(0,0,0,${o})`,
                  labelColor: (o = 1) => `rgba(100,100,100,${o})`,
                  style: { borderRadius: 16 },
                  propsForDots: { r: "0" }
                }}
                bezier
                style={{ marginVertical: 8, borderRadius: 16 }}
              />
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Ionicons name="bar-chart-outline" size={48} color="#ccc" />
                <Text style={{ color: '#999', marginTop: 10 }}>Nenhuma venda neste período.</Text>
              </View>
            )}
          </View>

          {topProducts.length > 0 && (
            <View style={{ marginTop: 20, borderTopWidth: 1, borderColor: '#eee', paddingTop: 15, opacity: chartLoading ? 0.5 : 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                <Ionicons name="trophy-outline" size={16} color="#4a5568" style={{ marginRight: 5 }} />
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1a202c' }}>
                  {chartMetric === 'Lucro' ? `Maiores Lucros` : chartMetric === 'Itens' ? `Maiores Saídas` : chartMetric === 'Rentabilidade' ? `Mais Rentáveis` : `Maiores Receitas`} {chartTimeMode === 'calendario' ? `do ${timeSpan}` : (timeSpan === 'Ano (365)' ? `do último Ano` : `dos últimos ${timeSpan}`)}
                </Text>
              </View>
              {topProducts.map((p, index) => (
                <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text numberOfLines={1} style={{ flex: 1, color: '#2d3748', fontWeight: '600' }}>
                    <Text style={{ fontWeight: 'bold', color: chartMetric === 'Lucro' ? '#28a745' : chartMetric === 'Itens' ? '#8e44ad' : chartMetric === 'Rentabilidade' ? '#d69e2e' : '#007AFF' }}>{index + 1}º</Text> {p.nome}
                  </Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    {chartMetric === 'Lucro' 
                      ? <Text style={{ color: '#28a745', fontWeight: 'bold' }}>{formatCurrency(p.lucro)}</Text>
                      : chartMetric === 'Receita' 
                        ? <Text style={{ color: '#007AFF', fontWeight: 'bold' }}>{formatCurrency(p.receita)}</Text>
                        : chartMetric === 'Rentabilidade'
                          ? <Text style={{ color: '#d69e2e', fontWeight: 'bold' }}>{(p.rentabilidade || 0).toFixed(1)}%</Text>
                          : <Text style={{ color: '#8e44ad', fontWeight: 'bold' }}>{p.qtd} un</Text>
                    }
                    <Text style={{ color: '#a0aec0', fontSize: 11 }}>
                      {chartMetric === 'Itens' ? `${p.qtd} un` : chartMetric === 'Rentabilidade' ? `(${formatCurrency(p.lucro)} lucro)` : `(${p.qtd} un)`}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ========================================================
            NOVA: INTELIGÊNCIA DE NEGÓCIO & DESEMPENHO (LUPA)
            ======================================================== */}
        <TouchableOpacity 
          onPress={seedDashboardData} 
          style={{ backgroundColor: '#ed8936', padding: 15, borderRadius: 12, marginBottom: 15, alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 }}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>🪄 Gerar Histórico Falso (Apaga o Atual)</Text>
        </TouchableOpacity>
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
            <Ionicons name="stats-chart" size={24} color="#007AFF" style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1a202c' }}>Análise de Desempenho</Text>
          </View>

          <View style={{ flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 20, padding: 3, marginBottom: 15 }}>
            <TouchableOpacity onPress={() => { setIntelTimeMode('corridos'); setIntelFilter('30 Dias'); }} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 18, backgroundColor: intelTimeMode === 'corridos' ? '#fff' : 'transparent', shadowColor: intelTimeMode === 'corridos' ? '#000' : 'transparent', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1, elevation: intelTimeMode === 'corridos' ? 1 : 0 }}>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: intelTimeMode === 'corridos' ? '#2d3748' : '#718096' }}>Corridos</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setIntelTimeMode('calendario'); setIntelFilter('Mês'); }} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 18, backgroundColor: intelTimeMode === 'calendario' ? '#fff' : 'transparent', shadowColor: intelTimeMode === 'calendario' ? '#000' : 'transparent', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1, elevation: intelTimeMode === 'calendario' ? 1 : 0 }}>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: intelTimeMode === 'calendario' ? '#2d3748' : '#718096' }}>Calendário</Text>
            </TouchableOpacity>
          </View>

          {/* Filtros da Seção */}
          <View style={{ marginBottom: 15 }}>
            <TimeSpanDropdown 
              fullWidth={true}
              options={intelTimeMode === 'corridos' ? ['7 Dias', '30 Dias', 'Ano', 'Tudo'] : ['Mês', 'Trimestre', 'Semestre', 'Ano']}
              value={intelFilter}
              onSelect={(f) => {
                setIntelFilter(f);
                if (intelTimeMode === 'calendario') {
                  setIntelSelectedMonth(new Date().getMonth());
                  setIntelSelectedYear(new Date().getFullYear());
                }
              }}
            />
          </View>

          {intelTimeMode === 'calendario' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f4f8', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 15, justifyContent: 'space-between' }}>
              <TouchableOpacity onPress={() => {
                const step = intelFilter === 'Trimestre' ? 3 : intelFilter === 'Semestre' ? 6 : intelFilter === 'Ano' ? 12 : 1;
                let newMonth = intelSelectedMonth - step;
                let newYear = intelSelectedYear;
                if (newMonth < 0) {
                  newYear -= Math.ceil(Math.abs(newMonth) / 12) || 1;
                  newMonth = 12 + (newMonth % 12);
                  if (newMonth === 12) newMonth = 0;
                }
                setIntelSelectedMonth(newMonth);
                setIntelSelectedYear(newYear);
              }} style={{ padding: 5 }}>
                <Ionicons name="chevron-back" size={20} color="#007AFF" />
              </TouchableOpacity>
              
              <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#007AFF', textAlign: 'center', flex: 1 }}>
                {intelPeriodLabel}
              </Text>
              
              <TouchableOpacity onPress={() => {
                const step = intelFilter === 'Trimestre' ? 3 : intelFilter === 'Semestre' ? 6 : intelFilter === 'Ano' ? 12 : 1;
                let newMonth = intelSelectedMonth + step;
                let newYear = intelSelectedYear;
                if (newMonth > 11) {
                  newYear += Math.floor(newMonth / 12);
                  newMonth = newMonth % 12;
                }
                setIntelSelectedMonth(newMonth);
                setIntelSelectedYear(newYear);
              }} style={{ padding: 5 }}>
                <Ionicons name="chevron-forward" size={20} color="#007AFF" />
              </TouchableOpacity>
            </View>
          )}

          {intelLoading ? (
            <ActivityIndicator color="#007AFF" style={{ marginVertical: 30 }} />
          ) : (
            <>
              {/* Insights Removidos */}

              {/* Estatísticas Gerais */}
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#a0aec0', marginBottom: 10, textTransform: 'uppercase' }}>Visão Geral da Loja ({intelPeriodLabel})</Text>
              <View style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 15, marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, zIndex: 30 }}>
                  <View style={{ position: 'relative', zIndex: 30 }}>
                    <TouchableOpacity onPress={() => setActiveIntelTooltip(activeIntelTooltip === 'unidades' ? null : 'unidades')} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                      <Text style={{ fontSize: 11, color: '#718096', fontWeight: 'bold', marginRight: 4 }}>UNIDADES VENDIDAS</Text>
                      <Ionicons name="information-circle-outline" size={14} color="#a0aec0" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 16, color: '#2d3748', fontWeight: 'bold' }}>{intelTotals.qtdTotal || 0} un</Text>
                    
                    <Animated.View style={{ opacity: animUnidades, transform: [{ translateY: animUnidades.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }], pointerEvents: activeIntelTooltip === 'unidades' ? 'auto' : 'none', position: 'absolute', top: 25, left: -5, width: 200, zIndex: 100, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 6 }}>
                      <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e0' }}>
                        <Text style={{ color: '#2d3748', fontSize: 12, lineHeight: 18 }}>A soma total de todos os itens que foram vendidos no período selecionado.</Text>
                      </View>
                      <View style={{ position: 'absolute', top: -6, left: 24, width: 12, height: 12, backgroundColor: '#fff', transform: [{ rotate: '45deg' }], borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#cbd5e0' }} />
                    </Animated.View>
                  </View>
                  <View style={{ alignItems: 'flex-end', position: 'relative', zIndex: 30 }}>
                    <TouchableOpacity onPress={() => setActiveIntelTooltip(activeIntelTooltip === 'margem' ? null : 'margem')} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                      <Ionicons name="information-circle-outline" size={14} color="#a0aec0" style={{ marginRight: 4 }} />
                      <Text style={{ fontSize: 11, color: '#718096', fontWeight: 'bold' }}>MARGEM MÉDIA</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 16, color: (intelTotals.margemMedia || 0) >= 20 ? '#38a169' : '#e53e3e', fontWeight: 'bold' }}>{(intelTotals.margemMedia || 0).toFixed(1)}%</Text>
                    
                    <Animated.View style={{ opacity: animMargem, transform: [{ translateY: animMargem.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }], pointerEvents: activeIntelTooltip === 'margem' ? 'auto' : 'none', position: 'absolute', top: 25, right: -5, width: 220, zIndex: 100, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 6 }}>
                      <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e0' }}>
                        <Text style={{ color: '#2d3748', fontSize: 12, lineHeight: 18, textAlign: 'right' }}>A porcentagem média de lucro em relação à receita.{'\n'}Fórmula: (Lucro / Receita) x 100</Text>
                      </View>
                      <View style={{ position: 'absolute', top: -6, right: 24, width: 12, height: 12, backgroundColor: '#fff', transform: [{ rotate: '45deg' }], borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#cbd5e0' }} />
                    </Animated.View>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, zIndex: 20 }}>
                  <View style={{ position: 'relative', zIndex: 20 }}>
                    <TouchableOpacity onPress={() => setActiveIntelTooltip(activeIntelTooltip === 'receita' ? null : 'receita')} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                      <Text style={{ fontSize: 11, color: '#718096', fontWeight: 'bold', marginRight: 4 }}>RECEITA GERADA</Text>
                      <Ionicons name="information-circle-outline" size={14} color="#a0aec0" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 15, color: '#2d3748', fontWeight: 'bold' }}>{formatCurrency(intelTotals.receita || 0)}</Text>
                    
                    <Animated.View style={{ opacity: animReceita, transform: [{ translateY: animReceita.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }], pointerEvents: activeIntelTooltip === 'receita' ? 'auto' : 'none', position: 'absolute', top: 25, left: -5, width: 220, zIndex: 100, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 6 }}>
                      <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e0' }}>
                        <Text style={{ color: '#2d3748', fontSize: 12, lineHeight: 18 }}>Todo o dinheiro bruto que entrou no caixa com as vendas no período selecionado.</Text>
                      </View>
                      <View style={{ position: 'absolute', top: -6, left: 24, width: 12, height: 12, backgroundColor: '#fff', transform: [{ rotate: '45deg' }], borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#cbd5e0' }} />
                    </Animated.View>
                  </View>
                  <View style={{ alignItems: 'flex-end', position: 'relative', zIndex: 20 }}>
                    <TouchableOpacity onPress={() => setActiveIntelTooltip(activeIntelTooltip === 'lucro' ? null : 'lucro')} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                      <Ionicons name="information-circle-outline" size={14} color="#a0aec0" style={{ marginRight: 4 }} />
                      <Text style={{ fontSize: 11, color: '#718096', fontWeight: 'bold' }}>LUCRO LÍQUIDO</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 15, color: '#38a169', fontWeight: 'bold' }}>{formatCurrency(intelTotals.lucro || 0)}</Text>
                    
                    <Animated.View style={{ opacity: animLucro, transform: [{ translateY: animLucro.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }], pointerEvents: activeIntelTooltip === 'lucro' ? 'auto' : 'none', position: 'absolute', top: 25, right: -5, width: 220, zIndex: 100, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 6 }}>
                      <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e0' }}>
                        <Text style={{ color: '#2d3748', fontSize: 12, lineHeight: 18, textAlign: 'right' }}>A receita gerada menos o Custo da Mercadoria Vendida (CMV).</Text>
                      </View>
                      <View style={{ position: 'absolute', top: -6, right: 24, width: 12, height: 12, backgroundColor: '#fff', transform: [{ rotate: '45deg' }], borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#cbd5e0' }} />
                    </Animated.View>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderColor: '#edf2f7', zIndex: 10 }}>
                  <View style={{ position: 'relative', zIndex: 10 }}>
                    <TouchableOpacity onPress={() => setActiveIntelTooltip(activeIntelTooltip === 'capital' ? null : 'capital')} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                      <Text style={{ fontSize: 11, color: '#718096', fontWeight: 'bold', marginRight: 4 }}>CAPITAL INVESTIDO</Text>
                      <Ionicons name="information-circle-outline" size={14} color="#a0aec0" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 15, color: '#4a5568', fontWeight: 'bold' }}>{formatCurrency(intelTotals.investimentoTotal || 0)}</Text>
                    
                    <Animated.View style={{ opacity: animCapital, transform: [{ translateY: animCapital.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }], pointerEvents: activeIntelTooltip === 'capital' ? 'auto' : 'none', position: 'absolute', top: 25, left: -5, width: 240, zIndex: 100, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 6 }}>
                      <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e0' }}>
                        <Text style={{ color: '#2d3748', fontSize: 12, lineHeight: 18 }}>O custo das unidades vendidas MAIS o custo de todo o estoque atual parado nas prateleiras.</Text>
                      </View>
                      <View style={{ position: 'absolute', top: -6, left: 24, width: 12, height: 12, backgroundColor: '#fff', transform: [{ rotate: '45deg' }], borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#cbd5e0' }} />
                    </Animated.View>
                  </View>
                  <View style={{ alignItems: 'flex-end', position: 'relative', zIndex: 10 }}>
                    <TouchableOpacity onPress={() => setActiveIntelTooltip(activeIntelTooltip === 'roi' ? null : 'roi')} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                      <Ionicons name="information-circle-outline" size={14} color="#a0aec0" style={{ marginRight: 4 }} />
                      <Text style={{ fontSize: 11, color: '#718096', fontWeight: 'bold' }}>RENTABILIDADE (ROI)</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 15, color: '#d69e2e', fontWeight: 'bold' }}>{(intelTotals.rentabilidadeGeral || 0).toFixed(1)}%</Text>
                    
                    <Animated.View style={{ opacity: animRoi, transform: [{ translateY: animRoi.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }], pointerEvents: activeIntelTooltip === 'roi' ? 'auto' : 'none', position: 'absolute', top: 25, right: -5, width: 240, zIndex: 100, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 6 }}>
                      <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e0' }}>
                        <Text style={{ color: '#2d3748', fontSize: 12, lineHeight: 18, textAlign: 'right' }}>Mostra o quanto do investimento feito na loja já se pagou através dos lucros. Um ROI de 100% significa que o investimento já se pagou por completo.{'\n'}Fórmula: (Lucro / Capital) x 100</Text>
                      </View>
                      <View style={{ position: 'absolute', top: -6, right: 24, width: 12, height: 12, backgroundColor: '#fff', transform: [{ rotate: '45deg' }], borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#cbd5e0' }} />
                    </Animated.View>
                  </View>
                </View>
                <View style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, marginTop: 5, alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 8 }}>
                    {['Receita', 'Lucro', 'Unidades Vendidas'].map(m => (
                      <TouchableOpacity 
                        key={m} 
                        onPress={() => setBestDayMetric(m)}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: bestDayMetric === m ? '#007AFF' : '#edf2f7', borderRadius: 16, marginHorizontal: 4 }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: 'bold', color: bestDayMetric === m ? '#fff' : '#718096' }}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={{ fontSize: 12, color: '#4a5568', textAlign: 'center', lineHeight: 18 }}>
                    {(() => {
                      const rawDay = (intelTotals.bestDay && typeof intelTotals.bestDay === 'object') ? intelTotals.bestDay[bestDayMetric] : '-';
                      if (!rawDay || rawDay === '-') return `Nenhum dado de ${bestDayMetric.toLowerCase()} no período.`;
                      
                      const isPlural = intelFilter !== '7 Dias';
                      const isMasc = rawDay === 'Sábado' || rawDay === 'Domingo';
                      
                      let prefix = '';
                      if (intelFilter === '7 Dias') prefix = 'Na última semana, o melhor dia da semana em';
                      else if (intelFilter === '30 Dias') prefix = 'No último mês, o melhor dia da semana em';
                      else if (intelFilter === 'Ano') prefix = 'No último ano, o melhor dia da semana em';
                      else prefix = 'No histórico geral, o melhor dia da semana em';

                      if (!isPlural) {
                        const article = isMasc ? 'o' : 'a';
                        return <>{prefix} <Text style={{ fontWeight: 'bold', color: '#2d3748' }}>{bestDayMetric.toLowerCase()}</Text> foi {article} <Text style={{ fontWeight: 'bold', color: '#007AFF' }}>{rawDay}</Text>.</>;
                      } else {
                        const article = isMasc ? 'os' : 'as';
                        const pluralDay = rawDay + 's';
                        return <>{prefix} <Text style={{ fontWeight: 'bold', color: '#2d3748' }}>{bestDayMetric.toLowerCase()}</Text> foram {article} <Text style={{ fontWeight: 'bold', color: '#007AFF' }}>{pluralDay}</Text>.</>;
                      }
                    })()}
                  </Text>
                </View>
              </View>

              {/* Lupa do Produto */}
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#a0aec0', marginBottom: 10, textTransform: 'uppercase' }}>Análise por Produto ({intelPeriodLabel})</Text>
              <TouchableOpacity onPress={openIntelModal} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f0f4f8', padding: 15, borderRadius: 12, marginBottom: 15 }}>
                <Text numberOfLines={1} style={{ flex: 1, marginRight: 10, color: intelSelectedProduct ? '#1a202c' : '#718096', fontWeight: 'bold', fontSize: 14 }}>
                  {intelSelectedProduct && products.find(p => p.id === intelSelectedProduct) ? products.find(p => p.id === intelSelectedProduct).nome : 'Selecione um produto para investigar'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#718096" />
              </TouchableOpacity>

              {intelSelectedProduct && (
                <View style={{ backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 15 }}>
                  {intelStats.find(s => s.id === intelSelectedProduct) ? (
                    (() => {
                      const selStat = intelStats.find(s => s.id === intelSelectedProduct);
                      const percReceita = intelTotals.receita > 0 ? ((selStat.receita / intelTotals.receita) * 100).toFixed(1) : 0;
                      return (
                        <>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, zIndex: 30 }}>
                            <View style={{ position: 'relative', zIndex: 30 }}>
                              <TouchableOpacity onPress={() => setActiveIntelTooltip(activeIntelTooltip === 'prod_unidades' ? null : 'prod_unidades')} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                                <Text style={{ fontSize: 11, color: '#718096', fontWeight: 'bold', marginRight: 4 }}>UNIDADES VENDIDAS</Text>
                                <Ionicons name="information-circle-outline" size={14} color="#a0aec0" />
                              </TouchableOpacity>
                              <Text style={{ fontSize: 16, color: '#2d3748', fontWeight: 'bold' }}>{selStat.qtd} un</Text>
                              <Animated.View style={{ opacity: animProdUnidades, transform: [{ translateY: animProdUnidades.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }], pointerEvents: activeIntelTooltip === 'prod_unidades' ? 'auto' : 'none', position: 'absolute', top: 25, left: -5, width: 200, zIndex: 100, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 6 }}>
                                <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e0' }}>
                                  <Text style={{ color: '#2d3748', fontSize: 12, lineHeight: 18 }}>A soma total de todos os itens deste produto que foram vendidos no período selecionado.</Text>
                                </View>
                                <View style={{ position: 'absolute', top: -6, left: 24, width: 12, height: 12, backgroundColor: '#fff', transform: [{ rotate: '45deg' }], borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#cbd5e0' }} />
                              </Animated.View>
                            </View>
                            <View style={{ alignItems: 'flex-end', position: 'relative', zIndex: 30 }}>
                              <TouchableOpacity onPress={() => setActiveIntelTooltip(activeIntelTooltip === 'prod_margem' ? null : 'prod_margem')} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                                <Ionicons name="information-circle-outline" size={14} color="#a0aec0" style={{ marginRight: 4 }} />
                                <Text style={{ fontSize: 11, color: '#718096', fontWeight: 'bold' }}>MARGEM DE LUCRO</Text>
                              </TouchableOpacity>
                              <Text style={{ fontSize: 16, color: selStat.margem >= 20 ? '#38a169' : '#e53e3e', fontWeight: 'bold' }}>{selStat.margem.toFixed(1)}%</Text>
                              <Animated.View style={{ opacity: animProdMargem, transform: [{ translateY: animProdMargem.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }], pointerEvents: activeIntelTooltip === 'prod_margem' ? 'auto' : 'none', position: 'absolute', top: 25, right: -5, width: 220, zIndex: 100, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 6 }}>
                                <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e0' }}>
                                  <Text style={{ color: '#2d3748', fontSize: 12, lineHeight: 18, textAlign: 'right' }}>A porcentagem média de lucro para as vendas deste produto.{'\n'}Fórmula: (Lucro / Receita) x 100</Text>
                                </View>
                                <View style={{ position: 'absolute', top: -6, right: 24, width: 12, height: 12, backgroundColor: '#fff', transform: [{ rotate: '45deg' }], borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#cbd5e0' }} />
                              </Animated.View>
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, zIndex: 20 }}>
                            <View style={{ position: 'relative', zIndex: 20 }}>
                              <TouchableOpacity onPress={() => setActiveIntelTooltip(activeIntelTooltip === 'prod_receita' ? null : 'prod_receita')} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                                <Text style={{ fontSize: 11, color: '#718096', fontWeight: 'bold', marginRight: 4 }}>RECEITA GERADA</Text>
                                <Ionicons name="information-circle-outline" size={14} color="#a0aec0" />
                              </TouchableOpacity>
                              <Text style={{ fontSize: 15, color: '#2d3748', fontWeight: 'bold' }}>{formatCurrency(selStat.receita)}</Text>
                              <Animated.View style={{ opacity: animProdReceita, transform: [{ translateY: animProdReceita.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }], pointerEvents: activeIntelTooltip === 'prod_receita' ? 'auto' : 'none', position: 'absolute', top: 25, left: -5, width: 220, zIndex: 100, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 6 }}>
                                <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e0' }}>
                                  <Text style={{ color: '#2d3748', fontSize: 12, lineHeight: 18 }}>Todo o dinheiro bruto que entrou no caixa proveniente deste produto no período selecionado.</Text>
                                </View>
                                <View style={{ position: 'absolute', top: -6, left: 24, width: 12, height: 12, backgroundColor: '#fff', transform: [{ rotate: '45deg' }], borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#cbd5e0' }} />
                              </Animated.View>
                            </View>
                            <View style={{ alignItems: 'flex-end', position: 'relative', zIndex: 20 }}>
                              <TouchableOpacity onPress={() => setActiveIntelTooltip(activeIntelTooltip === 'prod_lucro' ? null : 'prod_lucro')} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                                <Ionicons name="information-circle-outline" size={14} color="#a0aec0" style={{ marginRight: 4 }} />
                                <Text style={{ fontSize: 11, color: '#718096', fontWeight: 'bold' }}>LUCRO LÍQUIDO</Text>
                              </TouchableOpacity>
                              <Text style={{ fontSize: 15, color: '#38a169', fontWeight: 'bold' }}>{formatCurrency(selStat.lucro)}</Text>
                              <Animated.View style={{ opacity: animProdLucro, transform: [{ translateY: animProdLucro.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }], pointerEvents: activeIntelTooltip === 'prod_lucro' ? 'auto' : 'none', position: 'absolute', top: 25, right: -5, width: 220, zIndex: 100, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 6 }}>
                                <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e0' }}>
                                  <Text style={{ color: '#2d3748', fontSize: 12, lineHeight: 18, textAlign: 'right' }}>A receita deste produto menos o seu Custo da Mercadoria Vendida (CMV).</Text>
                                </View>
                                <View style={{ position: 'absolute', top: -6, right: 24, width: 12, height: 12, backgroundColor: '#fff', transform: [{ rotate: '45deg' }], borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#cbd5e0' }} />
                              </Animated.View>
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderColor: '#edf2f7', zIndex: 10 }}>
                            <View style={{ position: 'relative', zIndex: 10 }}>
                              <TouchableOpacity onPress={() => setActiveIntelTooltip(activeIntelTooltip === 'prod_capital' ? null : 'prod_capital')} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                                <Text style={{ fontSize: 11, color: '#718096', fontWeight: 'bold', marginRight: 4 }}>CAPITAL INVESTIDO</Text>
                                <Ionicons name="information-circle-outline" size={14} color="#a0aec0" />
                              </TouchableOpacity>
                              <Text style={{ fontSize: 15, color: '#4a5568', fontWeight: 'bold' }}>{formatCurrency(selStat.investimento || 0)}</Text>
                              <Animated.View style={{ opacity: animProdCapital, transform: [{ translateY: animProdCapital.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }], pointerEvents: activeIntelTooltip === 'prod_capital' ? 'auto' : 'none', position: 'absolute', top: 25, left: -5, width: 240, zIndex: 100, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 6 }}>
                                <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e0' }}>
                                  <Text style={{ color: '#2d3748', fontSize: 12, lineHeight: 18 }}>O custo das unidades vendidas deste produto MAIS o custo de todo o estoque deste produto atual parado nas prateleiras.</Text>
                                </View>
                                <View style={{ position: 'absolute', top: -6, left: 24, width: 12, height: 12, backgroundColor: '#fff', transform: [{ rotate: '45deg' }], borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#cbd5e0' }} />
                              </Animated.View>
                            </View>
                            <View style={{ alignItems: 'flex-end', position: 'relative', zIndex: 10 }}>
                              <TouchableOpacity onPress={() => setActiveIntelTooltip(activeIntelTooltip === 'prod_roi' ? null : 'prod_roi')} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                                <Ionicons name="information-circle-outline" size={14} color="#a0aec0" style={{ marginRight: 4 }} />
                                <Text style={{ fontSize: 11, color: '#718096', fontWeight: 'bold' }}>RENTABILIDADE (ROI)</Text>
                              </TouchableOpacity>
                              <Text style={{ fontSize: 15, color: '#d69e2e', fontWeight: 'bold' }}>{(selStat.rentabilidade || 0).toFixed(1)}%</Text>
                              <Animated.View style={{ opacity: animProdRoi, transform: [{ translateY: animProdRoi.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }], pointerEvents: activeIntelTooltip === 'prod_roi' ? 'auto' : 'none', position: 'absolute', top: 25, right: -5, width: 240, zIndex: 100, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 6 }}>
                                <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e0' }}>
                                  <Text style={{ color: '#2d3748', fontSize: 12, lineHeight: 18, textAlign: 'right' }}>Mostra o quanto do investimento feito neste produto já se pagou através dos lucros. Um ROI de 100% significa que o investimento nele já se pagou por completo.{'\n'}Fórmula: (Lucro / Capital) x 100</Text>
                                </View>
                                <View style={{ position: 'absolute', top: -6, right: 24, width: 12, height: 12, backgroundColor: '#fff', transform: [{ rotate: '45deg' }], borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#cbd5e0' }} />
                              </Animated.View>
                            </View>
                          </View>
                          <View style={{ backgroundColor: '#f8fafc', padding: 10, borderRadius: 8, marginTop: 5 }}>
                            <Text style={{ fontSize: 12, color: '#4a5568', textAlign: 'center' }}>
                              Representou <Text style={{ fontWeight: 'bold', color: '#2d3748' }}>{percReceita}%</Text> da receita e <Text style={{ fontWeight: 'bold', color: '#38a169' }}>{intelTotals.lucro > 0 ? ((selStat.lucro / intelTotals.lucro) * 100).toFixed(1) : 0}%</Text> de todo o lucro.
                            </Text>
                          </View>
                        </>
                      );
                    })()
                  ) : (
                    <Text style={{ textAlign: 'center', color: '#a0aec0', fontSize: 13, paddingVertical: 10 }}>Este produto não teve saídas no período selecionado.</Text>
                  )}
                </View>
              )}
            </>
          )}
        </View>

        {/* ========================================================
            3. RAIO-X DIÁRIO (VISÃO DETALHADA)
            ======================================================== */}
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 3 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="search-outline" size={20} color="#007AFF" style={{ marginRight: 8 }} />
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1a202c' }}>Raio-X Diário</Text>
            </View>
            
            <TouchableOpacity 
              onPress={() => setShowDatePicker(true)}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f4f8', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
            >
              <Text style={{ color: '#007AFF', fontWeight: 'bold', marginRight: 5 }}>
                {dailyDate.toLocaleDateString('pt-BR')}
              </Text>
              <Ionicons name="calendar-outline" size={16} color="#007AFF" />
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={dailyDate}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (selectedDate) setDailyDate(selectedDate);
              }}
            />
          )}

          {dailyLoading ? (
            <ActivityIndicator color="#007AFF" style={{ marginVertical: 30 }} />
          ) : dailyData.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <Ionicons name="receipt-outline" size={40} color="#ccc" />
              <Text style={{ color: '#999', marginTop: 10 }}>Nenhuma venda registrada neste dia.</Text>
            </View>
          ) : (
            <>
              {/* Resumo do Dia */}
              <View style={{ flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 8, padding: 12, marginBottom: 15 }}>
                <View style={{ flex: 1, borderRightWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, color: '#718096', fontWeight: 'bold' }}>RECEITA DO DIA</Text>
                  <Text style={{ fontSize: 16, color: '#2d3748', fontWeight: 'bold', marginTop: 4 }}>{formatCurrency(dailyTotal.receita)}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, color: '#718096', fontWeight: 'bold' }}>LUCRO DO DIA</Text>
                  <Text style={{ fontSize: 16, color: '#38a169', fontWeight: 'bold', marginTop: 4 }}>{formatCurrency(dailyTotal.lucro)}</Text>
                </View>
              </View>

              {/* Lista de Saídas */}
              <View>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#a0aec0', marginBottom: 10, textTransform: 'uppercase' }}>Extrato de Saídas</Text>
                {(showAllDaily ? dailyData : dailyData.slice(0, 10)).map(renderDailyItem)}
                
                {dailyData.length > 10 && (
                  <TouchableOpacity onPress={() => setShowAllDaily(!showAllDaily)} style={{ marginTop: 15, alignItems: 'center', paddingVertical: 12, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                    <Text style={{ color: '#007AFF', fontWeight: 'bold', fontSize: 14 }}>
                      {showAllDaily ? 'Ocultar extrato completo' : `Ver mais ${dailyData.length - 10} vendas...`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>

        {/* ========================================================
            4. RETRATO DO ESTOQUE ATUAL & ALERTAS
            ======================================================== */}
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
            <Ionicons name="cube" size={24} color="#007AFF" style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1a202c' }}>Retrato do Estoque Atual</Text>
          </View>

          {estoqueCritico.length > 0 && (
            <TouchableOpacity 
              onPress={() => {
                setGlobalAutoFilter('critico');
                navigation.goBack();
              }}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff5f5', borderColor: '#feb2b2', borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 15 }}
            >
              <Ionicons name="warning" size={24} color="#e53e3e" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#c53030', fontWeight: 'bold', fontSize: 14 }}>Atenção Necessária</Text>
                <Text style={{ color: '#e53e3e', fontSize: 13 }}>Você tem {estoqueCritico.length} produto(s) no estoque crítico.</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#e53e3e" />
            </TouchableOpacity>
          )}

          <View style={{ flexDirection: 'column', marginBottom: 15 }}>
            <View style={{ backgroundColor: '#f0f4f8', padding: 15, borderRadius: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: '#718096', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' }}>Custo Investido</Text>
                <Text style={{ color: '#1a202c', fontSize: 20, fontWeight: 'bold', marginTop: 4 }}>{formatCurrency(totalInvestido)}</Text>
              </View>
              <View style={{ backgroundColor: 'rgba(0, 122, 255, 0.1)', padding: 10, borderRadius: 12 }}>
                <Ionicons name="cube-outline" size={24} color="#007AFF" />
              </View>
            </View>
            
            <View style={{ backgroundColor: '#f0f4f8', padding: 15, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: '#718096', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' }}>Receita Bruta</Text>
                <Text style={{ color: '#1a202c', fontSize: 20, fontWeight: 'bold', marginTop: 4 }}>{formatCurrency(valorBruto)}</Text>
              </View>
              <View style={{ backgroundColor: 'rgba(0, 122, 255, 0.1)', padding: 10, borderRadius: 12 }}>
                <Ionicons name="pricetag-outline" size={24} color="#007AFF" />
              </View>
            </View>
          </View>

          <LinearGradient
            colors={['#10b981', '#047857']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 12, padding: 20 }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ color: '#d1fae5', fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase' }}>Lucro Projetado (Físico)</Text>
                <Text style={{ color: '#fff', fontSize: 26, fontWeight: 'bold', marginTop: 4 }}>{formatCurrency(lucroProjetado)}</Text>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 8 }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Margem Geral: {margemGeral}%</Text>
                </View>
              </View>
              <Ionicons name="trending-up" size={40} color="rgba(255,255,255,0.3)" />
            </View>
          </LinearGradient>
        </View>

      </ScrollView>

      <Modal visible={showProductModal} animationType="fade" transparent={true}>
        <TouchableWithoutFeedback onPress={closeIntelModal}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
            <TouchableWithoutFeedback>
              <View style={{ backgroundColor: '#fff', borderRadius: 16, width: '90%', maxHeight: '80%', padding: 20 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1a202c' }}>Selecione um Produto</Text>
                  <TouchableOpacity onPress={closeIntelModal}>
                    <Ionicons name="close-circle" size={28} color="#a0aec0" />
                  </TouchableOpacity>
                </View>
                
                <View style={{ flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 8, alignItems: 'center', paddingHorizontal: 10, height: 48, marginBottom: 15 }}>
                  <Ionicons name="search" size={20} color="#64748b" />
                  <TextInput 
                    placeholder="Buscar produto..." 
                    placeholderTextColor="#94a3b8"
                    value={intelSearch} 
                    onChangeText={setIntelSearch} 
                    style={{ flex: 1, paddingLeft: 10, color: '#333', height: '100%' }} 
                  />
                  {intelSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setIntelSearch('')}>
                      <Ionicons name="close-circle" size={20} color="#94a3b8" />
                    </TouchableOpacity>
                  )}
                </View>

                <FlatList
                  data={products.filter(p => p.nome.toLowerCase().includes(intelSearch.toLowerCase()))}
                  keyExtractor={item => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      onPress={() => { setIntelSelectedProduct(item.id); closeIntelModal(); }} 
                      style={{ paddingVertical: 15, borderBottomWidth: 1, borderColor: '#edf2f7', flexDirection: 'row', justifyContent: 'space-between' }}
                    >
                      <Text style={{ fontSize: 16, color: '#2d3748', fontWeight: intelSelectedProduct === item.id ? 'bold' : 'normal' }}>{item.nome}</Text>
                      {intelSelectedProduct === item.id && <Ionicons name="checkmark-circle" size={20} color="#007AFF" />}
                    </TouchableOpacity>
                  )}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

    </View>
  );
};


const PdvScreen = ({ navigation }) => {
  const lojaAtiva = useStore(state => state.lojaAtiva);
  const products = useStore(state => state.products);
  const setProducts = useStore(state => state.setProducts);
  
  const carrinho = useStore(state => state.carrinhoGlobal);
  const setCarrinho = useStore(state => state.setCarrinhoGlobal);
  const setUnreadNotifCount = useStore(state => state.setUnreadNotifCount);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  
  const [editandoQuantidadeId, setEditandoQuantidadeId] = useState(null);
  const [tempQtd, setTempQtd] = useState('');

  const totalItens = carrinho.reduce((acc, item) => acc + item.quantidade, 0);

  const openCamera = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert("Permissão negada", "Precisamos de acesso à câmera para escanear códigos.");
        return;
      }
    }
    setIsCameraVisible(true);
    setIsScanning(true);
  };

  const handleBarcodeScanned = ({ type, data }) => {
    setIsScanning(false);
    const produtoEncontrado = products.find(p => p.sku_barcode === data);
    if (produtoEncontrado) {
      adicionarAoCarrinho(produtoEncontrado);
      setIsCameraVisible(false);
    } else {
      Alert.alert("Não encontrado", `Nenhum produto com o código ${data} foi localizado no estoque.`);
      setTimeout(() => setIsScanning(true), 2000);
    }
  };

  const total = carrinho.reduce((acc, item) => acc + (item.preco_venda * item.quantidade), 0);

  const filteredProducts = products.filter(p => 
    p.nome.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.sku_barcode && p.sku_barcode.includes(searchQuery))
  );

  const adicionarAoCarrinho = (produto) => {
    setCarrinho(prev => {
      const existe = prev.find(p => p.id === produto.id);
      if (existe) {
        if (existe.quantidade >= produto.estoque_atual) {
          Alert.alert("Estoque insuficiente", `Você só tem ${produto.estoque_atual} em estoque.`);
          return prev;
        }
        return prev.map(p => p.id === produto.id ? { ...p, quantidade: p.quantidade + 1 } : p);
      } else {
        if (produto.estoque_atual <= 0) {
          Alert.alert("Sem estoque", "Este produto está zerado no estoque.");
          return prev;
        }
        return [...prev, { ...produto, quantidade: 1 }];
      }
    });
    setSearchQuery('');
  };

  const removerDoCarrinho = (id) => {
    setCarrinho(prev => prev.filter(item => item.id !== id));
  };

  const salvarQuantidadeDigitada = (id, estoqueMaximo) => {
    const num = parseInt(tempQtd, 10);
    setEditandoQuantidadeId(null);
    if (isNaN(num) || num <= 0) return;
    
    setCarrinho(prev => prev.map(item => {
      if (item.id === id) {
        if (num > estoqueMaximo) {
          Alert.alert("Estoque insuficiente", `Você só tem ${estoqueMaximo} disponíveis.`);
          return item;
        }
        return { ...item, quantidade: num };
      }
      return item;
    }));
  };

  const alterarQuantidade = (id, delta) => {
    setCarrinho(prev => {
      return prev.map(item => {
        if (item.id === id) {
          const novaQtd = item.quantidade + delta;
          if (novaQtd <= 0) return null;
          if (novaQtd > item.estoque_atual) {
            Alert.alert("Estoque insuficiente", `Você só tem ${item.estoque_atual} disponíveis.`);
            return item;
          }
          return { ...item, quantidade: novaQtd };
        }
        return item;
      }).filter(Boolean);
    });
  };

  const finalizarVenda = async () => {
    if (carrinho.length === 0) return;
    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const movimentos = carrinho.map(item => ({
        produto_id: item.id,
        usuario_id: user.id,
        tipo: 'SAIDA',
        quantidade: item.quantidade,
        is_venda: true,
        preco_custo_hist: item.preco_custo,
        preco_venda_hist: item.preco_venda,
        observacao: 'Venda via Caixa'
      }));

      const { error: errMov } = await supabase.from('movimentacoes').insert(movimentos);
      if (errMov) throw errMov;

      const novasNotificacoes = [];

      for (const item of carrinho) {
        const novoEstoque = item.estoque_atual - item.quantidade;
        await supabase.from('produtos').update({ estoque_atual: novoEstoque }).eq('id', item.id);

        if (item.notificar_movimentacao) {
          novasNotificacoes.push({
            loja_id: lojaAtiva.id,
            produto_id: item.id,
            mensagem: `Movimentação: -${item.quantidade} unidade(s) de ${item.nome} (Venda PDV).`,
            tipo: 'movimentacao'
          });
        }

        if (item.notificar_minimo && novoEstoque <= item.estoque_minimo) {
          novasNotificacoes.push({
            loja_id: lojaAtiva.id,
            produto_id: item.id,
            mensagem: `Atenção: O estoque de ${item.nome} chegou a ${novoEstoque} (Mínimo: ${item.estoque_minimo}).`,
            tipo: 'alerta_minimo'
          });
        }
      }

      if (novasNotificacoes.length > 0) {
        const { error: errorNotif } = await supabase.from('notificacoes').insert(novasNotificacoes);
        if (errorNotif) console.log("Erro ao gerar notificação de venda:", errorNotif);
        else setUnreadNotifCount(prev => prev + novasNotificacoes.length);
      }

      const novosProdutos = products.map(p => {
        const itemVendido = carrinho.find(c => c.id === p.id);
        if (itemVendido) return { ...p, estoque_atual: p.estoque_atual - itemVendido.quantidade };
        return p;
      });
      setProducts(novosProdutos);

      setCarrinho([]);
      navigation.goBack();
    } catch (err) {
      Alert.alert("Erro ao finalizar", err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <View style={{ flex: 1, backgroundColor: '#f0f4f8' }}>
      <View style={{ paddingTop: Platform.OS === 'android' ? 40 : 50, paddingBottom: 15, paddingHorizontal: 20, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: '#e0e5ea' }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 15 }}>
          <Ionicons name="close" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1a202c' }}>Caixa (Vender)</Text>
      </View>

      <View style={{ flex: 1, flexDirection: 'column' }}>
        <FlatList
          data={carrinho}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ padding: 15, paddingTop: 80 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 100 }}>
              <Ionicons name="cart-outline" size={64} color="#ccc" />
              <Text style={{ color: '#999', marginTop: 10 }}>O carrinho está vazio.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={{ backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1, position: 'relative' }}>
              <TouchableOpacity onPress={() => removerDoCarrinho(item.id)} style={{ position: 'absolute', top: -8, right: -8, width: 26, height: 26, backgroundColor: '#ef4444', borderRadius: 13, justifyContent: 'center', alignItems: 'center', zIndex: 10, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2 }}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>{item.nome}</Text>
                <Text style={{ fontSize: 14, color: '#007AFF', marginTop: 4 }}>{formatCurrency(item.preco_venda)}</Text>
              </View>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', borderRadius: 8, padding: 4 }}>
                <TouchableOpacity onPress={() => alterarQuantidade(item.id, -1)} style={{ width: 36, height: 36, backgroundColor: '#fff', borderRadius: 6, justifyContent: 'center', alignItems: 'center', elevation: 1 }}>
                  <Ionicons name="remove" size={20} color="#333" />
                </TouchableOpacity>

                {editandoQuantidadeId === item.id ? (
                  <TextInput
                    style={{ width: 45, height: 36, textAlign: 'center', fontSize: 16, fontWeight: 'bold', color: '#333', backgroundColor: '#e2e8f0', borderRadius: 4, padding: 0 }}
                    value={tempQtd}
                    onChangeText={setTempQtd}
                    keyboardType="numeric"
                    autoFocus
                    selectTextOnFocus={true}
                    onBlur={() => salvarQuantidadeDigitada(item.id, item.estoque_atual)}
                    onSubmitEditing={() => salvarQuantidadeDigitada(item.id, item.estoque_atual)}
                  />
                ) : (
                  <TouchableOpacity onPress={() => { setEditandoQuantidadeId(item.id); setTempQtd(String(item.quantidade)); }} style={{ width: 45, height: 36, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>{item.quantidade}</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity onPress={() => alterarQuantidade(item.id, 1)} style={{ width: 36, height: 36, backgroundColor: '#fff', borderRadius: 6, justifyContent: 'center', alignItems: 'center', elevation: 1 }}>
                  <Ionicons name="add" size={20} color="#333" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />

        {/* Barra de Busca e Scanner sobreposta à lista (Movida para o final do DOM para garantir toques no Android) */}
        <View style={{ 
          position: 'absolute',
          top: 0, left: 0, right: 0,
          paddingHorizontal: 15, paddingTop: 15, paddingBottom: 10, 
          backgroundColor: 'transparent', zIndex: 10 
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 8, alignItems: 'center', paddingHorizontal: 10, height: 48 }}>
              <Ionicons name="search" size={20} color="#64748b" />
              <TextInput 
                placeholder="Buscar produto para vender..." 
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
              onPress={openCamera}
            >
              <Ionicons name="barcode-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {searchQuery.length > 0 && (
            <View style={{ position: 'absolute', top: 70, left: 15, right: 15, backgroundColor: '#fff', borderRadius: 8, elevation: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, zIndex: 10, maxHeight: 200 }}>
              <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled={true}>
                {filteredProducts.slice(0, 50).map(p => (
                  <TouchableOpacity key={p.id} onPress={() => adicionarAoCarrinho(p)} style={{ padding: 15, borderBottomWidth: 1, borderColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={{ fontWeight: 'bold', color: '#333' }} numberOfLines={1}>{p.nome}</Text>
                      <Text style={{ fontSize: 12, color: '#888' }}>Estoque: {p.estoque_atual}</Text>
                    </View>
                    <Text style={{ color: '#007AFF', fontWeight: 'bold', flexShrink: 0 }}>{formatCurrency(p.preco_venda || 0)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        <View style={{ backgroundColor: '#fff', padding: 20, borderTopWidth: 1, borderColor: '#eee', elevation: 10, zIndex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <Text style={{ fontSize: 14, color: '#888' }}>Itens no carrinho</Text>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#333' }}>{totalItens}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
            <Text style={{ fontSize: 16, color: '#666' }}>Total da Venda</Text>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#007AFF' }}>{formatCurrency(total)}</Text>
          </View>
          
          <TouchableOpacity onPress={finalizarVenda} disabled={carrinho.length === 0 || isProcessing} style={{ backgroundColor: carrinho.length === 0 ? '#ccc' : '#4CAF50', padding: 16, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}>
            {isProcessing ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="checkmark-circle-outline" size={24} color="#fff" style={{ marginRight: 8 }} />
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>Finalizar Venda</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

      </View>

      {/* Modal da Câmera do Caixa */}
      <Modal visible={isCameraVisible} animationType="slide" onRequestClose={() => setIsCameraVisible(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <View style={{ padding: 20, paddingTop: Platform.OS === 'android' ? 40 : 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>Escanear Produto</Text>
            <TouchableOpacity onPress={() => setIsCameraVisible(false)} style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 }}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <View style={{ flex: 1 }}>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              onBarcodeScanned={isScanning ? handleBarcodeScanned : undefined}
              barcodeScannerSettings={{
                barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "qr"],
              }}
            />
            
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
              <View style={{ width: 250, height: 150, borderWidth: 3, borderColor: '#4CAF50', borderRadius: 10, backgroundColor: 'transparent' }} />
              <Text style={{ color: '#fff', marginTop: 30, backgroundColor: 'rgba(0,0,0,0.7)', padding: 10, borderRadius: 8, fontSize: 16 }}>
                Alinhe o código do produto na caixa
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const AuthNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="SignUp" component={SignUpScreen} />
  </Stack.Navigator>
);

const MainAppNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Drawer" component={MainAppDrawer} />
    <Stack.Screen name="Movimentacoes" component={MovimentacoesScreen} />
    <Stack.Screen name="Notificacoes" component={NotificacoesScreen} />
    <Stack.Screen name="Tarefas" component={TarefasScreen} />
    <Stack.Screen name="Equipe" component={EquipeScreen} />
    <Stack.Screen name="Dashboard" component={DashboardScreen} />
    <Stack.Screen name="PDV" component={PdvScreen} />
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
          <Stack.Screen name="MainApp" component={MainAppNavigator} /> 
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
