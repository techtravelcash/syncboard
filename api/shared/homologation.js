// SWA must be the trusted ingress: it supplies x-ms-client-principal.
// Never accept an actor identity or decision fields from the request body.
function email(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}
function homologatorEmail(value) {
    return email(value && typeof value === 'object' ? value.email : value);
}
function actorEmail(req) {
    try {
        const header = req.headers && req.headers['x-ms-client-principal'];
        if (typeof header !== 'string') return null;
        const principal = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
        if (!Array.isArray(principal.userRoles) || !principal.userRoles.includes('travelcash_user')) return null;
        const detail = email(principal.userDetails);
        if (detail) return detail;
        const types = ['email', 'emails', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];
        for (const claim of Array.isArray(principal.claims) ? principal.claims : []) {
            if (claim && types.includes(claim.typ) && email(claim.val)) return email(claim.val);
        }
        return null;
    } catch (_) { return null; }
}
function fail(status, message) { const error = new Error(message); error.httpStatus = status; throw error; }
function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
}
async function decisionUpdate(task, body, req, users) {
    const actor = actorEmail(req);
    if (!actor) fail(401, 'Identidade autenticada necessária para homologar.');
    if (!['approve', 'reject', 'forward'].includes(body.homologationAction)) fail(400, 'Decisão de homologação inválida.');
    if (body.expectedStatus !== 'homologation') fail(400, 'Informe o estado esperado de homologação.');
    if (task.status !== 'homologation') fail(409, 'Esta tarefa já saiu de homologação. Atualize a lista.');
    if (!body.expectedEtag || body.expectedEtag !== task._etag) fail(409, 'A tarefa foi alterada. Atualize antes de decidir.');
    const assigned = homologatorEmail(task.homologador);
    if (!assigned || assigned !== actor) fail(403, 'Somente o homologador designado pode decidir.');
    const action = body.homologationAction;
    if (action === 'approve') return {data: {status: 'publication', progress: 100}, actor, action};
    if (action === 'reject') return {data: {status: 'inprogress', homologador: null}, actor, action};
    const selected = email(body.newResponsibleEmail);
    if (!selected) fail(400, 'Selecione um responsável com e-mail válido.');
    // Read the registered profile; never trust a client-supplied name or user object.
    const {resources} = await users.items.query({
        query: 'SELECT * FROM c WHERE LOWER(c.email) = @email',
        parameters: [{name: '@email', value: selected}]
    }).fetchAll();
    const profile = resources.find(user => email(user.email) === selected);
    if (!profile) fail(400, 'O responsável selecionado não existe.');
    if (Array.isArray(task.responsible) && task.responsible.length === 1 && homologatorEmail(task.responsible[0]) === selected) {
        fail(400, 'Selecione um responsável diferente do responsável atual.');
    }
    return {data: {status: 'todo', homologador: null, responsible: [{
        email: selected, name: profile.name || profile.displayName || selected, picture: profile.picture || ''
    }]}, actor, action};
}
async function responsibleEditUpdate(task, body, req, users) {
    if (body.expectedStatus !== undefined) {
        if (body.expectedStatus !== 'homologation') fail(400, 'Estado esperado inválido.');
        if (task.status !== 'homologation' || !body.expectedEtag || body.expectedEtag !== task._etag) {
            fail(409, 'A tarefa foi alterada. Reabra a edição antes de salvar.');
        }
    }
    if (task.status !== 'homologation' || body.responsible === undefined ||
        JSON.stringify(body.responsible) === JSON.stringify(task.responsible)) return null;
    const actor = actorEmail(req);
    if (!actor) fail(403, 'Somente administradores podem alterar responsáveis em homologação.');
    const principal = JSON.parse(Buffer.from(req.headers['x-ms-client-principal'], 'base64').toString('utf8'));
    if (!principal.userRoles.includes('admin')) fail(403, 'Somente administradores podem alterar responsáveis em homologação.');
    if (body.expectedStatus !== 'homologation' || !body.expectedEtag || body.expectedEtag !== task._etag) {
        fail(409, 'A tarefa foi alterada. Reabra a edição antes de salvar.');
    }
    async function profileFor(selected) {
        const {resources} = await users.items.query({
            query: 'SELECT * FROM c WHERE LOWER(c.email) = @email',
            parameters: [{name: '@email', value: selected}]
        }).fetchAll();
        return resources.find(user => email(user.email) === selected);
    }
    // Check the current profile too: a stale login must not retain revoked admin rights.
    if ((await profileFor(actor))?.isAdmin !== true) fail(403, 'Perfil de administrador necessário.');
    if (!Array.isArray(body.responsible) || !body.responsible.length) fail(400, 'Selecione ao menos um responsável cadastrado.');
    const selected = body.responsible.map(user => homologatorEmail(user));
    if (selected.some(value => !value) || new Set(selected).size !== selected.length) fail(400, 'Responsáveis inválidos ou duplicados.');
    const responsible = [];
    for (const address of selected) {
        const profile = await profileFor(address);
        if (!profile) fail(400, 'O responsável selecionado não existe.');
        responsible.push({email: address, name: profile.name || profile.displayName || address, picture: profile.picture || ''});
    }
    return {responsible, actor};
}
function protectGenericUpdate(task, body, allowResponsibleEdit = false) {
    if (task.status !== 'homologation') return;
    if (body.status !== undefined && body.status !== task.status) fail(403, 'Use uma decisão de homologação para alterar este estado.');
    if (body.homologador !== undefined && homologatorEmail(body.homologador) !== homologatorEmail(task.homologador)) {
        fail(403, 'Não é possível trocar o homologador durante a homologação.');
    }
    // Protect outcome fields from generic updates, including full-task saves.
    for (const key of ['progress', 'responsible']) {
        if (key === 'responsible' && allowResponsibleEdit) continue;
        if (body[key] !== undefined && JSON.stringify(body[key]) !== JSON.stringify(task[key])) fail(403, 'Use uma decisão de homologação para alterar os responsáveis ou o progresso.');
    }
}
module.exports = {email, homologatorEmail, actorEmail, decisionUpdate, responsibleEditUpdate, protectGenericUpdate, escapeHtml};
