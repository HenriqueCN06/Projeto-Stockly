// Adicione esta linha no TOPO ABSOLUTO do arquivo
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
  setLojaAtiva: (loja) => set({ lojaAtiva: loja }),
  setPermissoesAtivas: (perms) => set({ permissoesAtivas: perms }),

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
        .insert([{ id: data.user.id, nome: nome, email: email }]);
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

const EmptyScreen = ({ navigation }) => {
  const lojaAtiva = useStore(state => state.lojaAtiva);
  const permissoesAtivas = useStore(state => state.permissoesAtivas);
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
        
        // 2. Liga a tela de loading de forma estável
        setLoadingProducts(true);

        // 3. Busca quem é o usuário (Rápido)
        const { data: { user } } = await supabase.auth.getUser();
        if (user) setMeuId(user.id);

        // 4. Busca os Produtos e a Contagem de Avisos SIMULTANEAMENTE (Performance Turbo)
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

        // 5. Aplica os resultados na tela de uma só vez
        if (resNotificacoes.count !== null) setUnreadNotifCount(resNotificacoes.count);
        if (resProdutos.data) setProducts(resProdutos.data);

        // 6. Desliga o loading (A tela surge pronta e completa)
        setLoadingProducts(false);
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

  const showBanner = (message, type) => {
    setNotification({ visible: true, message, type });
    setTimeout(() => {
      setNotification({ visible: false, message: '', type: 'success' });
    }, 3000); // Some sozinho após 3 segundos
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
    
    // Trocamos o Alert.alert por isto:
    showBanner(`Código lido: ${data}`, "success"); 
  };

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
        // --- CENÁRIO A: EDIÇÃO DE PRODUTO QUE JÁ ESTÁ NA TELA ---
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
            observacao: 'Edição manual (Janela)'
          }]);

          // 2. NOVO: Motor de Notificações para a janela de edição
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
        // --- CENÁRIO B: TENTATIVA DE CRIAR UM NOVO PRODUTO ---
        
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
            // RESSURREIÇÃO: O produto existia, foi apagado e agora está voltando
            const { data: ressuscitado, error: errorRessuscitar } = await supabase
              .from('produtos')
              .update({
                nome: nome,
                preco_custo: custoNum,
                preco_venda: vendaNum,
                estoque_atual: atualNum,
                estoque_minimo: minNum,
                ativo: true, // Traz de volta à vida!
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
                observacao: 'Produto reativado'
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
              observacao: 'Estoque inicial (Novo Produto)'
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
      // 1. NOVO: Se o produto tinha estoque, registra a SAÍDA no histórico antes de inativar
      if (produtoEditando.estoque_atual > 0) {
        await supabase.from('movimentacoes').insert([{
          produto_id: produtoEditando.id,
          usuario_id: meuId,
          tipo: 'SAIDA',
          quantidade: produtoEditando.estoque_atual, // Zera tudo que sobrou
          observacao: 'Produto inativado (excluído)'
        }]);
      }

      // 2. A MÁGICA: Em vez de .delete(), fazemos um .update() para inativar e zerar o estoque no banco
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
        observacao: 'Ajuste manual'
      }]);
      if (errorMov) throw errorMov;

      // 3. NOVO: MOTOR DE NOTIFICAÇÕES
      const notificacoes = [];

      // A) Regra da Movimentação (Gera aviso se a chave estiver ligada)
      if (produto.notificar_movimentacao) {
        notificacoes.push({
          loja_id: lojaAtiva.id,
          produto_id: produto.id,
          mensagem: `Movimentação: ${mudanca > 0 ? '+' : '-'}${Math.abs(mudanca)} unidade(s) de ${produto.nome}.`,
          tipo: 'movimentacao'
        });
      }

      // B) Regra do Estoque Mínimo (Gera aviso apenas se foi uma SAÍDA e atingiu o limite)
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
        else setUnreadNotifCount(prev => prev + notificacoes.length); // <-- ADICIONE ESTA LINHA
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
        observacao: 'Ajuste manual (Lista)'
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
        
        
{/* --- NOVO: NOTIFICAÇÃO VISUAL DO BANNER --- */}
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
          position: 'absolute', // <-- Faz a barra flutuar sobre a tela
          top: 0, left: 0, right: 0, 
          paddingHorizontal: 15, 
          paddingTop: 15, 
          paddingBottom: 10, 
          backgroundColor: 'transparent', // <-- Fundo invisível
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
            
            // AGORA É UMA FLATLIST NORMAL (Sem a barra dentro dela)
            <FlatList
              data={processedProducts}
              keyExtractor={(item) => item.id.toString()}
              // O paddingTop foi aumentado para 85 para o primeiro item não ficar escondido
              contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 15, paddingTop: 75 }}
              
              renderItem={({ item }) => (
                <TouchableOpacity 
                  activeOpacity={0.7} 
                  onPress={() => abrirModalEdicao(item)} 
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
                      <TouchableOpacity onPress={() => handleAjusteEstoque(item, -1)} style={{ width: 32, height: 32, backgroundColor: '#fff', borderRadius: 6, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, elevation: 1 }}>
                        <Ionicons name="remove" size={20} color="#d9534f" />
                      </TouchableOpacity>
                      {editingStockId === item.id ? (
                        <TextInput
                          style={{ width: 45, textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: '#333', backgroundColor: '#e2e8f0', borderRadius: 4, padding: 0, height: 32 }}
                          value={tempStockValue}
                          onChangeText={setTempStockValue}
                          keyboardType="numeric"
                          autoFocus={true} // Já abre o teclado automaticamente
                          onBlur={() => handleSalvarEstoqueInline(item)} // O onBlur será o único responsável por salvar
                          onSubmitEditing={() => Keyboard.dismiss()} // O Enter apenas fecha o teclado (o que vai acionar o onBlur automaticamente)
                        />
                      ) : (
                        <TouchableOpacity 
                          onPress={() => { 
                            if (!permissoesAtivas?.quantidades) {
                              showBanner("Sem permissão para alterar o estoque.", "error");
                              return;
                            }
                            setEditingStockId(item.id); 
                            setTempStockValue(item.estoque_atual.toString()); 
                          }}
                        >
                          <Text style={{ fontSize: 18, fontWeight: 'bold', color: item.estoque_atual <= item.estoque_minimo ? '#d9534f' : '#4CAF50', width: 45, textAlign: 'center' }}>
                            {item.estoque_atual}
                          </Text>
                        </TouchableOpacity>
                      )}
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

        {/* BARRA INFERIOR (MENU) */}
        <View style={{ height: Platform.OS === 'android' ? 90 : 70, paddingBottom: Platform.OS === 'android' ? 20 : 0, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#e0e0e0', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
          
          {/* Espaço invisível na extrema esquerda */}
          <View style={{ width: 60 }} />

          {/* NOVO: Botão de Equipe (Acessos) */}
          <TouchableOpacity onPress={() => navigation.navigate('Equipe')} style={{ width: 60, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="people-outline" size={28} color="#555" />
            <Text style={{ fontSize: 10, color: '#555', marginTop: 2, fontWeight: 'bold' }}>Equipe</Text>
          </TouchableOpacity>

          {/* Botão de Adicionar Produto (Centralizado) */}
          <TouchableOpacity style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginTop: -40, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 }} onPress={abrirModalNovo}>
            <Ionicons name="add" size={32} color="#fff" />
          </TouchableOpacity>

          {/* Botão de Notificações com Bolinha Vermelha */}
          <TouchableOpacity 
            onPress={() => navigation.navigate('Notificacoes')}
            style={{ width: 60, alignItems: 'center', justifyContent: 'center' }}
          >
            <View>
              <Ionicons name="notifications-outline" size={28} color="#555" />
              {unreadNotifCount > 0 && (
                <View style={{ position: 'absolute', top: -2, right: -4, backgroundColor: '#d9534f', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 1, borderColor: '#fff' }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 10, color: '#555', marginTop: 2, fontWeight: 'bold' }}>Avisos</Text>
          </TouchableOpacity>

          {/* Botão de Histórico */}
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
                // Mantém a funcionalidade de subir a janela quando o teclado aparece
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
                    <TextInput placeholder="Estoque Atual" placeholderTextColor="#999" value={estoqueAtual} onChangeText={setEstoqueAtual} style={[styles.input, { width: '48%' }]} keyboardType="numeric" />
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
  

  // NOVO: Estados para o Menu Flutuante (Opções) e Renomear
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

      setModalSairVisible(false); // <-- AGORA FECHA O NOVO MODAL
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

      {/* 2. NOVO: Modal do Menu Flutuante (Opções) */}
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
                  setTimeout(() => setModalSairVisible(true), 100); // Abre o novo Modal bonitão
                }}
              >
                <Ionicons name="log-out-outline" size={22} color="#d9534f" style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 16, color: '#d9534f', fontWeight: '500' }}>Sair do estoque</Text>
              </TouchableOpacity>
            )}
          </View>
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

      {/* 5. NOVO: Modal de Confirmar Saída */}
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
    quantidades: false,
    adicionar: false,
    editar: false,
    gerenciar: false,
    gerenciar_avisos: false
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
          // 1º Critério: Hierarquia (Quem gerencia vem antes)
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
      gerenciar_avisos: membro.perm_gerenciar_avisos || false
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
          perm_gerenciar_avisos: perms.gerenciar_avisos
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
          <View style={{ backgroundColor: '#f5f5f5', paddingTop: 15, paddingBottom: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#888', marginHorizontal: 20, textTransform: 'uppercase' }}>
              Membros Atuais
            </Text>
          </View>
          
          {/* O DEGRADÊ (FADE): Fica posicionado em absoluto para cair por cima da lista */}
          <LinearGradient
            colors={['#f5f5f5', 'rgba(245,245,245,0)']}
            style={{ height: 25, width: '100%', position: 'absolute', bottom: -25 }}
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
            contentContainerStyle={{ paddingTop: 25, paddingBottom: 20 }}
            renderItem={({ item }) => {
              const souEu = item.usuario_id === meuId; 
              const souDono = lojaAtiva?.dono_id === meuId;
              
              // 1. Define se o item da lista é um Gerente
              const isGerente = !item.isOwner && item.perm_gerenciar_membros;

              // 2. Cores dinâmicas (Amarelo = Dono, Verde = Gerente, Azul = Membro Comum)
              const corDestaque = item.isOwner ? '#ffc107' : (isGerente ? '#28a745' : '#007AFF');
              const fundoDestaque = item.isOwner ? '#fff3cd' : (isGerente ? '#e8f5e9' : '#f0f7ff');
              
              // 3. Lógica do Círculo da Foto
              // Se for "Eu", o fundo é a cor forte. Se não, é o tom pastel.
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

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ fontSize: 15, color: '#333', fontWeight: '500' }}>Gerenciar Avisos</Text>
                    <Text style={{ fontSize: 12, color: '#888' }}>Permite apagar notificações da loja.</Text>
                  </View>
                  <Switch value={perms.gerenciar_avisos} onValueChange={(val) => setPerms({...perms, gerenciar_avisos: val})} trackColor={{ false: "#d9d9d9", true: "#b3d4ff" }} thumbColor={perms.gerenciar_avisos ? "#007AFF" : "#f4f3f4"} />
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ fontSize: 15, color: '#333', fontWeight: '500' }}>Gerenciar Membros</Text>
                    <Text style={{ fontSize: 12, color: '#888' }}>Permite convidar e alterar acessos da equipe.</Text>
                  </View>
                  <Switch value={perms.gerenciar} onValueChange={(val) => setPerms({...perms, gerenciar: val})} trackColor={{ false: "#d9d9d9", true: "#b3d4ff" }} thumbColor={perms.gerenciar ? "#007AFF" : "#f4f3f4"} />
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
const NotificacoesScreen = ({ navigation }) => {
  const lojaAtiva = useStore(state => state.lojaAtiva);
  const permissoesAtivas = useStore(state => state.permissoesAtivas);
  const setUnreadNotifCount = useStore(state => state.setUnreadNotifCount);

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
      .eq('loja_id', lojaAtiva.id)
      .order('concluido', { ascending: true }) // Tarefas abertas ficam no topo
      .order('created_at', { ascending: false });

    if (lembretesData) {
      // Busca os nomes dos responsáveis (se houver) para exibir na tarefa
      const ids = [...new Set(lembretesData.map(l => l.responsavel_id).filter(id => id))];
      let perfisMap = {};
      if (ids.length > 0) {
        const { data: perfis } = await supabase.from('perfis').select('id, nome').in('id', ids);
        if (perfis) perfis.forEach(p => { perfisMap[p.id] = p.nome });
      }
      
      const lembretesComNomes = lembretesData.map(l => ({
        ...l,
        nome_responsavel: l.responsavel_id ? perfisMap[l.responsavel_id] : null
      }));
      setLembretes(lembretesComNomes);
    }
    setLoadingLembretes(false);
  };

  const handleCriarLembreteRapido = async () => {
    if (!novoLembrete.trim()) return;
    setCriandoLembrete(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('lembretes').insert([{
      loja_id: lojaAtiva.id,
      texto: novoLembrete.trim(),
      criador_id: user.id,
      data_limite: dataLimite ? dataLimite.toISOString() : null // <-- Envia a data se existir
    }]);

    if (!error) {
      setNovoLembrete('');
      setDataLimite(null); // <-- Limpa a data após criar
      carregarLembretes();
    } else {
      console.log("ERRO AO CRIAR TAREFA:", error);
      Alert.alert("Erro", "Não foi possível criar a tarefa.");
    }
    setCriandoLembrete(false);
  };

  // Função para capturar a data escolhida no calendário
  const onChangeDate = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) setDataLimite(selectedDate);
  };

  const toggleConcluido = async (tarefa) => {
    // Atualiza a tela instantaneamente para dar sensação de velocidade
    const novoStatus = !tarefa.concluido;
    setLembretes(lembretes.map(l => l.id === tarefa.id ? { ...l, concluido: novoStatus } : l));
    
    // Envia para o banco
    await supabase.from('lembretes').update({ concluido: novoStatus }).eq('id', tarefa.id);
    
    // Recarrega para que as tarefas concluídas desçam para o final da lista
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

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      
      {/* CABEÇALHO DINÂMICO */}
      <View style={{ paddingTop: Platform.OS === 'android' ? 40 : 50, paddingBottom: 15, paddingHorizontal: 20, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: '#eee' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => selecionando ? sairModoSelecao() : navigation.goBack()} style={{ marginRight: 15 }}>
            <Ionicons name={selecionando ? "close" : "arrow-back"} size={28} color="#333" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333' }}>
            {selecionando ? `${selecionados.length} selecionados` : (abaAtiva === 'avisos' ? "Avisos" : "Afazeres")}
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

      {/* NOVO: TOGGLE DE ABAS */}
      {!selecionando && (
        <View style={{ flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 8, marginHorizontal: 20, marginTop: 15, padding: 4 }}>
          <TouchableOpacity onPress={() => setAbaAtiva('avisos')} style={{ flex: 1, paddingVertical: 8, backgroundColor: abaAtiva === 'avisos' ? '#fff' : 'transparent', borderRadius: 6, alignItems: 'center', elevation: abaAtiva === 'avisos' ? 2 : 0 }}>
            <Text style={{ fontWeight: abaAtiva === 'avisos' ? 'bold' : '500', color: abaAtiva === 'avisos' ? '#333' : '#64748b' }}>Avisos do Sistema</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setAbaAtiva('afazeres')} style={{ flex: 1, paddingVertical: 8, backgroundColor: abaAtiva === 'afazeres' ? '#fff' : 'transparent', borderRadius: 6, alignItems: 'center', elevation: abaAtiva === 'afazeres' ? 2 : 0 }}>
            <Text style={{ fontWeight: abaAtiva === 'afazeres' ? 'bold' : '500', color: abaAtiva === 'afazeres' ? '#333' : '#64748b' }}>Lista de Tarefas</Text>
          </TouchableOpacity>
        </View>
      )}

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
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isMinimo ? '#fff3cd' : '#e2e8f0', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    <Ionicons name={isMinimo ? "warning" : "swap-vertical"} size={20} color={isMinimo ? "#ffc107" : "#64748b"} />
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
          
          {/* BARRA DE CRIAR RÁPIDA */}
          <View style={{ paddingHorizontal: 20, paddingTop: 15, paddingBottom: 5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 8, alignItems: 'center', paddingHorizontal: 10, height: 48 }}>
                <Ionicons name="add-circle-outline" size={22} color="#64748b" />
                <TextInput
                  placeholder="Ex: Fazer inventário..."
                  placeholderTextColor="#94a3b8"
                  value={novoLembrete}
                  onChangeText={setNovoLembrete}
                  style={{ flex: 1, paddingLeft: 10, color: '#333', height: '100%' }}
                  onSubmitEditing={handleCriarLembreteRapido}
                />
                
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
            
            {/* TEXTO AVISANDO A DATA ESCOLHIDA ANTES DE ENVIAR */}
            {dataLimite && (
              <Text style={{ color: '#007AFF', fontSize: 12, marginTop: 5, marginLeft: 5, fontWeight: 'bold' }}>
                Prazo: {dataLimite.toLocaleDateString('pt-BR')} 
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
          </View>

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
               contentContainerStyle={{ padding: 15 }}
               renderItem={({ item }) => (
                  <View style={{ backgroundColor: item.concluido ? '#f8f9fa' : '#fff', padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: item.concluido ? '#eee' : '#e2e8f0', elevation: item.concluido ? 0 : 1 }}>
                     
                     <TouchableOpacity onPress={() => toggleConcluido(item)} style={{ marginRight: 15 }}>
                        <Ionicons name={item.concluido ? "checkmark-circle" : "ellipse-outline"} size={28} color={item.concluido ? "#4CAF50" : "#ccc"} />
                     </TouchableOpacity>

                     <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, color: item.concluido ? '#999' : '#333', textDecorationLine: item.concluido ? 'line-through' : 'none', fontWeight: item.concluido ? 'normal' : '500' }}>{item.texto}</Text>
                        
                        {/* EXIBE O PRAZO SE EXISTIR */}
                        {item.data_limite && (
                           <Text style={{ fontSize: 12, color: (new Date(item.data_limite) < new Date() && !item.concluido) ? '#d9534f' : '#666', marginTop: 4, fontWeight: (new Date(item.data_limite) < new Date() && !item.concluido) ? 'bold' : 'normal' }}>
                             <Ionicons name="calendar-outline" size={12} /> Prazo: {new Date(item.data_limite).toLocaleDateString('pt-BR')}
                             {(new Date(item.data_limite) < new Date() && !item.concluido) && " (Atrasado)"}
                           </Text>
                        )}

                        {item.nome_responsavel && (
                           <Text style={{ fontSize: 12, color: '#007AFF', marginTop: 4 }}><Ionicons name="person-outline" size={12} /> {item.nome_responsavel}</Text>
                        )}
                     </View>

                     <TouchableOpacity onPress={() => apagarLembrete(item.id)} style={{ padding: 5 }}>
                        <Ionicons name="trash-outline" size={22} color="#d9534f" />
                     </TouchableOpacity>
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
      setLoading(true); // Garante que o loading comece
      
      const { data, error } = await supabase
        .from('movimentacoes')
        .select(`
          id, tipo, quantidade, observacao, criado_em,
          produtos!inner(nome, loja_id),
          perfis(nome) 
        `) // Mudamos para a sintaxe padrão de relação
        .eq('produtos.loja_id', lojaAtiva.id)
        .order('criado_em', { ascending: false })
        .limit(100);

      if (error) {
        // SE DER ERRO, ISSO VAI APARECER NO SEU TERMINAL:
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
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
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
  const setLojasMembro = useStore(state => state.setLojasMembro); // <-- Garantido que está aqui
  const lojaAtiva = useStore(state => state.lojaAtiva); 
  const setLojaAtiva = useStore(state => state.setLojaAtiva);
  const setIsFetchingLojas = useStore(state => state.setIsFetchingLojas);
  const setPermissoesAtivas = useStore(state => state.setPermissoesAtivas);

  // --- NOVO: VIGIA DE PERMISSÕES ---
  useEffect(() => {
    const fetchPermissoes = async () => {
      if (!lojaAtiva) return;
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (lojaAtiva.dono_id === user.id) {
        setPermissoesAtivas({
          quantidades: true, adicionar: true, editar: true, gerenciar: true, 
          gerenciar_avisos: true // <-- 1. Adicionado para o dono
        });
      } else {
        const { data } = await supabase
          .from('equipe')
          // 2. Adicionado na busca do banco:
          .select('perm_editar_quantidades, perm_adicionar_produto, perm_editar_produto, perm_gerenciar_membros, perm_gerenciar_avisos') 
          .eq('loja_id', lojaAtiva.id)
          .eq('usuario_id', user.id)
          .maybeSingle();
          
        if (data) {
          setPermissoesAtivas({
            quantidades: data.perm_editar_quantidades,
            adicionar: data.perm_adicionar_produto,
            editar: data.perm_editar_produto,
            gerenciar: data.perm_gerenciar_membros,
            gerenciar_avisos: data.perm_gerenciar_avisos // <-- 3. Salvo no estado global
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
        // O FINALLY garante que o carregamento vai desligar mesmo se tudo der errado!
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
        options={{ 
          title: lojaAtiva ? lojaAtiva.nome : '', 
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

// --- NOVO: Agrupa o Drawer e as novas telas para quem já está logado ---
const MainAppNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Drawer" component={MainAppDrawer} />
    <Stack.Screen name="Movimentacoes" component={MovimentacoesScreen} />
    <Stack.Screen name="Notificacoes" component={NotificacoesScreen} />
    <Stack.Screen name="Equipe" component={EquipeScreen} />
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
          // Usamos o MainAppNavigator em vez de ir direto pro Drawer
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