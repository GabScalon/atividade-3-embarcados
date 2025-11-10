# Atividade 3 - Simulação de Parque de Diversões com Micro-serviços

Este repositório simula um sistema de gerenciamento de um parque de diversões utilizando uma arquitetura de micro-serviços em Node.js.

O sistema é composto por seis serviços independentes que se comunicam através de um API Gateway central, utilizando chamadas HTTP (com `axios`). Cada serviço possui seu próprio servidor Express e, quando necessário, seu próprio banco de dados SQLite.

## 🏛️ Arquitetura e Serviços

O sistema é dividido nos seguintes serviços, cada um executando em uma porta diferente, conforme definido no `api-gateway.js`:

### 1. API Gateway (`/api-gateway/api-gateway.js`)
* **Porta:** `8000`
* **Tecnologia:** `express-http-proxy`
* **Responsabilidade:** É o ponto de entrada único para todas as requisições externas. Ele atua como um proxy reverso, roteando o tráfego para o micro-serviço correto com base no prefixo da URL (ex: `/Ingressos`, `/Atracoes`, `/Cadastro`, etc.).

### 2. Serviço de Cadastro (`/cadastro-service.js`)
* **Porta:** `8080`
* **Banco de Dados:** `dados.db` (Inferido do `package.json` e dos arquivos `.db`)
* **Responsabilidade:** Gerencia o cadastro e a consulta de usuários (visitantes) do parque. É consultado por outros serviços para validar a existência de um CPF.

### 3. Controle de Ingressos (`/ingresso-control/ingresso-control.js`)
* **Porta:** `8081`
* **Banco de Dados:** `Ingressos.db`
* **Responsabilidade:**
    * **Venda (`POST /Ingressos`):** Cria novos ingressos (diário, anual, limitado). Antes de criar, consulta o **Serviço de Cadastro** (via Gateway) para validar se o CPF do usuário existe.
    * **Validação (`POST /Validar/:id`):** Simula a catraca. Verifica a validade de um ingresso. Se for válido e um `atracao_id` for fornecido, este serviço chama o **Controle de Filas** (via Gateway) para adicionar o usuário à fila da atração.

### 4. Cadastro de Atrações (`/cadastro-atracoes/cadastro-atracoes.js`)
* **Porta:** `8082`
* **Banco de Dados:** `Atracoes.db`
* **Responsabilidade:** Fornece um CRUD completo (`GET`, `POST`, `PATCH`, `DELETE`) para gerenciar as atrações do parque (nome, capacidade, tempo médio, status de funcionamento).

### 5. Controle de Filas (`/controle-filas/controle-filas.js`)
* **Porta:** `8083`
* **Banco de Dados:** `Filas.db`
* **Responsabilidade:**
    * **Entrada (`POST /Filas/entrar`):** Adiciona um usuário a uma fila. Antes de adicionar, faz duas validações via Gateway:
        1.  Consulta o **Serviço de Cadastro** para validar o usuário.
        2.  Consulta o **Cadastro de Atrações** para garantir que a atração existe e seu status é "Em funcionamento".
    * **Saída (`POST /Filas/sair`):** Remove um usuário da fila.
    * **Consulta (`GET /Filas/atracao/:id`):** Retorna todas as pessoas na fila de uma atração.

### 6. Tempo de Espera (`/tempo-espera/tempo-espera.js`)
* **Porta:** `8084`
* **Banco de Dados:** Nenhum.
* **Responsabilidade:** Calcula o tempo de espera estimado para uma atração.
* **Lógica (`GET /Estimativa/atracao/:id`):**
    1.  Chama o **Cadastro de Atrações** (via Gateway) para obter a `capacidade` e o `tempo_medio` da atração.
    2.  Chama o **Controle de Filas** (via Gateway) para obter o número de `pessoas_na_fila`.
    3.  Retorna o cálculo: `Math.ceil((pessoas_na_fila + 1) / capacidade) * tempo_medio`.

---

## 🛠️ Tecnologias Utilizadas

* **Servidores:** Node.js, Express.js
* **Banco de Dados:** SQLite3 (cada serviço gerencia seu próprio arquivo `.db`)
* **Comunicação:** HTTP/REST (com `axios` para comunicação serviço-a-serviço)
* **API Gateway:** `express-http-proxy`
* **Execução:** `concurrently` (para iniciar todos os serviços simultaneamente)

---

## 🏁 Como Executar o Projeto

### Pré-requisitos
* Node.js (v18 ou superior)
* NPM

### Passos

1.  **Clone o repositório:**
    ```bash
    git clone [https://github.com/GabScalon/atividade-3-embarcados.git](https://github.com/GabScalon/atividade-3-embarcados.git)
    cd atividade-3-embarcados
    ```

2.  **Instale as dependências:**
    O `package.json` na raiz do projeto já inclui todas as dependências necessárias para todos os serviços.
    ```bash
    npm install
    ```

3.  **Inicie todos os serviços:**
    O script `start-all` no `package.json` da raiz usa `concurrently` para iniciar todos os seis micro-serviços de uma só vez.
    ```bash
    npm run start-all
    ```
    
    Este comando executará os seguintes scripts:
    * `npm:start-cadastro` (porta 8080)
    * `npm:start-ingressos` (porta 8081)
    * `npm:start-atracoes` (porta 8082)
    * `npm:start-filas` (porta 8083)
    * `npm:start-gateway` (porta 8000)
    * `npm:start-estimativas` (porta 8084)

    O sistema estará pronto quando todos os serviços reportarem "Conectado ao banco de dados" e o Gateway reportar "API Gateway em execução na porta: 8000".
        2.  `GET http://localhost:8000/Cadastro/999888777` (para checar se o usuário existe).
    * Se ambas as validações passarem, o **Controle de Filas** insere o usuário no `Filas.db` e retorna `201 Created`.
    * A resposta `201` volta para o **Controle de Ingressos**, que por sua vez retorna a resposta final `200 OK` para o usuário.
