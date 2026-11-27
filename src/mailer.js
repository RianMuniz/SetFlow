// Envio de e-mail. O padrão é o "console mailer": escreve a mensagem no log do servidor
// (docker compose logs app), útil em desenvolvimento e na demonstração do projeto.
// Para enviar e-mail de verdade, passe outro objeto { send({ to, subject, text }) } em
// createAuthApp({ mailer }) — por exemplo, um adaptador SMTP ou de um provedor de e-mail.
function createConsoleMailer(write = (text) => process.stdout.write(text)) {
  return {
    async send({ to, subject, text }) {
      const lines = [`Para: ${to}`, `Assunto: ${subject}`, '', ...String(text).split('\n')];
      write(`\n[SetFlow e-mail]\n${lines.map((line) => `  ${line}`).join('\n')}\n\n`);
    }
  };
}

module.exports = { createConsoleMailer };
