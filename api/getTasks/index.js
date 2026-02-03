const { CosmosClient } = require("@azure/cosmos");

const connectionString = process.env.CosmosDB;
const client = new CosmosClient(connectionString);
const database = client.database("TasksDB");
const container = database.container("Tasks");

module.exports = async function (context, req) {
    context.log('HTTP trigger function: Buscando tarefas ativas.');

    try {
        // Garante que o banco de dados e o contêiner existam
        await client.databases.createIfNotExists({ id: "TasksDB" });
        await database.containers.createIfNotExists({ id: "Tasks", partitionKey: { paths: ["/id"] } });

        // A consulta busca todas as tarefas ONDE o status for diferente de 'done'
        const querySpec = {
            query: "SELECT * FROM c WHERE c.status <> @status",
            parameters: [
                { name: "@status", value: "done" }
            ]
        };

        const { resources: items } = await container.items.query(querySpec).fetchAll();
        context.res = {
            // status: 200, /* Defaults to 200 */
            body: items
        };
    } catch (error) {
        context.log.error(`Erro ao buscar tarefas: ${error.message}`);
        context.res = {
            status: 500,
            body: "Erro ao buscar tarefas."
        };
    }
};