const { CosmosClient } = require("@azure/cosmos");

const connectionString = process.env.CosmosDB;
const client = new CosmosClient(connectionString);
const database = client.database("TasksDB");
const container = database.container("Tasks");

module.exports = async function (context, req) {
    const orderedTasks = req.body;
    context.log(`A atualizar a ordem de ${orderedTasks.length} tarefas.`);

    try {
        const operations = orderedTasks.map(task => ({
            operationType: "Patch",
            id: task.id,
            partitionKey: task.id,
            resourceBody: {
                operations: [{ op: "set", path: "/order", value: task.order }]
            }
        }));

        while (operations.length > 0) {
            const batch = operations.splice(0, 100);
            await container.items.bulk(batch);
            context.log(`Processado um lote de ${batch.length} operações.`);
        }

        context.bindings.signalRMessage = {
            target: 'tasksReordered',
            arguments: []
        };

        context.res = { status: 200, body: "Ordem atualizada com sucesso." };
    } catch (error) {
        context.log.error(`Erro ao atualizar a ordem: ${error.message}`);
        context.res = { status: 500, body: "Erro ao atualizar a ordem das tarefas." };
    }
};