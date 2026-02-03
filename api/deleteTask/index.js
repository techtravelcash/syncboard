const { CosmosClient } = require("@azure/cosmos");

const connectionString = process.env.CosmosDB;
const client = new CosmosClient(connectionString);
const database = client.database("TasksDB");
const container = database.container("Tasks");

module.exports = async function (context, req) {
    const taskId = context.bindingData.id;
    context.log(`A excluir tarefa com ID: ${taskId}`);

    try {
        await container.item(taskId, taskId).delete();

        context.bindings.signalRMessage = {
            target: 'taskDeleted',
            arguments: [taskId]
        };

        context.res = { status: 204 };
    } catch (error) {
        if (error.code === 404) {
            context.res = { status: 404, body: "Tarefa não encontrada." };
        } else {
            context.log.error(`Erro ao excluir tarefa ${taskId}: ${error.message}`);
            context.res = { status: 500, body: "Erro ao excluir tarefa." };
        }
    }
};