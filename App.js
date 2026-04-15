// Adicione esta linha no TOPO ABSOLUTO do arquivo
import 'react-native-gesture-handler'; 

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet } from 'react-native';

// CORREÇÃO: Importação nomeada usando chaves { }
import { create } from 'zustand'; 

// ----------------------
// STATE (Zustand)
// ----------------------
const useStore = create((set) => ({
  // --- NOVOS ESTADOS DE AUTENTICAÇÃO ---
  isLoggedIn: false,
  login: () => set({ isLoggedIn: true }),
  logout: () => set({ isLoggedIn: false }),

  // --- ESTADOS DE ESTOQUE (MANTIDOS) ---
  products: [],
  addProduct: (product) => set((state) => ({ products: [...state.products, product] })),
  updateStock: (id, qty) => set((state) => ({
    products: state.products.map(p => p.id === id ? { ...p, estoque: p.estoque + qty } : p)
  }))
}));

// ... restante do seu código (Screens, Navigation, Styles) continua igual!
// ----------------------
// SCREENS
// ----------------------

// --- TELA DE LOGIN ---
const LoginScreen = ({ navigation }) => { 
  const login = useStore(state => state.login);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  return (
    <View style={styles.loginContainer}>
      <Text style={styles.logoText}>STOCKLY</Text>

      <TextInput 
        placeholder="E-mail" 
        style={styles.input} 
        onChangeText={setEmail} 
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput 
        placeholder="Senha" 
        style={styles.input} 
        onChangeText={setPassword} 
        secureTextEntry 
      />

      <TouchableOpacity style={styles.primaryButton} onPress={login}>
        <Text style={styles.primaryButtonText}>Login</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('SignUp')}>
        <Text style={styles.secondaryButtonText}>Cadastrar-se</Text>
      </TouchableOpacity>
    </View>
  );
};

// --- TELA DE CADASTRO ATUALIZADA ---
const SignUpScreen = ({ navigation }) => {
  const [nome, setNome] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [senha, setSenha] = React.useState('');
  const [confirmaSenha, setConfirmaSenha] = React.useState('');

  const handleCadastro = () => {
    if (senha !== confirmaSenha) {
      alert("As senhas não coincidem!");
      return;
    }
    alert("Conta criada com sucesso!");
    navigation.navigate('Login');
  };

  return (
    <View style={styles.loginContainer}>
      {/* --- NOVA SETA DE VOLTAR --- */}
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={28} color="#333" />
      </TouchableOpacity>

      <Text style={styles.logoText}>CRIAR CONTA</Text>

      <TextInput placeholder="Nome" style={styles.input} onChangeText={setNome} />
      <TextInput placeholder="E-mail" style={styles.input} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextInput placeholder="Senha" style={styles.input} onChangeText={setSenha} secureTextEntry />
      <TextInput placeholder="Confirmar Senha" style={styles.input} onChangeText={setConfirmaSenha} secureTextEntry />

      <TouchableOpacity style={styles.primaryButton} onPress={handleCadastro}>
        <Text style={styles.primaryButtonText}>Cadastrar</Text>
      </TouchableOpacity>
      
      {/* O botão "Voltar para o Login" foi removido daqui */}
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
      {lowStock.length === 0 ? (
        <Text>Nenhum produto em falta</Text>
      ) : (
        lowStock.map(p => (
          <Text key={p.id}>⚠️ {p.nome} baixo ({p.estoque})</Text>
        ))
      )}
    </View>
  );
};

const ProductList = ({ navigation }) => {
  const products = useStore(state => state.products);

  return (
    <View style={styles.container}>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('Movimentar', { id: item.id })}>
            <Text style={styles.item}>{item.nome} - {item.estoque}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const AddProduct = () => {
  const addProduct = useStore(state => state.addProduct);

  const [nome, setNome] = React.useState('');
  const [estoque, setEstoque] = React.useState('');
  const [min, setMin] = React.useState('');
  const [custo, setCusto] = React.useState('');

  return (
    <View style={styles.container}>
      <TextInput placeholder="Nome" onChangeText={setNome} style={styles.input} />
      <TextInput placeholder="Estoque" onChangeText={setEstoque} style={styles.input} keyboardType="numeric" />
      <TextInput placeholder="Estoque mínimo" onChangeText={setMin} style={styles.input} keyboardType="numeric" />
      <TextInput placeholder="Preço de custo" onChangeText={setCusto} style={styles.input} keyboardType="numeric" />

      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          addProduct({
            id: Date.now().toString(),
            nome,
            estoque: Number(estoque),
            min: Number(min),
            custo: Number(custo)
          });
        }}
      >
        <Text style={styles.buttonText}>Cadastrar</Text>
      </TouchableOpacity>
    </View>
  );
};

const Movimentar = ({ route }) => {
  const { id } = route.params;
  const updateStock = useStore(state => state.updateStock);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Movimentar</Text>

      <TouchableOpacity style={styles.button} onPress={() => updateStock(id, 1)}>
        <Text>+ Entrada</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={() => updateStock(id, -1)}>
        <Text>- Saída</Text>
      </TouchableOpacity>
    </View>
  );
};

// ----------------------
// NAVIGATION
// ----------------------

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const AuthNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="SignUp" component={SignUpScreen} />
  </Stack.Navigator>
);

const ProductStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="Lista" component={ProductList} />
    <Stack.Screen name="Movimentar" component={Movimentar} />
  </Stack.Navigator>
);

// Agrupamos o seu app antigo neste componente
const MainAppTabs = () => (
  <Tab.Navigator>
    <Tab.Screen name="Dashboard" component={Dashboard} />
    <Tab.Screen name="Produtos" component={ProductStack} />
    <Tab.Screen name="Adicionar" component={AddProduct} />
  </Tab.Navigator>
);


export default function App() {
  const isLoggedIn = useStore(state => state.isLoggedIn);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isLoggedIn ? (
          // Substituímos a tela de Login isolada pelo AuthNavigator
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : (
          <Stack.Screen name="MainApp" component={MainAppTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ----------------------
// STYLES
// ----------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20
    
  },
  // --- NOVOS ESTILOS DO LOGIN ---
  loginContainer: {
    flex: 1,
    justifyContent: 'center', 
    padding: 30,
    backgroundColor: '#fff'
  },
  logoText: {
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
    letterSpacing: 2,
    color: '#333'
  },
  primaryButton: {
    backgroundColor: '#007AFF', // Azul estilo iOS
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  },
  secondaryButton: {
    padding: 15,
    alignItems: 'center',
    marginTop: 10
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontWeight: '600'
  },
  backButton: {
    position: 'absolute', // Permite posicionar em relação à tela
    top: 50,              // Distância do topo (ajuste conforme necessário)
    left: 20,             // Distância da esquerda
    padding: 10,          // Aumenta a área de toque
    zIndex: 10            // Garante que a seta fique por cima de tudo
  },
  // --- ESTILOS ANTIGOS (MANTIDOS) ---
  title: {
    fontSize: 24,
    fontWeight: 'bold'
  },
  subtitle: {
    marginTop: 20,
    fontWeight: 'bold'
  },
  item: {
    padding: 15,
    borderBottomWidth: 1,
    borderColor: '#eee'
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    backgroundColor: '#fafafa'
  },
  button: {
    backgroundColor: '#ddd',
    padding: 15,
    marginTop: 10,
    alignItems: 'center',
    borderRadius: 8
  },
  buttonText: {
    fontWeight: 'bold'
  }
});