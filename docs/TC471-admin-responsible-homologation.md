# TC-471 · Alterar responsáveis em Homologação

Base verificada: `main` em `69636c8b48dcbc17e83c28535269990ef85e6d93`, árvore `a4c65d030a8dab4950662cc6eab13a9a634c67a2`.

## Contrato

- O formulário permite editar responsáveis em Homologação somente com identidade válida e roles `travelcash_user` + `admin`.
- A API também confirma `isAdmin === true` no perfil atual do ator no cadastro Users. Roles antigas não conservam a permissão após revogação no cadastro.
- A seleção usa e-mail, aceita um ou mais responsáveis cadastrados e rejeita vazio, e-mail inválido, duplicação ou perfil inexistente. Nome e foto são lidos do cadastro; objetos enviados pelo cliente não são confiados.
- O PUT envia somente diferenças do formulário, `expectedStatus: homologation` e o ETag capturado na abertura. Os valores padrão exibidos não sobrescrevem campos omitidos do registro.
- A API preserva fase, homologador, progresso e todos os demais campos não enviados, conserva histórico anterior e adiciona auditoria com ator e novos responsáveis. A persistência usa `IfMatch`.
- Aprovar, Reprovar e Encaminhar continuam exclusivos do homologador designado. Administração não concede esses poderes. Não há fase temporária nem migração de dados.
- Conflito exige cancelar e reabrir a edição. Não há retry automático. Cancelamento antes de envio não grava; resposta tardia não fecha outra edição nem sobrescreve atualização mais nova recebida por SignalR.
- Anexos removidos do formulário só são excluídos depois do PUT bem-sucedido; erro de upload interrompe o salvamento. Isso evita perda em caso de conflito.

## Verificação local

- `node tests/check_admin_homologation_responsible_api.mjs`
- `node tests/check_admin_homologation_responsible_ui.mjs`
- Ambos passaram: admin/não admin, homologador, perfil revogado, perfis canônicos, múltiplos responsáveis, inválidos, estados incorretos, campos protegidos, ETag obsoleto, corridas entre reassociação e decisão, erro/retry explícito, resposta perdida, histórico e efeitos externos, cancelamento e navegação/resposta tardia.
- Suíte completa: candidato 27 testes aprovados e 30 falhas; base exata 25 aprovados e as mesmas 30 falhas. Os 2 novos testes passam; nenhuma regressão diferencial. O fixture legado de formulário foi adaptado para carregar o helper real e fornecer retorno realista da API.
- Sintaxe dos 45 arquivos JavaScript da aplicação/API e `git diff --check` aprovados.
- Testes usam mocks isolados de Cosmos, identidade, DOM e APIs. Tentativa de smoke em Chromium headless local bloqueada antes de abrir a página: socket interno retornou `Operation not permitted`, inclusive após tentativa escalada. Navegador real, Azure e produção ainda não verificados. O `npm test` da API é apenas um placeholder; não representa aceitação adicional.

## Validação e rollback

Publicação depende de autorização. O workflow existente dispara deploy ao publicar em main e também em PR; este trabalho não criou branch remota, PR ou deploy.

Após publicação autorizada, Felipe deve validar uma tarefa de teste: Cashia administra e troca responsável sem alterar Homologação/homologador/progresso; recarregar confirma persistência; não admin continua bloqueado; homologador conserva decisões. Reatribuição das 12 tarefas reais é uma ação separada.

Rollback de código: reverter apenas o commit de TC-471. O patch inverso foi ensaiado localmente e deve restaurar exatamente a árvore base acima. Se main avançar, revisar o revert sem descartar mudanças posteriores. Rollback de código não reverte reatribuições já persistidas nem apaga auditoria. Não executar restauração de dados sem autorização específica.
