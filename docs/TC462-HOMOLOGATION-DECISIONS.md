# TC462 — decisões de homologação para revisão de Carlos

## Entrega e base

Pacote no **PR #10 em rascunho**, sem merge ou publicação em produção. Integra a
base main `c8183c899ce0ab5cbfefecd54c3745f448d1567f` (TC459, TC461 e TC463–TC466
preservadas). O GIF de aprovação da TC461 já pertence à base e não é republicado
como uma entrega independente por este PR.

Carlos é o responsável pelo code review e pela homologação. O encaminhamento
anterior pela conta Tech permanece registrado no PR. Como Tech é autora do PR,
ela não oferece aprovação independente do próprio PR; nenhum review formal é
simulado e nenhuma aprovação/merge será feita em nome de Carlos.

## Comportamento solicitado

Em **Homologação**, no cartão e no detalhe:

- **Aprovar**: vai para **Publicação**, progresso 100%, mantém o homologador para
  a indicação “Homologado por”. Preserva o GIF de confirmação TC461 somente
  depois da resposta do servidor confirmar Publicação.
- **Reprovar**: volta para **Andamento**, preserva progresso e limpa homologador.
- **Encaminhar**: abre seleção de um usuário cadastrado. Confirmar substitui toda
  a lista de responsáveis por esse único novo responsável, volta para **Fila**,
  preserva progresso e limpa homologador. Não mantém corresponsáveis anteriores.
- Os três botões aparecem **somente para o homologador atribuído**, por e-mail
  normalizado. Ser responsável, admin ou ter nome parecido não concede acesso.
  Tarefa sem homologador/e-mail válido não oferece as decisões.
- **Chamar responsáveis** fica oculto em Homologação para todos; seu handler
  também impede abertura nessa etapa. Nas outras etapas o comportamento continua.

A seleção de Encaminhar pode ser o próprio homologador se cadastrado. O responsável
único atual, quando identificado por e-mail, não é oferecido como uma troca sem
efeito. Nomes legados não são convertidos em identidades por adivinhação. Se havia
vários responsáveis, selecionar um deles é permitido porque a lista será substituída.
Cancelar não escreve nada. Durante envio, seleção/botões ficam bloqueados; Escape
não cancela uma gravação já enviada. Falha mantém a seleção para tentativa explícita.
Nenhum motivo obrigatório novo foi criado.

## Permissão e contrato da API

`PUT /api/updateTask/:id` recebe:

- `homologationAction`: `approve`, `reject` ou `forward`
- `expectedStatus`: `homologation`
- `expectedEtag`: `_etag` da tarefa exibida
- `newResponsibleEmail`: apenas para Encaminhar

O servidor constrói o payload final; não aceita destino, progresso, lista de
responsáveis ou ator fornecidos pelo cliente como decisão. Busca o novo responsável
no cadastro e usa os dados canônicos desse perfil. A identidade vem do principal
injetado pelo Azure Static Web Apps, exigindo `travelcash_user` e o mesmo e-mail
do homologador atual; não há exceção para admin. Sem identidade retorna 401,
sem autorização 403, seleção inválida 400 e versão/etapa divergente 409.

O limite de confiança continua sendo o ingresso autenticado do SWA. Não se afirma
que todos os endpoints da aplicação foram redesenhados ou endurecidos; o PR
protege as decisões e as gravações concorrentes que poderiam desfazê-las.

## Integridade e concorrência

- Uma decisão em curso por tarefa/sessão, compartilhada entre cartão/detalhe.
- `expectedEtag` impede decisão sobre uma versão antiga, inclusive se a tarefa
  saiu e depois voltou para Homologação. `IfMatch` no Cosmos rejeita concorrência
  entre a leitura e a escrita.
- Atualização genérica não pode tirar a tarefa de Homologação nem trocar seu
  homologador, progresso ou responsáveis, evitando contornar os três fluxos.
  Outros campos continuam editáveis. Arraste de saída, seletor de etapa e edição
  direta de responsáveis/progresso orientam o usuário a usar a decisão apropriada.
- Histórico e metadados de identidade/Cosmos são controlados pelo servidor.
  Cada decisão registra ação, ator, etapa e, ao encaminhar, o novo responsável.
  Dados apresentados no histórico são escapados.
- Comentários e alertas também substituíam a tarefa inteira e podiam restaurar
  uma versão antiga após uma decisão. Por isso addComment, editComment,
  deleteComment, signalResponsible e dismissAlert agora usam `IfMatch` e retornam
  409 em conflito, sem repetir a gravação automaticamente. editComment deixou de
  usar a saída Cosmos incondicional; mantém leitura e usa substituição condicional.
  Notificações de menção são criadas somente depois da gravação do comentário.
- Em 409 da decisão, o cliente busca dados atuais e pede nova conferência; se a
  leitura falhar, orienta recarregar. Nunca repete uma decisão por conta própria.
- Resposta tardia não reabre detalhe fechado/fechando ou troca outra tarefa aberta.
  O contexto de retorno às notificações é preservado.

SignalR, Discord e notificações continuam best-effort. Se a gravação efetivar e
sua resposta se perder, a repetição falha por versão e não duplica o histórico;
a entrega dos eventos externos não é exatamente uma vez. Os writers de Users e
as operações de Patch em campos específicos não foram alterados.

## Validação executada

Testes isolados, sem acesso a Cosmos/Discord nem transição em tarefa real:

- `check_homologation_api.mjs`: decisões canônicas, identidade/role, usuário errado,
  admin sem exceção, homologador ausente, spoofing, forward cadastrado/próprio,
  rejeição de troca sem efeito, bypass genérico, auditoria escapada, ETag/ABA,
  decisões concorrentes, falha/resposta perdida/repetição e cinco writers concorrentes.
- `check_homologation_decisions.mjs`: contratos dos três destinos, permissões,
  bloqueio compartilhado, erro/repetição, refresh de conflito sem novo write,
  navegação/fechamento e GIF apenas após aprovação confirmada.
- `check_homologation_forward_dialog.mjs`: callbacks reais de seleção, Cancelar,
  ausência de seleção, tentativa repetida, erro mantendo seleção, Escape durante
  envio, reabertura e fallback de diálogo indisponível.
- Regressões adaptadas ao novo contrato: `check_approval_feedback_callbacks.mjs`,
  `check_kanban_v2.mjs` e `check_kanban_flow_v2.mjs`. Mantêm verificações de GIF,
  renderização, erro após gravação, permissão dos botões e drag sem bypass.
- Checks atuais de contexto/menu TC463/TC464, filtro de usuário TC465, Continuar TC466, usuários, comentários/menções,
  arquivo, home/foco, startup, detalhe e fluxo de tarefas foram reexecutados.
- 24 verificações focadas passaram. Sintaxe dos módulos/handlers alterados e `git diff --check` passaram.

A suíte histórica completa foi tentada e **não está totalmente verde**. Há scripts
que exigem objetos Git históricos não presentes no checkout materializado e
contratos de hashes de entregas antigas que rejeitam mudanças posteriores
intencionais, incluindo o backend desta tarefa. Não foram removidos nem
reescritos esses contratos globais para simular um passe. `npm test` da API é
placeholder e não é usado como evidência.

Revisão independente foi feita e os riscos de concorrência encontrados foram
tratados. Fixtures não substituem validação visual/nativa. Não foi alegado teste
de navegador, SSO ou escrita em produção.

## Roteiro de homologação isolada

1. Criar fixtures com homologador A, usuário B, admin C e tarefa sem homologador.
   Só A vê Aprovar/Reprovar/Encaminhar; nenhum usuário vê Chamar responsáveis em
   Homologação. Verificar cartão, detalhe, temas e largura pequena.
2. Aprovar com A: Publicação, 100%, homologador mantido, histórico e GIF TC461;
   isso não é publicar/concluir a tarefa.
3. Reprovar outra fixture: Andamento, progresso preservado e homologador limpo.
4. Encaminhar: seleção explícita, cancelamento sem write; confirmar novo usuário
   troca toda lista e volta à Fila. Testar o próprio A quando elegível e impedir
   o antigo responsável único sem efeito.
5. Atrasar rede, repetir/alternar cliques e abrir os dois locais: um envio. Simular
   falha e refazer explicitamente; mudar etapa/versão em outro cliente: 409 e dados
   atualizados. Fechar/navegar durante resposta não deve reabrir o detalhe.
6. Concorrer comentário/edição/exclusão/alerta com decisão: a gravação antiga deve
   ser rejeitada, sem restaurar etapa ou apagar auditoria nova.
7. Tentar decisão pela API com usuário errado, admin não designado, body forjado,
   ETag antigo e homologador ausente: nenhuma gravação. Não fazer isso em tarefas reais.
8. Verificar persistência, SignalR, teclado/foco, Escape, textos e seleção em
   navegador. Preview não implica banco isolado; confirmar isolamento antes de gravar.

## Rollback e publicação

O workflow existente pode gerar preview Azure para o PR. Isso não autoriza
produção. Merge/publicação permanecem dependentes de Carlos e autorização.
Rollback de código após eventual merge autorizado é revert do pacote; não há
migração de banco. Reverter código não desfaz decisões já realizadas. A retirada
das proteções condicionais deve ser avaliada como retirada de proteção contra
concorrência, e não apenas troca visual.
