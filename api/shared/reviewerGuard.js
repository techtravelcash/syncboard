// Durable reservations in the existing Users document. No lease expiration: a
// suspended request may resume at any time. The task ETag is its fencing token.
const address = value => String(typeof value === 'object' ? value?.email || '' : value || '').trim().toLowerCase();
function conflict(message) { const error = new Error(message); error.httpStatus = 409; return error; }
const isConflict = error => [404, 412].includes(Number(error.code || error.statusCode));
async function reserveReviewer(users, task, selected) {
    if (!task.id || !task._etag) throw conflict('Reabra a tarefa antes de designar o homologador.');
    const item = users.item(selected, selected);
    try {
        const {resource: profile} = await item.read();
        if (!profile || !profile._etag || address(profile.email) !== selected) throw conflict('O homologador foi removido. Selecione novamente.');
        const pins = Array.isArray(profile.homologationReservations) ? profile.homologationReservations : [];
        // Every attempt advances the profile ETag, even when reusing a task pin.
        const otherPins = pins.filter(pin => pin.taskId !== task.id);
        // Bound profile growth. Fail closed instead of losing a reservation.
        if (otherPins.length >= 4096) throw conflict('O cadastro atingiu o limite de reservas de homologação. Solicite revisão administrativa.');
        await item.replace({...profile, homologationReservations: [...otherPins, {taskId: task.id, taskEtag: task._etag}]}, {
            accessCondition: {type: 'IfMatch', condition: profile._etag}
        });
    } catch (error) {
        if (isConflict(error)) throw conflict('O cadastro do homologador mudou. Atualize e tente novamente.');
        throw error;
    }
}
async function prepareReviewerRemoval(users, tasks, id) {
    const item = users.item(id, id);
    const {resource: profile} = await item.read();
    if (!profile || !profile._etag) throw conflict('O cadastro mudou. Atualize antes de remover.');
    const selected = address(profile.email);
    // Backward compatibility for assignments persisted before reservations existed.
    let pending;
    try { ({resources: pending} = await tasks.items.query({
        query: 'SELECT TOP 1 c.id FROM c WHERE c.status = "homologation" AND (LOWER(TRIM(c.homologador.email)) = @email OR LOWER(TRIM(c.homologador)) = @email)',
        parameters: [{name: '@email', value: selected}]
    }, {consistencyLevel: 'Strong', bypassIntegratedCache: true}).fetchAll()); }
    catch (_) { throw conflict('Remoção segura indisponível: não foi possível verificar as homologações legadas com consistência forte. Nenhum cadastro foi removido.'); }
    if (pending.length) throw conflict('Este usuário homologa uma tarefa pendente. Resolva a homologação antes de removê-lo.');
    const ids = [...new Set((profile.homologationReservations || []).map(pin => pin.taskId))];
    for (const taskId of ids) {
        try {
            const taskItem = tasks.item(taskId, taskId);
            let task;
            try { ({resource: task} = await taskItem.read({consistencyLevel: 'Strong', bypassIntegratedCache: true})); }
            catch (error) {
                // Strong 404 proves the old task no longer exists; replace with its
                // reserved ETag cannot recreate it. Other read failures stay closed.
                if (Number(error.code || error.statusCode) === 404) continue;
                throw error;
            }
            // A missing resource without a verified Strong 404 is not proof of absence.
            if (!task || !task._etag) throw conflict('Não foi possível confirmar uma reserva de homologação. Atualize antes de remover.');
            if (task.status === 'homologation' && address(task.homologador) === selected) throw conflict('Este usuário homologa uma tarefa pendente. Resolva a homologação antes de removê-lo.');
            // Preserve every task field/history. This only advances its ETag and
            // invalidates suspended assignments made against the previous snapshot.
            await taskItem.replace(task, {
                accessCondition: {type: 'IfMatch', condition: task._etag}
            });
        } catch (error) {
            if (isConflict(error)) throw conflict('Uma tarefa mudou durante a remoção. Atualize e tente novamente.');
            throw error;
        }
    }
    return {item, profile, options: {accessCondition: {type: 'IfMatch', condition: profile._etag}}};
}
async function deleteReviewer(users, tasks, id) {
    const prepared = await prepareReviewerRemoval(users, tasks, id);
    try { await prepared.item.delete(prepared.options); }
    catch (error) { if (isConflict(error)) throw conflict('O cadastro recebeu uma alteração ou reserva. Atualize e tente novamente.'); throw error; }
}
module.exports = {reserveReviewer, prepareReviewerRemoval, deleteReviewer};
