const { prepareReviewerRemoval } = require('../shared/reviewerGuard');
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
        // Omitted by older clients: preserve the saved identification.
        const isAiAgent = Object.prototype.hasOwnProperty.call(updatedData, 'isAiAgent')
            ? updatedData.isAiAgent === true
            : existingUser.isAiAgent === true;

        // Se o email (que é o ID) for alterado, criamos um novo e apagamos o antigo no BD
        if (newId !== userId) {
            const newUserProfile = {
                id: newId,
                email: newId,
                name: existingUser.name, // Mantém o nome original intacto
                displayName: updatedData.displayName, // Grava o novo Display Name
                role: updatedData.role || '',
                picture: existingUser.picture || '',
                isAdmin: updatedData.isAdmin === true,
                isAiAgent
            };
            // Fence pending assignments before rename; the final conditional delete
            // fails if a new reservation arrives while the destination is created.
            const prepared = await prepareReviewerRemoval(usersContainer, database.container("Tasks"), userId);
            if (prepared.profile._etag !== existingUser._etag) {
                const changed = new Error('O cadastro mudou durante a troca de e-mail. Atualize antes de tentar novamente.');
                changed.httpStatus = 409;
                throw changed;
            }
            let created;
            try { ({resource: created} = await usersContainer.items.create(newUserProfile)); }
            catch (error) {
                if (Number(error.code || error.statusCode) === 409) throw error;
                const uncertain = new Error('Não foi possível confirmar a criação do novo cadastro. O cadastro antigo foi preservado; confira ambos antes de tentar novamente.');
                uncertain.httpStatus = 409;
                throw uncertain;
            }
            try { await prepared.item.delete(prepared.options); }
            catch (error) {
                // A failed/lost response may follow a committed source deletion.
                // Only 412 proves the old profile was not deleted by this request.
                if (Number(error.code || error.statusCode) !== 412) {
                    const uncertain = new Error('Não foi possível confirmar a remoção do cadastro antigo. O novo cadastro foi preservado; confira ambos antes de tentar novamente.');
                    uncertain.httpStatus = 409;
                    throw uncertain;
                }
                // Only undo the exact profile created here, never somebody else's edit.
                if (created?._etag) {
                    try { await usersContainer.item(newId, newId).delete({accessCondition: {type: 'IfMatch', condition: created._etag}}); }
                    catch (_) {
                        const partial = new Error('Troca de e-mail interrompida. Os cadastros antigo e novo foram preservados porque houve alteração concorrente; revise ambos antes de tentar novamente.');
                        partial.httpStatus = 409;
                        throw partial;
                    }
                }
                throw error;
            }
            context.res = { body: newUserProfile };
        } else {
            // Se o email for o mesmo, apenas atualizamos os restantes campos
            existingUser.displayName = updatedData.displayName; // <-- Atualiza apenas o Display Name
            existingUser.role = updatedData.role || '';
            existingUser.isAdmin = updatedData.isAdmin === true;
            existingUser.isAiAgent = isAiAgent;
            
            const { resource: replaced } = await usersContainer.item(userId, userId).patch([
                {op: 'set', path: '/displayName', value: existingUser.displayName || ''},
                {op: 'set', path: '/role', value: existingUser.role},
                {op: 'set', path: '/isAdmin', value: existingUser.isAdmin},
                ...(Object.prototype.hasOwnProperty.call(updatedData, 'isAiAgent') ? [{op: 'set', path: '/isAiAgent', value: existingUser.isAiAgent}] : [])
            ]);
            context.res = { body: replaced };
        }
    } catch (error) {
        context.log.error(`Erro ao atualizar utilizador: ${error.message}`);
        const conflict = error.httpStatus === 409 || [409, 412].includes(Number(error.code || error.statusCode));
        context.res = { status: conflict ? 409 : 500, body: conflict ? (error.httpStatus === 409 ? error.message : 'O cadastro está em uso ou mudou. Atualize antes de tentar novamente.') : 'Erro ao atualizar o utilizador.' };
    }
};