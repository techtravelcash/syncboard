const { CosmosClient } = require('@azure/cosmos');
const container = new CosmosClient(process.env.CosmosDB).database('TasksDB').container('Tasks');

module.exports = async function (context, req) {
    // Same workspace-wide scope as getTasks, with defense in depth for this route.
    let principal;
    try { principal = JSON.parse(Buffer.from(req.headers?.['x-ms-client-principal'] || '', 'base64').toString('utf8')); } catch { /* handled below */ }
    if (!Array.isArray(principal?.userRoles) || !principal.userRoles.includes('travelcash_user')) {
        context.res = { status: principal ? 403 : 401, body: 'Acesso não autorizado.' };
        return;
    }
    try {
        // Aggregate in Cosmos: never transfer archived task bodies to the client.
        // Project identity is the stored name; no independent project ID exists.
        const { resources } = await container.items.query({
            query: 'SELECT c.project, c.status, COUNT(1) AS count FROM c WHERE IS_STRING(c.project) AND c.project != "" GROUP BY c.project, c.status'
        }).fetchAll();
        const projects = new Map();
        for (const row of resources) {
            if (!projects.has(row.project)) projects.set(row.project, { project: row.project, active: 0, total: 0 });
            const project = projects.get(row.project);
            project.total += row.count;
            if (row.status !== 'done') project.active += row.count;
        }
        context.res = { headers: { 'Cache-Control': 'no-store' }, body: [...projects.values()] };
    } catch (error) {
        context.log.error(`Erro ao contar tarefas por projeto: ${error.message}`);
        context.res = { status: 500, body: 'Não foi possível carregar os totais por projeto.' };
    }
};
