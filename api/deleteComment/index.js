const { CosmosClient } = require("@azure/cosmos");

const connectionString = process.env.CosmosDB;
const client = new CosmosClient(connectionString);
const database = client.database("TasksDB");
const container = database.container("Tasks");

module.exports = async function (context, req) {
    const taskId = context.bindingData.id;
    const { index } = req.body;
    context.log(`Excluindo comentário no índice ${index} da tarefa ${taskId}`);

    try {
        const { resource: existingTask } = await container.item(taskId, taskId).read();
        if (!existingTask) {
            context.res = { status: 404, body: "Tarefa não encontrada." };
            return;
        }

        if (Array.isArray(existingTask.comments) && existingTask.comments[index]) {
            existingTask.comments.splice(index, 1);
        } else {
            context.res = { status: 400, body: "Comentário não encontrado." };
            return;
        }

        if (!existingTask._etag) throw new Error('ETag ausente na tarefa lida.');
        const { resource: replaced } = await container.item(taskId, taskId).replace(existingTask, {
            accessCondition: {type: 'IfMatch', condition: existingTask._etag}
        });

        context.bindings.signalRMessage = {
            target: 'taskUpdated',
            arguments: [replaced]
        };

        context.res = { body: replaced };
    } catch (error) {
        if (Number(error.code || error.statusCode) === 412) {
            context.res = {status: 409, body: 'A tarefa foi alterada. Atualize e tente novamente.'};
            return;
        }
        context.log.error(`Erro ao excluir comentário: ${error.message}`);
        context.res = { status: 500, body: "Erro ao excluir comentário." };
    }
};
