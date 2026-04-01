# 📦 Stockly

> **Gestão de Inventário Mobile para Pequenos Empreendedores**

## 💡 O Conceito
Um aplicativo voltado para pequenos lojistas (como donos de mercadinhos, lojas de roupas ou quiosques) que precisam saber exatamente o que têm no estoque, o que está acabando e o histórico de entradas e saídas de mercadorias, tudo na palma da mão, pelo celular.

---

## 🚀 Principais Funcionalidades (O CRUD aplicado)

* **📝 Cadastro de Produtos:** O usuário cadastra o item com Foto, Nome, Código de Barras (SKU), Preço de Custo, Preço de Venda e, o mais importante, o **Estoque Mínimo** (a quantidade de alerta para refazer o pedido).
* **🔄 Movimentação de Estoque (Entradas e Saídas):** Em vez de apenas editar o número total de itens, o sistema registra transações reais. 
  * *Exemplo:* "Entrada de 50 unidades (Compra)" ou "Saída de 2 unidades (Venda/Avaria)". Isso gera um histórico valioso para a gestão do negócio.
* **⚠️ Dashboard de Alertas:** A tela inicial do app não é apenas uma lista estática, mas um painel de avisos dinâmico mostrando imediatamente quais produtos estão com o estoque abaixo do mínimo configurado.

---

## 📱 Por que este projeto é ideal para a matéria de Mobile?

* **📷 Leitor de Código de Barras:** Começando com o template *blank*, é possível integrar a biblioteca `expo-camera` e criar uma funcionalidade onde o lojista aponta a câmera do celular para o código de barras do produto, e o app abre automaticamente a tela de "Dar entrada/saída" daquele item específico.
* **🔗 Lógica de Relacionamentos:** O banco de dados deixa de ser uma tabela simples e passa a ter relações mais complexas (a tabela de "Produtos" se relaciona com a tabela de "Histórico de Movimentações").
* **🧮 Cálculos em Tempo Real:** O app calcula automaticamente o **Valor Total em Estoque** (quantidade x preço de custo) e o exibe diretamente na tela inicial.

---

## 🗄️ Estratégia para o Banco de Dados

O projeto foi pensado para ser flexível e se adaptar às exigências da disciplina:

* **Se o requisito for Local (SQLite):** Funciona como um cenário de "coletor de dados offline". O funcionário pode ir para o fundo do galpão (onde o sinal de internet é fraco ou inexistente), ler os códigos de barras, atualizar o estoque no banco local do aparelho e, posteriormente, sincronizar ou exibir os dados para o dono.
* **Se o requisito permitir Nuvem (Firebase / Supabase):** Permite um cenário multiusuário em tempo real. O dono da loja pode ter o app no seu celular acompanhando as vendas de onde estiver, enquanto os funcionários usam o app em seus próprios aparelhos para dar baixa no estoque simultaneamente.

---

# Estrutura do Projeto

## ✨ Funcionalidades Principais

* **Dashboard de Alertas:** Painel inicial com métricas cruciais (como Valor Total em Estoque) e avisos automáticos destacando produtos que atingiram ou caíram abaixo do estoque mínimo configurado.
* **Leitor de Código de Barras (Scanner):** Integração nativa com a câmera do dispositivo para escanear o SKU (código de barras) do produto, agilizando a localização do item para transações.
* **Gestão de Produtos (CRUD):** Cadastro completo de mercadorias incluindo Foto, Nome, SKU, Preço de Custo, Preço de Venda e Estoque Mínimo.
* **Histórico de Movimentações:** Sistema de registro transacional. Em vez de simplesmente editar o valor total do estoque, o app registra "Entradas" (compras de fornecedores) e "Saídas" (vendas ou avarias), gerando um histórico confiável e auditável.

---

## 🛠️ Tecnologias e Bibliotecas

* **Frontend:** React Native (Expo - Template Blank)
* **Navegação:** React Navigation (Stack e Tabs)
* **Hardware:** `expo-camera` (Leitura de códigos de barra)
* **Gerenciamento de Estado Global:** Zustand
* **Formulários e Validação:** React Hook Form + Zod
* **Banco de Dados / Backend:**
  * *Para cenários em nuvem (Sincronização multi-usuário):* Supabase (PostgreSQL)
  * *Para cenários offline-first (SQLite):* WatermelonDB

---

## 📂 Arquitetura e Estrutura de Pastas

O projeto segue uma arquitetura modular para separar a interface das regras de negócio e da comunicação externa, facilitando a manutenção e a escalabilidade.

```text
Stockly/
├── App.js                 # Ponto de entrada (carrega rotas e provedores de estado/banco)
├── app.json               # Configurações nativas do Expo
└── src/
    ├── assets/            # Imagens, ícones locais e fontes personalizadas
    ├── components/        # Componentes de UI reutilizáveis (CardProduto, BotaoPrimario, AlertaEstoque)
    ├── screens/           # Telas completas da aplicação
    │   ├── Dashboard/     # Tela inicial com visão geral e alertas
    │   ├── Scanner/       # Tela com a câmera embutida para leitura de SKU
    │   ├── ProdutoForm/   # Tela para criação e edição de produtos
    │   └── Movimentacao/  # Tela para registrar transações (Entrada/Saída) de um item
    ├── navigation/        # Configuração de rotas
    ├── services/          # Integrações externas e configuração do Banco de Dados
    ├── store/             # Lógica de estado global (ex: carrinho temporário de leitura)
    └── utils/             # Funções utilitárias (formatadores de moeda, cálculos matemáticos)
    - Registrar Movimentação (Onde a mágica acontece): Uma tela rápida com dois botões grandes ("Entrada" e "Saída"). O lojista seleciona o produto (ou lê o código de barras com a câmera), digita a quantidade e confirma.
