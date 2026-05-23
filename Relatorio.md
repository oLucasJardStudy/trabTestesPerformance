RELATÓRIO DE PERFORMANCE
Endpoint GET /pokemon — API Node.js
Aula 12 — Testes de Performance
Ferramenta: Locust 2.44.0  |  Banco: MySQL  |  ORM: TypeORM
Resultados alcançados
Tempo médio
78,8 ms → 7,58 ms
−90%
P95
170 ms → 13 ms
−92%
Payload
702 KB → 6 KB
−99%
Falhas
0 → 0
= 0


1. Objetivo
Melhorar a performance do endpoint de listagem de Pokémons (GET /pokemon) da API Node.js, identificando gargalos, aplicando otimizações e comparando os resultados antes e depois das mudanças.

2. Problemas de Performance Identificados
Foram identificados 7 gargalos no comportamento original da API:

1. Listagem sem paginação (gargalo principal)
O endpoint original utilizava findAndCount() sem skip e take, fazendo o banco retornar todos os registros da tabela pokemon a cada requisição — 5.505 registros, gerando ~702 KB de payload JSON por resposta.
2. Duas queries pesadas por requisição
O TypeORM executava um SELECT completo + um COUNT(*) completo sem limitação, varrendo a tabela inteira em cada chamada. Em alta concorrência, o custo se multiplica.
3. Logging SQL sempre ativo em produção
A opção logging: true em src/config/database.ts escrevia cada query SQL no console. Sob dezenas ou centenas de requisições por segundo, o overhead de I/O é significativo.
4. Nova instância do repositório a cada requisição
Todos os handlers instanciavam new PokemonRepository() a cada chamada, gerando alocação repetida de objetos sem necessidade.
5. Ausência de índice na coluna name
A entidade Pokemon não possuía índice na coluna name, utilizada no endpoint GET /pokemon/:name — resultando em full table scan O(n) em tabelas grandes.
6. Pool de conexões sem configuração explícita
O TypeORM usava a configuração padrão do driver MySQL. Em picos de carga, havia risco de esgotar conexões disponíveis.
7. Configuração incorreta do Locust
O host padrão apontava para http://localhost:8089 (interface web do Locust) em vez da API (http://node-api:4444), gerando medições inválidas.


3. Melhorias Implementadas

1. Paginação no GET /pokemon
Implementados parâmetros page (padrão: 1) e limit (padrão: 50, máximo: 100). A resposta passou a incluir metadados completos para navegação.
GET /pokemon?page=1&limit=50  →  { items, total, page, limit, totalPages }
2. Consulta otimizada com skip, take, order e select
O SELECT passou a retornar apenas uma página de dados com os campos estritamente necessários (id, name, type, createdAt, updatedAt), reduzindo drásticamente o payload.
findAndCount({ skip, take: limit, order: { id: 'ASC' }, select: ['id','name','type','createdAt','updatedAt'] })
3. Logging condicional via variável de ambiente
Por padrão, logs SQL desligados. Para depuração, basta definir DB_LOGGING=true no ambiente.
logging: process.env.DB_LOGGING === 'true'
4. Repositório singleton
Criada a função getPokemonRepository() que reutiliza uma única instância do repositório durante toda a execução da aplicação.
5. Índice em name com @Index()
Adicionado @Index() na coluna name da entidade Pokemon, melhorando buscas no endpoint GET /pokemon/:name.
@Index()  @Column()  name: string;
6. Pool de conexões MySQL configurado
Limite de 10 conexões simultâneas definido explicitamente, evitando sobrecarga no MySQL.
extra: { connectionLimit: 10 }
7. Correção do ambiente de testes Locust
Corrigido o host para http://node-api:4444 no docker-compose.yml, locustfile.py e start.sh. A URL absoluta hardcoded foi substituída por host na classe + path relativo.

3.1 Arquivos Modificados

Arquivo
Tipo de mudança
src/endpoints/pokemon/PokemonController.ts
Paginação e consulta otimizada
src/endpoints/pokemon/Pokemon.repository.ts
Singleton do repositório
src/endpoints/pokemon/Pokemon.entity.ts
Índice em name
src/config/database.ts
Logging condicional e pool
locust-performance-test/docker-compose.yml
Host correto da API
locust-performance-test/locustfile.py
Configuração correta do HttpUser
scripts/seed-pokemon.mjs
Script para popular o banco
scripts/benchmark-list.mjs
Script de benchmark
scripts/run-locust-comparison.mjs
Testes Locust antes/depois
scripts/capture-locust-screenshots.mjs
Geração de PNG dos relatórios



4. Configuração do Teste (Locust)

Parâmetro
Valor
Ferramenta
Locust 2.44.0 (master + worker)
Endpoint testado
GET /pokemon
Usuários simultâneos
10
Spawn rate
2 usuários/segundo
Duração do teste
30 segundos
Registros no banco
5.505 Pokémons
Host da API
http://node-api:4444
Cenário ANTES
LEGACY_LIST=true + DB_LOGGING=true (comportamento original)
Cenário DEPOIS
Paginação padrão (50 itens) + logging desligado + repositório singleton


5. Resultados Comparativos
Os valores abaixo foram extraídos diretamente dos relatórios HTML gerados pelo Locust (prints incluídos na Seção 6). Esses são os dados definitivos do trabalho.

5.1 Tabela Comparativa — Métricas Locust

Métrica
ANTES
DEPOIS
Melhoria
Requisições totais
263
284
+8% throughput
Falhas
0
0
Sem erros
Tempo médio
78,8 ms
7,58 ms
~90% mais rápido
Mediana (P50)
66 ms
6 ms
~91% mais rápido
P60
72 ms
6 ms
~92% mais rápido
P70
84 ms
7 ms
~92% mais rápido
P80
100 ms
8 ms
~92% mais rápido
P90
140 ms
10 ms
~93% mais rápido
P95
170 ms
13 ms
~92% mais rápido
P99
230 ms
70 ms
~70% mais rápido
Tempo máximo (P100)
279 ms
101 ms
~64% mais rápido
Requisições/segundo (RPS)
8,86 req/s
9,65 req/s
+9%
Payload médio da resposta
701.836 bytes (~702 KB)
6.251 bytes (~6 KB)
~99% menor


Nota: os valores desta tabela foram extraídos diretamente dos prints do Locust (Seção 6) e constituem a fonte de verdade do trabalho.

5.2 Benchmark Manual Complementar
Teste com 50 requisições sequenciais (script scripts/benchmark-list.mjs):

Métrica
ANTES
DEPOIS
Tempo médio
69 ms
6,7 ms
P95
81,6 ms
10,7 ms
Erros HTTP
0
0



6. Prints do Locust

6.1 Cenário ANTES da Otimização
Data/hora: 21/05/2026, 21:28:48 – 21:29:17 (29 segundos)  |  Target Host: http://node-api:4444
Destaques: tempo médio de 78,8 ms, mediana 66 ms, P95 de 170 ms e payload de ~702 KB por resposta. A API retornava os 5.505 registros completos sem paginação.

[Print: ANTES-locust-print.png — Locust Test Report - antes da otimização]

6.2 Cenário DEPOIS da Otimização
Data/hora: 22/05/2026, 08:21:12 – 08:21:42 (30 segundos)  |  Target Host: http://node-api:4444
Destaques: tempo médio de 7,58 ms, mediana 6 ms, P95 de 13 ms e payload de ~6 KB por resposta. A paginação reduziu o payload em ~99% e o tempo de resposta em ~90%.

[Print: locust-print.png — Locust Test Report - depois da otimização]


7. Como Reproduzir os Testes

Subir a API e popular o banco
docker rm -f node-api
docker-compose up -d
node scripts/seed-pokemon.mjs

Benchmark manual
node scripts/benchmark-list.mjs
node scripts/benchmark-concurrent.mjs

Teste de carga com Locust (interface web)
cd locust-performance-test && ./start.sh
Acesse http://localhost:8089 — configure 10 usuários e spawn rate 2. O host da API já vem configurado como http://node-api:4444.

Teste comparativo automatizado (antes/depois + prints)
node scripts/run-locust-comparison.mjs
node scripts/capture-locust-screenshots.mjs

8. Conclusão
Os principais gargalos estavam na listagem completa da tabela sem paginação e no logging ativo do TypeORM. Com as sete melhorias implementadas, o endpoint passou a escalar melhor com bases grandes e sob carga simultânea.

A paginação é a melhoria mais relevante: redução de ~99% no payload (702 KB → 6 KB) e ~90% no tempo médio de resposta (78,8 ms → 7,58 ms). Em produção, listar milhares de registros de uma vez não é viável — a solução correta é retornar páginas e expor metadados (total, page, limit, totalPages) para o cliente navegar pelos dados.

As demais melhorias — repositório singleton, logging condicional, índice em name e pool configurado — são boas práticas que contribuem para a estabilidade e escalabilidade da aplicação mesmo em cenários de alta carga.

Resultado final: 0 erros nos dois cenários, throughput de 9,65 req/s, P95 em 13 ms.
