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
        style={styles.input} 
        onChangeText={setEmail} 
        value={email}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      
      <View style={styles.passwordContainer}>
        <TextInput 
          placeholder="Senha" 
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

      <TextInput placeholder="Nome" style={styles.input} onChangeText={setNome} value={nome} />
      <TextInput placeholder="E-mail" style={styles.input} onChangeText={setEmail} value={email} keyboardType="email-address" autoCapitalize="none" />
      
      <View style={styles.passwordContainer}>
        <TextInput 
          placeholder="Senha" 
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

  // Estados do Formulário
  const [modalVisible, setModalVisible] = useState(false);
  const [nome, setNome] = useState('');
  const [sku, setSku] = useState('');
  const [precoCusto, setPrecoCusto] = useState('');
  const [precoVenda, setPrecoVenda] = useState('');
  const [estoqueAtual, setEstoqueAtual] = useState('');
  const [estoqueMinimo, setEstoqueMinimo] = useState('');
  const [loading, setLoading] = useState(false);

  // --- MÁGICA DA ANIMAÇÃO ---
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current; // NOVO: Controla a sombra do fundo

  const abrirModal = () => {
    setModalVisible(true);
    // Animated.parallel faz as duas animações rodarem no exato milissegundo!
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0, // Caixa desliza para cima
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0.5, // Fundo vai até 50% de escuridão
        duration: 300,
        useNativeDriver: true,
      })
    ]).start();
  };

  const fecharModal = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: Dimensions.get('window').height, // Caixa desliza para baixo
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0, // Fundo clareia totalmente
        duration: 300,
        useNativeDriver: true,
      })
    ]).start(() => {
      setModalVisible(false); // Só desmonta a tela no final de tudo
    });
  };
  // --------------------------

  useEffect(() => {
    if (lojaAtiva) {
      const carregarProdutos = async () => {
        setLoadingProducts(true);
        const { data, error } = await supabase
          .from('produtos')
          .select('*')
          .eq('loja_id', lojaAtiva.id)
          .order('nome', { ascending: true });

        if (data) setProducts(data);
        setLoadingProducts(false);
      };
      carregarProdutos();
    }
  }, [lojaAtiva]);

  const handleAddProduto = async () => {
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

      const { data, error } = await supabase
        .from('produtos')
        .insert([{
          loja_id: lojaAtiva.id,
          nome: nome,
          sku_barcode: sku || null,
          preco_custo: custoNum,
          preco_venda: vendaNum,
          estoque_atual: atualNum,
          estoque_minimo: minNum
        }])
        .select()
        .single();

      if (error) throw error;

      addProduct(data);
      Alert.alert("Sucesso!", "Produto adicionado ao estoque.");
      setNome(''); setSku(''); setPrecoCusto(''); setPrecoVenda(''); setEstoqueAtual(''); setEstoqueMinimo('');
      
      fecharModal(); // Fecha com a animação suave

    } catch (error) {
      Alert.alert("Erro ao salvar", error.message);
    } finally {
      setLoading(false);
    }
  };

  if (isFetchingLojas) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (lojaAtiva) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
        <View style={{ flex: 1 }}>
          {loadingProducts ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          ) : products.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
              <Ionicons name="storefront-outline" size={64} color="#007AFF" />
              <Text style={{ marginTop: 20, fontSize: 18, color: '#333', textAlign: 'center', fontWeight: 'bold' }}>
                Seu estoque está pronto!
              </Text>
              <Text style={{ marginTop: 10, fontSize: 16, color: '#666', textAlign: 'center' }}>
                Adicione um produto para visualizá-los aqui.
              </Text>
            </View>
          ) : (
            <FlatList
              data={products}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 15 }}
              renderItem={({ item }) => (
                <View style={{ backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>{item.nome}</Text>
                    {item.sku_barcode ? <Text style={{ fontSize: 12, color: '#888' }}>SKU: {item.sku_barcode}</Text> : null}
                    <Text style={{ fontSize: 14, color: '#007AFF', marginTop: 5, fontWeight: '500' }}>
                      R$ {Number(item.preco_venda).toFixed(2).replace('.', ',')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
                    <Text style={{ fontSize: 12, color: '#666' }}>Estoque</Text>
                    <Text style={{ 
                      fontSize: 22, 
                      fontWeight: 'bold', 
                      color: item.estoque_atual <= item.estoque_minimo ? '#d9534f' : '#4CAF50' 
                    }}>
                      {item.estoque_atual}
                    </Text>
                  </View>
                </View>
              )}
            />
          )}
        </View>

        <View style={{ height: 70, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center', flexDirection: 'row' }}>
          <TouchableOpacity 
            style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginTop: -40, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 }}
            onPress={abrirModal} // <--- Chama a animação de abrir
          >
            <Ionicons name="add" size={32} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* MODAL DE CADASTRAR PRODUTO */}
        {/* Trocamos para "none" para assumirmos o controle total da animação */}
        <Modal visible={modalVisible} transparent={true} animationType="none">
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            
            {/* 1. CAMADA DO FUNDO ESCURO (Totalmente independente da caixa) */}
            <TouchableWithoutFeedback onPress={fecharModal}>
              <Animated.View style={{ 
                position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, 
                backgroundColor: '#000', 
                opacity: fadeAnim // <--- Animando de 0 a 0.5 junto com o slide
              }} />
            </TouchableWithoutFeedback>

            {/* 2. CAMADA DA CAIXA BRANCA */}
            <Animated.View style={{ 
              backgroundColor: '#fff', 
              padding: 20, 
              borderTopLeftRadius: 20, 
              borderTopRightRadius: 20, 
              maxHeight: '85%',
              transform: [{ translateY: slideAnim }] // <--- Deslizando
            }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 15, color: '#333' }}>Novo Produto</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                <TextInput placeholder="Nome do Produto *" value={nome} onChangeText={setNome} style={styles.input} />
                <TextInput placeholder="Código de Barras / SKU (Opcional)" value={sku} onChangeText={setSku} style={styles.input} keyboardType="numeric" />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <TextInput placeholder="Custo (R$) *" value={precoCusto} onChangeText={setPrecoCusto} style={[styles.input, { flex: 0.48 }]} keyboardType="numeric" />
                  <TextInput placeholder="Venda (R$) *" value={precoVenda} onChangeText={setPrecoVenda} style={[styles.input, { flex: 0.48 }]} keyboardType="numeric" />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <TextInput placeholder="Estoque Inicial *" value={estoqueAtual} onChangeText={setEstoqueAtual} style={[styles.input, { flex: 0.48 }]} keyboardType="numeric" />
                  <TextInput placeholder="Estoque Mín." value={estoqueMinimo} onChangeText={setEstoqueMinimo} style={[styles.input, { flex: 0.48 }]} keyboardType="numeric" />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, paddingBottom: 20 }}>
                  <TouchableOpacity onPress={fecharModal} style={{ padding: 12, marginRight: 15 }} disabled={loading}>
                    <Text style={{ color: '#666', fontWeight: 'bold' }}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleAddProduto} disabled={loading} style={{ backgroundColor: '#007AFF', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>{loading ? "Salvando..." : "Salvar Produto"}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </Animated.View>

          </View>
        </Modal>

      </View>
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f5f5f5' }}>
      <Ionicons name="folder-open-outline" size={64} color="#ccc" />
      <Text style={{ marginTop: 20, fontSize: 18, color: '#666', textAlign: 'center', fontWeight: 'bold' }}>
        Nenhum estoque selecionado.
      </Text>
      <Text style={{ marginTop: 10, fontSize: 14, color: '#999', textAlign: 'center' }}>
        Abra o menu lateral para criar um novo estoque ou acessar um existente.
      </Text>
    </View>
  );
};

// ----------------------
// NAVIGATION (MENU LATERAL)
// ----------------------

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

const CustomDrawerContent = (props) => {
  // Estados para controlar a janelinha (Modal)
  const [modalVisible, setModalVisible] = useState(false);
  const [nomeEstoque, setNomeEstoque] = useState('');
  const [loading, setLoading] = useState(false);

  // Estados Globais
  const lojas = useStore(state => state.lojas);
  const setLojas = useStore(state => state.setLojas);
  const lojaAtiva = useStore(state => state.lojaAtiva);
  const setLojaAtiva = useStore(state => state.setLojaAtiva);

  const handleLogout = async () => {
    // 1. Encerra a sessão no Supabase
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      Alert.alert("Erro ao sair", error.message);
    } else {
      // 2. A "Vassourada": Força a limpeza da memória do Zustand!
      useStore.setState({ 
        lojas: [], 
        lojaAtiva: null, 
        products: [] ,
        isFetchingLojas: true
      });
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

      const { data, error } = await supabase
        .from('lojas')
        .insert([{ nome: nomeEstoque, dono_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      const novasLojas = [...lojas, data];
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

  return (
    <View style={{ flex: 1 }}>
      
      {/* Modal de Criar Estoque */}
      <Modal visible={modalVisible} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', padding: 20, borderRadius: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#333' }}>Novo Estoque</Text>
            
            <TextInput 
              placeholder="Ex: Loja Centro, Depósito principal..."
              value={nomeEstoque}
              onChangeText={setNomeEstoque}
              style={styles.input}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
              <TouchableOpacity 
                onPress={() => setModalVisible(false)} 
                style={{ padding: 12, marginRight: 15 }}
                disabled={loading}
              >
                <Text style={{ color: '#666', fontWeight: 'bold' }}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={handleCriarEstoque} 
                disabled={loading}
                style={{ backgroundColor: '#007AFF', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                  {loading ? "Salvando..." : "Criar"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <DrawerContentScrollView {...props}>
        
        {/* TOPO DO MENU: Criar estoque */}
        <TouchableOpacity 
          style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 10 }} 
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add-circle" size={26} color="#007AFF" style={{ marginRight: 15 }} />
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#007AFF' }}>Criar estoque</Text>
        </TouchableOpacity>

        <View style={{ height: 1, backgroundColor: '#eee', marginHorizontal: 20, marginBottom: 10 }} />

        {/* --- LISTA DINÂMICA DE ESTOQUES --- */}
        <View style={{ paddingHorizontal: 10 }}>
          {lojas.length === 0 ? (
            <Text style={{ textAlign: 'center', color: '#999', marginTop: 10, fontSize: 14 }}>
              Você ainda não possui estoques.
            </Text>
          ) : (
            lojas.map((loja) => {
              // Verifica se este estoque da lista é o mesmo que o usuário está visualizando agora
              const isActive = lojaAtiva && lojaAtiva.id === loja.id;
              
              return (
                <TouchableOpacity 
                  key={loja.id}
                  style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    paddingVertical: 12,
                    paddingHorizontal: 10,
                    borderRadius: 8,
                    // Se for o ativo, ganha um fundo azul clarinho
                    backgroundColor: isActive ? '#e6f2ff' : 'transparent',
                    marginBottom: 5
                  }} 
                  onPress={() => {
                    setLojaAtiva(loja); // Define este estoque como o principal
                    props.navigation.closeDrawer(); // Fecha o menu na hora
                  }}
                >
                  <Ionicons 
                    name={isActive ? "storefront" : "storefront-outline"} 
                    size={22} 
                    color={isActive ? "#007AFF" : "#555"} 
                    style={{ marginRight: 15 }} 
                  />
                  <Text style={{ 
                    fontSize: 15, 
                    fontWeight: isActive ? 'bold' : '500', 
                    color: isActive ? '#007AFF' : '#555' 
                  }}>
                    {loja.nome}
                  </Text>
                </TouchableOpacity>
              )
            })
          )}
        </View>

        {/* Removemos o <DrawerItemList {...props} /> daqui pois agora o menu é 100% customizado por nós! */}

      </DrawerContentScrollView>
      
      {/* RODAPÉ DO MENU */}
      <View style={{ paddingBottom: 20 }}>
        <View style={{ height: 1, backgroundColor: '#eee', marginHorizontal: 20, marginBottom: 10 }} />
        
        <TouchableOpacity 
          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 }} 
          onPress={() => Alert.alert("Configurações", "Em breve!")}
        >
          <Ionicons name="settings-outline" size={22} color="#555" style={{ marginRight: 15 }} />
          <Text style={{ fontSize: 14, fontWeight: '500', color: '#555' }}>Configurações</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 }} 
          onPress={handleLogout}
        >
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
        const { data, error } = await supabase.from('lojas').select('*').eq('dono_id', user.id);
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
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 15, marginBottom: 15, backgroundColor: '#fafafa' },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, marginBottom: 15, backgroundColor: '#fafafa' },
  passwordInput: { flex: 1, padding: 15 },
  eyeIcon: { padding: 15 },
  button: { backgroundColor: '#ddd', padding: 15, marginTop: 10, alignItems: 'center', borderRadius: 8 },
  buttonText: { fontWeight: 'bold' },
  topNotification: { position: 'absolute', top: 40, left: 20, right: 20, backgroundColor: '#4CAF50', padding: 15, borderRadius: 8, alignItems: 'center', zIndex: 100, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  topNotificationText: {color: '#fff', fontWeight: 'bold', fontSize: 16,}
});