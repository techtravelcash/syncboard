# TC-452 · UI-V2-09 · Pessoas, notificações e atenção

## Entrega e limite de validação

Integração de apresentação sobre `fe0c46a2d8efb47e5a7e6f4ab68ab058cd684d18` (TC-451), preservando Home, Quadro, Lista, tarefa, colaboração e Arquivados. O candidato isolado original partiu de `e64a1a3bd3b89a4a64aff77c551dd80f256215bc`; os resultados históricos não substituem os testes da integração atual. A implantação técnica autorizada e a homologação humana são passos separados.

A entrega está pronta para revisão de código e integração sequencial. A validação visual em navegador continua bloqueada no ambiente informado; nenhuma tentativa alternativa foi feita. Não há screenshot do produto nem alegação de homologação visual, tema escuro aprovado ou conformidade integral de acessibilidade.

## O que mudou

- Utilizadores: cabeçalho, busca rotulada, lista responsiva, nome e email completos, cargo identificado por texto, identificação de administrador separada dos estados de tarefa, ações Editar/Remover acesso e contagem com o mesmo algoritmo existente.
- Formulário administrativo: mesmos IDs, campos obrigatórios, checkbox e formulário; labels explícitos, fechar com nome acessível e Cancelar usando o mesmo callback já existente. Nenhuma regra de permissão foi criada ou ampliada.
- Perfil: mesmos dados e resolução de identidade; imagem decorativa ou inicial derivada do nome disponível. Utilizadores sem fotografia não recebem uma imagem remota genérica. Nome ausente no card usa o email fornecido; se ambos faltam, informa a ausência.
- Notificações: estados textuais Lida/Não lida, evento e referência da tarefa, metadados sem opacidade reduzida, lista longa com rolagem e vazio neutro. Os cards continuam `div[data-notif-id]`; Enter/Espaço encaminham ao mesmo clique. O token `opacity-60` continua sendo o marcador lógico existente de notificação lida, embora o CSS mantenha o texto legível.
- Sinalização: checkboxes nativos, nomes completos, indicador Principal e área de rolagem para muitos responsáveis. A seleção padrão e os valores enviados permanecem iguais. Texto de exibição e valor de máquina são tratados separadamente; nomes inválidos não viram emails inferidos.
- Atenção Solicitada: faixa e ícone estáticos, nome completo do remetente fornecido, tarefa sem truncamento, ação existente claramente descrita e mesma contagem/fila. Reconhecer abre a tarefa; não conclui, não cria snooze e não altera progresso.
- Estilos: somente `people-v2.css`, depois do CSS legado, tokens Fluxo v2, shell e compatibilidade atual. Botões ordinários cobalto; remoção vermelha. Plus Jakarta Sans por token. Cores escuras são compatibilidade a validar.

## Contratos preservados

`api.js`, `state.js`, `signalr.js`, `shell-v2.js`, rotas, backend, workflows, assets v2 e CSS existentes estão intactos. O gate compara 91 arquivos protegidos com a revisão-base.

`main.js` permanece idêntico após normalizar apenas quatro mudanças de apresentação: import/helper de avatar, markup de avatar, markup de destinatários e nome completo do remetente. Checagens de autenticação, visibilidade administrativa, callbacks, payloads, reconhecimento de identidade, deduplicação de eventos e operações da fila não mudam.

Fora de `renderUserManagementView` e `updateNotificationBadge`, `ui.js` só recebe o import dos renderizadores de apresentação. Os callbacks originais de busca, contagem de notificações e clique/marcar lida/abrir tarefa são comparados literalmente. Todos os IDs HTML anteriores permanecem; campos e `data-*` usados pelos handlers são preservados.

## Evidências executadas

Todos os comandos abaixo passaram no candidato isolado. São checks de fonte e fixtures, sem rede, sessão ou banco real.

| Check | Evidência |
| --- | --- |
| `python tests/check_people_v2.py --baseline-repo /path/to/checkout` | IDs, labels, atributos, 91 arquivos protegidos, callbacks preservados, escopo CSS e sintaxe de todos os módulos |
| `node tests/check_people_v2.mjs` | Renderizadores e callbacks reais executados em DOM/API sintéticos |
| `python tests/check_ui_v2.py --foundation-only` | Manifesto de assets v2, tokens/contrastes selecionados, isolamento do piloto, sintaxe |
| `python tests/check_login_assets.py` | Assets de login e contrato existente |
| `python tests/check_shell_v2.py --isolation-only` | Prévia isolada do shell |
| `node tests/check_startup_v2.mjs` | Inicialização, sessão/role negada e falhas em callbacks sintéticos |
| `node tests/check_home_focus_v2.mjs` | Callback existente de retorno de foco em fixtures |

Os resultados JSON acompanham o pacote de entrega. Os gates históricos de snapshot exclusivo TC-445/TC-446 não foram tratados como agregador desta mudança: por definição eles proíbem alterações legítimas fora do escopo antigo. A integração final deve aplicar o gate atualizado da trilha e repetir as verificações depois de resolver conflitos.

### Cobertura das fixtures TC-452

- Nome/email/cargo extensos, caracteres literais, administrador e membro, foto presente/ausente, identificação não informada e valores de máquina `undefined`, `null`, vazio e zero.
- Lista de utilizadores vazia; exclusão de DEFINIR; ordenação; contagem de tarefas ativas incluindo publicação e excluindo arquivo; busca, nenhum resultado e limpeza; sem mutação dos dados.
- Editar, cancelar sem gravação, novo formulário limpo e payload de atualização exato, sempre em API mock.
- Zero/40 notificações; badge `9+`; lida/não lida; tarefa presente ou ausente/arquivada fora do conjunto carregado; leitura/navegação; Enter/Espaço; cliques repetidos.
- Abrir/fechar notificações, backdrop e reprodução da limitação existente de fechar/reabrir rapidamente.
- HTTP não-OK retornando lista vazia e rejeição de rede reproduzidos no adaptador existente.
- 20 destinatários; principal padrão; seleção explícita; nenhum selecionado; Cancelar; abrir repetidamente sem acumular callback de confirmação; erro e restauração do botão; valores enviados idênticos ao contrato existente.
- Fila de atenção; reconhecimento por email/nome conforme o código original; evento repetido sem duplicar item; nome completo; falha de dispensa/repetição; clique desabilitado durante a operação; reinício do segundo alerta; nenhuma mudança nos objetos de tarefa.

## Pendências e vínculos funcionais

| Situação | Resultado desta tarefa | Vínculo |
| --- | --- | --- |
| `fetchNotifications()` retorna `[]` para HTTP não-OK | Reproduzido e preservado; a UI não consegue distinguir vazio de falha HTTP. O vazio tem texto neutro e não declara sucesso. | PF-34 / TC-418 |
| Rejeição de rede ao consultar notificações | Reproduzida; não há novo contrato de erro/retry. Carregamento/atualização não é declarado completo. | PF-34 / TC-418 |
| Clique repetido em notificação não lida | Mantém chamadas repetidas de marcar como lida, sem deduplicação nova. | PF-34 / TC-418, PF-58 / TC-442 |
| Fechar e reabrir notificações antes do timer de 300 ms | Reproduzido: timer antigo pode esconder o modal reaberto. Não corrigido nesta recomposição visual. | PF-58 / TC-442 |
| Perfil com foto do provedor | Chamada silenciosa existente `updateUserPhoto` preservada e apenas simulada nos testes. Nenhuma foto real atualizada. | PF-33 / TC-417 |
| URL de foto inválida ou indisponível | Sem validação nova de URL; apenas ausência de foto foi coberta como fallback. | PF-33 / TC-417 |
| Submit administrativo com falha | Comportamento anterior permanece, incluindo botão desabilitado após o catch. Não há nova política de retry. | PF-31 / TC-415, PF-58 / TC-442 |
| Modal sem gestão completa de foco/escape | Dialogs recebem nome/descrição; não se declara `aria-modal` nem se cria um focus trap incompleto. Teste real de foco pendente. | PF-58 / TC-442 |
| Identidade, papéis e autorização de backend | Não alterados e não comprovados por ocultação de botões ou mocks. | PF-30/31/32 / TC-414/415/416 |
| Entrega de sinalização e dispensa real | Não executadas. Seleção, payloads e fila somente em fixtures. | PF-35/36 / TC-419/420 |

## Matriz de validação humana restante

| Superfície | Fonte/fixture | Desktop/mobile, toque, zoom 200%, foco e pixels |
| --- | --- | --- |
| Utilizadores, busca, cards, formulário | Passou nos limites descritos | Não executado; revisar 320, 375, 768, 1024 e 1440 px |
| Perfil e foto ausente | Passou em fixtures admin/membro | Não executado; conferir nomes extensos e foto indisponível |
| Badge/lista/modal de notificações | Passou; limitações de erro/repetição reproduzidas | Não executado; verificar rolagem, foco e retorno |
| Seleção de destinatários | Passou com 20 pessoas sintéticas | Não executado; teclado, toque e seleção visível |
| Atenção/fila de alertas | Passou em callbacks sintéticos | Não executado; conferir sem animação e janela curta |
| Tema escuro | Tokens de compatibilidade e escopo inspecionados | Não homologado |

Não existem resultados visuais em navegador autorizado para este candidato. Essa pendência deve continuar explícita em UI-V2-10 / TC-453.

## Integração e reversão planejadas

1. Aplicar o patch apenas no checkout de integração escolhido pelo responsável. Não copiar o diretório inteiro nem sobrescrever os avanços TC-446–451.
2. Resolver os hunks de `index.html`, imports/trechos de `ui.js` e `main.js` preservando as entregas anteriores. O CSS e helper novos são isolados; não sobrepõem estilos de comentários/histórico/editor da TC-450.
3. O marcador global de release e eventuais estratégias de cache ficam sob controle do integrador. Este patch adiciona apenas `people-v2.css?v=tc452-people-1`; não muda o release global da cópia-base.
4. Rodar novamente fixtures, fronteiras e regressões no conjunto final. O teste de fonte TC-452 é propositalmente contra a base isolada; se outras tarefas já estiverem integradas, reconciliar as comparações com a base de integração sem enfraquecer os contratos de pessoas/alertas.
5. Realizar o QA visual pendente e encaminhar a validação humana ao proprietário e a Elmo, o homologador indicado. A implantação técnica segue a autorização vigente já verificada pelo integrador; ela não equivale à aprovação humana da tarefa, à movimentação para Publicação ou à conclusão. Este relatório não concede autorização adicional.
6. Rollback local pretendido: desfazer apenas os hunks TC-452 no checkout de integração (`git apply --reverse` do patch, se aplicável sem conflito), remover o link/imports novos e os dois arquivos novos de runtime. Preservar correções concorrentes. Confirmar hashes/handlers anteriores e repetir os gates. Se houver conflito, revisão manual dos hunks; nunca restaurar todo o app da revisão-base.
7. Rollback de produção: não aplicável a este candidato isolado não publicado. Se o integrador realizar uma implantação técnica dentro da autorização vigente do proprietário, coordenar o retorno pela trilha PF-54/55 / TC-438/439; o aceite humano da tarefa continua separado.

## Integração, verificação e retorno

Marcador `tc452-people-1`. Foram preservados os140 IDs anteriores, com cinco novos títulos/ajudas. O gate do shell permite explicitamente esses rótulos, type=button em fechar/receber e a remoção de um ícone decorativo; mantém os callbacks e payloads exatos. Texto de email, fila e prévia usa14px, alinhado à escala v2.

Criar/verificar `rollback/ui-v2-people-baseline-20261007` no parent exato antes de ativar. Publicar um commit atômico com expected-head lease, conferir Azure para o mesmo SHA e fazer o QA disponível sem escrita artificial em contas ou alertas. Retorno por novo commit de reversão, nunca reset/force-push; preservar trabalho posterior não relacionado. Entrega em Homologação para Elmo com limitações explícitas.

## Recuperação de inicialização: claims de foto ausentes

Após o QA inicial da revisão5c, duas recargas reais falharam em `updateUserProfileUI`, linha109: `claims.find` tentou ler uma coleção ausente. A consulta de diretório fica em outra linha; a leitura sem guarda de claims já existia no baseline92159. A recuperação trata somente claims opcionais de foto: coleção ausente/nula/não-array ou entradas sem tipo usam a inicial já prevista. Claims válidos mantêm ambos os tipos suportados e a chamada de foto anterior. Sessão, roles, diretório, API, rotas e autorização não foram relaxados.

`node tests/check_profile_claims_recovery.mjs` executa o bootstrap real com o renderer real do perfil, cobrindo metadados ausentes/malformados, fotos válidas e falhas obrigatórias preservadas. Marcador de recuperação: `tc452-people-2`. A disponibilidade ao vivo deve ser revalidada antes de republicar o relatório; os resultados da revisão anterior continuam históricos. Referência do provedor: https://learn.microsoft.com/en-us/azure/static-web-apps/user-information .
