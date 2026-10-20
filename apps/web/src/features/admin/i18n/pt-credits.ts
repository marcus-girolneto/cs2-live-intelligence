// Portuguese strings of the admin credits, packs and per-purpose model assignment screens.
export const ptCredits: Record<string, string> = {
  "Credit economy": "Economia de créditos",
  "Welcome grant, review costs and limits that keep free credits fair.":
    "Crédito de boas-vindas, custos das reviews e limites que mantêm os créditos grátis justos.",
  "Save credit settings": "Salvar configurações de créditos",
  "Credits adjusted.": "Créditos ajustados.",
  "Credits of {name}": "Créditos de {name}",
  "Add or remove credits": "Adicionar ou remover créditos",
  "Note (shown in the player's history)":
    "Nota (aparece no histórico do jogador)",
  Apply: "Aplicar",
  Manage: "Gerenciar",
  "Welcome credits": "Créditos de boas-vindas",
  "Granted once to each eligible new Steam account.":
    "Concedidos uma vez a cada nova conta Steam elegível.",
  "Quick review cost": "Custo da review Quick",
  "Credits per Quick review.": "Créditos por review Quick.",
  "Credits per Deep review (Free and Basic).":
    "Créditos por review Deep (Free e Basic).",
  "Deep review cost on Pro": "Custo da review Deep no Pro",
  "Discounted Deep review for Pro.": "Review Deep com desconto para o Pro.",
  "Daily safety cap": "Limite diário de segurança",
  "Most reviews one account can run per day. Empty = no cap.":
    "Máximo de reviews que uma conta pode rodar por dia. Vazio = sem limite.",
  "Minimum Steam account age (days)": "Idade mínima da conta Steam (dias)",
  "Younger accounts don't get the welcome credit.":
    "Contas mais novas não recebem o crédito de boas-vindas.",
  "Welcome grants per network": "Créditos de boas-vindas por rede",
  "Limits farming of welcome credits from one network.":
    "Limita o abuso de créditos de boas-vindas a partir de uma rede.",
  "Monthly report": "Relatório mensal",
  "Quick review after each demo. A fast, reliable model.":
    "Review Quick após cada demo. Um modelo rápido e confiável.",
  "Deep review (utility, crosshair, positioning, rounds). Prefer your strongest model.":
    "Review Deep (utilitárias, mira, posicionamento, rounds). Prefira seu modelo mais forte.",
  "Monthly performance report for Pro players. A strong model with a large context.":
    "Relatório mensal de desempenho para jogadores Pro. Um modelo forte com contexto grande.",
  "Credits / month": "Créditos / mês",
  "One-off purchases. Purchased credits never expire. Take a pack off sale instead of deleting it.":
    "Compras avulsas. Créditos comprados nunca expiram. Tire um pacote de venda em vez de apagá-lo.",
  "Network window (days)": "Janela por rede (dias)",
  "Period in which the per-network limit applies.":
    "Período em que o limite por rede vale.",
  "Most AI reviews one account can run per day, whatever its balance.":
    "Máximo de reviews de IA que uma conta pode rodar por dia, independentemente do saldo.",
  "Discounted Deep review": "Review Deep com desconto",
  "{purpose} saved. New requests use it immediately.":
    "{purpose} salvo. Novas requisições já usam.",
  "Each purpose runs on its own model. Unassigned purposes fall back: Deep review and Monthly report use Quick review, Personal Coach uses Deep review, then the .env defaults.":
    "Cada finalidade roda no seu próprio modelo. Finalidades sem atribuição herdam: Review Deep e Relatório mensal usam a Review Quick, o Coach Pessoal usa a Review Deep, e depois os padrões do .env.",
  "Search {n} models": "Buscar entre {n} modelos",
  "Reload the model list": "Recarregar a lista de modelos",
  "Loading this provider's models…": "Carregando os modelos deste provedor…",
  "This provider doesn't list “{model}”. Pick one from the list.":
    "Este provedor não lista “{model}”. Escolha um da lista.",
  "Type the model id manually.": "Digite o id do modelo manualmente.",
  "This provider has no model list. Type the model id manually.":
    "Este provedor não tem lista de modelos. Digite o id manualmente.",
  "≈ {cost} per call at list price": "≈ {cost} por chamada no preço de tabela",
  "Price not published by this provider.":
    "Preço não publicado por este provedor.",
  "Answered in {ms} ms": "Respondeu em {ms} ms",
  "Saved: {model} · {date}": "Salvo: {model} · {date}",
  "Not assigned": "Não atribuído",
  "Save {purpose}": "Salvar {purpose}",
  "Same as Quick review": "Igual à Review Quick",
  "Same as Deep review": "Igual à Review Deep",
  Assigned: "Atribuído",
  "Uses {purpose}": "Usa {purpose}",
  "Falls back to .env": "Usa o .env",
  "Not configured": "Não configurado",
  "Personal Coach plans from all of a player's matches (Pro). Your strongest long-context model.":
    "Planos do Coach Pessoal a partir de todas as partidas do jogador (Pro). Seu modelo mais forte com contexto longo.",
  "We prefilled Extra body with provider.data_collection = \"deny\": OpenRouter then only routes to upstream providers that don't store or train on your prompts (players' match data). Remove it only if you accept that.":
    'Preenchemos o Extra body com provider.data_collection = "deny": assim o OpenRouter só usa provedores que não armazenam nem treinam com seus prompts (dados das partidas dos jogadores). Remova só se você aceitar isso.',
  "{n}k context": "contexto de {n}k",
  "no structured outputs": "sem saída estruturada",
};
