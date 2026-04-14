// Stockly - Frontend (React Native + Expo)
// Estrutura simplificada, pronta para expandir

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import create from 'zustand';

// ----------------------
// STATE (Zustand)
// ----------------------
const useStore = create((set) => ({
  products: [],
  addProduct: (product) => set((state) => ({ products: [...state.products, product] })),
  updateStock: (id, qty) => set((state) => ({
    products: state.products.map(p => p.id === id ? { ...p, estoque: p.estoque + qty } : p)
  }))
}));

// ----------------------
// SCREENS
// ----------------------

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

const ProductStack = () => (
  <Stack.Navigator>
    <Stack.Screen name="Lista" component={ProductList} />
    <Stack.Screen name="Movimentar" component={Movimentar} />
  </Stack.Navigator>
);

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name="Dashboard" component={Dashboard} />
        <Tab.Screen name="Produtos" component={ProductStack} />
        <Tab.Screen name="Adicionar" component={AddProduct} />
      </Tab.Navigator>
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
    borderBottomWidth: 1
  },
  input: {
    borderWidth: 1,
    padding: 10,
    marginBottom: 10
  },
  button: {
    backgroundColor: '#ddd',
    padding: 15,
    marginTop: 10,
    alignItems: 'center'
  },
  buttonText: {
    fontWeight: 'bold'
  }
});