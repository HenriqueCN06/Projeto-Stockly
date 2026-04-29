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
  // NOVO: Estado para controlar a visibilidade da senha
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Atenção", "Preencha e-mail e senha.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });
    if (error) Alert.alert("Erro ao entrar", error.message);
    setLoading(false);
  };

  return (
    <View style={styles.loginContainer}>
      <Text style={styles.logoText}>STOCKLY</Text>

      <TextInput 
        placeholder="E-mail" 
        style={styles.input} 
        onChangeText={setEmail} 
        value={email}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      
      {/* NOVO: Container da Senha com o Ícone */}
      <View style={styles.passwordContainer}>
        <TextInput 
          placeholder="Senha" 
          style={styles.passwordInput} 
          onChangeText={setPassword} 
          value={password}
          secureTextEntry={!showPassword} // Inverte o estado
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
  
  // NOVOS: Estados para os dois campos de senha
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmaSenha, setShowConfirmaSenha] = useState(false);

  const handleCadastro = async () => {
    if (!nome || !email || !senha) {
      Alert.alert("Atenção", "Preencha todos os campos!");
      return;
    }
    if (senha !== confirmaSenha) {
      Alert.alert("Atenção", "As senhas não coincidem!");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: senha,
    });
    if (error) {
      Alert.alert("Erro no cadastro", error.message);
      setLoading(false);
      return;
    }
    if (data.user) {
      const { error: profileError } = await supabase
        .from('perfis')
        .insert([{ id: data.user.id, nome: nome }]);
      if (profileError) console.log("Erro ao salvar perfil:", profileError);
    }
    Alert.alert("Sucesso!", "Conta criada com sucesso!");
    setLoading(false);
  };

  return (
    <View style={styles.loginContainer}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={28} color="#333" />
      </TouchableOpacity>

      <Text style={styles.logoText}>CRIAR CONTA</Text>

      <TextInput placeholder="Nome" style={styles.input} onChangeText={setNome} value={nome} />
      <TextInput placeholder="E-mail" style={styles.input} onChangeText={setEmail} value={email} keyboardType="email-address" autoCapitalize="none" />
      
      {/* NOVO: Campo de Senha com Ícone */}
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

      {/* NOVO: Campo de Confirmar Senha com Ícone */}
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
  buttonText: { fontWeight: 'bold' }
});