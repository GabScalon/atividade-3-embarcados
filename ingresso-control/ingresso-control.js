// Inicia o Express.js
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3");
const axios = require("axios");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const API_GATEWAY_URL = "http://localhost:8000";

var db = new sqlite3.Database("./Ingressos.db", (err) => {
    if (err) {
        console.log(
            "ERRO: não foi possível conectar ao SQLite 'Ingressos.db'."
        );
        throw err;
    }
    console.log("Conectado ao SQLite 'Ingressos.db'!");
});

// Cria a tabela ingressos, caso ela não exista
db.run(
    `CREATE TABLE IF NOT EXISTS ingressos (
        id TEXT PRIMARY KEY,
        cpf_usuario INTEGER NOT NULL,
        tipo TEXT NOT NULL CHECK(tipo IN ('limitado', 'diario', 'anual')),
        criado_em TEXT NOT NULL,
        valido_ate TEXT,
        acessos_restantes INTEGER
    );`,
    [],
    (err) => {
        if (err) {
            console.log("ERRO: não foi possível criar tabela 'ingressos'.");
            throw err;
        }
    }
);

// Método HTTP POST /Ingressos - "Vende" (cria) um novo ingresso
app.post("/Ingressos", (req, res, next) => {
    const { cpf, tipo, valorInicial } = req.body;

    if (!cpf || !tipo) {
        return res.status(400).send("CPF e tipo são obrigatórios.");
    }

    const cpfNumerico = parseInt(cpf, 10);
    if (isNaN(cpfNumerico)) {
        return res.status(400).send("CPF deve ser um número.");
    }

    axios
        .get(`${API_GATEWAY_URL}/Cadastro/${cpfNumerico}`)
        .then((response) => {
            console.log(
                `Usuário ${cpfNumerico} verificado via Gateway. Criando ingresso...`
            );

            const now = new Date();
            const id = `TICKET-${Date.now()}`;
            const criadoEm = now.toISOString();

            let validoAte = null;
            let acessosRestantes = null;

            switch (tipo) {
                case "limitado":
                    const valorNumerico = parseInt(valorInicial, 10);

                    if (
                        !valorNumerico ||
                        isNaN(valorNumerico) ||
                        valorNumerico <= 0
                    ) {
                        return res
                            .status(400)
                            .send(
                                "Tipo 'limitado' exige 'valorInicial' numérico positivo."
                            );
                    }

                    acessosRestantes = valorNumerico;
                    break;
                case "diario":
                    const dataExpiracaoDiario = new Date(now);
                    dataExpiracaoDiario.setDate(
                        dataExpiracaoDiario.getDate() + 1
                    );
                    validoAte = dataExpiracaoDiario.toISOString();
                    break;
                case "anual":
                    const future = new Date(now);
                    future.setDate(future.getDate() + 365);
                    validoAte = future.toISOString();
                    break;
                default:
                    return res
                        .status(400)
                        .send(
                            "Tipo de ingresso inválido. Use 'limitado', 'diario' ou 'anual'."
                        );
            }

            const params = [
                id,
                cpfNumerico,
                tipo,
                criadoEm,
                validoAte,
                acessosRestantes,
            ];
            db.run(
                `INSERT INTO ingressos (id, cpf_usuario, tipo, criado_em, valido_ate, acessos_restantes)
                VALUES (?, ?, ?, ?, ?, ?)`,
                params,
                function (err) {
                    if (err) {
                        console.log("Erro ao criar ingresso: " + err);
                        return res
                            .status(500)
                            .send("Erro ao criar o ingresso.");
                    }
                    db.get(
                        "SELECT * FROM ingressos WHERE id = ?",
                        [id],
                        (err, row) => {
                            if (err) {
                                return res
                                    .status(500)
                                    .send(
                                        "Ingresso criado, mas falha ao buscá-lo."
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
                return res
                    .status(404)
                    .send(
                        "Usuário (CPF) não encontrado (verificado via Gateway)."
                    );
            } else {
                console.log("Erro ao contatar Gateway:", error.message);
                return res
                    .status(500)
                    .send("Erro ao verificar usuário via API Gateway.");
            }
        });
});

// Método HTTP POST /Validar/:id - Valida um ingresso NA CATRACA
app.post("/Validar/:id", (req, res, next) => {
    const { id } = req.params;
    const now_iso = new Date().toISOString();

    db.get(
        `SELECT *
        FROM ingressos
        WHERE id = ?`,
        [id],
        (err, ticket) => {
            if (err) {
                return res.status(500).send("Erro ao consultar ingresso.");
            }
            if (!ticket) {
                return res
                    .status(404)
                    .json({
                        allowed: false,
                        message: "Ingresso não encontrado.",
                    });
            }

            let validationResponse = {
                allowed: false,
                message: "",
                cpf: ticket.cpf_usuario,
            };

            const finalizarValidacaoEEntrarNaFila = () => {
                // Se o ingresso não for válido (expirado, sem acessos), rejeita a entrada
                if (!validationResponse.allowed) {
                    return res.status(403).json(validationResponse);
                }

                // Se o ingresso for válido, checa se a catraca enviou um atracao_id
                const { atracao_id } = req.body;

                if (!atracao_id) {
                    validationResponse.message_fila =
                        "Nenhuma fila informada. Apenas validado.";
                    return res.status(200).json(validationResponse);
                }

                axios
                    .post(`${API_GATEWAY_URL}/Filas/entrar`, {
                        atracao_id: parseInt(atracao_id, 10),
                        cpf_usuario: ticket.cpf_usuario,
                    })
                    .then((filaResponse) => {
                        validationResponse.message_fila =
                            "Usuário adicionado à fila.";
                        res.status(200).json(validationResponse);
                    })
                    .catch((filaError) => {
                        validationResponse.allowed = false; // A entrada é barrada
                        validationResponse.message = filaError.response
                            ? filaError.response.data
                            : "Erro ao entrar na fila.";
                        const status = filaError.response
                            ? filaError.response.status
                            : 500;
                        res.status(status).json(validationResponse);
                    });
            };

            // Lógica de validação
            switch (ticket.tipo) {
                case "limitado":
                    if (ticket.acessos_restantes > 0) {
                        const novosAcessos = ticket.acessos_restantes - 1;
                        db.run(
                            "UPDATE ingressos SET acessos_restantes = ? WHERE id = ?",
                            [novosAcessos, id],
                            (updateErr) => {
                                if (updateErr) {
                                    return res
                                        .status(500)
                                        .send("Erro ao atualizar acessos.");
                                }
                                validationResponse.allowed = true;
                                validationResponse.message = `Acesso permitido. Restam ${novosAcessos} acessos.`;

                                finalizarValidacaoEEntrarNaFila();
                            }
                        );
                        return;
                    } else {
                        validationResponse.message =
                            "Ingresso sem acessos restantes.";
                    }
                    break;

                case "diario":
                    if (now_iso <= ticket.valido_ate) {
                        validationResponse.allowed = true;
                        validationResponse.message =
                            "Acesso ilimitado (diário) permitido.";
                    } else {
                        validationResponse.message =
                            "Ingresso diário expirado.";
                    }
                    break;

                case "anual":
                    if (now_iso <= ticket.valido_ate) {
                        validationResponse.allowed = true;
                        validationResponse.message =
                            "Acesso (passaporte anual) permitido.";
                    } else {
                        validationResponse.message =
                            "Passaporte anual expirado.";
                    }
                    break;
            }

            finalizarValidacaoEEntrarNaFila();
        }
    );
});

// Método HTTP GET /Ingressos - retorna todos os ingressos (para admin)
app.get("/Ingressos", (req, res, next) => {
    db.all(
        `SELECT *
        FROM ingressos`,
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

// Método HTTP GET /Ingressos/usuario/:cpf - retorna todos os ingressos de um usuário
app.get("/Ingressos/usuario/:cpf", (req, res, next) => {
    db.all(
        `SELECT * FROM ingressos WHERE cpf_usuario = ?`,
        [parseInt(req.params.cpf, 10)],
        (err, result) => {
            if (err) {
                res.status(500).send("Erro ao obter dados.");
            } else {
                res.status(200).json(result);
            }
        }
    );
});

// Método HTTP GET /Ingressos/:id - retorna um ingresso específico
app.get("/Ingressos/:id", (req, res, next) => {
    db.get(
        `SELECT *
        FROM ingressos
        WHERE id = ?`,
        [req.params.id],
        (err, result) => {
            if (err) {
                res.status(500).send("Erro ao obter dados.");
            } else if (result == null) {
                res.status(404).send("Ingresso não encontrado.");
            } else {
                res.status(200).json(result);
            }
        }
    );
});

// Inicia o Servidor na porta 8081
let porta = 8081;
app.listen(porta, () => {
    console.log(`Microserviço de INGRESSOS em execução na porta: ${porta}`);
});
