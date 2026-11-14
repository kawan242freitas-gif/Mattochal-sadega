# MongoDB no Vercel

## Variáveis de ambiente

Cadastre estas variáveis no projeto da Vercel. Para desenvolvimento local, copie `.env.example` para `.env.local` e substitua os valores de exemplo.

- `MONGODB_URI`: string de conexão do MongoDB Atlas.
- `MONGODB_DB`: nome do banco; o padrão é `matto-chales`.
- `ADMIN_API_TOKEN`: chave longa e aleatória usada para autorizar gravações.
- `FIVEMANAGE_API_TOKEN` (opcional): chave privada de upload de mídia. Quando configurada, os comprovantes vão para o FiveManage e o MongoDB guarda a URL e o identificador do arquivo junto da comanda. Sem ela, o comprovante permanece armazenado no próprio MongoDB.

Não coloque valores reais em arquivos versionados nem em código executado no navegador.

## API do catálogo

- `GET /api/products`: lista produtos e alimenta a vitrine.
- `POST /api/products`: cria produto.
- `PUT /api/products?id=<id>`: atualiza produto.
- `DELETE /api/products?id=<id>`: remove produto.
- `POST /api/admin-session`: valida a chave de administração.
- `POST /api/orders`: cria uma comanda usando os preços atuais do catálogo e retorna um link com token aleatório.
- `GET /api/orders?token=<token>`: abre uma comanda pelo link privado.
- `POST /api/orders` com `action: "proof"`: anexa uma imagem JPEG otimizada à comanda e altera o status para `proof_submitted`.

As comandas guardam uma cópia dos produtos e preços no momento do pedido. O token público é salvo como hash; o link funciona como uma credencial privada para abrir os dados e o comprovante. Sem `FIVEMANAGE_API_TOKEN`, a imagem JPEG fica armazenada no documento MongoDB com limite de 1,8 MB após compressão. Com a variável configurada, a imagem é enviada ao FiveManage e o MongoDB conserva os metadados e a URL da foto. O envio do comprovante não confirma o crédito: a loja ainda precisa conferir o pagamento no banco.

As operações de escrita exigem `Authorization: Bearer <ADMIN_API_TOKEN>`. O cliente conserva a chave apenas em memória enquanto a página está aberta. A conexão MongoDB é reutilizada entre invocações e registrada com `attachDatabasePool`.

Quando o MongoDB ainda não está configurado, o painel permite testar a gestão em modo local; essas alterações não são persistidas.

## Vercel

O site continua usando o export web do Expo. As funções server-side ficam em `api/`, que a Vercel reconhece como Vercel Functions. Os produtos podem ter um `imageUrl` HTTPS opcional, usado na foto em destaque do carrossel. Produtos sem foto própria usam as imagens de demonstração em `assets/`. Depois de definir as variáveis de ambiente, faça um novo deploy para ativar a persistência.
