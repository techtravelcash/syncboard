const { CosmosClient } = require("@azure/cosmos");

const connectionString = process.env.CosmosDB;
const client = new CosmosClient(connectionString);
const database = client.database("TasksDB");
const container = database.container("Tasks");

module.exports = async function (context, req) {
    context.log('Buscando tarefas ARQUIVADAS.');
    try {
        const querySpec = {
            query: "SELECT * FROM c WHERE c.status = @status",
            parameters: [{ name: "@status", value: "done" }]
        };
        const { resources: items } = await container.items.query(querySpec).fetchAll();
        context.res = { body: items };
    } catch (error) {
        context.log.error(`Erro ao buscar tarefas arquivadas: ${error.message}`);
        context.res = { status: 500, body: "Erro ao buscar tarefas arquivadas." };
    }
};