# MongoDB no Vercel

## Variáveis de ambiente

Cadastre estas variáveis no projeto da Vercel. Para desenvolvimento local, copie `.env.example` para `.env.local` e substitua os valores de exemplo.

- `MONGODB_URI`: string de conexão do MongoDB Atlas.
- `MONGODB_DB`: nome do banco; o padrão é `matto-chales`.
- `ADMIN_API_TOKEN`: chave longa e aleatória usada para autorizar gravações.

Não coloque valores reais em arquivos versionados nem em código executado no navegador.

## API do catálogo

- `GET /api/products`: lista produtos e alimenta a vitrine.
- `POST /api/products`: cria produto.
- `PUT /api/products?id=<id>`: atualiza produto.
- `DELETE /api/products?id=<id>`: remove produto.
- `POST /api/admin-session`: valida a chave de administração.

As operações de escrita exigem `Authorization: Bearer <ADMIN_API_TOKEN>`. O cliente conserva a chave apenas em memória enquanto a página está aberta. A conexão MongoDB é reutilizada entre invocações e registrada com `attachDatabasePool`.

Quando o MongoDB ainda não está configurado, o painel permite testar a gestão em modo local; essas alterações não são persistidas.

## Vercel

O site continua usando o export web do Expo. As funções server-side ficam em `api/`, que a Vercel reconhece como Vercel Functions. Os produtos podem ter um `imageUrl` HTTPS opcional, usado na foto em destaque do carrossel. Produtos sem foto própria usam as imagens de demonstração em `assets/`. Depois de definir as variáveis de ambiente, faça um novo deploy para ativar a persistência.
