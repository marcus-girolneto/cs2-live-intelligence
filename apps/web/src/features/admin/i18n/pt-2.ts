// Português (Brasil) (pt) strings of the admin feature, part 2.
export const pt2: Record<string, string> = {
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
  Integrations: "Integrações",
  "Changes apply immediately and are stored encrypted in the database. No restart needed.":
    "As mudanças valem na hora e ficam criptografadas no banco. Não precisa reiniciar nada.",
  "Configured · Database": "Configurado · Banco de dados",
  "From .env (read-only bootstrap)": "Do .env (bootstrap somente leitura)",
  "Testing…": "Testando…",
  Connected: "Conectado",
  "{ms} ms": "{ms} ms",
  "Live mode": "Modo produção",
  "Test mode": "Modo teste",
  "The test failed.": "O teste falhou.",
  "Steam Web API": "Steam Web API",
  "Profiles, avatars and the account checks behind welcome credits.":
    "Perfis, avatares e as verificações de conta por trás dos créditos de boas-vindas.",
  "Create a key on the Steam developer page (signed in with the account that owns this site):":
    "Crie uma chave na página de desenvolvedor da Steam (logado na conta dona deste site):",
  "Web API key": "Chave da Web API",
  "Remove the stored Steam key?": "Remover a chave da Steam salva?",
  Stripe: "Stripe",
  "Plan subscriptions and credit pack checkout.":
    "Assinaturas de planos e checkout de pacotes de créditos.",
  "Keys: Stripe Dashboard → Developers → API keys. Webhook: Developers → Webhooks → Add endpoint, then copy its signing secret.":
    "Chaves: Dashboard da Stripe → Developers → API keys. Webhook: Developers → Webhooks → Add endpoint, depois copie o signing secret.",
  "Webhook URL": "URL do webhook",
  "Secret key": "Chave secreta",
  "Remove the stored Stripe secret key?":
    "Remover a chave secreta da Stripe salva?",
  "Webhook signing secret": "Segredo de assinatura do webhook",
  "Remove the stored webhook secret?": "Remover o segredo do webhook salvo?",
  "Publishable key (public)": "Chave publicável (pública)",
  "Accept payments": "Aceitar pagamentos",
  "When off, checkout buttons show “Coming soon”.":
    "Desligado, os botões de checkout mostram “Em breve”.",
  "Add the secret key first.": "Adicione a chave secreta primeiro.",
  "Add key": "Adicionar chave",
  "Save key": "Salvar chave",
  Copy: "Copiar",
  Copied: "Copiado",
  Save: "Salvar",
  "Enter a value.": "Digite um valor.",
  "Keys never contain spaces.": "Chaves nunca têm espaços.",
  "A Steam Web API key is 32 hexadecimal characters.":
    "Uma chave da Steam Web API tem 32 caracteres hexadecimais.",
  "Stripe secret keys start with sk_live_, sk_test_ (or rk_ for restricted keys).":
    "Chaves secretas da Stripe começam com sk_live_, sk_test_ (ou rk_ para chaves restritas).",
  "Stripe webhook secrets start with whsec_.":
    "Segredos de webhook da Stripe começam com whsec_.",
  "Publishable keys start with pk_live_ or pk_test_.":
    "Chaves publicáveis começam com pk_live_ ou pk_test_.",
  "Steam key saved.": "Chave da Steam salva.",
  "Steam key removed.": "Chave da Steam removida.",
  "Stripe secret key saved.": "Chave secreta da Stripe salva.",
  "Stripe secret key removed.": "Chave secreta da Stripe removida.",
  "Webhook secret saved.": "Segredo do webhook salvo.",
  "Webhook secret removed.": "Segredo do webhook removido.",
  "Publishable key saved.": "Chave publicável salva.",
  "Payments enabled.": "Pagamentos ativados.",
  "Payments disabled.": "Pagamentos desativados.",
  Product: "Produto",
  "Time zone for daily limits and monthly reports, Personal Coach cadence and upload size.":
    "Fuso horário dos limites diários e relatórios mensais, ritmo do Personal Coach e tamanho de upload.",
  "Time zone": "Fuso horário",
  "Days and months start at midnight in this zone.":
    "Dias e meses começam à meia-noite neste fuso.",
  "Not available on this server yet.": "Ainda não disponível neste servidor.",
  "Personal Coach: days between new plans":
    "Personal Coach: dias entre planos novos",
  "Personal Coach: new matches for a rewrite":
    "Personal Coach: partidas novas para reescrever",
  "Demo upload limit (MB)": "Limite de upload de demo (MB)",
  "A player can ask for a new plan after this many days.":
    "O jogador pode pedir um plano novo depois desses dias.",
  "…or sooner after this many new matches (also the automatic rewrite).":
    "…ou antes, depois dessas partidas novas (também a reescrita automática).",
  "Default 500 MB. The web proxy streams uploads up to this size.":
    "Padrão 500 MB. O proxy web transmite uploads até esse tamanho.",
  "Between 1 and 90 days.": "Entre 1 e 90 dias.",
  "Between 1 and 50 matches.": "Entre 1 e 50 partidas.",
  "Between 1 and 1024 MB.": "Entre 1 e 1024 MB.",
};
