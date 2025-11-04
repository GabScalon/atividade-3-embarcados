const express = require("express");
const httpProxy = require("express-http-proxy");
const app = express();
var logger = require("morgan");

app.use(logger("dev"));

const CADASTRO_URL = "http://localhost:8080";
const INGRESSOS_URL = "http://localhost:8081";
const ATRACOES_URL = "http://localhost:8082";
const FILAS_URL = "http://localhost:8083";
const ESTIMATIVA_ESPERA_URL = "http://localhost:8084";

function selectProxyHost(req) {
    if (req.path.startsWith("/Cadastro")) {
        return CADASTRO_URL;
    } else if (
        req.path.startsWith("/Ingressos") ||
        req.path.startsWith("/Validar")
    ) {
        return INGRESSOS_URL;
    } else if (req.path.startsWith("/Atracoes")) {
        return ATRACOES_URL;
    } else if (req.path.startsWith("/Filas")) {
        return FILAS_URL;
    } else if (req.path.startsWith("/Estimativa")) {
        return ESTIMATIVA_ESPERA_URL;
    } else {
        return null; // Rota não mapeada
    }
}

app.use((req, res, next) => {
    const proxyHost = selectProxyHost(req);

    if (proxyHost === null) {
        return res.status(404).send("Serviço não encontrado.");
    }

    httpProxy(proxyHost)(req, res, next);
});

const porta = 8000;
app.listen(porta, () => {
    console.log(`API Gateway em execução na porta: ${porta}`);
});
