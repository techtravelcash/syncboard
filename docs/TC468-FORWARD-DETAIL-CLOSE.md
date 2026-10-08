# TC468 — Fechar detalhe após encaminhar tarefa

## Correção

O encaminhamento confirmado pelo servidor fecha o seletor de responsável e então o detalhe de origem. O foco retorna ao controle visível da tarefa ou ao quadro quando a tarefa ficou filtrada. A resposta pendente não fecha outro detalhe aberto nesse intervalo. Erro, resposta sem a etapa esperada, cancelamento e Escape preservam o detalhe para correção/repetição explícita.

Não há alteração de API, permissão, contrato de encaminhamento ou gravação adicional. O botão Continuar da aprovação (TC466) mantém seu comportamento.

## Verificação em 8 de outubro de 2026

- Base exata: `720dff5cde0dcf1af024e132996649733d20a8c7`; 214 arquivos conferidos pelos hashes de blob remotos.
- Teste novo `node tests/check_forward_detail_close.mjs`: callbacks reais do cartão/detalhe, controlador, diálogo e fechamento; sucesso aguardado, duplicidade, erro, estado incorreto, cancelar/Escape, navegação tardia, fallback de foco e falha cosmética após persistência.
- 25 verificações executáveis passaram; 45 arquivos JavaScript passaram na análise sintática; `git diff --check` limpo.
- Das 55 verificações históricas executadas, 30 falharam por contratos antigos/pins de arquivos e referências históricas indisponíveis. As mesmas 30 falharam na base exata sem alterações (54 verificações); nenhuma mudança de resultado nas verificações preexistentes. Isso não equivale a aprovação integral da suíte histórica.
- Revisão independente sem bloqueadores; sete suítes focadas passaram, incluindo homologação/API e aprovação/Continuar.
- Os testes usam servidor/DOM simulados e não provam foco nativo. A conferência visual de produção será somente leitura, sem encaminhar tarefas reais apenas para teste. Homologação do fluxo real cabe a Felipe.

## Publicação e retorno

Publicação autorizada pelo usuário para esta correção em 8 de outubro. Atualização de main condicionada ao head esperado, com referência prévia `rollback/tc468-prepublish-720dff5c`. Reversão não destrutiva ensaiada para restaurar integralmente a árvore da base. Não há migração; rollback do código não desfaz encaminhamentos já realizados.
