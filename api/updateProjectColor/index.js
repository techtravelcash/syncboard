const { CosmosClient } = require("@azure/cosmos");

const connectionString = process.env.CosmosDB;
const client = new CosmosClient(connectionString);
const database = client.database("TasksDB");
const container = database.container("Tasks");

module.exports = async function (context, req) {
    const { projectName, newColor } = req.body;
    context.log(`Atualizando a cor do projeto '${projectName}' para '${newColor}'.`);

    if (!projectName || !newColor) {
        context.res = { status: 400, body: "Nome do projeto e nova cor são obrigatórios." };
        return;
    }

    try {
        const querySpec = {
            query: "SELECT * FROM c WHERE c.project = @projectName",
            parameters: [{ name: "@projectName", value: projectName }]
        };
        const { resources: tasksToUpdate } = await container.items.query(querySpec).fetchAll();

        if (tasksToUpdate.length > 0) {
             const operations = tasksToUpdate.map(task => ({
                operationType: "Patch",
                id: task.id,
                partitionKey: task.id,
                resourceBody: {
                    operations: [{ op: "set", path: "/projectColor", value: newColor }]
                }
            }));

            while (operations.length > 0) {
                const batch = operations.splice(0, 100);
                await container.items.bulk(batch);
            }
        }

        context.bindings.signalRMessage = {
            target: 'tasksReordered', 
            arguments: []
        };

        context.res = { status: 200, body: `Cor do projeto '${projectName}' atualizada.` };
    } catch (error) {
        context.log.error(`Erro ao atualizar cor do projeto: ${error.message}`);
        context.res = { status: 500, body: "Erro interno ao atualizar a cor." };
    }
};