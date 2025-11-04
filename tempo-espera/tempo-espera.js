// Inicia o Express.js
const express = require("express");
const app = express();
const API_GATEWAY_URL = "http://localhost:8000";

// Body Parser - usado para processar dados da requisição HTTP
const bodyParser = require("body-parser");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Método HTTP GET /Estimativa/atracao/:id - Pega o tempo estimado
app.get("/Estimativa/atracao/:id", (req, res) => {
    const id = req.params.id;
    const urlAtracao = `${API_GATEWAY_URL}/Atracoes/${id}`;
    const promessaAtracao = axios.get(urlAtracao);
    const urlFila = `${API_GATEWAY_URL}/Filas/atracao/${id}`;
    const promessaFila = axios.get(urlFila);

    Promise.all([promessaAtracao, promessaFila])
        .then((resultados) => {
            const responseAtracao = resultados[0];
            const atracao = responseAtracao.data;
            const responseFila = resultados[1];
            const fila = responseFila.data;

            const capacidade = atracao.capacidade;
            const tempo_medio = atracao.tempo_medio;
            const pessoas_na_fila = fila.length;

            const espera_estimada =
                Math.ceil(pessoas_na_fila / capacidade) * tempo_medio;

            res.status(200).json({
                atracao_id: parseInt(id, 10),
                nome_atracao: atracao.nome,
                status_atracao: atracao.status,
                pessoas_na_fila: pessoas_na_fila,
                tempo_estimado_minutos: espera_estimada,
            });
        })
        .catch((error) => {
            if (error.response && error.response.status === 404) {
                if (error.config.url.includes("/Atracoes")) {
                    res.status(404).send("Atração (ID) não encontrada.");
                } else if (error.config.url.includes("/Filas")) {
                    res.status(404).send(
                        "Fila da Atração (ID) não encontrada."
                    );
                } else {
                    res.status(404).send("Recurso não encontrado via Gateway.");
                }
            } else {
                console.log("Erro no Gateway:", error.message);
                res.status(500).send("Erro ao buscar dados no Gateway.");
            }
        });
});

// Inicia o Servidor na porta 8084
let porta = 8084;
app.listen(porta, () => {
    console.log("Servidor em execução na porta: " + porta);
});
