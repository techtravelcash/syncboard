# TC-459 — Identificação de agentes IA

Campo aditivo `isAiAgent` no perfil Cosmos DB Users. O checkbox «Agente IA» fica no mesmo formulário usado para criar/editar usuários e o cartão do usuário exibe o selo quando o valor é estritamente `true`.

- Independente de `isAdmin`, cargos e funções de autenticação.
- Perfis antigos e novas inclusões sem o campo são tratados como não agentes.
- Edição explícita permite marcar/desmarcar. Clientes antigos que omitem o campo preservam a identificação existente, inclusive ao trocar o email.
- Acesso aos endpoints continua restrito a administradores.
- Nenhuma migração, classificação automática ou alteração de perfis reais.

## Verificação

`python tests/check_ai_agent_users.py`

Gate com hashes de escopo contra main `8544fc5f7b9ed5a7d23948096c78b1e325f7bc33`, sintaxe de todo JavaScript frontend/API e testes em memória dos endpoints reais: criação, 60 combinações de atualização, omissão, desmarcação, mudança de email, bloqueio de não administradores e independência dos privilégios. Testes dos callbacks reais cobrem edição de legado/agente, cancelar sem gravar, reabrir, reset de novo cadastro e payload de criação/edição. Inclui regressões de menções, perfil, inicialização e fluxo de tarefas.

A suíte não grava usuários de produção. Persistência real, SSO e inspeção visual são verificações separadas. Gates históricos de composição congelam versões anteriores e não são declarados aprovados para esta alteração intencional. Revisão independente não encontrou regressão introduzida.

## Publicação e retorno

Publicar como commit único com lease do HEAD esperado. Guardar referência de rollback no commit anterior. Reversão, caso autorizada, deve preservar qualquer mudança posterior e manter dados existentes: o campo aditivo pode ficar armazenado sem interferir em clientes anteriores.

Entrega sujeita à homologação de Felipe Igansi. Aprovação e conclusão continuam humanas.
