const { CosmosClient } = require("@azure/cosmos");

const connectionString = process.env.CosmosDB;
const client = new CosmosClient(connectionString);
const database = client.database("TasksDB");
const container = database.container("Users");

module.exports = async function (context, req) {
    context.log('HTTP trigger function: Buscando lista de usuários da coleção Users.');

    try {
        await database.containers.createIfNotExists({ id: "Users", partitionKey: { paths: ["/email"] } });
        const { resources: users } = await container.items.readAll().fetchAll();
        
        if (!users.some(u => u.name === 'DEFINIR')) {
             users.push({ name: 'DEFINIR', email: '', picture: '' });
        }

        context.res = { body: users };
    } catch (error) {
        context.log.error(`Erro ao buscar usuários: ${error.message}`); 
        context.res = { status: 500, body: "Erro ao buscar usuários." };
    }
};