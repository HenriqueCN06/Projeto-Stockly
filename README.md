Aqui está a arquitetura ideal para esse projeto:

1. Estrutura do Banco de Dados (As Tabelas)
  Para que o aplicativo seja considerado um sistema de gestão real (e não apenas uma lista de anotações), vocês precisarão de pelo menos duas tabelas (ou coleções) que se relacionam:

Tabela A: Produtos
  Esta tabela guarda o catálogo da loja. O estoque atual não é editado manualmente aqui, ele é calculado com base nas movimentações.

    - id (Texto/Inteiro) - Identificador único.

    - nome (Texto) - Ex: "Camiseta Preta M".

    - codigo_barras (Texto) - O número do código de barras para usar com a câmera.

    - preco_custo (Número) - Quanto a loja pagou.

    - preco_venda (Número) - Por quanto a loja vende.

    - estoque_minimo (Inteiro) - O valor que dispara o alerta vermelho (Ex: avisar quando chegar a 5 unidades).

Tabela B: Movimentacoes (O Diferencial do Projeto)
  É aqui que o CRUD brilha. Toda vez que um produto entra ou sai da loja, um registro é criado aqui.

    - id (Texto/Inteiro) - Identificador único da transação.

    - produto_id (Texto/Inteiro) - Liga essa movimentação ao produto da Tabela A.

    - tipo (Texto) - Pode ser "ENTRADA" (compra de fornecedor) ou "SAÍDA" (venda ou perda).

    - quantidade (Inteiro) - Quantas unidades entraram ou saíram.

    - data (Data/Texto) - O dia e hora exatos da transação.

2. O Mapa de Telas (React Navigation)
  Com o banco de dados desenhado, seu grupo precisará programar 4 telas principais. Como vocês vão usar o template blank, terão que criar essas rotas do zero:

    - Dashboard (Tela Inicial): O painel de controle. Deve mostrar um resumo rápido, como "Total de Itens Cadastrados" e, principalmente, uma lista de alertas com os produtos que estão com o estoque abaixo do estoque_minimo.

    - Lista de Produtos: Uma tela com todos os produtos (uma FlatList no React Native). Ao clicar em um produto, abre-se os detalhes dele e o histórico de entradas e saídas.

    - Cadastro de Produto (O "C" do CRUD): O formulário clássico para adicionar um novo item ao catálogo.

    - Registrar Movimentação (Onde a mágica acontece): Uma tela rápida com dois botões grandes ("Entrada" e "Saída"). O lojista seleciona o produto (ou lê o código de barras com a câmera), digita a quantidade e confirma.
