const { deleteReviewer } = require('../shared/reviewerGuard');
const { CosmosClient } = require("@azure/cosmos");

const connectionString = process.env.CosmosDB;
const client = new CosmosClient(connectionString);
const database = client.database("TasksDB");
const usersContainer = database.container("Users");

function getUser(request) {
    const header = request.headers['x-ms-client-principal'];
    if (!header) return null;
    const encoded = Buffer.from(header, 'base64');
    const decoded = encoded.toString('ascii');
    return JSON.parse(decoded);
}

module.exports = async function (context, req) {
    const requestingUser = getUser(req);
    const userIdToDelete = context.bindingData.id;

    // Verificar se o utilizador solicitante é admin
    if (!requestingUser || !requestingUser.userRoles.includes('admin')) {
        context.res = { status: 403, body: "Acesso negado. Apenas administradores podem gerir utilizadores." };
        return;
    }

    // Prevenir que o admin se apague a si próprio
    // O ID do utilizador no Cosmos é o email em minúsculas
    if (requestingUser.userDetails.toLowerCase() === userIdToDelete.toLowerCase()) {
         context.res = { status: 400, body: "Não pode eliminar a sua própria conta." };
         return;
    }

    context.log(`A eliminar utilizador com ID: ${userIdToDelete}`);

    try {
        await deleteReviewer(usersContainer, database.container("Tasks"), userIdToDelete);

        context.res = { status: 204 };
    } catch (error) {
        if (error.httpStatus === 409 || Number(error.code || error.statusCode) === 412) {
            context.res = {status: 409, body: error.message};
        } else if (error.code === 404) {
            context.res = { status: 404, body: "Utilizador não encontrado." };
        } else {
            context.log.error(`Erro ao eliminar utilizador ${userIdToDelete}: ${error.message}`);
            context.res = { status: 500, body: "Erro ao eliminar utilizador." };
        }
    }
};