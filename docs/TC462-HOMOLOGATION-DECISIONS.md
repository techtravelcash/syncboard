# TC462 — Aprovar ou reprovar na homologação

## Entrega para revisão de Carlos

Esta alteração é entregue exclusivamente por PR em rascunho. Não autoriza merge,
aprovação da tarefa, publicação ou implantação em produção. Base verificada:
`a72c2a36bbfcb7855daaf3664775b09726c46ef8`. Não inclui os ajustes CSS posteriores da TC459.

## Comportamento

- Em Homologação, o cartão e o detalhe oferecem **Aprovar** e **Reprovar**.
- Aprovar mantém o contrato existente: `status: publication`, `progress: 100`,
  preservando o homologador para a indicação “Homologado por”.
- Reprovar envia `status: inprogress`, `homologador: null`. O progresso informado
  fica inalterado; não se inventa um novo percentual nem motivo obrigatório.
  Limpar o homologador acompanha a regra existente do arraste de saída da homologação.
- Fora de Homologação, nenhuma das duas decisões está disponível. O controlador
  também verifica o status em memória antes de enviar a solicitação.
- O acesso segue o padrão já existente de Aprovar: usuários `travelcash_user`
  autorizados pelo Static Web Apps. Não foi introduzida uma restrição exclusiva ao
  homologador, que a aplicação atualmente não exige.
- As duas superfícies compartilham um bloqueio por tarefa enquanto a solicitação
  está em curso, incluindo cliques alternados em Aprovar/Reprovar. Falha mantém a
  tarefa inalterada localmente, libera nova tentativa e mostra mensagem de erro.
- A resposta completa da API atualiza a memória (incluindo histórico). Respostas
  tardias não reabrem detalhe fechado/fechando nem substituem outra tarefa aberta.
  O retorno às notificações é preservado.

## API, histórico e escopo

Reutiliza `PUT /api/updateTask/:id`, sem alteração de backend, schema, permissões,
workflow ou migração. A API existente registra “Status alterado para Andamento”,
com timestamp, e emite `taskUpdated` via SignalR. Não cria notificação de nova
homologação ao reprovar. A auditoria atual não registra ator nem um evento separado
“Reprovada”; essa limitação preexistente não foi redesenhada nesta tarefa.

A proteção de cliques é local à sessão; não é controle de concorrência entre
usuários/abas. A API existente não usa ETag/precondição transacional. Não há alegação
de proteção servidor contra duas decisões simultâneas de usuários diferentes.

## Verificação executada

`node tests/check_homologation_decisions.mjs` passou com o controlador e handler
reais em fixtures isoladas: dois destinos/payloads, progresso/histórico, cliques
concorrentes entre ações, erro/nova tentativa, status inválido, tarefa ausente,
fechamento/animação/navegação, histórico da API, SignalR, ausência de notificação
indevida e wiring das duas superfícies.

Também passaram: check_ai_agent_users.mjs, check_archive_actions_v2.mjs,
check_archive_v2.mjs, check_comment_mentions.mjs, check_home_focus_v2.mjs,
check_kanban_flow_v2.mjs, check_kanban_v2.mjs, check_people_v2.mjs,
check_profile_claims_recovery.mjs, check_startup_v2.mjs,
check_task_fidelity_adapter.mjs, check_task_fidelity_flows.mjs,
check_task_space_flows.mjs, check_detail_compat.py e check_login_assets.py.
Todos os módulos app/js/*.js passaram pela verificação sintática do Node;
`git diff --check` passou. Houve revisão independente do diff e das condições
assíncronas, com correções incorporadas.

A suíte histórica completa foi tentada, mas **não está totalmente verde**:
vários scripts dependem de objetos Git históricos ausentes neste checkout
materializado por conteúdo; outros fixam hashes de entregas antigas e rejeitam
mudanças posteriores intencionais. check_fidelity_copy.mjs,
check_fidelity_v2.mjs e check_fidelity_secondary_v2.mjs já falham também na base
inalterada. Os testes TC459 de hashes também rejeitam o CSS desta alteração;
a fixture funcional TC459 passou. Esses limites não foram ocultados nem os testes
históricos enfraquecidos para aceitar o PR.

Não foi feita validação visual/nativa de navegador nem escrita em tarefas reais
para testar as decisões. `npm test` da API é somente um placeholder; não foi usado
como evidência. Não foi iniciado backend Azure local com credenciais de produção.

## Roteiro de homologação em ambiente isolado

1. Usar tarefa descartável/fixture em Homologação com homologador e progresso 63%.
2. Conferir Aprovar/Reprovar em cartão e detalhe, teclado, rótulos, temas claro/escuro,
   largura pequena e ausência das ações nas demais etapas.
3. Reprovar pelo cartão: vai para Andamento, conserva 63%, limpa homologador,
   registra histórico e atualiza os demais clientes por SignalR.
4. Repetir no detalhe com nova fixture; confirmar que o detalhe acompanha a etapa.
5. Aprovar uma nova fixture: vai para Publicação, progresso 100%, homologador mantido.
6. Atrasar a rede; clicar repetidamente e alternar ações: apenas uma solicitação por
   tarefa/sessão. Durante espera, fechar (incluindo animação), navegar a outra tarefa
   ou abrir pelas notificações: nenhuma resposta deve reabrir/substituir o contexto.
7. Simular erro: etapa/progresso/histórico local não mudam; mensagem visível;
   botões liberados; nova tentativa funciona.
8. Recarregar e conferir persistência. Não executar este roteiro em tarefas reais
   nem supor que o preview de frontend usa uma base de dados isolada.

## Implantação e rollback

O workflow existente de PR pode criar preview Azure; isso não representa produção.
Não foi alterado. A produção somente deve receber esta alteração após code review,
homologação e autorização específica. Para rollback após eventual merge autorizado,
reverter o commit do PR restaura a UI/controlador anteriores; não há migração de
banco. O rollback de código não desfaz transições já realizadas em tarefas.
