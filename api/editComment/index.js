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

    context.bindings.outputDocument = inputDocument;

    context.bindings.signalRMessage = {
        target: 'taskUpdated',
        arguments: [inputDocument]
    };

    context.res = { body: inputDocument };
};
