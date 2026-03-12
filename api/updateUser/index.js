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
        context.res = { status: 403, body: "Acesso negado. Apenas administradores podem atualizar utilizadores." };
        return;
    }

    const userId = context.bindingData.id;
    const updatedData = req.body;

    try {
        const { resource: existingUser } = await usersContainer.item(userId, userId).read();
        
        if (!existingUser) {
            context.res = { status: 404, body: "Utilizador não encontrado." };
            return;
        }

        const newId = updatedData.email.toLowerCase();

        // Se o email (que é o ID) for alterado, criamos um novo e apagamos o antigo no BD
        if (newId !== userId) {
            const newUserProfile = {
                id: newId,
                email: newId,
                name: existingUser.name, // Mantém o nome original intacto
                displayName: updatedData.displayName, // Grava o novo Display Name
                role: updatedData.role || '',
                picture: existingUser.picture || '',
                isAdmin: updatedData.isAdmin === true
            };
            await usersContainer.items.create(newUserProfile);
            await usersContainer.item(userId, userId).delete();
            context.res = { body: newUserProfile };
        } else {
            // Se o email for o mesmo, apenas atualizamos os restantes campos
            existingUser.displayName = updatedData.displayName; // <-- Atualiza apenas o Display Name
            existingUser.role = updatedData.role || '';
            existingUser.isAdmin = updatedData.isAdmin === true;
            
            const { resource: replaced } = await usersContainer.item(userId, userId).replace(existingUser);
            context.res = { body: replaced };
        }
    } catch (error) {
        context.log.error(`Erro ao atualizar utilizador: ${error.message}`);
        context.res = { status: 500, body: "Erro ao atualizar o utilizador." };
    }
};