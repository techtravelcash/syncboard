const { CosmosClient } = require("@azure/cosmos");

const connectionString = process.env.CosmosDB;
const client = new CosmosClient(connectionString);
const database = client.database("TasksDB");
const usersContainer = database.container("Users");

module.exports = async function (context, req) {
    context.log('Função getRoles iniciada (lógica de whitelist).');

    try {

        const clientPrincipal = req.body;
        

        const email = clientPrincipal.userDetails || 
                      (clientPrincipal.claims.find(c => c.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress') || {}).val ||
                      (clientPrincipal.claims.find(c => c.typ === 'email') || {}).val;

        context.log(`DEBUG: Tentativa de login para: ${email}`);

        if (!email) {
            context.log.warn('ACESSO NEGADO: E-mail não identificado no payload de autenticação.');
            context.res = { body: { roles: ['authenticated'] } };
            return;
        }

        // Busca o usuário no banco
        const { resource: existingUser } = await usersContainer.item(email, email).read().catch(err => {
            context.log.error(`Erro ao ler do CosmosDB: ${err.message}`);
            return { resource: null };
        });

        if (existingUser) {
            context.log(`SUCESSO: Utilizador ${email} encontrado e autorizado.`);
            
            // Atualiza nome e foto se disponíveis
            const nameClaim = clientPrincipal.claims.find(c => c.typ === 'name');
            const pictureClaim = clientPrincipal.claims.find(c => c.typ === 'picture');
            
            // Só faz update se algo mudou para economizar RUs, ou sempre (como estava antes)
            existingUser.name = nameClaim ? nameClaim.val : existingUser.name;
            existingUser.picture = pictureClaim ? pictureClaim.val : existingUser.picture;
            
            // Opcional: fazer o upsert em background para não travar o login
            usersContainer.items.upsert(existingUser).catch(e => context.log.error("Erro no upsert:", e));

            const responsePayload = {
                claims: {
                    picture: existingUser.picture,
                    name: existingUser.name
                },
                roles: ['authenticated', 'travelcash_user']
            };

            if (existingUser.isAdmin === true) {
                responsePayload.roles.push('admin');
            }

            context.res = { body: responsePayload };

        } else {
            context.log.warn(`ACESSO NEGADO: ${email} não está na whitelist (Tabela Users).`);
            context.res = { body: { roles: ['authenticated'] } };
        }

    } catch (error) {
        context.log.error(`ERRO CRÍTICO na função getRoles: ${error.message}`);
        // Em caso de erro, libera apenas autenticado para não travar, mas sem acesso à app
        context.res = { status: 500, body: { roles: ['authenticated'] } };
    }
};