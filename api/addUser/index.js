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

    if (!requestingUser || !requestingUser.userRoles.includes('admin')) {
        context.res = { status: 403, body: "Acesso negado. Apenas administradores podem adicionar utilizadores." };
        return;
    }

    try {
        const newUser = req.body;
        if (!newUser || !newUser.email || !newUser.name) {
            context.res = { status: 400, body: "Nome e e-mail são obrigatórios." };
            return;
        }

        const userProfile = {
            id: newUser.email.toLowerCase(),
            email: newUser.email.toLowerCase(),
            name: newUser.name,
            picture: '',
            isAdmin: newUser.isAdmin === true
        };

        const { resource: createdUser } = await usersContainer.items.create(userProfile);
        context.res = { body: createdUser };
    } catch (error) {
        if (error.code === 409) {
            context.res = { status: 409, body: "Este utilizador já existe." };
        } else {
            context.log.error(`Erro ao adicionar utilizador: ${error.message}`);
            context.res = { status: 500, body: "Erro ao adicionar o utilizador." };
        }
    }
};