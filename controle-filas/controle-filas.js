// Inicia o Express.js
const express = require("express");
const app = express();
const cors = require("cors"); // Necessário somente para o frontend

// Body Parser - usado para processar dados da requisição HTTP
const bodyParser = require("body-parser");
app.use(cors()); // Permite acesso do frontend
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Importa o package do SQLite
const sqlite3 = require("sqlite3");

const axios = require("axios");

// URL do Gateway
const API_GATEWAY_URL = "http://localhost:8000";

// Acessa o arquivo com o banco de dados
var db = new sqlite3.Database("./Filas.db", (err) => {
    if (err) {
        console.log("ERRO: não foi possível conectar ao SQLite 'Filas.db'.");
        throw err;
    }
    console.log("Conectado ao SQLite 'Filas.db'!");
});

// Cria a tabela 'Filas', caso ela não exista
db.run(
    `CREATE TABLE IF NOT EXISTS Filas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        atracao_id INTEGER NOT NULL,
        cpf_usuario INTEGER NOT NULL,
        entrou_em TEXT NOT NULL,
        UNIQUE(atracao_id, cpf_usuario)
    );`,
    [],
    (err) => {
        if (err) {
            console.log("ERRO: não foi possível criar tabela 'Filas'.");
            throw err;
        }
    }
);

// Método HTTP POST /Filas/entrar - coloca uma pessoa na fila de uma atração
app.post("/Filas/entrar", (req, res, next) => {
    const atracao_id = parseInt(req.body.atracao_id, 10);
    const cpf_usuario = parseInt(req.body.cpf_usuario, 10);

    if (
        !atracao_id ||
        !cpf_usuario ||
        isNaN(atracao_id) ||
        isNaN(cpf_usuario)
    ) {
        return res
            .status(400)
            .send("CPF e atracao_id são obrigatórios e devem ser números.");
    }

    // Verifica se o usuário existe
    axios
        .get(`${API_GATEWAY_URL}/Cadastro/${cpf_usuario}`)
        .then((userResponse) => {
            console.log(
                `Usuário ${cpf_usuario} verificado. Verificando atração...`
            );
            // Retorna a próxima chamada (verificar atração)
            return axios.get(`${API_GATEWAY_URL}/Atracoes/${atracao_id}`);
        })
        .then((atracaoResponse) => {
            const atracao = atracaoResponse.data;
            if (atracao.status !== "Em funcionamento") {
                // Se a atração não estiver funcionando, rejeita a entrada na fila.
                return res
                    .status(403)
                    .send(
                        `A atração ${atracao.nome} não está em funcionamento. Status: ${atracao.status}`
                    );
            }

            console.log(
                `Atração ${atracao_id} (${atracao.nome}) está em funcionamento. Colocando na fila...`
            );

            const agora = new Date();
            const entrouEm = agora.toISOString();

            const params = [atracao_id, cpf_usuario, entrouEm];

            db.run(
                `INSERT INTO Filas (atracao_id, cpf_usuario, entrou_em)
                VALUES (?, ?, ?)`,
                params,
                function (err) {
                    if (err) {
                        if (err.message.includes("UNIQUE constraint failed")) {
                            return res
                                .status(409)
                                .send("Erro: Usuário já está nesta fila.");
                        }
                        console.log("Erro ao entrar na fila: " + err);
                        return res.status(500).send("Erro ao entrar na fila.");
                    }

                    const novoId = this.lastID;

                    db.get(
                        `SELECT * FROM Filas
                        WHERE id = ?`,
                        [novoId],
                        (err, row) => {
                            if (err) {
                                return res
                                    .status(500)
                                    .send(
                                        "Entrada na fila criada, mas falha ao buscá-la."
                                    );
                            }
                            res.status(201).json(row);
                        }
                    );
                }
            );
        })
        .catch((error) => {
            if (error.response && error.response.status === 404) {
                if (error.config.url.includes("/Cadastro")) {
                    return res
                        .status(404)
                        .send("Usuário (CPF) não encontrado via Gateway.");
                } else if (error.config.url.includes("/Atracoes")) {
                    return res
                        .status(404)
                        .send("Atração (ID) não encontrada via Gateway.");
                } else {
                    return res
                        .status(404)
                        .send("Recurso não encontrado via Gateway.");
                }
            } else {
                console.log("Erro ao contatar Gateway:", error.message);
                return res
                    .status(500)
                    .send("Erro ao verificar dados via API Gateway.");
            }
        });
});

// Método HTTP GET /Filas - retorna todas as filas (para admin)
app.get("/Filas", (req, res, next) => {
    db.all(
        `SELECT *
        FROM Filas`,
        [],
        (err, result) => {
            if (err) {
                res.status(500).send("Erro ao obter dados.");
            } else {
                res.status(200).json(result);
            }
        }
    );
});

// Método HTTP GET /Filas/usuario/:cpf_usuario - retorna todas as entradas em fila de um usuário
app.get("/Filas/usuario/:cpf_usuario", (req, res, next) => {
    db.all(
        `SELECT * FROM Filas
        WHERE cpf_usuario = ?`,
        [parseInt(req.params.cpf_usuario, 10)],
        (err, result) => {
            if (err) {
                res.status(500).send("Erro ao obter dados.");
            } else {
                res.status(200).json(result);
            }
        }
    );
});

// Método HTTP GET /Filas/atracao/:id_atracao - retorna a fila de uma atração
app.get("/Filas/atracao/:id_atracao", (req, res, next) => {
    const id_atracao = parseInt(req.params.id_atracao, 10);
    if (isNaN(id_atracao)) {
        return res.status(400).send("ID da atração deve ser um número.");
    }

    // Verifica se a atração existe antes de consultar a fila
    axios
        .get(`${API_GATEWAY_URL}/Atracoes/${id_atracao}`)
        .then((atracaoResponse) => {
            // Se chegou aqui, a atração EXISTE (axios retornou 200)
            db.all(
                `SELECT *
                FROM Filas
                WHERE atracao_id = ?
                ORDER BY entrou_em ASC`,
                [id_atracao],
                (err, result) => {
                    if (err) {
                        res.status(500).send("Erro ao consultar a fila.");
                    } else {
                        res.status(200).json(result);
                    }
                }
            );
        })
        .catch((error) => {
            if (error.response && error.response.status === 404) {
                res.status(404).send("Atração não encontrada.");
            } else {
                // Outro erro (Gateway fora do ar, etc)
                console.log("Erro ao contatar Gateway:", error.message);
                res.status(500).send(
                    "Erro ao verificar atração via API Gateway."
                );
            }
        });
});

// Método HTTP Get /Filas/entrada/:id para obter uma entrada específica em filas
app.get("/Filas/entrada/:id", (req, res, next) => {
    db.get(
        `SELECT *
        FROM Filas
        WHERE id = ?`,
        [parseInt(req.params.id, 10)],
        (err, result) => {
            if (err) {
                res.status(500).send("Erro ao obter dados.");
            } else if (result == null) {
                res.status(404).send("Entrada em fila não encontrada.");
            } else {
                res.status(200).json(result);
            }
        }
    );
});

// Método HTTP POST /Filas/sair - simula a catraca de saída
app.post("/Filas/sair", (req, res, next) => {
    const atracao_id = parseInt(req.body.atracao_id, 10);
    const cpf_usuario = parseInt(req.body.cpf_usuario, 10);

    if (
        !atracao_id ||
        !cpf_usuario ||
        isNaN(atracao_id) ||
        isNaN(cpf_usuario)
    ) {
        return res
            .status(400)
            .send("CPF e atracao_id são obrigatórios e devem ser números.");
    }

    db.run(
        `DELETE FROM Filas
        WHERE atracao_id = ?
        AND cpf_usuario = ?`,
        [atracao_id, cpf_usuario],
        function (err) {
            if (err) {
                return res.status(500).send("Erro ao sair da fila.");
            }
            if (this.changes === 0) {
                return res
                    .status(404)
                    .send("Usuário não encontrado nesta fila.");
            }
            res.status(200).send("Usuário removido da fila com sucesso.");
        }
    );
});

// Inicia o Servidor na porta 8083
let porta = 8083;
app.listen(porta, () => {
    console.log(`Microserviço de FILAS em execução na porta: ${porta}`);
});
