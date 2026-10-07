const { CosmosClient } = require("@azure/cosmos");
const container = new CosmosClient(process.env.CosmosDB).database("TasksDB").container("Tasks");

module.exports = async function (context, req, inputDocument) {
    if (!inputDocument) {
        context.res = { status: 404, body: "Tarefa não encontrada." };
        return;
    }

    const commentId = context.bindingData.commentId;
    const { text, author } = req.body;

    if (!inputDocument.comments || !Array.isArray(inputDocument.comments)) {
        context.res = { status: 404, body: "Comentário não encontrado." };
        return;
    }

    let commentIndex = inputDocument.comments.findIndex(c => c.id === commentId);

    if (commentIndex === -1) {
        const parsedIndex = Number.parseInt(commentId, 10);
        if (Number.isInteger(parsedIndex) && parsedIndex >= 0 && parsedIndex < inputDocument.comments.length) {
            commentIndex = parsedIndex;
        }
    }

    if (commentIndex === -1) {
        context.res = { status: 404, body: "Comentário não encontrado." };
        return;
    }

    const comment = inputDocument.comments[commentIndex];
    const commentAuthorEmail = typeof comment.author === 'object' ? (comment.author?.email || '') : '';
    const commentAuthorName = typeof comment.author === 'object' ? (comment.author?.name || '') : (comment.author || '');
    const normalizedAuthor = (author || '').toString().toLowerCase();

    const canEdit = [commentAuthorEmail, commentAuthorName]
        .filter(Boolean)
        .map(v => v.toString().toLowerCase())
        .includes(normalizedAuthor);

    if (!canEdit) {
        context.res = { status: 403, body: "Sem permissão para editar este comentário." };
        return;
    }

    comment.text = text;
    comment.editedAt = new Date().toISOString();

    let replaced;
    try {
        if (!inputDocument._etag) throw new Error('ETag ausente na tarefa lida.');
        ({resource: replaced} = await container.item(inputDocument.id, inputDocument.id).replace(inputDocument, {
            accessCondition: {type: 'IfMatch', condition: inputDocument._etag}
        }));
    } catch (error) {
        const conflict = Number(error.code || error.statusCode) === 412;
        context.res = {status: conflict ? 409 : 500, body: conflict ? 'A tarefa foi alterada. Atualize e tente novamente.' : 'Erro ao editar comentário.'};
        return;
    }

    context.bindings.signalRMessage = {
        target: 'taskUpdated',
        arguments: [replaced]
    };

    context.res = { body: replaced };
};
