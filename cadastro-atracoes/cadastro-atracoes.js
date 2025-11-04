// ==========================
// MICRO SERVIÇO: CADASTRO DE ATRAÇÕES
// ==========================

// Importa dependências
const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

// Inicializa app Express
const app = express();
const PORT = 8082; // porta específica para este microserviço
const API_GATEWAY_URL = "http://localhost:8000";

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ==========================
// BANCO DE DADOS
// ==========================
const db = new sqlite3.Database("./Atracoes.db", (err) => {
  if (err) {
    console.error("Erro ao conectar ao banco de dados SQLite:", err);
  } else {
    console.log("Conectado ao banco de dados SQLite (Atracoes.db)");
  }
});

// Cria tabela de atrações, caso não exista
db.run(
  `
  CREATE TABLE IF NOT EXISTS Atracoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descricao TEXT,
    capacidade INTEGER NOT NULL,
    tempo_medio INTEGER NOT NULL,
    status TEXT DEFAULT 'Em funcionamento'
  )
`,
  (err) => {
    if (err) console.error("Erro ao criar tabela:", err);
    else console.log('Tabela "Atracoes" pronta.');
  }
);

// ==========================
// ROTAS HTTP
// ==========================

// [GET] /Atracoes - retorna todas as atrações
app.get("/Atracoes", (req, res) => {
  db.all("SELECT * FROM Atracoes", [], (err, rows) => {
    if (err) {
      res.status(500).json({ erro: "Erro ao consultar atrações." });
    } else {
      res.status(200).json(rows);
    }
  });
});

// [GET] /Atracoes/:id - retorna uma atração específica
app.get("/Atracoes/:id", (req, res) => {
  db.get("SELECT * FROM Atracoes WHERE id = ?", [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ erro: "Erro ao consultar atração." });
    } else if (!row) {
      res.status(404).json({ erro: "Atração não encontrada." });
    } else {
      res.status(200).json(row);
    }
  });
});

// [POST] /Atracoes - cadastra uma nova atração
app.post("/Atracoes", (req, res) => {
  const { nome, descricao, capacidade, tempo_medio, status } = req.body;

  if (!nome || !capacidade || !tempo_medio) {
    return res
      .status(400)
      .json({ erro: "Campos obrigatórios: nome, capacidade, tempo_medio." });
  }

  db.run(
    "INSERT INTO Atracoes (nome, descricao, capacidade, tempo_medio, status) VALUES (?, ?, ?, ?, ?)",
    [
      nome,
      descricao || "",
      capacidade,
      tempo_medio,
      status || "Em funcionamento",
    ],
    function (err) {
      if (err) {
        res.status(500).json({ erro: "Erro ao cadastrar atração." });
      } else {
        res.status(201).json({
          mensagem: "Atração cadastrada com sucesso!",
          id: this.lastID,
        });
      }
    }
  );
});

// [PATCH] /Atracoes/:id - atualiza dados da atração
app.patch("/Atracoes/:id", (req, res) => {
  const { nome, descricao, capacidade, tempo_medio, status } = req.body;

  db.run(
    `UPDATE Atracoes
     SET nome = COALESCE(?, nome),
         descricao = COALESCE(?, descricao),
         capacidade = COALESCE(?, capacidade),
         tempo_medio = COALESCE(?, tempo_medio),
         status = COALESCE(?, status)
     WHERE id = ?`,
    [nome, descricao, capacidade, tempo_medio, status, req.params.id],
    function (err) {
      if (err) {
        res.status(500).json({ erro: "Erro ao atualizar atração." });
      } else if (this.changes === 0) {
        res.status(404).json({ erro: "Atração não encontrada." });
      } else {
        res.status(200).json({ mensagem: "Atração atualizada com sucesso!" });
      }
    }
  );
});

// [DELETE] /Atracoes/:id - remove uma atração
app.delete("/Atracoes/:id", (req, res) => {
  db.run("DELETE FROM Atracoes WHERE id = ?", [req.params.id], function (err) {
    if (err) {
      res.status(500).json({ erro: "Erro ao remover atração." });
    } else if (this.changes === 0) {
      res.status(404).json({ erro: "Atração não encontrada." });
    } else {
      res.status(200).json({ mensagem: "Atração removida com sucesso!" });
    }
  });
});

// ==========================
// INICIA SERVIDOR
// ==========================
app.listen(PORT, () => {
  console.log(`Servidor de Cadastro de Atrações rodando na porta ${PORT}`);
});
