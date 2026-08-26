# Lavareda — ativação da V1 real

A base já está criada. Esta etapa publica o backend gratuito no Google Apps Script.

1. Abra a planilha **AUDAZ Delivery — Lavareda V1**.
2. Vá em **Extensões → Apps Script**.
3. No arquivo `Code.gs`, apague o conteúdo padrão.
4. Copie todo o conteúdo do arquivo `backend.gs` deste repositório e cole no `Code.gs`.
5. Clique em **Salvar**.
6. Clique em **Implantar → Nova implantação**.
7. Em **Selecionar tipo**, escolha **App da Web**.
8. Configure:
   - **Executar como:** Eu
   - **Quem pode acessar:** Qualquer pessoa
9. Clique em **Implantar** e autorize o script quando o Google solicitar.
10. Copie a **URL do app da Web**, que termina em `/exec`.
11. Envie essa URL no ChatGPT para conectar o portal.

Depois de conectado:
- Aprovações são registradas centralmente sem e-mail individual.
- Solicitações de alteração geram registro permanente + e-mail imediato.
- Solicitações de mudança de data geram registro permanente + e-mail imediato.
- Quando o lote inteiro ficar aprovado, a Audaz recebe um e-mail único.
- O cliente não precisa de login, nome ou senha.
