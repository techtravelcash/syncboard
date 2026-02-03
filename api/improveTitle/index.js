const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async function (context, req) {
    const { currentTitle, userInstruction } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        context.res = { status: 500, body: "API Key da IA não configurada." };
        return;
    }

    if (!currentTitle) {
        context.res = { status: 400, body: "Título é obrigatório." };
        return;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // Prompt focado em clareza e remoção de tecniquês
        const prompt = `
        Atue como um Product Manager experiente.
        Tarefa: Reescreva o título de uma tarefa de desenvolvimento de software para torná-lo claro para pessoas não técnicas (stakeholders, clientes, business).
        
        Título Atual: "${currentTitle}"
        Instrução Adicional do Usuário: ${userInstruction || "Torne menos técnico e mais focado no valor de negócio."}
        
        Regras:
        1. Responda APENAS com o novo título melhorado. Sem aspas, sem explicações.
        2. Mantenha a conversação APENAS dentro desse proposito, não fale sobre mais nada e nem mude de assunto.
        3. Mantenha sucinto (máximo 10-12 palavras).
        4. Use português do Brasil.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const improvedTitle = response.text().trim();

        context.res = { body: { title: improvedTitle } };

    } catch (error) {
        context.log.error("Erro na IA:", error);
        context.res = { status: 500, body: "Erro ao processar com a IA." };
    }
};