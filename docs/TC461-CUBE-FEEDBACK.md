# TC-461 — Aplicação do cubo aprovado

Base: b9c3080bbd71ebbd2d61fa7ddbee714bbe8a8587. Branch independente da TC-462; não contém REPROVAR nem suas alterações de decisão.

## Aplicação
- Login desktop: cubo GIF aprovado de seis segundos; controle de pausar/retomar.
- Inicialização da aplicação e consulta de Arquivados: animação durante o carregamento real, sem atrasar navegação para completar o GIF.
- Notificações: indicador inicial existente enquanto a primeira consulta está pendente. Atualizações de notificações conservam os dados visíveis.
- Aprovação no card ou nos detalhes: confirmação visual somente após resposta do servidor com status Publicação. Não significa tarefa publicada/concluída. Cliques concorrentes na mesma tarefa não repetem a escrita.
- Preferência de movimento reduzido usa PNG estático; confirmação tem Continuar/Escape e retorno de foco nativo.
- Não há animação artificial em trocas de páginas que reutilizam dados já carregados.

## Validação
Executar `python tests/check_cube_loading.py`: dez testes de runtime atuais, contratos de assets e login público, sintaxe JS, checks de escopo. Revisão independente adicional. Testes antigos dependentes de commits históricos não disponíveis neste checkout não equivalem a uma passagem geral de toda a suíte. QA nativa e CI de publicação são verificações separadas. Nenhuma aprovação real de tarefa é necessária para verificar a interface com mocks.

## Publicação e reversão
Publicar atomicamente o commit TC-461 revisado na branch própria e então main usando expected_sha da base verificada; não mesclar PR #10. Conferir CI do SHA exato. Se necessário, reverter somente o commit TC-461 mediante coordenação, preservando alterações posteriores. Não marcar tarefa Aprovada/Concluída; homologador Felipe valida a entrega.
