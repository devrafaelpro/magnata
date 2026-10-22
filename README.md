# 💰 Magnata — do farol ao trilhão

Jogo idle de dinheiro para celular. Você começa vendendo água no farol e constrói um império que vai da barbearia do bairro até a Esfera de Dyson e o Multiverso S.A.

Instala como app no iPhone (Safari → Compartilhar → **Adicionar à Tela de Início**) e funciona offline.

## O que tem

- **24 negócios** em 7 eras (Rua, Bairro, Cidade, País, Mundo, Espaço, Infinito), com marcos de quantidade que dobram lucro e velocidade
- **Gerentes** que automatizam os negócios e trabalham com o app fechado
- **Melhorias infinitas** por negócio, globais e de toque
- **Bolsa de valores e cripto** simuladas: ações, Tesouro Selic, Bitcão, Etério e a imprevisível Doguinha, com notícias que mexem nos preços e 15% de IR no lucro
- **Luxo**: 36 itens, do tênis de grife à Via Láctea, cada um multiplicando o lucro
- **Maletas de dinheiro** que aparecem na tela (frenesi x7, dedo de ouro, bolada)
- **Eventos com escolhas**: Receita Federal, greve, investidor-anjo, pôquer em Mônaco, hexa do Brasil...
- **Prestígio**: venda o império por ⭐ Reputação e recomece mais forte; talentos permanentes
- **Marcos da fortuna** (do primeiro salário mínimo ao Googol) e 180+ conquistas
- Ganhos offline, sons sintetizados, céu da cidade que cresce com você e muda com a hora do dia

## Rodar localmente

Sem build e sem dependências (HTML, CSS e JavaScript puro).

```bash
npm run dev     # http://localhost:5517
npm run sim     # simula 8h de jogo para checar o balanceamento
```

## Estrutura

- `js/engine.js` — economia, bolsa, eventos e prestígio (sem DOM; roda no Node)
- `js/data.js` — negócios, luxo, ativos, eventos, marcos e talentos
- `js/ui.js` — interface
- `js/fx.js` — sons, céu animado e partículas
- `scripts/sim.mjs` — simulador de balanceamento
