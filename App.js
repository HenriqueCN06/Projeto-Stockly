// Adicione esta linha no TOPO ABSOLUTO do arquivo
import 'react-native-gesture-handler'; 

import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, Alert, Platform } from 'react-native';
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

  products: [],
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

const Dashboard = () => {
  const products = useStore(state => state.products);
  const lowStock = products.filter(p => p.estoque <= p.min);
  const totalValue = products.reduce((acc, p) => acc + (p.estoque * p.custo), 0);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📦 Stockly</Text>
      <Text>Total em estoque: R$ {totalValue.toFixed(2)}</Text>
      <Text style={styles.subtitle}>⚠️ Alertas</Text>
      {lowStock.length === 0 ? <Text>Nenhum produto em falta</Text> : lowStock.map(p => <Text key={p.id}>⚠️ {p.nome} baixo ({p.estoque})</Text>)}
    </View>
  );
};

const ProductList = ({ navigation }) => { 
  const products = useStore(state => state.products);
  return (
    <View style={styles.container}>
      <FlatList data={products} keyExtractor={(item) => item.id} renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('Movimentar', { id: item.id })}>
            <Text style={styles.item}>{item.nome} - {item.estoque}</Text>
          </TouchableOpacity>
        )} />
    </View>
  );
};

const AddProduct = () => { 
  return (
    <View style={styles.container}>
      <Text>Adicionar Produto... (Em construção)</Text>
    </View>
  );
};

const Movimentar = ({ route }) => { 
  return (
    <View style={styles.container}>
      <Text>Movimentar... (Em construção)</Text>
    </View>
  );
};

// ----------------------
// NAVIGATION (MENU LATERAL)
// ----------------------

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

const CustomDrawerContent = (props) => {
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert("Erro ao sair", error.message);
  };

  return (
    <View style={{ flex: 1 }}>
      <DrawerContentScrollView {...props}>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>
      
      <View style={{ padding: 20, borderTopWidth: 1, borderTopColor: '#eee' }}>
        
        {/* --- Botão de Configurações --- */}
        <TouchableOpacity 
          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }} 
          onPress={() => Alert.alert("Configurações", "Em breve!")}
        >
          {/* Ícone de engrenagem no mesmo estilo do olho */}
          <Ionicons name="settings-outline" size={22} color="#555" style={{ marginRight: 15 }} />
          <Text style={{ fontSize: 14, fontWeight: '500', color: '#555' }}>Configurações</Text>
        </TouchableOpacity>
        
        {/* --- Botão de Desconectar --- */}
        <TouchableOpacity 
          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }} 
          onPress={handleLogout}
        >
          {/* Ícone de porta/sair vermelho */}
          <Ionicons name="log-out-outline" size={22} color="#d9534f" style={{ marginRight: 15 }} />
          <Text style={{ fontSize: 14, fontWeight: '500', color: '#d9534f' }}>Desconectar</Text>
        </TouchableOpacity>
        
      </View>
    </View>
  );
};

const AuthNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="SignUp" component={SignUpScreen} />
  </Stack.Navigator>
);

const ProductStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Lista" component={ProductList} />
    <Stack.Screen name="Movimentar" component={Movimentar} />
  </Stack.Navigator>
);

const MainAppDrawer = () => (
  <Drawer.Navigator 
    drawerContent={(props) => <CustomDrawerContent {...props} />}
    screenOptions={{
      headerTintColor: '#333',
      drawerActiveTintColor: '#007AFF',
      drawerItemStyle: {
        borderRadius: 8,
      }
    }}
  >
    <Drawer.Screen name="Dashboard" component={Dashboard} />
    <Drawer.Screen name="Produtos" component={ProductStack} />
    <Drawer.Screen name="Adicionar" component={AddProduct} />
  </Drawer.Navigator>
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
  logoText: { fontSize: 36, fontWeight: 'bold', textAlign: 'center', marginBottom: 40, letterSpacing: 2, color: '#333' },
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