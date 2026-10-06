# SyncboardNT — Fluxo v2 / TC-443

Revisão solicitada para nova homologação. Não altera a interface, os tokens do produto nem arquivos de produção.

## O que mudou
- Símbolo redesenhado como cubo modular isométrico: três faces com nove peças cada, 27 polígonos de face. Conceito genérico de quebra-cabeça; sem nome, logotipo ou repertório multicolorido da marca Rubik.
- Sufixo NT inteiramente desenhado em vetor. O topo do T prolonga a haste direita do N; chanfros e diagonal repetem o ritmo angular do cubo. Nenhum glifo de fonte é usado no NT.
- “Syncboard” mantém a base Liberation Sans Bold convertida em curvas. Todos os logotipos funcionam sem a fonte instalada.
- Versão reduzida do símbolo preserva as três faces e remove a grade, para evitar ruído no favicon.

## Paleta e aplicação
Estrutura e texto #111827; topo lima #D6F46A; face esquerda cobalto #244FDB; face direita neutra #F5F7FA. A face clara é o mesmo neutro já presente na direção Fluxo.

logo-primary-light.svg: texto navy para fundo branco/claro. logo-primary-dark.svg: texto claro para base #111827. Ambos preservam a estrutura navy entre as peças. mark-primary.svg é transparente e próprio para base escura; a mesma geometria tem contorno navy legível no claro. Não usar a versão de texto claro sobre branco. Lima não deve ser usado em texto pequeno sobre branco. As proporções de contraste no arquivo JSON referem-se às cores, não a uma auditoria da interface; o logotipo não é controle funcional.

## Mínimos e área de proteção
- Símbolo completo com grade: mínimo 32 px de largura; recomendado 48 px ou mais.
- Símbolo reduzido / favicon: 16–24 px de largura. Abaixo de 32 px, usar favicon.svg ou mark-small.svg.
- Assinatura horizontal: mínimo proposto de 176 px de largura para a sidebar existente. Abaixo disso, usar apenas o símbolo. Nessa largura, o viewBox do cubo ocupa aproximadamente 38 px e o NT tem aproximadamente 13,5 px de altura. A assinatura em 176 px foi renderizada e inspecionada em fundo claro e escuro sem falha concreta de leitura; a aceitação final depende de teste em dispositivo real antes da produção. O NT isolado também foi renderizado e inspecionado com 24 px de altura.
- Área livre externa mínima: 12 unidades ao redor do símbolo, a partir do seu viewBox 96 × 96; na assinatura, 12 unidades em todas as bordas. Os SVGs não embutem todo esse espaço externo.
- Não distorcer, girar, adicionar sombras ou reabrir divisões na versão reduzida. Manter a estrutura navy na versão colorida. Para impressão de uma cor, usar os arquivos mono que têm juntas transparentes.

## Arquivos
- logo-primary-light.svg / logo-primary-dark.svg: assinatura principal.
- logo-primary-mono-light.svg / logo-primary-mono-dark.svg: assinatura em uma cor.
- mark-primary.svg / mark-primary-light.svg: símbolo colorido.
- mark-primary-mono.svg / mark-primary-mono-dark.svg: símbolo em uma cor.
- mark-small.svg / favicon.svg: símbolo simplificado.
- mark-small-mono.svg / mark-small-mono-dark.svg: símbolo simplificado em uma cor para claro/escuro, 16–24 px.
- nt-custom.svg: detalhe da ligatura NT.
- comparison.svg / comparison.png: prancha para homologação, com aplicações e verificações em 16, 24 e 32 px reais, assinatura a 176 px e NT com 24 px de altura.
- cube-geometry.json / nt-geometry.json: polígonos sem transformações, para reprodução vetorial em PDF. Coordenadas SVG com eixo Y para baixo.
- build_assets.py: fonte reprodutível da construção.

A geometria foi desenhada para esta proposta. Este material não constitui pesquisa de disponibilidade, registro ou exclusividade de marca.

## Entregáveis v2 e continuidade
A direção Fluxo foi mantida. A revisão substitui o símbolo por um cubo modular e desenha o NT em vetor. Paleta, hierarquia e fluxo da interface permanecem como base. Os mockups desktop e mobile receberam a assinatura v2. A proposta inicial permanece no histórico do documento e da apresentação.

Para interface, manter Plus Jakarta Sans, já usada no produto, com alternativa system-ui. Os mockups renderizados usam fontes equivalentes. brand-tokens.json descreve os tokens da interface e os mínimos do logo; contrast.json lista os pares efetivamente aplicados ao texto/status.

logo-contrast-v2.json informa os contrastes geométricos do símbolo. O par navy/cobalto é de 2,717:1 e pertence à ilustração da marca; não deve ser usado como texto pequeno nem como única fronteira de um controle funcional. O logotipo não representa uma certificação de acessibilidade.

Nenhuma implementação no Syncboard de produção foi executada. A execução interativa do protótipo em navegador segue não verificada neste ambiente; a revisão visual foi realizada nos mockups renderizados.
