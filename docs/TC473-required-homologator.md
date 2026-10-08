# TC473 — Homologador obrigatório e recuperação restrita

## Escopo e entrega

Base remota verificada: `69636c8b48dcbc17e83c28535269990ef85e6d93`. Depende do pacote TC471 (reassociação de responsáveis por administrador); TC473 é delta separado. Nenhum push, PR, publicação, migração ou alteração de tarefa real realizado por este pacote.

- Drag e edição solicitam e-mail cadastrado antes de entrar em Homologação. Cancelar/Escape não grava; tarefa local muda após resposta confirmada.
- API exige homologador existente, etapa esperada e ETag. Cada entrada tem seleção explícita; nome/foto vêm do cadastro.
- Criação permanece em Fila. Criação em outra etapa é rejeitada antes do contador. HTTP/SignalR recebem recurso persistido com ETag para permitir criação seguida de atribuição.
- Recuperação explícita só para tarefa em Homologação com homologador ausente, inválido ou removido. Exige papel admin autenticado, perfil atual isAdmin=true e ETag; aceita apenas atribuição. Não troca homologador válido existente.
- Recuperação mantém etapa, responsáveis, progresso, comentários, anexos e histórico anterior. Acrescenta auditoria e notificação ao novo homologador.
- Aprovar/Reprovar/Encaminhar continuam exclusivos do homologador designado e cadastrado. Admin não ganha poder decisório.

## Coordenação de exclusão e atribuição

Usa apenas documentos existentes em Users/Tasks; não cria container, altera consistência da conta ou exige infraestrutura nova. Atribuição/recuperação registra reserva durável no perfil por CAS antes do replace condicional da tarefa. Não existem locks com prazo ou liberação por relógio: execução suspensa não pode atravessar expiração.

A exclusão e a troca de e-mail verificam homologações legadas com query **Strong** explícita, guardam o ETag do perfil e leem todas as tarefas reservadas. Homologação pendente bloqueia exclusão. Para outras etapas, replace condicional do documento inalterado preserva campos e histórico, mas avança ETag, invalidando atribuições pendentes. A exclusão final usa IfMatch do ETag original do perfil: qualquer reserva/edição concorrente faz a exclusão falhar.

Uma leitura Strong com 404 comprova tarefa removida; replace antigo não pode recriá-la. Recurso ausente sem essa prova, conflito ou erro permanece fechado. Interrupção após reserva ou fence é recuperável por repetição explícita; nunca há expiração insegura ou tentativa automática de decidir tarefa.

Todos os escritores de Users foram considerados: login atualiza somente nome/foto por patch aguardado (não upsert); edição mantém lista explícita de campos; foto já usava patch; criação não aceita reservas fornecidas pelo cliente. Troca de e-mail usa a mesma exclusão protegida e recusa perfil alterado entre leituras. Só compensa destino quando 412 prova que a exclusão antiga não ocorreu, e apenas pelo ETag criado. Resposta perdida/resultado incerto preserva destino, nunca apaga ambos; destino alterado concorrentemente também é preservado. O erro pede conferência explícita dos cadastros. Campo isAiAgent omitido não sobrescreve alterações concorrentes.

## Limites operacionais e publicação

- **A consistência real da conta Cosmos não foi verificada neste ambiente.** Se a conta não aceitar Strong, exclusão e troca de e-mail retornarão 409, sem remover usuário. Atribuição e recuperação continuam usando CAS. Não há fallback para leitura mais fraca. Decisão sobre configuração/auditoria de legado é separada; este pacote não altera infraestrutura.
- Strong é solicitado via FeedOptions/RequestOptions do SDK: https://learn.microsoft.com/javascript/api/@azure/cosmos/feedoptions . A conta limita a força permitida: https://learn.microsoft.com/azure/cosmos-db/nosql/how-to-manage-consistency .
- Fences podem tornar um formulário aberto obsoleto. O usuário deve reabrir após conflito; campos não são descartados silenciosamente.
- Reservas são compactadas por tarefa, persistidas sem expiração; toda tentativa avança o ETag do perfil, inclusive retries. Há limite defensivo de tamanho com erro explícito, nunca descarte silencioso de referências. A revisão administrativa de volume é necessária antes de atingir esse limite.
- Garantia vale para escritores da aplicação cobertos pelo protocolo. Escritas diretas externas ao banco não são coordenadas. Publicação deve drenar execuções da versão antiga antes de habilitar gestão de usuários; mistura de escritores antigos não participa da reserva.
- Sem navegador/Cosmos reais nesta verificação. Não apresentar testes isolados como validação de configuração de produção.

## Testes

Suítes executam handlers/controladores reais com Cosmos/DOM simulados, sem dados ou notificações reais. Cobrem entradas vazias/inválidas/removidas, nomes forjados, criação direta, recuperação isolada, preservação, cancelamento, concorrência ETag, reserva/exclusão em ambas ordens, crash/resposta perdida/retry, Strong indisponível, leitura antiga, no-resurrection em login, preservação de reservas, troca de e-mail e compensação.

37 cenários adversariais de coordenação passaram. O manifesto e `test-comparison.json` registram a comparação completa com TC471 (27 passes e 30 falhas históricas), sintaxe e revisão. As falhas históricas não equivalem a aprovação integral da suíte.

## Homologação sugerida

Felipe valida drag, edição, cancelamento, seleção válida, API sem homologador, recuperação de órfã por admin e preservação. Conferir que admin não designado não decide. Gestão de usuários deve informar bloqueio de pendência/Strong, conflito e resultado parcial. TC472/TC473 receberão Felipe somente por operação autorizada separada após publicação.

## Rollback

Reverter apenas delta TC473 devolve código a TC471; campos de reserva já gravados permanecem e não devem ser apagados automaticamente. Sem migração destrutiva. Rollback não desfaz atribuições/auditorias persistidas e remove a nova garantia de concorrência; manter exclusão/troca de e-mail suspensas até revalidar versão segura. Caso ambos sejam publicados juntos, reverter TC473 antes de TC471 ou restaurar por novo commit a árvore pré-publicação. Não usar reset forçado. Aplicação/reversão do patch são ensaiadas em checkout descartável.
