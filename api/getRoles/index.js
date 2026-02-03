const { CosmosClient } = require("@azure/cosmos");

const connectionString = process.env.CosmosDB;
const client = new CosmosClient(connectionString);
const database = client.database("TasksDB");
const usersContainer = database.container("Users");

module.exports = async function (context, req) {
    context.log('Função getRoles iniciada (lógica de whitelist).');

    try {
        await database.containers.createIfNotExists({ id: "Users", partitionKey: { paths: ["/email"] } });

        const clientPrincipal = req.body; // O corpo do pedido já é o JSON
        const emailClaim = clientPrincipal.claims.find(c => c.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress');
        const email = emailClaim ? emailClaim.val : null;

        if (!email) {
            context.log.warn('Não foi possível encontrar o claim de e-mail.');
            context.res = { body: { roles: ['authenticated'] } };
            return;
        }

        const { resource: existingUser } = await usersContainer.item(email, email).read().catch(() => ({ resource: null }));

        if (existingUser) {
            context.log(`Utilizador ${email} encontrado na whitelist.`);
            
            const nameClaim = clientPrincipal.claims.find(c => c.typ === 'name');
            const pictureClaim = clientPrincipal.claims.find(c => c.typ === 'picture');
            existingUser.name = nameClaim ? nameClaim.val : email;
            existingUser.picture = pictureClaim ? pictureClaim.val : '';
            await usersContainer.items.upsert(existingUser);

            const responsePayload = {
                claims: {
                    picture: existingUser.picture,
                    name: existingUser.name
                },
                roles: ['authenticated', 'travelcash_user']
            };

            if (existingUser.isAdmin === true) {
                responsePayload.roles.push('admin');
                context.log(`Utilizador ${email} autorizado com a role 'admin'.`);
            }

            context.res = { body: responsePayload };

        } else {
            context.log.warn(`ACESSO NEGADO: Utilizador ${email} não encontrado na whitelist.`);
            context.res = { body: { roles: ['authenticated'] } };
        }

    } catch (error) {
        context.log.error(`Erro na função de roles: ${error.message}`);
        context.res = { status: 500, body: { roles: ['authenticated'] } };
    }
};