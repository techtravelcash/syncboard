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
    const { id } = req.body; // ID da notificação
    
    if (!user || !id) {
        context.res = { status: 400 };
        return;
    }

    try {
        // Busca a notificação pelo ID e Partition Key (Email)
        const { resource: notification } = await container.item(id, user.userDetails).read();
        
        if (notification) {
            notification.isRead = true;
            await container.item(id, user.userDetails).replace(notification);
        }
        
        context.res = { status: 200 };
    } catch (error) {
        context.log.error(error);
        context.res = { status: 500 };
    }
};