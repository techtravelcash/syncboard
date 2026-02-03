const { CosmosClient } = require("@azure/cosmos");

const connectionString = process.env.CosmosDB;
const client = new CosmosClient(connectionString);
const database = client.database("TasksDB");
const container = database.container("Notifications");

function getUser(request) {
    const header = request.headers['x-ms-client-principal'];
    if (!header) return null;
    const encoded = Buffer.from(header, 'base64');
    const decoded = encoded.toString('ascii');
    return JSON.parse(decoded);
}

module.exports = async function (context, req) {
    const user = getUser(req);
    if (!user) {
        context.res = { status: 401, body: [] };
        return;
    }
    
    // O email do utilizador logado é usado como chave para buscar as notificações dele
    const userEmail = user.userDetails; 

    try {
        await database.containers.createIfNotExists({ id: "Notifications", partitionKey: { paths: ["/targetUserEmail"] } });

        const querySpec = {
            query: "SELECT * FROM c WHERE c.targetUserEmail = @email ORDER BY c.createdAt DESC",
            parameters: [{ name: "@email", value: userEmail }]
        };

        const { resources: items } = await container.items.query(querySpec).fetchAll();
        context.res = { body: items };
    } catch (error) {
        context.log.error(`Erro ao buscar notificações: ${error.message}`);
        context.res = { status: 500, body: [] };
    }
};